const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function clearSessionAndReload() {
  ['inv_token', 'inv_user', 'inv_brand', 'inv_appStage'].forEach(k => localStorage.removeItem(k));
  // Flag for the login screen so the redirect isn't a silent, unexplained
  // dump back to the sign-in form — see Login.jsx's session-expired banner.
  try { sessionStorage.setItem('inv_session_expired', '1'); } catch { /* storage unavailable */ }
  window.location.href = '/login';
}

async function request(method, path, data, token) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));

    // Stale token or brand deleted — clear session and send to login
    if (res.status === 401 || res.status === 403) {
      clearSessionAndReload();
      return;
    }

    const err = new Error(body.error || 'Request failed');
    err.status = res.status;
    err.data = body;
    throw err;
  }

  return res.json();
}

export const api = {
  get:    (path, token)         => request('GET',    path, undefined, token),
  post:   (path, data, token)   => request('POST',   path, data,      token),
  patch:  (path, data, token)   => request('PATCH',  path, data,      token),
  delete: (path, token)         => request('DELETE', path, undefined, token),
};
