// replaces client/src/api.ts
// Override for a staging server; defaults to local POC backend.
export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function api(path: string, method = 'GET', body?: unknown) {
  const token = localStorage.getItem('token');
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

// file upload: no Content-Type header, the browser sets the multipart boundary itself
export async function apiUpload(path: string, file: File) {
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }
  return data;
}
