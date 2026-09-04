// Post Creation Handler for Mitra (MinIO Image Upload)

document.addEventListener('DOMContentLoaded', () => {
  renderNavbar('create-post');
  requireAuth();

  setupCreatePostForm();
});

function setupCreatePostForm() {
  const form = document.getElementById('create-post-form');
  const contentInput = document.getElementById('post-content-input');
  const imageFileInput = document.getElementById('post-image-file');
  const imageUrlInput = document.getElementById('post-image-url');
  const imagePreviewContainer = document.getElementById('image-preview-container');
  const imagePreview = document.getElementById('image-preview');
  const charCounter = document.getElementById('char-counter');
  const submitBtn = document.getElementById('submit-post-btn');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');

  if (!form) return;

  // Real-time character counter
  contentInput.addEventListener('input', () => {
    const len = contentInput.value.length;
    charCounter.textContent = `${len}/2000`;
    if (len > 1800) {
      charCounter.style.color = 'var(--accent-red)';
    } else {
      charCounter.style.color = 'var(--text-muted)';
    }
  });

  // Local File Live Preview
  if (imageFileInput) {
    imageFileInput.addEventListener('change', () => {
      const file = imageFileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          imagePreview.src = e.target.result;
          imagePreviewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        imagePreviewContainer.style.display = 'none';
      }
    });
  }

  // URL Live Preview
  if (imageUrlInput) {
    imageUrlInput.addEventListener('input', () => {
      const url = imageUrlInput.value.trim();
      if (url && (!imageFileInput || !imageFileInput.files[0])) {
        imagePreview.src = url;
        imagePreviewContainer.style.display = 'block';
      }
    });
  }

  // Submit Handler using FormData for MinIO upload
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const content = contentInput.value.trim();
    if (!content) {
      showToast('Please enter post content.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('content', content);

    if (imageFileInput && imageFileInput.files && imageFileInput.files.length > 0) {
      for (let i = 0; i < Math.min(imageFileInput.files.length, 4); i++) {
        formData.append('images', imageFileInput.files[i]);
      }
    } else if (imageUrlInput && imageUrlInput.value.trim()) {
      formData.append('image', imageUrlInput.value.trim());
    }

    btnText.style.display = 'none';
    btnSpinner.style.display = 'block';
    submitBtn.disabled = true;

    try {
      const data = await fetchWithAuth('/api/posts', {
        method: 'POST',
        body: formData
      });

      showToast('Post published on Mitra!', 'success');

      setTimeout(() => {
        window.location.href = 'index.html';
      }, 500);
    } catch (error) {
      showToast('Failed to publish post: ' + error.message, 'error');
    } finally {
      btnText.style.display = 'block';
      btnSpinner.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
}
