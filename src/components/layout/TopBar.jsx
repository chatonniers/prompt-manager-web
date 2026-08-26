import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { supabase } from '../../lib/supabase.js';
import { t, tl } from '../../lib/i18n.js';
import { JouleAgent } from '../../lib/jouleAgent.js';
import PublishRequestBell from '../shared/PublishRequestBell.jsx';
import JouleDiamond from '../shared/JouleDiamond.jsx';
import JouleSkillModal from '../shared/JouleSkillModal.jsx';

const STEP = 0.1;

const MCP_URL = 'https://promptdeck-mcp.cfapps.eu10.hana.ondemand.com/mcp';

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

function WorkspaceSwitchPopover({ target, anchor, onConfirm, onCancel, lang }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onCancel(); }
    function onDown(e) { if (!e.target.closest('.ws-switch-popover')) onCancel(); }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [onCancel]);
  const isLibrary = target === 'library';
  const title = isLibrary ? t('wsSwitchToLibraryTitle', lang) : t('wsSwitchToMineTitle', lang);
  const desc  = isLibrary ? t('wsSwitchToLibraryDesc',  lang) : t('wsSwitchToMineDesc',  lang);
  return createPortal(
    <div className="ws-switch-popover" style={{ left: anchor.x, top: anchor.y }}>
      <div className="ws-switch-popover-title">{title}</div>
      <div className="ws-switch-popover-desc">{desc}</div>
      <div className="ws-switch-popover-actions">
        <button className="action-btn" onClick={onCancel}>{t('wsSwitchNo', lang)}</button>
        <button className="action-btn primary" onClick={onConfirm}>{t('wsSwitchYes', lang)}</button>
      </div>
    </div>,
    document.body
  );
}

