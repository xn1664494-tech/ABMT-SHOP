(function () {
  'use strict';

  var STATUS_LABELS = {
    cancelled: 'Đã hủy',
    completed: 'Hoàn tất',
  };

  var dialog = null;
  var form = null;
  var reasonInput = null;
  var errorBox = null;
  var pendingCode = '';

  function api() {
    return window.ABMT && window.ABMT.api ? window.ABMT.api : null;
  }

  function toast() {
    return window.ABMT && window.ABMT.toast ? window.ABMT.toast : null;
  }

  function notify(message, type) {
    var t = toast();
    if (!t) return;
    if (type === 'error' && typeof t.error === 'function') t.error(message);
    else if (type === 'success' && typeof t.success === 'function') t.success(message);
    else if (typeof t.info === 'function') t.info(message);
  }

  function friendlyError(error) {
    if (error && error.status === 409) {
      return 'Trạng thái đơn đã thay đổi. Vui lòng tải lại trang để xem thông tin mới nhất.';
    }
    if (error && error.status === 403) {
      return 'Bạn không thể thực hiện thao tác này ở trạng thái hiện tại.';
    }
    return (error && error.message) || 'Có lỗi xảy ra, vui lòng thử lại.';
  }

  function closeDialog() {
    pendingCode = '';
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (dialog && typeof dialog.close === 'function') dialog.close();
  }

  function openCancelDialog(code) {
    if (!dialog || !code) return;
    pendingCode = code;
    if (reasonInput) reasonInput.value = '';
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (reasonInput) reasonInput.focus();
  }

  function updateBadge(root, status) {
    if (!root) return;
    var label = STATUS_LABELS[status] || status;
    var badge = root.querySelector('[data-order-badge]') || root.querySelector('[data-order-status-label]');
    if (!badge) return;
    badge.textContent = label;
    var isCard = badge.hasAttribute('data-order-status-label');
    if (isCard) {
      badge.className = 'acc-badge acc-badge--' + (status === 'cancelled' ? 'cancelled' : 'completed');
    } else {
      badge.className = 'badge ' + (status === 'cancelled' ? 'badge-danger' : 'badge-soft');
    }
    badge.setAttribute('data-status-label', status);
  }

  function applySuccess(root, status, completedAtLabel) {
    updateBadge(root, status);

    var buttons = (root || document).querySelectorAll('[data-action="cancel-order"], [data-action="confirm-received"]');
    Array.prototype.forEach.call(buttons, function (button) {
      button.remove();
    });

    var banner = document.querySelector('[data-delivered-banner]');
    if (banner) banner.classList.add('is-hidden');

    if (status === 'completed' && completedAtLabel) {
      var head = document.querySelector('.acc-detail-head');
      if (head && !document.querySelector('[data-completed-date]')) {
        var p = document.createElement('p');
        p.className = 'acc-detail-date';
        p.setAttribute('data-completed-date', '');
        p.textContent = 'Ngày hoàn tất: ' + completedAtLabel;
        head.appendChild(p);
      }
    }
  }

  function handleConflict(error) {
    var message = friendlyError(error);
    if (errorBox) {
      errorBox.textContent = message;
      errorBox.hidden = false;
    }
    notify(message, 'error');
    if (error && error.status === 409) {
      window.setTimeout(function () { window.location.reload(); }, 1500);
    }
  }

  async function cancelOrder(code, reason, root) {
    if (!api()) return;
    var response = await api().post('/api/orders/' + encodeURIComponent(code) + '/cancel', {
      reason: reason,
    });
    applySuccess(root, 'cancelled');
    closeDialog();
    notify('Hủy đơn hàng thành công', 'success');
    return response;
  }

  async function confirmReceived(code, root) {
    if (!api()) return;
    var response = await api().post(
      '/api/orders/' + encodeURIComponent(code) + '/confirm-received',
      {},
    );
    var completedAt = response && response.data && response.data.completedAt;
    var label = '';
    if (completedAt) {
      var date = new Date(completedAt);
      if (!isNaN(date.getTime())) {
        var pad = function (value) { return String(value).padStart(2, '0'); };
        label = pad(date.getDate()) + '/' + pad(date.getMonth() + 1) + '/' + date.getFullYear()
          + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
      }
    }
    applySuccess(root, 'completed', label);
    notify('Xác nhận đã nhận hàng thành công', 'success');
    return response;
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    dialog = document.getElementById('cancelOrderDialog');
    if (dialog) {
      form = document.getElementById('cancelOrderForm') || dialog.querySelector('form');
      reasonInput = dialog.querySelector('[name="reason"]');
      errorBox = dialog.querySelector('[data-cancel-error]');

      var closeButton = dialog.querySelector('[data-cancel-dialog-close]');
      if (closeButton) closeButton.addEventListener('click', closeDialog);
      dialog.addEventListener('cancel', closeDialog);

      if (form) {
        form.addEventListener('submit', async function (event) {
          event.preventDefault();
          if (!pendingCode || !reasonInput) return;
          var reason = String(reasonInput.value || '').trim();
          if (!reason) {
            if (errorBox) {
              errorBox.textContent = 'Vui lòng nhập lý do hủy đơn.';
              errorBox.hidden = false;
            }
            return;
          }

          var root = document;
          var submitButton = form.querySelector('button[type="submit"]');
          if (submitButton) submitButton.disabled = true;

          try {
            await cancelOrder(pendingCode, reason, root);
          } catch (error) {
            handleConflict(error);
            if (submitButton) submitButton.disabled = false;
          }
        });
      }
    }

    document.addEventListener('click', async function (event) {
      var trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      var action = trigger.getAttribute('data-action');
      var code = trigger.getAttribute('data-order-code');
      if (!code) {
        var card = trigger.closest('[data-order-code]');
        code = card ? card.getAttribute('data-order-code') : '';
      }
      if (!code) return;

      if (action === 'cancel-order') {
        event.preventDefault();
        openCancelDialog(code);
        return;
      }

      if (action === 'confirm-received') {
        event.preventDefault();
        if (trigger.disabled) return;
        trigger.disabled = true;
        var root = trigger.closest('[data-order-card]') || document;
        try {
          await confirmReceived(code, root);
        } catch (error) {
          handleConflict(error);
          trigger.disabled = false;
        }
      }
    });
  });
})();
