import { useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function TopBar() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const importRef = useRef(null);

  function handleLangToggle() {
    const newLang = lang === 'en' ? 'fr' : 'en';
    const updated = { ...state.settings, lang: newLang };
    StorageAPI.saveSettings(updated);
    dispatch({ type: 'SET_SETTINGS', payload: updated });
  }

  function handleExport() {
    StorageAPI.exportAll().then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prompts.json';
      a.click();
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
        const result = await StorageAPI.importAll(data, 'merge');
        const prompts = await StorageAPI.getAllPrompts();
        const catalog = await StorageAPI.getCatalog();
        dispatch({ type: 'SET_PROMPTS', payload: prompts });
        dispatch({ type: 'SET_CATALOG', payload: catalog });
        dispatch({ type: 'SHOW_TOAST', payload: t('importOk', lang, result.imported, result.skipped) });
      } catch {
        dispatch({ type: 'SHOW_TOAST', payload: 'Import failed — invalid file.' });
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <header id="top-bar">
      <div id="top-bar-left">
        <div id="app-title">
          <span className="title-main">Prompt Manager Web</span>
        </div>
      </div>
      <div id="top-bar-right">
        <button className="tb-btn tb-btn-lang" onClick={handleLangToggle} title="Switch language">
          {lang === 'en' ? 'FR' : 'EN'}
        </button>
        <button className="tb-btn tb-btn-primary" onClick={() => dispatch({ type: 'OPEN_MODAL', payload: undefined })}>
          {t('newPrompt', lang)}
        </button>
        <button className="tb-btn" onClick={() => importRef.current?.click()}>{t('import', lang)}</button>
        <button className="tb-btn" onClick={handleExport}>{t('export', lang)}</button>
        <input type="file" ref={importRef} accept=".json" style={{ display:'none' }} onChange={handleImportFile} />
      </div>
    </header>
  );
}
