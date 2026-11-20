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
    const nextInput = form.elements.next;

    // Toggle password visibility
    const toggleBtn = form.querySelector('button[type="button"]');
    if (toggleBtn) {
      let isPasswordVisible = false;
      toggleBtn.addEventListener('click', function () {
        isPasswordVisible = !isPasswordVisible;
        passwordInput.type = isPasswordVisible ? 'text' : 'password';
        toggleBtn.setAttribute('aria-pressed', isPasswordVisible);
        toggleBtn.innerHTML = isPasswordVisible
          ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="10"/></svg>'
          : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="6" y1="2" x6="6" y2="22"/></svg>';
      });
    }

    // Client-side validation
    function validateForm() {
      let valid = true;

      // Email format validation
      const emailValue = (emailInput.value || '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailValue)) {
        valid = false;
        emailInput.classList.add('is-invalid');
        emailInput.setAttribute('aria-invalid', 'true');
        const emailFieldError = emailInput.parentElement.querySelector('.field-error');
        if (emailFieldError) {
          emailFieldError.style.display = 'block';
        }
        if (valid) emailInput.focus();
      } else {
        emailInput.classList.remove('is-invalid');
        emailInput.setAttribute('aria-invalid', 'false');
        const emailFieldError = emailInput.parentElement.querySelector('.field-error');
        if (emailFieldError) {
          emailFieldError.style.display = 'none';
        }
      }

      // Password not empty
      const passwordValue = (passwordInput.value || '').trim();
      if (!passwordValue) {
        valid = false;
        passwordInput.classList.add('is-invalid');
        passwordInput.setAttribute('aria-invalid', 'true');
        const passwordFieldError = passwordInput.parentElement.querySelector('.field-error');
        if (passwordFieldError) {
          passwordFieldError.style.display = 'block';
        }
        if (valid) passwordInput.focus();
      } else {
        passwordInput.classList.remove('is-invalid');
        passwordInput.setAttribute('aria-invalid', 'false');
        const passwordFieldError = passwordInput.parentElement.querySelector('.field-error');
        if (passwordFieldError) {
          passwordFieldError.style.display = 'none';
        }
      }

      return valid;
    }

    // Show error message
    function showError(message) {
      if (loginError) {
        loginError.textContent = message;
        loginError.style.display = 'block';
        loginError.setAttribute('role', 'alert');
      }
    }

    // Hide error message
    function hideError() {
      if (loginError) {
        loginError.style.display = 'none';
        loginError.textContent = '';
        loginError.removeAttribute('role');
      }
    }

    // Form submit
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Hide previous error
      hideError();

      // Client-side validation
      if (!validateForm()) {
        showError('Vui lòng điền đầy đủ email và mật khẩu hợp lệ');
        return;
      }

      // Disable submit button và khóa bằng withButtonLock
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('is-loading');
        submitBtn.setAttribute('aria-busy', 'true');
      }

      // Gửi POST tới API đăng nhập
      const nextValue = (nextInput && nextInput.value) || '';
      const isValidNext = nextValue && nextValue.startsWith('/') && !nextValue.startsWith('//');

      window.ABMT.api.post('/api/auth/login', {
        email: emailInput.value.trim(),
        password: passwordInput.value.trim(),
        next: isValidNext ? nextValue : undefined
      })
        .then(function (response) {
          // Success: redirect tới redirectUrl hoặc next
          const redirectUrl = response && response.data && response.data.redirectUrl;
          const validNext = isValidNext ? nextValue : '/';

          if (redirectUrl) {
            window.location.href = redirectUrl;
          } else if (validNext) {
            window.location.href = validNext;
          } else {
            window.location.href = '/';
          }
        })
        .catch(function (error) {
          // Lỗi 401/422: email/mật khẩu sai
          if (error && error.code === 401 || error && error.status === 401 || error && error.message && error.message.includes('Email hoặc mật khẩu')) {
            showError('Email hoặc mật khẩu không đúng');
          } else {
            // Lỗi mạng/timeout
            ABMT.toast.fromError(error);
          }
        })
        .finally(function () {
          // Mở khóa nút
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('is-loading');
            submitBtn.removeAttribute('aria-busy');
          }
        });
    });
  }

})();