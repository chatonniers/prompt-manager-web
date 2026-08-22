import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useApp } from '../../context/AppContext.jsx';

const ROLES = ['viewer', 'editor', 'admin'];

function DomainPills({ value = [], onChange, categories, disabled }) {
  return (
    <div className="domain-pills">
      {categories.map(cat => {
        const active = value.includes(cat);
        return (
          <button
            key={cat}
            type="button"
            className={`domain-pill${active ? ' active' : ''}`}
            onClick={() => {
              if (disabled) return;
              onChange(active ? value.filter(c => c !== cat) : [...value, cat]);
            }}
            disabled={disabled}
          >
            {cat}
          </button>
        );
      })}
    </div>
  );
}

function UserRow({ u, isSelf, selected, onToggleSelect, onSave, onBlock, onDelete, onDisconnect, isOnline, categories }) {
  const [role, setRole] = useState(u.role);
  const [name, setName] = useState(u.display_name || '');
  const [domains, setDomains] = useState(u.domain_expertise || []);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isBlocked = u.role === 'blocked';

  const origDomains = u.domain_expertise || [];
  const dirty = role !== u.role
    || name !== (u.display_name || '')
    || JSON.stringify([...domains].sort()) !== JSON.stringify([...origDomains].sort());

  useEffect(() => {
    setRole(u.role);
    setName(u.display_name || '');
    setDomains(u.domain_expertise || []);
  }, [u.role, u.display_name, u.domain_expertise]);

  async function handleSave() {
    setSaving(true);
    await onSave(u.id, role, name, domains);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleBlock() {
    setBlocking(true);
    await onBlock(u.id, !isBlocked);
    setBlocking(false);
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    await onDisconnect(u.id);
    setDisconnecting(false);
  }

  return (
    <tr className={isSelf ? 'user-row-self' : isBlocked ? 'user-row-blocked' : ''}>
      <td style={{ width: 28, textAlign: 'center' }}>
        {!isSelf && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(u.id)}
            style={{ cursor: 'pointer', accentColor: 'var(--pm-accent)' }}
          />
        )}
      </td>
      <td className="user-email" style={isBlocked ? { opacity: 0.45, textDecoration: 'line-through' } : {}}>
        <span
          className="user-online-dot"
          style={{ background: isOnline ? '#34D399' : 'var(--pm-border2)', boxShadow: isOnline ? '0 0 5px #34D399' : 'none' }}
          title={isOnline ? 'Online' : 'Offline'}
        />
        {u.email}
      </td>
      <td>
        <input
          className="invite-email-input"
          style={{ minWidth: 0, width: '100%', padding: '3px 7px', fontSize: 12 }}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="—"
        />
      </td>
      <td>
        <DomainPills
          value={domains}
          onChange={setDomains}
          categories={categories}
          disabled={isBlocked}
        />
      </td>
      <td>
        {isSelf ? (
          <span className={`role-badge role-${role}`}>{role}</span>
        ) : (
          <select
            className="role-select"
            value={isBlocked ? 'blocked' : role}
            onChange={e => { if (e.target.value !== 'blocked') setRole(e.target.value); }}
            disabled={isBlocked}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            {isBlocked && <option value="blocked">blocked</option>}
          </select>
        )}
      </td>
      <td className="user-date">{new Date(u.created_at).toLocaleDateString()}</td>
      <td>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
          {dirty && !isBlocked && (
            <button className="user-action-btn user-action-save" onClick={handleSave} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
          )}
          {!dirty && saved && (
            <span className="user-save-ok">✓ Saved</span>
          )}
          {!isSelf && !confirmDelete && (
            <>
              <button
                className={`user-action-btn${isBlocked ? ' user-action-unblock' : ' user-action-block'}`}
                onClick={handleBlock}
                disabled={blocking}
              >
                {blocking ? '…' : isBlocked ? 'Unblock' : 'Block'}
              </button>
              {isOnline && !isSelf && (
                <button
                  className="user-action-btn user-action-disconnect"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  title="Force disconnect"
                >
                  {disconnecting ? '…' : 'Kick'}
                </button>
              )}
              <button className="user-action-btn user-action-delete" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            </>
          )}
          {!isSelf && confirmDelete && (
            <>
              <span style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600, whiteSpace: 'nowrap' }}>Sure?</span>
              <button className="user-action-btn user-action-delete" onClick={() => onDelete(u.id)}>Yes</button>
              <button className="user-action-btn" onClick={() => setConfirmDelete(false)}>No</button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function UserManagement() {
  const { profile: myProfile, refreshProfile } = useAuth();
  const { state } = useApp();
  const categories = state.catalog?.categories || [];

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [bulkAction, setBulkAction] = useState('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState('');
  const [onlineIds, setOnlineIds] = useState(new Set());
  const presenceRef = useRef(null);

  useEffect(() => { loadUsers(); }, []);

  useEffect(() => {
    if (!myProfile?.id) return;

    function syncOnline() {
      const ch = supabase.getChannels().find(c => c.topic === 'realtime:online-users');
      if (ch) {
        const state = ch.presenceState();
        setOnlineIds(new Set(Object.keys(state)));
      }
    }

    syncOnline();
    const interval = setInterval(syncOnline, 3000);
    presenceRef.current = interval;
    return () => clearInterval(interval);
  }, [myProfile?.id]);

  async function loadUsers() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at');
    setUsers(data || []);
    setLoading(false);
  }

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    const others = users.filter(u => u.id !== myProfile?.id).map(u => u.id);
    if (selected.size === others.length) setSelected(new Set());
    else setSelected(new Set(others));
  }

  async function saveUser(userId, role, displayName, domainExpertise) {
    const { error } = await supabase.from('profiles').update({
      role,
      display_name: displayName || null,
      domain_expertise: domainExpertise?.length ? domainExpertise : null,
    }).eq('id', userId);
    if (error) { console.error(error); return; }
    setUsers(u => u.map(p => p.id === userId ? { ...p, role, display_name: displayName || null, domain_expertise: domainExpertise } : p));
    if (userId === myProfile?.id) await refreshProfile();
  }

  async function blockUser(userId, block) {
    const newRole = block ? 'blocked' : 'viewer';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) { console.error(error); return; }
    setUsers(u => u.map(p => p.id === userId ? { ...p, role: newRole } : p));
  }

  async function deleteUser(userId) {
    const { error } = await supabase.from('profiles').delete().eq('id', userId);
    if (error) { console.error(error); return; }
    setUsers(u => u.filter(p => p.id !== userId));
    setSelected(s => { const n = new Set(s); n.delete(userId); return n; });
  }

  async function disconnectUser(userId) {
    const ch = supabase.channel(`profile-${userId}`);
    await ch.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await ch.send({ type: 'broadcast', event: 'kick', payload: {} });
        await new Promise(r => setTimeout(r, 600));
        const user = users.find(u => u.id === userId);
        const originalRole = user?.role || 'viewer';
        await supabase.from('profiles').update({ role: 'blocked' }).eq('id', userId);
        await new Promise(r => setTimeout(r, 800));
        if (originalRole !== 'blocked') {
          await supabase.from('profiles').update({ role: originalRole }).eq('id', userId);
          setUsers(u => u.map(p => p.id === userId ? { ...p, role: originalRole } : p));
        } else {
          setUsers(u => u.map(p => p.id === userId ? { ...p, role: 'blocked' } : p));
        }
        supabase.removeChannel(ch);
      }
    });
  }

  async function applyBulkAction() {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === 'delete' && !confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    setConfirmBulkDelete(false);
    const ids = [...selected];
    if (bulkAction === 'block') {
      await Promise.all(ids.map(id => supabase.from('profiles').update({ role: 'blocked' }).eq('id', id)));
      setUsers(u => u.map(p => ids.includes(p.id) ? { ...p, role: 'blocked' } : p));
    } else if (bulkAction === 'unblock') {
      await Promise.all(ids.map(id => supabase.from('profiles').update({ role: 'viewer' }).eq('id', id)));
      setUsers(u => u.map(p => ids.includes(p.id) ? { ...p, role: 'viewer' } : p));
    } else if (bulkAction === 'delete') {
      await Promise.all(ids.map(id => supabase.from('profiles').delete().eq('id', id)));
      setUsers(u => u.filter(p => !ids.includes(p.id)));
    }
    setSelected(new Set());
    setBulkAction('');
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviting(true);
    setInviteMsg('');
    const subject = encodeURIComponent('You are invited to PromptDeck');
    const body = encodeURIComponent(
      `Hi,\n\nYou have been invited to PromptDeck as a ${inviteRole}.\n\nSign up here: ${window.location.origin}${window.location.pathname}\n\nYour role will be set to "${inviteRole}" once you sign up.\n\nThanks`
    );
    window.open(`mailto:${inviteEmail}?subject=${subject}&body=${body}`);
    setInviteMsg(`Invite email opened for ${inviteEmail}. Once they sign up, set their role below.`);
    setInviteEmail('');
    setInviting(false);
  }

  if (loading) return <div className="admin-loading">Loading users…</div>;

  const othersCount = users.filter(u => u.id !== myProfile?.id).length;

  return (
    <div className="user-mgmt">
      <div className="invite-section">
        <h3 className="admin-section-title">Invite a user</h3>
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

      <h3 className="admin-section-title" style={{ marginTop: 20 }}>Team members</h3>

      {selected.size > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, padding: '8px 10px', background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--pm-accent)' }}>{selected.size} selected</span>
          {confirmBulkDelete ? (
            <>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#fca5a5' }}>Delete {selected.size} user{selected.size > 1 ? 's' : ''}? This cannot be undone.</span>
              <button className="user-action-btn user-action-delete" onClick={applyBulkAction}>Yes, delete</button>
              <button className="user-action-btn" onClick={() => { setConfirmBulkDelete(false); setBulkAction(''); }}>Cancel</button>
            </>
          ) : (
            <>
              <select className="role-select" value={bulkAction} onChange={e => { setBulkAction(e.target.value); setConfirmBulkDelete(false); }}>
                <option value="">— bulk action —</option>
                <option value="block">Block</option>
                <option value="unblock">Unblock</option>
                <option value="delete">Delete</option>
              </select>
              <button className="invite-btn" style={{ padding: '4px 12px', fontSize: 11 }} onClick={applyBulkAction} disabled={!bulkAction}>
                Apply
              </button>
              <button className="user-action-btn" onClick={() => setSelected(new Set())}>Clear</button>
            </>
          )}
        </div>
      )}

      <table className="user-table">
        <thead>
          <tr>
            <th style={{ width: 28 }}>
              <input
                type="checkbox"
                checked={selected.size === othersCount && othersCount > 0}
                onChange={toggleAll}
                style={{ cursor: 'pointer', accentColor: 'var(--pm-accent)' }}
              />
            </th>
            <th>Email</th>
            <th>Name</th>
            <th>Domain expertise</th>
            <th>Role</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <UserRow
              key={u.id}
              u={u}
              isSelf={u.id === myProfile?.id}
              selected={selected.has(u.id)}
              onToggleSelect={toggleSelect}
              onSave={saveUser}
              onBlock={blockUser}
              onDelete={deleteUser}
              onDisconnect={disconnectUser}
              isOnline={onlineIds.has(u.id)}
              categories={categories}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
