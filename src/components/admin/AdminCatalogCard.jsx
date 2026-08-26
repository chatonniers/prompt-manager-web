import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t, tl } from '../../lib/i18n.js';

export default function AdminCatalogCard({ titleKey, descKey, addKey, items, promptField, isArray }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const isLandscape = promptField === 'landscapes';
  const canSort = !isLandscape;
  const [newEn, setNewEn] = useState('');
  const [newFr, setNewFr] = useState('');
  const [newLandscapeName, setNewLandscapeName] = useState('');
  const [newLandscapeUrl, setNewLandscapeUrl] = useState('');
  const [editingIdx, setEditingIdx] = useState(null);
  const [editEn, setEditEn] = useState('');
  const [editFr, setEditFr] = useState('');
  const [editLandscape, setEditLandscape] = useState({ name: '', url: '' });
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [confirmIdx, setConfirmIdx] = useState(null);
  const dragSrcIdx = useRef(null);

  // Canonical EN key used for matching against prompt fields
  function getItemEn(item) {
    if (isLandscape && typeof item === 'object') return item.name || item.url || '';
    if (typeof item === 'object') return item.en || '';
    return item;
  }

  function getUsageCount(item) {
    const key = getItemEn(item);
    if (isArray) return state.prompts.filter(p => {
      const field = p[promptField];
      if (!Array.isArray(field)) return false;
      return field.some(v => {
        if (isLandscape && typeof v === 'object') return v.name === key || v.url === key;
        return v === key;
      });
    }).length;
    return state.prompts.filter(p => p[promptField] === key).length;
  }

  function getListKey() {
    if (promptField === 'solutions') return 'solutions';
    if (promptField === 'storyFlow') return 'storyFlows';
    if (promptField === 'personas') return 'personas';
    if (promptField === 'industry') return 'industries';
    return 'landscapes';
  }

  async function saveNewCatalog(updatedList) {
    const key = getListKey();
    const latest = await StorageAPI.getCatalog();
    const catalog = { ...latest, [key]: updatedList };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: catalog });
    return catalog;
  }

  async function handleDrop(toIdx) {
    const fromIdx = dragSrcIdx.current;
    if (fromIdx == null || fromIdx === toIdx) { setDragOverIdx(null); return; }
    const reordered = [...items];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await saveNewCatalog(reordered);
    dragSrcIdx.current = null;
    setDragOverIdx(null);
  }

  async function handleSort() {
    const sorted = [...items].sort((a, b) => getItemEn(a).localeCompare(getItemEn(b), undefined, { sensitivity: 'base' }));
    await saveNewCatalog(sorted);
  }

  async function handleAdd() {
    if (isLandscape) {
      const name = newLandscapeName.trim();
      const url = newLandscapeUrl.trim();
      if (!name && !url) return;
      if (items.some(ls => ls.name === name && ls.url === url)) {
        dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
        return;
      }
      await saveNewCatalog([...items, { name, url }]);
      dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, name || url) });
      setNewLandscapeName(''); setNewLandscapeUrl('');
    } else {
      const en = newEn.trim();
      const fr = newFr.trim();
      if (!en) return;
      if (items.some(x => getItemEn(x) === en)) { dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) }); return; }
      const newObj = fr ? { en, fr } : en;
      const sorted = [...items, newObj].sort((a, b) => getItemEn(a).localeCompare(getItemEn(b), undefined, { sensitivity: 'base' }));
      await saveNewCatalog(sorted);
      dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, en) });
      setNewEn(''); setNewFr('');
    }
  }

  async function handleRename(idx) {
    if (isLandscape) {
      const { name, url } = editLandscape;
      if (!name.trim() && !url.trim()) { setEditingIdx(null); return; }
      const newList = items.map((x, i) => i === idx ? { name: name.trim(), url: url.trim() } : x);
      await saveNewCatalog(newList);
      dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, name || url) });
      setEditingIdx(null);
    } else {
      const en = editEn.trim();
      const fr = editFr.trim();
      if (!en) { setEditingIdx(null); return; }
      const oldEn = getItemEn(items[idx]);
      const newObj = fr ? { en, fr } : en;

      const newList = items.map((x, i) => i === idx ? newObj : x);
      await saveNewCatalog(newList);

      // If EN key changed, update all prompts using the old key
      if (en !== oldEn) {
        const updated = state.prompts.map(p => {
          if (isArray) {
            if (Array.isArray(p[promptField]) && p[promptField].includes(oldEn))
              return { ...p, [promptField]: p[promptField].map(x => x === oldEn ? en : x) };
          } else {
            if (p[promptField] === oldEn) return { ...p, [promptField]: en };
          }
          return p;
        });
        await Promise.all(updated.filter((p, i) => p !== state.prompts[i]).map(p => StorageAPI.upsertPrompt(p)));
        dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
      }
      dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, en) });
      setEditingIdx(null);
    }
  }

  async function handleDelete(idx) {
    const item = items[idx];
    const key = getItemEn(item);
    setConfirmIdx(null);
    const updated = state.prompts.map(p => {
      if (isArray && Array.isArray(p[promptField])) {
        const filtered = p[promptField].filter(v => {
          if (isLandscape && typeof v === 'object') return !(v.name === item.name && v.url === item.url);
          return v !== key;
        });
        if (filtered.length !== p[promptField].length) return { ...p, [promptField]: filtered };
      }
      if (!isArray && p[promptField] === key) return { ...p, [promptField]: '' };
      return p;
    });
    const changed = updated.filter((p, i) => p !== state.prompts[i]);
    if (changed.length > 0) {
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt(p)));
      dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    }
    await saveNewCatalog(items.filter((_, i) => i !== idx));
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, key) });
  }

  function startEdit(idx) {
    const item = items[idx];
    setEditingIdx(idx);
    if (isLandscape) {
      setEditLandscape({ name: item.name || '', url: item.url || '' });
    } else {
      setEditEn(typeof item === 'object' ? item.en || '' : item);
      setEditFr(typeof item === 'object' ? item.fr || '' : '');
    }
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t(titleKey, lang)}</h2>
          <p>{t(descKey, lang)}</p>
        </div>
        {canSort && items.length > 1 && (
          <button className="admin-sort-btn" onClick={handleSort} title="Sort A–Z">A–Z</button>
        )}
      </div>
      <div className="admin-list" style={{ marginBottom: 8 }}>
        {items.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}
        {items.map((item, idx) => {
          const cnt = getUsageCount(item);
          const enVal = getItemEn(item);
          const frVal = typeof item === 'object' && !isLandscape ? item.fr || '' : '';
          return (
            <div key={idx} className={`admin-row${dragOverIdx === idx ? ' drag-over' : ''}`} draggable="true"
              onDragStart={() => { dragSrcIdx.current = idx; }}
              onDragOver={e => { e.preventDefault(); setDragOverIdx(idx); }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={() => handleDrop(idx)}
            >
              <span className="admin-drag-handle" title={t('dragToReorder', lang)}>⠿</span>
              {editingIdx === idx ? (
                isLandscape ? (
                  <>
                    <div className="admin-landscape-edit">
                      <input className="admin-item-input" value={editLandscape.name}
                        onChange={e => setEditLandscape(prev => ({ ...prev, name: e.target.value }))}
                        placeholder={t('landscapeName', lang)} autoFocus />
                      <input className="admin-item-input" value={editLandscape.url}
                        onChange={e => setEditLandscape(prev => ({ ...prev, url: e.target.value }))}
                        placeholder={t('landscapeUrl', lang)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(idx); if (e.key === 'Escape') setEditingIdx(null); }} />
                    </div>
                    <button className="admin-save-btn" onClick={() => handleRename(idx)}>Save</button>
                    <button className="admin-del-btn" onClick={() => setEditingIdx(null)}>Cancel</button>
                  </>
                ) : (
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
                )
              ) : confirmIdx === idx ? (
                <>
                  <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', color: 'var(--pm-danger)', fontWeight: 600 }}>
                    {t('deleteConfirmInline', lang, tl(item, lang))}
                  </span>
                  <button className="admin-save-btn" style={{ background: 'var(--pm-danger)' }} onClick={() => handleDelete(idx)}>{t('del', lang)}</button>
                  <button className="admin-del-btn" onClick={() => setConfirmIdx(null)}>{t('cancel', lang)}</button>
                </>
              ) : (
                <>
                  {isLandscape ? (
                    <div className="admin-landscape-display" onClick={() => startEdit(idx)}>
                      <span className="admin-landscape-name">{item.name || '—'}</span>
                      {item.url && (
                        <a className="admin-landscape-url" href={item.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{item.url}</a>
                      )}
                    </div>
                  ) : (
                    <div className="admin-bilingual-display" onClick={() => startEdit(idx)}>
                      <span className="admin-bilingual-en">{enVal}</span>
                      {frVal && <span className="admin-bilingual-fr">{frVal}</span>}
                    </div>
                  )}
                  <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>{cnt > 0 ? t('promptsCount', lang, cnt) : t('unused', lang)}</span>
                  <button className={`admin-del-btn${cnt > 0 ? ' has-uses' : ''}`} title={cnt > 0 ? t('usedBy', lang, cnt) : t('del', lang)} onClick={() => setConfirmIdx(idx)}>Remove</button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {isLandscape ? (
        <div className="admin-landscape-add">
          <input className="admin-item-input"
            style={{ flex: 1, border: '1.5px dashed var(--pm-accent)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' }}
            type="text" value={newLandscapeName} onChange={e => setNewLandscapeName(e.target.value)}
            placeholder={t('landscapeName', lang)} />
          <input className="admin-item-input"
            style={{ flex: 2, border: '1.5px dashed var(--pm-accent)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' }}
            type="text" value={newLandscapeUrl} onChange={e => setNewLandscapeUrl(e.target.value)}
            placeholder="https://…" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="admin-save-btn" onClick={handleAdd}>{t('add', lang)}</button>
        </div>
      ) : (
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
      )}
    </div>
  );
}
