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
    initMenu();
    initBanner();
    initCarousels();
    initVoucherCopy();
  });

  function initMenu() {
    var toggle = document.getElementById('menu-toggle');
    var nav = document.getElementById('site-nav');
    var overlay = document.getElementById('nav-overlay');
    var closeBtn = document.getElementById('menu-close');
    if (!toggle || !nav || !overlay) return;

    var mq = window.matchMedia('(min-width: 768px)');
    var isOpen = false;

    function syncInert() {
      if (mq.matches) {
        nav.inert = false;
      } else {
        nav.inert = !isOpen;
      }
    }

    function openMenu() {
      if (isOpen) return;
      isOpen = true;
      nav.classList.add('is-open');
      overlay.classList.add('is-open');
      document.body.classList.add('no-scroll');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Đóng menu');
      syncInert();
      if (closeBtn) closeBtn.focus();
    }

    function closeMenu(restoreFocus) {
      var wasOpen = isOpen;
      if (!wasOpen) {
        syncInert();
        return;
      }
      isOpen = false;
      nav.classList.remove('is-open');
      overlay.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Mở menu');
      syncInert();
      if (restoreFocus) {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', function () {
      if (isOpen) {
        closeMenu(true);
      } else {
        openMenu();
      }
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeMenu(true);
      });
    }

    overlay.addEventListener('click', function () {
      closeMenu(true);
    });

    var navLinks = nav.querySelectorAll('.nav-link');
    for (var i = 0; i < navLinks.length; i++) {
      navLinks[i].addEventListener('click', function () {
        closeMenu(true);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' || e.key === 'Esc') {
        if (isOpen) closeMenu(true);
      }
    });

    function handleMqChange() {
      if (mq.matches && isOpen) {
        closeMenu(false);
      } else {
        syncInert();
      }
    }

    if (mq.addEventListener) {
      mq.addEventListener('change', handleMqChange);
    } else if (mq.addListener) {
      mq.addListener(handleMqChange);
    }

    syncInert();
  }

  function initBanner() {
    var slider = document.getElementById('banner-slider');
    var dotsWrap = document.getElementById('banner-dots');
    if (!slider) return;

    var slides = slider.querySelectorAll('.banner-slide');
    var dots = dotsWrap ? dotsWrap.querySelectorAll('.banner-dot') : [];
    var n = slides.length;
    if (n === 0) return;

    var current = 0;
    for (var i = 0; i < n; i++) {
      if (slides[i].classList.contains('is-active')) {
        current = i;
        break;
      }
    }

    function go(index) {
      if (n === 0) return;
      var next = ((index % n) + n) % n;
      for (var j = 0; j < n; j++) {
        slides[j].classList.remove('is-active');
        slides[j].setAttribute('aria-hidden', j === next ? 'false' : 'true');
      }
      for (var k = 0; k < dots.length; k++) {
        dots[k].classList.remove('is-active');
        dots[k].removeAttribute('aria-current');
      }
      slides[next].classList.add('is-active');
      slides[next].setAttribute('aria-hidden', 'false');
      if (dots[next]) {
        dots[next].classList.add('is-active');
        dots[next].setAttribute('aria-current', 'true');
      }
      current = next;
    }

    // đảm bảo trạng thái đồng bộ ban đầu
    go(current);

    var prevBtn = slider.querySelector('.banner-arrow--prev');
    var nextBtn = slider.querySelector('.banner-arrow--next');

    if (n < 2) {
      if (dotsWrap) dotsWrap.hidden = true;
      if (prevBtn) prevBtn.hidden = true;
      if (nextBtn) nextBtn.hidden = true;
      return;
    }

    var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var timer = null;
    var pausedHover = false;

    function canAuto() {
      return !reduceMq.matches && !pausedHover && !document.hidden;
    }

    function stopAuto() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (canAuto()) {
        timer = setInterval(function () {
          go(current + 1);
        }, 6000);
      }
    }

    for (var d = 0; d < dots.length; d++) {
      (function (dot) {
        dot.addEventListener('click', function () {
          var idx = parseInt(dot.getAttribute('data-slide'), 10);
          if (!isNaN(idx)) {
            go(idx);
            startAuto();
          }
        });
      })(dots[d]);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        go(current - 1);
        startAuto();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        go(current + 1);
        startAuto();
      });
    }

    slider.addEventListener('mouseenter', function () {
      pausedHover = true;
      stopAuto();
    });
    slider.addEventListener('mouseleave', function () {
      pausedHover = false;
      startAuto();
    });
    slider.addEventListener('focusin', function () {
      pausedHover = true;
      stopAuto();
    });
    slider.addEventListener('focusout', function () {
      setTimeout(function () {
        if (!slider.contains(document.activeElement)) {
          pausedHover = false;
          startAuto();
        }
      }, 0);
    });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopAuto();
      } else {
        startAuto();
      }
    });

    var touchStartX = 0;
    var touchStartY = 0;
    slider.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    }, { passive: true });
    slider.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStartX;
      var dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) {
          go(current - 1);
        } else {
          go(current + 1);
        }
        startAuto();
      }
    }, { passive: true });

    function handleReduceChange() {
      if (reduceMq.matches) {
        stopAuto();
      } else {
        startAuto();
      }
    }
    if (reduceMq.addEventListener) {
      reduceMq.addEventListener('change', handleReduceChange);
    } else if (reduceMq.addListener) {
      reduceMq.addListener(handleReduceChange);
    }

    startAuto();
  }

  function initCarousels() {
    const carousels = document.querySelectorAll('[data-carousel]');
    const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');

    carousels.forEach(function (carouselContainer) {
      const track = carouselContainer.querySelector('.carousel-track') || carouselContainer.querySelector('.carousel');
      if (!track) return;

      const prevBtn = carouselContainer.querySelector('[data-carousel-prev]');
      const nextBtn = carouselContainer.querySelector('[data-carousel-next]');

      function getVisibleWidth() {
        return track.clientWidth;
      }

      function scrollBy(delta) {
        const behavior = reduceMq.matches ? 'auto' : 'smooth';
        track.scrollBy({ left: delta, behavior: behavior });
      }

      function updateButtons() {
        const scrollLeft = track.scrollLeft;
        const width = track.clientWidth;
        const scrollWidth = track.scrollWidth;
        const canScroll = scrollWidth > width + 2;

        if (prevBtn) {
          if (!canScroll || scrollLeft <= 2) {
            prevBtn.disabled = true;
            prevBtn.setAttribute('aria-disabled', 'true');
          } else {
            prevBtn.disabled = false;
            prevBtn.removeAttribute('aria-disabled');
          }
          prevBtn.hidden = !canScroll;
        }

        if (nextBtn) {
          if (!canScroll || scrollLeft + width >= scrollWidth - 2) {
            nextBtn.disabled = true;
            nextBtn.setAttribute('aria-disabled', 'true');
          } else {
            nextBtn.disabled = false;
            nextBtn.removeAttribute('aria-disabled');
          }
          nextBtn.hidden = !canScroll;
        }
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', function (e) {
          e.preventDefault();
          scrollBy(-getVisibleWidth() * 0.85);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', function (e) {
          e.preventDefault();
          scrollBy(getVisibleWidth() * 0.85);
        });
      }

      track.addEventListener('scroll', updateButtons, { passive: true });
      window.addEventListener('resize', updateButtons);
      window.addEventListener('load', updateButtons);

      const images = track.querySelectorAll('img');
      images.forEach(function (img) {
        if (img.complete) {
          updateButtons();
        } else {
          img.addEventListener('load', updateButtons);
          img.addEventListener('error', updateButtons);
        }
      });

      updateButtons();
    });
  }

  function initVoucherCopy() {
    var buttons = document.querySelectorAll('[data-code].voucher-copy');
    for (var i = 0; i < buttons.length; i++) {
      (function (button) {
        var copyLabel = button.textContent;
        button.addEventListener('click', function () {
          var code = button.getAttribute('data-code') || '';
          if (!code) return;

          function notify(ok) {
            if (ok) {
              button.textContent = 'Đã sao chép';
              setTimeout(function () {
                button.textContent = copyLabel;
              }, 1800);
            }
            var toast = window.ABMT && window.ABMT.toast;
            if (!toast) return;
            var message = ok ? 'Đã sao chép mã ' + code : 'Không thể sao chép mã. Vui lòng thử lại.';
            if (ok) {
              toast.success(message);
            } else {
              toast.error(message);
            }
          }

          function fallbackCopy(text) {
            var input = document.createElement('textarea');
            input.value = text;
            input.setAttribute('readonly', '');
            input.style.position = 'fixed';
            input.style.opacity = '0';
            document.body.appendChild(input);
            input.select();
            var ok = false;
            try {
              ok = document.execCommand('copy');
            } catch (error) {
              ok = false;
            }
            document.body.removeChild(input);
            notify(ok);
          }

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code)
              .then(function () { notify(true); })
              .catch(function () { fallbackCopy(code); });
          } else {
            fallbackCopy(code);
          }
        });
      })(buttons[i]);
    }
  }

})();
