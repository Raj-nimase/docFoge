/**
 * AcaDoc Zustand Store — Project State
 */

import { create } from "zustand";
import { getTemplate } from "@/utils/templates";
import * as api from "@/services/api";
import useAuthStore from "@/contexts/authStore/authStore";

const LS_KEY_LEGACY = "acadoc_projects";
const LS_KEY_GUEST = "acadoc_projects_guest";

function userProjectsKey(userId) {
  return `acadoc_projects_u_${userId}`;
}

function getUserIdFromAuth() {
  return useAuthStore.getState().user?.id || null;
}

function loadProjectsFromKey(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProjectsToKey(key, projects) {
  try {
    localStorage.setItem(key, JSON.stringify(projects));
  } catch (_) {}
}

/** One-time: copy legacy shared key into guest-scoped storage. */
function migrateLegacyStorage() {
  try {
    if (localStorage.getItem("acadoc_ls_migrated")) return;
    const legacy = localStorage.getItem(LS_KEY_LEGACY);
    if (legacy && !localStorage.getItem(LS_KEY_GUEST)) {
      localStorage.setItem(LS_KEY_GUEST, legacy);
    }
    localStorage.setItem("acadoc_ls_migrated", "1");
  } catch (_) {}
}

function loadProjectsLocal() {
  migrateLegacyStorage();
  const userId = getUserIdFromAuth();
  const token = api.getStoredToken();
  if (token && userId) {
    return loadProjectsFromKey(userProjectsKey(userId));
  }
  return loadProjectsFromKey(LS_KEY_GUEST);
}

function saveProjectsLocal(projects) {
  migrateLegacyStorage();
  const userId = getUserIdFromAuth();
  const token = api.getStoredToken();
  if (token && userId) {
    saveProjectsToKey(userProjectsKey(userId), projects);
  } else {
    saveProjectsToKey(LS_KEY_GUEST, projects);
  }
}

/** Collect guest + user + legacy local caches for login merge. */
function collectAllLocalProjects() {
  migrateLegacyStorage();
  const userId = getUserIdFromAuth();
  const guest = loadProjectsFromKey(LS_KEY_GUEST);
  const userLocal = userId ? loadProjectsFromKey(userProjectsKey(userId)) : [];
  const legacy = loadProjectsFromKey(LS_KEY_LEGACY);
  return mergeProjectLists(
    mergeProjectLists(guest, userLocal),
    legacy,
  );
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
  if (!doc || typeof doc !== "object") return doc;
  if (Array.isArray(doc)) return doc.map(stripBase64FromDoc);
  if (
    doc.type === "image" &&
    typeof doc.attrs?.src === "string" &&
    doc.attrs.src.startsWith("data:")
  ) {
    return { ...doc, attrs: { ...doc.attrs, src: "" } };
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
    if (sessionStorage.getItem("acadoc_b64_migrated")) return;
    for (const key of [LS_KEY_LEGACY, LS_KEY_GUEST]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const projects = JSON.parse(raw);
      let changed = false;
      const cleaned = projects.map((p) => {
        const cleanFm = p.frontMatter?.map((s) => {
          if (!s.content) return s;
          const cleanDoc = stripBase64FromDoc(s.content);
          if (cleanDoc !== s.content) {
            changed = true;
          }
          return { ...s, content: cleanDoc };
        });
        const cleanCh = p.chapters?.map((c) => {
          if (!c.content) return c;
          const cleanDoc = stripBase64FromDoc(c.content);
          if (cleanDoc !== c.content) {
            changed = true;
          }
          return { ...c, content: cleanDoc };
        });
        return { ...p, frontMatter: cleanFm, chapters: cleanCh };
      });
      if (changed) {
        localStorage.setItem(key, JSON.stringify(cleaned));
        console.log("[projects] migrated: stripped base64 images from", key);
      }
    }
    sessionStorage.setItem("acadoc_b64_migrated", "1");
  } catch (e) {
    console.warn("[projects] base64 migration failed", e.message);
  }
}

// Run migration once at module load — clears any legacy base64 image blobs
migrateLocalBase64Images();

// Module-level dirty set + timer — tracks projects with unsaved cloud changes
const dirtyProjectIds = new Set();
let syncTimer = null;
let storeGet = null;

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

async function fetchCloudProjectsWithRetry(retries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await api.fetchUserProjects({ timeoutMs: 15000 });
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

/**
 * Sync every dirty project to the cloud (not just the active one).
 */
async function flushDirtyProjects(get) {
  const token = api.getStoredToken();
  if (!token || dirtyProjectIds.size === 0) return;

  const { projects } = get();
  const idsToSync = [...dirtyProjectIds];

  await Promise.allSettled(
    idsToSync.map(async (id) => {
      const project = projects.find((p) => p.id === id);
      if (!project) {
        dirtyProjectIds.delete(id);
        return;
      }
      try {
        await api.upsertUserProject(project);
        dirtyProjectIds.delete(id);
      } catch (err) {
        console.warn("[sync]", id, err.message);
      }
    }),
  );
}

/**
 * Debounced sync for all dirty projects.
 * Fires 1.5 s after the last mutation.
 */
function scheduleDirtyProjectsSync(get) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => flushDirtyProjects(get), 1500);
}

