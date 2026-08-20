import { useApp } from '../../context/AppContext.jsx';
import { t } from '../../lib/i18n.js';
import PromptGrid from './PromptGrid.jsx';

export default function PromptListView() {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { searchQuery, sortOrder, sapContext } = state;

  return (
    <>
      <div id="list-toolbar">
        <input
          id="list-search"
          type="text"
          placeholder={t('searchPlaceholder', lang)}
          value={searchQuery}
          onChange={e => dispatch({ type: 'SET_SEARCH', query: e.target.value })}
          autoComplete="off"
          spellCheck="false"
        />
        <div id="sort-controls">
          <label>
            {t('sortLabel', lang)}{' '}
            <select
              id="sort-select"
              value={sortOrder}
              onChange={e => dispatch({ type: 'SET_SORT', order: e.target.value })}
            >
              <option value="updated">{t('sortUpdated', lang)}</option>
              <option value="title">{t('sortTitle', lang)}</option>
              <option value="usage">{t('sortUsage', lang)}</option>
              <option value="created">{t('sortCreated', lang)}</option>
            </select>
          </label>
        </div>
      </div>

      {sapContext?.detected && (
        <div className="sap-context-banner">
          <span>{t('sapContextBanner', lang, sapContext.solution)}</span>
          <button className="banner-clear-btn" onClick={() => dispatch({ type: 'SET_SAP_CONTEXT', context: null })}>
            {t('clearFilter', lang)}
          </button>
        </div>
      )}

      <div id="view-list">
        <PromptGrid />
      </div>
    </>
  );
}
