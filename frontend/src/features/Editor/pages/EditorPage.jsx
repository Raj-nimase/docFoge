import { useState, useEffect } from 'react';
import TopBar from '@/features/Editor/components/TopBar/TopBar';
import Ribbon from '@/features/Editor/components/Ribbon/Ribbon';
import LeftPanel from '@/features/Editor/components/LeftPanel/LeftPanel';
import EditorPanel from '@/features/Editor/components/EditorPanel/EditorPanel';
import PreviewPanel from '@/features/Editor/components/PreviewPanel/PreviewPanel';
import useEditorTour from '@/hooks/useEditorTour/useEditorTour';
import useScrollSync from '@/features/Editor/hooks/useScrollSync';
import useAcaStore from '@/contexts/projectStore/projectStore';

export default function Editor({ onGoToDashboard, onLogout }) {
  const { runTour } = useEditorTour({ autoStart: true });
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // Editor ↔ PDF scroll sync controller (inert until both panes register &
  // sync is enabled; naturally idle when the PreviewPanel is not mounted).
  useScrollSync();

  // Detect PWA standalone mode
  const [isStandalone] = useState(() => 
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  );
  
  const [activeTab, setActiveTab] = useState('editor');

  // Read project state directly from the store (avoid getCurrentProject() method
  // which uses get() internally and can cause selector timing issues with Zustand)
  const currentProjectId = useAcaStore(s => s.currentProjectId);
  const projects = useAcaStore(s => s.projects);
  const projectsLoaded = useAcaStore(s => s.projectsLoaded);
  const openProject = useAcaStore(s => s.openProject);

  const currentProject = currentProjectId
    ? projects.find(p => p.id === currentProjectId) || null
    : null;

  // Auto-recovery: only when no currentProjectId is set at all (e.g. direct
  // page refresh or navigating to /editor without selecting a project).
  // This must NOT override a valid currentProjectId just because the projects
  // array hasn't synced yet from a background cloud fetch.
  useEffect(() => {
    if (!currentProjectId) {
      if (projects.length > 0) {
        const firstActive = projects.find(p => !p.deletedAt) || projects[0];
        if (firstActive) {
          openProject(firstActive.id);
        }
      } else if (projectsLoaded && onGoToDashboard) {
        onGoToDashboard();
      }
    }
  }, [currentProjectId, projects, projectsLoaded, openProject, onGoToDashboard]);

  // Sync active project to cloud when leaving the editor
  const syncActiveProjectNow = useAcaStore(s => s.syncActiveProjectNow);
  useEffect(() => {
    return () => {
      syncActiveProjectNow();
    };
  }, [syncActiveProjectNow]);

  // Automatically switch to Preview when compile begins
  const compileStatus = useAcaStore(s => s.compileJob?.status);
  useEffect(() => {
    if (isStandalone && (compileStatus === 'pending' || compileStatus === 'processing')) {
      setActiveTab('preview');
    }
  }, [compileStatus, isStandalone]);

  const activeChapterId = useAcaStore((s) => s.activeChapterId);
  const getActiveSection = useAcaStore((s) => s.getActiveSection);

  const activeSection = getActiveSection();
  const isCertificateActive =
    activeChapterId === "certificate" ||
    (activeSection &&
      (activeSection.id === "certificate" ||
        activeSection.id?.toLowerCase().includes("certificate") ||
        activeSection.label?.toLowerCase() === "certificate"));

  const bodyClassName = `editor-body ${isCertificateActive ? 'editor-body--certificate' : ''} ${isStandalone ? (activeTab === 'editor' ? 'pwa-view-editor' : 'pwa-view-preview') : ''}`;

  return (
    <div className="editor-layout">
      <TopBar onGoToDashboard={onGoToDashboard} onLogout={onLogout} />
      <Ribbon onGoToDashboard={onGoToDashboard} onStartTour={() => runTour(true)} />
      <div className={bodyClassName}>
        <LeftPanel collapsed={leftCollapsed} onToggleCollapse={() => setLeftCollapsed(v => !v)} />
        <EditorPanel />
        {!isCertificateActive && <PreviewPanel />}
      </div>

      {isStandalone && (
        <div className="pwa-tab-switcher">
          <button 
            type="button"
            className={`pwa-tab-button ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            Editor
          </button>
          <button 
            type="button"
            className={`pwa-tab-button ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            PDF Preview
          </button>
        </div>
      )}
    </div>
  );
}

