// Home Feed JavaScript Handler for Mitra

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar('home');
  requireAuth();

  loadUserProfileWidget();
  loadFeedPosts();
  loadSuggestedUsers();
  loadTrendingHashtags();
});

// Format hashtags & @mentions in post text
function formatPostContent(text) {
  if (!text) return '';
  let escaped = escapeHTML(text);
  // Hashtags
  escaped = escaped.replace(/#([a-zA-Z0-9_]+)/g, '<a href="search.html?q=%23$1" class="hashtag-link">#$1</a>');
  // Mentions
  escaped = escaped.replace(/@([a-zA-Z0-9_]+)/g, '<a href="search.html?q=$1" class="mention-link">@$1</a>');
  return escaped;
}

// Load Trending Hashtags Widget
async function loadTrendingHashtags() {
  const container = document.getElementById('trending-hashtags-container');
  if (!container) return;

  try {
    const data = await fetchWithAuth('/api/posts/trending/hashtags');
    const tags = data.hashtags || [];

    if (tags.length === 0) {
      container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No trending topics yet.</p>`;
      return;
    }

    container.innerHTML = tags
      .map(
        (t) => `
      <a href="search.html?q=${encodeURIComponent(t.tag)}" class="trending-hashtag-item">
        <span style="font-weight:700; color:var(--primary);">${t.tag}</span>
        <span style="font-size:0.78rem; color:var(--text-muted);">${t.count} ${t.count === 1 ? 'post' : 'posts'}</span>
      </a>
    `
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">Trending topics unavailable.</p>`;
  }
}

// Render Single Post Card
function createPostHTML(post) {
  const currentUser = getStoredUser();
  const isAuthor = currentUser && post.author && currentUser._id === post.author._id;

  const images = post.images && post.images.length > 0 ? post.images : post.image ? [post.image] : [];
  let mediaHTML = '';

  if (images.length === 1) {
    const safeImg = escapeHTML(images[0]);
    mediaHTML = `
      <div class="post-image-container">
        <img src="${safeImg}" alt="Post image" class="post-image" onerror="this.onerror=null; const c=this.closest('.post-image-container'); if(c) c.style.display='none';">
      </div>
    `;
  } else if (images.length > 1) {
    const slides = images.map((img) => `<img src="${escapeHTML(img)}" alt="Slide" class="carousel-slide" onerror="this.onerror=null; this.style.display='none';">`).join('');
    const dots = images.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}"></span>`).join('');
    mediaHTML = `
      <div class="carousel-container" id="carousel-${post._id}">
        <div class="carousel-slides">${slides}</div>
        <button class="carousel-btn carousel-btn-prev" onclick="moveCarousel('${post._id}', -1)">❮</button>
        <button class="carousel-btn carousel-btn-next" onclick="moveCarousel('${post._id}', 1)">❯</button>
        <div class="carousel-dots">${dots}</div>
      </div>
    `;
  }

  const recSummary = post.reactionsSummary || { love: 0, fire: 0, clap: 0, laugh: 0 };
  const totalReactions = recSummary.love + recSummary.fire + recSummary.clap + recSummary.laugh;

  return `
    <div class="card post-card" id="post-${post._id}">
      <div class="post-header">
        <a href="profile.html?id=${post.author ? post.author._id : ''}" class="post-author-info">
          ${renderAvatarHTML(post.author, 'avatar-md')}
          <div class="post-author-names">
            <span class="post-author-name">${post.author ? escapeHTML(post.author.name) : 'User'}</span>
            <span class="post-author-handle">@${post.author ? escapeHTML(post.author.username) : 'user'}</span>
          </div>
        </a>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span class="post-time">${formatTimeAgo(post.createdAt)}</span>
          ${
            isAuthor
              ? `
            <button onclick="handleDeletePost('${post._id}')" class="btn-delete-post" title="Delete Post">
              <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          `
              : ''
          }
        </div>
      </div>

      <div class="post-content">${formatPostContent(post.content)}</div>

      ${mediaHTML}

      <div class="post-actions">
        <div class="reaction-wrapper">
          <button onclick="handleToggleLike('${post._id}')" class="action-btn ${post.userHasLiked ? 'liked' : ''}" id="like-btn-${post._id}">
            <svg fill="${post.userHasLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
            </svg>
            <span id="likes-count-${post._id}">${post.likesCount}</span>
          </button>
          <div class="reaction-picker">
            <button onclick="handleReactToPost('${post._id}', 'love')" class="reaction-emoji-btn" title="Love">❤️</button>
            <button onclick="handleReactToPost('${post._id}', 'fire')" class="reaction-emoji-btn" title="Fire">🔥</button>
            <button onclick="handleReactToPost('${post._id}', 'clap')" class="reaction-emoji-btn" title="Clap">👏</button>
            <button onclick="handleReactToPost('${post._id}', 'laugh')" class="reaction-emoji-btn" title="Laugh">😂</button>
          </div>
        </div>

        <button onclick="toggleComments('${post._id}')" class="action-btn">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
          <span id="comments-count-${post._id}">${post.commentsCount}</span>
        </button>

        <button onclick="handleToggleBookmark('${post._id}')" class="action-btn ${post.isBookmarked ? 'bookmarked' : ''}" id="bookmark-btn-${post._id}" title="Save Post">
          <svg fill="${post.isBookmarked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
          </svg>
          <span id="bookmark-text-${post._id}">${post.isBookmarked ? 'Saved' : 'Save'}</span>
        </button>
      </div>

      <!-- Collapsible Comments Section -->
      <div class="comments-section" id="comments-section-${post._id}" style="display: none;">
        <form onsubmit="handleAddComment(event, '${post._id}')" class="comment-input-group">
          <input type="text" class="comment-input" id="comment-input-${post._id}" placeholder="Write a comment..." required>
          <button type="submit" class="btn btn-primary btn-sm">Comment</button>
        </form>
        <div class="comment-list" id="comment-list-${post._id}">
          <div class="loading-spinner" style="padding:1rem;"><div class="spinner" style="width:20px;height:20px;"></div></div>
        </div>
      </div>
    </div>
  `;
}

// Load Left Sidebar User Profile Widget
async function loadUserProfileWidget() {
  const widgetContainer = document.getElementById('user-profile-widget');
  if (!widgetContainer) return;

  const currentUser = getStoredUser();
  if (!currentUser) return;

  try {
    const data = await fetchWithAuth(`/api/users/${currentUser._id}`);
    const user = data.user;

    setStoredUser(user);

    widgetContainer.innerHTML = `
      <div class="card user-widget">
        <a href="profile.html" style="display:inline-block; margin-bottom:0.85rem;">
          ${renderAvatarHTML(user, 'avatar-lg', 'border:3px solid var(--primary); display:flex; margin:0 auto;')}
        </a>
        <h3 class="user-widget-name"><a href="profile.html">${escapeHTML(user.name)}</a></h3>
        <p class="user-widget-handle">@${escapeHTML(user.username)}</p>
        <p class="user-widget-bio">${user.bio ? escapeHTML(user.bio) : '<span style="color:var(--text-muted); font-style:italic;">No bio added yet.</span>'}</p>
        <div class="widget-stats">
          <div class="stat-item">
            <span class="stat-value">${user.postsCount || 0}</span>
            <span class="stat-label">Posts</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${user.followersCount || 0}</span>
            <span class="stat-label">Followers</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">${user.followingCount || 0}</span>
            <span class="stat-label">Following</span>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Failed to load user widget:', error);
  }
}

// Load Home Feed Posts
async function loadFeedPosts() {
  const feedContainer = document.getElementById('posts-feed-container');
  if (!feedContainer) return;

  feedContainer.innerHTML = `
    <div class="loading-spinner">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const data = await fetchWithAuth('/api/posts');
    const posts = data.posts || [];

    if (posts.length === 0) {
      feedContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📮</div>
          <h4 class="empty-title">No posts yet.</h4>
          <p class="empty-subtitle">Be the first person to share something on Mitra!</p>
          <a href="create-post.html" class="btn btn-primary btn-sm" style="margin-top: 1rem;">Create Post</a>
        </div>
      `;
      return;
    }

    feedContainer.innerHTML = posts.map((post) => createPostHTML(post)).join('');
  } catch (error) {
    showToast('Error loading Mitra feed: ' + error.message, 'error');
    feedContainer.innerHTML = `
      <div class="empty-state">
        <h4 class="empty-title">Failed to load feed</h4>
        <p class="empty-subtitle">${error.message}</p>
      </div>
    `;
  }
}


// Like / Unlike Handler
async function handleToggleLike(postId) {
  const likeBtn = document.getElementById(`like-btn-${postId}`);
  const likesCountSpan = document.getElementById(`likes-count-${postId}`);
  const isLiked = likeBtn.classList.contains('liked');

  const method = isLiked ? 'DELETE' : 'POST';

  likeBtn.classList.toggle('liked');
  let currentCount = parseInt(likesCountSpan.textContent, 10);
  likesCountSpan.textContent = isLiked ? currentCount - 1 : currentCount + 1;

  try {
    const data = await fetchWithAuth(`/api/posts/${postId}/like`, { method });
    likesCountSpan.textContent = data.likesCount;
  } catch (error) {
    likeBtn.classList.toggle('liked');
    likesCountSpan.textContent = currentCount;
    showToast('Failed to update like: ' + error.message, 'error');
  }
}

// Delete Post Handler
async function handleDeletePost(postId) {
  if (!confirm('Are you sure you want to delete this post?')) return;

  try {
    await fetchWithAuth(`/api/posts/${postId}`, { method: 'DELETE' });
    const postCard = document.getElementById(`post-${postId}`);
    if (postCard) {
      postCard.style.transform = 'scale(0.9)';
      postCard.style.opacity = '0';
      postCard.style.transition = 'all 0.3s ease';
      setTimeout(() => postCard.remove(), 300);
    }
    showToast('Post deleted successfully', 'success');
  } catch (error) {
    showToast('Failed to delete post: ' + error.message, 'error');
  }
}

// Comments Toggle & Load
async function toggleComments(postId) {
  const commentsSection = document.getElementById(`comments-section-${postId}`);
  const isHidden = commentsSection.style.display === 'none';

  if (isHidden) {
    commentsSection.style.display = 'block';
    await loadComments(postId);
  } else {
    commentsSection.style.display = 'none';
  }
}

async function loadComments(postId) {
  const commentList = document.getElementById(`comment-list-${postId}`);
  if (!commentList) return;

  try {
    const data = await fetchWithAuth(`/api/posts/${postId}/comments`);
    const comments = data.comments || [];
    const currentUser = getStoredUser();

    if (comments.length === 0) {
      commentList.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); text-align:center; padding:0.5rem 0;">No comments yet. Be the first to comment!</p>`;
      return;
    }

    commentList.innerHTML = comments
      .map((c) => {
        const isCommentAuthor = currentUser && c.author && currentUser._id === c.author._id;
        return `
        <div class="comment-item" id="comment-${c._id}">
          ${renderAvatarHTML(c.author, 'avatar-sm')}
          <div class="comment-body">
            <div class="comment-header">
              <span class="comment-author-name">${c.author ? escapeHTML(c.author.name) : 'User'}</span>
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <span class="comment-time">${formatTimeAgo(c.createdAt)}</span>
                ${
                  isCommentAuthor
                    ? `
                  <button onclick="handleDeleteComment('${c._id}', '${postId}')" class="btn-delete-comment" title="Delete Comment">✕</button>
                `
                    : ''
                }
              </div>
            </div>
            <div class="comment-text">${escapeHTML(c.text)}</div>
          </div>
        </div>
      `;
      })
      .join('');
  } catch (error) {
    commentList.innerHTML = `<p style="font-size:0.85rem; color:var(--accent-red);">Error loading comments</p>`;
  }
}

async function handleAddComment(event, postId) {
  event.preventDefault();
  const input = document.getElementById(`comment-input-${postId}`);
  const text = input.value.trim();

  if (!text) return;

  try {
    const data = await fetchWithAuth(`/api/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    input.value = '';

    const commentsCountSpan = document.getElementById(`comments-count-${postId}`);
    if (commentsCountSpan) {
      commentsCountSpan.textContent = data.commentsCount;
    }

    showToast('Comment added!', 'success');
    await loadComments(postId);
  } catch (error) {
    showToast('Failed to add comment: ' + error.message, 'error');
  }
}

async function handleDeleteComment(commentId, postId) {
  try {
    const data = await fetchWithAuth(`/api/comments/${commentId}`, { method: 'DELETE' });

    const commentElement = document.getElementById(`comment-${commentId}`);
    if (commentElement) commentElement.remove();

    const commentsCountSpan = document.getElementById(`comments-count-${postId}`);
    if (commentsCountSpan) {
      commentsCountSpan.textContent = data.commentsCount;
    }

    showToast('Comment deleted', 'success');
  } catch (error) {
    showToast('Failed to delete comment: ' + error.message, 'error');
  }
}

// Load Suggested Users Sidebar (Zero Fake Data)
async function loadSuggestedUsers() {
  const container = document.getElementById('suggested-users-list');
  if (!container) return;

  try {
    const data = await fetchWithAuth('/api/users/search/a');
    const currentUser = getStoredUser();
    const users = (data.users || []).filter((u) => u._id !== currentUser._id).slice(0, 4);

    if (users.length === 0) {
      container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); padding:0.5rem 0;">No suggestions right now. Search for registered users to follow!</p>`;
      return;
    }

    container.innerHTML = users
      .map(
        (u) => `
      <div class="suggested-item">
        <a href="profile.html?id=${u._id}" class="suggested-user-info">
          ${renderAvatarHTML(u, 'avatar-sm')}
          <div class="suggested-names">
            <span class="suggested-name">${escapeHTML(u.name)}</span>
            <span class="suggested-handle">@${escapeHTML(u.username)}</span>
          </div>
        </a>
        <button onclick="toggleFollowUser('${u._id}', this)" class="btn ${u.isFollowing ? 'btn-outline' : 'btn-primary'} btn-sm">
          ${u.isFollowing ? 'Following' : 'Follow'}
        </button>
      </div>
    `
      )
      .join('');
  } catch (error) {
    container.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted);">No suggestions right now.</p>`;
  }
}

