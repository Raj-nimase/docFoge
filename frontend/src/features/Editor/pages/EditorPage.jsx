import { useState, useEffect } from 'react';
import TopBar from '@/features/Editor/components/TopBar/TopBar';
import LeftPanel from '@/features/Editor/components/LeftPanel/LeftPanel';
import EditorPanel from '@/features/Editor/components/EditorPanel/EditorPanel';
import PreviewPanel from '@/features/Editor/components/PreviewPanel/PreviewPanel';
import useEditorTour from '@/hooks/useEditorTour/useEditorTour';
import useAcaStore from '@/contexts/projectStore/projectStore';

export default function Editor({ onGoToDashboard, onLogout }) {
  const { runTour } = useEditorTour({ autoStart: true });
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  // Detect PWA standalone mode
  const [isStandalone] = useState(() => 
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
  );
  
  const [activeTab, setActiveTab] = useState('editor');

  // Automatically switch to Preview when compile begins
  const compileStatus = useAcaStore(s => s.compileJob?.status);
  useEffect(() => {
    if (isStandalone && (compileStatus === 'pending' || compileStatus === 'processing')) {
      setActiveTab('preview');
    }
  }, [compileStatus, isStandalone]);

  const bodyClassName = `editor-body ${isStandalone ? (activeTab === 'editor' ? 'pwa-view-editor' : 'pwa-view-preview') : ''}`;

  return (
    <div className="editor-layout">
      <TopBar onGoToDashboard={onGoToDashboard} onLogout={onLogout} onStartTour={() => runTour(true)} />
      <div className={bodyClassName}>
        <LeftPanel collapsed={leftCollapsed} onToggleCollapse={() => setLeftCollapsed(v => !v)} />
        <EditorPanel />
        <PreviewPanel />
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

