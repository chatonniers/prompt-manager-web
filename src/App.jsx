import { useState, useEffect } from 'react'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { useStorage } from './hooks/useStorage.js'
import TopBar from './components/layout/TopBar.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import MainContent from './components/layout/MainContent.jsx'
import PromptModal from './components/editor/PromptModal.jsx'
import ConfirmModal from './components/shared/ConfirmModal.jsx'
import Toast from './components/shared/Toast.jsx'
import HelpModal from './components/layout/HelpModal.jsx'
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

function AppInner() {
  useStorage()
  const { state, dispatch } = useApp()
  const [helpOpen, setHelpOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const zoom = state.zoom ?? 1
  const STEP = 0.1

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
      <TopBar onHelp={() => setHelpOpen(true)} />
      <div id="main-layout">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
        <main id="content">
          <div id="content-scaler" style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}>
            <MainContent />
          </div>
        </main>
      </div>
      {state.isModalOpen && <PromptModal />}
      {state.isConfirmOpen && <ConfirmModal />}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
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
