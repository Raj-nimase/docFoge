import { useState, memo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import useAcaStore from '@/contexts/projectStore/projectStore';

const LeftPanelFrontMatterItem = memo(({ section, isActive, onSelect, onDelete }) => {
  return (
    <div className={`left-panel-item-wrap ${isActive ? 'left-panel-item-wrap--active' : ''}`}>
      <button
        className={`left-panel-item ${isActive ? 'left-panel-item--active' : ''} ${section.auto ? 'left-panel-item--auto' : ''}`}
        onClick={onSelect}
      >
        <span className="left-panel-item-icon">{section.auto ? '⚙' : '📄'}</span>
        <span className="left-panel-item-label">{section.label}</span>
        {section.auto && <span className="left-panel-item-badge">auto</span>}
      </button>
      {!section.auto && !section.required && (
        <button
          className="left-panel-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(section.id);
          }}
          title={`Delete ${section.label}`}
        >✕</button>
      )}
    </div>
  );
});

const LeftPanelChapterItem = memo(({
  ch,
  idx,
  isActive,
  renamingId,
  renameVal,
  onSelect,
  onStartRename,
  onRenameChange,
  onRenameSubmit,
  onCancelRename,
  onDelete,
  provided,
  snapshot
}) => {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      className={`left-panel-item-wrap ${isActive ? 'left-panel-item-wrap--active' : ''} ${snapshot.isDragging ? 'left-panel-item-wrap--dragging' : ''}`}
    >
      <div {...provided.dragHandleProps} className="left-panel-drag-handle">
        ⋮⋮
      </div>

      {renamingId === ch.id ? (
        <input
          className="left-panel-rename-input"
          value={renameVal}
          autoFocus
          onChange={onRenameChange}
          onBlur={() => onRenameSubmit(ch.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onRenameSubmit(ch.id);
            if (e.key === 'Escape') onCancelRename();
          }}
        />
      ) : (
        <button
          className={`left-panel-item ${isActive ? 'left-panel-item--active' : ''}`}
          onClick={onSelect}
          onDoubleClick={onStartRename}
          title="Double-click to rename"
        >
          <span className="left-panel-item-num">{idx + 1}</span>
          <span className="left-panel-item-label">{ch.title}</span>
        </button>
      )}
      {!ch.required && !snapshot.isDragging && (
        <button
          className="left-panel-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(ch.id);
          }}
          title="Delete chapter"
        >✕</button>
      )}
    </div>
  );
});

