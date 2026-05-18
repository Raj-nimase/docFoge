import { useState, useEffect } from 'react';
import useAcaStore from './store';
import useAuthStore from './authStore';
import Dashboard from './pages/Dashboard';
import NewProject from './pages/NewProject';
import Editor from './pages/Editor';
import Auth from './pages/Auth';
import Toast from './components/ui/Toast';

export default function App() {
  const authStatus = useAuthStore(s => s.status);
  const bootstrap = useAuthStore(s => s.bootstrap);
  const canAccessApp = useAuthStore(s => s.canAccessApp);
  const signedIn = authStatus === 'authenticated';
  const logout = useAuthStore(s => s.logout);
  const loadProjectsForUser = useAcaStore(s => s.loadProjectsForUser);
  const resetProjects = useAcaStore(s => s.resetProjects);
  const showToast = useAcaStore(s => s.showToast);

  const [view, setView] = useState('dashboard');
  const [booting, setBooting] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrap();
      if (cancelled) return;
      await loadProjectsForUser();
      setBooting(false);
    })();
    return () => { cancelled = true; };
  }, [bootstrap, loadProjectsForUser]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      loadProjectsForUser();
      setShowAuth(false);
    }
  }, [authStatus, loadProjectsForUser]);

  const handleLogout = async () => {
    logout();
    resetProjects();
    await loadProjectsForUser();
    setView('dashboard');
    setShowAuth(false);
    showToast('success', 'Signed out. Projects on this device are still available as a guest.');
    if (!useAuthStore.getState().canAccessApp()) {
      setShowAuth(false);
    }
  };

  const handleAuthSuccess = async () => {
    const result = await loadProjectsForUser();
    setShowAuth(false);
    if (result?.offline) {
      showToast('warning', 'Signed in, but could not reach the server. Projects on this device only.');
    } else if (result?.merged) {
      showToast('success', 'Your local projects were saved to your account.');
    } else if (result?.count > 0) {
      showToast('success', `Loaded ${result.count} project${result.count === 1 ? '' : 's'} from your account.`);
    } else {
      showToast('success', 'Signed in. Your projects will sync across devices.');
    }
  };

  if (booting || authStatus === 'loading') {
    return (
      <div className="auth-page">
        <div className="auth-loading">
          <div className="preview-compile-spinner" style={{ width: 36, height: 36 }} />
          <span>Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (!canAccessApp()) {
    return (
      <>
        <Auth
          trialExpired
          onSuccess={handleAuthSuccess}
        />
        <Toast />
      </>
    );
  }

  if (showAuth && !signedIn) {
    return (
      <>
        <Auth
          allowDismiss
          onDismiss={() => setShowAuth(false)}
          onSuccess={handleAuthSuccess}
        />
        <Toast />
      </>
    );
  }

  return (
    <>
      {view === 'dashboard' && (
        <Dashboard
          onNewProject={() => setView('new-project')}
          onOpenProject={() => setView('editor')}
          onLogout={signedIn ? handleLogout : undefined}
          onSignIn={() => setShowAuth(true)}
        />
      )}
      {view === 'new-project' && (
        <NewProject
          onCreated={() => setView('editor')}
          onCancel={() => setView('dashboard')}
        />
      )}
      {view === 'editor' && (
        <Editor
          onGoToDashboard={() => setView('dashboard')}
          onLogout={signedIn ? handleLogout : undefined}
        />
      )}
      <Toast />
    </>
  );
}
