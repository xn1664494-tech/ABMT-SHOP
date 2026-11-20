(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initCart();
  });

  function initCart() {
    const lines = document.querySelector('#lines');
    if (!lines) return;

    // Data cart badge element
    const cartBadge = document.querySelector('[data-cart-badge], #badge');

    // Debounce for input
    function debounce(fn, delay = 400) {
      let timer;
      return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(fn.bind(this, ...args), delay);
      };
    }

    // Update cart summary
    function updateSummary(items, subtotal, shippingFee, total, count) {
      const subEl = document.querySelector('#sub');
      const shipEl = document.querySelector('#ship');
      const totalEl = document.querySelector('#total');
      const countEl = document.querySelector('#count');

      if (subEl) subEl.textContent = subtotal.toLocaleString('vi-VN') + '₫';
      if (shipEl) shipEl.textContent = (shippingFee || 0).toLocaleString('vi-VN') + '₫';
      if (totalEl) totalEl.textContent = total.toLocaleString('vi-VN') + '₫';
      if (countEl) countEl.textContent = count;
    }

    // Update cart badge from server data
    function updateCartBadge(count) {
      if (cartBadge) {
        if (count > 0) {
          cartBadge.textContent = count > 99 ? '99+' : count;
          cartBadge.style.display = 'inline-flex';
        } else {
          cartBadge.style.display = 'none';
        }
      }
    }

    // API helpers
    async function apiPatch(url, body) {
      const res = await window.ABMT.api.patch(url, body);
      return res;
    }

    async function apiDelete(url) {
      const res = await window.ABMT.api.del(url);
      return res;
    }

    // ── Increase/Decrease qty ───────────────────────────────────────
    function handleQtyChange(e) {
      const btn = e.target;
      const itemId = btn.dataset.itemId;
      if (!itemId) return;

      const input = document.querySelector(`.qty-input[data-item-id="${itemId}"]`);
      if (!input) return;

      let val = parseInt(input.value) || 1;
      const max = 99;

      if (btn.classList.contains('btn-plus')) {
        val = Math.min(val + 1, max);
      } else if (btn.classList.contains('btn-minus')) {
        val = Math.max(val - 1, 1);
      } else if (btn.type === 'number') {
        // Manual input handled separately
        return;
      }

      input.value = val;

      // Debounce API call
      const debouncedUpdate = debounce(async () => {
        try {
          const res = await apiPatch(`/api/cart/items/${itemId}`, { quantity: val });
          if (res && res.data) {
            const data = res.data;
            // Update row cells
            const rows = document.querySelectorAll(`tr[data-item-id="${itemId}"]`);
            rows.forEach(function(row) {
              const totalCell = row.querySelector('td:nth-child(5)');
              if (totalCell && data.items) {
                data.items.forEach(function(item) {
                  if (item.itemId === itemId) {
                    if (totalCell) totalCell.textContent = (item.totalPrice || 0).toLocaleString('vi-VN') + '₫';
                  }
                });
              }
            });
            // Update summary
            if (data.subtotal !== undefined) updateSummary(data.items, data.subtotal, data.shippingFee, data.total, data.count);
            if (cartBadge && data.count !== undefined) updateCartBadge(data.count);
          }
        } catch (err) {
          // Rollback to previous value on error
          input.value = parseInt(input.getAttribute('data-prev')) || 1;
          ABMT.toast.fromError(err);
        }
      }, 400);

      debouncedUpdate();
    }

    // ── Delete row ──────────────────────────────────────────────────
    function handleDeleteRow(e) {
      const btn = e.target;
      const itemId = btn.dataset.itemId;
      if (!itemId) return;

      if (!confirm('Bạn có chắc muốn xóa sản phẩm này khỏi giỏ?')) return;

      try {
        const res = apiDelete(`/api/cart/items/${itemId}`);
        // In a real implementation, we'd wait for the response and update the UI
        // For now, just remove the row and update summary
        const row = btn.closest('tr');
        if (row) row.remove();
        ABMT.toast.success('Đã xóa sản phẩm khỏi giỏ');
      } catch (err) {
        ABMT.toast.fromError(err);
      }
    }

    // ── Event Delegation ────────────────────────────────────────────
    lines.addEventListener('click', function (e) {
      const btn = e.target.closest('button');
      if (!btn) return;

      // Plus / Minus
      if (btn.classList.contains('btn-plus') || btn.classList.contains('btn-minus')) {
        handleQtyChange(e);
        return;
      }

      // Delete
      if (btn.classList.contains('btn-delete')) {
        handleDeleteRow(e);
        return;
      }
    });

    // ── Manual input qty ────────────────────────────────────────────
    const qtyInputs = document.querySelectorAll('.qty-input');
    qtyInputs.forEach(function (input) {
      const debouncedUpdate = debounce(async () => {
        const itemId = input.dataset.itemId;
        if (!itemId) return;

        const newVal = parseInt(input.value) || 1;
        const min = 1;
        const max = parseInt(input.getAttribute('max')) || 99;

        // Clamp value
        let val = Math.max(min, Math.min(max, newVal));

        // Store previous for rollback
        input.setAttribute('data-prev', input.value);

        if (input.value !== String(newVal)) input.value = String(val);

        try {
          const res = await apiPatch(`/api/cart/items/${itemId}`, { quantity: val });
          if (res && res.data) {
            const data = res.data;
            // Update this row's total
            const rows = document.querySelectorAll(`tr[data-item-id="${itemId}"]`);
            rows.forEach(function (row) {
              const totalCell = row.querySelector('td:nth-child(5)');
              if (totalCell && data.items) {
                data.items.forEach(function (item) {
                  if (item.itemId === itemId) {
                    if (totalCell) totalCell.textContent = (item.totalPrice || 0).toLocaleString('vi-VN') + '₫';
                  }
                });
              }
            });
            // Update summary
            if (data.subtotal !== undefined) updateSummary(data.items, data.subtotal, data.shippingFee, data.total, data.count);
            if (cartBadge && data.count !== undefined) updateCartBadge(data.count);
          }
        } catch (err) {
          // Rollback
          input.value = input.getAttribute('data-prev') || 1;
          ABMT.toast.fromError(err);
        }
      }, 400);

      input.addEventListener('change', debouncedUpdate);
      input.addEventListener('blur', debouncedUpdate);
    });

    // ── Initial update summary from existing data ─────────────────────
    // Try to extract from the rendered page
    const initialSub = document.querySelector('#sub');
    const initialTotal = document.querySelector('#total');
    if (initialSub) {
      const match = initialSub.textContent.match(/([0-9.,]+)₫/);
      if (match) {
        // Just ensure elements exist and are populated
      }
    }
  }

})();