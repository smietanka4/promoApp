const API_BASE = import.meta.env.VITE_API_URL || '';

export const GOOGLE_AUTH_URL = `${API_BASE}/api/auth/google`;

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const err = new Error(data?.error || `Błąd serwera (${response.status}).`);
    err.status = response.status;
    throw err;
  }

  return data;
}

export function getMe() {
  return request('/api/auth/me');
}

export function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

export function getDashboardSummary(month) {
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  return request(`/api/dashboard/summary${query}`);
}

export function scanReceipt(file) {
  const formData = new FormData();
  formData.append('receipt', file, file.name || 'paragon.jpg');

  return request('/api/receipts/scan', {
    method: 'POST',
    body: formData,
  });
}

export function saveReceipt(payload) {
  return request('/api/receipts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export function deleteReceipt(id) {
  return request(`/api/receipts/${id}`, {
    method: 'DELETE',
  });
}
