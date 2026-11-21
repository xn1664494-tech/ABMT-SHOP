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
    var buttons = document.querySelectorAll('button[data-toggle-password]');
    for (var i = 0; i < buttons.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var group = btn.closest('.input-group');
          if (!group) return;
          var input = group.querySelector('input');
          if (!input) return;
          var showing = input.type === 'text';
          input.type = showing ? 'password' : 'text';
          btn.setAttribute('aria-pressed', showing ? 'false' : 'true');
          btn.setAttribute('aria-label', showing ? 'Hiện mật khẩu' : 'Ẩn mật khẩu');
          var svgs = group.querySelectorAll('svg');
          for (var j = 0; j < svgs.length; j++) {
            svgs[j].toggleAttribute('hidden');
          }
        });
      })(buttons[i]);
    }
  });
})();
