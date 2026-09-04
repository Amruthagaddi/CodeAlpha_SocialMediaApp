// Notifications Page Script for Mitra

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar('notifications');
  requireAuth();

  loadNotifications();
});

async function loadNotifications() {
  const container = document.getElementById('notifications-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const data = await fetchWithAuth('/api/notifications');
    const notifications = data.notifications || [];

    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔔</div>
          <h4 class="empty-title">No Notifications</h4>
          <p class="empty-subtitle">You’re all caught up! No new follow requests, likes, or comments.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = notifications.map((n) => createNotificationHTML(n)).join('');

    // Mark as read after rendering
    await fetchWithAuth('/api/notifications/read', { method: 'PUT' });
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <h4 class="empty-title">Failed to load notifications</h4>
        <p class="empty-subtitle">${error.message}</p>
      </div>
    `;
  }
}

function createNotificationHTML(n) {
  const sender = n.sender || { name: 'Someone', username: 'user' };
  const isUnread = !n.read;

  let textContent = '';
  let actionControls = '';

  if (n.type === 'follow_request') {
    textContent = `<strong>${escapeHTML(sender.name)}</strong> (@${escapeHTML(sender.username)}) requested to follow your private Mitra account.`;
    actionControls = `
      <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
        <button onclick="handleAcceptFollow('${sender._id}', '${n._id}')" class="btn btn-primary btn-sm">Accept</button>
        <button onclick="handleRejectFollow('${sender._id}', '${n._id}')" class="btn btn-secondary btn-sm">Reject</button>
      </div>
    `;
  } else if (n.type === 'follow_accept') {
    textContent = `<strong>${escapeHTML(sender.name)}</strong> (@${escapeHTML(sender.username)}) is now following you.`;
  } else if (n.type === 'like') {
    textContent = `<strong>${escapeHTML(sender.name)}</strong> liked your post.`;
  } else if (n.type === 'comment') {
    textContent = `<strong>${escapeHTML(sender.name)}</strong> commented on your post.`;
  }

  return `
    <div class="notification-item ${isUnread ? 'unread' : ''}" id="notif-${n._id}">
      <div class="notification-content">
        <a href="profile.html?id=${sender._id}">
          ${renderAvatarHTML(sender, 'avatar-md')}
        </a>
        <div>
          <p class="notification-text">${textContent}</p>
          <span style="font-size:0.78rem; color:var(--text-muted);">${formatTimeAgo(n.createdAt)}</span>
          ${actionControls}
        </div>
      </div>
      <button onclick="handleDeleteNotification('${n._id}')" class="btn-delete-comment" title="Clear notification">✕</button>
    </div>
  `;
}

async function handleAcceptFollow(senderId, notifId) {
  try {
    const data = await fetchWithAuth(`/api/users/${senderId}/accept-follow`, { method: 'POST' });
    showToast(data.message, 'success');
    const item = document.getElementById(`notif-${notifId}`);
    if (item) item.remove();
    loadNotifications();
  } catch (error) {
    showToast('Failed to accept follow request: ' + error.message, 'error');
  }
}

async function handleRejectFollow(senderId, notifId) {
  try {
    const data = await fetchWithAuth(`/api/users/${senderId}/reject-follow`, { method: 'POST' });
    showToast(data.message, 'info');
    const item = document.getElementById(`notif-${notifId}`);
    if (item) item.remove();
    loadNotifications();
  } catch (error) {
    showToast('Failed to reject follow request: ' + error.message, 'error');
  }
}

async function handleDeleteNotification(notifId) {
  try {
    await fetchWithAuth(`/api/notifications/${notifId}`, { method: 'DELETE' });
    const item = document.getElementById(`notif-${notifId}`);
    if (item) item.remove();
  } catch (error) {
    showToast('Error removing notification', 'error');
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
