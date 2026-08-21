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

  const tagMap = {};
  for (const p of state.prompts) {
    for (const tag of (p.tags || [])) {
      tagMap[tag] = (tagMap[tag] || 0) + 1;
    }
  }
  const allTags = Object.keys(tagMap).sort();

  async function handleRename(oldTag) {
    const newTag = editValue.trim().replace(/^#/, '');
    if (!newTag || newTag === oldTag) { setEditingTag(null); return; }
    if (tagMap[newTag] !== undefined) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    const updated = state.prompts.map(p =>
      (p.tags || []).includes(oldTag)
        ? { ...p, tags: p.tags.map(t => t === oldTag ? newTag : t) }
        : p
    );
    await Promise.all(updated.filter((p, i) => p !== state.prompts[i]).map(p => StorageAPI.upsertPrompt(p)));
    dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, newTag) });
    setEditingTag(null);
  }

  async function handleDelete(tag) {
    setConfirmTag(null);
    const updated = state.prompts.map(p =>
      (p.tags || []).includes(tag)
        ? { ...p, tags: p.tags.filter(t => t !== tag) }
        : p
    );
    await Promise.all(updated.filter((p, i) => p !== state.prompts[i]).map(p => StorageAPI.upsertPrompt(p)));
    dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, tag) });
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>Tags</h2>
          <p>Manage all tags across your prompt library. Rename or remove tags — changes apply to all cards using them.</p>
        </div>
      </div>
      <div className="admin-list" style={{ marginBottom: 8 }}>
        {allTags.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}
        {allTags.map(tag => {
          const cnt = tagMap[tag];
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
                  <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>{t('promptsCount', lang, cnt)}</span>
                  <button className="admin-del-btn" onClick={() => setConfirmTag(tag)}>Remove</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
