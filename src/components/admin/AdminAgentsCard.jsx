import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t, tl } from '../../lib/i18n.js';

export default function AdminAgentsCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const agents = state.catalog.agents || [];
  const assistants = state.catalog.assistants || [];
  const categories = state.catalog.categories || [];

  const [filterDomain, setFilterDomain] = useState('');
  const [filterAssistant, setFilterAssistant] = useState('');
  const [newEn, setNewEn] = useState('');
  const [newFr, setNewFr] = useState('');
  const [newAssistant, setNewAssistant] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editEn, setEditEn] = useState('');
  const [editFr, setEditFr] = useState('');
  const [editAssistant, setEditAssistant] = useState('');

  function getEn(a) { return typeof a.name === 'object' ? a.name.en || '' : a.name || ''; }
  const [confirmId, setConfirmId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragSrcId = useRef(null);

  function usageCount(a) {
    return state.prompts.filter(p => p.agent === getEn(a)).length;
  }

  async function saveCatalog(updatedAgents) {
    const latest = await StorageAPI.getCatalog();
    const catalog = { ...latest, agents: updatedAgents };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: { ...state.catalog, agents: updatedAgents } });
  }

  async function handleAdd() {
    const en = newEn.trim();
    const fr = newFr.trim();
    const assistant = newAssistant || filterAssistant || '';
    if (!en) return;
    if (agents.some(a => getEn(a) === en)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    const nameObj = fr ? { en, fr } : en;
    const entry = { id: crypto.randomUUID(), name: nameObj, assistant };
    await saveCatalog([...agents, entry]);
    dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, en) });
    setNewEn('');
    setNewFr('');
    setNewAssistant('');
  }

  async function handleRename(id) {
    const en = editEn.trim();
    const fr = editFr.trim();
    if (!en) return;
    const old = agents.find(a => a.id === id);
    if (!old) return;
    const oldEn = getEn(old);
    if (agents.some(a => a.id !== id && getEn(a) === en)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    const nameObj = fr ? { en, fr } : en;
    if (oldEn !== en) {
      const changed = state.prompts.filter(p => p.agent === oldEn);
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt({ ...p, agent: en })));
      if (changed.length > 0) {
        const allPrompts = await StorageAPI.getAllPrompts();
        dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
      }
    }
    await saveCatalog(agents.map(a => a.id === id ? { ...a, name: nameObj, assistant: editAssistant } : a));
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, en) });
    setEditingId(null);
  }

  async function handleDelete(id) {
    const entry = agents.find(a => a.id === id);
    if (!entry) return;
    const enKey = getEn(entry);
    const changed = state.prompts.filter(p => p.agent === enKey);
    await Promise.all(changed.map(p => StorageAPI.upsertPrompt({ ...p, agent: null })));
    if (changed.length > 0) {
      const allPrompts = await StorageAPI.getAllPrompts();
      dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
    }
    await saveCatalog(agents.filter(a => a.id !== id));
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, enKey) });
    setConfirmId(null);
  }

  function handleDragStart(id) { dragSrcId.current = id; }
  function handleDragOver(e, id) { e.preventDefault(); setDragOverId(id); }
  function handleDragLeave() { setDragOverId(null); }
  async function handleDrop(toId) {
    setDragOverId(null);
    const fromId = dragSrcId.current;
    if (!fromId || fromId === toId) return;
    const fromIdx = agents.findIndex(a => a.id === fromId);
    const toIdx   = agents.findIndex(a => a.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...agents];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await saveCatalog(reordered);
  }

  // Group by assistant
  const usedAssistants = [...new Set(agents.map(a => a.assistant || ''))];
  const visibleAssistants = filterAssistant ? [filterAssistant] : usedAssistants;

  function renderRow(a) {
    const cnt = usageCount(a);
    const enVal = getEn(a);
    const frVal = typeof a.name === 'object' ? a.name.fr || '' : '';
    if (editingId === a.id) {
      return (
        <div key={a.id} className="admin-row">
          <div className="admin-bilingual-edit">
            <input className="admin-item-input" value={editEn} onChange={e => setEditEn(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(a.id); if (e.key === 'Escape') setEditingId(null); }}
              autoFocus placeholder="EN" />
            <input className="admin-item-input admin-item-input-fr" value={editFr} onChange={e => setEditFr(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(a.id); if (e.key === 'Escape') setEditingId(null); }}
              placeholder="FR (optionnel)" />
          </div>
          <select className="admin-item-input" value={editAssistant} onChange={e => setEditAssistant(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">— Any assistant —</option>
            {assistants.map(ast => <option key={ast.id} value={getEnFromAst(ast)}>{tl(ast.name, lang)}</option>)}
          </select>
          <button className="admin-save-btn" onClick={() => handleRename(a.id)}>{t('saveBtn', lang)}</button>
          <button className="admin-del-btn" onClick={() => setEditingId(null)}>{t('cancel', lang)}</button>
        </div>
      );
    }
    if (confirmId === a.id) {
      return (
        <div key={a.id} className="admin-row">
          <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', color: 'var(--pm-danger)', fontWeight: 600 }}>Delete "{enVal}"?</span>
          <button className="admin-save-btn" style={{ background: 'var(--pm-danger)' }} onClick={() => handleDelete(a.id)}>{t('del', lang)}</button>
          <button className="admin-del-btn" onClick={() => setConfirmId(null)}>{t('cancel', lang)}</button>
        </div>
      );
    }
    return (
      <div key={a.id} className={`admin-row${dragOverId === a.id ? ' drag-over' : ''}`}
        draggable onDragStart={() => handleDragStart(a.id)}
        onDragOver={e => handleDragOver(e, a.id)} onDragLeave={handleDragLeave} onDrop={() => handleDrop(a.id)}>
        <span className="admin-drag-handle" title="Drag to reorder">⠿</span>
        <div className="admin-bilingual-display" style={{ flex: 1, cursor: 'pointer', padding: '3px 8px' }}
          onClick={() => { setEditingId(a.id); setEditEn(enVal); setEditFr(frVal); setEditAssistant(a.assistant || ''); }}>
          <span className="admin-bilingual-en">{enVal}</span>
          {frVal && <span className="admin-bilingual-fr">{frVal}</span>}
        </div>
        {a.assistant && (
          <span className="admin-assistant-domain-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
            {tl((assistants.find(ast => getEnFromAst(ast) === a.assistant) || {}).name || a.assistant, lang)}
          </span>
        )}
        <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>{cnt > 0 ? t('usedBy', lang, cnt) : t('unused', lang)}</span>
        <button className="admin-del-btn" onClick={() => setConfirmId(a.id)}>{t('del', lang)}</button>
      </div>
    );
  }

  // Helper to get EN key from assistant object (backwards compat)
  function getEnFromAst(ast) { return typeof ast.name === 'object' ? ast.name.en || '' : ast.name || ''; }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t('agentsAdmin', lang)}</h2>
          <p>{t('agentsDesc', lang)}</p>
        </div>
      </div>

      {/* Domain filter */}
      {categories.length > 0 && (
        <div className="admin-filter-row">
          <span className="admin-filter-label">Filter by domain:</span>
          <button className={`admin-filter-btn${!filterDomain ? ' active' : ''}`} onClick={() => { setFilterDomain(''); setFilterAssistant(''); }}>All</button>
          {categories.map(c => {
            const key = typeof c === 'object' ? c.en : c;
            return (
              <button key={key} className={`admin-filter-btn${filterDomain === key ? ' active' : ''}`}
                onClick={() => { setFilterDomain(key); setFilterAssistant(''); }}>{tl(c, lang)}</button>
            );
          })}
        </div>
      )}

      {/* Assistant filter — scoped to selected domain */}
      {assistants.length > 0 && (
        <div className="admin-filter-row">
          <span className="admin-filter-label">Filter by assistant:</span>
          <button className={`admin-filter-btn${!filterAssistant ? ' active' : ''}`} onClick={() => setFilterAssistant('')}>All</button>
          {assistants
            .filter(ast => !filterDomain || ast.domain === filterDomain)
            .map(ast => {
              const enKey = getEnFromAst(ast);
              return (
                <button key={ast.id} className={`admin-filter-btn${filterAssistant === enKey ? ' active' : ''}`}
                  onClick={() => setFilterAssistant(enKey)}>{tl(ast.name, lang)}</button>
              );
            })}
        </div>
      )}

      {agents.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}

      <div className="admin-list">
        {visibleAssistants.map(astEnKey => {
          const group = agents.filter(a => (a.assistant || '') === astEnKey);
          if (group.length === 0) return null;
          const astObj = assistants.find(a => getEnFromAst(a) === astEnKey);
          const astLabel = astObj ? tl(astObj.name, lang) : (astEnKey || '— No assistant —');
          return (
            <div key={astEnKey || '__none__'} className="admin-group">
              <div className="admin-group-header" style={{ borderLeftColor: '#818CF8' }}>
                {astLabel}
                <span className="admin-group-count">{group.length}</span>
              </div>
              {group.map(renderRow)}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      <div className="admin-bilingual-add" style={{ marginTop: 12 }}>
        <input className="admin-item-input" value={newEn} onChange={e => setNewEn(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="EN — required"
          style={{ flex: 2, border: '1.5px dashed var(--pm-accent)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' }} />
        <input className="admin-item-input admin-item-input-fr" value={newFr} onChange={e => setNewFr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="FR — optionnel"
          style={{ flex: 2, border: '1.5px dashed rgba(99,102,241,0.35)', borderRadius: 7, padding: '6px 10px', background: 'var(--pm-bg)' }} />
        <select className="admin-item-input" value={newAssistant || filterAssistant}
          onChange={e => setNewAssistant(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">— Any assistant —</option>
          {assistants.map(ast => <option key={ast.id} value={getEnFromAst(ast)}>{tl(ast.name, lang)}</option>)}
        </select>
        <button className="admin-save-btn" onClick={handleAdd}>{t('addAgent', lang)}</button>
      </div>
    </div>
  );
}
