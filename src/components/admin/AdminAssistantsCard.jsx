import { useState, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

const DOMAIN_COLORS = [
  '#818CF8', '#34D399', '#F59E0B', '#F472B6', '#60A5FA',
  '#A78BFA', '#4ADE80', '#FB923C', '#E879F9', '#38BDF8',
];

function domainColor(domain, categories) {
  const idx = categories.indexOf(domain);
  return DOMAIN_COLORS[idx >= 0 ? idx % DOMAIN_COLORS.length : DOMAIN_COLORS.length - 1];
}

export default function AdminAssistantsCard() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const assistants = state.catalog.assistants || [];
  const categories = state.catalog.categories || [];

  const [filterDomain, setFilterDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDomain, setEditDomain] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const dragSrcId = useRef(null);

  function usageCount(name) {
    return state.prompts.filter(p => p.assistant === name).length;
  }

  async function saveCatalog(updatedAssistants) {
    const latest = await StorageAPI.getCatalog();
    const catalog = { ...latest, assistants: updatedAssistants };
    await StorageAPI.saveCatalog(catalog);
    dispatch({ type: 'SET_CATALOG', payload: { ...state.catalog, assistants: updatedAssistants } });
  }

  async function handleAdd() {
    const name = newName.trim();
    const domain = newDomain || filterDomain || '';
    if (!name) return;
    if (assistants.some(a => a.name === name)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    const entry = { id: crypto.randomUUID(), name, domain };
    await saveCatalog([...assistants, entry]);
    dispatch({ type: 'SHOW_TOAST', payload: t('added', lang, name) });
    setNewName('');
    setNewDomain('');
  }

  async function handleRename(id) {
    const name = editName.trim();
    if (!name) return;
    const old = assistants.find(a => a.id === id);
    if (!old) return;
    if (assistants.some(a => a.id !== id && a.name === name)) {
      dispatch({ type: 'SHOW_TOAST', payload: t('nameExists', lang) });
      return;
    }
    if (old.name !== name) {
      const changed = state.prompts.filter(p => p.assistant === old.name);
      await Promise.all(changed.map(p => StorageAPI.upsertPrompt({ ...p, assistant: name })));
      if (changed.length > 0) {
        const allPrompts = await StorageAPI.getAllPrompts();
        dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
      }
    }
    await saveCatalog(assistants.map(a => a.id === id ? { ...a, name, domain: editDomain } : a));
    dispatch({ type: 'SHOW_TOAST', payload: t('renamed', lang, name) });
    setEditingId(null);
  }

  async function handleDelete(id) {
    const entry = assistants.find(a => a.id === id);
    if (!entry) return;
    const changed = state.prompts.filter(p => p.assistant === entry.name);
    await Promise.all(changed.map(p => StorageAPI.upsertPrompt({ ...p, assistant: null })));
    if (changed.length > 0) {
      const allPrompts = await StorageAPI.getAllPrompts();
      dispatch({ type: 'SET_PROMPTS', payload: allPrompts });
    }
    await saveCatalog(assistants.filter(a => a.id !== id));
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
    const fromIdx = assistants.findIndex(a => a.id === fromId);
    const toIdx   = assistants.findIndex(a => a.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...assistants];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    await saveCatalog(reordered);
  }

  // Group by domain
  const usedDomains = [...new Set(assistants.map(a => a.domain || ''))];
  const visibleDomains = filterDomain ? [filterDomain] : usedDomains;

  function renderRow(a) {
    const cnt = usageCount(a.name);
    const color = domainColor(a.domain, categories);
    if (editingId === a.id) {
      return (
        <div key={a.id} className="admin-row">
          <input className="admin-item-input" value={editName} onChange={e => setEditName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(a.id); if (e.key === 'Escape') setEditingId(null); }}
            autoFocus style={{ flex: 1 }} />
          <select className="admin-item-input" value={editDomain} onChange={e => setEditDomain(e.target.value)} style={{ maxWidth: 180 }}>
            <option value="">— Any domain —</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
          onClick={() => { setEditingId(a.id); setEditName(a.name); setEditDomain(a.domain || ''); }}>
          {a.name}
        </span>
        {a.domain && <span className="admin-assistant-domain-badge" style={{ background: color + '22', color }}>{a.domain}</span>}
        <span className={`admin-in-use${cnt > 0 ? ' has-uses' : ''}`}>{cnt > 0 ? t('usedBy', lang, cnt) : t('unused', lang)}</span>
        <button className="admin-del-btn" onClick={() => setConfirmId(a.id)}>{t('del', lang)}</button>
      </div>
    );
  }

  return (
    <div className="view-card admin-card">
      <div className="admin-card-header">
        <div>
          <h2>{t('assistantsAdmin', lang)}</h2>
          <p>{t('assistantsDesc', lang)}</p>
        </div>
      </div>

      {/* Domain filter */}
      {categories.length > 0 && (
        <div className="admin-filter-row">
          <span className="admin-filter-label">Filter by domain:</span>
          <button className={`admin-filter-btn${!filterDomain ? ' active' : ''}`} onClick={() => setFilterDomain('')}>All</button>
          {categories.map(c => (
            <button key={c} className={`admin-filter-btn${filterDomain === c ? ' active' : ''}`} onClick={() => setFilterDomain(c)}>{c}</button>
          ))}
        </div>
      )}

      {assistants.length === 0 && <div className="admin-empty">{t('noItems', lang)}</div>}

      <div className="admin-list">
        {visibleDomains.map(domain => {
          const group = assistants.filter(a => (a.domain || '') === domain);
          if (group.length === 0) return null;
          const color = domainColor(domain, categories);
          return (
            <div key={domain || '__none__'} className="admin-group">
              <div className="admin-group-header" style={{ borderLeftColor: color }}>
                {domain || '— No domain —'}
                <span className="admin-group-count">{group.length}</span>
              </div>
              {group.map(renderRow)}
            </div>
          );
        })}
        {/* Assistants with no domain that aren't in the used-domains list */}
        {!filterDomain && assistants.filter(a => !usedDomains.includes(a.domain || '') || (a.domain || '') === '').length > 0 && null}
      </div>

      {/* Add form */}
      <div className="admin-add-row" style={{ marginTop: 12 }}>
        <input className="admin-item-input" value={newName} onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} placeholder="Assistant name…" />
        <select className="admin-item-input" value={newDomain || filterDomain}
          onChange={e => setNewDomain(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">— Any domain —</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="admin-save-btn" onClick={handleAdd}>{t('addAssistant', lang)}</button>
      </div>
    </div>
  );
}
