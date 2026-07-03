import useAcaStore from "@/contexts/projectStore/projectStore";
import ChapterEditor from "@/features/Editor/components/ChapterEditor/ChapterEditor";
import MetadataForm from "@/features/Editor/components/MetadataForm/MetadataForm";

export default function EditorPanel() {
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const activeChapterId = useAcaStore((s) => s.activeChapterId);
  const getActiveSection = useAcaStore((s) => s.getActiveSection);
  const updateSectionContent = useAcaStore((s) => s.updateSectionContent);

  const section = getActiveSection();

  // Find the chapter number for active chapter
  const chapterIndex = currentProject?.chapters.findIndex(
    (ch) => ch.id === activeChapterId,
  );
  const chapterNumber = chapterIndex >= 0 ? chapterIndex + 1 : null;

  // Auto sections (title_page, toc) are not editable
  const isAutoSection = section?.auto === true;

  return (
    <main className="editor-panel">
      <div className="editor-panel-topbar">
        <div className="editor-panel-breadcrumb">
          <span className="breadcrumb-project">
            {currentProject?.metadata?.title || "Project"}
          </span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-chapter">
            {section?.label || section?.title || "—"}
          </span>
        </div>
        <MetadataForm />
      </div>

      {isAutoSection ? (
        <div className="auto-section-notice">
          <div className="auto-section-icon">⚙</div>
          <div className="auto-section-text">
            <strong>{section.label}</strong> is generated automatically from
            your document settings.
          </div>
          <div className="auto-section-hint">
            Edit your title, authors, and institution in ⚙ Settings.
          </div>
        </div>
      ) : section ? (
        <ChapterEditor
          key={activeChapterId}
          sectionId={activeChapterId}
          chapterNumber={chapterNumber}
          onContentChange={(json) =>
            updateSectionContent(activeChapterId, json)
          }
        />
      ) : (
        <div className="editor-empty-state">
          <div className="editor-empty-icon">📝</div>
          <div className="editor-empty-text">
            Select a chapter from the left panel to start editing
          </div>
        </div>
      )}
    </main>
  );
}
