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

  if (!state.initialized) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--pm-text3)' }}>Loading…</div>;
  }

  return (
    <div id="app">
      <TopBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed(v => !v)} />
      <div id="main-layout">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(v => !v)} />
        <MainContent />
      </div>
      {state.isModalOpen && <PromptModal />}
      {state.isConfirmOpen && <ConfirmModal />}
      <Toast />
    </div>
  );
}
