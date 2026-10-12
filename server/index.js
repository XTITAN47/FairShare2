const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const dns = require('dns');

// Load environment variables before importing modules that may use them.
dotenv.config();

const mongoDnsServers = (process.env.MONGO_DNS_SERVERS || '8.8.8.8,8.8.4.4')
    .split(',')
    .map((serverAddress) => serverAddress.trim())
    .filter(Boolean);

if (mongoDnsServers.length > 0) {
    dns.setServers(mongoDnsServers);
}

// Import routes
const userRoutes = require('./routes/users');
const groupRoutes = require('./routes/groups');
const expenseRoutes = require('./routes/expenses');

// Initialize Express app
const app = express();
const server = http.createServer(app);

const configuredClientOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

const corsOrigin = configuredClientOrigins.length > 0
    ? (origin, callback) => {
        if (!origin || configuredClientOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Origin is not allowed by CORS'));
    }
    : true;

// Middleware
app.use(cors({
    origin: corsOrigin,
    credentials: true
}));
app.use(express.json());
// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Return a useful response while MongoDB is unavailable instead of failing auth requests generically.
app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ message: 'Database unavailable. Check MONGO_URI and MongoDB network access.' });
    }
    next();
});

// Connect to MongoDB and retry transient network/DNS failures.
const connectToMongoDB = async () => {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/expense-sharing-daa';

    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000
        });
        console.log('MongoDB connected');
    } catch (err) {
        console.error(`MongoDB connection error: ${err.message}`);
        console.error('Retrying MongoDB connection in 5 seconds...');
        setTimeout(connectToMongoDB, 5000);
    }
};

connectToMongoDB();

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: corsOrigin,
        methods: ['GET', 'POST'],
        credentials: true
    },
    pingTimeout: 60000 // Increase ping timeout to prevent premature disconnects
});

// Socket.io connection
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Join a group room
    socket.on('join_group', (groupId) => {
        socket.join(groupId);
        console.log(`User ${socket.id} joined group: ${groupId}`);
    });

    // Leave a group room
    socket.on('leave_group', (groupId) => {
        socket.leave(groupId);
        console.log(`User ${socket.id} left group: ${groupId}`);
    });    // New expense added
    socket.on('expense_added', (data) => {
        console.log('Expense added:', data);
        // Broadcast to all members in the group room
        io.to(data.groupId).emit('expense_added', data);
    });

    // Settlement update
    socket.on('settlement_update', (data) => {
        console.log('Settlement update:', data);
        // Broadcast to all members in the group room
        io.to(data.groupId).emit('settlement_update', data);
    });

    // Expense deleted
    socket.on('expense_deleted', (data) => {
        console.log('Expense deleted:', data);
        // Broadcast to all members in the group room
        io.to(data.groupId).emit('expense_deleted', data);
    });// Member removed
    socket.on('member_removed', (data) => {
        socket.to(data.groupId).emit('member_removed', data);
    });

    // Group deleted
    socket.on('group_deleted', (data) => {
        socket.broadcast.emit('group_deleted', data);
    });    // Group invitation sent
    socket.on('invitation_sent', (data) => {
        console.log('Invitation sent:', data);
        // Broadcast to all users since we don't know which socket belongs to the invitee
        socket.broadcast.emit('invitation_received', data);
    });

    // Invitation response (accept/reject)
    socket.on('invitation_response', (data) => {
        console.log('Invitation response:', data);
        // Broadcast to the group room
        io.to(data.groupId).emit('invitation_response', data);
        // Also broadcast to all sockets to update dashboards
        socket.broadcast.emit('invitation_response', data);
    });

    // Member added to group
    socket.on('member_added', (data) => {
        console.log('Member added to group:', data);
        // Broadcast to all sockets to update their dashboards if needed
        io.emit('member_added', data);
    });    // Disconnect
    socket.on('disconnect', (reason) => {
        console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
        // Clean up any rooms this socket was in
        Array.from(socket.rooms).forEach(room => {
            if (room !== socket.id) {
                console.log(`Auto-leaving room: ${room} due to disconnect`);
                socket.leave(room);
            }
        });
    });
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/expenses', expenseRoutes);

// Root route
app.get('/', (req, res) => {
    res.send('Expense Sharing DAA API is running');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    // Display local IP addresses
    require('./showLocalIp');
});