function UserProfileMenu({ profile, onSignOut, refreshProfile, solutions, theme, lang, zoom, zoomPct, displayMode, onTheme, onLang, onZoom, onDisplayMode, onHelp, jouleIntegration, onLaunchJoule, settings, onSettingsChange }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(profile?.display_name || '');
  const [domains, setDomains] = useState(profile?.domain_expertise || []);
  const ref = useRef(null);

  useEffect(() => {
    setName(profile?.display_name || '');
    setDomains(profile?.domain_expertise || []);
  }, [profile?.display_name, profile?.domain_expertise]);

  useEffect(() => {
    if (!open) return;
    function close(e) { if (!ref.current?.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  function toggleDomain(sol) {
    setDomains(d => d.includes(sol) ? d.filter(x => x !== sol) : [...d, sol]);
  }

  async function saveName() {
    const trimmed = name.trim() || null;
    if (trimmed === (profile?.display_name || null)) return;
    await supabase.from('profiles').update({ display_name: trimmed }).eq('id', profile.id);
    await refreshProfile();
  }

  async function handleDomainToggle(sol) {
    const next = domains.includes(sol) ? domains.filter(x => x !== sol) : [...domains, sol];
    setDomains(next);
    await supabase.from('profiles').update({ domain_expertise: next }).eq('id', profile.id);
    await refreshProfile();
  }

  return (
    <div ref={ref} className="tb-user-wrap">
      <button className="tb-user-pill tb-user-pill-btn" onClick={() => setOpen(o => !o)} title="Profile & preferences">
        <span className="tb-user-avatar">{(profile.display_name || profile.email || '?')[0].toUpperCase()}</span>
        {profile.role && <span className={`tb-user-role role-${profile.role}`}>{profile.role}</span>}
      </button>
      {open && (
        <div className="tb-profile-panel">
          {/* Header with sign-out */}
          <div className="tb-profile-header">
            <span className="tb-profile-title">{t('editProfile', lang)}</span>
            <button className="tb-profile-logout" onClick={onSignOut} title={t('signOut', lang)}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {t('signOut', lang)}
            </button>
          </div>

          {/* Display name — auto-save on blur */}
          <div className="tb-profile-field">
            <label className="tb-profile-label">{t('displayName', lang)}</label>
            <input
              className="tb-profile-input"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              placeholder={t('yourName', lang)}
            />
          </div>

          {/* Domain expertise — pills, auto-save on toggle */}
          <div className="tb-profile-field">
            <label className="tb-profile-label">{t('domainExpertise', lang)}</label>
            {solutions.length > 0 ? (
              <div className="tb-profile-domain-pills">
                {solutions.map(sol => {
                  const solKey = typeof sol === 'object' ? sol.en : sol;
                  return (
                    <button
                      key={solKey}
                      className={`domain-pill${domains.includes(solKey) ? ' active' : ''}`}
                      onClick={() => handleDomainToggle(solKey)}
                    >
                      {tl(sol, lang)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="tb-profile-sol-empty">{t('noDomainsYet', lang)}</span>
            )}
          </div>

          {/* Preferences */}
          <div className="tb-display-divider" style={{ margin: '10px 0' }} />
          <div className="tb-profile-pref-title">{t('preferences', lang)}</div>

          <div className="tb-display-row">
            <span className="tb-display-label">{t('themeLabel', lang)}</span>
            <div className="tb-display-seg">
              <button className={`tb-display-seg-btn${theme === 'dark' ? ' active' : ''}`} onClick={() => onTheme('dark')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {t('themeDark', lang)}
              </button>
              <button className={`tb-display-seg-btn${theme === 'light' ? ' active' : ''}`} onClick={() => onTheme('light')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4"/><line x1="8" y1="1" x2="8" y2="2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="8" y1="13.5" x2="8" y2="15" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="1" y1="8" x2="2.5" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="13.5" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="3.1" y1="3.1" x2="4.2" y2="4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="11.8" y1="11.8" x2="12.9" y2="12.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="12.9" y1="3.1" x2="11.8" y2="4.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="4.2" y1="11.8" x2="3.1" y2="12.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                {t('themeLight', lang)}
              </button>
            </div>
          </div>

          <div className="tb-display-row">
            <span className="tb-display-label">{t('languageLabel', lang)}</span>
            <div className="tb-display-seg">
              <button className={`tb-display-seg-btn${lang === 'en' ? ' active' : ''}`} onClick={() => onLang('en')}>EN</button>
              <button className={`tb-display-seg-btn${lang === 'fr' ? ' active' : ''}`} onClick={() => onLang('fr')}>FR</button>
            </div>
          </div>

          <div className="tb-display-row">
            <span className="tb-display-label">{t('zoomLabel', lang)}</span>
            <div className="tb-display-zoom">
              <button className="tb-display-zoom-btn" onClick={() => onZoom(zoom - STEP)} disabled={zoom <= 0.5}>−</button>
              <button className="tb-display-zoom-val" onClick={() => onZoom(1)}>{zoomPct}%</button>
              <button className="tb-display-zoom-btn" onClick={() => onZoom(zoom + STEP)} disabled={zoom >= 2}>+</button>
            </div>
          </div>

          <div className="tb-display-row">
            <span className="tb-display-label">{t('viewLabel', lang)}</span>
            <div className="tb-display-seg">
              <button className={`tb-display-seg-btn${displayMode === 'cards' ? ' active' : ''}`} onClick={() => onDisplayMode('cards')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>
                {t('viewCards', lang)}
              </button>
              <button className={`tb-display-seg-btn${displayMode === 'table' ? ' active' : ''}`} onClick={() => onDisplayMode('table')}>
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><line x1="1" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><line x1="1" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                {t('viewTable', lang)}
              </button>
            </div>
          </div>

          <div className="tb-display-row">
            <span className="tb-display-label">{t('spaceWarning', lang)}</span>
            <button
              className={`tb-display-seg-btn${settings?.warnOnWorkspaceSwitch !== false ? ' active' : ''}`}
              onClick={() => onSettingsChange({ warnOnWorkspaceSwitch: !(settings?.warnOnWorkspaceSwitch !== false) })}
            >
              {settings?.warnOnWorkspaceSwitch !== false ? t('spaceWarningOn', lang) : t('spaceWarningOff', lang)}
            </button>
          </div>

          {/* Additional */}
          <div className="tb-display-divider" style={{ margin: '10px 0' }} />
          <div className="tb-profile-pref-title">{t('additional', lang)}</div>

          <button className="tb-display-help-btn" onClick={() => { onHelp(); setOpen(false); }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M6.2 6.2c0-1 .8-1.7 1.8-1.7s1.8.7 1.8 1.7c0 .8-.5 1.3-1.2 1.7-.4.2-.6.5-.6.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="8" cy="11" r="0.7" fill="currentColor"/></svg>
            {t('helpGuide', lang)}
          </button>

          {jouleIntegration && (
            <>
              <button className="tb-display-help-btn tb-display-joule-btn" style={{ marginTop: 4 }} onClick={() => { onLaunchJoule(); setOpen(false); }}>
                <svg width="13" height="13" viewBox="526 513 997 922" xmlns="http://www.w3.org/2000/svg">
                  <path fill="rgb(109,40,217)" d="M 1000.05 513.879 C 1014.25 513.687 1029.4 514.204 1043.27 513.82 L 1238.35 513.952 C 1272.98 513.966 1309.42 513.392 1343.82 514.153 C 1354.31 517.46 1357.73 520.221 1364.26 529.563 C 1403.94 583.338 1441.45 639.282 1481.23 693.071 C 1492.33 708.089 1505.89 725.77 1515.8 741.387 C 1521.5 751.464 1522.96 756.801 1517.41 767.824 C 1509.05 780.949 1495.32 798.09 1485.6 811.392 L 1422.62 897.905 L 1238.16 1151.03 L 1094.85 1347.5 C 1082.51 1364.22 1070.32 1381.06 1058.28 1397.99 C 1053.74 1404.35 1043.51 1419.58 1038.73 1425.11 C 1037.85 1426.54 1035.58 1429.13 1034.29 1430.18 C 1030.34 1433.48 1025.15 1434.87 1020.08 1434.01 C 1011.29 1432.6 1007.1 1427.8 1002.35 1421.1 C 993.664 1410.86 978.546 1388.93 970.26 1377.62 L 901.008 1282.12 L 724.522 1040.01 L 588.844 854.034 L 549.259 800.138 C 541.805 790.016 532.73 778.524 526.301 767.975 C 522.411 757.891 522.616 750.772 527.711 741.387 C 575.944 671.294 629.184 600.336 678.602 530.269 C 685.984 520.85 688.914 517.888 700.211 514.182 C 734.74 512.965 774.86 513.934 809.772 513.929 L 1000.05 513.879 z"/>
                </svg>
                {t('launchJoule', lang)}
              </button>
              <div className="tb-display-mcp-block" style={{ marginTop: 8 }}>
                <div className="tb-display-mcp-title">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  {t('promptDeckMcp', lang)}
                </div>
                <div className="tb-display-mcp-desc">{t('mcpConnectors', lang)}</div>
                <div className="tb-display-mcp-url" title={MCP_URL}>
                  <code>{MCP_URL}</code>
                  <button className="tb-display-mcp-copy" title={t('copyMcpUrl', lang)} onClick={() => { navigator.clipboard.writeText(MCP_URL); }}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="5" y="1" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M3 4H2a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ onHelp, onSignOut, profile, isAdmin, onHamburger }) {
  const { state, dispatch } = useApp();
  const { isAdmin: canAdmin, isEditor, profile: authProfile, refreshProfile } = useAuth();
  const canPublish = canAdmin || isEditor;
  const lang = state.settings?.lang || 'en';
  const theme = state.settings?.theme || 'dark';
  const workspace = state.workspace ?? 'library';
  const [onlineCount, setOnlineCount] = useState(1);
  const presenceRef = useRef(null);
  // null = unknown, 'ok' = agent up + Joule running, 'warn' = agent up but Joule not running, 'off' = agent not reachable
  const [jouleStatus, setJouleStatus] = useState(null);
  const [jouleConnected, setJouleConnected] = useState(false);
  const [jouleToggling, setJouleToggling] = useState(false);
  const [showAgentSetup, setShowAgentSetup] = useState(false);
  const [switchTarget, setSwitchTarget] = useState(null);
  const [switchAnchor, setSwitchAnchor] = useState(null);
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

  // Sync connected state from profile
  useEffect(() => {
    setJouleConnected(!!authProfile?.joule_connected);
  }, [authProfile?.joule_connected]);

  // Poll agent + Joule status when integration is enabled AND user is connected
  useEffect(() => {
    if (!authProfile?.joule_integration || !jouleConnected) { setJouleStatus(null); return; }
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
  }, [authProfile?.joule_integration, jouleConnected]);

  async function handleJouleToggle() {
    if (!authProfile?.joule_integration || jouleToggling) return;
    const newVal = !jouleConnected;
    setJouleToggling(true);
    setJouleConnected(newVal);
    if (!newVal) {
      setJouleStatus(null);
      // Only shut down if agent is actually reachable
      JouleAgent.isRunning().then(running => { if (running) JouleAgent.shutdown(); }).catch(() => {});
    } else {
      // Check agent is reachable; if not, open setup guide
      try {
        const running = await JouleAgent.isRunning();
        if (!running) setShowAgentSetup(true);
      } catch { setShowAgentSetup(true); }
    }
    await supabase.from('profiles').update({ joule_connected: newVal }).eq('id', authProfile.id);
    await refreshProfile();
    setJouleToggling(false);
  }

  async function handleLaunchJoule() {
    try {
      await JouleAgent.launchJoule();
    } catch {
      dispatch({ type: 'SHOW_TOAST', payload: 'Could not reach PromptDeck Agent — is it running?' });
    }
  }

  async function handleLangSet(newLang) {
    const updated = { ...state.settings, lang: newLang };
    StorageAPI.saveSettings(updated);
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    if (authProfile?.id) {
      await supabase.from('profiles').update({ lang: newLang }).eq('id', authProfile.id);
    }
  }

  function handleThemeSet(newTheme) {
    const updated = { ...state.settings, theme: newTheme };
    StorageAPI.saveSettings(updated);
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    document.documentElement.dataset.theme = newTheme;
  }

  function doSwitchWorkspace(ws) {
    dispatch({ type: 'SET_WORKSPACE', payload: ws });
    dispatch({ type: 'SHOW_TOAST', payload: t(ws === 'library' ? 'switchedToLibrary' : 'switchedToMine', lang) });
    setSwitchTarget(null);
  }

  function handleWorkspaceClick(e, ws) {
    if (workspace === ws) return;
    const warn = state.settings?.warnOnWorkspaceSwitch !== false;
    if (warn) {
      const r = e.currentTarget.getBoundingClientRect();
      setSwitchAnchor({ x: r.left + r.width / 2, y: r.bottom + 8 });
      setSwitchTarget(ws);
    } else {
      doSwitchWorkspace(ws);
    }
  }

  function handleSettingsChange(patch) {
    const updated = { ...state.settings, ...patch };
    StorageAPI.saveSettings(updated);
    dispatch({ type: 'SET_SETTINGS', payload: updated });
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
              {onlineCount} {t('visibilityPublic', lang).toLowerCase()}
            </div>
          )}
          {allowedKpis.includes('published') && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'published' ? ' active' : ''}`} onClick={() => handleKpiClick('published', 'library')}>
              <span className="tb-stat-dot" style={{ background: '#4ADE80', boxShadow: '0 0 6px #4ADE80' }} />
              {publishedCount} {t('statusPublished', lang).toLowerCase()}
            </button>
          )}
          {allowedKpis.includes('draft') && (
            <button
              className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'draft' ? ' active' : ''}`}
              onClick={() => handleKpiClick('draft', canPublish ? 'library' : workspace === 'mine' ? 'mine' : 'library')}
            >
              <span className="tb-stat-dot" style={{ background: workspace === 'mine' && !canPublish ? '#34D399' : '#818CF8', boxShadow: `0 0 6px ${workspace === 'mine' && !canPublish ? '#34D399' : '#818CF8'}` }} />
              {workspace === 'mine' && !canPublish ? mineDraftCount : draftCount} {t('statusDraft', lang).toLowerCase()}
            </button>
          )}
          {allowedKpis.includes('pending') && pendingCount > 0 && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'pending' ? ' active' : ''}`} onClick={() => handleKpiClick('pending', canPublish ? 'library' : 'mine')}>
              <span className="tb-stat-dot" style={{ background: '#D97706', boxShadow: '0 0 6px #D97706' }} />
              {pendingCount} {t('reqPending', lang).toLowerCase()}
            </button>
          )}
          {allowedKpis.includes('approved') && approvedCount > 0 && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'approved' ? ' active' : ''}`} onClick={() => handleKpiClick('approved', canPublish ? 'library' : 'mine')}>
              <span className="tb-stat-dot" style={{ background: '#059669', boxShadow: '0 0 6px #059669' }} />
              {approvedCount} {t('reqApproved', lang).toLowerCase()}
            </button>
          )}
          {allowedKpis.includes('rejected') && rejectedCount > 0 && (
            <button className={`tb-stat-pill tb-stat-pill-btn${statusFilter === 'rejected' ? ' active' : ''}`} onClick={() => handleKpiClick('rejected', canPublish ? 'library' : 'mine')}>
              <span className="tb-stat-dot" style={{ background: '#DC2626', boxShadow: '0 0 6px #DC2626' }} />
              {rejectedCount} {t('reqRejected', lang).toLowerCase()}
            </button>
          )}
        </div>

        {/* Center — search + zoom + new */}
        {showSearch && (
          <div id="top-bar-center">
            <span className="tb-beta-badge">{t('betaBadge', lang)}</span>
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
                onClick={e => handleWorkspaceClick(e, 'library')}
              >{t('wsLibrary', lang)}</button>
              <button
                className="workspace-seg-btn"
                onClick={e => handleWorkspaceClick(e, 'mine')}
              >{t('wsMyPrompts', lang)}</button>
            </div>
          </div>
        )}

        {/* Right — new, bell, joule, user, settings */}
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
          {/* Joule connect/disconnect toggle — visible when admin has enabled integration for this user */}
          {authProfile?.joule_integration && (
            <button
              className={`tb-joule-toggle${jouleConnected ? ' active' : ''}`}
              onClick={handleJouleToggle}
              disabled={jouleToggling}
              title={
                jouleConnected
                  ? jouleStatus === 'ok'   ? 'Joule connected — agent & Joule running. Click to disconnect.' :
                    jouleStatus === 'warn' ? 'Joule connected — agent running, Joule not open. Click to disconnect.' :
                    jouleStatus === 'off'  ? 'Joule connected — agent not reachable. Click to disconnect.' :
                    'Joule connected. Click to disconnect.'
                  : 'Joule Desktop integration available. Click to connect.'
              }
              style={{ display: 'inline-flex', alignItems: 'center', padding: '7px 10px', borderRadius: 8, cursor: 'pointer' }}
            >
              <span className="tb-joule-wrap">
                <JouleDiamond size={15} />
                {jouleConnected && jouleStatus && (
                  <span className={`tb-joule-dot tb-joule-dot--${jouleStatus}`} />
                )}
                {!jouleConnected && (
                  <span className="tb-joule-dot tb-joule-dot--off" style={{ opacity: 0.5 }} />
                )}
              </span>
            </button>
          )}
          {profile && (
            <UserProfileMenu
              profile={profile}
              onSignOut={onSignOut}
              refreshProfile={refreshProfile}
              solutions={state.catalog?.categories || []}
              theme={theme}
              lang={lang}
              zoom={zoom}
              zoomPct={zoomPct}
              displayMode={state.displayMode ?? 'cards'}
              onTheme={handleThemeSet}
              onLang={handleLangSet}
              onZoom={z => dispatch({ type: 'SET_ZOOM', payload: z })}
              onDisplayMode={m => dispatch({ type: 'SET_DISPLAY_MODE', payload: m })}
              onHelp={onHelp}
              jouleIntegration={!!authProfile?.joule_integration}
              onLaunchJoule={handleLaunchJoule}
              settings={state.settings}
              onSettingsChange={handleSettingsChange}
            />
          )}
          {/* Settings gear — always last */}
          {canAdmin && (
          <button
            className={`tb-btn tb-btn-icon${state.currentView === 'settings' ? ' tb-btn-active' : ''}`}
            onClick={handleSettingsClick}
            title={t('settings', lang)}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
              <line x1="1" y1="4" x2="10" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="13" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="11.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <line x1="1" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="7" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="5.5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <line x1="1" y1="12" x2="10" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <line x1="13" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <circle cx="11.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </button>
          )}
        </div>
      </header>
      {switchTarget && (
        <WorkspaceSwitchPopover
          target={switchTarget}
          anchor={switchAnchor}
          lang={lang}
          onConfirm={() => doSwitchWorkspace(switchTarget)}
          onCancel={() => setSwitchTarget(null)}
        />
      )}
      {showAgentSetup && (
        <JouleSkillModal
          skillName={null}
          skillContent={null}
          promptText={null}
          setupOnly
          onClose={() => setShowAgentSetup(false)}
        />
      )}
    </>
  );
}
