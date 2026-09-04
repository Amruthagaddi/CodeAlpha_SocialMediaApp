// User Profile Page Script for Mitra

let profileUserId = null;
let isOwnProfile = false;

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar('profile');
  requireAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('id');
  const currentUser = getStoredUser();

  if (!targetId || targetId === currentUser._id) {
    profileUserId = currentUser._id;
    isOwnProfile = true;
  } else {
    profileUserId = targetId;
    isOwnProfile = false;
  }

  loadProfileHeader();
  loadUserPosts();
  setupEditProfileModal();
});

// Load Profile Header Info
async function loadProfileHeader() {
  const headerContainer = document.getElementById('profile-header-container');
  if (!headerContainer) return;

  try {
    const data = await fetchWithAuth(`/api/users/${profileUserId}`);
    const user = data.user;

    let actionButtonHTML = '';
    if (isOwnProfile) {
      actionButtonHTML = `
        <button onclick="openEditProfileModal()" class="btn btn-secondary btn-sm">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
          </svg>
          <span>Edit Profile</span>
        </button>
      `;
    } else {
      let followText = 'Follow';
      let followClass = 'btn-primary';

      if (user.isFollowing) {
        followText = 'Following';
        followClass = 'btn-outline';
      } else if (user.hasRequestedFollow) {
        followText = 'Requested';
        followClass = 'btn-secondary';
      }

      actionButtonHTML = `
        <div style="display:flex; gap:0.5rem;">
          <button onclick="toggleProfileFollow(this)" class="btn ${followClass}">
            ${followText}
          </button>
          <a href="messages.html?userId=${user._id}" class="btn btn-secondary btn-sm" title="Message User">
            💬 Message
          </a>
        </div>
      `;
    }

    headerContainer.innerHTML = `
      <div class="profile-header-card">
        <div class="profile-banner"></div>
        <div class="profile-info-bar">
          <div class="profile-avatar-wrapper">
            <div style="display:flex; align-items:center; gap:1rem;">
              ${renderAvatarHTML(user, 'avatar-xl', 'box-shadow: var(--shadow-md); margin-top:-60px; border:4px solid var(--bg-card);')}
            </div>
            <div id="profile-action-btn-container">
              ${actionButtonHTML}
            </div>
          </div>

          <div style="display:flex; align-items:center; gap:0.5rem;">
            <h2 class="profile-details-name">${escapeHTML(user.name)}</h2>
            ${user.isPrivate ? '<span style="font-size:1.1rem;" title="Private Account">🔒</span>' : ''}
          </div>
          <p class="profile-details-handle">@${escapeHTML(user.username)}</p>
          <p class="profile-details-bio">${user.bio ? escapeHTML(user.bio) : '<span style="color:var(--text-muted); font-style:italic;">No bio added yet.</span>'}</p>

          <div class="profile-stats-row">
            <div class="stat-item" style="align-items: flex-start;">
              <span class="stat-value" id="profile-posts-count">${user.postsCount || 0}</span>
              <span class="stat-label">Posts</span>
            </div>
            <div class="stat-item" style="align-items: flex-start;">
              <span class="stat-value" id="profile-followers-count">${user.followersCount || 0}</span>
              <span class="stat-label">Followers</span>
            </div>
            <div class="stat-item" style="align-items: flex-start;">
              <span class="stat-value" id="profile-following-count">${user.followingCount || 0}</span>
              <span class="stat-label">Following</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // Populate Edit Modal Inputs if own profile
    if (isOwnProfile) {
      document.getElementById('edit-name-input').value = user.name || '';
      document.getElementById('edit-username-input').value = user.username || '';
      document.getElementById('edit-bio-input').value = user.bio || '';
      const privacyCheckbox = document.getElementById('edit-privacy-toggle');
      if (privacyCheckbox) privacyCheckbox.checked = !!user.isPrivate;
    }
  } catch (error) {
    showToast('Failed to load Mitra profile: ' + error.message, 'error');
  }
}

// Follow / Unfollow / Request Toggle from Profile Header
async function toggleProfileFollow(buttonElement) {
  const currentText = buttonElement.textContent.trim();
  const method = currentText === 'Following' || currentText === 'Requested' ? 'DELETE' : 'POST';

  try {
    const data = await fetchWithAuth(`/api/users/${profileUserId}/follow`, { method });

    if (data.isFollowing) {
      buttonElement.textContent = 'Following';
      buttonElement.className = 'btn btn-outline';
    } else if (data.isRequested) {
      buttonElement.textContent = 'Requested';
      buttonElement.className = 'btn btn-secondary';
    } else {
      buttonElement.textContent = 'Follow';
      buttonElement.className = 'btn btn-primary';
    }

    const followersCountSpan = document.getElementById('profile-followers-count');
    if (followersCountSpan) {
      followersCountSpan.textContent = data.followersCount;
    }

    showToast(data.message, 'success');
    loadUserPosts();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

// Switch Profile Tab (Posts vs Saved)
function switchProfileTab(tabName) {
  const postsBtn = document.getElementById('tab-posts-btn');
  const savedBtn = document.getElementById('tab-saved-btn');

  if (tabName === 'saved') {
    if (postsBtn) postsBtn.className = 'btn btn-sm btn-outline';
    if (savedBtn) savedBtn.className = 'btn btn-sm btn-primary';
    loadSavedPosts();
  } else {
    if (postsBtn) postsBtn.className = 'btn btn-sm btn-primary';
    if (savedBtn) savedBtn.className = 'btn btn-sm btn-outline';
    loadUserPosts();
  }
}

// Load Saved Posts for Profile
async function loadSavedPosts() {
  const container = document.getElementById('profile-posts-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const data = await fetchWithAuth('/api/posts/saved');
    const posts = data.posts || [];

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔖</div>
          <h4 class="empty-title">No Saved Posts</h4>
          <p class="empty-subtitle">Click the bookmark icon on any post to save it for later.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map((post) => createPostHTML(post)).join('');
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><p class="empty-subtitle">${error.message}</p></div>`;
  }
}

