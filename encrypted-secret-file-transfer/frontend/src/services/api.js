// All browser -> backend traffic goes through the API Gateway under /api.
const TOKEN_KEY = 'efts_token';
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

function apiError(status, data) {
  const err = new Error((data && data.error) || `Request failed (${status})`);
  err.status = status;
  return err;
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Is the gateway running?');
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && token && !path.startsWith('/auth/login')) onUnauthorized();
  if (!res.ok) throw apiError(res.status, data);
  return data;
}

const qs = (o = {}) => {
  const p = new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
  return p.toString() ? `?${p}` : '';
};

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (name, email, password) => request('/auth/register', { method: 'POST', body: { name, email, password } }),
  me: () => request('/auth/me'),
  overview: () => request('/overview'),
  serviceStatus: () => request('/service-status'),
  files: (scope = 'all') => request(`/files${qs({ scope })}`),
  file: (id) => request(`/files/${id}`),
  deleteFile: (id) => request(`/files/${id}`, { method: 'DELETE' }),
  share: (fileId, email, level = 'download') => request('/permissions', { method: 'POST', body: { fileId, email, level } }),
  permissions: (fileId) => request(`/permissions/${fileId}`),
  revoke: (permissionId) => request(`/permissions/${permissionId}`, { method: 'DELETE' }),
  logs: (params) => request(`/logs${qs(params)}`),
  adminUsers: () => request('/admin/users'),
  adminLogs: (params) => request(`/admin/logs${qs(params)}`),
  adminStats: () => request('/admin/stats'),
  patchUser: (id, body) => request(`/admin/users/${id}`, { method: 'PATCH', body }),

  // XMLHttpRequest (not fetch) so we can report upload progress.
  upload(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/files/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => {
        let data = null;
        try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status === 401) onUnauthorized();
        xhr.status >= 200 && xhr.status < 300 ? resolve(data) : reject(apiError(xhr.status, data));
      };
      xhr.onerror = () => reject(new Error('Upload failed: cannot reach the server'));
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },

  // The server authorises + decrypts; the browser just receives the original bytes.
  async download(file) {
    const res = await fetch(`/api/files/${file.id}/download`, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (!res.ok) throw apiError(res.status, await res.json().catch(() => null));
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url; a.download = file.originalName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};
