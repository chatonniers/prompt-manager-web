import { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSidebarResize } from '../../hooks/useSidebarResize.js';
import { t } from '../../lib/i18n.js';
import { getFlowColor } from '../../lib/flowColors.js';
import { ASSISTANT_COLORS } from '../../lib/assistantColors.js';

function assistantColor(idx) {
  return ASSISTANT_COLORS[idx % ASSISTANT_COLORS.length];
}

const IconChevronDown  = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChevronRight = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M3.5 2l3 3-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChevronLeft  = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2.5l-4 3.5 4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const IconChevronRightLg = () => <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l4 3.5-4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;

export default function Sidebar({ collapsed, onToggle, mobileNavOpen, onMobileNavClose }) {
  const { state, dispatch } = useApp();
  const { isAdmin, isEditor } = useAuth();
  const canSeeArchived = isAdmin || isEditor;
  const lang = state.settings?.lang || 'en';
  const { prompts, catalog, currentView, currentFilter, statusFilter } = state;
  const categories = catalog.categories || [];
  const assistants = catalog.assistants || [];
  const sidebarRef = useRef(null);
  const resizerRef = useSidebarResize(sidebarRef, collapsed);

  const [openSections, setOpenSections] = useState({ categories: true, assistants: true, flows: false, solutions: false });

  function toggleSection(key) {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const mostUsedCount = prompts.filter(p => (p.usageCount || 0) > 0).length;
  const archivedCount = prompts.filter(p => p.status === 'archived').length;

  function setView(view, filter) {
    dispatch({ type: 'SET_VIEW', payload: { view, filter: filter ?? { storyFlow: null, solution: null, category: null, assistant: null } } });
    onMobileNavClose?.();
  }

  function isActive(view, filterVal) {
    if (view === 'archived') return statusFilter === 'archived';
    if (view !== currentView) return false;
    if (view === 'flow') return currentFilter?.storyFlow === filterVal;
    if (view === 'solution') return currentFilter?.solution === filterVal;
    if (view === 'category') return currentFilter?.category === filterVal;
    if (view === 'assistant') return currentFilter?.assistant === filterVal;
    return true;
  }

  if (collapsed) {
    return (
      <nav id="sidebar" className={`sidebar-collapsed${mobileNavOpen ? ' sidebar-mobile-open' : ''}`} ref={sidebarRef}>
        <button className="sidebar-toggle-btn" onClick={onToggle} title="Expand sidebar">
          <IconChevronRightLg />
        </button>
      </nav>
    );
  }

  return (
    <>
      <nav id="sidebar" className={mobileNavOpen ? 'sidebar-mobile-open' : ''} ref={sidebarRef}>
        <button className={`nav-item${isActive('all') ? ' active' : ''}`} onClick={() => setView('all')}>
          <span style={{ flex: 1 }}>{t('allPrompts', lang)}</span>
          <span className="nav-badge">{prompts.length}</span>
        </button>

        <button className={`nav-item${isActive('most-used') ? ' active' : ''}`} onClick={() => setView('most-used')}>
          <span style={{ flex: 1 }}>{t('mostUsed', lang)}</span>
          <span className="nav-badge">{mostUsedCount}</span>
        </button>

        {canSeeArchived && (
          <button
            className={`nav-item${isActive('archived') ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_STATUS_FILTER', payload: 'archived' })}
          >
            <span style={{ flex: 1 }}>Archived</span>
            <span className="nav-badge">{archivedCount}</span>
          </button>
        )}

        {/* By Category */}
        <button className="nav-section-label nav-section-toggle" onClick={() => toggleSection('categories')}>
          {t('byCategory', lang)}
          <span className="nav-section-chevron">{openSections.categories ? <IconChevronDown /> : <IconChevronRight />}</span>
        </button>
        {openSections.categories && (
          <div id="nav-categories">
            {categories.map(cat => {
              const cnt = prompts.filter(p => p.category === cat).length;
              return (
                <button key={cat} className={`nav-item${isActive('category', cat) ? ' active' : ''}`}
                  onClick={() => setView('category', { storyFlow: null, solution: null, category: cat, assistant: null })}>
                  <span style={{ flex: 1 }}>{cat}</span>
                  <span className="nav-badge">{cnt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* By AI Assistant */}
        {assistants.length > 0 && (
          <>
            <button className="nav-section-label nav-section-toggle" onClick={() => toggleSection('assistants')}>
              AI Assistants
              <span className="nav-section-chevron">{openSections.assistants ? <IconChevronDown /> : <IconChevronRight />}</span>
            </button>
            {openSections.assistants && (
              <div id="nav-assistants">
                {assistants.map((a, idx) => {
                  const cnt = prompts.filter(p => p.assistant === a.name).length;
                  const active = isActive('assistant', a.name);
                  const color = assistantColor(idx);
                  return (
                    <button key={a.id}
                      className={`nav-item nav-item-flow${active ? ' active' : ''}`}
                      style={active ? { background: color.bg, borderLeftColor: color.border, color: color.text } : {}}
                      onClick={() => setView('assistant', { storyFlow: null, solution: null, category: null, assistant: a.name })}>
                      <span className="nav-flow-dot" style={{ background: color.border }} />
                      <span style={{ flex: 1 }}>{a.name}</span>
                      <span className="nav-badge" style={active ? { background: color.bg, color: color.text } : {}}>{cnt}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* By Story Flow */}
        <button className="nav-section-label nav-section-toggle" onClick={() => toggleSection('flows')}>
          {t('byStoryFlow', lang)}
          <span className="nav-section-chevron">{openSections.flows ? <IconChevronDown /> : <IconChevronRight />}</span>
        </button>
        {openSections.flows && (
          <div id="nav-flows">
            {catalog.storyFlows.map(flow => {
              const cnt = prompts.filter(p => p.storyFlow === flow).length;
              const active = isActive('flow', flow);
              const color = getFlowColor(flow);
              return (
                <button key={flow}
                  className={`nav-item nav-item-flow${active ? ' active' : ''}`}
                  style={active ? { background: color.bg, borderLeftColor: color.border, color: color.text } : {}}
                  onClick={() => setView('flow', { storyFlow: flow, solution: null, category: null, assistant: null })}>
                  <span className="nav-flow-dot" style={{ background: color.border }} />
                  <span style={{ flex: 1 }}>{flow}</span>
                  <span className="nav-badge" style={active ? { background: color.bg, color: color.text } : {}}>{cnt}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* By Solution */}
        <button className="nav-section-label nav-section-toggle" onClick={() => toggleSection('solutions')}>
          {t('bySolution', lang)}
          <span className="nav-section-chevron">{openSections.solutions ? <IconChevronDown /> : <IconChevronRight />}</span>
        </button>
        {openSections.solutions && (
          <div id="nav-solutions">
            {catalog.solutions.map(sol => {
              const cnt = prompts.filter(p => (p.solutions || []).includes(sol)).length;
              return (
                <button key={sol}
                  className={`nav-item${isActive('solution', sol) ? ' active' : ''}`}
                  onClick={() => setView('solution', { storyFlow: null, solution: sol, category: null, assistant: null })}>
                  <span style={{ flex: 1 }}>{sol}</span>
                  <span className="nav-badge">{cnt}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="sidebar-version">
          v{__APP_VERSION__} · {__BUILD_DATE__}<br />by Sylvain C.
        </div>
        <button className="sidebar-toggle-btn sidebar-toggle-collapse" onClick={onToggle} title="Collapse sidebar">
          <IconChevronLeft />
        </button>
      </nav>
      <div id="sidebar-resizer" ref={resizerRef} />
    </>
  );
}


