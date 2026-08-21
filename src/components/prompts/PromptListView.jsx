import { useApp } from '../../context/AppContext.jsx';
import { t } from '../../lib/i18n.js';
import PromptGrid from './PromptGrid.jsx';

const STEP = 0.1;

export default function PromptListView({ zoom = 1 }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { searchQuery, sapContext } = state;
  const zoomPct = Math.round(zoom * 100);

  function zoomIn()    { dispatch({ type: 'SET_ZOOM', payload: zoom + STEP }); }
  function zoomOut()   { dispatch({ type: 'SET_ZOOM', payload: zoom - STEP }); }
  function zoomReset() { dispatch({ type: 'SET_ZOOM', payload: 1 }); }

  return (
    <>
      {/* Toolbar — sticky, outside the zoom scaler */}
      <div id="list-toolbar">
        <input
          id="list-search"
          type="text"
          placeholder={t('searchPlaceholder', lang)}
          value={searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH', payload: e.target.value })}
          autoComplete="off"
          spellCheck="false"
        />
        <div className="toolbar-right-controls">
          <button className="toolbar-btn toolbar-btn-icon" onClick={zoomOut} title="Zoom out" disabled={zoom <= 0.5}>−</button>
          <button className="toolbar-btn toolbar-zoom-label" onClick={zoomReset} title="Reset zoom">{zoomPct}%</button>
          <button className="toolbar-btn toolbar-btn-icon" onClick={zoomIn} title="Zoom in" disabled={zoom >= 2}>+</button>
          <button
            className="toolbar-btn toolbar-btn-primary"
            onClick={() => dispatch({ type: 'OPEN_MODAL', payload: undefined })}
          >
            {t('newPrompt', lang)}
          </button>
        </div>
      </div>

      {/* Scaled content — CSS zoom keeps text crisp, transform: scale causes blur */}
      <div id="content-scaler" style={{ zoom }}>
        {sapContext?.detected && (
          <div className="sap-context-banner">
            <span>{t('sapContextBanner', lang, sapContext.solution)}</span>
            <button className="banner-clear-btn" onClick={() => dispatch({ type: 'SET_SAP_CONTEXT', payload: null })}>
              {t('clearFilter', lang)}
            </button>
          </div>
        )}
        <div id="view-list">
          <PromptGrid />
        </div>
      </div>
    </>
  );
}
