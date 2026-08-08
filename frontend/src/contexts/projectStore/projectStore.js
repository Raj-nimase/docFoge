/**
 * AcaDoc Zustand Store — Project State
 */

import { create } from "zustand";
import { getTemplate } from "@/utils/templates";
import * as api from "@/services/api";
import { getIDBItem, setIDBItem, delIDBItem } from "@/utils/idbStorage";

const LS_KEY = "acadoc_projects";

// ── Local & IndexedDB Persistence Helpers ─────────────────────────────────────

function loadProjectsLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map(cleanupProjectFrontMatter);
  } catch {
    return [];
  }
}

// Debounced IndexedDB & localStorage writer.
// Persists full projects array to IndexedDB (asynchronous, gigabyte-scale capacity).
let _lsTimer = null;
let _lsPending = null; // latest projects array waiting to be written

function saveProjectsLocal(projects, immediate = false) {
  _lsPending = projects;
  if (immediate) {
    if (_lsTimer) { clearTimeout(_lsTimer); _lsTimer = null; }
    _flushLocalStorage();
  } else {
    if (_lsTimer) clearTimeout(_lsTimer);
    _lsTimer = setTimeout(_flushLocalStorage, 1000);
  }
}

function _flushLocalStorage() {
  if (_lsPending === null) return;
  const data = _lsPending;
  _lsPending = null;
  _lsTimer   = null;

  // 1. Production Storage: Write full projects to IndexedDB (no 5MB quota restrictions)
  setIDBItem(LS_KEY, data);

  // 2. Best-effort mirror to synchronous localStorage for instant cold start
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (err) {
    // If localStorage quota (5MB) is hit, cache top 5 projects in localStorage as fallback
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data.slice(0, 5)));
    } catch (_) {}
  }
}

const TOMBSTONES_KEY = "acadoc_tombstones";
const SYNC_QUEUE_KEY = "acadoc_sync_queue";

// ── Tombstone Ledger Helpers ───────────────────────────────────────────────────

