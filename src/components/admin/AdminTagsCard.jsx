import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function AdminTagsCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';

  const [editingTag, setEditingTag] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [confirmTag, setConfirmTag] = useState(null);
  const [newTag, setNewTag] = useState('');

  // Merge catalog tags with tags actually used on prompts
  const usageMap = {};
  for (const p of state.prompts) {
    for (const tag of (p.tags || [])) {
      usageMap[tag] = (usageMap[tag] || 0) + 1;
    }
  }
  const catalogTags = state.catalog.tags || [];
  const allTags = [...new Set([...catalogTags, ...Object.keys(usageMap)])].sort();

  async function saveCatalogTags(updatedTags) {
    const catalog = { ...state.catalog, tags: updatedTags };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: catalog });
  }

  async function handleAdd() {
    const val = newTag.trim().replace(/^#/, '');
    if (!val) return;
    if (allTags.includes(val)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    await saveCatalogTags([...catalogTags, val].sort());
    dispatch({ type: 'SHOW_TOAST', payload: `#${val} added` });
    setNewTag('');
  }

  async function handleRename(oldTag) {
    const newVal = editValue.trim().replace(/^#/, '');
    if (!newVal || newVal === oldTag) { setEditingTag(null); return; }
    if (allTags.includes(newVal)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    // Update catalog
    await saveCatalogTags(catalogTags.map(t => t === oldTag ? newVal : t).sort());
    // Update all prompts that use this tag
    const toUpdate = state.prompts.filter(p => (p.tags || []).includes(oldTag));
    await Promise.all(toUpdate.map(p => StorageAPI.upsertPrompt({ ...p, tags: p.tags.map(t => t === oldTag ? newVal : t) })));
    if (toUpdate.length > 0) dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, newVal) });
    setEditingTag(null);
  }

  async function handleDelete(tag) {
    setConfirmTag(null);
    await saveCatalogTags(catalogTags.filter(t => t !== tag));
    const toUpdate = state.prompts.filter(p => (p.tags || []).includes(tag));
    if (toUpdate.length > 0) {
      await Promise.all(toUpdate.map(p => StorageAPI.upsertPrompt({ ...p, tags: p.tags.filter(t => t !== tag) })));
      dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    }
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, tag) });
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>Tags</h2>
          <p>Define tags for your library. Tags added here appear in autocomplete when editing cards. Renaming or removing a tag updates all cards using it.</p>
        </div>
      </div>
      <div className="admin-list" style={{ marginBottom: 8 }}>
        {allTags.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}
        {allTags.map(tag => {
          const cnt = usageMap[tag] || 0;
          return (
            <div key={tag} className="admin-row">
              <span style={{ fontSize: 13, color: 'var(--pm-accent)', marginRight: 4 }}>#</span>
              {editingTag === tag ? (
                <>
                  <input
                    className="admin-item-input"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(tag); if (e.key === 'Escape') setEditingTag(null); }}
                    autoFocus
                  />
                  <button className="admin-save-btn" onClick={() => handleRename(tag)}>Save</button>
                  <button className="admin-del-btn" onClick={() => setEditingTag(null)}>Cancel</button>
                </>
              ) : confirmTag === tag ? (
                <>
                  <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', color: 'var(--pm-danger)', fontWeight: 600 }}>
                    Remove #{tag} from {cnt} prompt{cnt !== 1 ? 's' : ''}?
                  </span>
                  <button className="admin-save-btn" style={{ background: 'var(--pm-danger)' }} onClick={() => handleDelete(tag)}>{t('del', lang)}</button>
                  <button className="admin-del-btn" onClick={() => setConfirmTag(null)}>{t('cancel', lang)}</button>
                </>
              ) : (
                <>
                  <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', cursor: 'pointer' }} onClick={() => { setEditingTag(tag); setEditValue(tag); }}>{tag}</span>
                  <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>{cnt > 0 ? t('promptsCount', lang, cnt) : t('unused', lang)}</span>
                  <button className="admin-del-btn" onClick={() => setConfirmTag(tag)}>Remove</button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <input
          className="admin-item-input"
          style={{ flex: 1, border: '1.5px dashed var(--pm-accent)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' }}
          type="text"
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New tag…"
        />
        <button className="admin-save-btn" onClick={handleAdd}>{t('add', lang)}</button>
      </div>
    </div>
  );
}
