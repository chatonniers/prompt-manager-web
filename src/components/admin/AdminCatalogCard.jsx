import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function AdminCatalogCard({ titleKey, descKey, addKey, items, promptField, isArray }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const [newItem, setNewItem] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');

  function getUsageCount(item) {
    if (isArray) return state.prompts.filter(p => Array.isArray(p[promptField]) && p[promptField].includes(item)).length;
    return state.prompts.filter(p => p[promptField] === item).length;
  }

  function getListKey() {
    if (promptField === 'solutions') return 'solutions';
    if (promptField === 'storyFlow') return 'storyFlows';
    return 'landscapes';
  }

  async function saveNewCatalog(updatedList) {
    const key = getListKey();
    const catalog = { ...state.catalog, [key]: updatedList };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: catalog });
    return catalog;
  }

  async function handleAdd() {
    const v = newItem.trim();
    if (!v) return;
    if (items.includes(v)) { dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) }); return; }
    await saveNewCatalog([...items, v]);
    dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, v) });
    setNewItem('');
  }

  async function handleRename(idx) {
    const v = editValue.trim();
    if (!v) { setEditingIdx(null); return; }
    const old = items[idx];
    if (v === old) { setEditingIdx(null); return; }
    if (items.includes(v)) { dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) }); return; }

    const newList = items.map((x, i) => i === idx ? v : x);
    await saveNewCatalog(newList);

    // Cascade rename in prompts
    const updated = state.prompts.map(p => {
      if (isArray) {
        if (Array.isArray(p[promptField]) && p[promptField].includes(old)) {
          return { ...p, [promptField]: p[promptField].map(x => x === old ? v : x) };
        }
      } else {
        if (p[promptField] === old) return { ...p, [promptField]: v };
      }
      return p;
    });
    await Promise.all(updated.filter((p, i) => p !== state.prompts[i]).map(p => StorageAPI.upsertPrompt(p)));
    const allPrompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, v) });
    setEditingIdx(null);
  }

  async function handleDelete(idx) {
    const item = items[idx];
    const cnt = getUsageCount(item);
    if (cnt > 0) {
      if (!window.confirm(t('deleteConfirm', lang, item, cnt))) return;
      const updated = state.prompts.map(p => {
        if (isArray && Array.isArray(p[promptField]) && p[promptField].includes(item)) {
          return { ...p, [promptField]: p[promptField].filter(x => x !== item) };
        }
        if (!isArray && p[promptField] === item) return { ...p, [promptField]: '' };
        return p;
      });
      await Promise.all(updated.filter((p, i) => p !== state.prompts[i]).map(p => StorageAPI.upsertPrompt(p)));
      const allPrompts = await StorageAPI.getAllPrompts();
      dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
    }
    await saveNewCatalog(items.filter((_, i) => i !== idx));
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, item) });
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t(titleKey, lang)}</h2>
          <p>{t(descKey, lang)}</p>
        </div>
      </div>
      <div className="admin-list" style={{ marginBottom: 8 }}>
        {items.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}
        {items.map((item, idx) => {
          const cnt = getUsageCount(item);
          return (
            <div key={item} className="admin-row" draggable="true">
              <span className="admin-drag-handle" title="Drag to reorder">⠿</span>
              {editingIdx === idx ? (
                <>
                  <input
                    className="admin-item-input"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(idx); if (e.key === 'Escape') setEditingIdx(null); }}
                    autoFocus
                  />
                  <button className="admin-save-btn" onClick={() => handleRename(idx)}>✓</button>
                  <button className="admin-del-btn" onClick={() => setEditingIdx(null)}>✕</button>
                </>
              ) : (
                <>
                  <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', cursor: 'pointer' }} onClick={() => { setEditingIdx(idx); setEditValue(item); }}>{item}</span>
                  <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>{cnt > 0 ? t('promptsCount', lang, cnt) : t('unused', lang)}</span>
                  <button className="admin-save-btn" style={{ visibility: 'hidden', display: 'none' }}>✓</button>
                  <button className={`admin-del-btn${cnt > 0 ? ' has-uses' : ''}`} title={cnt > 0 ? t('usedBy', lang, cnt) : t('del', lang)} onClick={() => handleDelete(idx)}>✕</button>
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
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={t(addKey, lang).replace('+ ', '')}
        />
        <button className="admin-save-btn" onClick={handleAdd}>{t('add', lang)}</button>
      </div>
    </div>
  );
}
