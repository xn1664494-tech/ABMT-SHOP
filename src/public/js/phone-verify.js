(function () {
  'use strict';

  var state = { step: 1, phone: '', devOtp: null, resendAt: 0 };

  function q(sel) { return document.querySelector(sel); }
  function errorNode() { return document.querySelector('[data-phone-error]'); }
  function displayNode() { return document.querySelector('[data-phone-display]'); }

  function showError(message) {
    var el = errorNode();
    if (!el) { return; }
    el.textContent = message || '';
    el.hidden = !message;
  }

  function setDisplay(phoneMasked) {
    var el = displayNode();
    if (!el) { return; }
    el.textContent = phoneMasked ? ('Số điện thoại: ' + phoneMasked) : '';
  }

  function goStep(step) {
    state.step = step;
    var s1 = document.querySelector('[data-phone-step="1"]');
    var s2 = document.querySelector('[data-phone-step="2"]');
    if (s1) { s1.hidden = step !== 1; }
    if (s2) { s2.hidden = step !== 2; }
  }

  function startResendCooldown() {
    state.resendAt = Date.now() + 60000;
    var btn = document.querySelector('[data-phone-resend]');
    var hint = document.querySelector('[data-phone-countdown]');
    if (!btn || !hint) { return; }
    btn.disabled = true;
    var timer = setInterval(function () {
      var remain = Math.max(0, Math.ceil((state.resendAt - Date.now()) / 1000));
      hint.textContent = String(remain);
      if (remain <= 0) { clearInterval(timer); btn.disabled = false; }
    }, 1000);
  }

  function sendCode(phone, onSent) {
    state.phone = phone;
    showError('');
    window.ABMT.api.post('/api/profile/phone', { phone: phone })
      .then(function (res) {
        var data = (res && res.data) || {};
        state.devOtp = data.devOtp || null;
        state.resendAt = Date.now() + 60000;
        setDisplay(data.phoneMasked);
        startResendCooldown();
        if (state.devOtp) { var codeInput = document.getElementById('phone-verify-code'); if (codeInput) { codeInput.value = state.devOtp; } }
        goStep(2);
        if (typeof onSent === 'function') { onSent(data); }
      })
      .catch(function (err) {
        showError((err && err.message) || 'Khong gui duoc ma.');
      });
  }

  function verifyCode(code) {
    window.ABMT.api.post('/api/profile/phone/verify', { code: code })
      .then(function (res) {
        var data = (res && res.data) || {};
        if (window.ABMT && window.ABMT.toast) { window.ABMT.toast.success('Xác minh thành công.'); }
        var overlay = document.getElementById('phone-verify-overlay');
        if (overlay) { overlay.hidden = true; }
        setDisplay(data.phoneMasked);
        var badge = document.querySelector('[data-phone-badge="' + (data.phoneVerified ? 'verified' : 'unverified') + '"]');
        if (badge) { badge.className = 'acc-badge ' + (data.phoneVerified ? 'acc-badge--verified' : 'acc-badge--unverified'); }
        var valueNodes = document.querySelectorAll('[data-phone-value]');
        for (var vi = 0; vi < valueNodes.length; vi++) { valueNodes[vi].textContent = data.phoneMasked || ''; }
      })
      .catch(function (err) {
        showError((err && err.message) || 'Ma khong dung.');
      });
  }

  function bind() {
    var sendBtn = document.querySelector('[data-phone-send]');
    var verifyBtn = document.querySelector('[data-phone-verify-submit]');
    var resendBtn = document.querySelector('[data-phone-resend]');
    var closeBtn = document.querySelector('[data-phone-modal-close]');

    if (sendBtn) {
      sendBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var input = document.getElementById('phone-verify-phone');
        var phone = input ? String(input.value || '').trim() : '';
        if (!phone) { showError('Vui lòng nhập số điện thoại.'); return; }
        sendCode(phone, function () { goStep(2); });
      });
    }
    if (verifyBtn) {
      verifyBtn.addEventListener('click', function (e) {
        e.preventDefault();
        var input = document.getElementById('phone-verify-code');
        var code = input ? String(input.value || '').replace(/[^0-9]/g, '') : '';
        if (code.length !== 6) { showError('Mã phải có 6 ký tự.'); return; }
        verifyCode(code);
      });
    }
    if (resendBtn) {
      resendBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (state.resendAt && Date.now() < state.resendAt) { return; }
        var input = document.getElementById('phone-verify-phone');
        var phone = input ? String(input.value || '').trim() : state.phone;
        if (!phone) { showError('Vui lòng nhập số điện thoại.'); return; }
        sendCode(phone, function () {});
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function () { var o = document.getElementById('phone-verify-overlay'); if (o) { o.hidden = true; } });
    }
    var overlay = document.getElementById('phone-verify-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) { if (e.target === overlay) { overlay.hidden = true; } });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay) { overlay.hidden = true; } });
    }
  }

  function init() {
    bind();
    var ctaButtons = document.querySelectorAll('[data-phone-cta]');
    for (var i = 0; i < ctaButtons.length; i++) {
      ctaButtons[i].addEventListener('click', function (e) {
        e.preventDefault();
        var overlay = document.getElementById('phone-verify-overlay');
        if (!overlay) { return; }
        state.step = 1;
        state.phone = '';
        state.devOtp = null;
        state.resendAt = 0;
        goStep(1);
        setDisplay(null);
        showError('');
        overlay.hidden = false;
        var input = document.getElementById('phone-verify-phone');
        if (input) { input.value = ''; }
        var code = document.getElementById('phone-verify-code');
        if (code) { code.value = ''; }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