export default function LeftPanel({ collapsed, onToggleCollapse }) {
  const currentProject   = useAcaStore(s => s.getCurrentProject());
  const activeChapterId   = useAcaStore(s => s.activeChapterId);
  const setActiveChapter  = useAcaStore(s => s.setActiveChapter);
  const addChapter        = useAcaStore(s => s.addChapter);
  const deleteChapter     = useAcaStore(s => s.deleteChapter);
  const deleteFrontMatter = useAcaStore(s => s.deleteFrontMatter);
  const renameChapter     = useAcaStore(s => s.renameChapter);
  const reorderChapters   = useAcaStore(s => s.reorderChapters);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal]   = useState('');
  const [newChTitle, setNewChTitle] = useState('');
  const [addingNew, setAddingNew]   = useState(false);

  const handleRenameSubmit = (id) => {
    if (renameVal.trim()) renameChapter(id, renameVal.trim());
    setRenamingId(null);
  };

  const handleAddChapter = () => {
    if (newChTitle.trim()) {
      addChapter(newChTitle.trim());
      setNewChTitle('');
      setAddingNew(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    if (result.destination.index === result.source.index) return;
    reorderChapters(result.source.index, result.destination.index);
  };

  // ── Collapsed rail — just shows icons for each section/chapter ──────────
  if (collapsed) {
    return (
      <aside
        id="tour-left-panel"
        className="left-panel left-panel--collapsed"
        title="Expand panel"
      >
        {/* Expand toggle at the top */}
        <button
          className="left-panel-collapse-btn left-panel-collapse-btn--collapsed"
          onClick={onToggleCollapse}
          title="Expand panel"
          aria-label="Expand left panel"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="6"  x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        {/* Front matter icons */}
        {currentProject?.frontMatter.map(section => (
          <button
            key={section.id}
            className={`left-panel-rail-btn ${activeChapterId === section.id ? 'left-panel-rail-btn--active' : ''}`}
            onClick={() => setActiveChapter(section.id)}
            title={section.label}
          >
            {section.auto ? '⚙' : '📄'}
          </button>
        ))}

        {/* Chapter number icons */}
        {currentProject?.chapters.map((ch, idx) => (
          <button
            key={ch.id}
            className={`left-panel-rail-btn ${activeChapterId === ch.id ? 'left-panel-rail-btn--active' : ''}`}
            onClick={() => setActiveChapter(ch.id)}
            title={ch.title}
          >
            {idx + 1}
          </button>
        ))}
      </aside>
    );
  }

  // ── Expanded panel ───────────────────────────────────────────────────────
  if (!currentProject) return null;

  return (
    <aside id="tour-left-panel" className="left-panel">
      {/* Header row: project title + collapse button */}
      <div className="left-panel-header">
        <div className="left-panel-header-row">
          <div className="left-panel-project-title">
            {currentProject.metadata?.title || 'Untitled'}
          </div>
          <button
            className="left-panel-collapse-btn"
            onClick={onToggleCollapse}
            title="Collapse panel"
            aria-label="Collapse left panel"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="left-panel-template-badge">
          {currentProject.templateId?.replace(/-/g, ' ')}
        </div>
      </div>

      <nav className="left-panel-nav">
        {/* Front Matter */}
        {currentProject.frontMatter.length > 0 && (
          <div className="left-panel-section">
            <div className="left-panel-section-title">Front Matter</div>
            {currentProject.frontMatter.map(section => (
              <LeftPanelFrontMatterItem
                key={section.id}
                section={section}
                isActive={activeChapterId === section.id}
                onSelect={() => setActiveChapter(section.id)}
                onDelete={deleteFrontMatter}
              />
            ))}
          </div>
        )}

        {/* Chapters */}
        <div className="left-panel-section">
          <div className="left-panel-section-title">Chapters</div>

          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="chapters">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="left-panel-chapters-list"
                >
                  {currentProject.chapters.map((ch, idx) => (
                    <Draggable key={ch.id} draggableId={ch.id} index={idx}>
                      {(provided, snapshot) => (
                        <LeftPanelChapterItem
                          key={ch.id}
                          ch={ch}
                          idx={idx}
                          isActive={activeChapterId === ch.id}
                          renamingId={renamingId}
                          renameVal={renameVal}
                          onSelect={() => setActiveChapter(ch.id)}
                          onStartRename={() => { setRenamingId(ch.id); setRenameVal(ch.title); }}
                          onRenameChange={(e) => setRenameVal(e.target.value)}
                          onRenameSubmit={handleRenameSubmit}
                          onCancelRename={() => setRenamingId(null)}
                          onDelete={deleteChapter}
                          provided={provided}
                          snapshot={snapshot}
                        />
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {/* Add chapter */}
          {addingNew ? (
            <div className="left-panel-add-form">
              <input
                className="left-panel-rename-input"
                placeholder="Chapter title…"
                value={newChTitle}
                autoFocus
                onChange={e => setNewChTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddChapter();
                  if (e.key === 'Escape') setAddingNew(false);
                }}
              />
              <button className="btn-ghost btn-xs" onClick={handleAddChapter}>Add</button>
            </div>
          ) : (
            <button className="left-panel-add-btn" onClick={() => setAddingNew(true)}>
              + Add Chapter
            </button>
          )}
        </div>
      </nav>
    </aside>
  );
}
