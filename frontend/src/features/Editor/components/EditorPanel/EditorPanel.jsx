import useAcaStore from "@/contexts/projectStore/projectStore";
import ChapterEditor from "@/features/Editor/components/ChapterEditor/ChapterEditor";
import MetadataForm from "@/features/Editor/components/MetadataForm/MetadataForm";

export default function EditorPanel() {
  const projectTitle = useAcaStore((s) => s.getCurrentProject()?.metadata?.title);
  const projectId = useAcaStore((s) => s.getCurrentProject()?.id);
  const activeSection = useAcaStore((s) => s.getActiveSection());

  return (
    <main className="editor-panel">
      <div className="editor-panel-topbar">
        <div className="editor-panel-breadcrumb">
          <span className="breadcrumb-project">
            {projectTitle || "Project"}
          </span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-chapter">
            {activeSection?.title || activeSection?.label || "Document"}
          </span>
        </div>
        <MetadataForm />
      </div>

      <ChapterEditor key={projectId || 'multi'} />
    </main>
  );
}
