import { useState, useEffect, useCallback } from 'react';
import { Search, HelpCircle, Download } from 'lucide-react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import useCompile from '@/features/Editor/hooks/useCompile';
import ToolbarGroups from '@/features/Editor/components/Toolbar/Toolbar';
import MetadataForm from '@/features/Editor/components/MetadataForm/MetadataForm';
import CommandPalette from '@/features/Editor/components/CommandPalette/CommandPalette';

/**
 * Full-width MS Word-style ribbon spanning editor + preview panes.
 * Left: formatting groups (when a rich-text section is active).
 * Right: Settings, Search (⌘K), Tour, Download and Compile actions.
 */
export default function Ribbon({ onGoToDashboard, onStartTour }) {
  const editor = useAcaStore(s => s.editorInstance);
  const { compile, download, isCompiling, isDone, hasProject } = useCompile();

  const [isCmdOpen, setIsCmdOpen] = useState(false);

  // Global Cmd+K and Ctrl+Enter listener (capture phase)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        compile();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [compile]);

  const closeCmd = useCallback(() => setIsCmdOpen(false), []);

  return (
    <>
      <div id="tour-editor-toolbar" className="editor-toolbar editor-ribbon">
        {/* Left tools — Settings + Search, sat beside the text/formatting area */}
        <div className="editor-ribbon-tools">
          <MetadataForm />
          <button
            type="button"
            className="ribbon-action-btn"
            onClick={() => setIsCmdOpen(true)}
            title="Search or command (Ctrl+K)"
          >
            <Search size={15} />
            <span className="ribbon-action-label">Search</span>
            <kbd className="ribbon-kbd">⌘K</kbd>
          </button>
        </div>

        {/* Formatting groups — scroll horizontally when space is tight */}
        <div className="editor-ribbon-groups">
          {editor ? (
            <ToolbarGroups editor={editor} />
          ) : (
            <span className="editor-ribbon-placeholder">
              Select a chapter to format text
            </span>
          )}
        </div>

        {/* Right actions — Tour, Download, Compile */}
        <div className="editor-ribbon-actions">
          {onStartTour && (
            <button
              type="button"
              className="ribbon-action-btn"
              onClick={onStartTour}
              title="Editor tour"
            >
              <HelpCircle size={15} />
              <span className="ribbon-action-label">Tour</span>
            </button>
          )}
          {isDone && (
            <button
              type="button"
              className="ribbon-action-btn ribbon-action-btn--download"
              onClick={download}
              title="Download compiled PDF"
            >
              <Download size={15} />
              <span className="ribbon-action-label">PDF</span>
            </button>
          )}
          <button
            id="tour-compile-btn"
            className={`btn-compile ${isCompiling ? 'btn-compile--loading' : ''}`}
            onClick={compile}
            disabled={isCompiling || !hasProject}
          >
            {isCompiling ? (
              <>
                <span className="compile-spinner" />
                Compiling…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Compile
              </>
            )}
          </button>
        </div>
      </div>

      {/* SaaS Command Palette Modal */}
      <CommandPalette
        isOpen={isCmdOpen}
        onClose={closeCmd}
        editor={editor}
        onGoToDashboard={onGoToDashboard}
        onStartTour={onStartTour}
        onCompile={compile}
        onDownload={download}
      />
    </>
  );
}
