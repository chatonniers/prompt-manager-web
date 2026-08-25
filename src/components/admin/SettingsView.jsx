import { useRef, useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
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
  const { isAdmin, broadcastRefresh } = useAuth();
  const lang = state.settings?.lang || 'en';
  const [activeSection, setActiveSection] = useState(state.settingsSection || 'categories');
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const navSearchRef = useRef(null);

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

          {activeSection === 'users' && <UserManagement />}
          {activeSection === 'stats' && <AdminStatsView />}
          {activeSection === 'visibility' && <AdminVisibilityCard />}

          {activeSection === 'system' && isAdmin && (
            <div className="view-card">
              <h2>System Actions</h2>
              <p style={{ fontSize: 13, color: 'var(--pm-text2)', marginBottom: 16 }}>
                Notify all connected users to refresh the app — use this after deploying new features or changes.
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
          )}

        </div>
      </div>
    </div>
  );
}
