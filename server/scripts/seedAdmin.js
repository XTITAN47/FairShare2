const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const requiredEnvironmentVariables = ['MONGO_URI', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'];
const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
    (name) => !process.env[name]
);

if (missingEnvironmentVariables.length > 0) {
    console.error(`Missing environment variables: ${missingEnvironmentVariables.join(', ')}`);
    process.exit(1);
}

async function seedAdmin() {
    await mongoose.connect(process.env.MONGO_URI);

    const password = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const admin = await User.findOneAndUpdate(
        { email: process.env.ADMIN_EMAIL },
        {
            $set: {
                name: process.env.ADMIN_NAME || 'Administrator',
                password,
                role: 'admin'
            },
            $setOnInsert: {
                phone: process.env.ADMIN_PHONE || `admin-${Date.now()}`
            }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    ).select('_id email role');

    console.log(`Admin account ready: ${admin.email} (${admin.role})`);
}

seedAdmin()
    .catch((error) => {
        console.error('Unable to seed admin account:', error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });