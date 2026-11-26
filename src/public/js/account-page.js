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
    var dialog = document.getElementById('accAddressDialog');
    var form = document.getElementById('accAddressForm');

    function getToast() {
      return window.ABMT && window.ABMT.toast ? window.ABMT.toast : null;
    }

    function handleUnauthorized(error) {
      if (error && (error.status === 401 || error.code === 401)) {
        window.location.replace('/login?next=/account');
        return true;
      }
      return false;
    }

    function closeDialog() {
      if (!dialog) return;
      if (typeof dialog.close === 'function' && dialog.open) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    function openEditor(card) {
      if (!card || !dialog || !form) return;
      var data = card.dataset || {};
      form.elements.id.value = data.id || '';
      form.elements.fullName.value = data.recipient || '';
      form.elements.phone.value = data.phone || '';
      form.elements.province.value = data.city || '';
      form.elements.district.value = data.district || '';
      form.elements.ward.value = data.ward || '';
      form.elements.detail.value = data.street || '';

      if (typeof dialog.showModal === 'function') {
        if (!dialog.open) dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || typeof target.closest !== 'function') return;

      var editButton = target.closest('[data-acc-edit]');
      if (editButton) {
        event.preventDefault();
        openEditor(editButton.closest('[data-acc-address]'));
        return;
      }

      var deleteButton = target.closest('[data-acc-delete]');
      if (deleteButton) {
        event.preventDefault();
        confirmDelete(deleteButton.closest('[data-acc-address]'));
        return;
      }

      if (target.closest('[data-acc-cancel]')) {
        event.preventDefault();
        closeDialog();
      }
    });

    if (dialog) {
      dialog.addEventListener('click', function (event) {
        if (event.target === dialog) closeDialog();
      });
    }

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (form.dataset.submitting === '1') return;

        var id = (form.elements.id.value || '').trim();
        if (!id) return;

        var payload = {
          fullName: (form.elements.fullName.value || '').trim(),
          phone: (form.elements.phone.value || '').replace(/\s+/g, ''),
          province: (form.elements.province.value || '').trim(),
          district: (form.elements.district.value || '').trim(),
          ward: (form.elements.ward.value || '').trim(),
          detail: (form.elements.detail.value || '').trim(),
        };

        var toast = getToast();

        if (!payload.fullName || !payload.phone || !payload.province || !payload.ward || !payload.detail) {
          if (toast) toast.error('Vui lòng nhập đầy đủ thông tin địa chỉ.');
          return;
        }

        if (!/^(0|\+84)[0-9]{9,10}$/.test(payload.phone)) {
          if (toast) toast.error('Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84).');
          return;
        }

        form.dataset.submitting = '1';
        var button = form.querySelector('button[type="submit"]');
        var request = function () {
          return window.ABMT.api.put('/api/profile/addresses/' + encodeURIComponent(id), payload);
        };
        var task = (window.ABMT && window.ABMT.withButtonLock && button)
          ? window.ABMT.withButtonLock(button, request)
          : request();

        Promise.resolve(task)
          .then(function () {
            if (toast) toast.success('Cập nhật địa chỉ thành công.');
            window.setTimeout(function () {
              window.location.reload();
            }, 400);
          })
          .catch(function (error) {
            form.dataset.submitting = '0';
            if (handleUnauthorized(error)) return;
            if (toast) toast.fromError(error);
          });
      });
    }

    function confirmDelete(card) {
      if (!card) return;
      var id = (card.dataset && card.dataset.id) || '';
      if (!id) return;

      if (!window.confirm('Bạn có chắc muốn xóa địa chỉ này?')) return;

      var toast = getToast();
      window.ABMT.api
        .delete('/api/profile/addresses/' + encodeURIComponent(id))
        .then(function () {
          if (toast) toast.success('Đã xóa địa chỉ.');
          window.setTimeout(function () {
            window.location.reload();
          }, 400);
        })
        .catch(function (error) {
          if (handleUnauthorized(error)) return;
          if (toast) toast.fromError(error);
        });
    }
  });
})();
