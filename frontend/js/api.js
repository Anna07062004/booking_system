const API_URL = '';

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}
function getUser() {
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}
function setUser(u) { localStorage.setItem('user', JSON.stringify(u)); }

/* ============ HTTP ============ */
async function api(path, { method = 'GET', body = null, form = null, auth = true } = {}) {
  const headers = {};
  if (auth && getToken()) headers['Authorization'] = 'Bearer ' + getToken();

  let payload = null;
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = new URLSearchParams(form).toString();
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: payload });
  } catch (e) {
    throw new Error('Сервер недоступен. Проверьте, что backend запущен.');
  }

  if (res.status === 401) {
    clearToken();
    location.href = 'login.html';
    throw new Error('Не авторизован');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = data && data.detail ? data.detail : 'Ошибка запроса';
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return data;
}

function requireAuth(adminOnly = false) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) { location.href = 'login.html'; return null; }
  if (adminOnly && user.role !== 'admin') { location.href = 'dashboard.html'; return null; }
  return user;
}

function logout() { clearToken(); location.href = 'login.html'; }

function fmt(dt) {
  return new Date(dt).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

/* ============ ТЕМА ============ */
function applyTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.body.classList.toggle('light', saved === 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  updateThemeIcon();
}

/* ============ TOAST ============ */
function showToast(message, type = 'info', duration = 3200) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed; top: 24px; right: 24px; z-index: 9999;
      display: flex; flex-direction: column; gap: 10px;
      pointer-events: none;`;
    document.body.appendChild(container);
  }

  const colors = {
    info:    { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', color: '#93c5fd' },
    success: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', color: '#6ee7b7' },
    error:   { bg: 'rgba(239, 68, 68, 0.15)',  border: '#ef4444', color: '#fca5a5' },
    warning: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', color: '#fcd34d' },
  };
  const c = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.color};
    padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 500;
    font-family: 'Inter', sans-serif; backdrop-filter: blur(14px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35); max-width: 340px;
    line-height: 1.4; opacity: 0; transform: translateX(20px);
    transition: opacity 0.25s, transform 0.25s; pointer-events: auto; cursor: pointer;`;

  toast.addEventListener('click', () => dismiss());
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  function dismiss() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }

  setTimeout(dismiss, duration);
}

document.addEventListener('DOMContentLoaded', applyTheme);
applyTheme();