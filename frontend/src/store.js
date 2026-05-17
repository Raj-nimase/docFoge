/**
 * AcaDoc Zustand Store
 *
 * State shape:
 *   projects[]          — all projects, persisted to localStorage
 *   currentProjectId    — ID of the open project
 *   activeChapterId     — currently visible chapter/section
 *   compileJob          — { status, jobId, blobUrl, error }
 *   toast               — { id, type, message }
 */

import { create } from 'zustand';
import { getTemplate } from './lib/templates';

const LS_KEY = 'acadoc_projects';

function loadProjects() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveProjects(projects) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(projects)); } catch (_) {}
}

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Build an initial project structure from a template */
function createProjectFromTemplate(templateId, metadata) {
  const tpl = getTemplate(templateId);
  const now = Date.now();
  return {
    id: genId(),
    templateId,
    createdAt: now,
    updatedAt: now,
    metadata: { ...metadata },
    frontMatter: tpl.frontMatter.map(fm => ({
      ...fm,
      content: null, // TipTap JSON, null until user edits
    })),
    chapters: tpl.chapters.map(ch => ({
      ...ch,
      id: genId(),
      content: null, // TipTap JSON
    })),
  };
}

export const useAcaStore = create((set, get) => ({
  // ── Project list ──────────────────────────────────────────────────────────
  projects: loadProjects(),

  // ── Editor state ─────────────────────────────────────────────────────────
  currentProjectId: null,
  activeChapterId:  null,

  // ── Compile state ─────────────────────────────────────────────────────────
  compileJob: null,  // null | { status, jobId, blobUrl, error }

  // ── Toast ──────────────────────────────────────────────────────────────────
  toast: null,

  // ─────────────────────────────────────────────────────────────────────────
  // Selectors (derived from state)
  // ─────────────────────────────────────────────────────────────────────────

  getCurrentProject() {
    return get().projects.find(p => p.id === get().currentProjectId) || null;
  },

  getActiveSection() {
    const project = get().getCurrentProject();
    if (!project) return null;
    const { activeChapterId } = get();
    return (
      project.frontMatter.find(s => s.id === activeChapterId) ||
      project.chapters.find(c => c.id === activeChapterId) ||
      null
    );
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Project Actions
  // ─────────────────────────────────────────────────────────────────────────

  createProject(templateId, metadata) {
    const project = createProjectFromTemplate(templateId, metadata);
    const firstChapterId = project.chapters[0]?.id || project.frontMatter[0]?.id || null;

    const updated = [project, ...get().projects];
    saveProjects(updated);
    set({
      projects: updated,
      currentProjectId: project.id,
      activeChapterId: firstChapterId,
      compileJob: null,
    });
    return project;
  },

  openProject(projectId) {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;
    const firstId = project.chapters[0]?.id || project.frontMatter[0]?.id || null;
    set({ currentProjectId: projectId, activeChapterId: firstId, compileJob: null });
  },

  deleteProject(projectId) {
    const updated = get().projects.filter(p => p.id !== projectId);
    saveProjects(updated);
    set({
      projects: updated,
      currentProjectId: get().currentProjectId === projectId ? null : get().currentProjectId,
    });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Chapter / Section Actions
  // ─────────────────────────────────────────────────────────────────────────

  setActiveChapter(id) {
    set({ activeChapterId: id });
  },

  updateSectionContent(sectionId, tiptapJson) {
    const { projects, currentProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        frontMatter: p.frontMatter.map(s => s.id === sectionId ? { ...s, content: tiptapJson } : s),
        chapters:    p.chapters.map(c    => c.id === sectionId ? { ...c, content: tiptapJson } : c),
      };
    });
    saveProjects(updated);
    set({ projects: updated });
  },

  updateMetadata(fields) {
    const { projects, currentProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return { ...p, updatedAt: Date.now(), metadata: { ...p.metadata, ...fields } };
    });
    saveProjects(updated);
    set({ projects: updated });
  },

  addChapter(title) {
    const { projects, currentProjectId } = get();
    const newChapter = { id: genId(), title, content: null, required: false };
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return { ...p, updatedAt: Date.now(), chapters: [...p.chapters, newChapter] };
    });
    saveProjects(updated);
    set({ projects: updated, activeChapterId: newChapter.id });
  },

  deleteChapter(chapterId) {
    const { projects, currentProjectId, activeChapterId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return { ...p, updatedAt: Date.now(), chapters: p.chapters.filter(c => c.id !== chapterId) };
    });
    saveProjects(updated);
    const project = updated.find(p => p.id === currentProjectId);
    const nextId  = project?.chapters[0]?.id || project?.frontMatter[0]?.id || null;
    set({ projects: updated, activeChapterId: activeChapterId === chapterId ? nextId : activeChapterId });
  },

  renameChapter(chapterId, newTitle) {
    const { projects, currentProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        chapters: p.chapters.map(c => c.id === chapterId ? { ...c, title: newTitle } : c),
      };
    });
    saveProjects(updated);
    set({ projects: updated });
  },

  reorderChapters(startIndex, endIndex) {
    const { projects, currentProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      const newChapters = Array.from(p.chapters);
      const [removed] = newChapters.splice(startIndex, 1);
      newChapters.splice(endIndex, 0, removed);
      return { ...p, updatedAt: Date.now(), chapters: newChapters };
    });
    saveProjects(updated);
    set({ projects: updated });
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Compile Actions
  // ─────────────────────────────────────────────────────────────────────────

  setCompileJob(job) { set({ compileJob: job }); },

  // ─────────────────────────────────────────────────────────────────────────
  // Toast
  // ─────────────────────────────────────────────────────────────────────────

  showToast(type, message) {
    const id = Date.now();
    set({ toast: { id, type, message } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, 4000);
  },

  clearToast: () => set({ toast: null }),
}));

export default useAcaStore;
