import { useState, useEffect, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import AuthContext from "../../context/AuthContext";
import Loader from "../layout/Loader";
import QRUploadModal from "../layout/QRUploadModal";
import "./Home.css";

const Home = () => {
    const { user, socket } = useContext(AuthContext);
    const [groups, setGroups] = useState([]);
    const [summary, setSummary] = useState({ total: 0, share: 0, paid: 0 });
    const [invitations, setInvitations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [showQRCodeNotification, setShowQRCodeNotification] = useState(false);
    const [qrModalOpen, setQRModalOpen] = useState(false);
    const [groupSearch, setGroupSearch] = useState("");
    const [groupSort, setGroupSort] = useState("recent");
    const [groupView, setGroupView] = useState("grid");

    const fetchGroupsWithTotals = useCallback(async () => {
        const groupsRes = await axios.get("/groups");
        const enrichedGroups = await Promise.all(groupsRes.data.map(async (group) => {
            const expensesRes = await axios.get(`/expenses/group/${group._id}`);
            const totals = expensesRes.data.reduce((accumulator, expense) => {
                const mySplit = expense.splitAmong.find((split) => split.user === user?._id);
                return {
                    total: accumulator.total + Number(expense.amount || 0),
                    share: accumulator.share + Number(mySplit?.amount || 0),
                    paid: accumulator.paid + (expense.paidBy.user === user?._id ? Number(expense.amount || 0) : 0)
                };
            }, { total: 0, share: 0, paid: 0 });
            return { ...group, expenseTotals: totals };
        }));

        setGroups(enrichedGroups);
        setSummary(enrichedGroups.reduce((accumulator, group) => ({
            total: accumulator.total + group.expenseTotals.total,
            share: accumulator.share + group.expenseTotals.share,
            paid: accumulator.paid + group.expenseTotals.paid
        }), { total: 0, share: 0, paid: 0 }));
    }, [user?._id]);

    // Fetch user's groups and invitations
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch groups
                await fetchGroupsWithTotals();

                // Fetch pending invitations
                const invitationsRes = await axios.get("/groups/invitations/pending");
                setInvitations(invitationsRes.data);

                setLoading(false);
            } catch (err) {
                setError("Error fetching data");
                console.error("Error fetching data:", err);
                setLoading(false);
            }
        };

        fetchData();
    }, [fetchGroupsWithTotals]); // Listen for real-time updates
    useEffect(() => {
        if (socket && user) {
            // Listen for new expense notifications
            socket.on("expense_added", (data) => {
                console.log("New expense added:", data);
                // You could update the UI or show a notification here
            });

            // Listen for settlement updates
            socket.on("settlement_update", (data) => {
                console.log("Settlement update:", data);
                // You could update the UI or show a notification here
            });

            // Listen for group deletions
            socket.on("group_deleted", (data) => {
                setGroups((prevGroups) =>
                    prevGroups.filter((group) => group._id !== data.groupId),
                );
            });

            // Listen for new invitations and automatically refresh the invitations list
            socket.on("invitation_received", (data) => {
                // Check if the invitation is for the current user
                if (user && data.invitedEmail === user.email) {
                    console.log("New invitation received for current user");
                    // Fetch the updated invitation list
                    axios
                        .get("/groups/invitations/pending")
                        .then((res) => setInvitations(res.data))
                        .catch((err) => console.error("Error fetching invitations:", err));
                }
            });

            // Listen for member added events
            socket.on("member_added", (data) => {
                console.log("Member added event received:", data);
                // Refresh the groups list for everyone to see updates
                fetchGroupsWithTotals()
                    .catch((err) => console.error("Error fetching groups:", err));
            });

            // Set up a polling interval to refresh data periodically
            const intervalId = setInterval(() => {
                console.log("Refreshing dashboard data..."); // Refresh invitations
                axios
                    .get("/groups/invitations/pending")
                    .then((response) => setInvitations(response.data))
                    .catch((err) => console.error("Error fetching invitations:", err));

                // Refresh groups
                fetchGroupsWithTotals()
                    .catch((err) => console.error("Error fetching groups:", err));
            }, 15000); // Refresh every 15 seconds

            return () => {
                if (socket) {
                    socket.off("expense_added");
                    socket.off("settlement_update");
                    socket.off("group_deleted");
                    socket.off("invitation_received");
                    socket.off("member_added");
                }
                clearInterval(intervalId);
            };
        }

        return () => {
            if (socket) {
                socket.off("expense_added");
                socket.off("settlement_update");
                socket.off("group_deleted");
                socket.off("invitation_received");
                socket.off("member_added");
            }
        };
    }, [fetchGroupsWithTotals, socket, user]);
    const handleDeleteGroup = async (groupId) => {
        try {
            if (
                window.confirm(
                    "Are you sure you want to delete this group? This action cannot be undone.",
                )
            ) {
                await axios.delete(`/groups/${groupId}`);
                // Update groups state immediately
                setGroups((prevGroups) =>
                    prevGroups.filter((group) => group._id !== groupId),
                );
                // Emit socket event for real-time update
                if (socket) {
                    socket.emit("group_deleted", { groupId });
                }
            }
        } catch (err) {
            setError("Failed to delete group");
            console.error("Error deleting group:", err);
        }
    };
    const handleInvitationResponse = async (groupId, response) => {
        try {
            await axios.post(`/groups/${groupId}/invitations/respond`, { response });

            // Remove invitation from the list
            setInvitations((prevInvitations) =>
                prevInvitations.filter(
                    (invitation) => invitation.group.toString() !== groupId,
                ),
            );

            // If accepted, add the group to the groups list
            if (response === "accept") {
                // Fetch the updated group list
                await fetchGroupsWithTotals();
            }

            // Emit socket event for real-time update
            if (socket) {
                const responseData = {
                    groupId,
                    userId: user._id,
                    userName: user.name,
                    userEmail: user.email,
                    status: response,
                };

                socket.emit("invitation_response", responseData);

                // If accepted, also emit member_added event
                if (response === "accept") {
                    socket.emit("member_added", {
                        groupId,
                        userId: user._id,
                        userName: user.name,
                        userEmail: user.email,
                    });

                    // Join the group socket room
                    socket.emit("join_group", groupId);
                }
            }
        } catch (err) {
            setError(`Failed to ${response} invitation`);
            console.error(`Error ${response}ing invitation:`, err);
        }
    };  // Check if user has uploaded QR code
    useEffect(() => {
        if (user && !loading) {
            console.log("Checking if user has QR code:", user.paymentQRCode ? "Yes" : "No");
            // If user doesn't have a payment QR code, show notification
            // Notification will stay visible until the user uploads a QR code
            setShowQRCodeNotification(!user.paymentQRCode);
        }
    }, [user, loading]);

    const filteredGroups = groups
        .filter((group) => {
            const search = groupSearch.trim().toLowerCase();
            return !search
                || group.name.toLowerCase().includes(search)
                || (group.description || "").toLowerCase().includes(search);
        })
        .sort((a, b) => {
            if (groupSort === "name") return a.name.localeCompare(b.name);
            if (groupSort === "amount") return (b.expenseTotals?.total || 0) - (a.expenseTotals?.total || 0);
            return 0;
        });

    if (loading) {
        return (
            <div className="container">
                <Loader size="large" />
            </div>
        );
    }

    return (
        <section className="container dashboard-container home-dashboard animate-fade-in">
            <header className="dashboard-header">
                <div>
                    <h1>Welcome back</h1>
                </div>
                <div className="dashboard-header-actions">
                    <Link to="/groups/create" className="btn btn-primary">
                        New group
                    </Link>
                    <button className="btn btn-outline-secondary" onClick={() => setQRModalOpen(true)}>
                        Join with QR
                    </button>
                </div>
                {error && <div className="alert alert-danger">{error}</div>}
            </header>

            <div className="dashboard-summary" aria-label="Expense summary">
                <div className="summary-card">
                    <span>You owe</span>
                    <strong>₹{Math.max(summary.share - summary.paid, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
                <div className="summary-card summary-card-accent">
                    <span>You're owed</span>
                    <strong>₹{Math.max(summary.paid - summary.share, 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
                <div className="summary-card summary-card-amber">
                    <span>Spent this month</span>
                    <strong>₹{summary.total.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
            </div>

            {/* QR Code Notification */}
            {showQRCodeNotification && (
                <div className="alert alert-info qr-code-alert">
                    <div className="qr-alert-content">
                        <i className="fas fa-info-circle"></i>
                        <span>
                            Add your payment QR code to make it easier for others to pay you
                        </span>
                    </div>
                    <button
                        onClick={() => setQRModalOpen(true)}
                        className="btn btn-sm btn-primary"
                    >
                        Add QR Code
                    </button>
                </div>
            )}

            {/* QR Code Upload Modal */}
            <QRUploadModal
                isOpen={qrModalOpen}
                onClose={() => {
                    console.log("QR modal closed");
                    setQRModalOpen(false);
                }}
                onSuccess={() => {
                    console.log("QR upload successful, hiding notification");
                    setShowQRCodeNotification(false);
                }}
            />

            {/* Group Invitations Section */}
            {invitations.length > 0 && (
                <div className="invitations-section animate-slide-up">
                    <h2 className="section-title">
                        <i className="fas fa-envelope mr-2"></i> Pending Invitations
                    </h2>
                    <div className="invitations">
                        {invitations.map((invitation) => (
                            <div key={invitation.group} className="invitation">
                                <div className="invitation-details">
                                    <h3>{invitation.groupName}</h3>
                                    <p>
                                        <i className="fas fa-user mr-1"></i> Invited by:{" "}
                                        {invitation.inviterName}
                                    </p>
                                    <p>
                                        <i className="fas fa-calendar-alt mr-1"></i> Sent:{" "}
                                        {new Date(invitation.sentAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="invitation-actions">
                                    <button
                                        className="btn btn-success mr-2"
                                        onClick={() =>
                                            handleInvitationResponse(invitation.group, "accept")
                                        }
                                    >
                                        <i className="fas fa-check"></i> Accept
                                    </button>
                                    <button
                                        className="btn btn-danger"
                                        onClick={() =>
                                            handleInvitationResponse(invitation.group, "reject")
                                        }
                                    >
                                        <i className="fas fa-times"></i> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="groups-section home-groups-section animate-slide-up" id="groups">
                <div className="groups-heading">
                    <div>
                        <h2 className="section-title">Your groups</h2>
                    </div>
                </div>

                {groups.length === 0 ? (
                    <p className="text-center">
                        <i className="fas fa-info-circle mr-2"></i>
                        You haven't joined any groups yet. Create one to get started!
                    </p>
                ) : (
                    <>
                        <div className="groups-toolbar home-groups-toolbar">
                            <label className="group-search">
                                <i className="fas fa-search"></i>
                                <input
                                    type="search"
                                    value={groupSearch}
                                    onChange={(event) => setGroupSearch(event.target.value)}
                                    placeholder="Search groups"
                                    aria-label="Search groups"
                                />
                            </label>
                            <div className="groups-toolbar-actions">
                                <select value={groupSort} onChange={(event) => setGroupSort(event.target.value)} aria-label="Sort groups">
                                    <option value="recent">Recently added</option>
                                    <option value="name">Name</option>
                                    <option value="amount">Highest spend</option>
                                </select>
                                <div className="view-toggle" aria-label="Group view">
                                    <button className={groupView === "grid" ? "active" : ""} onClick={() => setGroupView("grid")} aria-label="Grid view">
                                        <i className="fas fa-th-large"></i>
                                    </button>
                                    <button className={groupView === "list" ? "active" : ""} onClick={() => setGroupView("list")} aria-label="List view">
                                        <i className="fas fa-list"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="groups home-groups">
                        {filteredGroups.length === 0 ? (
                            <p className="groups-empty">No groups match “{groupSearch}”. Try another search.</p>
                        ) : filteredGroups.map((group) => (
                            <div key={group._id} className="group">
                                <div className="group-details">
                                    <div className="group-title-row">
                                        <h2>{group.name}</h2>
                                        <span className="group-members">{group.members.length} members</span>
                                    </div>
                                    <p className="group-balance">You owe ₹{Math.max((group.expenseTotals?.share || 0) - (group.expenseTotals?.paid || 0), 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</p>
                                    <div className="group-expenses">
                                        <span>Expenses tracked</span>
                                        <strong>₹{(group.expenseTotals?.total || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                                    </div>
                                </div>
                                <div className="group-actions">
                                    <Link
                                        to={`/groups/${group._id}`}
                                        className="btn btn-primary btn-sm"
                                    >
                                        <i className="fas fa-eye"></i> View
                                    </Link>
                                    {group.createdBy === user._id && (
                                        <button
                                            className="btn btn-danger btn-sm"
                                            onClick={() => handleDeleteGroup(group._id)}
                                        >
                                            <i className="fas fa-trash"></i> Delete
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        </div>
                        <div className="home-spending">
                            <h2>Your spending by group</h2>
                            {filteredGroups.map((group) => (
                                <div className="spending-row" key={`spending-${group._id}`}>
                                    <div><span>{group.name}</span><strong>₹{(group.expenseTotals?.total || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong></div>
                                    <div className="spending-track">
                                        <span style={{ width: `${summary.total ? Math.min((group.expenseTotals?.total || 0) / summary.total * 100, 100) : 0}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </section>
    );
};

export default Home;
