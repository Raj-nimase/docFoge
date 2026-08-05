import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAcaStore from "@/contexts/projectStore/projectStore";
import { PRESET_TEMPLATES } from "./presetTemplates";
import { DEFAULT_MERGE_DATA, createObject, duplicateObject } from "./canvasConstants";

const MAX_HISTORY = 100;

/** Two commits with the same key inside this window collapse into one undo step. */
const COALESCE_MS = 500;

/** Scene writes are debounced — the inspector fires on every keystroke. */
const PERSIST_MS = 400;

const DEFAULT_PAGE = { width: 595, height: 842, bg: "#ffffff" };

/**
 * Normalise whatever is stored in section.content into a full scene.
 *
 * Older certificates were saved as { page, objects } with merge data held only
 * in component state, so it vanished on reload. Those still load; mergeData
 * just falls back to defaults.
 */
function readScene(section, metadata = {}) {
  const stored = section?.content;
  const hasObjects = Array.isArray(stored?.objects) && stored.objects.length > 0;

  const seededDefaults = {
    ...DEFAULT_MERGE_DATA,
    ...(metadata.authors ? { student_name: metadata.authors } : {}),
    ...(metadata.title ? { project_title: metadata.title } : {}),
    ...(metadata.institution ? { college_name: metadata.institution } : {}),
    ...(metadata.department ? { department_name: metadata.department } : {}),
    ...(metadata.year ? { academic_year: metadata.year } : {}),
  };

  if (!hasObjects) {
    const template = PRESET_TEMPLATES[0];
    return {
      isCertificateCanvas: true,
      page: { ...DEFAULT_PAGE, ...template.page },
      objects: JSON.parse(JSON.stringify(template.objects)),
      mergeData: seededDefaults,
    };
  }

  return {
    isCertificateCanvas: true,
    page: { ...DEFAULT_PAGE, ...(stored.page || {}) },
    objects: stored.objects,
    mergeData: { ...seededDefaults, ...(stored.mergeData || {}) },
  };
}

/**
 * Owns the certificate scene, its undo history, and persistence.
 *
 * The component above stays a thin orchestrator; everything that needs to know
 * about history semantics or the project store lives here.
 */
