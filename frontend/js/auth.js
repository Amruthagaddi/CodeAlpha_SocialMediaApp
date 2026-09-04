// Auth & Shared Utility Functions for Mitra

const TOKEN_KEY = 'mitra_jwt_token';
const USER_KEY = 'mitra_user_data';

// Storage Helpers
function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function getStoredUser() {
  const userStr = localStorage.getItem(USER_KEY);
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch (e) {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function removeStoredUser() {
  localStorage.removeItem(USER_KEY);
}

function isAuthenticated() {
  return !!getToken();
}

function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
  }
}

function logout() {
  removeToken();
  removeStoredUser();
  showToast('Logged out of Mitra', 'info');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 400);
}

// Global HTML Escape Utility
function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Fetch Wrapper with Automatic Auth Headers
async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && !url.includes('/api/auth/login') && !url.includes('/api/auth/register')) {
      removeToken();
      removeStoredUser();
      window.location.href = 'login.html';
    }
    throw new Error(data.message || 'An error occurred during request');
  }

  return data;
}

// Global Avatar Error Fallback Handler
function handleAvatarError(imgElem, initial) {
  if (!imgElem || imgElem.dataset.errorHandled) return;
  imgElem.dataset.errorHandled = 'true';
  const placeholder = document.createElement('div');
  placeholder.className = (imgElem.className || '').replace('nav-avatar', 'avatar-placeholder');
  placeholder.style.cssText = imgElem.style.cssText;
  placeholder.textContent = initial || 'M';
  if (imgElem.parentNode) {
    imgElem.parentNode.replaceChild(placeholder, imgElem);
  }
}

// Neutral Avatar HTML Renderer (No Fake Default Pictures)
function renderAvatarHTML(user, sizeClass = 'avatar-sm', extraStyle = '') {
  const initial = user && user.name ? escapeHTML(user.name.trim().charAt(0).toUpperCase()) : 'M';
  const safeName = user && user.name ? escapeHTML(user.name) : 'User';

  if (user && user.profilePicture) {
    const safePic = escapeHTML(user.profilePicture);
    return `<img src="${safePic}" alt="${safeName}" class="nav-avatar ${sizeClass}" style="${extraStyle}" onerror="handleAvatarError(this, '${initial}')">`;
  }
  return `<div class="avatar-placeholder ${sizeClass}" style="${extraStyle}">${initial}</div>`;
}

// Global Toast Notification Manager
function showToast(message, type = 'info') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Dynamic Navbar Renderer for Mitra
function renderNavbar(activePage = 'home') {
  const navContainer = document.getElementById('navbar-root');
  if (!navContainer) return;

  const user = getStoredUser();
  const loggedIn = isAuthenticated();

  navContainer.innerHTML = `
    <nav class="navbar">
      <div class="nav-container">
        <a href="index.html" class="brand-logo">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
          </svg>
          <span class="brand-gradient">MITRA</span>
        </a>

        <ul class="nav-links">
          <li>
            <a href="index.html" class="nav-link ${activePage === 'home' ? 'active' : ''}">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              <span>Home</span>
            </a>
          </li>
          <li>
            <a href="search.html" class="nav-link ${activePage === 'search' ? 'active' : ''}">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <span>Search</span>
            </a>
          </li>
          ${
            loggedIn
              ? `
          <li>
            <a href="notifications.html" class="nav-link ${activePage === 'notifications' ? 'active' : ''}">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
              </svg>
              <span>Notifications</span>
              <span id="nav-notif-badge" class="nav-badge" style="display:none;">0</span>
            </a>
          </li>
          <li>
            <a href="messages.html" class="nav-link ${activePage === 'messages' ? 'active' : ''}">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
              </svg>
              <span>Messages</span>
              <span id="nav-msg-badge" class="nav-badge" style="display:none;">0</span>
            </a>
          </li>
          <li>
            <a href="create-post.html" class="nav-link ${activePage === 'create-post' ? 'active' : ''}">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
              <span>Create Post</span>
            </a>
          </li>
          `
              : ''
          }
        </ul>

        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button onclick="toggleTheme()" class="theme-toggle-btn" title="Toggle Light/Dark Theme" style="padding:0.4rem 0.6rem;">
            <span id="theme-btn-label">${(localStorage.getItem('mitra_theme') || 'dark') === 'dark' ? '🌙' : '☀️'}</span>
          </button>

          ${
            loggedIn && user
              ? `
            <a href="profile.html" class="nav-user-profile" title="View Profile">
              ${renderAvatarHTML(user, 'avatar-sm')}
              <span style="font-weight:600; font-size:0.9rem; color:var(--text-primary);">${user.name.split(' ')[0]}</span>
            </a>
            <button onclick="logout()" class="btn-logout" title="Log Out">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
              <span>Logout</span>
            </button>
          `
              : `
            <a href="login.html" class="btn btn-primary btn-sm">Login</a>
            <a href="register.html" class="btn btn-secondary btn-sm">Sign Up</a>
          `
          }
        </div>
      </div>
    </nav>
  `;

  if (loggedIn) {
    updateUnreadBadges();
  }
}

// Theme Manager (Dark / Light)
function initTheme() {
  const savedTheme = localStorage.getItem('mitra_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('mitra_theme', newTheme);
  const themeLabel = document.getElementById('theme-btn-label');
  if (themeLabel) {
    themeLabel.textContent = newTheme === 'dark' ? '🌙' : '☀️';
  }
}

document.addEventListener('DOMContentLoaded', initTheme);

// Update Notifications & Messages Badge Counters
async function updateUnreadBadges() {
  try {
    const notifData = await fetchWithAuth('/api/notifications');
    const notifBadge = document.getElementById('nav-notif-badge');
    if (notifBadge && notifData.unreadCount > 0) {
      notifBadge.textContent = notifData.unreadCount;
      notifBadge.style.display = 'inline-block';
    }

    const msgData = await fetchWithAuth('/api/messages/conversations');
    const totalUnreadMsg = (msgData.conversations || []).reduce((acc, c) => acc + (c.unreadCount || 0), 0);
    const msgBadge = document.getElementById('nav-msg-badge');
    if (msgBadge && totalUnreadMsg > 0) {
      msgBadge.textContent = totalUnreadMsg;
      msgBadge.style.display = 'inline-block';
    }
  } catch (err) {
    // Ignore badge errors silently
  }
}

// Relative Time Helper
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
