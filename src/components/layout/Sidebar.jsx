import { useRef } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useSidebarResize } from '../../hooks/useSidebarResize.js';
import { t } from '../../lib/i18n.js';
import { AUTONOMOUS_CATEGORIES } from '../../lib/storage.js';

export default function Sidebar({ collapsed }) {
  const { state, dispatch } = useApp();
  const lang = state.settings?.lang || 'en';
  const { prompts, catalog, currentView, currentFilter } = state;
  const sidebarRef = useRef(null);
  const resizerRef = useSidebarResize(sidebarRef, collapsed);

  const favCount = prompts.filter(p => p.isFavorite).length;
  const mostUsedCount = prompts.filter(p => (p.usageCount || 0) > 0).length;

  function setView(view, filter) {
    dispatch({ type: 'SET_VIEW', payload: { view, filter: filter ?? { storyFlow: null, solution: null, category: null } } });
  }

  function isActive(view, filterVal) {
    if (view !== currentView) return false;
    if (view === 'flow') return currentFilter?.storyFlow === filterVal;
    if (view === 'solution') return currentFilter?.solution === filterVal;
    if (view === 'category') return currentFilter?.category === filterVal;
    return true;
  }

  if (collapsed) {
    return <nav id="sidebar" className="sidebar-collapsed" ref={sidebarRef} />;
  }

  return (
    <>
      <nav id="sidebar" ref={sidebarRef}>
        <div className="nav-section-label">LIBRARY</div>

        <button className={`nav-item${isActive('all') ? ' active' : ''}`} onClick={() => setView('all')}>
          <span className="nav-icon">≡</span>
          <span style={{ flex: 1 }}>{t('allPrompts', lang)}</span>
          <span className="nav-badge">{prompts.length}</span>
        </button>

        <button className={`nav-item${isActive('favorites') ? ' active' : ''}`} onClick={() => setView('favorites')}>
          <span className="nav-icon">★</span>
          <span style={{ flex: 1 }}>{t('favorites', lang)}</span>
          <span className="nav-badge">{favCount}</span>
        </button>

        <button className={`nav-item${isActive('most-used') ? ' active' : ''}`} onClick={() => setView('most-used')}>
          <span className="nav-icon">🔥</span>
          <span style={{ flex: 1 }}>{t('mostUsed', lang)}</span>
          <span className="nav-badge">{mostUsedCount}</span>
        </button>

        <div className="nav-section-label">{t('byCategory', lang)}</div>
        <div id="nav-categories">
          {AUTONOMOUS_CATEGORIES.map(cat => {
            const cnt = prompts.filter(p => p.category === cat).length;
            return (
              <button
                key={cat}
                className={`nav-item${isActive('category', cat) ? ' active' : ''}`}
                onClick={() => setView('category', { storyFlow: null, solution: null, category: cat })}
              >
                <span className="nav-icon">◉</span>
                <span style={{ flex: 1 }}>{cat.replace('Autonomous ', '')}</span>
                <span className="nav-badge">{cnt}</span>
              </button>
            );
          })}
        </div>

        <div className="nav-section-label">{t('byStoryFlow', lang)}</div>
        <div id="nav-flows">
          {catalog.storyFlows.map(flow => {
            const cnt = prompts.filter(p => p.storyFlow === flow).length;
            return (
              <button
                key={flow}
                className={`nav-item${isActive('flow', flow) ? ' active' : ''}`}
                onClick={() => setView('flow', { storyFlow: flow, solution: null, category: null })}
              >
                <span className="nav-icon">▶</span>
                <span style={{ flex: 1 }}>{flow}</span>
                <span className="nav-badge">{cnt}</span>
              </button>
            );
          })}
        </div>

        <div className="nav-section-label">{t('bySolution', lang)}</div>
        <div id="nav-solutions">
          {catalog.solutions.map(sol => {
            const cnt = prompts.filter(p => (p.solutions || []).includes(sol)).length;
            return (
              <button
                key={sol}
                className={`nav-item${isActive('solution', sol) ? ' active' : ''}`}
                onClick={() => setView('solution', { storyFlow: null, solution: sol, category: null })}
              >
                <span className="nav-icon">◆</span>
                <span style={{ flex: 1 }}>{sol}</span>
                <span className="nav-badge">{cnt}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <div id="sidebar-resizer" ref={resizerRef} />
    </>
  );
}
