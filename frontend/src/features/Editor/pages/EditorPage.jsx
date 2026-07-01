import TopBar from '@/features/Editor/components/TopBar/TopBar';
import LeftPanel from '@/features/Editor/components/LeftPanel/LeftPanel';
import EditorPanel from '@/features/Editor/components/EditorPanel/EditorPanel';
import PreviewPanel from '@/features/Editor/components/PreviewPanel/PreviewPanel';
import useEditorTour from '@/hooks/useEditorTour/useEditorTour';

export default function Editor({ onGoToDashboard, onLogout }) {
  const { runTour } = useEditorTour({ autoStart: true });

  return (
    <div className="editor-layout">
      <TopBar onGoToDashboard={onGoToDashboard} onLogout={onLogout} onStartTour={() => runTour(true)} />
      <div className="editor-body">
        <LeftPanel />
        <EditorPanel />
        <PreviewPanel />
      </div>
    </div>
  );
}
