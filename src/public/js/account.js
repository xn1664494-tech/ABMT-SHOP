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
    initLogout();
  });

  function initLogout() {
    var logoutBtn = document.querySelector('[data-action="logout"]');
    if (!logoutBtn) return;

    var inProgress = false;

    function setLoading(isLoading) {
      inProgress = isLoading;
      if (isLoading) {
        logoutBtn.disabled = true;
        logoutBtn.setAttribute('aria-busy', 'true');
        logoutBtn.classList.add('is-loading');
      } else {
        logoutBtn.disabled = false;
        logoutBtn.removeAttribute('aria-busy');
        logoutBtn.classList.remove('is-loading');
      }
    }

    logoutBtn.addEventListener('click', function () {
      if (inProgress) return;

      setLoading(true);

      window.ABMT.api.post('/api/auth/logout')
        .then(function () {
          // Đăng xuất thành công: quay về trang login, không cho Back về account
          window.location.replace('/login');
        })
        .catch(function (error) {
          // Lỗi 401 (đã hết phiên) vẫn chuyển về /login
          if (error && (error.status === 401 || error.code === 401)) {
            window.location.replace('/login');
            return;
          }
          ABMT.toast.fromError(error);
          setLoading(false);
        });
    });
  }
})();
