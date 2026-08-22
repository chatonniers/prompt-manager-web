import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { t } from '../../lib/i18n.js';
import PinModal from '../shared/PinModal.jsx';

const STEP = 0.1;

function LogoMark() {
  return (
    <svg className="app-logo-mark" viewBox="0 0 34 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="7" width="22" height="22" rx="5" fill="rgba(99,102,241,0.25)" stroke="rgba(99,102,241,0.5)" strokeWidth="1.2"/>
      <rect x="7" y="4" width="22" height="22" rx="5" fill="rgba(99,102,241,0.35)" stroke="rgba(99,102,241,0.6)" strokeWidth="1.2"/>
      <rect x="10" y="8" width="20" height="20" rx="4" fill="#4F46E5" stroke="#6366F1" strokeWidth="1"/>
      <path d="M21 10l-5 7h4l-2 7 6-9h-4l1-5z" fill="white" opacity="0.92"/>
    </svg>
  );
}

export default function TopBar({ onHelp }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [pinOpen, setPinOpen] = useState(false);
  const promptCount = state.prompts?.length || 0;
  const usedCount = state.prompts?.reduce((sum, p) => sum + (p.usageCount || 0), 0) || 0;
  const zoom = state.zoom ?? 1;
  const zoomPct = Math.round(zoom * 100);
  const { searchQuery, currentView } = state;
  const showSearch = currentView !== 'settings';

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

  function handleSettingsClick() {
    if (state.currentView === 'settings') {
      dispatch({ type: 'SET_VIEW', payload: { view: 'all', filter: { storyFlow: null, solution: null, category: null } } });
    } else {
      setPinOpen(true);
    }
  }

  return (
    <>
      <header id="top-bar">
        {/* Left — logo + prompt count */}
        <div id="top-bar-left">
          <div id="app-title" onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'all', filter: { storyFlow: null, solution: null, category: null } } })}>
            <LogoMark />
            <div className="app-wordmark">
              <span className="title-main">{t('appTitle', lang)}</span>
            </div>
          </div>
          <div className="tb-stat-pill">
            <span className="tb-stat-dot" />
            {promptCount} {promptCount === 1 ? 'prompt' : 'prompts'}
          </div>
          <div className="tb-stat-pill">
            <span className="tb-stat-dot" style={{ background: '#818CF8', boxShadow: '0 0 6px #818CF8' }} />
            {usedCount} used
          </div>
        </div>

        {/* Center — search + zoom + new */}
        {showSearch && (
          <div id="top-bar-center">
            <div id="tb-search-wrap">
              <svg id="tb-search-icon" width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="6.5" cy="6.5" r="4.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                <line x1="10.2" y1="10.2" x2="14" y2="14" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <input
                id="tb-search"
                type="text"
                placeholder={t('searchPlaceholder', lang)}
                value={searchQuery}
                onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
                onKeyDown={e => { if (e.key === 'Escape') dispatch({ type: 'SET_SEARCH', payload: '' }); }}
                autoComplete="off"
                spellCheck="false"
              />
              {searchQuery && (
                <button id="tb-search-clear" onClick={() => dispatch({ type: 'SET_SEARCH', payload: '' })}>×</button>
              )}
            </div>
            <div id="tb-zoom-controls">
              <button className="tb-btn tb-btn-icon" onClick={() => dispatch({ type: 'SET_ZOOM', payload: zoom - STEP })} disabled={zoom <= 0.5} title="Zoom out">−</button>
              <button className="tb-zoom-label" onClick={() => dispatch({ type: 'SET_ZOOM', payload: 1 })} title="Reset zoom">{zoomPct}%</button>
              <button className="tb-btn tb-btn-icon" onClick={() => dispatch({ type: 'SET_ZOOM', payload: zoom + STEP })} disabled={zoom >= 2} title="Zoom in">+</button>
            </div>
            <button
              className="tb-btn tb-btn-primary"
              onClick={() => dispatch({ type: 'OPEN_MODAL', payload: undefined })}
            >
              {t('newPrompt', lang)}
            </button>
          </div>
        )}

        {/* Right — lang, fullscreen, settings */}
        <div id="top-bar-right">
          <button className="tb-btn tb-btn-lang" onClick={handleLangToggle} title="Switch language">
            {lang === 'en' ? 'FR' : 'EN'}
          </button>
          <div className="tb-divider" />
          <button className="tb-btn tb-btn-icon" onClick={onHelp} title="Help">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
              <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M6.2 6.2c0-1 .8-1.7 1.8-1.7s1.8.7 1.8 1.7c0 .8-.5 1.3-1.2 1.7-.4.2-.6.5-.6.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
            </svg>
          </button>
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
            onClick={handleSettingsClick}
            title={t('settings', lang)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
              <path d="M6.5 1h3l.5 1.5a5 5 0 0 1 1.2.7l1.5-.5 1.5 2.6-1.2 1.1a5 5 0 0 1 0 1.4l1.2 1.1-1.5 2.6-1.5-.5a5 5 0 0 1-1.2.7L9.5 15h-3l-.5-1.5A5 5 0 0 1 4.8 12.8l-1.5.5L1.8 10.7l1.2-1.1a5 5 0 0 1 0-1.4L1.8 7.1l1.5-2.6 1.5.5A5 5 0 0 1 6 3.5L6.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
            </svg>
          </button>
        </div>
      </header>
      {pinOpen && (
        <PinModal
          onUnlock={() => { setPinOpen(false); dispatch({ type: 'SET_VIEW', payload: { view: 'settings' } }); }}
          onCancel={() => setPinOpen(false)}
        />
      )}
    </>
  );
}
