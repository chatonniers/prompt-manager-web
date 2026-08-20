import { AppProvider, useApp } from './context/AppContext.jsx'
import { useStorage } from './hooks/useStorage.js'
import TopBar from './components/layout/TopBar.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import MainContent from './components/layout/MainContent.jsx'
import PromptModal from './components/editor/PromptModal.jsx'
import ConfirmModal from './components/shared/ConfirmModal.jsx'
import Toast from './components/shared/Toast.jsx'
import './styles/variables.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/sidebar.css'
import './styles/cards.css'
import './styles/modal.css'
import './styles/admin.css'
import './styles/importexport.css'
import './styles/settings.css'
import './styles/toast.css'

function AppInner() {
  useStorage()
  const { state } = useApp()
  if (!state.initialized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--pm-text3)', fontFamily: 'var(--pm-font)' }}>
        Loading…
      </div>
    )
  }
  return (
    <>
      <TopBar />
      <div id="main-layout">
        <Sidebar />
        <MainContent />
      </div>
      {state.isModalOpen && <PromptModal />}
      {state.isConfirmOpen && <ConfirmModal />}
      <Toast />
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
