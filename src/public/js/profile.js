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
    loadProfile();
    initProfileForm();
    initPasswordForm();
  });

  function setText(selector, value) {
    var el = document.querySelector('[data-profile="' + selector + '"]');
    if (el) {
      el.textContent = value;
    }
  }

  function showAlert(id, message) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = message;
      el.removeAttribute('hidden');
    }
  }

  function hideAlert(id) {
    var el = document.getElementById(id);
    if (el) {
      el.textContent = '';
      el.setAttribute('hidden', '');
    }
  }

  function showFieldError(input, message) {
    var field = input && input.closest('.field');
    var el = field && field.querySelector('.field-error');
    if (el) {
      el.textContent = message;
      el.removeAttribute('hidden');
    }
    if (input) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
    }
  }

  function hideFieldError(input) {
    var field = input && input.closest('.field');
    var el = field && field.querySelector('.field-error');
    if (el) {
      el.textContent = '';
      el.setAttribute('hidden', '');
    }
    if (input) {
      input.classList.remove('is-invalid');
      input.setAttribute('aria-invalid', 'false');
    }
  }

  function applyApiFieldErrors(error, inputs) {
    var details = [];
    if (Array.isArray(error && error.errors)) {
      details = error.errors;
    } else if (error && error.data && Array.isArray(error.data.details)) {
      details = error.data.details;
    }

    details.forEach(function (item) {
      if (!item || !item.field) return;
      var input = inputs[item.field];
      if (input && item.message) {
        showFieldError(input, item.message);
      }
    });
  }

  function handleUnauthorized(error) {
    if (error && (error.status === 401 || error.code === 401)) {
      window.location.replace('/login?next=/profile');
      return true;
    }
    return false;
  }

  function formatDate(value) {
    if (!value) return '—';
    var date = new Date(value);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('vi-VN');
  }

  function renderProfile(user) {
    if (!user) return;
    setText('name', user.name || '—');
    setText('email', user.email || '—');
    setText('phone', user.phoneMasked || '');
    setText('createdAt', formatDate(user.createdAt));

    var form = document.getElementById('profileForm');
    if (form) {
      if (form.elements.name) form.elements.name.value = user.name || '';
      if (form.elements.email) form.elements.email.value = user.email || '';
    }
  }

  function loadProfile() {
    window.ABMT.api
      .get('/api/profile/me')
      .then(function (response) {
        hideAlert('profileLoadError');
        renderProfile(response && response.data && response.data.user);
      })
      .catch(function (error) {
        if (handleUnauthorized(error)) return;
        showAlert('profileLoadError', 'Không thể tải thông tin hồ sơ. Vui lòng thử lại.');
        ABMT.toast.fromError(error);
      });
  }

  function initProfileForm() {
    var form = document.getElementById('profileForm');
    if (!form) return;

    var nameInput = form.elements.name;
    var emailInput = form.elements.email;
    var inputs = { name: nameInput, email: emailInput };

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideAlert('profileFormError');
      hideFieldError(nameInput);
      hideFieldError(emailInput);

      var name = (nameInput.value || '').trim();
      var email = (emailInput.value || '').trim();
      var valid = true;

      if (name.length < 2 || name.length > 100) {
        showFieldError(nameInput, 'Họ và tên phải từ 2 đến 100 ký tự');
        valid = false;
      }

      var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || email.length > 254) {
        showFieldError(emailInput, 'Email không hợp lệ');
        valid = false;
      }

      if (!valid) {
        nameInput.focus();
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      ABMT.withButtonLock(button, function () {
        return window.ABMT.api
          .patch('/api/profile/me', { name: name, email: email })
          .then(function (response) {
            renderProfile(response && response.data && response.data.user);
            ABMT.toast.success('Cập nhật hồ sơ thành công');
          })
          .catch(function (error) {
            if (handleUnauthorized(error)) return;
            applyApiFieldErrors(error, inputs);
            showAlert('profileFormError', error.message || 'Cập nhật hồ sơ thất bại.');
            ABMT.toast.fromError(error);
          });
      });
    });
  }

  function initPasswordForm() {
    var form = document.getElementById('passwordForm');
    if (!form) return;

    var currentInput = form.elements.currentPassword;
    var newInput = form.elements.newPassword;
    var inputs = { currentPassword: currentInput, newPassword: newInput };

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      hideAlert('passwordFormError');
      hideFieldError(currentInput);
      hideFieldError(newInput);

      var currentPassword = currentInput.value || '';
      var newPassword = newInput.value || '';
      var valid = true;

      if (!currentPassword) {
        showFieldError(currentInput, 'Vui lòng nhập mật khẩu hiện tại');
        valid = false;
      }

      if (newPassword.length < 8 || newPassword.length > 72) {
        showFieldError(newInput, 'Mật khẩu mới phải từ 8 đến 72 ký tự');
        valid = false;
      } else if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        showFieldError(newInput, 'Mật khẩu mới phải có ít nhất 1 chữ cái và 1 chữ số');
        valid = false;
      } else if (newPassword === currentPassword) {
        showFieldError(newInput, 'Mật khẩu mới phải khác mật khẩu hiện tại');
        valid = false;
      }

      if (!valid) {
        currentInput.focus();
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      ABMT.withButtonLock(button, function () {
        return window.ABMT.api
          .patch('/api/profile/me/password', {
            currentPassword: currentPassword,
            newPassword: newPassword,
          })
          .then(function () {
            form.reset();
            ABMT.toast.success('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
            window.setTimeout(function () {
              window.location.replace('/login');
            }, 900);
          })
          .catch(function (error) {
            if (handleUnauthorized(error)) return;
            applyApiFieldErrors(error, inputs);
            showAlert('passwordFormError', error.message || 'Đổi mật khẩu thất bại.');
            ABMT.toast.fromError(error);
          });
      });
    });
  }
})();
