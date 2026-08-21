import { useRef, useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { encodeShareUrl } from '../../lib/share.js';
import { t } from '../../lib/i18n.js';
import ImportModeModal from '../shared/ImportModeModal.jsx';

export default function TopBar({ onHelp }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const importRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [importData, setImportData] = useState(null);

  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  function handleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

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
        setImportData(data);
      } catch {
        dispatch({ type: 'SHOW_TOAST', payload: t('importFailed', lang) });
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  async function handleImportConfirm(data, mode) {
    try {
      const result = await StorageAPI.importAll(data, mode);
      const prompts = await StorageAPI.getAllPrompts();
      const catalog = await StorageAPI.getCatalog();
      dispatch({ type: 'SET_PROMPTS', payload: prompts });
      dispatch({ type: 'SET_CATALOG', payload: catalog });
      dispatch({ type: 'SHOW_TOAST', payload: t('importOk', lang, result.imported, result.skipped) });
    } catch {
      dispatch({ type: 'SHOW_TOAST', payload: t('importFailed', lang) });
    }
    setImportData(null);
  }

  async function handleShareUrl() {
    const data = await StorageAPI.exportAll();
    const url = await encodeShareUrl(data);
    if (url.length > 200 * 1024) {
      dispatch({ type: 'SHOW_TOAST', payload: t('shareUrlTooLarge', lang) });
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = url; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    });
    dispatch({ type: 'SHOW_TOAST', payload: t('shareUrlCopied', lang) });
  }

  return (
    <header id="top-bar">
      <div id="top-bar-left">
        <div id="app-title" style={{ cursor: 'pointer' }} onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'all', filter: { storyFlow: null, solution: null, category: null } } })}>
          <span className="title-main">{t('appTitle', lang)}</span>
        </div>
      </div>
      <div id="top-bar-right">
        <button className="tb-btn tb-btn-lang" onClick={handleLangToggle} title="Switch language">
          {lang === 'en' ? 'FR' : 'EN'}
        </button>
        <button className="tb-btn" onClick={() => importRef.current?.click()}>{t('import', lang)}</button>
        <button className="tb-btn" onClick={handleExport}>{t('export', lang)}</button>
        <button className="tb-btn" onClick={handleShareUrl} title={t('shareUrl', lang)}>🔗</button>
        <input type="file" ref={importRef} accept=".json" style={{ display:'none' }} onChange={handleImportFile} />

        {importData && (
          <ImportModeModal
            data={importData}
            existingCount={state.prompts.length}
            lang={lang}
            onConfirm={handleImportConfirm}
            onClose={() => setImportData(null)}
          />
        )}

        <div className="tb-divider" />

        <button className="tb-btn tb-btn-icon" onClick={onHelp} title="Help">?</button>
        <button className="tb-btn tb-btn-icon" onClick={handleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
            {isFullscreen
              ? <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              : <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            }
          </svg>
        </button>
        <div className="tb-divider" />
        <button
          className={`tb-btn tb-btn-icon${state.currentView === 'settings' ? ' tb-btn-active' : ''}`}
          onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'settings' } })}
          title={t('settings', lang)}
        >⚙</button>
      </div>
    </header>
  );
}
