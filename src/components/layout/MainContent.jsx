import { useApp } from '../../context/AppContext.jsx';
import PromptListView from '../prompts/PromptListView.jsx';
import ImportExportView from '../importexport/ImportExportView.jsx';
import SettingsView from '../admin/SettingsView.jsx';

export default function MainContent() {
  const { state } = useApp();
  const { currentView, zoom = 1 } = state;

  if (currentView === 'import-export') return <ImportExportView />;
  if (currentView === 'settings') return <SettingsView />;

  // PromptListView renders toolbar (sticky, not scaled) + content-scaler-wrap (scaled)
  return <PromptListView zoom={zoom} />;
}
