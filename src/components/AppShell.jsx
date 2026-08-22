import { useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useStorage } from '../hooks/useStorage.js';
import TopBar from './layout/TopBar.jsx';
import Sidebar from './layout/Sidebar.jsx';
import MainContent from './layout/MainContent.jsx';
import PromptModal from './editor/PromptModal.jsx';
import ConfirmModal from './shared/ConfirmModal.jsx';
import Toast from './shared/Toast.jsx';

export default function AppShell() {
  useStorage();
  const { state } = useApp();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (!state.initialized) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--pm-text3)' }}>Loading…</div>;
  }

  return (
    <div id="app">
      <TopBar
        sidebarCollapsed={sidebarCollapsed}
        onToggleSidebar={() => setSidebarCollapsed(v => !v)}
        onHamburger={() => setMobileNavOpen(true)}
      />
      <div id="main-layout">
        {mobileNavOpen && (
          <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />
        )}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(v => !v)}
          mobileNavOpen={mobileNavOpen}
          onMobileNavClose={() => setMobileNavOpen(false)}
        />
        <MainContent />
      </div>
      {state.isModalOpen && <PromptModal />}
      {state.isConfirmOpen && <ConfirmModal />}
      <Toast />
    </div>
  );
}
