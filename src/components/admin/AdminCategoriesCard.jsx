import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t, tl } from '../../lib/i18n.js';

export default function AdminCategoriesCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const categories = state.catalog.categories || [];

  const [newEn, setNewEn] = useState('');
  const [newFr, setNewFr] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editEn, setEditEn] = useState('');
  const [editFr, setEditFr] = useState('');
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [confirmIdx, setConfirmIdx] = useState(null);
  const dragSrcIdx = useRef(null);

  function getEn(cat) { return typeof cat === 'object' ? cat.en || '' : cat; }

  function usageCount(cat) {
    return state.prompts.filter(p => p.category === getEn(cat)).length;
  }

  async function saveCatalog(updatedCategories) {
    const catalog = { ...state.catalog, categories: updatedCategories };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: catalog });
  }

  async function handleAdd() {
    const en = newEn.trim();
    const fr = newFr.trim();
    if (!en) return;
    if (categories.some(c => getEn(c) === en)) { dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) }); return; }
    const newObj = fr ? { en, fr } : en;
    await saveCatalog([...categories, newObj]);
    dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, en) });
    setNewEn(''); setNewFr('');
  }

  async function handleRename(idx) {
    const en = editEn.trim();
    const fr = editFr.trim();
    if (!en) { setEditingIdx(null); return; }
    const oldEn = getEn(categories[idx]);
    const newObj = fr ? { en, fr } : en;
    if (en === oldEn && fr === (typeof categories[idx] === 'object' ? categories[idx].fr || '' : '')) {
      setEditingIdx(null); return;
    }
    if (en !== oldEn && categories.some(c => getEn(c) === en)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) }); return;
    }
    await saveCatalog(categories.map((c, i) => i === idx ? newObj : c));

    if (en !== oldEn) {
      const updatedPrompts = state.prompts.map(p => p.category === oldEn ? { ...p, category: en } : p);
      const changed = updatedPrompts.filter((p, i) => p !== state.prompts[i]);
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt(p)));
      dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    }
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, en) });
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
    const enKey = getEn(cat);
    setConfirmIdx(null);
    const updatedPrompts = state.prompts.map(p => p.category === enKey ? { ...p, category: null } : p);
    const changed = updatedPrompts.filter((p, i) => p !== state.prompts[i]);
    if (changed.length > 0) {
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt(p)));
      dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    }
    await saveCatalog(categories.filter((_, i) => i !== idx));
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, enKey) });
  }

  function startEdit(idx) {
    const cat = categories[idx];
    setEditingIdx(idx);
    setEditEn(typeof cat === 'object' ? cat.en || '' : cat);
    setEditFr(typeof cat === 'object' ? cat.fr || '' : '');
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
          const enVal = getEn(cat);
          const frVal = typeof cat === 'object' ? cat.fr || '' : '';
          return (
            <div key={idx} className={`admin-row${dragOverIdx === idx ? ' drag-over' : ''}`}
              draggable="true"
              onDragStart={() => { dragSrcIdx.current = idx; }}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={() => handleDrop(idx)}
            >
              <span className="admin-drag-handle">⠿</span>
              {editingIdx === idx ? (
                <>
                  <div className="admin-bilingual-edit">
                    <input className="admin-item-input" value={editEn}
                      onChange={e => setEditEn(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(idx); if (e.key === 'Escape') setEditingIdx(null); }}
                      placeholder="EN" autoFocus />
                    <input className="admin-item-input admin-item-input-fr" value={editFr}
                      onChange={e => setEditFr(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRename(idx); if (e.key === 'Escape') setEditingIdx(null); }}
                      placeholder="FR (optionnel)" />
                  </div>
                  <button className="admin-save-btn" onClick={() => handleRename(idx)}>Save</button>
                  <button className="admin-del-btn" onClick={() => setEditingIdx(null)}>Cancel</button>
                </>
              ) : confirmIdx === idx ? (
                <>
                  <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', color: 'var(--pm-danger)', fontWeight: 600 }}>
                    {t('deleteConfirmInline', lang, tl(cat, lang))}
                  </span>
                  <button className="admin-save-btn" style={{ background: 'var(--pm-danger)' }} onClick={() => handleDelete(idx)}>{t('del', lang)}</button>
                  <button className="admin-del-btn" onClick={() => setConfirmIdx(null)}>{t('cancel', lang)}</button>
                </>
              ) : (
                <>
                  <div className="admin-bilingual-display" onClick={() => startEdit(idx)}>
                    <span className="admin-bilingual-en">{enVal}</span>
                    {frVal && <span className="admin-bilingual-fr">{frVal}</span>}
                  </div>
                  <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>
                    {cnt > 0 ? t('promptsCount', lang, cnt) : t('unused', lang)}
                  </span>
                  <button className={`admin-del-btn${cnt > 0 ? ' has-uses' : ''}`}
                    title={cnt > 0 ? t('usedBy', lang, cnt) : t('del', lang)}
                    onClick={() => setConfirmIdx(idx)}>Remove</button>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="admin-bilingual-add">
        <input className="admin-item-input"
          style={{ flex: 2, border: '1.5px dashed var(--pm-accent)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' }}
          type="text" value={newEn} onChange={e => setNewEn(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="EN — required" />
        <input className="admin-item-input"
          style={{ flex: 2, border: '1.5px dashed rgba(99,102,241,0.35)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' }}
          type="text" value={newFr} onChange={e => setNewFr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="FR — optionnel" />
        <button className="admin-save-btn" onClick={handleAdd}>{t('add', lang)}</button>
      </div>
    </div>
  );
}
