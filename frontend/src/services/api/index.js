/** Single source of truth for the backend URL. Change this one line to switch environments. */
export const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://localhost:3001/api'
  : 'https://docfoge.onrender.com/api';

/** @internal used by all api functions in this file */
const BASE = 'https://docfoge.onrender.com/api'

const TOKEN_KEY = 'acadoc_token';

// ── Per-path timeout overrides ────────────────────────────────────────────────
// Render free tier can be slow under load. These are tuned per operation type.
const TIMEOUT_MS = {
  default:  15_000,   // 15s — generous default for Render cold paths
  projects:  20_000,  // 20s — /projects fetch can be slow after spin-down
  upsert:   20_000,   // 20s — /projects/item upsert; fired during compile too
  compile:  25_000,   // 25s — compile POST itself
  auth:     15_000,   // 15s — login/register
};

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function getTimeoutForPath(path) {
  if (path.startsWith('/auth'))     return TIMEOUT_MS.auth;
  if (path === '/projects/item')    return TIMEOUT_MS.upsert;
  if (path.startsWith('/projects')) return TIMEOUT_MS.projects;
  if (path.startsWith('/compile'))  return TIMEOUT_MS.compile;
  return TIMEOUT_MS.default;
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function authFetch(path, options = {}) {
  const {
    token: _token, body, headers: extraHeaders,
    timeoutMs = getTimeoutForPath(path),
    ...fetchOptions
  } = options;
  const token = _token ?? getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: fetchOptions.method || 'GET',
      ...fetchOptions,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const elapsed = Date.now() - t0;
    try {
      const parsed = await parseJson(res);
      console.log('[api] authFetch OK', path, `${elapsed}ms`, { status: res.status });
      return parsed;
    } finally {
      // noop
    }
  } catch (err) {
    const elapsed = Date.now() - t0;
    if (err.name === 'AbortError' || err.message === 'Request timed out') {
      console.warn('[api] authFetch TIMEOUT', path, `${elapsed}ms`);
      throw new Error('Request timed out');
    }
    console.warn('[api] authFetch ERROR', path, `${elapsed}ms`, err.message || err);
    throw err;
  } finally {
    clearTimeout(id);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function register({ name, email, password, role, institution, department }) {
  return authFetch('/auth/register', {
    method: 'POST',
    body: { name, email, password, role, institution, department },
    token: null,
  });
}

export async function login(email, password) {
  return authFetch('/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password },
    token: null,
  });
}

export async function resetPassword(email, newPassword) {
  return authFetch('/auth/reset-password', {
    method: 'POST',
    body: { email: email.trim(), newPassword: newPassword },
    token: null,
  });
}

export async function getMe(token) {
  const data = await authFetch('/auth/me', { token });
  return data.user;
}

export async function updateProfile(fields) {
  const data = await authFetch('/auth/me', { method: 'PATCH', body: fields });
  return data.user;
}

// ─── Projects (cloud) ─────────────────────────────────────────────────────────

export async function fetchUserProjects() {
  const data = await authFetch('/projects');
  return data.projects;
}

export async function syncUserProjects(projects) {
  try {
    const payload = { projects };
    const size = JSON.stringify(payload).length;
    console.log('[api] syncUserProjects uploading', `projects=${projects.length}`, `bytes=${size}`);
    const data = await authFetch('/projects/sync/all', {
      method: 'PUT',
      body: payload,
    });
    return data.projects;
  } catch (err) {
    console.warn('[api] syncUserProjects failed', err.message || err);
    throw err;
  }
}

export async function deleteUserProject(clientId) {
  await authFetch(`/projects/${clientId}`, { method: 'DELETE' });
}

/**
 * Upsert a single project by its clientId.
 * Replaces the old syncUserProjects bulk call for on-keystroke saves.
 * @param {object} project
 * @returns {object} The saved project from the server.
 */
export async function upsertUserProject(project) {
  const data = await authFetch('/projects/item', {
    method: 'PUT',
    body: project,
  });
  return data.project;
}

/**
 * Upload an image file to Cloudinary via the backend proxy.
 * Returns the secure HTTPS URL of the uploaded image.
 * @param {File} file
 * @returns {Promise<string>} Cloudinary secure URL
 */
export async function uploadImage(file) {
  const token = getStoredToken();
  const form  = new FormData();
  form.append('file', file);

  const res = await fetch(`${BASE}/images/upload`, {
    method: 'POST',
    // NOTE: Do NOT set Content-Type — the browser sets multipart/form-data + boundary automatically
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) throw new Error(data.error || 'Image upload failed');
  return data.url;
}

// ─── Compile ──────────────────────────────────────────────────────────────────

/**
 * Start a compile job for a full project.
 * @param {{ metadata, templateId, frontMatter, chapters }} project
 * @returns {{ jobId: string }}
 */
export async function compileProject(project) {
  const res = await fetch(`${BASE}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Compile failed');
  return data; // { jobId }
}

/**
 * Poll compile status.
 * @returns {{ status: string, error?: string }}
 */
export async function getCompileStatus(jobId) {
  const res  = await fetch(`${BASE}/compile/${jobId}/status`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Status check failed');
  return data;
}

/**
 * Get the compiled PDF blob URL.
 */
export async function fetchCompiledPdf(jobId) {
  const res = await fetch(`${BASE}/compile/${jobId}/pdf`);
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
}

/**
 * Get the exported PDF blob URL (from the /documents/export route).
 */
export async function fetchExportPdf(jobId) {
  const res = await fetch(`${BASE}/documents/export/${jobId}/pdf`);
  if (!res.ok) throw new Error(`Export PDF fetch failed (${res.status})`);
  const blob = await res.blob();
  return URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
}

/**
 * Poll until done or failed.
 */
export async function pollUntilDone(jobId, onStatus, { intervalMs = 1500, maxAttempts = 40 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getCompileStatus(jobId);
    onStatus(status);
    if (status.status === 'done' || status.status === 'failed') return status;
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Compile timed out');
}

// ─── Templates ────────────────────────────────────────────────────────────────

export async function fetchTemplates() {
  const res  = await fetch(`${BASE}/templates`);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Failed to fetch templates');
  return data.templates;
}

/** Health check */
export async function healthCheck() {
  const res = await fetch(`${BASE}/health`);
  return res.json();
}

// ─── Vision ───────────────────────────────────────────────────────────────────

export async function extractMathFromImage(base64Image) {
  const res = await fetch(`${BASE}/vision/math`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Image }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Vision extraction failed');
  return data; // { type: 'math'|'text', content: string }
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const token = getStoredToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}/documents/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Upload failed with status ${res.status}`);
  }
  return data;
}
