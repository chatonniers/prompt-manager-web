import { useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useStorage } from '../hooks/useStorage.js';
import { useSidebarResize } from '../hooks/useSidebarResize.js';
import TopBar from './layout/TopBar.jsx';
import Sidebar from './layout/Sidebar.jsx';
import MainContent from './layout/MainContent.jsx';
import PromptModal from './editor/PromptModal.jsx';
import ConfirmModal from './shared/ConfirmModal.jsx';
import Toast from './shared/Toast.jsx';

export default function AppShell() {
  useStorage();
  const { state } = useApp();
  const sidebarRef = useRef(null);
  const resizerRef = useSidebarResize(sidebarRef);

  if (!state.initialized) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--pm-text3)' }}>Loading…</div>;
  }

  return (
    <div id="app">
      <TopBar />
      <div id="main-layout">
        <Sidebar sidebarRef={sidebarRef} />
        <div id="sidebar-resizer" ref={resizerRef} />
        <MainContent />
      </div>
      {state.isModalOpen && <PromptModal />}
      {state.isConfirmOpen && <ConfirmModal />}
      <Toast />
    </div>
  );
}
