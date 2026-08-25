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
  const { profile, isAdmin, signOut, refreshBanner, setRefreshBanner, adminMessage, setAdminMessage } = useAuth()
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
      {refreshBanner && (
        <div className="refresh-banner">
          <span>🔔 A new version is available — please refresh to get the latest features.</span>
          <button className="refresh-banner-btn" onClick={() => window.location.reload()}>Refresh now</button>
          <button className="refresh-banner-dismiss" onClick={() => setRefreshBanner(false)} title="Dismiss">✕</button>
        </div>
      )}
      {adminMessage && (
        <div className="refresh-banner admin-message-banner">
          <span>📢 {adminMessage}</span>
          <button className="refresh-banner-dismiss" onClick={() => setAdminMessage(null)} title="Dismiss">✕</button>
        </div>
      )}
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

function PendingApprovalScreen({ onSignOut }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, color: 'var(--pm-text)', fontFamily: 'var(--pm-font)', textAlign: 'center', padding: '0 24px' }}>
      <div style={{ fontSize: 40 }}>⏳</div>
      <h2 style={{ margin: 0, fontWeight: 700, fontSize: 20 }}>Account pending approval</h2>
      <p style={{ margin: 0, color: 'var(--pm-text3)', maxWidth: 380, fontSize: 14, lineHeight: 1.6 }}>
        Your account has been created and is awaiting admin approval. You will receive access once an administrator approves your registration.
      </p>
      <button
        style={{ marginTop: 8, padding: '7px 20px', borderRadius: 8, border: '1px solid var(--pm-border)', background: 'transparent', color: 'var(--pm-text3)', cursor: 'pointer', fontSize: 13 }}
        onClick={onSignOut}
      >
        Sign out
      </button>
    </div>
  );
}

function AuthGate() {
  const { session, profile, loading, isPasswordRecovery, signOut } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--pm-text3)', fontFamily: 'var(--pm-font)' }}>
        Loading…
      </div>
    )
  }

  if (isPasswordRecovery) return <ResetPasswordPage />

  if (!session) return <LoginPage />

  if (profile?._pending) return <PendingApprovalScreen onSignOut={signOut} />

  // Still loading profile (session exists but profile not yet fetched)
  if (profile === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--pm-text3)', fontFamily: 'var(--pm-font)' }}>
      Loading…
    </div>
  )

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
