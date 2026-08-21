import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

const EMPTY = { label: '', clientId: '', clientSecret: '', url: '' };

export default function AdminMcpCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const creds = state.catalog.mcpCredentials || [];

  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal] = useState(EMPTY);
  const [showSecret, setShowSecret] = useState({});
  const [newCred, setNewCred] = useState(EMPTY);
  const [showNewSecret, setShowNewSecret] = useState(false);

  async function saveCatalog(updatedCreds) {
    const catalog = { ...state.catalog, mcpCredentials: updatedCreds };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: catalog });
  }

  async function handleAdd() {
    if (!newCred.clientId.trim() && !newCred.label.trim()) return;
    await saveCatalog([...creds, { id: crypto.randomUUID(), ...newCred }]);
    dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, newCred.label || newCred.clientId) });
    setNewCred(EMPTY);
    setShowNewSecret(false);
  }

  async function handleSaveEdit(idx) {
    const updated = creds.map((c, i) => i === idx ? { ...c, ...editVal } : c);
    await saveCatalog(updated);
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, editVal.label || editVal.clientId) });
    setEditingIdx(null);
  }

  async function handleDelete(idx) {
    const item = creds[idx];
    await saveCatalog(creds.filter((_, i) => i !== idx));
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, item.label || item.clientId) });
  }

  const inputStyle = { flex: 1, border: '1.5px dashed var(--pm-accent)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' };

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t('mcpCatalog', lang)}</h2>
          <p>{t('mcpCatalogDesc', lang)}</p>
        </div>
      </div>
      <div className="admin-list" style={{ marginBottom: 8 }}>
        {creds.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}
        {creds.map((cred, idx) => (
          <div key={cred.id} className="admin-row">
            <span className="admin-drag-handle">⠿</span>
            {editingIdx === idx ? (
              <div className="admin-mcp-edit">
                <input className="admin-item-input" value={editVal.label} onChange={e => setEditVal(p => ({ ...p, label: e.target.value }))} placeholder="Label…" autoFocus />
                <input className="admin-item-input" value={editVal.url || ''} onChange={e => setEditVal(p => ({ ...p, url: e.target.value }))} placeholder="MCP server URL (optional)…" />
                <input className="admin-item-input" value={editVal.clientId} onChange={e => setEditVal(p => ({ ...p, clientId: e.target.value }))} placeholder={t('mcpClientId', lang)} />
                <div className="admin-mcp-secret-row">
                  <input
                    className="admin-item-input"
                    type={showSecret[idx] ? 'text' : 'password'}
                    value={editVal.clientSecret}
                    onChange={e => setEditVal(p => ({ ...p, clientSecret: e.target.value }))}
                    placeholder={t('mcpClientSecret', lang)}
                  />
                  <button className="mcp-eye-btn" type="button" onClick={() => setShowSecret(s => ({ ...s, [idx]: !s[idx] }))}>{showSecret[idx] ? 'Hide' : 'Show'}</button>
                </div>
                <input className="admin-item-input" value={editVal.url || ''} onChange={e => setEditVal(p => ({ ...p, url: e.target.value }))} placeholder="MCP server URL (optional)…" />
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="admin-save-btn" onClick={() => handleSaveEdit(idx)}>Save</button>
                  <button className="admin-del-btn" onClick={() => setEditingIdx(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="admin-mcp-display" onClick={() => { setEditingIdx(idx); setEditVal({ label: cred.label || '', clientId: cred.clientId || '', clientSecret: cred.clientSecret || '', url: cred.url || '' }); }}>
                  <span className="admin-mcp-label">{cred.label || cred.clientId || '(unnamed)'}</span>
                  <span className="admin-mcp-id">{cred.clientId}{cred.url ? ` · ${cred.url}` : ''}</span>
                </div>
                <button className="admin-del-btn" onClick={() => handleDelete(idx)}>Remove</button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      <div className="admin-mcp-add">
        <input className="admin-item-input" style={inputStyle} type="text" value={newCred.label} onChange={e => setNewCred(p => ({ ...p, label: e.target.value }))} placeholder="Label…" />
        <input className="admin-item-input" style={inputStyle} type="text" value={newCred.url} onChange={e => setNewCred(p => ({ ...p, url: e.target.value }))} placeholder="MCP server URL…" />
        <input className="admin-item-input" style={inputStyle} type="text" value={newCred.clientId} onChange={e => setNewCred(p => ({ ...p, clientId: e.target.value }))} placeholder={t('mcpClientId', lang) + '…'} />
        <div style={{ flex: 2, display: 'flex', gap: 4 }}>
          <input className="admin-item-input" style={{ ...inputStyle, flex: 1 }} type={showNewSecret ? 'text' : 'password'} value={newCred.clientSecret} onChange={e => setNewCred(p => ({ ...p, clientSecret: e.target.value }))} placeholder={t('mcpClientSecret', lang) + '…'} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="mcp-eye-btn" type="button" onClick={() => setShowNewSecret(v => !v)}>{showNewSecret ? 'Hide' : 'Show'}</button>
        </div>
        <button className="admin-save-btn" onClick={handleAdd}>{t('add', lang)}</button>
      </div>
    </div>
  );
}
