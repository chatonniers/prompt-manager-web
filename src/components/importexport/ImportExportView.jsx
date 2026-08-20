import { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function ImportExportView() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const [importMode, setImportMode] = useState('merge');
  const [importStatus, setImportStatus] = useState(null);
  const fileRef = useRef(null);

  function handleExport() {
    StorageAPI.exportAll().then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'prompts.json'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const result = await StorageAPI.importAll(data, importMode);
        const prompts = await StorageAPI.getAllPrompts();
        const catalog = await StorageAPI.getCatalog();
        dispatch({ type: 'SET_PROMPTS', prompts });
        dispatch({ type: 'SET_CATALOG', catalog });
        const msg = t('importOk', lang, result.imported, result.skipped);
        setImportStatus({ ok: true, msg });
        dispatch({ type: 'SHOW_TOAST', msg });
      } catch {
        setImportStatus({ ok: false, msg: 'Import failed — invalid file.' });
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <div id="view-import-export">
      <div className="view-card">
        <h2>{t('exportTitle', lang)}</h2>
        <p>{t('exportDesc', lang)}</p>
        <button className="action-btn primary" onClick={handleExport}>{t('exportBtn', lang)}</button>
      </div>
      <div className="view-card">
        <h2>{t('importTitle', lang)}</h2>
        <p>{t('importDesc', lang)}</p>
        <div className="import-row">
          <button className="action-btn" onClick={() => fileRef.current?.click()}>{t('importBtn', lang)}</button>
          <input type="file" ref={fileRef} accept=".json" style={{ display:'none' }} onChange={handleImportFile} />
          <label>
            <input type="radio" name="import-mode" value="merge" checked={importMode === 'merge'} onChange={() => setImportMode('merge')} />
            <span> {t('importMerge', lang)}</span>
          </label>
          <label>
            <input type="radio" name="import-mode" value="replace" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
            <span> {t('importReplace', lang)}</span>
          </label>
        </div>
        {importStatus && (
          <div className={`import-status${importStatus.ok ? '' : ' import-error'}`} style={{ marginTop: 12 }}>
            {importStatus.msg}
          </div>
        )}
      </div>
    </div>
  );
}
