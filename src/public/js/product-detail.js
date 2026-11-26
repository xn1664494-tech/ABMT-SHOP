(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(initProductDetail);

  function initProductDetail() {
    const variantsScript = document.querySelector('script[type="application/json"]#variants-data');
    let variants = [];
    if (variantsScript) {
      try { variants = JSON.parse(variantsScript.textContent || '[]'); } catch (_) { variants = []; }
    }
    if (!Array.isArray(variants)) variants = [];

    const colorContainer = document.querySelector('#colors');
    const sizeContainer = document.querySelector('#sizes');
    const priceEl = document.querySelector('#price');
    const skuEl = document.querySelector('#sku');
    const statusEl = document.querySelector('#status');
    const qtyInput = document.querySelector('#qty');
    const qtyMinus = document.querySelector('#minus');
    const qtyPlus = document.querySelector('#plus');
    const addToCartBtn = document.querySelector('#add, #add-to-cart');
    const mainImg = document.querySelector('.pdp-main img');
    const thumbs = document.querySelectorAll('.pdp-thumb');

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', (e) => {
        const href = thumb.getAttribute('href');
        if (!mainImg || !href) return;
        e.preventDefault();
        mainImg.src = href;
        thumbs.forEach((t) => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
      });
    });

    const state = { color: null, size: null };
    const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';

    function currentVariant() {
      return variants.find((v) => v.color === state.color && v.size === state.size) || null;
    }

    function setQtyDisabled(disabled, max) {
      if (qtyInput) {
        qtyInput.disabled = !!disabled;
        qtyInput.min = '1';
        qtyInput.max = String(Math.max(1, Number(max) || 1));
        let val = parseInt(qtyInput.value || '1', 10);
        if (!Number.isFinite(val) || val < 1) val = 1;
        if (val > Number(qtyInput.max)) val = Number(qtyInput.max);
        qtyInput.value = String(val);
      }
      if (qtyMinus) qtyMinus.disabled = !!disabled;
      if (qtyPlus) qtyPlus.disabled = !!disabled || (qtyInput && parseInt(qtyInput.value, 10) >= parseInt(qtyInput.max, 10));
    }

    function renderInfo() {
      const variant = currentVariant();
      if (variant) {
        if (priceEl) priceEl.textContent = fmt(variant.price);
        if (skuEl) skuEl.textContent = variant.sku || '—';
        const inStock = Number(variant.stock) > 0;
        if (statusEl) statusEl.textContent = inStock ? 'Còn hàng' : 'Hết hàng';
        setQtyDisabled(!inStock, inStock ? variant.stock : 1);
        if (addToCartBtn) addToCartBtn.disabled = !inStock;
      } else {
        if (priceEl) {
          const base = addToCartBtn ? Number(addToCartBtn.dataset.basePrice || 0) : 0;
          if (base > 0) priceEl.textContent = fmt(base);
        }
        if (skuEl) skuEl.textContent = '—';
        if (statusEl) statusEl.textContent = state.color && state.size ? 'Biến thể không tồn tại' : 'Chọn màu và kích cỡ';
        setQtyDisabled(true, 1);
        if (addToCartBtn) addToCartBtn.disabled = Number(addToCartBtn.dataset.totalStock || 0) <= 0 ? true : false;
      }
    }

    function updateSizesForColor() {
      if (!sizeContainer) return;
      const sizeBtns = sizeContainer.querySelectorAll('.btn-size');
      sizeBtns.forEach((btn) => {
        const size = btn.dataset.size;
        const variant = variants.find((v) => v.color === state.color && v.size === size);
        const available = !!state.color && !!variant && Number(variant.stock) > 0;
        btn.disabled = !available;
        btn.setAttribute('aria-disabled', available ? 'false' : 'true');
        btn.classList.toggle('is-out-of-stock', !available);
        if (!available && state.size === size) {
          state.size = null;
          btn.classList.remove('selected');
        }
      });
    }

    if (colorContainer) {
      const colors = [...new Set(variants.map((v) => v.color).filter(Boolean))];
      colorContainer.innerHTML = '';
      colors.forEach((color) => {
        const sample = variants.find((v) => v.color === color);
        const swatch = (sample && sample.colorCode) ? sample.colorCode : '#d1d5db';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-soft btn-color pill';
        btn.dataset.color = color;
        btn.setAttribute('aria-label', 'Màu ' + color);
        btn.innerHTML = '<span class="color-name"></span><span class="color-circle"></span>';
        btn.querySelector('.color-name').textContent = color;
        btn.querySelector('.color-circle').style.background = swatch;
        btn.addEventListener('click', () => {
          if (state.color === color) {
            state.color = null;
            btn.classList.remove('selected');
          } else {
            state.color = color;
            colorContainer.querySelectorAll('.btn-color').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
          }
          updateSizesForColor();
          renderInfo();
        });
        colorContainer.appendChild(btn);
      });
    }

    if (sizeContainer) {
      sizeContainer.querySelectorAll('.btn-size').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
          const size = btn.dataset.size;
          if (state.size === size) {
            state.size = null;
            btn.classList.remove('selected');
          } else {
            state.size = size;
            sizeContainer.querySelectorAll('.btn-size').forEach((b) => b.classList.remove('selected'));
            btn.classList.add('selected');
          }
          renderInfo();
        });
      });
    }

    if (qtyMinus && qtyInput) {
      qtyMinus.addEventListener('click', () => {
        if (qtyInput.disabled) return;
        let v = parseInt(qtyInput.value || '1', 10) - 1;
        if (v < 1) v = 1;
        qtyInput.value = String(v);
        if (qtyPlus) qtyPlus.disabled = parseInt(qtyInput.value, 10) >= parseInt(qtyInput.max || '1', 10);
      });
    }
    if (qtyPlus && qtyInput) {
      qtyPlus.addEventListener('click', () => {
        if (qtyInput.disabled) return;
        let v = parseInt(qtyInput.value || '1', 10) + 1;
        const max = parseInt(qtyInput.max || '1', 10);
        if (v > max) v = max;
        qtyInput.value = String(v);
        qtyPlus.disabled = v >= max;
      });
    }

    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', () => {
        const variant = currentVariant();
        if (!state.color) return ABMT.toast.error('Vui lòng chọn màu');
        if (!state.size) return ABMT.toast.error('Vui lòng chọn kích cỡ');
        if (!variant || Number(variant.stock) <= 0) return ABMT.toast.error('Biến thể này đã hết hàng');

        const quantity = qtyInput ? parseInt(qtyInput.value || '1', 10) : 1;
        const payload = {
          product: addToCartBtn.dataset.productId,
          size: state.size,
          color: state.color,
          qty: quantity,
        };

        ABMT.withButtonLock(addToCartBtn, () => window.ABMT.api.post('/api/cart/items', payload))
          .then((response) => {
            const count = response && response.data ? response.data.count : undefined;
            if (count !== undefined) {
              const link = document.querySelector('.header-cart');
              let badge = link ? link.querySelector('.header-cart-badge') : null;

              if (count > 0 && !badge && link) {
                badge = document.createElement('span');
                badge.className = 'header-cart-badge';
                badge.setAttribute('aria-hidden', 'true');
                link.appendChild(badge);
              }

              if (count > 0 && badge) {
                badge.textContent = count > 99 ? '99+' : String(count);
              } else if (count <= 0 && badge) {
                badge.parentNode.removeChild(badge);
              }
            }
            ABMT.toast.success('Thêm vào giỏ thành công');
          })
          .catch((error) => ABMT.toast.fromError(error));
      });
    }

    updateSizesForColor();
    renderInfo();
  }
})();
