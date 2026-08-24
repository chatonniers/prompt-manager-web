import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { supabase } from '../../lib/supabase.js';
import { t } from '../../lib/i18n.js';
import { JouleAgent } from '../../lib/jouleAgent.js';
import PublishRequestBell from '../shared/PublishRequestBell.jsx';
import JouleDiamond from '../shared/JouleDiamond.jsx';

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

export default function TopBar({ onHelp, onSignOut, profile, isAdmin, onHamburger }) {
  const { state, dispatch } = useApp();
  const { isAdmin: canAdmin, isEditor, profile: authProfile } = useAuth();
  const canPublish = canAdmin || isEditor;
  const lang = state.settings?.lang || 'en';
  const theme = state.settings?.theme || 'dark';
  const workspace = state.workspace ?? 'library';
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [onlineCount, setOnlineCount] = useState(1);
  const presenceRef = useRef(null);
  // null = unknown, 'ok' = agent up + Joule running, 'warn' = agent up but Joule not running, 'off' = agent not reachable
  const [jouleStatus, setJouleStatus] = useState(null);
  const visiblePrompts = (() => {
    const vr = state.catalog?.visibilityRules;
    const role = authProfile?.role || 'viewer';
    const roleKey = canAdmin ? 'admin' : isEditor ? 'editor' : 'viewer';
    const wsRules = vr?.[roleKey]?.[workspace];
    if (!wsRules) return state.prompts || [];
    return (state.prompts || []).filter(p => {
      if (!wsRules.statuses.includes(p.status)) return false;
      if (!wsRules.includePrivate && p.isPrivate) return false;
      return true;
    });
  })();
  const publishedCount = visiblePrompts.filter(p => p.status === 'published').length;
  const draftCount = visiblePrompts.filter(p => p.status === 'draft').length;
  const mineDraftCount = (state.prompts || []).filter(p => p.status === 'draft' && p.ownerId === authProfile?.id).length;

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

  const kpiRules = state.catalog?.kpiRules;
  const kpiRoleKey = canAdmin ? 'admin' : isEditor ? 'editor' : workspace === 'library' ? 'viewer_library' : 'viewer_mine';
  const allowedKpis = kpiRules?.[kpiRoleKey] ?? [];

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

  // Poll agent + Joule status when integration is enabled for this user
  useEffect(() => {
    if (!authProfile?.joule_integration) { setJouleStatus(null); return; }
    let cancelled = false;
    async function check() {
      try {
        const agentUp = await JouleAgent.isRunning();
        if (cancelled) return;
        if (!agentUp) { setJouleStatus('off'); return; }
        const status = await JouleAgent.jouleStatus();
        if (cancelled) return;
        setJouleStatus(status.running ? 'ok' : 'warn');
      } catch {
        if (!cancelled) setJouleStatus('off');
      }
    }
    check();
    const interval = setInterval(check, 8000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [authProfile?.joule_integration]);

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
          <button className="tb-hamburger" onClick={onHamburger} aria-label="Open navigation">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <line x1="2" y1="4.5" x2="16" y2="4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="2" y1="13.5" x2="16" y2="13.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
          <div id="app-title" onClick={() => dispatch({ type: 'SET_VIEW', payload: { view: 'all', filter: { storyFlow: null, solution: null, category: null } } })}>
            <LogoMark />
            <div className="app-wordmark">
              <span className="title-main">{t('appTitle', lang)}</span>
            </div>
          </div>
          {/* KPIs — driven by kpiRules from settings */}
          {allowedKpis.includes('users') && canAdmin && (
            <div className="tb-stat-pill">
              <span className="tb-stat-dot" style={{ background: '#F59E0B', boxShadow: '0 0 6px #F59E0B' }} />
              {onlineCount} users
            </div>
          )}
          {allowedKpis.includes('published') && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'published' ? ' active' : ''}`} onClick={() => handleKpiClick('published', 'library')}>
              <span className="tb-stat-dot" style={{ background: '#4ADE80', boxShadow: '0 0 6px #4ADE80' }} />
              {publishedCount} published
            </button>
          )}
          {allowedKpis.includes('draft') && (
            <button
              className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'draft' ? ' active' : ''}`}
              onClick={() => handleKpiClick('draft', canPublish ? 'library' : workspace === 'mine' ? 'mine' : 'library')}
            >
              <span className="tb-stat-dot" style={{ background: workspace === 'mine' && !canPublish ? '#34D399' : '#818CF8', boxShadow: `0 0 6px ${workspace === 'mine' && !canPublish ? '#34D399' : '#818CF8'}` }} />
              {workspace === 'mine' && !canPublish ? mineDraftCount : draftCount} draft
            </button>
          )}
          {allowedKpis.includes('pending') && pendingCount > 0 && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'pending' ? ' active' : ''}`} onClick={() => handleKpiClick('pending', canPublish ? 'library' : 'mine')}>
              <span className="tb-stat-dot" style={{ background: '#D97706', boxShadow: '0 0 6px #D97706' }} />
              {pendingCount} pending
            </button>
          )}
          {allowedKpis.includes('approved') && approvedCount > 0 && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'approved' ? ' active' : ''}`} onClick={() => handleKpiClick('approved', canPublish ? 'library' : 'mine')}>
              <span className="tb-stat-dot" style={{ background: '#059669', boxShadow: '0 0 6px #059669' }} />
              {approvedCount} approved
            </button>
          )}
          {allowedKpis.includes('rejected') && rejectedCount > 0 && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'rejected' ? ' active' : ''}`} onClick={() => handleKpiClick('rejected', canPublish ? 'library' : 'mine')}>
              <span className="tb-stat-dot" style={{ background: '#DC2626', boxShadow: '0 0 6px #DC2626' }} />
              {rejectedCount} rejected
            </button>
          )}
        </div>

        {/* Center — search + zoom + new */}
        {showSearch && (
          <div id="top-bar-center">
            <span className="tb-beta-badge">BETA</span>
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
                onClick={() => { if (workspace !== 'library') { dispatch({ type: 'SET_WORKSPACE', payload: 'library' }); dispatch({ type: 'SHOW_TOAST', payload: t('switchedToLibrary', lang) }); } }}
              >Library</button>
              <button
                className="workspace-seg-btn"
                onClick={() => { if (workspace !== 'mine') { dispatch({ type: 'SET_WORKSPACE', payload: 'mine' }); dispatch({ type: 'SHOW_TOAST', payload: t('switchedToMine', lang) }); } }}
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
          {/* Joule status indicator — read from profile, set by admin in User Management */}
          {authProfile?.joule_integration && (
            <span
              className={`tb-joule-toggle active`}
              title={
                jouleStatus === 'ok'   ? 'Joule Desktop integration enabled — agent & Joule running' :
                jouleStatus === 'warn' ? 'Joule Desktop integration enabled — agent running, Joule not open' :
                jouleStatus === 'off'  ? 'Joule Desktop integration enabled — agent not running' :
                'Joule Desktop integration enabled'
              }
              style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 8, border: '1px solid rgba(109,40,217,0.5)', background: 'rgba(109,40,217,0.12)', cursor: 'default' }}
            >
              <span className="tb-joule-wrap">
                <JouleDiamond size={15} />
                {jouleStatus && (
                  <span className={`tb-joule-dot tb-joule-dot--${jouleStatus}`} />
                )}
              </span>
            </span>
          )}
          {/* Settings gear — always last */}
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