/** Immediate sync for a single project (e.g. right after creation). */
async function syncProjectImmediately(get, projectId) {
  const token = api.getStoredToken();
  if (!token) return;

  const project = get().projects.find((p) => p.id === projectId);
  if (!project) return;

  try {
    await api.upsertUserProject(project);
    dirtyProjectIds.delete(projectId);
  } catch (err) {
    console.warn("[sync] immediate", projectId, err.message);
  }
}

function flushDirtyProjectsKeepalive() {
  if (!storeGet) return;
  const token = api.getStoredToken();
  if (!token || dirtyProjectIds.size === 0) return;

  const { projects } = storeGet();
  for (const id of dirtyProjectIds) {
    const project = projects.find((p) => p.id === id);
    if (project) api.upsertUserProjectKeepalive(project);
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushDirtyProjectsKeepalive();
    }
  });
  window.addEventListener("pagehide", flushDirtyProjectsKeepalive);
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

export const useProjectStore = create((set, get) => {
  storeGet = get;

  return {
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
     * Load projects: signed-in users use the cloud list merged with local caches.
     * Local projects missing from cloud or newer than cloud are pushed individually.
     * Guests use localStorage only.
     */
    async loadProjectsForUser(force = false) {
      if (!force && get().projectsLoaded) {
        const token = api.getStoredToken();
        return {
          count: get().projects.length,
          guest: !token,
          authenticated: !!token,
        };
      }

      if (!force && _loadProjectsPromise) return _loadProjectsPromise;

      _loadProjectsPromise = (async () => {
        const t0 = Date.now();
        const token = api.getStoredToken();
        const local = token ? collectAllLocalProjects() : loadProjectsLocal();

        if (token) {
          try {
            const cloud = await fetchCloudProjectsWithRetry();
            const cloudById = new Map(cloud.map((p) => [p.id, p]));

            const projectsToPush = local.filter((p) => {
              const cloudCopy = cloudById.get(p.id);
              return (
                !cloudCopy ||
                (p.updatedAt || 0) > (cloudCopy.updatedAt || 0)
              );
            });

            if (projectsToPush.length > 0) {
              console.log(
                "[projects] pushing local projects to cloud",
                `count=${projectsToPush.length}`,
              );
              await Promise.allSettled(
                projectsToPush.map((p) =>
                  api.upsertUserProject(p).catch((err) =>
                    console.warn(
                      "[projects] failed to push local project",
                      p.id,
                      err.message,
                    ),
                  ),
                ),
              );
            }

            const final =
              projectsToPush.length > 0
                ? await fetchCloudProjectsWithRetry()
                : cloud;

            saveProjectsLocal(final);
            set({ projects: final, projectsLoaded: true });
            const elapsed = Date.now() - t0;
            console.log(
              "[projects] cloud load OK",
              `cloud=${cloud.length}`,
              `pushed=${projectsToPush.length}`,
              `${elapsed}ms`,
            );
            return {
              count: final.length,
              pushed: projectsToPush.length,
              authenticated: true,
            };
          } catch (err) {
            const elapsed = Date.now() - t0;
            console.warn(
              "[projects] cloud load failed",
              err.message,
              `${elapsed}ms`,
            );
            if (local.length > 0) {
              set({ projects: local, projectsLoaded: true });
              return { count: local.length, offline: true, authenticated: true };
            }
            set({ projects: [], projectsLoaded: true });
            return {
              count: 0,
              cloudFailed: true,
              authenticated: true,
              error: err.message,
            };
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
      scheduleDirtyProjectsSync(get);
      syncProjectImmediately(get, project.id);
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
      dirtyProjectIds.delete(projectId);
      set({
        projects: updated,
        currentProjectId:
          get().currentProjectId === projectId ? null : get().currentProjectId,
      });
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
      scheduleDirtyProjectsSync(get);
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
      scheduleDirtyProjectsSync(get);
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
      scheduleDirtyProjectsSync(get);
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
      scheduleDirtyProjectsSync(get);
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
      scheduleDirtyProjectsSync(get);
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
      scheduleDirtyProjectsSync(get);
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
  };
});

export default useProjectStore;
