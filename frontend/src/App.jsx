import { useState } from 'react';
import useAcaStore from './store';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
import Editor from './pages/Editor';
import Toast from './components/ui/Toast';

/**
 * Three-view router: dashboard | new-project | editor
 */
export default function App() {
  const currentProjectId = useAcaStore(s => s.currentProjectId);
  const [view, setView] = useState('dashboard');

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard
          onNewProject={() => setView('new-project')}
          onOpenProject={() => setView('editor')}
        />
      )}
      {view === 'new-project' && (
        <NewProject
          onCreated={() => setView('editor')}
          onCancel={() => setView('dashboard')}
        />
      )}
      {view === 'editor' && (
        <Editor onGoToDashboard={() => setView('dashboard')} />
      )}
      <Toast />
    </>
  );
}
