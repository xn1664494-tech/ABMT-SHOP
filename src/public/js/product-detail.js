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
    initProductDetail();
  });

  /**
   * Product Detail initialization
   * Exits early if no variant data available
   */
  function initProductDetail() {
    // ── Read variant data from server ───────────────────────────────
    let variants = null;
    const variantsScript = document.querySelector('script[type="application/json"]#variants-data');
    const variantsAttr = document.querySelector('[data-variants]');

    if (variantsScript) {
      try {
        variants = JSON.parse(variantsScript.textContent);
      } catch (e) {
        variants = null;
      }
    }
    if (!variants && variantsAttr) {
      try {
        variants = JSON.parse(variantsAttr.getAttribute('data-variants'));
      } catch (e) {
        variants = null;
      }
    }

    if (!variants) return;

    // ── DOM elements ────────────────────────────────────────────────
    const colorContainer = document.querySelector('#colors');
    const sizeContainer = document.querySelector('#sizes');
    const priceEl = document.querySelector('#price');
    const skuEl = document.querySelector('#sku');
    const statusEl = document.querySelector('#status');
    const qtyInput = document.querySelector('#qty');
    const qtyMinus = document.querySelector('#minus');
    const qtyPlus = document.querySelector('#plus');
    const addToCartBtn = document.querySelector('#add-to-cart, #add');

    // ── Render color buttons ────────────────────────────────────────
    if (colorContainer) {
      // Build unique color list from variants
      const colors = [...new Set(variants.map(v => v.color))];
      colors.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-soft btn-color pill';
        btn.dataset.color = color;
        btn.innerHTML = `<span class="color-name">${color}</span><span class="color-circle" style="background: ${color}"></span>`;
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', `Màu ${color}`);
        colorContainer.appendChild(btn);
      });

      const colorBtns = colorContainer.querySelectorAll('.btn-color');
      let selectedColor = null;

      colorBtns.forEach(btn => {
        btn.addEventListener('click', function () {
          // Deselect if clicked again
          if (selectedColor === this.dataset.color) {
            selectedColor = null;
            this.classList.remove('selected');
            sizeContainer.querySelectorAll('.btn-size').forEach(s => s.setAttribute('aria-disabled', 'true').disabled = true);
            if (priceEl) priceEl.textContent = '';
            if (skuEl) skuEl.textContent = '';
            if (statusEl) statusEl.textContent = '';
            if (qtyInput) { qtyInput.value = 1; qtyInput.disabled = true; }
            return;
          }

          // Select new color
          selectedColor = this.dataset.color;
          colorBtns.forEach(b => b.classList.remove('selected'));
          this.classList.add('selected');

          // Update sizes based on this color
          updateSizesForColor(selectedColor);
        });
      });

      // Initial state: no color selected
      if (colorBtns.length > 0) {
        colorBtns[0].classList.add('selected');
        selectedColor = colorBtns[0].dataset.color;
        updateSizesForColor(selectedColor);
      }
    }

    /** Update sizes based on selected color */
    function updateSizesForColor(color) {
      if (!sizeContainer || !variants) return;

      const colorVariants = variants.filter(v => v.color === color);
      const colorVariantIds = new Set(colorVariants.map(v => v.id));

      sizeContainer.querySelectorAll('.btn-size').forEach(sizeBtn => {
        const sizeId = sizeBtn.dataset.size;
        const hasVariantForSize = [...colorVariants].some(v => v.size === sizeId);
        const hasStock = colorVariants.some(v => v.stock > 0);

        if (hasVariantForSize) {
          if (hasStock) {
            sizeBtn.classList.remove('is-out-of-stock');
            sizeBtn.disabled = false;
            sizeBtn.removeAttribute('aria-disabled');
            sizeBtn.removeAttribute('data-out-of-stock');
          } else {
            sizeBtn.classList.add('is-out-of-stock');
            sizeBtn.disabled = true;
            sizeBtn.setAttribute('aria-disabled', 'true');
            sizeBtn.setAttribute('data-out-of-stock', '');
          }
        } else {
          // Size not available for this color
          sizeBtn.classList.add('is-out-of-stock');
          sizeBtn.disabled = true;
          sizeBtn.setAttribute('aria-disabled', 'true');
          sizeBtn.setAttribute('data-out-of-stock', '');
        }
      });

      // If previously selected size is now out of stock, unselect it
      const selectedSizeEl = sizeContainer.querySelector('.btn-size.selected');
      if (selectedSizeEl) {
        const selectedSizeId = selectedSizeEl.dataset.size;
        const isNowInvalid = !colorVariants.some(v => v.size === selectedSizeId && v.stock > 0);
        if (isNowInvalid) {
          selectedSizeEl.classList.remove('selected');
          selectedSizeEl.disabled = true;
          selectedSizeEl.setAttribute('aria-disabled', 'true');
          if (priceEl) priceEl.textContent = '';
          if (skuEl) skuEl.textContent = '';
          if (qtyInput) { qtyInput.value = 1; qtyInput.disabled = true; }
        }
      }
    }

    // ── Render size buttons ─────────────────────────────────────────
    if (sizeContainer) {
      const sizeBtns = sizeContainer.querySelectorAll('.btn-size');
      let selectedSize = null;

      sizeBtns.forEach(btn => {
        btn.addEventListener('click', function () {
          // If this size is disabled/out-of-stock, don't allow selection
          if (this.disabled || this.getAttribute('aria-disabled') === 'true') return;

          // Deselect if clicked again
          if (selectedSize === this.dataset.size) {
            selectedSize = null;
            this.classList.remove('selected');
            this.setAttribute('aria-disabled', 'true');
            this.disabled = true;
            if (priceEl) priceEl.textContent = '';
            if (skuEl) skuEl.textContent = '';
            if (statusEl) statusEl.textContent = '';
            if (qtyInput) { qtyInput.value = 1; qtyInput.disabled = true; }
            return;
          }

          // If a size was previously selected, remove its selection
          if (selectedSize !== null) {
            const prevBtn = sizeContainer.querySelector(`.btn-size[data-size="${selectedSize}"]`);
            if (prevBtn) {
              prevBtn.classList.remove('selected');
              prevBtn.disabled = true;
              prevBtn.setAttribute('aria-disabled', 'true');
            }
          }

          selectedSize = this.dataset.size;
          this.classList.add('selected');
          this.disabled = false;
          this.removeAttribute('aria-disabled');

          // Update product info
          const variant = variants.find(v => v.color === (colorContainer ? colorContainer.dataset.selectedColor || '' : '') && v.size === selectedSize);
          if (variant) {
            if (priceEl) priceEl.textContent = variant.price_formatted || variant.price;
            if (skuEl) skuEl.textContent = variant.sku || '';
            if (statusEl) statusEl.textContent = variant.stock > 0 ? 'Còn hàng' : 'Hết hàng';

            // Update qty limits
            if (qtyInput) {
              qtyInput.max = variant.stock || 100;
              qtyInput.disabled = false;
              qtyInput.value = 1;
            }
            if (qtyMinus) qtyMinus.disabled = false;
            if (qtyPlus) qtyPlus.disabled = qtyInput && parseInt(qtyInput.value) >= (variant.stock || 100);
          }
        });
      });
    }

    // ── Qty controls ────────────────────────────────────────────────
    if (qtyMinus) {
      qtyMinus.addEventListener('click', function () {
        if (qtyInput && !qtyInput.disabled) {
          let val = parseInt(qtyInput.value) || 1;
          val = Math.max(1, val - 1);
          qtyInput.value = val;
          if (qtyPlus) qtyPlus.disabled = false;
        }
      });
    }
    if (qtyPlus) {
      qtyPlus.addEventListener('click', function () {
        if (qtyInput && !qtyInput.disabled) {
          let max = parseInt(qtyInput.max) || 100;
          let val = parseInt(qtyInput.value) || 1;
          val = Math.min(max, val + 1);
          qtyInput.value = val;
          if (val >= max) this.disabled = true;
          if (qtyMinus) qtyMinus.disabled = false;
        }
      });
    }

    // ── Add to cart ─────────────────────────────────────────────────
    if (addToCartBtn) {
      addToCartBtn.addEventListener('click', function () {
        // Check if color and size selected
        const colorSelected = colorContainer && colorContainer.querySelector('.btn-color.selected');
        const sizeSelected = sizeContainer && sizeContainer.querySelector('.btn-size.selected');

        if (!colorSelected) {
          ABMT.toast.error('Vui lòng chọn màu trước khi thêm vào giỏ');
          return;
        }
        if (!sizeSelected) {
          ABMT.toast.error('Vui lòng chọn size trước khi thêm vào giỏ');
          return;
        }

        // Find the variant
        const color = colorSelected.dataset.color;
        const size = sizeSelected.dataset.size;
        const variant = variants.find(v => v.color === color && v.size === size);

        if (!variant) {
          ABMT.toast.error('Biến thể không tồn tại');
          return;
        }

        const productId = addToCartBtn.dataset.productId;
        const quantity = qtyInput ? parseInt(qtyInput.value) : 1;
        const cartItem = { product: productId, size, color, qty: quantity };

        // Use withButtonLock to prevent double-click
        ABMT.withButtonLock(addToCartBtn, function () {
          return window.ABMT.api.post('/api/cart/items', cartItem);
        })
          .then(function (response) {
            // Success - update cart badge if exists
            if (response && response.data && response.data.count !== undefined) {
              const badge = document.querySelector('.cart-badge, .nav-cart .badge-count, #cart-count, [data-cart-badge], #badge');
              if (badge) {
                badge.textContent = response.data.count > 99 ? '99+' : response.data.count;
                badge.style.display = 'inline-flex';
              }
            }
            ABMT.toast.success('Thêm vào giỏ thành công');
          })
          .catch(function (error) {
            ABMT.toast.fromError(error);
          });
      });
    }
  }

})();