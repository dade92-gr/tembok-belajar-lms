// assets/js/core/ui.js

// ============================================
// TOAST
// ============================================
export function showToast(msg, type = 'success') {
  let el = document.getElementById('tb-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tb-toast';
    el.style.cssText = `
      position: fixed; bottom: 24px; right: 24px;
      background: #0f172a; color: white;
      padding: 1rem 1.4rem; border-radius: 10px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
      font-size: 0.85rem; font-weight: 500;
      display: flex; align-items: center; gap: 10px;
      opacity: 0; transform: translateY(20px);
      transition: all 0.3s ease;
      z-index: 99999; max-width: 400px;
      font-family: 'Inter', -apple-system, sans-serif;
      line-height: 1.5; pointer-events: none;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.background = type === 'error' ? '#ef4444' : type === 'warn' ? '#f59e0b' : '#10b981';
  el.style.opacity = '1';
  el.style.transform = 'translateY(0)';
  clearTimeout(window._tbToastTimer);
  window._tbToastTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
  }, 3500);
}

// ============================================
// MODAL (generic)
// ============================================
export const Modal = {
  open({ title, body, onSave, saveText = 'Simpan', cancelText = 'Batal', maxWidth = '560px', onClose = null }) {
    this.close();

    const overlay = document.createElement('div');
    overlay.id = 'tb-modal';
    overlay.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(15,23,42,0.6);
      display: flex; align-items: center; justify-content: center;
      z-index: 9999; padding: 1rem; overflow-y: auto;
      backdrop-filter: blur(2px);
      font-family: 'Inter', -apple-system, sans-serif;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background: #ffffff; border-radius: 16px;
      padding: 1.8rem; width: 100%; max-width: ${maxWidth};
      box-shadow: 0 20px 60px rgba(0,0,0,0.25);
      animation: tbFadeIn 0.2s ease;
      margin: auto; max-height: 90vh; overflow-y: auto;
    `;

    const styleTag = document.createElement('style');
    styleTag.textContent = `
      @keyframes tbFadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
      #tb-modal .tb-form-label {
        display:block; font-size:0.75rem; font-weight:700;
        margin-bottom:0.45rem; color:#334155;
        text-transform:uppercase; letter-spacing:0.3px;
      }
      #tb-modal .tb-form-label .req { color:#ef4444; }
      #tb-modal .tb-input, #tb-modal .tb-select, #tb-modal .tb-textarea {
        width:100%; padding:0.65rem 0.9rem;
        border:1px solid #e2e8f0; border-radius:8px;
        font-size:0.88rem; font-family:inherit;
        background:#fff; color:#0f172a;
        outline:none; transition:all 0.2s ease;
        margin-bottom:0.9rem; box-sizing:border-box;
      }
      #tb-modal .tb-input:focus, #tb-modal .tb-select:focus, #tb-modal .tb-textarea:focus {
        border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,0.15);
      }
      #tb-modal .tb-textarea { resize:vertical; min-height:80px; line-height:1.5; }
      #tb-modal .tb-select {
        appearance:none;
        background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
        background-repeat:no-repeat; background-position:right 14px center;
        padding-right:35px; cursor:pointer;
      }
      #tb-modal .tb-modal-title {
        font-size:1.2rem; color:#1e293b; margin-bottom:1rem;
        font-weight:800; display:flex; align-items:center; gap:8px;
      }
      #tb-modal .tb-modal-actions {
        display:flex; justify-content:flex-end; gap:0.6rem;
        margin-top:1.2rem; flex-wrap:wrap;
      }
      #tb-modal .tb-btn {
        padding:0.6rem 1.1rem; border-radius:8px; cursor:pointer;
        font-size:0.85rem; font-weight:600; font-family:inherit;
        transition:all 0.2s ease; display:inline-flex;
        align-items:center; gap:6px; white-space:nowrap; border:none;
      }
      #tb-modal .tb-btn-primary { background:#3b82f6; color:white; }
      #tb-modal .tb-btn-primary:hover:not(:disabled) { background:#2563eb; }
      #tb-modal .tb-btn-primary:disabled { opacity:0.6; cursor:not-allowed; }
      #tb-modal .tb-btn-secondary { background:#64748b; color:white; }
      #tb-modal .tb-btn-secondary:hover { background:#475569; }
      #tb-modal .tb-btn-danger { background:#ef4444; color:white; }
      #tb-modal .tb-btn-danger:hover { background:#dc2626; }
      #tb-modal .tb-alert {
        margin-top:0.8rem; padding:0.7rem 1rem;
        border-radius:8px; font-size:0.82rem; line-height:1.5;
      }
      #tb-modal .tb-alert-error { background:#fee2e2; color:#b91c1c; border:1px solid #fecaca; }
      #tb-modal .tb-alert-info { background:#dbeafe; color:#1e40af; border:1px solid #bfdbfe; }
    `;
    document.head.appendChild(styleTag);

    card.innerHTML = `
      <div class="tb-modal-title">${title || ''}</div>
      <div class="tb-modal-body">${body || ''}</div>
      <div class="tb-modal-actions">
        <button class="tb-btn tb-btn-secondary" id="tb-modal-cancel">${cancelText}</button>
        ${onSave ? `<button class="tb-btn tb-btn-primary" id="tb-modal-save">${saveText}</button>` : ''}
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.remove();
      styleTag.remove();
      if (typeof onClose === 'function') onClose();
    };

    document.getElementById('tb-modal-cancel').onclick = closeModal;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });

    if (onSave) {
      const saveBtn = document.getElementById('tb-modal-save');
      saveBtn.onclick = async () => {
        saveBtn.disabled = true;
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
        try {
          const result = await onSave({ card, close: closeModal });
          if (result !== false) closeModal();
        } catch (err) {
          console.error('[Modal] save error:', err);
        } finally {
          saveBtn.disabled = false;
          saveBtn.innerHTML = originalText;
        }
      };
    }

    setTimeout(() => {
      const firstInput = card.querySelector('input, select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);

    return { close: closeModal, card };
  },

  close() {
    const existing = document.getElementById('tb-modal');
    if (existing) existing.remove();
  },

  showError(msg) {
    const card = document.querySelector('#tb-modal .tb-modal-body');
    if (!card) return;
    let box = card.querySelector('.tb-alert-error');
    if (!box) {
      box = document.createElement('div');
      box.className = 'tb-alert tb-alert-error';
      card.appendChild(box);
    }
    box.textContent = msg;
    box.style.display = 'block';
  },

  hideError() {
    const box = document.querySelector('#tb-modal .tb-alert-error');
    if (box) box.style.display = 'none';
  }
};

// ============================================
// CONFIRM DIALOG
// ============================================
export function confirmDialog(message, onYes, opts = {}) {
  const { title = 'Konfirmasi', yesText = 'Ya', noText = 'Batal', danger = false } = opts;
  return Modal.open({
    title: `<i class="fas fa-question-circle" style="color:#3b82f6;"></i> ${title}`,
    body: `<p style="color:#334155; font-size:0.88rem; line-height:1.6; margin-bottom:0.5rem;">${message}</p>`,
    saveText: `<i class="fas fa-${danger ? 'trash' : 'check'}"></i> ${yesText}`,
    cancelText: noText,
    onSave: async ({ close }) => {
      await onYes();
      close();
    }
  });
}

// ============================================
// URL VALIDATOR (tolak file upload, hanya URL)
// ============================================
export function validateUrl(input, opts = {}) {
  const {
    allowedHosts = null,
    requireImage = false,
    requireVideo = false,
    requirePdf = false,
    allowEmpty = false
  } = opts;

  const val = String(input || '').trim();

  if (!val) {
    if (allowEmpty) return { ok: true, url: '' };
    return { ok: false, error: 'URL wajib diisi.' };
  }

  if (val.startsWith('data:') || val.startsWith('blob:')) {
    return { ok: false, error: 'File upload langsung ditolak. Lampirkan URL file (Google Drive, YouTube, dll).' };
  }

  let url;
  try {
    url = new URL(val);
  } catch {
    return { ok: false, error: 'URL tidak valid.' };
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return { ok: false, error: 'Hanya URL http/https yang diizinkan.' };
  }

  if (Array.isArray(allowedHosts) && allowedHosts.length > 0) {
    const host = url.hostname.toLowerCase();
    const allowed = allowedHosts.some(h => host === h || host.endsWith('.' + h));
    if (!allowed) {
      return { ok: false, error: `Domain harus salah satu: ${allowedHosts.join(', ')}` };
    }
  }

  if (requireImage) {
    const ext = (url.pathname.split('.').pop() || '').toLowerCase();
    const imgExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'];
    const isDriveImg = /drive\.google\.com\/.*(id=|\/d\/)/.test(val);
    if (!imgExts.includes(ext) && !isDriveImg) {
      return { ok: false, error: 'URL gambar harus berakhiran .jpg/.png/.webp/.gif/.svg atau Google Drive.' };
    }
  }

  if (requireVideo) {
    const videoHosts = ['youtube.com', 'youtu.be', 'vimeo.com', 'drive.google.com'];
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (!videoHosts.includes(host)) {
      return { ok: false, error: 'URL video harus dari YouTube, Vimeo, atau Google Drive.' };
    }
  }

  if (requirePdf) {
    const ext = (url.pathname.split('.').pop() || '').toLowerCase();
    const isDrivePdf = /drive\.google\.com\/.*(id=|\/d\/)/.test(val);
    if (ext !== 'pdf' && !isDrivePdf) {
      return { ok: false, error: 'URL harus berakhiran .pdf atau Google Drive.' };
    }
  }

  return { ok: true, url: val };
}

// ============================================
// UTILS
// ============================================
export function escapeHtml(t) {
  if (t === null || t === undefined) return '';
  const d = document.createElement('div');
  d.textContent = String(t);
  return d.innerHTML;
}

export function formatDate(iso, opts = {}) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const now = new Date();
    const diff = (now - d) / 1000;
    if (!opts.full && diff < 60) return 'Baru saja';
    if (!opts.full && diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
    if (!opts.full && diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
    if (!opts.full && diff < 604800) return Math.floor(diff / 86400) + ' hari lalu';
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

export function formatTanggalIndo(tgl) {
  if (!tgl) return '-';
  try {
    const d = new Date(tgl + 'T00:00:00');
    if (isNaN(d.getTime())) return tgl;
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return tgl; }
}

export function debounce(fn, wait = 300) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}