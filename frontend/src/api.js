/** Backend is always the Render deployment – no env vars needed on the frontend. */
const BASE = 'https://docfoge.onrender.com/api';

const TOKEN_KEY = 'acadoc_token';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function authFetch(path, options = {}) {
  const { token: _token, body, headers: extraHeaders, ...fetchOptions } = options;
  const token = _token ?? getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(extraHeaders || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: fetchOptions.method || 'GET',
    ...fetchOptions,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return parseJson(res);
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
  const data = await authFetch('/projects/sync/all', {
    method: 'PUT',
    body: { projects },
  });
  return data.projects;
}

export async function deleteUserProject(clientId) {
  await authFetch(`/projects/${clientId}`, { method: 'DELETE' });
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
 * Poll until done or failed.
 */
export async function pollUntilDone(jobId, onStatus, { intervalMs = 1500, maxAttempts = 40 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const status = await getCompileStatus(jobId);
    onStatus(status);
    if (status.status === 'done' || status.status === 'failed') return status;
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
