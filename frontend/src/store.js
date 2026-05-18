/**
 * AcaDoc Zustand Store
 */

import { create } from 'zustand';
import { getTemplate } from './lib/templates';
import * as api from './api';

const LS_KEY = 'acadoc_projects';

function loadProjectsLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjectsLocal(projects) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(projects));
  } catch (_) {}
}

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

let syncTimer = null;

function scheduleCloudSync(get) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const token = api.getStoredToken();
    if (!token) return;
    try {
      await api.syncUserProjects(get().projects);
    } catch (err) {
      console.warn('[sync]', err.message);
    }
  }, 1500);
}

/** Merge cloud and local project lists; newer updatedAt wins per project id */
function mergeProjectLists(cloud = [], local = []) {
  const byId = new Map();
  for (const p of cloud) byId.set(p.id, p);
  for (const p of local) {
    const existing = byId.get(p.id);
    if (!existing || (p.updatedAt || 0) >= (existing.updatedAt || 0)) {
      byId.set(p.id, p);
    }
  }
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

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
      content: null,
    })),
    chapters: tpl.chapters.map(ch => ({
      ...ch,
      id: genId(),
      content: null,
    })),
  };
}

export const useAcaStore = create((set, get) => ({
  projects: [],
  projectsLoaded: false,
  currentProjectId: null,
  activeChapterId: null,
  compileJob: null,
  toast: null,

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

  /**
   * Load projects: signed-in users merge cloud + this browser, then sync to cloud.
   * Guests use local storage only.
   */
  async loadProjectsForUser() {
    const local = loadProjectsLocal();
    const token = api.getStoredToken();

    if (token) {
      try {
        const cloud = await api.fetchUserProjects();
        const merged = mergeProjectLists(cloud, local);
        const synced = await api.syncUserProjects(merged);
        saveProjectsLocal(synced);
        set({ projects: synced, projectsLoaded: true });
        return { count: synced.length, merged: merged.length !== cloud.length };
      } catch (err) {
        console.warn('[projects] cloud load failed, using local cache', err.message);
        if (local.length > 0) {
          set({ projects: local, projectsLoaded: true });
          return { count: local.length, offline: true };
        }
      }
    }

    set({ projects: local, projectsLoaded: true });
    return { count: local.length, guest: true };
  },

  resetProjects() {
    set({
      projects: [],
      projectsLoaded: false,
      currentProjectId: null,
      activeChapterId: null,
      compileJob: null,
    });
  },

  createProject(templateId, metadata) {
    const project = createProjectFromTemplate(templateId, metadata);
    const firstChapterId = project.chapters[0]?.id || project.frontMatter[0]?.id || null;
    const updated = [project, ...get().projects];
    saveProjectsLocal(updated);
    set({
      projects: updated,
      currentProjectId: project.id,
      activeChapterId: firstChapterId,
      compileJob: null,
    });
    scheduleCloudSync(get);
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
    saveProjectsLocal(updated);
    set({
      projects: updated,
      currentProjectId: get().currentProjectId === projectId ? null : get().currentProjectId,
    });
    scheduleCloudSync(get);
    if (api.getStoredToken()) {
      api.deleteUserProject(projectId).catch(err => console.warn('[delete]', err.message));
    }
  },

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
        frontMatter: p.frontMatter.map(s => (s.id === sectionId ? { ...s, content: tiptapJson } : s)),
        chapters: p.chapters.map(c => (c.id === sectionId ? { ...c, content: tiptapJson } : c)),
      };
    });
    saveProjectsLocal(updated);
    set({ projects: updated });
    scheduleCloudSync(get);
  },

  updateMetadata(fields) {
    const { projects, currentProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return { ...p, updatedAt: Date.now(), metadata: { ...p.metadata, ...fields } };
    });
    saveProjectsLocal(updated);
    set({ projects: updated });
    scheduleCloudSync(get);
  },

  addChapter(title) {
    const { projects, currentProjectId } = get();
    const newChapter = { id: genId(), title, content: null, required: false };
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return { ...p, updatedAt: Date.now(), chapters: [...p.chapters, newChapter] };
    });
    saveProjectsLocal(updated);
    set({ projects: updated, activeChapterId: newChapter.id });
    scheduleCloudSync(get);
  },

  deleteChapter(chapterId) {
    const { projects, currentProjectId, activeChapterId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return { ...p, updatedAt: Date.now(), chapters: p.chapters.filter(c => c.id !== chapterId) };
    });
    saveProjectsLocal(updated);
    const project = updated.find(p => p.id === currentProjectId);
    const nextId = project?.chapters[0]?.id || project?.frontMatter[0]?.id || null;
    set({
      projects: updated,
      activeChapterId: activeChapterId === chapterId ? nextId : activeChapterId,
    });
    scheduleCloudSync(get);
  },

  renameChapter(chapterId, newTitle) {
    const { projects, currentProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        chapters: p.chapters.map(c => (c.id === chapterId ? { ...c, title: newTitle } : c)),
      };
    });
    saveProjectsLocal(updated);
    set({ projects: updated });
    scheduleCloudSync(get);
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
    saveProjectsLocal(updated);
    set({ projects: updated });
    scheduleCloudSync(get);
  },

  setCompileJob(job) {
    set({ compileJob: job });
  },

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
