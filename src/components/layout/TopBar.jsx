import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { supabase } from '../../lib/supabase.js';
import { t } from '../../lib/i18n.js';
import PublishRequestBell from '../shared/PublishRequestBell.jsx';

const STEP = 0.1;

function DisplayMenu({ theme, lang, zoom, zoomPct, isFullscreen, displayMode, onTheme, onLang, onZoom, onFullscreen, onHelp, onDisplayMode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="tb-display-menu" ref={ref}>
      <button
        className={`tb-btn tb-btn-icon${open ? ' tb-btn-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Display options"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
          <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <line x1="5" y1="13" x2="5" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="11" y1="13" x2="11" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="3" y1="15" x2="13" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="tb-display-panel">
          {/* Theme */}
          <div className="tb-display-row">
            <span className="tb-display-label">Theme</span>
            <div className="tb-display-seg">
              <button className={`tb-display-seg-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => { onTheme('dark'); }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Dark
              </button>
              <button className={`tb-display-seg-btn${theme === 'light' ? ' active' : ''}`} onClick={() => { onTheme('light'); }}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4"/><line x1="8" y1="1" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="13.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="1" y1="8" x2="2.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="13.5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="3.1" y1="3.1" x2="4.2" y2="4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="11.8" y1="11.8" x2="12.9" y2="12.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="12.9" y1="3.1" x2="11.8" y2="4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="4.2" y1="11.8" x2="3.1" y2="12.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Light
              </button>
            </div>
          </div>

          {/* Language */}
          <div className="tb-display-row">
            <span className="tb-display-label">Language</span>
            <div className="tb-display-seg">
              <button className={`tb-display-seg-btn${lang === 'en' ? ' active' : ''}`} onClick={() => onLang('en')}>EN</button>
              <button className={`tb-display-seg-btn${lang === 'fr' ? ' active' : ''}`} onClick={() => onLang('fr')}>FR</button>
            </div>
          </div>

          {/* Zoom */}
          <div className="tb-display-row">
            <span className="tb-display-label">Zoom</span>
            <div className="tb-display-zoom">
              <button className="tb-display-zoom-btn" onClick={() => onZoom(zoom - STEP)} disabled={zoom <= 0.5}>−</button>
              <button className="tb-display-zoom-val" onClick={() => onZoom(1)}>{zoomPct}%</button>
              <button className="tb-display-zoom-btn" onClick={() => onZoom(zoom + STEP)} disabled={zoom >= 2}>+</button>
            </div>
          </div>

          {/* Display mode */}
          <div className="tb-display-row">
            <span className="tb-display-label">View</span>
            <div className="tb-display-seg">
              <button className={`tb-display-seg-btn${displayMode === 'cards' ? ' active' : ''}`} onClick={() => onDisplayMode('cards')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>
                Cards
              </button>
              <button className={`tb-display-seg-btn${displayMode === 'table' ? ' active' : ''}`} onClick={() => onDisplayMode('table')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><line x1="1" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="1" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                Table
              </button>
            </div>
          </div>

          {/* Fullscreen */}
          <div className="tb-display-row">
            <span className="tb-display-label">Fullscreen</span>
            <button className="tb-display-action-btn" onClick={() => { onFullscreen(); setOpen(false); }}>
              {isFullscreen ? 'Exit' : 'Enter'}
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ marginLeft: 4 }}>
                {isFullscreen
                  ? <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  : <path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                }
              </svg>
            </button>
          </div>

          <div className="tb-display-divider" />

          {/* Help */}
          <button className="tb-display-help-btn" onClick={() => { onHelp(); setOpen(false); }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6.2 6.2c0-1 .8-1.7 1.8-1.7s1.8.7 1.8 1.7c0 .8-.5 1.3-1.2 1.7-.4.2-.6.5-.6.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11" r="0.7" fill="currentColor"/></svg>
            Help & guide
          </button>
        </div>
      )}
    </div>
  );
}

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

