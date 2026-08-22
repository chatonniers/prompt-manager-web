import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

function BulkDropdown({ label, options, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="bulk-dropdown">
      <button className="bulk-action-btn bulk-dropdown-trigger" onClick={() => setOpen(o => !o)}>
        {label} <span className="bulk-dropdown-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="bulk-dropdown-menu">
          {options.map(opt => (
            <button key={opt.value} className="bulk-dropdown-item" onClick={() => { onSelect(opt.value); setOpen(false); }}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BulkActionBar({ visibleIds }) {
  const { state, dispatch } = useApp();
  const { isAdmin, isEditor } = useAuth();
  const canEdit = isAdmin || isEditor;
  const lang = state.settings?.lang || 'en';
  const { selectedIds, catalog, prompts } = state;
  const count = selectedIds.size;
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (count === 0) return null;

  function selectAll() { dispatch({ type: 'SELECT_ALL', payload: visibleIds }); }
  function clearAll() { dispatch({ type: 'CLEAR_SELECT' }); setConfirmDelete(false); }

  async function exportSelected() {
    const selected = prompts.filter(p => selectedIds.has(p.id));
    const data = { prompts: selected, catalog: state.catalog };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `prompts-selection-${count}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function moveToCategory(category) {
    const selected = prompts.filter(p => selectedIds.has(p.id));
    await Promise.all(selected.map(p => StorageAPI.upsertPrompt({ ...p, category: category || null })));
    dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    dispatch({ type: 'CLEAR_SELECT' });
    dispatch({ type: 'SHOW_TOAST', payload: `Moved ${count} prompt${count !== 1 ? 's' : ''} to ${category || 'Uncategorized'}` });
  }

  async function moveToFlow(flow) {
    const selected = prompts.filter(p => selectedIds.has(p.id));
    await Promise.all(selected.map(p => StorageAPI.upsertPrompt({ ...p, storyFlow: flow || '' })));
    dispatch({ type: 'SET_PROMPTS', payload: await StorageAPI.getAllPrompts() });
    dispatch({ type: 'CLEAR_SELECT' });
    dispatch({ type: 'SHOW_TOAST', payload: `Moved ${count} prompt${count !== 1 ? 's' : ''} to ${flow || 'No flow'}` });
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    const remaining = prompts.filter(p => !ids.includes(p.id));
    dispatch({ type: 'SET_PROMPTS', payload: remaining });
    dispatch({ type: 'CLEAR_SELECT' });
    setConfirmDelete(false);
    let undone = false;
    const timer = setTimeout(async () => { if (!undone) await Promise.all(ids.map(id => StorageAPI.deletePrompt(id))); }, 10000);
    dispatch({ type: 'SHOW_TOAST', payload: `${ids.length} prompt${ids.length !== 1 ? 's' : ''} deleted`,
      undo: () => { undone = true; clearTimeout(timer); dispatch({ type: 'SET_PROMPTS', payload: prompts }); } });
  }

  const categoryOptions = [
    { value: '__none__', label: `— ${t('noCategory', lang)} —` },
    ...(catalog.categories || []).map(cat => ({ value: cat, label: cat })),
  ];
  const flowOptions = [
    { value: '__none__', label: `— ${t('selectNone', lang)} —` },
    ...(catalog.storyFlows || []).map(f => ({ value: f, label: f })),
  ];

  return createPortal(
    <div className="bulk-action-bar">
      <span className="bulk-count">{t('bulkSelected', lang, count)}</span>
      <button className="bulk-action-btn" onClick={selectAll}>{t('bulkSelectAll', lang)}</button>
      <button className="bulk-action-btn" onClick={clearAll}>{t('bulkClear', lang)}</button>
      <div className="bulk-divider" />
      <button className="bulk-action-btn" onClick={exportSelected}>{t('bulkExport', lang)}</button>
      <BulkDropdown
        label={t('bulkMoveCategory', lang)}
        options={categoryOptions}
        onSelect={v => moveToCategory(v === '__none__' ? '' : v)}
      />
      <BulkDropdown
        label={t('bulkMoveFlow', lang)}
        options={flowOptions}
        onSelect={v => moveToFlow(v === '__none__' ? '' : v)}
      />
      <div className="bulk-divider" />
      {canEdit && (confirmDelete ? (
        <>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#fca5a5' }}>
            {t('deleteConfirmInline', lang, `${count} prompt${count !== 1 ? 's' : ''}`)}
          </span>
          <button className="bulk-action-btn bulk-action-del-confirm" onClick={deleteSelected}>{t('del', lang)}</button>
          <button className="bulk-action-btn" onClick={() => setConfirmDelete(false)}>{t('cancel', lang)}</button>
        </>
      ) : (
        <button className="bulk-action-btn bulk-action-del" onClick={() => setConfirmDelete(true)}>{t('del', lang)}</button>
      ))}
    </div>,
    document.body
  );
}
