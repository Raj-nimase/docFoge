/**
 * AcaDoc API Service
 * Single source of truth for all backend calls.
 * Mirrors the web app's frontend/src/services/api/index.js
 */

// ── Backend URL ───────────────────────────────────────────────────────────────
// Production  (Render):      'https://your-app-name.onrender.com/api'
// Local dev on real device:  'http://192.168.x.x:3001/api'  ← your PC's LAN IP
// Local dev on emulator:     'http://10.0.2.2:3001/api'
// ─────────────────────────────────────────────────────────────────────────────
export const API_BASE = 'https://your-app-name.onrender.com/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  institution: string;
  department: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

export interface Project {
  id: string;
  templateId: string;
  metadata: ProjectMetadata;
  frontMatter: Section[];
  chapters: Chapter[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectMetadata {
  title?: string;
  authors?: string;
  institution?: string;
  department?: string;
  guide?: string;
  year?: string;
  abstract?: string;
  keywords?: string;
  enableHeader?: boolean;
  enableFooter?: boolean;
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
}

export interface Section {
  id: string;
  label: string;
  required?: boolean;
  content: TiptapDoc | null;
}

export interface Chapter {
  id: string;
  title: string;
  required?: boolean;
  content: TiptapDoc | null;
}

export interface TiptapDoc {
  type: 'doc';
  content: TiptapNode[];
}

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: Array<{ type: string }>;
}

export interface CompileStatus {
  success: boolean;
  status: 'pending' | 'processing' | 'done' | 'failed';
  durationMs?: number;
  error?: string;
}

// ── Token in-memory holder (set by auth store) ────────────────────────────────
let _token: string | null = null;
export function setToken(t: string | null) { _token = t; }
export function getToken() { return _token; }

// ── Core fetch helper ─────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const { method = 'GET', body, token = _token, timeoutMs = 15_000 } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data as T;
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    token: null,
  });
}

export async function apiRegister(fields: {
  name: string;
  email: string;
  password: string;
  role?: string;
  institution?: string;
  department?: string;
}): Promise<AuthResponse> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: fields,
    token: null,
  });
}

export async function apiResetPassword(email: string, newPassword: string): Promise<AuthResponse> {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: { email: email.trim(), newPassword },
    token: null,
  });
}

export async function apiGetMe(): Promise<User> {
  const data = await apiFetch<{ user: User }>('/auth/me');
  return data.user;
}

export async function apiUpdateProfile(fields: Partial<Pick<User, 'name' | 'role' | 'institution' | 'department'>>): Promise<User> {
  const data = await apiFetch<{ user: User }>('/auth/me', { method: 'PATCH', body: fields });
  return data.user;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function apiFetchProjects(): Promise<Project[]> {
  const data = await apiFetch<{ projects: Project[] }>('/projects');
  return data.projects;
}

export async function apiUpsertProject(project: Project): Promise<Project> {
  const data = await apiFetch<{ project: Project }>('/projects/item', {
    method: 'PUT',
    body: project,
  });
  return data.project;
}

export async function apiDeleteProject(clientId: string): Promise<void> {
  await apiFetch(`/projects/${clientId}`, { method: 'DELETE' });
}

// ── Compile ───────────────────────────────────────────────────────────────────

export async function apiStartCompile(project: Project): Promise<{ jobId: string }> {
  return apiFetch('/compile', {
    method: 'POST',
    body: { project },
    timeoutMs: 20_000,
  });
}

export async function apiGetCompileStatus(jobId: string): Promise<CompileStatus> {
  return apiFetch(`/compile/${jobId}/status`, { timeoutMs: 10_000 });
}

export async function apiPollUntilDone(
  jobId: string,
  onStatus: (s: CompileStatus) => void,
  opts: { intervalMs?: number; maxAttempts?: number } = {}
): Promise<CompileStatus> {
  const { intervalMs = 2000, maxAttempts = 40 } = opts;
  for (let i = 0; i < maxAttempts; i++) {
    const status = await apiGetCompileStatus(jobId);
    onStatus(status);
    if (status.status === 'done' || status.status === 'failed') return status;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Compile timed out after 80 seconds');
}

/** Returns the full URL to stream the PDF — used with expo-file-system */
export function pdfUrl(jobId: string): string {
  return `${API_BASE}/compile/${jobId}/pdf`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export async function apiFetchTemplates(): Promise<any[]> {
  const data = await apiFetch<{ templates: any[] }>('/templates');
  return data.templates;
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function apiHealth(): Promise<{ status: string }> {
  return apiFetch('/health', { timeoutMs: 5_000 });
}
