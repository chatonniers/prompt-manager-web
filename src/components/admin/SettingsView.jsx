import { useRef, useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { supabase } from '../../lib/supabase.js';
import { t } from '../../lib/i18n.js';
import AdminCatalogCard from './AdminCatalogCard.jsx';
import AdminCategoriesCard from './AdminCategoriesCard.jsx';
import AdminSystemsCard from './AdminSystemsCard.jsx';
import AdminAssistantsCard from './AdminAssistantsCard.jsx';
import AdminVisibilityCard from './AdminVisibilityCard.jsx';
import ImportModeModal from '../shared/ImportModeModal.jsx';
import UserManagement from './UserManagement.jsx';
import AdminStatsView from './AdminStatsView.jsx';

const FUNCTIONAL_SECTIONS = [
  { id: 'assistants', labelKey: 'assistantsAdmin' },
  { id: 'categories', labelKey: 'categoriesAdmin' },
  { id: 'flows',      labelKey: 'flowsAdmin' },
  { id: 'industries', labelKey: 'industriesAdmin' },
  { id: 'personas',   labelKey: 'personasAdmin' },
  { id: 'solutions',  labelKey: 'solutionsAdmin' },
  { id: 'systems',    labelKey: 'systemsAdmin' },
];

const TECHNICAL_SECTIONS = [
  { id: 'import-export', labelKey: 'importExport' },
];

const ADMIN_TECHNICAL_SECTIONS = [
  { id: 'system',     labelKey: null, label: 'System' },
  { id: 'users',      labelKey: null, label: 'Users' },
  { id: 'visibility', labelKey: null, label: 'Visibility Rules' },
];

const STATS_SECTIONS = [
  { id: 'stats', labelKey: null, label: 'Statistics' },
];

export default function SettingsView() {
  const { state, dispatch } = useApp();
  const { isAdmin, broadcastRefresh, broadcastMessage } = useAuth();
  const lang = state.settings?.lang || 'en';
  const [activeSection, setActiveSection] = useState(state.settingsSection || 'categories');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const navSearchRef = useRef(null);

  // Message composer state
  const [msgText, setMsgText] = useState('');
  const [msgTargetAll, setMsgTargetAll] = useState(true);
  const [msgSelectedUsers, setMsgSelectedUsers] = useState(new Set());
  const [msgUsers, setMsgUsers] = useState([]);
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  const MSG_TEMPLATES = [
    { label: 'New content available', text: 'New prompts have been published — please refresh to see the latest content.' },
    { label: 'Maintenance soon', text: 'The app will undergo maintenance shortly. Please save your work and refresh after 10 minutes.' },
    { label: 'Update deployed', text: 'A new version has been deployed with improvements. Please refresh your browser to get the latest features.' },
    { label: 'Custom…', text: '' },
  ];

  useEffect(() => {
    if (activeSection === 'system' && isAdmin) {
      supabase.from('profiles').select('id, display_name, email, role').then(({ data }) => {
        if (data) setMsgUsers(data.filter(u => u.role !== 'blocked'));
      });
    }
  }, [activeSection, isAdmin]);

  async function handleSendMessage() {
    if (!msgText.trim()) return;
    setMsgSending(true);
    const targetIds = msgTargetAll ? null : [...msgSelectedUsers];
    if (targetIds === null || targetIds.length === 0) {
      await broadcastMessage(msgText.trim());
    } else {
      await broadcastMessage(msgText.trim(), targetIds);
    }
    setMsgSending(false);
    setMsgSent(true);
    dispatch({ type: 'SHOW_TOAST', payload: `Message sent to ${msgTargetAll ? 'all users' : `${msgSelectedUsers.size} user(s)`}.` });
    setTimeout(() => setMsgSent(false), 3000);
  }

  const allSections = [
    ...FUNCTIONAL_SECTIONS,
    ...TECHNICAL_SECTIONS,
    ...(isAdmin ? ADMIN_TECHNICAL_SECTIONS : []),
    ...(isAdmin ? STATS_SECTIONS : []),
  ];

  const filteredSections = useMemo(() => {
    const q = navSearch.trim().toLowerCase();
    if (!q) return null;
    return allSections.filter(sec => {
      const label = sec.labelKey ? t(sec.labelKey, lang) : sec.label;
      return label.toLowerCase().includes(q);
    });
  }, [navSearch, lang, isAdmin]);

  const fileRef = useRef(null);
  const [importData, setImportData] = useState(null);
  const [importStatus, setImportStatus] = useState(null);

  function handleExport() {
    StorageAPI.exportAll().then(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'prompts.json'; a.click();
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
        setImportStatus({ ok: false, msg: 'Import failed — invalid file.' });
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
      const msg = t('importOk', lang, result.imported, result.skipped);
      setImportStatus({ ok: true, msg });
      dispatch({ type: 'SHOW_TOAST', payload: msg });
    } catch {
      setImportStatus({ ok: false, msg: 'Import failed — invalid file.' });
    }
    setImportData(null);
  }

  function NavSection({ sections, label }) {
    const visible = filteredSections
      ? sections.filter(s => filteredSections.some(f => f.id === s.id))
      : sections;
    if (visible.length === 0) return null;
    return (
      <>
        {label && <div className="settings-nav-group-label">{label}</div>}
        {visible.map(sec => (
          <button
            key={sec.id}
            className={`settings-nav-item${activeSection === sec.id ? ' active' : ''}`}
            onClick={() => { setActiveSection(sec.id); setNavSearch(''); }}
          >
            {sec.labelKey ? t(sec.labelKey, lang) : sec.label}
          </button>
        ))}
      </>
    );
  }

  return (
    <div id="view-settings">
      <div className="settings-layout">

        {/* Left nav */}
        <nav className="settings-nav">
          <div className="settings-nav-search-wrap">
            <input
              ref={navSearchRef}
              className="settings-nav-search"
              type="text"
              placeholder="Search settings…"
              value={navSearch}
              onChange={e => {
                const val = e.target.value;
                setNavSearch(val);
                // Auto-navigate when exactly one result
                const q = val.trim().toLowerCase();
                if (q) {
                  const matches = allSections.filter(sec => {
                    const label = sec.labelKey ? t(sec.labelKey, lang) : sec.label;
                    return label.toLowerCase().includes(q);
                  });
                  if (matches.length === 1) setActiveSection(matches[0].id);
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') { setNavSearch(''); navSearchRef.current?.blur(); }
                if (e.key === 'Enter' && filteredSections?.length >= 1) {
                  setActiveSection(filteredSections[0].id);
                  setNavSearch('');
                }
              }}
            />
            {navSearch && (
              <button className="settings-nav-search-clear" onClick={() => { setNavSearch(''); navSearchRef.current?.focus(); }}>×</button>
            )}
          </div>
          <NavSection sections={FUNCTIONAL_SECTIONS} label={navSearch ? null : 'Functional Parameters'} />
          <div className="settings-nav-divider" />
          <NavSection sections={TECHNICAL_SECTIONS} label={navSearch ? null : 'Data'} />
          {isAdmin && (
            <>
              <div className="settings-nav-divider" />
              <NavSection sections={ADMIN_TECHNICAL_SECTIONS} label={navSearch ? null : 'Admin'} />
              <div className="settings-nav-divider" />
              <NavSection sections={STATS_SECTIONS} label={navSearch ? null : 'Analytics'} />
            </>
          )}
        </nav>

        {/* Panel */}
        <div className="settings-panel">

          {activeSection === 'categories' && <AdminCategoriesCard />}

          {activeSection === 'import-export' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="view-card">
                <h2>{t('exportTitle', lang)}</h2>
                <p>{t('exportDesc', lang)}</p>
                <button className="action-btn primary" onClick={handleExport}>{t('exportBtn', lang)}</button>
              </div>
              <div className="view-card">
                <h2>{t('importTitle', lang)}</h2>
                <p>{t('importDesc', lang)}</p>
                <button className="action-btn" onClick={() => fileRef.current?.click()}>{t('importBtn', lang)}</button>
                <input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={handleImportFile} />
                {importStatus && (
                  <div className={`import-status${importStatus.ok ? '' : ' import-error'}`} style={{ marginTop: 12 }}>
                    {importStatus.msg}
                  </div>
                )}
              </div>
              {importData && (
                <ImportModeModal
                  data={importData}
                  existingCount={state.prompts.length}
                  lang={lang}
                  onConfirm={handleImportConfirm}
                  onClose={() => setImportData(null)}
                />
              )}
            </div>
          )}

          {activeSection === 'personas' && (
            <AdminCatalogCard
              titleKey="personasAdmin"
              descKey="personasDesc"
              addKey="addPersona"
              items={state.catalog.personas || []}
              promptField="personas"
              isArray
            />
          )}

          {activeSection === 'systems' && <AdminSystemsCard />}
          {activeSection === 'assistants' && <AdminAssistantsCard />}

          {activeSection === 'industries' && (
            <AdminCatalogCard
              titleKey="industriesAdmin"
              descKey="industriesDesc"
              addKey="addIndustry"
              items={state.catalog.industries || []}
              promptField="industry"
              isArray={false}
            />
          )}

          {activeSection === 'solutions' && (
            <AdminCatalogCard
              titleKey="solutionsAdmin"
              descKey="solutionsDesc"
              addKey="addSolution"
              items={state.catalog.solutions}
              promptField="solutions"
              isArray
            />
          )}

          {activeSection === 'flows' && (
            <AdminCatalogCard
              titleKey="flowsAdmin"
              descKey="flowsDesc"
              addKey="addFlow"
              items={state.catalog.storyFlows}
              promptField="storyFlow"
              isArray={false}
            />
          )}

          {activeSection === 'users' && <div className="view-card"><UserManagement /></div>}
          {activeSection === 'stats' && <AdminStatsView />}
          {activeSection === 'visibility' && <AdminVisibilityCard />}

          {activeSection === 'system' && isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Message Composer */}
              <div className="view-card">
                <h2>Send Message to Users</h2>
                <p style={{ fontSize: 13, color: 'var(--pm-text2)', marginBottom: 16 }}>
                  Send a notification banner to connected users. Choose a template or write a custom message.
                </p>

                {/* Templates */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Templates</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {MSG_TEMPLATES.map(tpl => (
                      <button key={tpl.label} className="admin-sort-btn"
                        onClick={() => tpl.text ? setMsgText(tpl.text) : setMsgText('')}
                        style={{ fontSize: 11 }}>
                        {tpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message text */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Message</div>
                  <textarea
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                    rows={3}
                    placeholder="Type your message…"
                    style={{ width: '100%', resize: 'vertical', borderRadius: 8, border: '1.5px solid var(--pm-border2)', padding: '8px 12px', fontFamily: 'inherit', fontSize: 13, background: 'var(--pm-surface)', color: 'var(--pm-text)', outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--pm-text3)', textAlign: 'right', marginTop: 2 }}>{msgText.length} chars</div>
                </div>

                {/* Recipients */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm-text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>Recipients</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <button
                      className={`card-privacy-btn${msgTargetAll ? ' active shared' : ''}`}
                      onClick={() => setMsgTargetAll(true)}
                    >All users</button>
                    <button
                      className={`card-privacy-btn${!msgTargetAll ? ' active private' : ''}`}
                      onClick={() => setMsgTargetAll(false)}
                    >Select users</button>
                  </div>
                  {!msgTargetAll && (
                    <div style={{ border: '1px solid var(--pm-border2)', borderRadius: 8, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                      <div
                        style={{ padding: '6px 12px', borderBottom: '1px solid var(--pm-border2)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'var(--pm-text2)' }}
                        onClick={() => {
                          if (msgSelectedUsers.size === msgUsers.length) setMsgSelectedUsers(new Set());
                          else setMsgSelectedUsers(new Set(msgUsers.map(u => u.id)));
                        }}
                      >
                        <input type="checkbox" readOnly checked={msgSelectedUsers.size === msgUsers.length && msgUsers.length > 0} style={{ accentColor: 'var(--pm-accent)' }} />
                        Select all ({msgUsers.length})
                      </div>
                      {msgUsers.map(u => (
                        <div key={u.id}
                          style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--pm-border)', color: msgSelectedUsers.has(u.id) ? 'var(--pm-accent)' : 'var(--pm-text)' }}
                          onClick={() => setMsgSelectedUsers(prev => {
                            const n = new Set(prev);
                            n.has(u.id) ? n.delete(u.id) : n.add(u.id);
                            return n;
                          })}
                        >
                          <input type="checkbox" readOnly checked={msgSelectedUsers.has(u.id)} style={{ accentColor: 'var(--pm-accent)' }} />
                          <span style={{ flex: 1 }}>{u.display_name || u.email}</span>
                          <span className={`role-badge role-${u.role}`}>{u.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="card-edit-save-btn"
                  disabled={msgSending || !msgText.trim() || (!msgTargetAll && msgSelectedUsers.size === 0)}
                  onClick={handleSendMessage}
                >
                  {msgSent ? '✓ Sent' : msgSending ? 'Sending…' : `📢 Send to ${msgTargetAll ? 'all users' : `${msgSelectedUsers.size} user(s)`}`}
                </button>
              </div>

              {/* Refresh notification */}
              <div className="view-card">
                <h2>Force Refresh</h2>
                <p style={{ fontSize: 13, color: 'var(--pm-text2)', marginBottom: 16 }}>
                  Notify all connected users to refresh the app — use this after deploying new features.
                </p>
                <button
                  className="action-btn"
                  onClick={async () => {
                    await broadcastRefresh();
                    setBroadcastSent(true);
                    dispatch({ type: 'SHOW_TOAST', payload: 'Refresh notification sent to all users.' });
                    setTimeout(() => setBroadcastSent(false), 4000);
                  }}
                >
                  {broadcastSent ? '✓ Notification sent' : '🔔 Notify all users to refresh'}
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
