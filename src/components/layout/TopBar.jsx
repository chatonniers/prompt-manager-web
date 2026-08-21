import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';

export default function TopBar({ onHelp }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

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
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
            <path d="M6.5 1h3l.5 1.5a5 5 0 0 1 1.2.7l1.5-.5 1.5 2.6-1.2 1.1a5 5 0 0 1 0 1.4l1.2 1.1-1.5 2.6-1.5-.5a5 5 0 0 1-1.2.7L9.5 15h-3l-.5-1.5A5 5 0 0 1 4.8 12.8l-1.5.5L1.8 10.7l1.2-1.1a5 5 0 0 1 0-1.4L1.8 7.1l1.5-2.6 1.5.5A5 5 0 0 1 6 3.5L6.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
            <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
          </svg>
        </button>
      </div>
    </header>
  );
}
