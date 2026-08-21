import { useApp } from '../../context/AppContext.jsx';
import PromptListView from '../prompts/PromptListView.jsx';
import ImportExportView from '../importexport/ImportExportView.jsx';
import SettingsView from '../admin/SettingsView.jsx';

export default function MainContent() {
  const { state } = useApp();
  const { currentView } = state;

  if (currentView === 'import-export') return <ImportExportView />;
  if (currentView === 'settings') return <SettingsView />;
  return <PromptListView />;
}
