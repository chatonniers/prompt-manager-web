import { useApp } from '../../context/AppContext.jsx';
import PromptGrid from './PromptGrid.jsx';
import { t } from '../../lib/i18n.js';

export default function PromptListView({ zoom = 1 }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { sapContext } = state;

  return (
    <div id="content-scaler" style={{ zoom }}>
      {sapContext?.detected && (
        <div className="sap-context-banner">
          <span>{t('sapContextBanner', lang, sapContext.solution)}</span>
          <button onClick={() => dispatch({ type: 'SET_SAP_CONTEXT', payload: null })}>
            {t('clearFilter', lang)}
          </button>
        </div>
      )}
      <div id="view-list">
        <PromptGrid />
      </div>
    </div>
  );
}
