const MemberList = ({
    group,
    user,
    memberTotals,
    inviteMethod,
    newMemberEmail,
    newMemberPhone,
    onRemoveMember,
    onOpenQrModal,
    onInviteMethodChange,
    onEmailChange,
    onPhoneChange,
    onInviteMember
}) => (
    <div className="members-section">
        <h2>Members</h2>
        <ul className="members-list">
            {group.members.map(member => (
                <li key={member.user} className="member-item">
                    <div className="member-info">
                        <span className="member-name">{member.name}</span>
                        <div className="member-contact">
                            <span className="member-email">{member.email}</span>
                            {member.phone && <span className="member-phone">{member.phone}</span>}
                        </div>
                        <div className="member-financials">
                            <span>Paid ₹{(memberTotals[String(member.user)]?.paid || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            <span>Share ₹{(memberTotals[String(member.user)]?.share || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                            <strong className={(memberTotals[String(member.user)]?.paid || 0) - (memberTotals[String(member.user)]?.share || 0) >= 0 ? 'positive' : 'negative'}>
                                Balance ₹{((memberTotals[String(member.user)]?.paid || 0) - (memberTotals[String(member.user)]?.share || 0)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                            </strong>
                        </div>
                        {member.user === group.createdBy && <span className="owner-badge">Group Owner</span>}
                    </div>
                    <div className="btn-group">
                        {group.createdBy === user._id && member.user !== user._id && (
                            <button className="btn btn-danger btn-sm" onClick={() => onRemoveMember(member.user)}>
                                <i className="fas fa-user-minus"></i> Remove
                            </button>
                        )}
                        <button className="btn btn-secondary btn-sm" onClick={() => onOpenQrModal(member)}>
                            <i className="fas fa-qrcode"></i> QR Code
                        </button>
                    </div>
                </li>
            ))}
        </ul>

        {group.invitations && group.invitations.filter(invite => invite.status === 'pending').length > 0 && (
            <div className="pending-invitations">
                <h3>Pending Invitations</h3>
                <ul className="invitations-list">
                    {group.invitations.filter(invite => invite.status === 'pending').map(invite => (
                        <li key={invite.user} className="invitation-item">
                            <div className="invitation-info">
                                <span className="invitee-name">{invite.name}</span>
                                <div className="invitee-contact">
                                    {invite.invitedVia === 'email'
                                        ? <span className="invitee-email">{invite.email}</span>
                                        : <span className="invitee-phone">{invite.phone}</span>}
                                </div>
                                <span className="invitation-status">Pending</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        <form onSubmit={onInviteMember} className="invite-member-form">
            <h3>Invite New Member</h3>
            <p>Invite a person to this group by email or phone number.</p>
            <div className="invite-method-selector">
                <div>
                    <input type="radio" id="email-invite" name="inviteMethod" value="email"
                        checked={inviteMethod === 'email'} onChange={onInviteMethodChange} />
                    <label htmlFor="email-invite">Email</label>
                </div>
                <div>
                    <input type="radio" id="phone-invite" name="inviteMethod" value="phone"
                        checked={inviteMethod === 'phone'} onChange={onInviteMethodChange} />
                    <label htmlFor="phone-invite">Phone Number</label>
                </div>
            </div>
            <div className="form-group">
                {inviteMethod === 'email' ? (
                    <input type="email" placeholder="Enter email" value={newMemberEmail}
                        onChange={onEmailChange} required />
                ) : (
                    <input type="tel" placeholder="Enter phone" value={newMemberPhone}
                        onChange={onPhoneChange} required />
                )}
                <button type="submit" className="btn btn-primary">
                    <i className="fas fa-paper-plane"></i> Send Invitation
                </button>
            </div>
        </form>
    </div>
);

export default MemberList;
