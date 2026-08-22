import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLES = ['viewer', 'editor', 'admin'];

export default function UserManagement() {
  const { profile: myProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');

  useEffect(() => { loadUsers(); }, []);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    setUsers(data || []);
    setLoading(false);
  }

  async function changeRole(userId, newRole) {
    setSaving(userId);
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setUsers(u => u.map(p => p.id === userId ? { ...p, role: newRole } : p));
    setSaving(null);
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    // Supabase doesn't support admin-invite from client SDK without service key.
    // We open a mailto with instructions instead — admin sends the signup link.
    const subject = encodeURIComponent('You are invited to Prompt Manager');
    const body = encodeURIComponent(
      `Hi,\n\nYou have been invited to the SAP Prompt Manager as a ${inviteRole}.\n\nSign up here: ${window.location.origin}${window.location.pathname}\n\nYour role will be set to "${inviteRole}" once you sign up.\n\nThanks`
    );
    window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`);
    setInviteMsg(`Invite email opened for ${inviteEmail}. Once they sign up, set their role below.`);
    setInviteEmail('');
    setInviting(false);
  }

  if (loading) return <div className="admin-loading">Loading users…</div>;

  return (
    <div className="user-mgmt">
      <h3 className="admin-section-title">Team members</h3>

      <table className="user-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className={u.id === myProfile?.id ? 'user-row-self' : ''}>
              <td className="user-email">{u.email}</td>
              <td>{u.display_name || <span style={{ opacity: 0.4 }}>—</span>}</td>
              <td>
                {u.id === myProfile?.id ? (
                  <span className={`role-badge role-${u.role}`}>{u.role}</span>
                ) : (
                  <select
                    className="role-select"
                    value={u.role}
                    disabled={saving === u.id}
                    onChange={e => changeRole(u.id, e.target.value)}
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
              </td>
              <td className="user-date">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invite-section">
        <h3 className="admin-section-title" style={{ marginTop: 20 }}>Invite a user</h3>
        <form className="invite-form" onSubmit={handleInvite}>
          <input
            className="invite-email-input"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            required
          />
          <select className="role-select" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="invite-btn" type="submit" disabled={inviting}>
            Send invite
          </button>
        </form>
        {inviteMsg && <p className="invite-msg">{inviteMsg}</p>}
      </div>
    </div>
  );
}
