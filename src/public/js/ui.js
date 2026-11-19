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

    // Lazy create container
    if (!toastRegion) {
      toastRegion = document.createElement('div');
      toastRegion.id = 'toast-region';
      toastRegion.setAttribute('role', 'region');
      toastRegion.setAttribute('aria-label', 'Thông báo');
      toastRegion.style.display = 'none';
      document.body.appendChild(toastRegion);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.style.display = 'flex';
    toast.style.alignItems = 'flex-start';
    toast.style.gap = '10px';
    toast.style.padding = '12px 14px';
    toast.style.background = 'var(--surface)';
    toast.style.border = '1px var(--line) solid';
    toast.style.borderRadius = 'var(--r-md)';
    toast.style.boxShadow = 'var(--shadow-toast, 0 8px 24px rgba(42,47,54,.12))';
    toast.style.color = 'var(--ink-strong)';
    toast.style.fontSize = '13px';
    toast.style.lineHeight = '1.45';
    toast.style.transition = 'opacity .2s, transform .2s';
    toast.style.pointerEvents = 'auto';

    // Variant colors
    const theme = {
      success: { borderLeftColor: 'var(--accent-deep)', background: 'var(--mint)' },
      error: { borderLeftColor: 'var(--danger)', background: 'var(--peach)', color: 'var(--danger)' },
      info: { borderLeftColor: 'var(--accent)', background: 'var(--sky)' }
    };

    const t = theme[type] || theme.info;
    toast.style.borderLeft = `4px solid ${t.borderLeftColor}`;
    if (t.background) toast.style.background = t.background;
    if (t.color && type !== 'info') toast.style.color = t.color;

    const toastText = document.createElement('span');
    toastText.className = 'toast-text';
    toastText.style.flex = '1';
    toastText.style.lineHeight = '1.45';
    toastText.textContent = message;
    toast.appendChild(toastText);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Đóng thông báo');
    closeBtn.style.width = '24px';
    closeBtn.style.height = '24px';
    closeBtn.style.border = 'none';
    closeBtn.style.background = 'transparent';
    closeBtn.style.color = 'var(--muted)';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.flexShrink = '0';
    const closeText = document.createTextNode('×');
closeBtn.appendChild(closeText);
    closeBtn.style.transition = 'background .2s';
    closeBtn.addEventListener('mouseover', () => { closeBtn.style.background = 'var(--line)'; });
    closeBtn.addEventListener('mouseout', () => { closeBtn.style.background = 'transparent'; });
    closeBtn.addEventListener('focus', () => { closeBtn.style.outline = '2px solid var(--accent-deep)'; });
    closeBtn.addEventListener('blur', () => { closeBtn.style.outline = 'none'; });
    closeBtn.addEventListener('click', dismissToast);
    toast.appendChild(closeBtn);

    // Add to region
    toastRegion.style.display = 'flex';
    toastRegion.style.flexDirection = 'column';
    toastRegion.style.gap = '8px';
    // Position based on screen size
    if (window.matchMedia('(max-width: 767px)').matches) {
      toastRegion.style.position = 'fixed';
      toastRegion.style.left = '16px';
      toastRegion.style.right = '16px';
      toastRegion.style.bottom = '16px';
      toastRegion.style.zIndex = '100';
      toastRegion.style.width = 'auto';
    } else {
      toastRegion.style.position = 'fixed';
      toastRegion.style.top = '16px';
      toastRegion.style.right = '16px';
      toastRegion.style.bottom = 'auto';
      toastRegion.style.left = 'auto';
      toastRegion.style.width = '360px';
    }
    toastRegion.appendChild(toast);

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

  /** Shortcuts */
  const toast = {
    show,
    success(message, duration) { showToast(message, { type: 'success', duration }); },
    error(message, duration) { showToast(message, { type: 'error', duration }); },
    info(message, duration) { showToast(message, { type: 'info', duration }); },
    fromError(error) {
      const msg = error && error.message ? error.message : 'Đã có lỗi xảy ra, vui lòng thử lại.';
      return showToast(msg, { type: 'error' });
    }
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
    wrap(button, asyncFn) {
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

  /** Initialize on DOM ready */
  function init() {
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
  window.ABMT.loading = loading;

})();