export default function TopBar({ onHelp, onSignOut, profile, isAdmin }) {
  const { state, dispatch } = useApp();
  const { isAdmin: canAdmin, isEditor, profile: authProfile } = useAuth();
  const canPublish = canAdmin || isEditor;
  const lang = state.settings?.lang || 'en';
  const theme = state.settings?.theme || 'dark';
  const workspace = state.workspace ?? 'library';
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [onlineCount, setOnlineCount] = useState(1);
  const presenceRef = useRef(null);
  const publishedCount = state.prompts?.filter(p => p.status === 'published').length || 0;
  const draftCount = state.prompts?.filter(p => p.status === 'draft').length || 0;
  const mineDraftCount = state.prompts?.filter(p => p.status === 'draft' && p.ownerId === authProfile?.id).length || 0;

  const allRequests = state.publishRequests || [];
  const myRequests = allRequests.filter(r => r.requester_id === authProfile?.id);
  // admin/editor: see all requests; viewer: only own
  const reqScope = canPublish ? allRequests : myRequests;
  const approvedCount = reqScope.filter(r => r.status === 'approved').length;
  const rejectedCount = reqScope.filter(r => r.status === 'rejected').length;
  const pendingCount = reqScope.filter(r => r.status === 'pending').length;
  const zoom = state.zoom ?? 1;
  const zoomPct = Math.round(zoom * 100);
  const { searchQuery, currentView, statusFilter } = state;
  const showSearch = currentView !== 'settings';

  useEffect(() => {
    function onChange() { setIsFullscreen(!!document.fullscreenElement); }
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase.channel('online-users', { config: { presence: { key: profile.id } } });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: profile.id, name: profile.display_name || profile.email });
        }
      });
    presenceRef.current = channel;
    return () => { channel.untrack(); supabase.removeChannel(channel); };
  }, [profile?.id]);

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

  function handleLangSet(newLang) {
    const updated = { ...state.settings, lang: newLang };
    StorageAPI.saveSettings(updated);
    dispatch({ type: 'SET_SETTINGS', payload: updated });
  }

  function handleThemeSet(newTheme) {
    const updated = { ...state.settings, theme: newTheme };
    StorageAPI.saveSettings(updated);
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    document.documentElement.dataset.theme = newTheme;
  }

  function handleThemeToggle() {
    handleThemeSet(theme === 'dark' ? 'light' : 'dark');
  }

  function handleKpiClick(status, ws) {
    if (statusFilter === status) {
      dispatch({ type: 'SET_STATUS_FILTER', payload: null });
      return;
    }
    if (ws) dispatch({ type: 'SET_WORKSPACE', payload: ws });
    dispatch({ type: 'SET_VIEW', payload: { view: 'all', filter: { storyFlow: null, solution: null, category: null }, statusFilter: status } });
  }

  function handleSettingsClick() {    if (state.currentView === 'settings') {
      dispatch({ type: 'SET_VIEW', payload: { view: 'all', filter: { storyFlow: null, solution: null, category: null } } });
    } else {
      dispatch({ type: 'SET_VIEW', payload: { view: 'settings' } });
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
          {/* KPIs — vary by role + workspace */}
          {canPublish ? (
            // Admin / editor: always show full set
            <>
              <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'published' ? ' active' : ''}`} onClick={() => handleKpiClick('published', 'library')}>
                <span className="tb-stat-dot" style={{ background: '#4ADE80', boxShadow: '0 0 6px #4ADE80' }} />
                {publishedCount} published
              </button>
              <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'draft' ? ' active' : ''}`} onClick={() => handleKpiClick('draft', 'library')}>
                <span className="tb-stat-dot" style={{ background: '#818CF8', boxShadow: '0 0 6px #818CF8' }} />
                {draftCount} draft
              </button>
              {canAdmin && (
                <div className="tb-stat-pill">
                  <span className="tb-stat-dot" style={{ background: '#F59E0B', boxShadow: '0 0 6px #F59E0B' }} />
                  {onlineCount} online
                </div>
              )}
              {pendingCount > 0 && (
                <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'pending' ? ' active' : ''}`} onClick={() => handleKpiClick('pending', 'library')}>
                  <span className="tb-stat-dot" style={{ background: '#D97706', boxShadow: '0 0 6px #D97706' }} />
                  {pendingCount} pending
                </button>
              )}
              {approvedCount > 0 && (
                <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'approved' ? ' active' : ''}`} onClick={() => handleKpiClick('approved', 'library')}>
                  <span className="tb-stat-dot" style={{ background: '#059669', boxShadow: '0 0 6px #059669' }} />
                  {approvedCount} approved
                </button>
              )}
              {rejectedCount > 0 && (
                <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'rejected' ? ' active' : ''}`} onClick={() => handleKpiClick('rejected', 'library')}>
                  <span className="tb-stat-dot" style={{ background: '#DC2626', boxShadow: '0 0 6px #DC2626' }} />
                  {rejectedCount} rejected
                </button>
              )}
            </>
          ) : workspace === 'library' ? (
            // Viewer, Library: published + total drafts
            <>
              <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'published' ? ' active' : ''}`} onClick={() => handleKpiClick('published', 'library')}>
                <span className="tb-stat-dot" style={{ background: '#4ADE80', boxShadow: '0 0 6px #4ADE80' }} />
                {publishedCount} published
              </button>
              <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'draft' ? ' active' : ''}`} onClick={() => handleKpiClick('draft', 'library')}>
                <span className="tb-stat-dot" style={{ background: '#818CF8', boxShadow: '0 0 6px #818CF8' }} />
                {draftCount} draft
              </button>
            </>
          ) : (
            // Viewer, Mine: draft (mine only) + pending/approved/rejected (own requests)
            <>
              <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'draft' && workspace === 'mine' ? ' active' : ''}`} onClick={() => handleKpiClick('draft', 'mine')}>
                <span className="tb-stat-dot" style={{ background: '#34D399', boxShadow: '0 0 6px #34D399' }} />
                {mineDraftCount} draft
              </button>
              {pendingCount > 0 && (
                <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'pending' ? ' active' : ''}`} onClick={() => handleKpiClick('pending', 'mine')}>
                  <span className="tb-stat-dot" style={{ background: '#D97706', boxShadow: '0 0 6px #D97706' }} />
                  {pendingCount} pending
                </button>
              )}
              {approvedCount > 0 && (
                <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'approved' ? ' active' : ''}`} onClick={() => handleKpiClick('approved', 'mine')}>
                  <span className="tb-stat-dot" style={{ background: '#059669', boxShadow: '0 0 6px #059669' }} />
                  {approvedCount} approved
                </button>
              )}
              {rejectedCount > 0 && (
                <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'rejected' ? ' active' : ''}`} onClick={() => handleKpiClick('rejected', 'mine')}>
                  <span className="tb-stat-dot" style={{ background: '#DC2626', boxShadow: '0 0 6px #DC2626' }} />
                  {rejectedCount} rejected
                </button>
              )}
            </>
          )}
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
            <div className={`workspace-seg ${workspace}`}>
              <button
                className="workspace-seg-btn"
                onClick={() => dispatch({ type: 'SET_WORKSPACE', payload: 'library' })}
              >Library</button>
              <button
                className="workspace-seg-btn"
                onClick={() => dispatch({ type: 'SET_WORKSPACE', payload: 'mine' })}
              >Mine</button>
            </div>
          </div>
        )}

        {/* Right — new, bell, user, display menu, settings */}
        <div id="top-bar-right">
          {(canPublish || workspace === 'mine') && (
            <button
              className="tb-btn tb-btn-primary"
              onClick={() => dispatch({ type: 'OPEN_MODAL', payload: undefined })}
            >
              {t('newPrompt', lang)}
            </button>
          )}
          <PublishRequestBell />
          <div className="tb-divider" />
          {profile && (
            <div className="tb-user-pill">
              <span className="tb-user-avatar">{(profile.display_name || profile.email || '?')[0].toUpperCase()}</span>
              <span className="tb-user-name">{profile.display_name || profile.email?.split('@')[0]}</span>
              {profile.role && <span className={`tb-user-role role-${profile.role}`}>{profile.role}</span>}
              <button className="tb-user-signout" onClick={onSignOut} title="Sign out">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )}
          <div className="tb-divider" />
          <DisplayMenu
            theme={theme}
            lang={lang}
            zoom={zoom}
            zoomPct={zoomPct}
            isFullscreen={isFullscreen}
            displayMode={state.displayMode ?? 'cards'}
            onTheme={handleThemeSet}
            onLang={handleLangSet}
            onZoom={z => dispatch({ type: 'SET_ZOOM', payload: z })}
            onFullscreen={handleFullscreen}
            onHelp={onHelp}
            onDisplayMode={m => dispatch({ type: 'SET_DISPLAY_MODE', payload: m })}
          />
          {canAdmin && (
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
          )}
        </div>
      </header>
    </>
  );
}
