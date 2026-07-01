import { useEffect, useCallback, useRef } from 'react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import {
  hasCompletedEditorTour,
  startEditorTour,
} from '@/utils/editorTour';

function ensureEditableSection() {
  const store = useAcaStore.getState();
  const project = store.getCurrentProject();
  if (!project) return;

  const active = store.getActiveSection();
  if (active && !active.auto) return;

  const editableChapter = project.chapters[0];
  const editableFrontMatter = project.frontMatter.find(s => !s.auto);
  const targetId = editableChapter?.id ?? editableFrontMatter?.id;
  if (targetId) store.setActiveChapter(targetId);
}

/**
 * Runs the editor onboarding tour on first visit.
 * @param {{ autoStart?: boolean }} [options]
 */
export default function useEditorTour({ autoStart = true } = {}) {
  const tourStarted = useRef(false);

  const runTour = useCallback((replay = false) => {
    ensureEditableSection();
    requestAnimationFrame(() => {
      setTimeout(() => startEditorTour({ markComplete: !replay }), 400);
    });
  }, []);

  useEffect(() => {
    if (!autoStart || tourStarted.current) return;
    if (hasCompletedEditorTour()) return;

    const project = useAcaStore.getState().getCurrentProject();
    if (!project) return;

    tourStarted.current = true;
    runTour();
  }, [autoStart, runTour]);

  return { runTour, hasCompleted: hasCompletedEditorTour };
}
