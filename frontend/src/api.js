// API routing strategy:
// - Local Vite dev server (localhost:5173): call FastAPI at localhost:8000
// - Railway/production single service: use same-origin /api routes
// - Optional override: set VITE_API_BASE
const configuredBase = import.meta.env.VITE_API_BASE;
const isDev = import.meta.env.DEV;
const API_BASE = configuredBase || (isDev ? 'http://localhost:8000' : '');

async function parseResponse(res, path) {
  const contentType = res.headers.get('content-type') || '';
  const bodyText = await res.text();

  if (!res.ok) {
    let detail = bodyText;
    try { detail = JSON.parse(bodyText).detail || bodyText; } catch {}
    throw new Error(detail || `Request failed: ${res.status}`);
  }

  if (contentType.includes('application/json')) {
    return bodyText ? JSON.parse(bodyText) : null;
  }

  if (bodyText.trim().startsWith('<!doctype') || bodyText.trim().startsWith('<html')) {
    throw new Error(
      `API route ${path} returned the frontend HTML page instead of JSON. ` +
      `For localhost, make sure the backend is running at http://localhost:8000. ` +
      `For Railway, make sure API calls use /api/... on the same deployed service.`
    );
  }

  try { return JSON.parse(bodyText); } catch {
    throw new Error(`API route ${path} did not return JSON. Response started with: ${bodyText.slice(0, 80)}`);
  }
}

export function getToken() {
  return localStorage.getItem('knobs_auth_token') || '';
}

export function setToken(token) {
  if (token) localStorage.setItem('knobs_auth_token', token);
  else localStorage.removeItem('knobs_auth_token');
}

export async function api(path, options = {}) {
  const apiPath = path.startsWith('/') ? path : `/${path}`;
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${apiPath}`, {
    headers,
    ...options,
  });
  return parseResponse(res, apiPath);
}

export const wsUrl = () => {
  const base = API_BASE || window.location.origin;
  return base.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/events';
};
