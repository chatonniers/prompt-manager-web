import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function AdminCategoriesCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const categories = state.catalog.categories || [];

  const [newItem, setNewItem] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [confirmIdx, setConfirmIdx] = useState(null);
  const dragSrcIdx = useRef(null);

  function usageCount(cat) {
    return state.prompts.filter(p => p.category === cat).length;
  }

  async function saveCatalog(updatedCategories) {
    const catalog = { ...state.catalog, categories: updatedCategories };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: catalog });
  }

  async function handleAdd() {
    const v = newItem.trim();
    if (!v) return;
    if (categories.includes(v)) { dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) }); return; }
    await saveCatalog([...categories, v]);
    dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, v) });
    setNewItem('');
  }

  async function handleRename(idx) {
    const v = editValue.trim();
    if (!v) { setEditingIdx(null); return; }
    const old = categories[idx];
    if (v === old) { setEditingIdx(null); return; }
    if (categories.includes(v)) { dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) }); return; }

    await saveCatalog(categories.map((c, i) => i === idx ? v : c));

    // Update all prompts that used the old category name
    const updatedPrompts = state.prompts.map(p =>
      p.category === old ? { ...p, category: v } : p
    );
    const changed = updatedPrompts.filter((p, i) => p !== state.prompts[i]);
    await Promise.all(changed.map(p => StorageAPI.upsertPrompt(p)));
    const allPrompts = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: allPrompts });

    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, v) });
    setEditingIdx(null);
  }

  async function handleDrop(toIdx) {
    const fromIdx = dragSrcIdx.current;
    if (fromIdx == null || fromIdx === toIdx) { setDragOverIdx(null); return; }
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await saveCatalog(reordered);
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }

  async function handleDelete(idx) {
    const cat = categories[idx];
    const cnt = usageCount(cat);
    setConfirmIdx(null);
    if (cnt > 0) {
      const updatedPrompts = state.prompts.map(p =>
        p.category === cat ? { ...p, category: null } : p
      );
      const changed = updatedPrompts.filter((p, i) => p !== state.prompts[i]);
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt(p)));
      const allPrompts = await StorageAPI.getAllPrompts();
      dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
    }
    await saveCatalog(categories.filter((_, i) => i !== idx));
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, cat) });
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t('categoriesAdmin', lang)}</h2>
          <p>{t('categoriesDesc', lang)}</p>
        </div>
      </div>
      <div className="admin-list" style={{ marginBottom: 8 }}>
        {categories.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}
        {categories.map((cat, idx) => {
          const cnt = usageCount(cat);
          return (
            <div
              key={idx}
              className={`admin-row${dragOverIdx === idx ? ' drag-over' : ''}`}
              draggable="true"
              onDragStart={() => { dragSrcIdx.current = idx; }}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={() => handleDrop(idx)}
            >
              <span className="admin-drag-handle">⠿</span>
              {editingIdx === idx ? (
                <>
                  <input
                    className="admin-item-input"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRename(idx); if (e.key === 'Escape') setEditingIdx(null); }}
                    autoFocus
                  />
                  <button className="admin-save-btn" onClick={() => handleRename(idx)}>Save</button>
                  <button className="admin-del-btn" onClick={() => setEditingIdx(null)}>Cancel</button>
                </>
              ) : confirmIdx === idx ? (
                <>
                  <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', color: 'var(--pm-danger)', fontWeight: 600 }}>
                    {t('deleteConfirmInline', lang, cat)}
                  </span>
                  <button className="admin-save-btn" style={{ background: 'var(--pm-danger)' }} onClick={() => handleDelete(idx)}>{t('del', lang)}</button>
                  <button className="admin-del-btn" onClick={() => setConfirmIdx(null)}>{t('cancel', lang)}</button>
                </>
              ) : (
                <>
                  <span
                    className="admin-item-input"
                    style={{ flex: 1, padding: '5px 8px', cursor: 'pointer' }}
                    onClick={() => { setEditingIdx(idx); setEditValue(cat); }}
                  >{cat}</span>
                  <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>
                    {cnt > 0 ? t('promptsCount', lang, cnt) : t('unused', lang)}
                  </span>
                  <button
                    className={`admin-del-btn${cnt > 0 ? ' has-uses' : ''}`}
                    title={cnt > 0 ? t('usedBy', lang, cnt) : t('del', lang)}
                    onClick={() => setConfirmIdx(idx)}
                  >Remove</button>
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
          placeholder={t('addCategory', lang).replace('+ ', '')}
        />
        <button className="admin-save-btn" onClick={handleAdd}>{t('add', lang)}</button>
      </div>
    </div>
  );
}
