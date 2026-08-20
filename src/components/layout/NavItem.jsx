import { useApp } from '../../context/AppContext.jsx'
import { t } from '../../lib/i18n.js'

export default function NavItem({ icon, label, view, filter, badge, activeView, activeFilter }) {
  const { dispatch } = useApp()

  const isActive = (() => {
    if (view !== activeView) return false
    if (view === 'flow') return activeFilter?.storyFlow === filter
    if (view === 'solution') return activeFilter?.solution === filter
    return true
  })()

  function handleClick() {
    const filterObj =
      view === 'flow' ? { storyFlow: filter, solution: null } :
      view === 'solution' ? { storyFlow: null, solution: filter } :
      { storyFlow: null, solution: null }
    dispatch({ type: 'SET_VIEW', payload: { view, filter: filterObj } })
  }

  return (
    <button
      className={`nav-item${isActive ? ' active' : ''}`}
      onClick={handleClick}
    >
      <span className="nav-icon">{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && <span className="nav-badge">{badge}</span>}
    </button>
  )
}
