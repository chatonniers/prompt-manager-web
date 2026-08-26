import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';

const DEFAULT_MSG = 'Beta Release — development in progress, expect disruptions.';

export default function AdminBetaBannerCard() {
  const { state, dispatch } = useApp();
  const current = state.catalog.betaBanner || {};
  const [enabled, setEnabled] = useState(current.enabled ?? false);
  const [message, setMessage] = useState(current.message ?? DEFAULT_MSG);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const betaBanner = { enabled, message: message.trim() || DEFAULT_MSG };
    const latest = await StorageAPI.getCatalog();
    const catalog = { ...latest, betaBanner };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: { ...state.catalog, betaBanner } });
    setSaving(false);
    dispatch({ type: 'SHOW_TOAST', payload: 'Beta banner saved.' });
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>Beta Banner</h2>
          <p>Show a warning banner above the suite tabs for all users.</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--pm-accent)', cursor: 'pointer' }} />
          Enable beta banner
        </label>
        {enabled && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
            background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
            ACTIVE
          </span>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text3)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 6 }}>
          Banner message
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={2}
          placeholder={DEFAULT_MSG}
          style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1.5px solid var(--pm-border2)',
            padding: '8px 12px', fontFamily: 'inherit', fontSize: 13, background: 'var(--pm-surface)',
            color: 'var(--pm-text)', outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Preview */}
      {enabled && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Preview</div>
          <BetaBannerPreview message={message || DEFAULT_MSG} />
        </div>
      )}

      <button className="admin-save-btn" onClick={handleSave} disabled={saving} style={{ minWidth: 100 }}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

function BetaBannerPreview({ message }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: 'rgba(245,158,11,0.1)',
      border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: 8, padding: '8px 14px', fontSize: 13,
      color: '#F59E0B',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
      <span>{message}</span>
    </div>
  );
}
