const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('navy_token');
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem('navy_token', token);
  } else {
    window.localStorage.removeItem('navy_token');
  }
}

export function setUser(user) {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem('navy_user', JSON.stringify(user));
  } else {
    window.localStorage.removeItem('navy_user');
  }
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('navy_user');
  return raw ? JSON.parse(raw) : null;
}

export function logout() {
  setToken(null);
  setUser(null);
}

const ROLE_HOME = {
  super_admin: '/admin/overview',
  shop_operator: '/shop/pos',
  staff: '/dashboard',
  recharge_operator: '/dashboard',
};

export function roleHome(role) {
  return ROLE_HOME[role] || '/login';
}

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    const data = await res.json().catch(() => ({}));
    return { reachable: true, apiBaseUrl: API_BASE_URL, ...data };
  } catch (err) {
    return { reachable: false, apiBaseUrl: API_BASE_URL, status: 'unreachable' };
  }
}

export async function apiFetch(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    // The request never reached the server — offline, DNS failure, connection refused.
    // Distinguished from an HTTP error response so callers (e.g. the POS offline queue)
    // can tell "try again later" apart from "the server rejected this".
    const networkError = new Error('Network unreachable');
    networkError.isNetworkError = true;
    throw networkError;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }

  return data;
}
