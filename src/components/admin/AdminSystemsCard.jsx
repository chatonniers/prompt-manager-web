import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

const EMPTY_ENDPOINT = () => ({ id: crypto.randomUUID(), label: '', url: '', clientId: '', clientSecret: '' });
const EMPTY_SYSTEM   = () => ({ id: crypto.randomUUID(), name: '', description: '', url: '', endpoints: [] });

function SystemCard({ sys, onEdit, onDelete, usageCount }) {
  const [flipped, setFlipped] = useState(false);
  const [showSecrets, setShowSecrets] = useState({});

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }

  return (
    <div className={`admin-sys-card${flipped ? ' flipped' : ''}`}>
      {/* Front */}
      <div className="admin-sys-face admin-sys-front">
        <div className="admin-sys-front-header">
          <div className="admin-sys-front-name">{sys.name || '(unnamed)'}</div>
          {sys.description && <div className="admin-sys-front-desc">{sys.description}</div>}
          {sys.url && (
            <a className="admin-sys-front-url" href={sys.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
              🔗 {sys.url}
            </a>
          )}
        </div>
        <div className="admin-sys-front-meta">
          {sys.endpoints.length > 0 && (
            <span className="admin-sys-endpoint-count">{sys.endpoints.length} endpoint{sys.endpoints.length !== 1 ? 's' : ''}</span>
          )}
          {usageCount > 0 && <span className="admin-in-use has-uses">{usageCount} prompt{usageCount !== 1 ? 's' : ''}</span>}
        </div>
        <div className="admin-sys-front-actions">
          {sys.endpoints.length > 0 && (
            <button className="admin-sys-flip-btn" onClick={() => setFlipped(true)}>Connection Details ▶</button>
          )}
          <button className="admin-save-btn" onClick={() => onEdit(sys)}>Edit</button>
          <button className="admin-del-btn" onClick={() => onDelete(sys)}>✕</button>
        </div>
      </div>

      {/* Back — connection details */}
      <div className="admin-sys-face admin-sys-back">
        <div className="admin-sys-back-header">
          <span className="admin-sys-back-title">Connection Details</span>
          <span className="admin-sys-back-subtitle">{sys.name}</span>
        </div>
        <div className="admin-sys-endpoints">
          {sys.endpoints.map(ep => (
            <div key={ep.id} className="admin-sys-endpoint-row">
              {ep.label && <div className="admin-sys-ep-label">{ep.label.toUpperCase()}</div>}
              {ep.url && (
                <div className="admin-sys-ep-field">
                  <span className="admin-sys-ep-field-label">ENDPOINT</span>
                  <div className="admin-sys-ep-field-value">
                    <code>{ep.url}</code>
                    <button className="admin-sys-copy-btn" onClick={() => copyText(ep.url)}>COPY</button>
                  </div>
                </div>
              )}
              {ep.clientId && (
                <div className="admin-sys-ep-field">
                  <span className="admin-sys-ep-field-label">CLIENT ID</span>
                  <div className="admin-sys-ep-field-value">
                    <code>{ep.clientId}</code>
                    <button className="admin-sys-copy-btn" onClick={() => copyText(ep.clientId)}>COPY</button>
                  </div>
                </div>
              )}
              {ep.clientSecret && (
                <div className="admin-sys-ep-field">
                  <span className="admin-sys-ep-field-label">CLIENT SECRET</span>
                  <div className="admin-sys-ep-field-value">
                    <code>{showSecrets[ep.id] ? ep.clientSecret : '••••••••'}</code>
                    <button className="admin-sys-copy-btn" onClick={() => setShowSecrets(s => ({ ...s, [ep.id]: !s[ep.id] }))}>
                      {showSecrets[ep.id] ? 'HIDE' : 'SHOW'}
                    </button>
                    <button className="admin-sys-copy-btn" onClick={() => copyText(ep.clientSecret)}>COPY</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="admin-sys-flip-back-btn" onClick={() => setFlipped(false)}>◀ Back</button>
      </div>
    </div>
  );
}

function SystemEditForm({ initial, onSave, onCancel }) {
  const [sys, setSys] = useState(initial ?? EMPTY_SYSTEM());
  const [showSecrets, setShowSecrets] = useState({});

  function updateEp(id, field, val) {
    setSys(s => ({ ...s, endpoints: s.endpoints.map(ep => ep.id === id ? { ...ep, [field]: val } : ep) }));
  }
  function addEndpoint() {
    setSys(s => ({ ...s, endpoints: [...s.endpoints, EMPTY_ENDPOINT()] }));
  }
  function removeEndpoint(id) {
    setSys(s => ({ ...s, endpoints: s.endpoints.filter(ep => ep.id !== id) }));
  }

  return (
    <div className="admin-sys-edit-form">
      <div className="admin-sys-edit-fields">
        <input className="admin-item-input admin-sys-edit-input" value={sys.name} onChange={e => setSys(s => ({ ...s, name: e.target.value }))} placeholder="System name…" autoFocus />
        <input className="admin-item-input admin-sys-edit-input" value={sys.description} onChange={e => setSys(s => ({ ...s, description: e.target.value }))} placeholder="Description (optional)…" />
        <input className="admin-item-input admin-sys-edit-input" value={sys.url} onChange={e => setSys(s => ({ ...s, url: e.target.value }))} placeholder="System URL (optional)…" />
      </div>

      {sys.endpoints.length > 0 && (
        <div className="admin-sys-edit-endpoints">
          {sys.endpoints.map((ep, i) => (
            <div key={ep.id} className="admin-sys-edit-ep">
              <div className="admin-sys-edit-ep-header">
                <span className="admin-sys-edit-ep-num">Endpoint #{i + 1}</span>
                <button className="admin-del-btn" onClick={() => removeEndpoint(ep.id)}>✕</button>
              </div>
              <input className="admin-item-input" value={ep.label} onChange={e => updateEp(ep.id, 'label', e.target.value)} placeholder="Label (e.g. S/4HANA, SuccessFactors)…" />
              <input className="admin-item-input" value={ep.url} onChange={e => updateEp(ep.id, 'url', e.target.value)} placeholder="Endpoint URL…" />
              <input className="admin-item-input" value={ep.clientId} onChange={e => updateEp(ep.id, 'clientId', e.target.value)} placeholder="Client ID…" />
              <div className="admin-mcp-secret-row">
                <input
                  className="admin-item-input"
                  type={showSecrets[ep.id] ? 'text' : 'password'}
                  value={ep.clientSecret}
                  onChange={e => updateEp(ep.id, 'clientSecret', e.target.value)}
                  placeholder="Client Secret…"
                />
                <button className="mcp-eye-btn" type="button" onClick={() => setShowSecrets(s => ({ ...s, [ep.id]: !s[ep.id] }))}>
                  {showSecrets[ep.id] ? '🙈' : '👁'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="add-row-btn" style={{ marginTop: 6 }} onClick={addEndpoint}>+ Add Endpoint</button>

      <div className="admin-sys-edit-actions">
        <button className="admin-save-btn" onClick={() => onSave(sys)}>Save</button>
        <button className="admin-del-btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function AdminSystemsCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const systems = state.catalog.systems || [];

  const [editingSys, setEditingSys] = useState(null); // null | 'new' | system object
  const [showForm, setShowForm] = useState(false);

  function usageCount(sysId) {
    return state.prompts.filter(p => (p.systems || []).some(s => s.id === sysId)).length;
  }

  async function saveCatalog(updatedSystems) {
    const catalog = { ...state.catalog, systems: updatedSystems };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: catalog });
  }

  async function handleSave(sys) {
    const v = sys.name.trim() ? sys : { ...sys, name: sys.url || '(unnamed)' };
    const exists = systems.find(s => s.id === v.id);
    if (exists) {
      await saveCatalog(systems.map(s => s.id === v.id ? v : s));
    } else {
      await saveCatalog([...systems, v]);
    }
    dispatch({ type: 'SHOW_TOAST', payload: exists ? `"${v.name}" updated` : `"${v.name}" added` });
    setShowForm(false);
    setEditingSys(null);
  }

  async function handleDelete(sys) {
    const cnt = usageCount(sys.id);
    if (cnt > 0 && !window.confirm(`"${sys.name}" is used by ${cnt} prompt${cnt !== 1 ? 's' : ''}. Remove it?`)) return;
    if (cnt > 0) {
      const updated = state.prompts.map(p =>
        (p.systems || []).some(s => s.id === sys.id)
          ? { ...p, systems: (p.systems || []).filter(s => s.id !== sys.id) }
          : p
      );
      const changed = updated.filter((p, i) => p !== state.prompts[i]);
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt(p)));
      const allPrompts = await StorageAPI.getAllPrompts();
      dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
    }
    await saveCatalog(systems.filter(s => s.id !== sys.id));
    dispatch({ type: 'SHOW_TOAST', payload: `"${sys.name}" deleted` });
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t('systemsAdmin', lang)}</h2>
          <p>{t('systemsDesc', lang)}</p>
        </div>
      </div>

      {systems.length === 0 && !showForm && (
        <div className="admin-empty">{t('noItems', lang)}</div>
      )}

      <div className="admin-sys-grid">
        {systems.map(sys => (
          showForm && editingSys?.id === sys.id ? (
            <SystemEditForm
              key={sys.id}
              initial={editingSys}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingSys(null); }}
            />
          ) : (
            <SystemCard
              key={sys.id}
              sys={sys}
              usageCount={usageCount(sys.id)}
              onEdit={s => { setEditingSys(s); setShowForm(true); }}
              onDelete={handleDelete}
            />
          )
        ))}

        {showForm && !editingSys?.id && (
          <SystemEditForm
            initial={null}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingSys(null); }}
          />
        )}
      </div>

      {!showForm && (
        <button
          className="add-row-btn"
          style={{ marginTop: 8 }}
          onClick={() => { setEditingSys(null); setShowForm(true); }}
        >
          {t('addSystem', lang)}
        </button>
      )}
    </div>
  );
}
