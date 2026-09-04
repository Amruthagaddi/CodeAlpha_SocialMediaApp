// 1-on-1 Direct Messaging Chat Handler for Mitra

let activeRecipientId = null;
let activeRecipientUser = null;
let chatPollInterval = null;

let socket = null;

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar('messages');
  requireAuth();

  const currentUser = getStoredUser();
  if (typeof io !== 'undefined' && currentUser) {
    socket = io();
    socket.emit('join_user', currentUser._id);
    socket.on('receive_direct_message', (data) => {
      if (activeRecipientId && data.senderId === activeRecipientId) {
        loadMessageHistory(activeRecipientId, true);
      }
      loadConversationsList();
    });
  }

  loadConversationsList();

  // Check URL query parameter ?userId=... to auto-select conversation
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('userId');

  if (targetId) {
    selectConversation(targetId);
  }

  // Setup message send form listener
  const messageForm = document.getElementById('chat-input-form');
  if (messageForm) {
    messageForm.addEventListener('submit', handleSendMessage);
  }
});

// Load Sidebar Conversations List
async function loadConversationsList() {
  const container = document.getElementById('conversations-list-container');
  if (!container) return;

  try {
    const data = await fetchWithAuth('/api/messages/conversations');
    const conversations = data.conversations || [];

    if (conversations.length === 0) {
      container.innerHTML = `
        <div style="padding:1.5rem; text-align:center; color:var(--text-muted); font-size:0.88rem;">
          No conversations yet. Search for users or view profile to start chatting!
        </div>
      `;
      return;
    }

    container.innerHTML = conversations
      .map((c) => {
        const u = c.user;
        if (!u) return '';
        const isActive = activeRecipientId === u._id;
        return `
        <div class="conversation-item ${isActive ? 'active' : ''}" onclick="selectConversation('${u._id}')" id="conv-${u._id}">
          ${renderAvatarHTML(u, 'avatar-md')}
          <div style="flex:1; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:700; font-size:0.92rem; color:var(--text-primary);">${escapeHTML(u.name)}</span>
              ${c.unreadCount > 0 ? `<span class="nav-badge" style="position:static;">${c.unreadCount}</span>` : ''}
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
              ${c.lastMessage ? escapeHTML(c.lastMessage) : 'Start chatting...'}
            </p>
          </div>
        </div>
      `;
      })
      .join('');
  } catch (error) {
    container.innerHTML = `<div style="padding:1rem; color:var(--accent-red);">Failed to load chat contacts</div>`;
  }
}

// Select Conversation and Load Thread
async function selectConversation(userId) {
  activeRecipientId = userId;
  clearInterval(chatPollInterval);

  // Update Active UI in sidebar
  document.querySelectorAll('.conversation-item').forEach((item) => item.classList.remove('active'));
  const activeItem = document.getElementById(`conv-${userId}`);
  if (activeItem) activeItem.classList.add('active');

  await loadMessageHistory(userId);

  // Poll for new incoming messages every 3 seconds
  chatPollInterval = setInterval(() => {
    if (activeRecipientId === userId) {
      loadMessageHistory(userId, true);
    }
  }, 3000);
}

// Load Messages Thread with Target User
async function loadMessageHistory(userId, isPolling = false) {
  const chatHeader = document.getElementById('chat-header-container');
  const chatBody = document.getElementById('chat-messages-body');
  const inputForm = document.getElementById('chat-input-form');

  if (!isPolling && chatBody) {
    chatBody.innerHTML = `
      <div class="loading-spinner">
        <div class="spinner"></div>
      </div>
    `;
  }

  try {
    const data = await fetchWithAuth(`/api/messages/${userId}`);
    activeRecipientUser = data.targetUser;
    const messages = data.messages || [];

    // Render Chat Header
    if (chatHeader && activeRecipientUser) {
      chatHeader.innerHTML = `
        <a href="profile.html?id=${activeRecipientUser._id}" style="display:flex; align-items:center; gap:0.75rem;">
          ${renderAvatarHTML(activeRecipientUser, 'avatar-md')}
          <div>
            <h4 style="font-size:1rem; font-weight:800; color:var(--text-primary);">${escapeHTML(activeRecipientUser.name)}</h4>
            <span style="font-size:0.8rem; color:var(--text-muted);">@${escapeHTML(activeRecipientUser.username)}</span>
          </div>
        </a>
      `;
    }

    if (inputForm) {
      inputForm.style.display = 'flex';
    }

    if (messages.length === 0 && chatBody) {
      chatBody.innerHTML = `
        <div class="empty-state" style="background:transparent; border:none; margin:auto;">
          <div class="empty-icon">💬</div>
          <h4 class="empty-title">No messages yet</h4>
          <p class="empty-subtitle">Send a message to start chatting with ${escapeHTML(activeRecipientUser ? activeRecipientUser.name : 'User')}.</p>
        </div>
      `;
      return;
    }

    const currentUser = getStoredUser();

    if (chatBody) {
      chatBody.innerHTML = messages
        .map((m) => {
          const senderIdStr = typeof m.sender === 'object' ? m.sender._id || m.sender : m.sender;
          const isSentByMe = currentUser && senderIdStr.toString() === currentUser._id.toString();

          return `
          <div class="message-bubble ${isSentByMe ? 'sent' : 'received'}">
            ${escapeHTML(m.text)}
            <div style="font-size:0.7rem; opacity:0.75; text-align:right; margin-top:0.25rem;">
              ${formatTimeAgo(m.createdAt)}
            </div>
          </div>
        `;
        })
        .join('');

      // Scroll chat body to bottom
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  } catch (error) {
    if (!isPolling && chatBody) {
      chatBody.innerHTML = `
        <div class="empty-state" style="background:transparent; border:none; margin:auto;">
          <h4 class="empty-title" style="color:var(--accent-red);">Cannot chat</h4>
          <p class="empty-subtitle">${error.message}</p>
        </div>
      `;
      if (inputForm) inputForm.style.display = 'none';
    }
  }
}

// Send Message Handler
async function handleSendMessage(e) {
  e.preventDefault();

  if (!activeRecipientId) {
    showToast('Please select a conversation first.', 'error');
    return;
  }

  const input = document.getElementById('chat-text-input');
  if (!input) return;
  const text = input.value.trim();

  if (!text) return;

  try {
    await fetchWithAuth(`/api/messages/${activeRecipientId}`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    const currentUser = getStoredUser();
    if (socket && currentUser) {
      socket.emit('send_direct_message', {
        recipientId: activeRecipientId,
        senderId: currentUser._id,
        text
      });
    }

    input.value = '';
    await loadMessageHistory(activeRecipientId);
    loadConversationsList();
  } catch (error) {
    showToast('Failed to send message: ' + error.message, 'error');
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
