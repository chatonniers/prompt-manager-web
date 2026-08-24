import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { useStorage } from './hooks/useStorage.js'
import { JouleAgent } from './lib/jouleAgent.js'
import TopBar from './components/layout/TopBar.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import MainContent from './components/layout/MainContent.jsx'
import PromptModal from './components/editor/PromptModal.jsx'
import ConfirmModal from './components/shared/ConfirmModal.jsx'
import Toast from './components/shared/Toast.jsx'
import HelpModal from './components/layout/HelpModal.jsx'
import LoginPage from './components/auth/LoginPage.jsx'
import ResetPasswordPage from './components/auth/ResetPasswordPage.jsx'
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
  const { state } = useApp()
  const { profile, isAdmin, signOut } = useAuth()
  const [helpOpen, setHelpOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const zoom = state.zoom ?? 1

  useEffect(() => {
    const handler = () => JouleAgent.shutdown();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

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
        <main id="content" data-workspace={state.workspace ?? 'library'}>
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
  const { session, loading, isPasswordRecovery } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--pm-text3)', fontFamily: 'var(--pm-font)' }}>
        Loading…
      </div>
    )
  }

  if (isPasswordRecovery) return <ResetPasswordPage />

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