export default function useCertificateScene(section) {
  const updateSectionContent = useAcaStore((s) => s.updateSectionContent);
  const currentProject = useAcaStore((s) => s.getCurrentProject());
  const metadata = currentProject?.metadata || {};

  // Metadata only seeds initial values. Reading it through the store's
  // getState() inside effects keeps it out of the dependency list — making it
  // a dep would re-seed and clobber whatever the user has since typed.
  const readSeedMetadata = useCallback(
    () => useAcaStore.getState().getCurrentProject()?.metadata || {},
    [],
  );

  const [scene, setScene] = useState(() => readScene(section, metadata));
  const [selectedId, setSelectedId] = useState(null);

  // Synchronous mirror of `scene`. commit() reads this instead of a setState
  // updater so history stays correct and callers get their result immediately.
  const sceneRef = useRef(scene);

  const historyRef = useRef([scene]);
  const historyIdxRef = useRef(0);
  const lastCommitRef = useRef({ key: null, at: 0 });

  // Mirrors history state into React so toolbar buttons re-render.
  const [historyMeta, setHistoryMeta] = useState({ canUndo: false, canRedo: false });

  const syncHistoryMeta = useCallback(() => {
    setHistoryMeta({
      canUndo: historyIdxRef.current > 0,
      canRedo: historyIdxRef.current < historyRef.current.length - 1,
    });
  }, []);

  // ── Persistence ─────────────────────────────────────────────────────────
  const persistTimerRef = useRef(null);
  const pendingSceneRef = useRef(null);

  const flushPersist = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const { sectionId, data } = pendingSceneRef.current || {};
    if (data && sectionId) {
      updateSectionContent(sectionId, data);
      pendingSceneRef.current = null;
    }
  }, [updateSectionContent]);

  const schedulePersist = useCallback(
    (nextScene) => {
      // The section id is captured with the payload, so a pending write can
      // never land on a section the user has since switched away from.
      pendingSceneRef.current = {
        sectionId: section?.id,
        data: { ...nextScene, isCertificateCanvas: true },
      };
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(flushPersist, PERSIST_MS);
    },
    [flushPersist, section?.id],
  );

  // Flush on unmount so nothing in flight is lost when switching sections.
  useEffect(() => flushPersist, [flushPersist]);

  // Reload when the user switches to a different certificate section.
  useEffect(() => {
    flushPersist();
    const fresh = readScene(section, readSeedMetadata());
    sceneRef.current = fresh;
    setScene(fresh);
    setSelectedId(null);
    historyRef.current = [fresh];
    historyIdxRef.current = 0;
    lastCommitRef.current = { key: null, at: 0 };
    setHistoryMeta({ canUndo: false, canRedo: false });

    // Auto-persist default canvas scene if section content was empty/uninitialized
    if (!section?.content?.objects || !Array.isArray(section.content.objects) || section.content.objects.length === 0) {
      schedulePersist(fresh);
    }
    // Re-reading on every `section` identity change would fight the user's own
    // edits, since our writes flow back through the store. Key on id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section?.id]);

  // ── Commit ──────────────────────────────────────────────────────────────
  /**
   * Apply a scene change.
   *
   * `coalesceKey` collapses rapid same-target edits into a single undo entry —
   * without it, typing a nine-character name costs nine Ctrl+Z presses.
   * Structural changes (add, delete, reorder, drag) pass no key and always push.
   */
  const commit = useCallback(
    (updater, options = {}) => {
      const { coalesceKey = null } = options;

      // Computed against the ref mirror rather than inside a setState updater.
      // Two reasons: React may invoke an updater more than once (StrictMode,
      // concurrent rendering), which would corrupt the history stack; and
      // callers like addObject need the resulting object synchronously.
      const prev = sceneRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (!next || next === prev) return prev;

      const now = Date.now();
      const last = lastCommitRef.current;
      const canCoalesce =
        coalesceKey !== null && last.key === coalesceKey && now - last.at < COALESCE_MS;

      if (canCoalesce) {
        historyRef.current[historyIdxRef.current] = next;
      } else {
        const truncated = historyRef.current.slice(0, historyIdxRef.current + 1);
        truncated.push(next);
        // Cap history — the old implementation grew without bound for the
        // whole session, one entry per keystroke.
        const overflow = Math.max(0, truncated.length - MAX_HISTORY);
        historyRef.current = overflow ? truncated.slice(overflow) : truncated;
        historyIdxRef.current = historyRef.current.length - 1;
      }

      lastCommitRef.current = { key: coalesceKey, at: now };
      sceneRef.current = next;
      setScene(next);
      syncHistoryMeta();
      schedulePersist(next);
      return next;
    },
    [schedulePersist, syncHistoryMeta],
  );

  const travel = useCallback(
    (delta) => {
      const target = historyIdxRef.current + delta;
      if (target < 0 || target >= historyRef.current.length) return;

      historyIdxRef.current = target;
      const restored = historyRef.current[target];
      lastCommitRef.current = { key: null, at: 0 };
      sceneRef.current = restored;
      setScene(restored);
      schedulePersist(restored);
      syncHistoryMeta();

      // Selection may point at an object that no longer exists in this state.
      setSelectedId((id) => (restored.objects.some((o) => o.id === id) ? id : null));
    },
    [schedulePersist, syncHistoryMeta],
  );

  const undo = useCallback(() => travel(-1), [travel]);
  const redo = useCallback(() => travel(1), [travel]);

  // ── Object operations ───────────────────────────────────────────────────
  const updateObject = useCallback(
    (objId, patch, options) => {
      commit(
        (prev) => ({
          ...prev,
          objects: prev.objects.map((o) => (o.id === objId ? { ...o, ...patch } : o)),
        }),
        options,
      );
    },
    [commit],
  );

  const addObject = useCallback(
    (type, opts = {}) => {
      const created = createObject(type, { ...opts, page: sceneRef.current.page });
      if (!created) return null;
      // Overrides let callers set size at insertion time (e.g. an image's real
      // aspect ratio) instead of following up with a second commit, which
      // would cost an extra undo step.
      const object = opts.overrides ? { ...created, ...opts.overrides } : created;
      commit((prev) => ({ ...prev, objects: [...prev.objects, object] }));
      setSelectedId(object.id);
      return object;
    },
    [commit],
  );

  const deleteObject = useCallback(
    (objId) => {
      if (!objId) return;
      commit((prev) => ({ ...prev, objects: prev.objects.filter((o) => o.id !== objId) }));
      setSelectedId((id) => (id === objId ? null : id));
    },
    [commit],
  );

  const duplicate = useCallback(
    (objId) => {
      if (!objId) return;
      let copy = null;
      commit((prev) => {
        const source = prev.objects.find((o) => o.id === objId);
        if (!source) return prev;
        copy = duplicateObject(source);
        return { ...prev, objects: [...prev.objects, copy] };
      });
      if (copy) setSelectedId(copy.id);
    },
    [commit],
  );

  /**
   * Reorder within the objects array — later entries paint on top.
   * "forward"/"backward" move one step; "top"/"bottom" jump to an end.
   */
  const moveLayer = useCallback(
    (direction, objId) => {
      const targetId = objId ?? selectedId;
      if (!targetId) return;

      commit((prev) => {
        const idx = prev.objects.findIndex((o) => o.id === targetId);
        if (idx === -1) return prev;

        let target;
        if (direction === "top") target = prev.objects.length - 1;
        else if (direction === "bottom") target = 0;
        else if (direction === "forward") target = Math.min(prev.objects.length - 1, idx + 1);
        else target = Math.max(0, idx - 1);

        if (target === idx) return prev;

        const objects = [...prev.objects];
        const [item] = objects.splice(idx, 1);
        objects.splice(target, 0, item);
        return { ...prev, objects };
      });
    },
    [commit, selectedId],
  );

  /** Move an object to an explicit index — used by layer-list drag reorder. */
  const reorderObject = useCallback(
    (fromIdx, toIdx) => {
      commit((prev) => {
        if (
          fromIdx === toIdx ||
          fromIdx < 0 ||
          toIdx < 0 ||
          fromIdx >= prev.objects.length ||
          toIdx >= prev.objects.length
        ) {
          return prev;
        }
        const objects = [...prev.objects];
        const [item] = objects.splice(fromIdx, 1);
        objects.splice(toIdx, 0, item);
        return { ...prev, objects };
      });
    },
    [commit],
  );

  const nudge = useCallback(
    (dx, dy) => {
      if (!selectedId) return;
      commit(
        (prev) => ({
          ...prev,
          objects: prev.objects.map((o) =>
            o.id === selectedId
              ? { ...o, x: Math.round((o.x || 0) + dx), y: Math.round((o.y || 0) + dy) }
              : o,
          ),
        }),
        { coalesceKey: `nudge:${selectedId}` },
      );
    },
    [commit, selectedId],
  );

  const updatePage = useCallback(
    (patch, options) => {
      commit((prev) => ({ ...prev, page: { ...prev.page, ...patch } }), options);
    },
    [commit],
  );

  const updateMergeData = useCallback(
    (key, value) => {
      commit((prev) => ({ ...prev, mergeData: { ...prev.mergeData, [key]: value } }), {
        coalesceKey: `merge:${key}`,
      });
    },
    [commit],
  );

  /** Applying a template replaces the layout but keeps the user's merge data. */
  const applyTemplate = useCallback(
    (template) => {
      commit((prev) => ({
        page: { ...DEFAULT_PAGE, ...template.page },
        objects: JSON.parse(JSON.stringify(template.objects)),
        mergeData: prev.mergeData,
      }));
      setSelectedId(null);
    },
    [commit],
  );

  const selectedObject = useMemo(
    () => scene.objects.find((o) => o.id === selectedId) || null,
    [scene.objects, selectedId],
  );

  /** Approximate serialised size, surfaced as a storage-pressure warning. */
  const sceneByteSize = useMemo(() => {
    try {
      return JSON.stringify(scene).length;
    } catch {
      return 0;
    }
  }, [scene]);

  return {
    scene,
    selectedId,
    setSelectedId,
    selectedObject,
    sceneByteSize,
    canUndo: historyMeta.canUndo,
    canRedo: historyMeta.canRedo,
    undo,
    redo,
    commit,
    addObject,
    updateObject,
    deleteObject,
    duplicate,
    moveLayer,
    reorderObject,
    nudge,
    updatePage,
    updateMergeData,
    applyTemplate,
  };
}
