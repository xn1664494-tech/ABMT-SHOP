(function () {
  'use strict';

  var aList = document.getElementById('aList');
  if (!aList) {
    return;
  }

  var checkoutForm = document.getElementById('checkoutForm');
  var addressForm = document.getElementById('aForm');
  var noteEl = document.getElementById('note');
  var noteCnt = document.getElementById('noteCnt');
  var payInfo = document.getElementById('payInfo');
  var payContainer = document.getElementById('oPay') || document;
  var submitting = false;
  var autocompleteReady = false;

  function getAddressRadios() {
    return aList.querySelectorAll('input[name="addressId"]');
  }

  function getSelectedAddress() {
    var radios = getAddressRadios();
    for (var i = 0; i < radios.length; i += 1) {
      if (radios[i].checked) return radios[i];
    }
    return null;
  }

  function isNewAddress(radio) {
    return !radio || radio.value === '' || radio.value === 'new';
  }

  function ensureAutocomplete() {
    if (autocompleteReady || !addressForm) return;
    autocompleteReady = true;
    if (window.ABMT && window.ABMT.address && window.ABMT.address.initAutocomplete) {
      var combo = addressForm.querySelector('[data-addr-combo]');
      if (combo) window.ABMT.address.initAutocomplete(combo);
    }
  }

  function syncAddressMode() {
    var selected = getSelectedAddress();
    var useNew = isNewAddress(selected);
    if (addressForm) addressForm.hidden = !useNew;
    if (useNew) ensureAutocomplete();
  }

  function updateNoteCount() {
    if (!noteEl || !noteCnt) return;
    var max = Number(noteEl.maxLength) > 0 ? noteEl.maxLength : 0;
    var length = noteEl.value.length;
    noteCnt.textContent = max > 0 ? length + '/' + max : String(length);
  }

  function syncPayInfo() {
    var checked = payContainer.querySelector('input[name="paymentMethod"]:checked');
    if (!payInfo) return;
    var info = checked && checked.dataset ? checked.dataset.info : '';
    payInfo.textContent = info || '';
    payInfo.hidden = !info;
  }

  function getPaymentMethod() {
    var checked = payContainer.querySelector('input[name="paymentMethod"]:checked');
    return checked ? checked.value : 'cod';
  }

  function buildPayload() {
    var selected = getSelectedAddress();
    var payload = {
      note: noteEl ? noteEl.value.trim() : '',
      paymentMethod: getPaymentMethod(),
    };

    var itemInput = checkoutForm ? checkoutForm.querySelector('input[name="item"]') : null;
    if (itemInput && itemInput.value) {
      payload.item = itemInput.value;
    }

    if (isNewAddress(selected)) {
      if (!addressForm) {
        throw new Error('Thiếu thông tin địa chỉ giao hàng.');
      }
      var addressApi = window.ABMT && window.ABMT.address;
      if (!addressApi || !addressApi.validate || !addressApi.buildAddressPayload) {
        throw new Error('Không khởi tạo được biểu mẫu địa chỉ.');
      }
      if (!addressApi.validate(addressForm)) {
        throw new Error('__validation__');
      }
      payload.address = addressApi.buildAddressPayload(addressForm);
      delete payload.address.isDefault;
    } else {
      payload.addressId = selected.value;
    }

    return payload;
  }

  function redirectAfterSuccess(response) {
    var data = response && response.data ? response.data : response || {};
    if (window.ABMT && window.ABMT.toast) {
      window.ABMT.toast.success('Đặt hàng thành công.');
    }
    var target = data.redirectUrl || '/account';
    if (data.redirectUrl) {
      window.location.href = target;
      return;
    }
    window.setTimeout(function () {
      window.location.href = target;
    }, 450);
  }

  function handleSubmit(event) {
    if (event) event.preventDefault();
    if (submitting) return;

    var payload;
    try {
      payload = buildPayload();
    } catch (error) {
      if (error && error.message === '__validation__') {
        if (window.ABMT && window.ABMT.toast) {
          window.ABMT.toast.error('Vui lòng kiểm tra lại địa chỉ giao hàng.');
        }
        return;
      }
      if (window.ABMT && window.ABMT.toast) {
        window.ABMT.toast.error(error && error.message ? error.message : 'Không thể đặt hàng.');
      }
      return;
    }

    var button =
      (event && event.submitter) ||
      document.getElementById('placeOrder') ||
      (checkoutForm ? checkoutForm.querySelector('[type="submit"]') : null);

    submitting = true;

    var request = function () {
      return window.ABMT.api.post('/api/orders', payload);
    };
    var action = button && window.ABMT.loading
      ? window.ABMT.loading.wrap(button, request)
      : request();

    Promise.resolve(action)
      .then(function (response) {
        redirectAfterSuccess(response);
      })
      .catch(function (error) {
        submitting = false;
        if (window.ABMT && window.ABMT.toast) {
          window.ABMT.toast.fromError(error);
        }
      });
  }

  aList.addEventListener('change', function (event) {
    if (event.target && event.target.name === 'addressId') {
      syncAddressMode();
    }
  });

  if (noteEl) {
    noteEl.addEventListener('input', updateNoteCount);
    updateNoteCount();
  }

  payContainer.addEventListener('change', function (event) {
    if (event.target && event.target.name === 'paymentMethod') {
      syncPayInfo();
    }
  });

  if (addressForm) {
    addressForm.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') event.preventDefault();
    });
  }

  if (checkoutForm) {
    checkoutForm.addEventListener('submit', handleSubmit);
  }

  syncAddressMode();
  syncPayInfo();
})();