async function toggleFollowUser(userId, buttonElement) {
  const isFollowing = buttonElement.textContent.trim() === 'Following';
  const method = isFollowing ? 'DELETE' : 'POST';

  try {
    const data = await fetchWithAuth(`/api/users/${userId}/follow`, { method });

    if (data.isFollowing) {
      buttonElement.textContent = 'Following';
      buttonElement.className = 'btn btn-outline btn-sm';
    } else {
      buttonElement.textContent = 'Follow';
      buttonElement.className = 'btn btn-primary btn-sm';
    }

    showToast(data.message, 'success');
    loadUserProfileWidget();
  } catch (error) {
    showToast(error.message, 'error');
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

// Toggle Post Bookmark
async function handleToggleBookmark(postId) {
  try {
    const data = await fetchWithAuth(`/api/posts/${postId}/bookmark`, { method: 'POST' });
    const btn = document.getElementById(`bookmark-btn-${postId}`);
    const textSpan = document.getElementById(`bookmark-text-${postId}`);
    if (btn) {
      btn.className = `action-btn ${data.isBookmarked ? 'bookmarked' : ''}`;
      const svg = btn.querySelector('svg');
      if (svg) svg.setAttribute('fill', data.isBookmarked ? 'currentColor' : 'none');
    }
    if (textSpan) {
      textSpan.textContent = data.isBookmarked ? 'Saved' : 'Save';
    }
    showToast(data.message, 'success');
  } catch (err) {
    showToast('Failed to save post: ' + err.message, 'error');
  }
}

// React to Post with Emojis
async function handleReactToPost(postId, reactionType) {
  try {
    const data = await fetchWithAuth(`/api/posts/${postId}/react`, {
      method: 'POST',
      body: JSON.stringify({ reactionType })
    });
    showToast(`Reaction updated!`, 'info');
  } catch (err) {
    showToast('Failed to react: ' + err.message, 'error');
  }
}

// Multi-Image Carousel Slider Handler
function moveCarousel(postId, direction) {
  const container = document.getElementById(`carousel-${postId}`);
  if (!container) return;

  const slidesContainer = container.querySelector('.carousel-slides');
  const slides = container.querySelectorAll('.carousel-slide');
  const dots = container.querySelectorAll('.carousel-dot');

  let currentIndex = parseInt(container.dataset.currentIndex || '0', 10);
  currentIndex += direction;

  if (currentIndex < 0) currentIndex = slides.length - 1;
  if (currentIndex >= slides.length) currentIndex = 0;

  container.dataset.currentIndex = currentIndex;
  slidesContainer.style.transform = `translateX(-${currentIndex * 100}%)`;

  dots.forEach((dot, idx) => {
    dot.className = `carousel-dot ${idx === currentIndex ? 'active' : ''}`;
  });
}
