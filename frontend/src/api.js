const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    let detail = await res.text();
    try { detail = JSON.parse(detail).detail || detail; } catch {}
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const wsUrl = () => {
  const base = API_BASE || window.location.origin;
  return base.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/events';
};
