import { useApp } from '../../context/AppContext.jsx';
import { t } from '../../lib/i18n.js';

export default function Sidebar({ sidebarRef }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { prompts, catalog, currentView, currentFilter } = state;

  const favCount = prompts.filter(p => p.isFavorite).length;
  const mostUsedCount = prompts.filter(p => p.usageCount > 0).length;

  function setView(view, filter) {
    dispatch({ type: 'SET_VIEW', payload: { view, filter: filter ?? { storyFlow: null, solution: null } } });
  }

  function isActive(view, filterVal) {
    if (view !== currentView) return false;
    if (view === 'flow') return currentFilter?.storyFlow === filterVal;
    if (view === 'solution') return currentFilter?.solution === filterVal;
    return true;
  }

  return (
    <nav id="sidebar" ref={sidebarRef}>
      <div className="nav-section-label">{t('allPrompts', lang).toUpperCase().replace('ALL PROMPTS', 'LIBRARY')}</div>

      <button className={`nav-item${isActive('all', null) ? ' active' : ''}`} onClick={() => setView('all', null)}>
        <span className="nav-icon">≡</span>
        <span>{t('allPrompts', lang)}</span>
        <span className="nav-badge">{prompts.length}</span>
      </button>

      <button className={`nav-item${isActive('favorites', null) ? ' active' : ''}`} onClick={() => setView('favorites', null)}>
        <span className="nav-icon">★</span>
        <span>{t('favorites', lang)}</span>
        <span className="nav-badge">{favCount}</span>
      </button>

      <button className={`nav-item${isActive('most-used', null) ? ' active' : ''}`} onClick={() => setView('most-used', null)}>
        <span className="nav-icon">🔥</span>
        <span>{t('mostUsed', lang)}</span>
        <span className="nav-badge">{mostUsedCount}</span>
      </button>

      <div className="nav-section-label">{t('byStoryFlow', lang)}</div>
      <div id="nav-flows">
        {catalog.storyFlows.map(flow => {
          const cnt = prompts.filter(p => p.storyFlow === flow).length;
          if (cnt === 0) return null;
          return (
            <button key={flow} className={`nav-item${isActive('flow', flow) ? ' active' : ''}`} onClick={() => setView('flow', flow)}>
              <span className="nav-icon">⟳</span>
              <span>{flow}</span>
              <span className="nav-badge">{cnt}</span>
            </button>
          );
        })}
      </div>

      <div className="nav-section-label">{t('bySolution', lang)}</div>
      <div id="nav-solutions">
        {catalog.solutions.map(sol => {
          const cnt = prompts.filter(p => p.solutions?.includes(sol)).length;
          if (cnt === 0) return null;
          return (
            <button key={sol} className={`nav-item${isActive('solution', sol) ? ' active' : ''}`} onClick={() => setView('solution', sol)}>
              <span className="nav-icon">◈</span>
              <span>{sol}</span>
              <span className="nav-badge">{cnt}</span>
            </button>
          );
        })}
      </div>

      <div className="nav-divider" />

      <button className={`nav-item${currentView === 'import-export' ? ' active' : ''}`} onClick={() => setView('import-export')}>
        <span className="nav-icon">⇄</span>
        <span>{t('importExport', lang)}</span>
      </button>

      <button className={`nav-item${currentView === 'settings' ? ' active' : ''}`} onClick={() => setView('settings')}>
        <span className="nav-icon">⚙</span>
        <span>{t('settings', lang)}</span>
      </button>
    </nav>
  );
}
