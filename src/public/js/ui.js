(function () {
  'use strict';

  // Toast container
  let toastRegion = null;
  let activeToasts = [];

  /** Show toast */
  function showToast(message, options = {}) {
    const {
      type = 'info',
      duration = type === 'error' ? 6000 : 4000
    } = options;

    // Create toast element — all sizing/colors come from app.css
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const icons = {
      success: '<path d="M20 6L9 17l-5-5"/>',
      error: '<path d="M12 8v5"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="9"/>',
      info: '<path d="M12 16v-5"/><path d="M12 8h.01"/><circle cx="12" cy="12" r="9"/>'
    };
    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (icons[type] || icons.info) + '</svg>';
    toast.appendChild(icon);

    const toastText = document.createElement('span');
    toastText.className = 'toast-text';
    toastText.textContent = message;
    toast.appendChild(toastText);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Đóng thông báo');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function () { dismissToast(); });
    toast.appendChild(closeBtn);

    if (!toastRegion) {
      toastRegion = document.createElement('div');
      toastRegion.id = 'toast-region';
      toastRegion.setAttribute('role', 'region');
      toastRegion.setAttribute('aria-label', 'Thông báo');
      document.body.appendChild(toastRegion);
    }
    toastRegion.appendChild(toast);
    toastRegion.style.display = 'flex';

    // Auto-dismiss
    let timer = setTimeout(dismissToast, duration);
    let paused = false;
    let mouseOver = false;

    function dismissToast(skipAnimation = false) {
      clearTimeout(timer);
      const index = activeToasts.indexOf(toast);
      if (index > -1) activeToasts.splice(index, 1);
      if (toastRegion && toastRegion.contains(toast)) {
        if (skipAnimation || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          toastRegion.removeChild(toast);
        } else {
          toast.classList.add('is-leaving');
          toast.addEventListener('transitionend', () => {
            toastRegion.removeChild(toast);
          }, { once: true });
        }
      }
      // Remove if last toast, hide region
      if (activeToasts.length === 0 && toastRegion) {
        toastRegion.style.display = 'none';
      }
    }

    // Pause on mouse over / focus
    toast.addEventListener('mouseenter', () => {
      mouseOver = true;
      clearTimeout(timer);
    });
    toast.addEventListener('mouseleave', () => {
      mouseOver = false;
      if (!paused) startAuto();
    });
    toast.addEventListener('focus', () => {
      mouseOver = true;
      clearTimeout(timer);
    });
    toast.addEventListener('blur', () => {
      mouseOver = false;
      if (!paused) startAuto();
    });

    function startAuto() {
      if (paused || mouseOver) return;
      timer = setTimeout(dismissToast, duration);
    }

    // Keep track
    activeToasts.push(toast);
    if (activeToasts.length > 3) {
      // Remove oldest
      const old = activeToasts.shift();
      dismissToast(true);
    }

    return dismissToast;
  }

  /** Show toast function (also exposed as ABMT.toast) */
  const showToastFunc = function (message, options = {}) {
    showToast(message, options);
  };

  /** Shortcuts */
  const toast = function (message, type) {
    // Support ABMT.toast(msg, type) and ABMT.toast(msg)
    if (typeof type !== 'undefined') {
      showToastFunc(message, { type, duration: type.duration });
    } else {
      showToastFunc(message);
    }
  };
  toast.success = function (message, duration) { showToastFunc(message, { type: 'success', duration }); };
  toast.error = function (message, duration) { showToastFunc(message, { type: 'error', duration }); };
  toast.info = function (message, duration) { showToastFunc(message, { type: 'info', duration }); };
  toast.fromError = function (error) {
    const msg = error && error.message ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.';
    showToastFunc(msg, { type: 'error' });
  };

  /** Set loading state on button + prevent double-click */
  const setButtonLoading = function (button, isLoading) {
    loading.set(button, isLoading);
  };

  /** Wrap a button for async action, prevent double-click with locking */
  const withButtonLock = function (button, asyncFn) {
    if (!button || button.loadingStatus) return undefined;
    setButtonLoading(button, true);
    let result;
    try {
      result = asyncFn();
    } catch (error) {
      setButtonLoading(button, false);
      throw error;
    }
    if (result && typeof result.then === 'function') {
      return result.finally(function () {
        setButtonLoading(button, false);
      });
    }
    setButtonLoading(button, false);
    return result;
  };

  /** Loading of buttons */
  const loading = {
    // Set loading state on a button
    set(button, isLoading) {
      if (button.loadingStatus === isLoading) return; // already correct state

      const originalDisabled = button.disabled;
      button.loadingStatus = isLoading;

      if (isLoading) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.classList.add('is-loading');
        // Save original disabled state to restore later
        if (originalDisabled === false) {
          button._abmtOriginalDisabled = false;
        }
      } else {
        button.disabled = originalDisabled !== false; // restore
        button.removeAttribute('aria-busy');
        button.classList.remove('is-loading');
        delete button._abmtOriginalDisabled;
      }
    },

    // Wrap a button for async action, prevent double-click
    async wrap(button, asyncFn) {
      // If already loading, skip
      if (button.loadingStatus) {
        return undefined;
      }
      this.set(button, true);
      try {
        const result = await asyncFn();
        return result;
      } catch (error) {
        throw error;
      } finally {
        this.set(button, false);
      }
    }
  };

  /** Fallback cho ảnh sản phẩm lỗi (không dùng inline onerror) */
  function applyImageFallback(img) {
    if (!img || img.dataset.fallbackApplied === '1') return;
    const fallback = img.getAttribute('data-fallback');
    if (!fallback) return;
    img.dataset.fallbackApplied = '1';
    img.src = fallback;
  }

  function scanFailedImages() {
    const images = document.querySelectorAll('img[data-fallback]');
    images.forEach(function (img) {
      if (img.complete && img.naturalWidth === 0) {
        applyImageFallback(img);
      }
    });
  }

  // Sự kiện error không bubble nên bắt ở pha capture trên document.
  document.addEventListener('error', function (event) {
    const target = event.target;
    if (target && target.tagName === 'IMG' && target.hasAttribute('data-fallback')) {
      applyImageFallback(target);
    }
  }, true);

  /** Initialize on DOM ready */
  function init() {
    scanFailedImages();

    // Process flash elements
    const flashElements = document.querySelectorAll('[data-flash]');
    flashElements.forEach(el => {
      const type = el.getAttribute('data-type') || 'info';
      let message = el.getAttribute('data-message');
      if (!message) {
        message = el.textContent || '';
      }
      // Hide the flash element
      el.hidden = true;
      // Show as toast
      toast.show(message, { type });
    });
  }

  // DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose only window.ABMT
  if (window.ABMT === undefined) {
    window.ABMT = {};
  }
  window.ABMT.toast = toast;
  window.ABMT.toast.show = showToastFunc;
  window.ABMT.setButtonLoading = setButtonLoading;
  window.ABMT.withButtonLock = withButtonLock;
  window.ABMT.loading = loading;

})();