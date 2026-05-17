const BASE = import.meta.env.VITE_API_URL || 'https://docfoge.onrender.com/api';

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
