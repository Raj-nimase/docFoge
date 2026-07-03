/**
 * Project Store
 * Manages the in-memory list of projects.
 * All mutations auto-sync to the backend after a 1.5s debounce.
 */
import { create } from 'zustand';
import {
  apiFetchProjects,
  apiUpsertProject,
  apiDeleteProject,
  Project,
  Section,
  Chapter,
  TiptapDoc,
} from '@/services/api';

// ── ID generator ──────────────────────────────────────────────────────────────
function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Default sections/chapters per template ────────────────────────────────────
// Mirrors the web app's template structure exactly
function buildDefaultProject(templateId: string, metadata: Project['metadata']): Project {
  const now = Date.now();

  const frontMatter: Section[] = [
    { id: 'title_page', label: 'Title Page', required: true, content: null },
    { id: 'certificate', label: 'Certificate', required: false, content: null },
    { id: 'acknowledgement', label: 'Acknowledgement', required: false, content: null },
    { id: 'abstract', label: 'Abstract', required: false, content: null },
    { id: 'toc', label: 'Table of Contents', required: true, content: null },
  ];

  const chapters: Chapter[] =
    templateId === 'ieee-paper'
      ? [
          { id: genId(), title: 'Introduction', required: false, content: null },
          { id: genId(), title: 'Methodology', required: false, content: null },
          { id: genId(), title: 'Results', required: false, content: null },
          { id: genId(), title: 'Conclusion', required: false, content: null },
        ]
      : [
          { id: genId(), title: 'Introduction', required: false, content: null },
          { id: genId(), title: 'Methodology', required: false, content: null },
          { id: genId(), title: 'Future Scope', required: false, content: null },
          { id: genId(), title: 'Conclusion', required: false, content: null },
        ];

  return {
    id: genId(),
    templateId,
    metadata,
    frontMatter,
    chapters,
    createdAt: now,
    updatedAt: now,
  };
}

// ── Debounced sync ────────────────────────────────────────────────────────────
const dirtyIds = new Set<string>();
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSync(project: Project) {
  dirtyIds.add(project.id);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const ids = [...dirtyIds];
    dirtyIds.clear();
    // Get latest state at flush time
    const projects = useProjectStore.getState().projects;
    for (const id of ids) {
      const p = projects.find(x => x.id === id);
      if (p) {
        apiUpsertProject(p).catch(err =>
          console.warn('[projectStore] sync failed', err.message)
        );
      }
    }
  }, 1500);
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface ProjectState {
  projects: Project[];
  loaded: boolean;
  activeProjectId: string | null;
  activeChapterId: string | null;

  // Queries
  getActiveProject: () => Project | null;
  getActiveSection: () => Section | Chapter | null;

  // Lifecycle
  loadProjects: () => Promise<void>;
  reset: () => void;

  // Project CRUD
  createProject: (templateId: string, metadata: Project['metadata']) => Project;
  deleteProject: (projectId: string) => Promise<void>;
  openProject: (projectId: string) => void;

  // Chapter CRUD
  addChapter: (title: string) => void;
  deleteChapter: (chapterId: string) => void;
  renameChapter: (chapterId: string, newTitle: string) => void;

  // Content
  setActiveChapter: (id: string) => void;
  updateSectionContent: (sectionId: string, content: TiptapDoc) => void;
  updateMetadata: (fields: Partial<Project['metadata']>) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  loaded: false,
  activeProjectId: null,
  activeChapterId: null,

  getActiveProject() {
    const { projects, activeProjectId } = get();
    return projects.find(p => p.id === activeProjectId) ?? null;
  },

  getActiveSection() {
    const project = get().getActiveProject();
    if (!project) return null;
    const { activeChapterId } = get();
    return (
      project.frontMatter.find(s => s.id === activeChapterId) ??
      project.chapters.find(c => c.id === activeChapterId) ??
      null
    );
  },

  loadProjects: async () => {
    try {
      const projects = await apiFetchProjects();
      set({ projects, loaded: true });
    } catch (err: any) {
      console.warn('[projectStore] load failed', err.message);
      set({ loaded: true });
    }
  },

  reset: () => {
    if (syncTimer) clearTimeout(syncTimer);
    dirtyIds.clear();
    set({ projects: [], loaded: false, activeProjectId: null, activeChapterId: null });
  },

  createProject: (templateId, metadata) => {
    const project = buildDefaultProject(templateId, metadata);
    const firstId = project.chapters[0]?.id ?? project.frontMatter[0]?.id ?? null;
    set(s => ({
      projects: [project, ...s.projects],
      activeProjectId: project.id,
      activeChapterId: firstId,
    }));
    scheduleSync(project);
    return project;
  },

  deleteProject: async (projectId) => {
    set(s => ({
      projects: s.projects.filter(p => p.id !== projectId),
      activeProjectId: s.activeProjectId === projectId ? null : s.activeProjectId,
    }));
    await apiDeleteProject(projectId).catch(err =>
      console.warn('[projectStore] delete failed', err.message)
    );
  },

  openProject: (projectId) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;
    const firstId = project.chapters[0]?.id ?? project.frontMatter[0]?.id ?? null;
    set({ activeProjectId: projectId, activeChapterId: firstId });
  },

  addChapter: (title) => {
    const { projects, activeProjectId } = get();
    const newChapter: Chapter = { id: genId(), title, required: false, content: null };
    const updated = projects.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, updatedAt: Date.now(), chapters: [...p.chapters, newChapter] };
    });
    set({ projects: updated, activeChapterId: newChapter.id });
    const p = updated.find(x => x.id === activeProjectId);
    if (p) scheduleSync(p);
  },

  deleteChapter: (chapterId) => {
    const { projects, activeProjectId, activeChapterId } = get();
    const updated = projects.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, updatedAt: Date.now(), chapters: p.chapters.filter(c => c.id !== chapterId) };
    });
    const active = updated.find(p => p.id === activeProjectId);
    const nextId = active?.chapters[0]?.id ?? active?.frontMatter[0]?.id ?? null;
    set({
      projects: updated,
      activeChapterId: activeChapterId === chapterId ? nextId : activeChapterId,
    });
    if (active) scheduleSync(active);
  },

  renameChapter: (chapterId, newTitle) => {
    const { projects, activeProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== activeProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        chapters: p.chapters.map(c => c.id === chapterId ? { ...c, title: newTitle } : c),
      };
    });
    set({ projects: updated });
    const p = updated.find(x => x.id === activeProjectId);
    if (p) scheduleSync(p);
  },

  setActiveChapter: (id) => set({ activeChapterId: id }),

  updateSectionContent: (sectionId, content) => {
    const { projects, activeProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== activeProjectId) return p;
      return {
        ...p,
        updatedAt: Date.now(),
        frontMatter: p.frontMatter.map(s => s.id === sectionId ? { ...s, content } : s),
        chapters: p.chapters.map(c => c.id === sectionId ? { ...c, content } : c),
      };
    });
    set({ projects: updated });
    const p = updated.find(x => x.id === activeProjectId);
    if (p) scheduleSync(p);
  },

  updateMetadata: (fields) => {
    const { projects, activeProjectId } = get();
    const updated = projects.map(p => {
      if (p.id !== activeProjectId) return p;
      return { ...p, updatedAt: Date.now(), metadata: { ...p.metadata, ...fields } };
    });
    set({ projects: updated });
    const p = updated.find(x => x.id === activeProjectId);
    if (p) scheduleSync(p);
  },
}));
