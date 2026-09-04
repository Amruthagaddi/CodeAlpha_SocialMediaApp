// User Search Page Script for Mitra

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar('search');

  const searchInput = document.getElementById('search-user-input');
  const searchForm = document.getElementById('search-form');

  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('q') || urlParams.get('query') || '';

  if (searchInput) {
    if (initialQuery) {
      searchInput.value = initialQuery;
    }

    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        performSearch(searchInput.value.trim());
      }, 300);
    });
  }

  if (searchForm) {
    searchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      performSearch(searchInput ? searchInput.value.trim() : '');
    });
  }

  performSearch(initialQuery);
});

async function performSearch(query) {
  const container = document.getElementById('search-results-container');
  if (!container) return;

  container.innerHTML = `
    <div style="grid-column: 1 / -1;" class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const url = query && query.trim() !== ''
      ? `/api/users/search/${encodeURIComponent(query.trim())}`
      : '/api/users/search';

    const data = await fetchWithAuth(url);
    const users = data.users || [];
    const currentUser = getStoredUser();

    if (users.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon">👤</div>
          <h4 class="empty-title">No Users Found</h4>
          <p class="empty-subtitle">${query ? `No accounts matched "${escapeHTML(query)}". Try a different name or username.` : 'No registered users on Mitra yet.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = users
      .map((u) => {
        const isSelf = currentUser && currentUser._id === u._id;
        let followText = 'Follow';
        let followClass = 'btn-primary';

        if (u.isFollowing) {
          followText = 'Following';
          followClass = 'btn-outline';
        } else if (u.hasRequestedFollow) {
          followText = 'Requested';
          followClass = 'btn-secondary';
        }

        return `
        <div class="card user-card-result">
          ${renderAvatarHTML(u, 'avatar-lg', 'margin-bottom: 0.75rem; border: 2px solid var(--border-color); display:flex;')}
          <div style="display:flex; align-items:center; gap:0.35rem;">
            <h3 style="font-size:1.1rem; font-weight:700; color:var(--text-primary); margin-bottom:0.2rem;">${escapeHTML(u.name)}</h3>
            ${u.isPrivate ? '<span style="font-size:0.9rem;" title="Private Account">🔒</span>' : ''}
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.85rem;">@${escapeHTML(u.username)}</p>
          <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:1.2rem;">${u.bio ? escapeHTML(u.bio) : '<span style="color:var(--text-muted); font-style:italic;">No bio added yet.</span>'}</p>
          
          <div style="display:flex; gap:0.6rem; width:100%; margin-top:auto;">
            <a href="profile.html?id=${u._id}" class="btn btn-secondary btn-sm" style="flex:1;">View Profile</a>
            ${
              !isSelf && isAuthenticated()
                ? `
              <button onclick="toggleSearchFollow('${u._id}', this)" class="btn ${followClass} btn-sm" style="flex:1;">
                ${followText}
              </button>
            `
                : ''
            }
          </div>
        </div>
      `;
      })
      .join('');
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h4 class="empty-title">Search Error</h4>
        <p class="empty-subtitle">${error.message}</p>
      </div>
    `;
  }
}

async function toggleSearchFollow(userId, buttonElement) {
  const currentText = buttonElement.textContent.trim();
  const method = currentText === 'Following' || currentText === 'Requested' ? 'DELETE' : 'POST';

  try {
    const data = await fetchWithAuth(`/api/users/${userId}/follow`, { method });

    if (data.isFollowing) {
      buttonElement.textContent = 'Following';
      buttonElement.className = 'btn btn-outline btn-sm';
    } else if (data.isRequested) {
      buttonElement.textContent = 'Requested';
      buttonElement.className = 'btn btn-secondary btn-sm';
    } else {
      buttonElement.textContent = 'Follow';
      buttonElement.className = 'btn btn-primary btn-sm';
    }

    showToast(data.message, 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
}
