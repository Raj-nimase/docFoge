/**
 * AcaDoc Zustand Store — Project State
 */

import { create } from "zustand";
import { getTemplate } from "@/utils/templates";
import * as api from "@/services/api";

const LS_KEY = "acadoc_projects";

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

/**
 * Walk a Tiptap JSON doc tree and replace any image nodes whose src is a
 * data: URI with a placeholder empty string.
 * Returns the cleaned doc (mutates-in-place for performance).
 */
function stripBase64FromDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc)) return doc.map(stripBase64FromDoc);
  if (doc.type === 'image' && typeof doc.attrs?.src === 'string' && doc.attrs.src.startsWith('data:')) {
    return { ...doc, attrs: { ...doc.attrs, src: '' } };
  }
  if (doc.content) {
    return { ...doc, content: doc.content.map(stripBase64FromDoc) };
  }
  return doc;
}

/**
 * One-time migration: strip base64 images from localStorage projects.
 * Runs once per browser session (gated by sessionStorage flag).
 * This clears the legacy 2+ MB bloat without touching the cloud.
 */
function migrateLocalBase64Images() {
  try {
    if (sessionStorage.getItem('acadoc_b64_migrated')) return;
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const projects = JSON.parse(raw);
    let changed = false;
    const cleaned = projects.map((p) => {
      const cleanFm = p.frontMatter?.map((s) => {
        if (!s.content) return s;
        const cleanDoc = stripBase64FromDoc(s.content);
        if (cleanDoc !== s.content) { changed = true; }
        return { ...s, content: cleanDoc };
      });
      const cleanCh = p.chapters?.map((c) => {
        if (!c.content) return c;
        const cleanDoc = stripBase64FromDoc(c.content);
        if (cleanDoc !== c.content) { changed = true; }
        return { ...c, content: cleanDoc };
      });
      return { ...p, frontMatter: cleanFm, chapters: cleanCh };
    });
    if (changed) {
      localStorage.setItem(LS_KEY, JSON.stringify(cleaned));
      console.log('[projects] migrated: stripped base64 images from localStorage');
    }
    sessionStorage.setItem('acadoc_b64_migrated', '1');
  } catch (e) {
    console.warn('[projects] base64 migration failed', e.message);
  }
}

// Run migration once at module load — clears any legacy base64 image blobs
migrateLocalBase64Images();

// Module-level dirty set + timer — tracks which project has unsaved cloud changes
const dirtyProjectIds = new Set();
let syncTimer = null;

/**
 * Debounced sync for ONLY the currently active project.
 * Fires 1.5 s after the last mutation. Skips the network call if the project
 * is no longer dirty (e.g. a previous save already succeeded).
 */
function scheduleActiveProjectSync(get) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const token = api.getStoredToken();
    if (!token) return;

    const { currentProjectId, projects } = get();
    if (!currentProjectId || !dirtyProjectIds.has(currentProjectId)) return;

    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return;

    try {
      await api.upsertUserProject(project);
      dirtyProjectIds.delete(currentProjectId);
    } catch (err) {
      console.warn('[sync]', err.message);
      // Leave it in dirtyProjectIds so the next edit triggers a retry
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
  return Array.from(byId.values()).sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
  );
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
    frontMatter: tpl.frontMatter.map((fm) => ({
      ...fm,
      content: null,
    })),
    chapters: tpl.chapters.map((ch) => ({
      ...ch,
      id: genId(),
      content: null,
    })),
  };
}
let _loadProjectsPromise = null;

