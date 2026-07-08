import React from 'react';
import { Alert } from 'react-native';
import { DocumentDrawer } from './ui/DocumentDrawer';
import { useGlobalEditorStore } from '@/stores/editorStore';
import { useProjectStore, selectActiveProject } from '@/stores/projectStore';
import { type Chapter } from '@/services/api';

export function GlobalDrawer() {
  const visible = useGlobalEditorStore(s => s.isDrawerOpen);
  const setDrawerOpen = useGlobalEditorStore(s => s.setDrawerOpen);

  const project = useProjectStore(selectActiveProject);
  const activeChapterId = useProjectStore(s => s.activeChapterId);

  if (!project) return null;

  const switchToChapter = (id: string) => {
    const activeChapterId = useProjectStore.getState().activeChapterId;
    const projectState = useProjectStore.getState();
    const activeProject = projectState.projects.find(p => p.id === projectState.activeProjectId);
    
    const activeSection = activeProject?.chapters.find(c => c.id === activeChapterId) ||
      activeProject?.frontMatter.find(s => s.id === activeChapterId);
      
    const editor = useGlobalEditorStore.getState().bridge;
    if (activeSection && editor) {
      editor.getJSON().then((json: any) => {
        useProjectStore.getState().updateSectionContent(activeSection.id, json);
      });
    }
    if (editor) {
      editor.setContent('');
    }
    useProjectStore.getState().setActiveChapter(id);
  };

  const handleDeleteChapter = (c: Chapter) => {
    Alert.alert('Delete chapter', `Delete "${c.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => useProjectStore.getState().deleteChapter(c.id) },
    ]);
  };

  const handleRenameChapter = (c: Chapter) => {
    const cb = useGlobalEditorStore.getState().onRenameChapterCallback;
    if (cb) cb(c);
  };

  const handleAddChapter = () => {
    const cb = useGlobalEditorStore.getState().onAddChapterCallback;
    if (cb) cb();
  };

  return (
    <DocumentDrawer
      visible={visible}
      onClose={() => setDrawerOpen(false)}
      frontMatter={project.frontMatter}
      chapters={project.chapters}
      activeId={activeChapterId}
      onSelect={id => { switchToChapter(id); setDrawerOpen(false); }}
      onAddChapter={() => { setDrawerOpen(false); handleAddChapter(); }}
      onDeleteChapter={handleDeleteChapter}
      onRenameChapter={handleRenameChapter}
    />
  );
}
