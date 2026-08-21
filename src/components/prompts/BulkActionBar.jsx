import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function BulkActionBar({ visibleIds }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { selectedIds, catalog, prompts } = state;
  const count = selectedIds.size;
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (count === 0) return null;

  function selectAll() {
    dispatch({ type: 'SELECT_ALL', payload: visibleIds });
  }

  function clearAll() {
    dispatch({ type: 'CLEAR_SELECT' });
    setConfirmDelete(false);
  }

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
    const updated = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: updated });
    dispatch({ type: 'CLEAR_SELECT' });
    dispatch({ type: 'SHOW_TOAST', payload: `Moved ${count} prompt${count !== 1 ? 's' : ''} to ${category || 'Uncategorized'}` });
  }

  async function moveToFlow(flow) {
    const selected = prompts.filter(p => selectedIds.has(p.id));
    await Promise.all(selected.map(p => StorageAPI.upsertPrompt({ ...p, storyFlow: flow || '' })));
    const updated = await StorageAPI.getAllPrompts();
    dispatch({ type: 'SET_PROMPTS', payload: updated });
    dispatch({ type: 'CLEAR_SELECT' });
    dispatch({ type: 'SHOW_TOAST', payload: `Moved ${count} prompt${count !== 1 ? 's' : ''} to ${flow || 'No flow'}` });
  }

  async function deleteSelected() {
    const ids = [...selectedIds];
    const deleted = prompts.filter(p => ids.includes(p.id));
    const remaining = prompts.filter(p => !ids.includes(p.id));

    // Optimistic: remove from UI immediately
    dispatch({ type: 'SET_PROMPTS', payload: remaining });
    dispatch({ type: 'CLEAR_SELECT' });
    setConfirmDelete(false);

    // Schedule actual storage delete, cancelled if undo is clicked
    let undone = false;
    const timer = setTimeout(async () => {
      if (undone) return;
      await Promise.all(ids.map(id => StorageAPI.deletePrompt(id)));
    }, 10000);

    dispatch({
      type: 'SHOW_TOAST',
      payload: `${ids.length} prompt${ids.length !== 1 ? 's' : ''} deleted`,
      undo: () => {
        undone = true;
        clearTimeout(timer);
        dispatch({ type: 'SET_PROMPTS', payload: prompts }); // restore original list
      },
    });
  }

  return (
    <div className="bulk-action-bar">
      <span className="bulk-count">{t('bulkSelected', lang, count)}</span>
      <button className="bulk-action-btn" onClick={selectAll}>{t('bulkSelectAll', lang)}</button>
      <button className="bulk-action-btn" onClick={exportSelected}>{t('bulkExport', lang)}</button>

      <select
        className="bulk-action-select"
        defaultValue=""
        onChange={e => { if (e.target.value !== '') { moveToCategory(e.target.value === '__none__' ? '' : e.target.value); e.target.value = ''; } }}
      >
        <option value="" disabled>{t('bulkMoveCategory', lang)}</option>
        <option value="__none__">— {t('noCategory', lang)} —</option>
        {(catalog.categories || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>

      <select
        className="bulk-action-select"
        defaultValue=""
        onChange={e => { if (e.target.value !== '') { moveToFlow(e.target.value === '__none__' ? '' : e.target.value); e.target.value = ''; } }}
      >
        <option value="" disabled>{t('bulkMoveFlow', lang)}</option>
        <option value="__none__">— {t('selectNone', lang)} —</option>
        {(catalog.storyFlows || []).map(f => <option key={f} value={f}>{f}</option>)}
      </select>

      {confirmDelete ? (
        <>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--pm-danger)' }}>
            {t('deleteConfirmInline', lang, `${count} prompt${count !== 1 ? 's' : ''}`)}
          </span>
          <button className="bulk-action-btn bulk-action-del-confirm" onClick={deleteSelected}>{t('del', lang)}</button>
          <button className="bulk-action-btn" onClick={() => setConfirmDelete(false)}>{t('cancel', lang)}</button>
        </>
      ) : (
        <button className="bulk-action-btn bulk-action-del" onClick={() => setConfirmDelete(true)}>{t('del', lang)}</button>
      )}

      <button className="bulk-action-btn bulk-action-clear" onClick={clearAll}>✕ {t('bulkClear', lang)}</button>
    </div>
  );
}
