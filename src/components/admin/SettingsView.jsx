import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { StorageAPI } from '../../lib/storage.js';
import { detectSAPContext } from '../../lib/url-detector.js';
import { t } from '../../lib/i18n.js';
import AdminCatalogCard from './AdminCatalogCard.jsx';
import AdminCategoriesCard from './AdminCategoriesCard.jsx';
import AdminSystemsCard from './AdminSystemsCard.jsx';

export default function SettingsView() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const [autoFilter, setAutoFilter] = useState(state.settings?.autoFilterEnabled ?? true);
  const [sapUrl, setSapUrl] = useState('');

  async function handleSave() {
    const updated = { ...state.settings, autoFilterEnabled: autoFilter };
    await StorageAPI.saveSettings(updated);
    dispatch({ type: 'SET_SETTINGS', payload: updated });
    dispatch({ type: 'SHOW_TOAST', payload: t('settingsSaved', lang) });
  }

  function handleDetect() {
    if (!sapUrl.trim()) return;
    const ctx = detectSAPContext(sapUrl.trim());
    dispatch({ type: 'SET_SAP_CONTEXT', payload: ctx });
    if (ctx?.detected) {
      dispatch({ type: 'SHOW_TOAST', payload: t('detectedContext', lang, ctx.solution) });
      dispatch({ type: 'SET_VIEW', payload: { view: 'all', filter: { storyFlow: null, solution: null } } });
    } else {
      dispatch({ type: 'SHOW_TOAST', payload: t('noSapDetected', lang) });
    }
  }

  return (
    <div id="view-settings">
      <div className="settings-grid">

        {/* Col 1: Extension settings + Categories */}
        <div className="settings-col">
          <div className="view-card">
            <h2>{t('settingsTitle', lang)}</h2>
            <div className="setting-row">
              <label className="setting-label">
                <input type="checkbox" checked={autoFilter} onChange={e => setAutoFilter(e.target.checked)} />
                <span> {t('autoFilter', lang)}</span>
              </label>
              <p className="setting-hint">{t('autoFilterHint', lang)}</p>
            </div>
            <div className="setting-row">
              <label className="setting-label">{t('sapUrlLabel', lang)}</label>
              <p className="setting-hint">{t('sapUrlHint', lang)}</p>
              <div style={{ display:'flex', gap:8, marginTop:6 }}>
                <input
                  type="text"
                  value={sapUrl}
                  onChange={e => setSapUrl(e.target.value)}
                  placeholder="https://my12345.ibpcloud.sap.com/…"
                  style={{ flex:1 }}
                  onKeyDown={e => e.key === 'Enter' && handleDetect()}
                />
                <button className="action-btn" onClick={handleDetect}>{t('detect', lang)}</button>
              </div>
            </div>
            <button className="action-btn primary" style={{ marginTop: 16 }} onClick={handleSave}>{t('saveSettings', lang)}</button>
          </div>
          <AdminCategoriesCard />
          <AdminCatalogCard
            titleKey="personasAdmin"
            descKey="personasDesc"
            addKey="addPersona"
            items={state.catalog.personas || []}
            promptField="personas"
            isArray
          />
        </div>

        {/* Col 2: Systems */}
        <div className="settings-col">
          <AdminSystemsCard />
        </div>

        {/* Col 3: Solutions + Story Flows */}
        <div className="settings-col">
          <AdminCatalogCard
            titleKey="solutionsAdmin"
            descKey="solutionsDesc"
            addKey="addSolution"
            items={state.catalog.solutions}
            promptField="solutions"
            isArray
          />
          <AdminCatalogCard
            titleKey="flowsAdmin"
            descKey="flowsDesc"
            addKey="addFlow"
            items={state.catalog.storyFlows}
            promptField="storyFlow"
            isArray={false}
          />
        </div>

      </div>
    </div>
  );
}
