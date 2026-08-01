import useAcaStore from "@/contexts/projectStore/projectStore";
import ChapterEditor from "@/features/Editor/components/ChapterEditor/ChapterEditor";

export default function EditorPanel() {
  const projectId = useAcaStore((s) => s.getCurrentProject()?.id);

  return (
    <main className="editor-panel">
      <ChapterEditor key={projectId || 'multi'} />
    </main>
  );
}