function loadTombstones() {
  try {
    const raw = localStorage.getItem(TOMBSTONES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function addTombstone(projectId) {
  try {
    const tombstones = loadTombstones();
    tombstones[projectId] = Date.now();
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(tombstones));
  } catch (_) {}
}

function removeTombstone(projectId) {
  try {
    const tombstones = loadTombstones();
    delete tombstones[projectId];
    localStorage.setItem(TOMBSTONES_KEY, JSON.stringify(tombstones));
  } catch (_) {}
}

export function clearTombstones() {
  try {
    localStorage.removeItem(TOMBSTONES_KEY);
  } catch (_) {}
}

// ── Durable Sync Queue Helpers ───────────────────────────────────────────────

function loadSyncQueue() {
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSyncQueue(queue) {
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (_) {}
}

function enqueueSyncItem(item) {
  const queue = loadSyncQueue();
  const filtered = queue.filter(q => !(q.projectId === item.projectId && q.type === item.type));
  filtered.push({
    id: genId(),
    timestamp: Date.now(),
    attempts: 0,
    ...item,
  });
  saveSyncQueue(filtered);
}

function dequeueSyncItem(queueId) {
  const queue = loadSyncQueue();
  const filtered = queue.filter(q => q.id !== queueId);
  saveSyncQueue(filtered);
}

export function clearSyncQueue() {
  try {
    localStorage.removeItem(SYNC_QUEUE_KEY);
  } catch (_) {}
}

// ── Background Queue Worker (Debounced Batch Coalescing) ──────────────────────
let _isProcessingQueue = false;
let _debounceSyncTimer = null;

export function scheduleSyncQueue(delayMs = 3000) {
  if (_debounceSyncTimer) {
    clearTimeout(_debounceSyncTimer);
  }
  _debounceSyncTimer = setTimeout(() => {
    _debounceSyncTimer = null;
    processSyncQueue();
  }, delayMs);
}

export async function processSyncQueue() {
  if (_debounceSyncTimer) {
    clearTimeout(_debounceSyncTimer);
    _debounceSyncTimer = null;
  }
  if (_isProcessingQueue) return;
  const initialToken = api.getStoredToken();
  if (!initialToken) return;

  _isProcessingQueue = true;
  try {
    const queue = loadSyncQueue();
    if (queue.length === 0) return;

    const deleteIds = [];
    const dirtyProjectsMap = new Map();
    const processedItemIds = [];

    for (const item of queue) {
      if (item.type === 'DELETE') {
        dirtyProjectsMap.delete(item.projectId);
        if (!deleteIds.includes(item.projectId)) deleteIds.push(item.projectId);
        processedItemIds.push(item.id);
      } else if (item.type === 'UPSERT' || item.type === 'TRASH' || item.type === 'RESTORE') {
        if (item.payload) {
          const sanitized = {
            ...item.payload,
            chapters: (item.payload.chapters || []).map(ch => ({
              ...ch,
              content: stripBase64FromDoc(ch.content),
            })),
            frontMatter: (item.payload.frontMatter || []).map(fm => ({
              ...fm,
              content: stripBase64FromDoc(fm.content),
            })),
          };
          dirtyProjectsMap.set(item.projectId, sanitized);
          const delIdx = deleteIds.indexOf(item.projectId);
          if (delIdx !== -1) deleteIds.splice(delIdx, 1);
        }
        processedItemIds.push(item.id);
      }
    }

    const projectsToUpsert = Array.from(dirtyProjectsMap.values());

    if (projectsToUpsert.length === 0 && deleteIds.length === 0) {
      return;
    }

    const currentToken = api.getStoredToken();
    if (!currentToken || currentToken !== initialToken) {
      console.warn('[syncQueue] Aborting queue execution — session changed');
      return;
    }

    console.log('[syncQueue] Executing debounced batch sync:', { upserts: projectsToUpsert.length, deletes: deleteIds.length });
    await api.syncUserProjects({ projects: projectsToUpsert, deleteIds });

    // Bulk dequeue all processed items
    for (const itemId of processedItemIds) {
      dequeueSyncItem(itemId);
    }
  } catch (err) {
    console.warn('[syncQueue] Batch sync error:', err.message || err);
  } finally {
    _isProcessingQueue = false;
  }
}

export async function clearProjectsLocal() {
  if (_lsTimer) {
    clearTimeout(_lsTimer);
    _lsTimer = null;
  }
  _lsPending = null;
  _lastSyncTime = 0;
  _projectsLoadedOnce = false;
  _loadProjectsPromise = null;

  try {
    localStorage.removeItem(LS_KEY);
    clearTombstones();
    clearSyncQueue();
    sessionStorage.removeItem('acadoc_b64_migrated');
  } catch (_) {}

  // Await IndexedDB deletion to guarantee completion before any new user login transition
  await delIDBItem(LS_KEY);
}

// Safety net: if the user closes the tab or switches apps while a debounced sync is pending,
// flush it using fetch with keepalive: true and proper Authorization header.
if (typeof window !== 'undefined') {
  const flushPendingBeacon = () => {
    if (_lsPending !== null) {
      try { localStorage.setItem(LS_KEY, JSON.stringify(_lsPending)); } catch (_) {}
    }

    try {
      const queue = loadSyncQueue();
      if (queue.length === 0) return;

      const deleteIds = [];
      const dirtyProjectsMap = new Map();

      for (const item of queue) {
        if (item.type === 'DELETE') {
          dirtyProjectsMap.delete(item.projectId);
          if (!deleteIds.includes(item.projectId)) deleteIds.push(item.projectId);
        } else if (item.type === 'UPSERT' || item.type === 'TRASH' || item.type === 'RESTORE') {
          if (item.payload) {
            dirtyProjectsMap.set(item.projectId, item.payload);
            const delIdx = deleteIds.indexOf(item.projectId);
            if (delIdx !== -1) deleteIds.splice(delIdx, 1);
          }
        }
      }

      const projectsToUpsert = Array.from(dirtyProjectsMap.values());
      if (projectsToUpsert.length === 0 && deleteIds.length === 0) return;

      const token = api.getStoredToken();
      if (!token) return;

      const payload = JSON.stringify({ projects: projectsToUpsert, deleteIds });
      const backendUrl = api.API_BASE_URL || 'http://localhost:3001/api';

      // Use fetch with keepalive: true so auth header is preserved on unload
      fetch(`${backendUrl}/projects/sync/all`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  };

  window.addEventListener('beforeunload', flushPendingBeacon);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushPendingBeacon();
    }
  });
}

function genId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Walk a JSON doc tree (TipTap doc or Canvas Scene) and replace any image
 * nodes/objects whose src is a data: URI with a placeholder empty string.
 * Returns the cleaned doc.
 */
function stripBase64FromDoc(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc)) return doc.map(stripBase64FromDoc);

  let updatedDoc = doc;

  if (updatedDoc.type === 'image' && typeof updatedDoc.attrs?.src === 'string' && updatedDoc.attrs.src.startsWith('data:')) {
    updatedDoc = { ...updatedDoc, attrs: { ...updatedDoc.attrs, src: '' } };
  }

  if (Array.isArray(updatedDoc.objects)) {
    const hasBase64Src = updatedDoc.objects.some(obj => typeof obj?.src === 'string' && obj.src.startsWith('data:'));
    if (hasBase64Src) {
      updatedDoc = {
        ...updatedDoc,
        objects: updatedDoc.objects.map(obj => {
          if (typeof obj?.src === 'string' && obj.src.startsWith('data:')) {
            return { ...obj, src: '' };
          }
          return obj;
        }),
      };
    }
  }

  if (updatedDoc.content) {
    const newContent = stripBase64FromDoc(updatedDoc.content);
    if (newContent !== updatedDoc.content) {
      updatedDoc = { ...updatedDoc, content: newContent };
    }
  }

  return updatedDoc;
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

// Module-level dirty set — tracks which project has unsaved cloud changes
const dirtyProjectIds = new Set();
let _compileActive = false;  // set true while a compile job is running

/** Called by TopBar before/after compile so sync doesn't race with Tectonic */
export function setCompileActive(active) { _compileActive = active; }

function createProjectFromTemplate(templateId, metadata) {
  const tpl = getTemplate(templateId);
  const now = Date.now();
  return {
    id: genId(),
    templateId,
    createdAt: now,
    updatedAt: now,
    metadata: {
      fontFamily: 'Times New Roman',
      fontSize: '12pt',
      lineSpacing: '1.5',
      pageSize: 'a4paper',
      marginTop: '2.5cm',
      marginBottom: '2.5cm',
      marginLeft: '3.5cm',
      marginRight: '1.25cm',
      enableChapterNumbers: true,
      enableListOfFigures: true,
      enableListOfTables: true,
      ...metadata,
    },
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
let _projectsLoadedOnce = false;  // true once any successful load completes
let _lastSyncTime = 0;             // timestamp of last completed cloud sync
const SYNC_THROTTLE_MS = 30_000;   // don't re-sync within 30 seconds

function cleanupProjectFrontMatter(project) {
  if (!project) return project;
  const template = getTemplate(project.templateId || 'diploma-project-report');
  const tplFm = template?.frontMatter || [];

  const existingFm = project.frontMatter || [];
  const existingFmIds = new Set(existingFm.map((fm) => fm.id));
  const existingFmLabels = new Set(existingFm.map((fm) => (fm.label || "").toLowerCase()));

  // 1. Auto-restore missing required template frontMatter sections (Certificate, Acknowledgement, Abstract, etc.)
  const restoredFm = [...existingFm];
  for (const tFm of tplFm) {
    const isMissing = !existingFmIds.has(tFm.id) && !existingFmLabels.has((tFm.label || "").toLowerCase());
    if (isMissing) {
      restoredFm.push({
        ...tFm,
        content: null,
      });
    }
  }

  // Preserve correct template order for frontMatter
  if (tplFm.length > 0) {
    const orderMap = new Map(tplFm.map((t, idx) => [t.id, idx]));
    restoredFm.sort((a, b) => {
      const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : 99;
      const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : 99;
      return orderA - orderB;
    });
  }

  // 2. Remove misplaced chapters that duplicate frontMatter sections
  const fmLabels = new Set(restoredFm.map((fm) => (fm.label || "").trim().toLowerCase()));
  const misplacedChs = (project.chapters || []).filter((ch) =>
    fmLabels.has((ch.title || "").trim().toLowerCase())
  );

  const cleanChapters = (project.chapters || []).filter(
    (ch) => !fmLabels.has((ch.title || "").trim().toLowerCase())
  );

  for (const ch of misplacedChs) {
    const label = ch.title.trim().toLowerCase();
    const existingIndex = restoredFm.findIndex(
      (fm) => fm.label?.toLowerCase() === label || fm.id === label
    );
    if (existingIndex >= 0) {
      if (!restoredFm[existingIndex].content && ch.content) {
        restoredFm[existingIndex] = { ...restoredFm[existingIndex], content: ch.content };
      }
    }
  }

  return {
    ...project,
    frontMatter: restoredFm,
    chapters: cleanChapters,
  };
}

export const useProjectStore = create((set, get) => ({
  projects: [],
  projectsLoaded: false,
  currentProjectId: null,
  activeChapterId: null,
  compileJob: null,
  toast: null,
  // Transient TipTap editor instance published by MultiChapterEditor (never persisted)
  editorInstance: null,

  setEditorInstance(editor) {
    set({ editorInstance: editor });
  },

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
   *
   * Architecture guarantees:
   *  • Projects are fetched ONCE on app load, then cached in memory + localStorage.
   *  • Subsequent calls within SYNC_THROTTLE_MS return the cached result.
   *  • If a sync is already in-flight, all callers join that promise (no duplicates).
   *  • force=true bypasses the throttle (used only on explicit login).
   */
  async loadProjectsForUser(force = false) {
    const t0 = Date.now();
    const token = api.getStoredToken();

    // ── Dedup: if a sync is already running, join it immediately ───
    if (_loadProjectsPromise) {
      console.log('[projects] sync already in-flight — joining existing promise');
      return _loadProjectsPromise;
    }

    // ── Throttle: skip duplicate cloud sync if we synced in the last 3 seconds ───
    if (!force && _projectsLoadedOnce && (Date.now() - _lastSyncTime) < SYNC_THROTTLE_MS) {
      console.log('[projects] sync throttled — using cached data', `(${Math.round((Date.now() - _lastSyncTime) / 1000)}s since last sync)`);
      return { count: get().projects.length, cached: true };
    }
    if (force && _projectsLoadedOnce && (Date.now() - _lastSyncTime) < 3000) {
      console.log('[projects] sync completed very recently — skipping redundant force sync');
      return { count: get().projects.length, cached: true };
    }

    if (force) {
      // Force reload / User transition: reset sync state and wipe local baseline
      _lastSyncTime = 0;
      _projectsLoadedOnce = false;
      await clearProjectsLocal();
      set({ projects: [], projectsLoaded: false });
    }

    // Read local cache from both localStorage and IndexedDB (only when NOT forced)
    const lsLocal = force ? [] : loadProjectsLocal();
    const idbLocal = force ? [] : ((await getIDBItem(LS_KEY)) || []);
    const inMemoryProjects = force ? [] : get().projects;

    const tombstones = loadTombstones();
    const syncQueue = loadSyncQueue();
    const pendingDeleteIds = new Set(
      syncQueue
        .filter((q) => q.type === "DELETE" || q.type === "TRASH")
        .map((q) => q.projectId)
    );

    // Sanitize local caches against tombstones and pending deletion queues
    const cleanLs = lsLocal.filter(p => !tombstones[p.id] && !pendingDeleteIds.has(p.id));
    const cleanIdb = idbLocal.filter(p => !tombstones[p.id] && !pendingDeleteIds.has(p.id));
    const cleanMemory = inMemoryProjects.filter(p => !tombstones[p.id] && !pendingDeleteIds.has(p.id));

    // Prefer fresh localStorage/clean memory baseline
    const local = cleanLs.length >= cleanIdb.length ? cleanLs : cleanIdb;
    const effectiveLocal = local.length > 0 ? local : cleanMemory;

    // Immediately set clean local cached projects so UI is instant and zero-zombie!
    if (effectiveLocal.length > 0 || !force) {
      set({ projects: effectiveLocal, projectsLoaded: true });
    }

    if (!token) {
      _projectsLoadedOnce = true;
      set({ projects: effectiveLocal, projectsLoaded: true });
      return { count: effectiveLocal.length, guest: true };
    }

    _loadProjectsPromise = (async () => {
      try {
        // Await any pending durable sync queue items (e.g. recent deletes) BEFORE checking cloud status!
        if (loadSyncQueue().length > 0) {
          await processSyncQueue();
        }

        // Fetch the lightweight cloud sync status
        const cloudSync = await api.fetchProjectSyncStatus();
        const tombstones = loadTombstones();
        const syncQueue = loadSyncQueue();
        const pendingDeleteIds = new Set(
          syncQueue
            .filter((q) => q.type === "DELETE" || q.type === "TRASH")
            .map((q) => q.projectId)
        );

        // Guard against zombie cloud projects: ignore any cloud project that is tombstoned, trashed, or pending deletion!
        const validCloudSync = cloudSync.filter(
          (p) => !p.deletedAt && !tombstones[p.id] && !pendingDeleteIds.has(p.id)
        );

        const cloudMap = new Map(validCloudSync.map((p) => [p.id, p.updatedAt]));
        const localMap = new Map(effectiveLocal.map((p) => [p.id, p.updatedAt || 0]));

        const toDownload = [];
        const toUpload = [];

        // Check valid cloud projects
        for (const cloudProj of validCloudSync) {
          // FAILSAFE GUARD: Never download a tombstoned, pending-delete, or trashed project!
          if (tombstones[cloudProj.id] || pendingDeleteIds.has(cloudProj.id) || cloudProj.deletedAt) {
            continue;
          }
          const localUpdated = localMap.get(cloudProj.id);
          if (localUpdated === undefined) {
            toDownload.push(cloudProj.id);
          } else if (cloudProj.updatedAt > localUpdated) {
            toDownload.push(cloudProj.id);
          }
        }

        // Check local projects (only during non-forced background sync)
        if (!force) {
          for (const localProj of effectiveLocal) {
            if (tombstones[localProj.id] || pendingDeleteIds.has(localProj.id)) continue;
            const cloudUpdated = cloudMap.get(localProj.id);
            if (cloudUpdated === undefined) {
              toUpload.push(localProj);
            } else if (localProj.updatedAt > cloudUpdated) {
              toUpload.push(localProj);
            }
          }
        }

        console.log('[projects] delta sync analysis:', {
          force,
          localCount: effectiveLocal.length,
          cloudCount: validCloudSync.length,
          toDownload: toDownload.length,
          toUpload: toUpload.length
        });

        // If everything is already in sync and not forced, skip the download phase
        if (!force && toDownload.length === 0 && toUpload.length === 0) {
          console.log('[projects] already in sync — no changes needed');
          _projectsLoadedOnce = true;
          _lastSyncTime = Date.now();
          return { count: effectiveLocal.length, downloaded: 0, uploaded: 0 };
        }

        let updatedLocal = force ? [] : [...effectiveLocal].filter(
          (p) => !tombstones[p.id] && !pendingDeleteIds.has(p.id)
        );

        // Download missing/updated projects
        if (toDownload.length > 0) {
          const downloaded = await Promise.all(
            toDownload.map((id) =>
              api.fetchProject(id).catch((err) => {
                console.warn('[projects] failed to download project', id, err.message);
                return null;
              })
            )
          );

          const downloadedValid = downloaded.filter(Boolean);
          const downloadedIds = new Set(downloadedValid.map((p) => p.id));
          updatedLocal = [
            ...downloadedValid,
            ...updatedLocal.filter((p) => !downloadedIds.has(p.id)),
          ];
        }

        // Filter out any local projects that don't belong to this cloud user when force=true
        if (force) {
          const cloudIds = new Set(validCloudSync.map((p) => p.id));
          updatedLocal = updatedLocal.filter((p) => cloudIds.has(p.id));
        }

        // Upload local offline changes/new projects (only during non-forced background sync)
        if (toUpload.length > 0 && !force) {
          await Promise.allSettled(
            toUpload.map(p => api.upsertUserProject(p).catch(err =>
              console.warn('[projects] failed to sync local changes to cloud', p.id, err.message)
            ))
          );
        }

        // Merge in-memory projects ONLY when NOT forced
        if (!force) {
          const inMemory = get().projects;
          const updatedSet = new Set(updatedLocal.map(p => p.id));
          for (const p of inMemory) {
            if (!updatedSet.has(p.id)) {
              updatedLocal.push(p);
              updatedSet.add(p.id);
            }
          }
        }

        // Sort by updatedAt descending
        updatedLocal.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        saveProjectsLocal(updatedLocal, true);
        set({ projects: updatedLocal, projectsLoaded: true });
        _projectsLoadedOnce = true;
        _lastSyncTime = Date.now();

        const elapsed = Date.now() - t0;
        console.log('[projects] delta sync completed', `${elapsed}ms`, { count: updatedLocal.length, downloaded: toDownload.length });
        return { count: updatedLocal.length, downloaded: toDownload.length, uploaded: toUpload.length };
      } catch (err) {
        const elapsed = Date.now() - t0;
        console.warn('[projects] delta sync failed, using local cache', err.message, `${elapsed}ms`);
        const inMemory = get().projects;
        const localSet = new Set(effectiveLocal.map(p => p.id));
        for (const p of inMemory) {
          if (!localSet.has(p.id)) {
            effectiveLocal.push(p);
            localSet.add(p.id);
          }
        }
        set({ projects: effectiveLocal, projectsLoaded: true });
        _projectsLoadedOnce = true;
        _lastSyncTime = Date.now(); // prevent rapid retries on failure
        return { count: effectiveLocal.length, offline: true };
      }
    })();

    try {
      return await _loadProjectsPromise;
    } finally {
      _loadProjectsPromise = null;
    }
  },

  async resetProjects(clearStorage = false) {
    if (_lsTimer) {
      clearTimeout(_lsTimer);
      _lsTimer = null;
    }
    _lsPending = null;
    _projectsLoadedOnce = false;
    _lastSyncTime = 0;
    _loadProjectsPromise = null;

    set({
      projects: [],
      projectsLoaded: false,
      currentProjectId: null,
      activeChapterId: null,
      compileJob: null,
    });

    if (clearStorage) {
      await clearProjectsLocal();
    }
  },

  createProject(templateId, metadata) {
    const project = createProjectFromTemplate(templateId, metadata);
    const firstChapterId =
      project.chapters[0]?.id || project.frontMatter[0]?.id || null;
    const updated = [project, ...get().projects];
    saveProjectsLocal(updated, true); // immediate — new project must survive a refresh
    set({
      projects: updated,
      currentProjectId: project.id,
      activeChapterId: firstChapterId,
      compileJob: null,
    });
    dirtyProjectIds.add(project.id);
    return project;
  },

  createImportedProject(title, importData) {
    const chaptersList = Array.isArray(importData) ? importData : (importData?.chapters || []);
    const fmData = Array.isArray(importData) ? {} : (importData?.frontMatterData || {});

    const frontMatterList = [];
    if (fmData.abstract) {
      frontMatterList.push({ id: genId(), label: "Abstract", auto: false, content: fmData.abstract });
    }
    if (fmData.acknowledgement) {
      frontMatterList.push({ id: genId(), label: "Acknowledgement", auto: false, content: fmData.acknowledgement });
    }

    const now = Date.now();
    const project = {
      id: genId(),
      templateId: frontMatterList.length > 0 ? "diploma-project-report" : "blank",
      createdAt: now,
      updatedAt: now,
      metadata: {
        title,
        authors: "",
        institution: "",
        department: "",
        year: new Date().getFullYear().toString(),
        fontFamily: 'Times New Roman',
        fontSize: '12pt',
        lineSpacing: '1.5',
        pageSize: 'a4paper',
        marginTop: '2.5cm',
        marginBottom: '2.5cm',
        marginLeft: '3.5cm',
        marginRight: '1.25cm',
        enableChapterNumbers: true,
        enableListOfFigures: true,
        enableListOfTables: true
      },
      frontMatter: frontMatterList,
      chapters: chaptersList.map((ch) => ({
        id: genId(),
        title: ch.title,
        content: ch.content,
        required: false,
      })),
    };

    const firstChapterId =
      project.chapters[0]?.id || project.frontMatter[0]?.id || null;
    const updated = [project, ...get().projects];
    saveProjectsLocal(updated, true);
    set({
      projects: updated,
      currentProjectId: project.id,
      activeChapterId: firstChapterId,
      compileJob: null,
    });
    dirtyProjectIds.add(project.id);
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

  togglePinProject(projectId) {
    const updated = get().projects.map(p => {
      if (p.id !== projectId) return p;
      const current = !!(p.isPinned || p.pinned);
      const nextPinned = !current;
      return { ...p, isPinned: nextPinned, pinned: nextPinned, updatedAt: Date.now() };
    });
    saveProjectsLocal(updated, true);
    set({ projects: updated });
    dirtyProjectIds.add(projectId);
  },

  trashProject(projectId) {
    const updated = get().projects.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, deletedAt: Date.now(), updatedAt: Date.now() };
    });
    saveProjectsLocal(updated, true);
    set({
      projects: updated,
      currentProjectId: get().currentProjectId === projectId ? null : get().currentProjectId,
    });
    addTombstone(projectId);
    const target = updated.find(p => p.id === projectId);
    if (target) {
      enqueueSyncItem({ type: 'TRASH', projectId, payload: target });
      processSyncQueue(); // Immediate execution for deletions to update cloud DB right away
    }
  },

  restoreProject(projectId) {
    const updated = get().projects.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, deletedAt: null, updatedAt: Date.now() };
    });
    saveProjectsLocal(updated, true);
    set({ projects: updated });
    removeTombstone(projectId);
    const target = updated.find(p => p.id === projectId);
    if (target) {
      enqueueSyncItem({ type: 'RESTORE', projectId, payload: target });
      processSyncQueue();
    }
  },

  deleteProject(projectId) {
    // Legacy / soft delete alias: moves to trash
    get().trashProject(projectId);
  },

  permanentlyDeleteProject(projectId) {
    const updated = get().projects.filter((p) => p.id !== projectId);
    saveProjectsLocal(updated, true);
    set({
      projects: updated,
      currentProjectId:
        get().currentProjectId === projectId ? null : get().currentProjectId,
    });
    addTombstone(projectId);
    enqueueSyncItem({ type: 'DELETE', projectId });
    processSyncQueue(); // Immediate execution for deletions to update cloud DB right away
  },

  emptyTrash() {
    const trashed = get().projects.filter(p => p.deletedAt);
    const updated = get().projects.filter(p => !p.deletedAt);
    saveProjectsLocal(updated, true);
    set({ projects: updated });

    trashed.forEach(p => {
      addTombstone(p.id);
      enqueueSyncItem({ type: 'DELETE', projectId: p.id });
    });
    processSyncQueue();
  },

  setActiveChapter(id) {
    set({ activeChapterId: id });
  },

  async syncActiveProjectNow(keepalive = false) {
    const token = api.getStoredToken();
    if (!token) return;

    const { currentProjectId, projects } = get();
    if (!currentProjectId || !dirtyProjectIds.has(currentProjectId)) return;

    const project = projects.find((p) => p.id === currentProjectId);
    if (!project) return;

    console.log('[projects] sync executing', { currentProjectId, keepalive });
    try {
      await api.upsertUserProject(project, { keepalive });
      dirtyProjectIds.delete(currentProjectId);
    } catch (err) {
      console.warn('[projects] sync failed', err.message || err);
    }
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
    // Debounced — content edits happen on every keystroke; no need to
    // hit localStorage synchronously each time.
    saveProjectsLocal(updated, false);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
  },

  updateProjectChapters(newChapters) {
    const { projects, currentProjectId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      const existingChMap = new Map(p.chapters.map((c) => [c.id, c]));
      const mergedChs = newChapters.map((newCh) => {
        const oldCh = existingChMap.get(newCh.id) || {};
        return { ...oldCh, ...newCh };
      });
      return {
        ...p,
        updatedAt: Date.now(),
        chapters: mergedChs,
      };
    });
    saveProjectsLocal(updated, false);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
  },

  updateProjectDocument(newFrontMatter, newChapters) {
    const { projects, currentProjectId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      const existingChMap = new Map(p.chapters.map((c) => [c.id, c]));
      const mergedChs = newChapters.map((newCh) => {
        const oldCh = existingChMap.get(newCh.id) || {};
        return { ...oldCh, ...newCh };
      });
      const existingFmMap = new Map((p.frontMatter || []).map((fm) => [fm.id, fm]));
      const mergedFm = (newFrontMatter || []).map((newFm) => {
        const oldFm = existingFmMap.get(newFm.id) || {};
        // The Certificate canvas is not a Tiptap doc — it is a positioned
        // layout owned solely by CertificateCanvasEditor. Document-level saves
        // must never overwrite it, or the measured geometry the PDF depends on
        // is lost and the certificate silently reverts to a flowed layout.
        const isCert =
          oldFm.id === "certificate" ||
          (oldFm.label && String(oldFm.label).toLowerCase().trim() === "certificate") ||
          oldFm.content?.isCertificateCanvas;
        if (isCert) {
          return { ...oldFm, ...newFm, content: oldFm.content || newFm.content };
        }
        return { ...oldFm, ...newFm };
      });
      return {
        ...p,
        updatedAt: Date.now(),
        frontMatter: mergedFm,
        chapters: mergedChs,
      };
    });
    saveProjectsLocal(updated, false);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
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
    // Debounced — metadata fields are typed in inputs, same as content.
    saveProjectsLocal(updated, false);
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
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
    saveProjectsLocal(updated, true); // immediate — structural change
    set({ projects: updated, activeChapterId: newChapter.id });
    dirtyProjectIds.add(currentProjectId);
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
    saveProjectsLocal(updated, true); // immediate — structural change
    const project = updated.find((p) => p.id === currentProjectId);
    const nextId =
      project?.chapters[0]?.id || project?.frontMatter[0]?.id || null;
    set({
      projects: updated,
      activeChapterId: activeChapterId === chapterId ? nextId : activeChapterId,
    });
    dirtyProjectIds.add(currentProjectId);
  },

  deleteFrontMatter(sectionId) {
    const { projects, currentProjectId, activeChapterId } = get();
    const updated = projects.map((p) => {
      if (p.id !== currentProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        frontMatter: p.frontMatter.filter((s) => s.id !== sectionId),
      };
    });
    saveProjectsLocal(updated, true); // immediate — structural change
    const project = updated.find((p) => p.id === currentProjectId);
    const nextId =
      project?.chapters[0]?.id || project?.frontMatter[0]?.id || null;
    set({
      projects: updated,
      activeChapterId: activeChapterId === sectionId ? nextId : activeChapterId,
    });
    dirtyProjectIds.add(currentProjectId);
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
    saveProjectsLocal(updated, true); // immediate — structural change
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
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
    saveProjectsLocal(updated, true); // immediate — structural change
    set({ projects: updated });
    dirtyProjectIds.add(currentProjectId);
  },

  setCompileJob(jobOrUpdater) {
    if (typeof jobOrUpdater === 'function') {
      set(state => ({ compileJob: jobOrUpdater(state.compileJob) }));
    } else {
      set({ compileJob: jobOrUpdater });
    }
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

if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const state = useProjectStore.getState();
      if (state && typeof state.syncActiveProjectNow === 'function') {
        state.syncActiveProjectNow(true);
      }
    }
  });

  window.addEventListener('pagehide', () => {
    const state = useProjectStore.getState();
    if (state && typeof state.syncActiveProjectNow === 'function') {
      state.syncActiveProjectNow(true);
    }
  });
}

export default useProjectStore;
