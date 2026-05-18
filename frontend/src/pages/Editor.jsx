import TopBar from '../components/layout/TopBar';
import LeftPanel from '../components/layout/LeftPanel';
import EditorPanel from '../components/layout/EditorPanel';
import PreviewPanel from '../components/layout/PreviewPanel';
import useEditorTour from '../hooks/useEditorTour';

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
