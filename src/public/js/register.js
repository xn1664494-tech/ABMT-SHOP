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
    initRegister();
  });

  function initRegister() {
    var form = document.getElementById('registerForm');
    if (!form) return;

    var nameInput = form.elements.name;
    var emailInput = form.elements.email;
    var passwordInput = form.elements.password;
    var confirmInput = form.elements.confirmPassword;
    var registerError = document.getElementById('registerError');
    var submitBtn = form.querySelector('button[type="submit"]');

    function fieldErrorEl(input) {
      return input.closest('.field').querySelector('.field-error');
    }

    function showFieldError(input, message) {
      var el = fieldErrorEl(input);
      if (el) {
        el.textContent = message;
        el.removeAttribute('hidden');
      }
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }

    function hideFieldError(input) {
      var el = fieldErrorEl(input);
      if (el) {
        el.textContent = '';
        el.setAttribute('hidden', '');
      }
      input.classList.remove('is-invalid');
      input.setAttribute('aria-invalid', 'false');
    }

    function clearAllErrors() {
      [nameInput, emailInput, passwordInput, confirmInput].forEach(hideFieldError);
      if (registerError) {
        registerError.textContent = '';
        registerError.setAttribute('hidden', '');
      }
    }

    function showRegisterError(message) {
      if (registerError) {
        registerError.textContent = message;
        registerError.removeAttribute('hidden');
      }
    }

    function isEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function validateName() {
      var v = (nameInput.value || '').trim();
      if (v.length < 2 || v.length > 100) {
        showFieldError(nameInput, 'Họ và tên cần từ 2 đến 100 ký tự');
        return false;
      }
      hideFieldError(nameInput);
      return true;
    }

    function validateEmail() {
      var v = (emailInput.value || '').trim();
      if (!isEmail(v) || v.length > 254) {
        showFieldError(emailInput, 'Email không hợp lệ');
        return false;
      }
      hideFieldError(emailInput);
      return true;
    }

    function validatePassword() {
      var v = passwordInput.value || '';
      if (v.length < 8 || v.length > 72 || !/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) {
        showFieldError(passwordInput, 'Mật khẩu cần từ 8 đến 72 ký tự, gồm chữ và số');
        return false;
      }
      hideFieldError(passwordInput);
      return true;
    }

    function validateConfirm() {
      if (confirmInput.value !== passwordInput.value) {
        showFieldError(confirmInput, 'Mật khẩu nhập lại không khớp');
        return false;
      }
      hideFieldError(confirmInput);
      return true;
    }

    function validateForm() {
      var valid = true;
      var firstInvalid = null;

      if (!validateName()) {
        valid = false;
        if (!firstInvalid) firstInvalid = nameInput;
      }
      if (!validateEmail()) {
        valid = false;
        if (!firstInvalid) firstInvalid = emailInput;
      }
      if (!validatePassword()) {
        valid = false;
        if (!firstInvalid) firstInvalid = passwordInput;
      }
      if (!validateConfirm()) {
        valid = false;
        if (!firstInvalid) firstInvalid = confirmInput;
      }

      if (firstInvalid) firstInvalid.focus();
      return valid;
    }

    [nameInput, emailInput, passwordInput, confirmInput].forEach(function (input) {
      input.addEventListener('input', function () {
        hideFieldError(input);
      });
    });
    nameInput.addEventListener('blur', validateName);
    emailInput.addEventListener('blur', validateEmail);
    passwordInput.addEventListener('blur', validatePassword);
    confirmInput.addEventListener('blur', validateConfirm);

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      clearAllErrors();
      if (!validateForm()) {
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('is-loading');
      submitBtn.setAttribute('aria-busy', 'true');

      window.ABMT.api.post('/api/auth/register', {
        name: (nameInput.value || '').trim(),
        email: (emailInput.value || '').trim(),
        password: passwordInput.value
      })
        .then(function () {
          ABMT.toast.success('Đăng ký thành công. Vui lòng đăng nhập.');
          setTimeout(function () {
            window.location.href = '/login';
          }, 1000);
        })
        .catch(function (error) {
          var status = error && error.status;
          var details = error && error.errors;

          if (status === 409) {
            showFieldError(emailInput, 'Email này đã được đăng ký');
            emailInput.focus();
          } else if (status === 400 && Array.isArray(details)) {
            var fieldMsg = {
              name: 'Họ và tên cần từ 2 đến 100 ký tự',
              email: 'Email không hợp lệ',
              password: 'Mật khẩu cần từ 8 đến 72 ký tự, gồm chữ và số'
            };
            var targets = {
              name: nameInput,
              email: emailInput,
              password: passwordInput
            };
            details.forEach(function (d) {
              var target = targets[d.field];
              if (target) {
                showFieldError(target, fieldMsg[d.field] || 'Trường này không hợp lệ');
              }
            });
            ['name', 'email', 'password'].forEach(function (key) {
              if (details.some(function (d) { return d.field === key; })) {
                targets[key].focus();
                return;
              }
            });
          } else if (status === 429) {
            showRegisterError('Bạn thao tác quá nhiều lần, vui lòng thử lại sau ít phút.');
          } else {
            ABMT.toast.fromError(error);
          }
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.classList.remove('is-loading');
          submitBtn.removeAttribute('aria-busy');
        });
    });
  };
})();
