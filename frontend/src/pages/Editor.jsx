import TopBar from '../components/layout/TopBar';
import LeftPanel from '../components/layout/LeftPanel';
import EditorPanel from '../components/layout/EditorPanel';
import PreviewPanel from '../components/layout/PreviewPanel';

export default function Editor({ onGoToDashboard }) {
  return (
    <div className="editor-layout">
      <TopBar onGoToDashboard={onGoToDashboard} />
      <div className="editor-body">
        <LeftPanel />
        <EditorPanel />
        <PreviewPanel />
      </div>
    </div>
  );
}
