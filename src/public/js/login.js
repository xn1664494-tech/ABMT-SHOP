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
    initLogin();
  });

  /**
   * Login page initialization
   * Exits early if no #loginForm element
   */
  function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    const emailInput = form.elements.email;
    const passwordInput = form.elements.password;
    const loginError = document.getElementById('loginError');

    function getFieldError(input) {
      return input.closest('.field').querySelector('.field-error');
    }

    function showFieldError(input, message) {
      var el = getFieldError(input);
      if (el) {
        el.textContent = message;
        el.removeAttribute('hidden');
      }
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }

    function hideFieldError(input) {
      var el = getFieldError(input);
      if (el) {
        el.textContent = '';
        el.setAttribute('hidden', '');
      }
      input.classList.remove('is-invalid');
      input.setAttribute('aria-invalid', 'false');
    }

    function validateForm() {
      var valid = true;

      var emailValue = (emailInput.value || '').trim();
      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        valid = false;
        showFieldError(emailInput, 'Email không hợp lệ');
      } else {
        hideFieldError(emailInput);
      }

      var passwordValue = (passwordInput.value || '').trim();
      if (!passwordValue) {
        valid = false;
        showFieldError(passwordInput, 'Vui lòng nhập mật khẩu');
      } else {
        hideFieldError(passwordInput);
      }

      if (!valid) {
        if (emailInput.classList.contains('is-invalid')) {
          emailInput.focus();
        } else {
          passwordInput.focus();
        }
      }
      return valid;
    }

    function getQueryParam(name) {
      const params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    }

    function isSafeNext(next) {
      if (typeof next !== 'string' || next === '') {
        return false;
      }
      if (!next.startsWith('/') || next.startsWith('//')) {
        return false;
      }
      if (next.includes('\\') || next.includes('://')) {
        return false;
      }
      return true;
    }

    function showError(message) {
      if (loginError) {
        loginError.textContent = message;
        loginError.removeAttribute('hidden');
      }
    }

    function hideError() {
      if (loginError) {
        loginError.textContent = '';
        loginError.setAttribute('hidden', '');
      }
    }

    // Form submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      hideError();
      hideFieldError(emailInput);
      hideFieldError(passwordInput);

      if (!validateForm()) {
        showError('Vui lòng điền đầy đủ email và mật khẩu hợp lệ');
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
        submitBtn.setAttribute('aria-busy', 'true');
      }

      window.ABMT.api.post('/api/auth/login', {
        email: emailInput.value.trim(),
        password: passwordInput.value.trim(),
      })
        .then(function (response) {
          // Đăng nhập thành công (200): không có redirectUrl từ API.
          // Lấy next từ query string, kiểm tra an toàn; hợp lệ → đến next, ngược lại → /account.
          const nextFromUrl = getQueryParam('next');
          const redirectTarget = isSafeNext(nextFromUrl) ? nextFromUrl : '/account';
          // replace để nút Back không quay lại trang login
          window.location.replace(redirectTarget);
        })
        .catch(function (error) {
          if (error && (error.code === 401 || error.status === 401 || (error.message && error.message.includes('Email hoặc mật khẩu')))) {
            showError('Email hoặc mật khẩu không đúng');
          } else {
            ABMT.toast.fromError(error);
          }
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
            submitBtn.removeAttribute('aria-busy');
          }
        });
    });
  }

})();
