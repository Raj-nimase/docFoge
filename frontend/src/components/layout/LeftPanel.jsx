import { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import useAcaStore from '../../store';

export default function LeftPanel() {
  const currentProject   = useAcaStore(s => s.getCurrentProject());
  const activeChapterId  = useAcaStore(s => s.activeChapterId);
  const setActiveChapter = useAcaStore(s => s.setActiveChapter);
  const addChapter       = useAcaStore(s => s.addChapter);
  const deleteChapter    = useAcaStore(s => s.deleteChapter);
  const renameChapter    = useAcaStore(s => s.renameChapter);
  const reorderChapters  = useAcaStore(s => s.reorderChapters);

  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal]   = useState('');
  const [newChTitle, setNewChTitle] = useState('');
  const [addingNew, setAddingNew]   = useState(false);

  if (!currentProject) return null;

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

  return (
    <aside className="left-panel">
      {/* Project title */}
      <div className="left-panel-header">
        <div className="left-panel-project-title">
          {currentProject.metadata?.title || 'Untitled'}
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
              <button
                key={section.id}
                className={`left-panel-item ${activeChapterId === section.id ? 'left-panel-item--active' : ''} ${section.auto ? 'left-panel-item--auto' : ''}`}
                onClick={() => setActiveChapter(section.id)}
              >
                <span className="left-panel-item-icon">{section.auto ? '⚙' : '📄'}</span>
                <span className="left-panel-item-label">{section.label}</span>
                {section.auto && <span className="left-panel-item-badge">auto</span>}
              </button>
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
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`left-panel-item-wrap ${activeChapterId === ch.id ? 'left-panel-item-wrap--active' : ''} ${snapshot.isDragging ? 'left-panel-item-wrap--dragging' : ''}`}
                        >
                          <div {...provided.dragHandleProps} className="left-panel-drag-handle">
                            ⋮⋮
                          </div>
                          
                          {renamingId === ch.id ? (
                            <input
                              className="left-panel-rename-input"
                              value={renameVal}
                              autoFocus
                              onChange={e => setRenameVal(e.target.value)}
                              onBlur={() => handleRenameSubmit(ch.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameSubmit(ch.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                            />
                          ) : (
                            <button
                              className={`left-panel-item ${activeChapterId === ch.id ? 'left-panel-item--active' : ''}`}
                              onClick={() => setActiveChapter(ch.id)}
                              onDoubleClick={() => { setRenamingId(ch.id); setRenameVal(ch.title); }}
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
                                deleteChapter(ch.id);
                              }}
                              title="Delete chapter"
                            >✕</button>
                          )}
                        </div>
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
