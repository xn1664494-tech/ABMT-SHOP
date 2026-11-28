(function () {
  'use strict';

  var ACTIONS = {
    'confirm-order': {
      endpoint: function (code) { return '/api/admin/orders/' + encodeURIComponent(code) + '/confirm'; },
      title: 'Xác nhận đơn hàng',
      message: 'Bạn có chắc muốn xác nhận đơn này?',
      fields: [],
    },
    'ship-order': {
      endpoint: function (code) { return '/api/admin/orders/' + encodeURIComponent(code) + '/ship'; },
      title: 'Bàn giao vận chuyển',
      message: 'Nhập thông tin đơn vị vận chuyển và mã vận đơn.',
      fields: ['carrier', 'trackingCode'],
    },
    'cancel-order': {
      endpoint: function (code) { return '/api/admin/orders/' + encodeURIComponent(code) + '/cancel'; },
      title: 'Hủy đơn hàng',
      message: 'Hành động này sẽ hoàn kho sản phẩm. Bạn có chắc muốn hủy đơn?',
      fields: ['reason'],
    },
    'mark-paid': {
      endpoint: function (code) { return '/api/admin/orders/' + encodeURIComponent(code) + '/mark-paid'; },
      title: 'Xác nhận đã nhận tiền',
      message: 'Xác nhận đã nhận tiền chuyển khoản cho đơn này?',
      fields: [],
    },
    'simulate-delivery': {
      endpoint: function (code) { return '/api/admin/orders/' + encodeURIComponent(code) + '/simulate-delivery'; },
      title: 'Giả lập giao hàng',
      message: 'Giả lập đơn vị vận chuyển báo đã giao thành công.',
      fields: [],
    },
  };

  var dialog = null;
  var dialogForm = null;
  var dialogTitle = null;
  var dialogMessage = null;
  var dialogError = null;
  var confirmButton = null;
  var cancelButton = null;
  var pending = null;

  function toast() {
    return window.ABMT && window.ABMT.toast ? window.ABMT.toast : null;
  }

  function showError(message) {
    if (dialogError) {
      dialogError.textContent = message;
      dialogError.hidden = false;
    }
    var t = toast();
    if (t) t.error(message);
  }

  function closeDialog() {
    pending = null;
    if (dialog && typeof dialog.close === 'function') dialog.close();
  }

  function openDialog(action, code) {
    var config = ACTIONS[action];
    if (!config || !code || !dialog) return;

    pending = { action: action, code: code, config: config };
    dialogTitle.textContent = config.title;
    dialogMessage.textContent = config.message;
    dialogError.hidden = true;
    dialogError.textContent = '';

    Array.prototype.forEach.call(dialogForm.querySelectorAll('[data-dialog-field]'), function (field) {
      var name = field.getAttribute('data-dialog-field');
      var input = field.querySelector('input');
      field.hidden = config.fields.indexOf(name) === -1;
      if (input) input.value = '';
    });

    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function readBody() {
    var body = {};
    pending.config.fields.forEach(function (name) {
      var input = dialogForm.querySelector('[name="' + name + '"]');
      var value = input ? String(input.value || '').trim() : '';
      if (!value) {
        var label = dialogForm.querySelector('[data-dialog-field="' + name + '"] .adm-label');
        throw new Error(label ? 'Vui lòng nhập ' + label.textContent : 'Vui lòng nhập ' + name);
      }
      body[name] = value;
    });
    return body;
  }

  async function submitAction() {
    if (!pending || !window.ABMT || !window.ABMT.api) return;
    var config = pending.config;
    var code = pending.code;
    var body;

    try {
      body = readBody();
    } catch (error) {
      showError(error.message);
      return;
    }

    if (confirmButton.disabled) return;
    confirmButton.disabled = true;

    try {
      await window.ABMT.api.post(config.endpoint(code), body);
      var t = toast();
      if (t) t.success('Cập nhật đơn hàng thành công');
      closeDialog();
      window.location.reload();
    } catch (error) {
      dialogError.hidden = false;
      dialogError.textContent = error && error.message ? error.message : 'Có lỗi xảy ra, vui lòng thử lại.';
      var t = toast();
      if (t) t.fromError(error);
      if (error && error.status === 409) {
        dialogMessage.textContent = 'Trạng thái đơn đã thay đổi. Trang sẽ được tải lại để cập nhật.';
        window.setTimeout(function () { window.location.reload(); }, 1200);
      } else {
        confirmButton.disabled = false;
      }
    }
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    dialog = document.getElementById('order-dialog');
    if (!dialog) return;

    dialogForm = document.getElementById('order-dialog-form') || dialog.querySelector('form');
    dialogTitle = document.getElementById('order-dialog-title');
    dialogMessage = document.getElementById('order-dialog-message');
    dialogError = dialog.querySelector('[data-dialog-error]');
    confirmButton = dialog.querySelector('[data-dialog-confirm]');
    cancelButton = dialog.querySelector('[data-dialog-cancel]');

    document.addEventListener('click', function (event) {
      var trigger = event.target.closest('[data-action]');
      if (!trigger) return;

      var action = trigger.getAttribute('data-action');
      if (!ACTIONS[action]) return;

      var code = trigger.getAttribute('data-order-code');
      if (!code) {
        var row = trigger.closest('[data-order-code]');
        code = row ? row.getAttribute('data-order-code') : '';
      }
      if (!code) return;

      event.preventDefault();
      openDialog(action, code);
    });

    if (confirmButton) confirmButton.addEventListener('click', submitAction);
    if (cancelButton) cancelButton.addEventListener('click', closeDialog);
    dialog.addEventListener('cancel', function () { pending = null; });
  });
})();