// Load Specific User's Posts (Checking Private Lock)
async function loadUserPosts() {
  const container = document.getElementById('profile-posts-container');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const data = await fetchWithAuth(`/api/posts?userId=${profileUserId}`);

    if (data.isPrivateAccount) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <h4 class="empty-title">This Account is Private</h4>
          <p class="empty-subtitle">Follow this user to see their posts and updates on Mitra.</p>
        </div>
      `;
      return;
    }

    const posts = data.posts || [];

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📷</div>
          <h4 class="empty-title">No Posts Yet</h4>
          <p class="empty-subtitle">${isOwnProfile ? 'You haven’t published any posts yet.' : 'This user hasn’t published any posts.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = posts.map((post) => createPostHTML(post)).join('');
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><p class="empty-subtitle">${error.message}</p></div>`;
  }
}

// Edit Profile Modal Handler supporting MinIO Profile Picture, Privacy Toggle & Delete Account
function setupEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  const form = document.getElementById('edit-profile-form');

  if (!modal || !form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('edit-name-input').value.trim();
    const username = document.getElementById('edit-username-input').value.trim();
    const bio = document.getElementById('edit-bio-input').value.trim();
    const isPrivate = document.getElementById('edit-privacy-toggle').checked;
    const picFile = document.getElementById('edit-picture-file');

    if (!name || !username) {
      showToast('Name and Username cannot be empty', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('name', name);
    formData.append('username', username);
    formData.append('bio', bio);
    formData.append('isPrivate', isPrivate);

    if (picFile && picFile.files && picFile.files[0]) {
      formData.append('profilePicture', picFile.files[0]);
    }

    try {
      const data = await fetchWithAuth(`/api/users/${profileUserId}`, {
        method: 'PUT',
        body: formData
      });

      setStoredUser(data.user);
      showToast('Mitra profile updated successfully!', 'success');
      closeEditProfileModal();

      renderNavbar('profile');
      loadProfileHeader();
    } catch (error) {
      showToast('Failed to update profile: ' + error.message, 'error');
    }
  });
}

// Account Deletion Handler
async function handleDeleteAccount() {
  if (!confirm('CRITICAL WARNING: Are you sure you want to permanently delete your Mitra account?\n\nThis will permanently delete all your posts, comments, notifications, and messages.')) {
    return;
  }

  const confirmText = prompt('To confirm permanent deletion, type "DELETE" below:');
  if (confirmText !== 'DELETE') {
    showToast('Account deletion canceled.', 'info');
    return;
  }

  try {
    const data = await fetchWithAuth('/api/users/me', { method: 'DELETE' });
    removeToken();
    removeStoredUser();
    alert(data.message);
    window.location.href = 'register.html';
  } catch (error) {
    showToast('Failed to delete account: ' + error.message, 'error');
  }
}

function openEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (modal) modal.classList.add('active');
}

function closeEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (modal) modal.classList.remove('active');
}