export const useProjectStore = create((set, get) => ({
  projects: [],
  projectsLoaded: false,
  currentProjectId: null,
  activeChapterId: null,
  compileJob: null,
  toast: null,

  getCurrentProject() {
    return get().projects.find((p) => p.id === get().currentProjectId) || null;
  },

  getActiveSection() {
    const project = get().getCurrentProject();
    if (!project) return null;
    const { activeChapterId } = get();
    return (
      project.frontMatter.find((s) => s.id === activeChapterId) ||
      project.chapters.find((c) => c.id === activeChapterId) ||
      null
    );
  },

  /**
   * Load projects: signed-in users use the cloud list as source of truth.
   * Any projects that exist locally but NOT in the cloud (offline-created)
   * are pushed up individually via upsertUserProject — no bulk sync of all projects.
   * Guests use localStorage only.
   */
  async loadProjectsForUser(force = false) {
    // Return cached if already loaded and not forced
    if (!force && get().projectsLoaded) {
      return { count: get().projects.length, guest: !api.getStoredToken() };
    }

    // If a load is already in-flight AND we're not forcing, return the same promise
    if (!force && _loadProjectsPromise) return _loadProjectsPromise;

    _loadProjectsPromise = (async () => {
      const t0 = Date.now();
      const local = loadProjectsLocal();
      const token = api.getStoredToken();

      if (token) {
        try {
          // 1. Fetch the authoritative cloud list
          const cloud = await api.fetchUserProjects();
          const cloudIds = new Set(cloud.map((p) => p.id));

          // 2. Find projects that only exist locally (created while offline / as guest)
          const localOnlyProjects = local.filter((p) => !cloudIds.has(p.id));

          // 3. Push each offline-only project individually — no bulk sync
          if (localOnlyProjects.length > 0) {
            console.log('[projects] pushing offline-only projects', `count=${localOnlyProjects.length}`);
            await Promise.allSettled(
              localOnlyProjects.map((p) =>
                api.upsertUserProject(p).catch((err) =>
                  console.warn('[projects] failed to push offline project', p.id, err.message),
                ),
              ),
            );
          }

          // 4. Re-fetch from cloud so we have the canonical merged list
          const final = localOnlyProjects.length > 0
            ? await api.fetchUserProjects()
            : cloud;

          saveProjectsLocal(final);
          set({ projects: final, projectsLoaded: true });
          const elapsed = Date.now() - t0;
          console.log(
            '[projects] cloud load OK',
            `cloud=${cloud.length}`,
            `pushed=${localOnlyProjects.length}`,
            `${elapsed}ms`,
          );
          return { count: final.length, pushed: localOnlyProjects.length };
        } catch (err) {
          const elapsed = Date.now() - t0;
          console.warn(
            '[projects] cloud load failed, using local cache',
            err.message,
            `${elapsed}ms`,
          );
          if (local.length > 0) {
            set({ projects: local, projectsLoaded: true });
            console.log(
              '[projects] loaded local cache',
              `count=${local.length}`,
              `${Date.now() - t0}ms`,
            );
            return { count: local.length, offline: true };
          }
        }
      }

      set({ projects: local, projectsLoaded: true });
      console.log(
        "[projects] guest/local only",
        `count=${local.length}`,
        `${Date.now() - t0}ms`,
      );
      return { count: local.length, guest: true };
    })();

    try {
      return await _loadProjectsPromise;
    } finally {
      _loadProjectsPromise = null;
    }
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
    const firstChapterId =
      project.chapters[0]?.id || project.frontMatter[0]?.id || null;
    const updated = [project, ...get().projects];
    saveProjectsLocal(updated);
    set({
      projects: updated,
      currentProjectId: project.id,
      activeChapterId: firstChapterId,
      compileJob: null,
    });
    dirtyProjectIds.add(project.id);
    scheduleActiveProjectSync(get);
    return project;
  },

  openProject(projectId) {
    const project = get().projects.find((p) => p.id === projectId);
    if (!project) return;
    const firstId =
      project.chapters[0]?.id || project.frontMatter[0]?.id || null;
    set({
      currentProjectId: projectId,
      activeChapterId: firstId,
      compileJob: null,
    });
  },

  deleteProject(projectId) {
    const updated = get().projects.filter((p) => p.id !== projectId);
    saveProjectsLocal(updated);
    set({
      projects: updated,
      currentProjectId:
        get().currentProjectId === projectId ? null : get().currentProjectId,
    });
    // No scheduleActiveProjectSync here — deletion is handled by its own DELETE endpoint
    if (api.getStoredToken()) {
      api
        .deleteUserProject(projectId)
        .catch((err) => console.warn("[delete]", err.message));
    }
  },

  setActiveChapter(id) {
    set({ activeChapterId: id });
  },

  updateSectionContent(sectionId, tiptapJson) {
    const { projects, currentProjectId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        frontMatter: p.frontMatter.map((s) =>
          s.id === sectionId ? { ...s, content: tiptapJson } : s,
        ),
        chapters: p.chapters.map((c) =>
          c.id === sectionId ? { ...c, content: tiptapJson } : c,
        ),
      };
    });
    saveProjectsLocal(updated);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
    scheduleActiveProjectSync(get);
  },

  updateMetadata(fields) {
    const { projects, currentProjectId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        metadata: { ...p.metadata, ...fields },
      };
    });
    saveProjectsLocal(updated);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
    scheduleActiveProjectSync(get);
  },

  addChapter(title) {
    const { projects, currentProjectId } = get();
    const newChapter = { id: genId(), title, content: null, required: false };
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        chapters: [...p.chapters, newChapter],
      };
    });
    saveProjectsLocal(updated);
    set({ projects: updated, activeChapterId: newChapter.id });
    dirtyProjectIds.add(currentProjectId);
    scheduleActiveProjectSync(get);
  },

  deleteChapter(chapterId) {
    const { projects, currentProjectId, activeChapterId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        chapters: p.chapters.filter((c) => c.id !== chapterId),
      };
    });
    saveProjectsLocal(updated);
    const project = updated.find((p) => p.id === currentProjectId);
    const nextId =
      project?.chapters[0]?.id || project?.frontMatter[0]?.id || null;
    set({
      projects: updated,
      activeChapterId: activeChapterId === chapterId ? nextId : activeChapterId,
    });
    dirtyProjectIds.add(currentProjectId);
    scheduleActiveProjectSync(get);
  },

  renameChapter(chapterId, newTitle) {
    const { projects, currentProjectId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        chapters: p.chapters.map((c) =>
          c.id === chapterId ? { ...c, title: newTitle } : c,
        ),
      };
    });
    saveProjectsLocal(updated);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
    scheduleActiveProjectSync(get);
  },

  reorderChapters(startIndex, endIndex) {
    const { projects, currentProjectId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      const newChapters = Array.from(p.chapters);
      const [removed] = newChapters.splice(startIndex, 1);
      newChapters.splice(endIndex, 0, removed);
      return { ...p, updatedAt: Date.now(), chapters: newChapters };
    });
    saveProjectsLocal(updated);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
    scheduleActiveProjectSync(get);
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

export default useProjectStore;
