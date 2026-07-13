/**
 * Project Store
 * Manages the in-memory list of projects.
 * All mutations auto-sync to the backend after a 1.5s debounce.
 *
 * Performance notes:
 * - updateSectionContent uses targeted index-based updates so only the
 *   affected section object changes reference.
 * - Use the exported selectors (selectActiveProject, selectActiveSection)
 *   in components instead of calling getActiveProject() in render — selectors
 *   let Zustand skip re-renders when the selected value hasn't changed.
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
function buildDefaultProject(templateId: string, metadata: Project['metadata']): Project {
  const now = Date.now();

  const frontMatter: Section[] = [
    { id: 'title_page',      label: 'Title Page',          required: true,  content: null },
    { id: 'certificate',     label: 'Certificate',         required: false, content: null },
    { id: 'acknowledgement', label: 'Acknowledgement',     required: false, content: null },
    { id: 'abstract',        label: 'Abstract',            required: false, content: null },
    { id: 'toc',             label: 'Table of Contents',   required: true,  content: null },
  ];

  const chapters: Chapter[] =
    templateId === 'ieee-paper'
      ? [
          { id: genId(), title: 'Introduction', required: false, content: null },
          { id: genId(), title: 'Methodology',  required: false, content: null },
          { id: genId(), title: 'Results',       required: false, content: null },
          { id: genId(), title: 'Conclusion',    required: false, content: null },
        ]
      : [
          { id: genId(), title: 'Introduction', required: false, content: null },
          { id: genId(), title: 'Methodology',  required: false, content: null },
          { id: genId(), title: 'Future Scope', required: false, content: null },
          { id: genId(), title: 'Conclusion',   required: false, content: null },
        ];

  return { id: genId(), templateId, metadata, frontMatter, chapters, createdAt: now, updatedAt: now };
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
    const projects = useProjectStore.getState().projects;
    for (const id of ids) {
      const p = projects.find(x => x.id === id);
      if (p) apiUpsertProject(p).catch(err => console.warn('[projectStore] sync failed', err.message));
    }
  }, 1500);
}

// ── State interface ───────────────────────────────────────────────────────────

interface ProjectState {
  projects: Project[];
  loaded: boolean;
  activeProjectId: string | null;
  activeChapterId: string | null;

  // Queries (kept for backward compat — prefer selectors below)
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

// ── Stable selectors — use these in components ────────────────────────────────
// Zustand's equality check means components only re-render when the specific
// slice they subscribed to actually changes reference.

export const selectActiveProject = (s: ProjectState): Project | null =>
  s.projects.find(p => p.id === s.activeProjectId) ?? null;

export const selectActiveSection = (s: ProjectState): Section | Chapter | null => {
  const project = s.projects.find(p => p.id === s.activeProjectId);
  if (!project) return null;
  return (
    project.frontMatter.find(sec => sec.id === s.activeChapterId) ??
    project.chapters.find(c => c.id === s.activeChapterId) ??
    null
  );
};

// ── Store ─────────────────────────────────────────────────────────────────────

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
    // Skip auto sections as default active — open on first chapter instead
    const AUTO_IDS = new Set(['title_page', 'toc']);
    const firstId =
      project.chapters[0]?.id ??
      project.frontMatter.find(s => !AUTO_IDS.has(s.id))?.id ??
      null;
    set(s => ({ projects: [project, ...s.projects], activeProjectId: project.id, activeChapterId: firstId }));
    scheduleSync(project);
    return project;
  },

  deleteProject: async (projectId) => {
    set(s => ({
      projects: s.projects.filter(p => p.id !== projectId),
      activeProjectId: s.activeProjectId === projectId ? null : s.activeProjectId,
    }));
    await apiDeleteProject(projectId).catch(err => console.warn('[projectStore] delete failed', err.message));
  },

  openProject: (projectId) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;
    // Prefer first chapter; fall back to first editable front matter section.
    // title_page and toc are auto-generated — skip them so the editor never
    // opens on a non-editable section by default.
    const AUTO_IDS = new Set(['title_page', 'toc']);
    const firstId =
      project.chapters[0]?.id ??
      project.frontMatter.find(s => !AUTO_IDS.has(s.id))?.id ??
      null;
    set({ activeProjectId: projectId, activeChapterId: firstId });
  },

  addChapter: (title) => {
    const { projects, activeProjectId } = get();
    const newChapter: Chapter = { id: genId(), title, required: false, content: null };
    const pIdx = projects.findIndex(p => p.id === activeProjectId);
    if (pIdx === -1) return;
    const updatedProject = { ...projects[pIdx], updatedAt: Date.now(), chapters: [...projects[pIdx].chapters, newChapter] };
    const updated = projects.map((p, i) => i === pIdx ? updatedProject : p);
    set({ projects: updated, activeChapterId: newChapter.id });
    scheduleSync(updatedProject);
  },

  deleteChapter: (chapterId) => {
    const { projects, activeProjectId, activeChapterId } = get();
    const pIdx = projects.findIndex(p => p.id === activeProjectId);
    if (pIdx === -1) return;
    const updatedProject = {
      ...projects[pIdx],
      updatedAt: Date.now(),
      chapters: projects[pIdx].chapters.filter(c => c.id !== chapterId),
    };
    const updated = projects.map((p, i) => i === pIdx ? updatedProject : p);
    const AUTO_IDS = new Set(['title_page', 'toc']);
    const nextId =
      updatedProject.chapters[0]?.id ??
      updatedProject.frontMatter.find(s => !AUTO_IDS.has(s.id))?.id ??
      null;
    set({ projects: updated, activeChapterId: activeChapterId === chapterId ? nextId : activeChapterId });
    scheduleSync(updatedProject);
  },

  renameChapter: (chapterId, newTitle) => {
    const { projects, activeProjectId } = get();
    const pIdx = projects.findIndex(p => p.id === activeProjectId);
    if (pIdx === -1) return;
    const updatedProject = {
      ...projects[pIdx],
      updatedAt: Date.now(),
      chapters: projects[pIdx].chapters.map(c => c.id === chapterId ? { ...c, title: newTitle } : c),
    };
    const updated = projects.map((p, i) => i === pIdx ? updatedProject : p);
    set({ projects: updated });
    scheduleSync(updatedProject);
  },

  setActiveChapter: (id) => set({ activeChapterId: id }),

  updateSectionContent: (sectionId, content) => {
    const { projects, activeProjectId } = get();
    const pIdx = projects.findIndex(p => p.id === activeProjectId);
    if (pIdx === -1) return;
    const project = projects[pIdx];

    // Targeted index lookup — only the changed section gets a new reference
    const fIdx = project.frontMatter.findIndex(s => s.id === sectionId);
    const cIdx = fIdx === -1 ? project.chapters.findIndex(c => c.id === sectionId) : -1;
    if (fIdx === -1 && cIdx === -1) return;

    const processedContent = prepareStoreContent(content);

    const updatedProject: Project = {
      ...project,
      updatedAt: Date.now(),
      frontMatter: fIdx !== -1
        ? project.frontMatter.map((s, i) => i === fIdx ? { ...s, content: processedContent } : s)
        : project.frontMatter,
      chapters: cIdx !== -1
        ? project.chapters.map((c, i) => i === cIdx ? { ...c, content: processedContent } : c)
        : project.chapters,
    };

    // Only the active project gets a new reference in the array
    const updated = projects.map((p, i) => i === pIdx ? updatedProject : p);
    set({ projects: updated });
    scheduleSync(updatedProject);
  },

  updateMetadata: (fields) => {
    const { projects, activeProjectId } = get();
    const pIdx = projects.findIndex(p => p.id === activeProjectId);
    if (pIdx === -1) return;
    const updatedProject: Project = {
      ...projects[pIdx],
      updatedAt: Date.now(),
      metadata: { ...projects[pIdx].metadata, ...fields },
    };
    const updated = projects.map((p, i) => i === pIdx ? updatedProject : p);
    set({ projects: updated });
    scheduleSync(updatedProject);
  },
}));

// ── Store Content Converters (image carriers → real nodes) ─────────────────────
const KATEX_SRC = 'katexmath';
const TABLE_SRC = 'tiptaptable';

function cleanMathLatex(latex: string): string {
  let clean = (latex || '').trim();
  while (true) {
    const start = clean;
    if (clean.startsWith('$$') && clean.endsWith('$$')) {
      clean = clean.slice(2, -2).trim();
    } else if (clean.startsWith('$') && clean.endsWith('$')) {
      clean = clean.slice(1, -1).trim();
    } else if (clean.startsWith('\\[') && clean.endsWith('\\]')) {
      clean = clean.slice(2, -2).trim();
    } else if (clean.startsWith('\\(') && clean.endsWith('\\)')) {
      clean = clean.slice(2, -2).trim();
    }
    if (clean === start) break;
  }
  return clean;
}

function editorToStoreContent(content: any[]): any[] {
  if (!content || !Array.isArray(content)) return content;
  return content.map((node: any) => {
    if (node.type === 'image' && node.attrs?.src === KATEX_SRC) {
      const cleanLatex = cleanMathLatex(node.attrs.alt || '');
      return { type: 'math', attrs: { latex: cleanLatex, display: node.attrs.title === 'display' } };
    }
    if (node.type === 'image' && node.attrs?.src === TABLE_SRC) {
      try {
        const tableNode = JSON.parse(node.attrs.alt);
        if (tableNode.attrs) {
          tableNode.attrs.caption = node.attrs.title || '';
        } else {
          tableNode.attrs = { caption: node.attrs.title || '' };
        }
        return tableNode;
      } catch (e) {
        return {
          type: 'table',
          attrs: { caption: node.attrs.title || '' },
          content: []
        };
      }
    }
    if (node.content && Array.isArray(node.content)) {
      return { ...node, content: editorToStoreContent(node.content) };
    }
    return node;
  });
}

function prepareStoreContent(content: any): any {
  if (!content) return content;
  if (content.content && Array.isArray(content.content)) {
    return { ...content, content: editorToStoreContent(content.content) };
  }
  return content;
}

