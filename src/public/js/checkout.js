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
    initCheckout();
  });

  function initCheckout() {
    // Elements
    const aList = document.querySelector('#aList');
    const addNewAddr = document.querySelector('#add-new-address');
    const aForm = document.querySelector('#aForm');
    const noteInput = document.querySelector('#note');
    const noteCnt = document.querySelector('#noteCnt');
    const placeOrderBtn = document.querySelector('#checkout-btn');
    const paymentRadios = document.querySelectorAll('input[name="paymentMethod"]');

    // ── Ghi ký tự cho ghi chú ──────────────────────────────────────
    if (noteCnt && noteInput) {
      noteCnt.textContent = '0/' + (noteInput.maxLength || 200);
      noteInput.addEventListener('input', function () {
        const len = this.value.length;
        noteCnt.textContent = len + '/' + (noteInput.maxLength || 200);
      });
    }

    // ── Chọn địa chỉ đã lưu / thêm mới ──────────────────────────────
    if (aList) {
      const savedRadios = aList.querySelectorAll('input[name="address-radio"]');
      const addNewToggle = document.querySelector('#toggle-add-new');
      if (addNewToggle) {
        addNewToggle.addEventListener('click', function () {
          if (addNewAddr.style.display === 'none' || addNewAddr.hidden) {
            addNewAddr.style.display = 'block';
            addNewAddr.hidden = false;
          } else {
            addNewAddr.style.display = 'none';
            addNewAddr.hidden = true;
          }
        });
      }
    }

    // ── Nút đặt hàng ────────────────────────────────────────────────
    if (placeOrderBtn) {
      placeOrderBtn.addEventListener('click', function () {
        // Validate: chọn địa chỉ
        let hasAddress = false;
        if (aList) {
          const checked = aList.querySelector('input[name="address-radio"]:checked');
          if (checked) hasAddress = true;
        }
        if (!hasAddress) {
          // Kiểm tra có đang thêm mới không
          const isAdding = addNewAddr && (addNewAddr.style.display !== 'none' && !addNewAddr.hidden);
          if (!isAdding) {
            ABMT.toast.error('Vui lòng chọn hoặc thêm địa chỉ mới');
            return;
          }
        }

        // Validate form nếu thêm mới
        if (isAdding && aForm) {
          if (!ABMT.address.validate(aForm)) {
            return;
          }
          // Gather form data
          const formData = new FormData(aForm);
          const addrObj = {};
          formData.forEach(function (v, k) { addrObj[k] = v; });
        }

        // Khóa nút và gọi API
        ABMT.withButtonLock(placeOrderBtn, function () {
          // Build order data
          let addressId = '';
          let address = {};
          if (aList) {
            const checked = aList.querySelector('input[name="address-radio"]:checked');
            if (checked) addressId = checked.value;
          }
          if (!addressId && isAdding && aForm) {
            address = { ...addrObj };
          }

          const note = noteInput ? noteInput.value : '';
          const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked') ?
            document.querySelector('input[name="paymentMethod"]:checked').value : '';

          return window.ABMT.api.post('/api/orders', {
            addressId: addressId || undefined,
            address: Object.keys(address).length > 0 ? address : undefined,
            note: note,
            paymentMethod: paymentMethod || undefined
          });
        })
          .then(function (response) {
            // Success
            const orderCode = (response && response.data && response.data.code) || '';
            if (orderCode) {
              ABMT.toast.success('Đặt hàng thành công. Mã đơn: ' + orderCode);
              setTimeout(function () {
                window.location.href = '/account#orders';
              }, 1500);
            } else if (response && response.redirectUrl) {
              window.location.href = response.redirectUrl;
            } else {
              ABMT.toast.success('Đặt hàng thành công');
              setTimeout(function () {
                window.location.href = '/account#orders';
              }, 2000);
            }
          })
          .catch(function (error) {
            // Lỗi 401 (chưa đăng nhập/phiên hết hạn) → về login
            if (error && (error.status === 401 || error.code === 401)) {
              window.location.replace('/login?next=/checkout');
              return;
            }
            // Lỗi 409 (hết hàng) → toast với chi tiết
            if (error && (error.status === 409 || error.code === 409)) {
              ABMT.toast.fromError(error);
              placeOrderBtn.disabled = false;
              placeOrderBtn.classList.remove('is-loading');
              placeOrderBtn.removeAttribute('aria-busy');
              return;
            }
            ABMT.toast.fromError(error);
            placeOrderBtn.disabled = false;
            placeOrderBtn.classList.remove('is-loading');
            placeOrderBtn.removeAttribute('aria-busy');
          });
      });
    }
  }

})();