import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function AdminAgentsCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const agents = state.catalog.agents || [];
  const assistants = state.catalog.assistants || [];

  const [filterAssistant, setFilterAssistant] = useState('');
  const [newName, setNewName] = useState('');
  const [newAssistant, setNewAssistant] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAssistant, setEditAssistant] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragSrcId = useRef(null);

  function usageCount(name) {
    return state.prompts.filter(p => p.agent === name).length;
  }

  async function saveCatalog(updatedAgents) {
    const latest = await StorageAPI.getCatalog();
    const catalog = { ...latest, agents: updatedAgents };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: { ...state.catalog, agents: updatedAgents } });
  }

  async function handleAdd() {
    const name = newName.trim();
    const assistant = newAssistant || filterAssistant || '';
    if (!name) return;
    if (agents.some(a => a.name === name)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    const entry = { id: crypto.randomUUID(), name, assistant };
    await saveCatalog([...agents, entry]);
    dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, name) });
    setNewName('');
    setNewAssistant('');
  }

  async function handleRename(id) {
    const name = editName.trim();
    if (!name) return;
    const old = agents.find(a => a.id === id);
    if (!old) return;
    if (agents.some(a => a.id !== id && a.name === name)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    if (old.name !== name) {
      const changed = state.prompts.filter(p => p.agent === old.name);
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt({ ...p, agent: name })));
      if (changed.length > 0) {
        const allPrompts = await StorageAPI.getAllPrompts();
        dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
      }
    }
    await saveCatalog(agents.map(a => a.id === id ? { ...a, name, assistant: editAssistant } : a));
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, name) });
    setEditingId(null);
  }

  async function handleDelete(id) {
    const entry = agents.find(a => a.id === id);
    if (!entry) return;
    const changed = state.prompts.filter(p => p.agent === entry.name);
    await Promise.all(changed.map(p => StorageAPI.upsertPrompt({ ...p, agent: null })));
    if (changed.length > 0) {
      const allPrompts = await StorageAPI.getAllPrompts();
      dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
    }
    await saveCatalog(agents.filter(a => a.id !== id));
    dispatch({ type: 'SHOW_TOAST', payload: t('deleted', lang, entry.name) });
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
    const cnt = usageCount(a.name);
    if (editingId === a.id) {
      return (
        <div key={a.id} className="admin-row">
          <input className="admin-item-input" value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(a.id); if (e.key === 'Escape') setEditingId(null); }}
            autoFocus style={{ flex: 1 }} />
          <select className="admin-item-input" value={editAssistant} onChange={e => setEditAssistant(e.target.value)} style={{ maxWidth: 200 }}>
            <option value="">— Any assistant —</option>
            {assistants.map(ast => <option key={ast.id} value={ast.name}>{ast.name}</option>)}
          </select>
          <button className="admin-save-btn" onClick={() => handleRename(a.id)}>{t('saveBtn', lang)}</button>
          <button className="admin-del-btn" onClick={() => setEditingId(null)}>{t('cancel', lang)}</button>
        </div>
      );
    }
    if (confirmId === a.id) {
      return (
        <div key={a.id} className="admin-row">
          <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', color: 'var(--pm-danger)', fontWeight: 600 }}>Delete "{a.name}"?</span>
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
        <span className="admin-item-input" style={{ flex: 1, padding: '5px 8px', cursor: 'pointer' }}
          onClick={() => { setEditingId(a.id); setEditName(a.name); setEditAssistant(a.assistant || ''); }}>
          {a.name}
        </span>
        {a.assistant && (
          <span className="admin-assistant-domain-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>{a.assistant}</span>
        )}
        <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>{cnt > 0 ? t('usedBy', lang, cnt) : t('unused', lang)}</span>
        <button className="admin-del-btn" onClick={() => setConfirmId(a.id)}>{t('del', lang)}</button>
      </div>
    );
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t('agentsAdmin', lang)}</h2>
          <p>{t('agentsDesc', lang)}</p>
        </div>
      </div>

      {/* Assistant filter */}
      {assistants.length > 0 && (
        <div className="admin-filter-row">
          <span className="admin-filter-label">Filter by assistant:</span>
          <button className={`admin-filter-btn${!filterAssistant ? ' active' : ''}`} onClick={() => setFilterAssistant('')}>All</button>
          {assistants.map(ast => (
            <button key={ast.id} className={`admin-filter-btn${filterAssistant === ast.name ? ' active' : ''}`}
              onClick={() => setFilterAssistant(ast.name)}>{ast.name}</button>
          ))}
        </div>
      )}

      {agents.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}

      <div className="admin-list">
        {visibleAssistants.map(astName => {
          const group = agents.filter(a => (a.assistant || '') === astName);
          if (group.length === 0) return null;
          return (
            <div key={astName || '__none__'} className="admin-group">
              <div className="admin-group-header" style={{ borderLeftColor: '#818CF8' }}>
                {astName || '— No assistant —'}
                <span className="admin-group-count">{group.length}</span>
              </div>
              {group.map(renderRow)}
            </div>
          );
        })}
      </div>

      {/* Add form */}
      <div className="admin-add-row" style={{ marginTop: 12 }}>
        <input className="admin-item-input" value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="Agent name…" />
        <select className="admin-item-input" value={newAssistant || filterAssistant}
          onChange={e => setNewAssistant(e.target.value)} style={{ maxWidth: 200 }}>
          <option value="">— Any assistant —</option>
          {assistants.map(ast => <option key={ast.id} value={ast.name}>{ast.name}</option>)}
        </select>
        <button className="admin-save-btn" onClick={handleAdd}>{t('addAgent', lang)}</button>
      </div>
    </div>
  );
}
