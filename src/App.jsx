import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { useStorage } from './hooks/useStorage.js'
import TopBar from './components/layout/TopBar.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import MainContent from './components/layout/MainContent.jsx'
import PromptModal from './components/editor/PromptModal.jsx'
import ConfirmModal from './components/shared/ConfirmModal.jsx'
import Toast from './components/shared/Toast.jsx'
import HelpModal from './components/layout/HelpModal.jsx'
import LoginPage from './components/auth/LoginPage.jsx'
import { StorageAPI } from './lib/storage.js'
import { decodeShareUrl } from './lib/share.js'
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
import './styles/help.css'
import './styles/auth.css'

function AppInner() {
  useStorage()
  const { state, dispatch } = useApp()
  const { profile, isAdmin, signOut } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const zoom = state.zoom ?? 1

  // Handle share URL on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith('#share=')) return;
    const encoded = hash.slice(7);
    decodeShareUrl(encoded).then(async data => {
      if (!data) return;
      try {
        const result = await StorageAPI.importAll(data, 'merge');
        const prompts = await StorageAPI.getAllPrompts();
        const catalog = await StorageAPI.getCatalog();
        dispatch({ type: 'SET_PROMPTS', payload: prompts });
        dispatch({ type: 'SET_CATALOG', payload: catalog });
        dispatch({ type: 'SHOW_TOAST', payload: `Imported ${result.imported} prompts from shared URL` });
      } catch { /* silent */ }
      history.replaceState(null, '', window.location.pathname + window.location.search);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state.initialized) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--pm-text3)', fontFamily: 'var(--pm-font)' }}>
        Loading…
      </div>
    )
  }
  return (
    <>
      <TopBar onHelp={() => setHelpOpen(true)} onSignOut={signOut} profile={profile} isAdmin={isAdmin} />
      <div id="main-layout">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
        <main id="content">
          <MainContent />
        </main>
      </div>
      {state.isModalOpen && <PromptModal />}
      {state.isConfirmOpen && <ConfirmModal />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      <Toast />
    </>
  )
}

function AuthGate() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--pm-text3)', fontFamily: 'var(--pm-font)' }}>
        Loading…
      </div>
    )
  }

  if (!session) return <LoginPage />

  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  )
}
