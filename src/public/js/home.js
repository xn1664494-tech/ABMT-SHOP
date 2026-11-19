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
    initCarouselArrows();
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

  function initCarouselArrows() {
    const sections = ['#section-sale', '#section-bestseller'];
    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const useSmooth = !reducedMq.matches;

    function scrollBy(delta) {
      track.scrollBy({ left: delta, behavior: useSmooth ? 'smooth' : 'auto' });
    }

    sections.forEach(function (sectionId) {
      const section = document.querySelector(sectionId);
      if (!section) return;

      const carousel = section.querySelector('.carousel');
      if (!carousel) return;

      const track = carousel.querySelector('.carousel-track');
      if (!track) return;

      const prevArrow = carousel.querySelector('.carousel-arrow--prev');
      const nextArrow = carousel.querySelector('.carousel-arrow--next');
      if (!prevArrow || !nextArrow) return;

      function updateArrows() {
        if (track.scrollWidth <= track.clientWidth) {
          prevArrow.hidden = true;
          nextArrow.hidden = true;
          prevArrow.disabled = true;
          nextArrow.disabled = true;
          prevArrow.setAttribute('aria-disabled', 'true');
          nextArrow.setAttribute('aria-disabled', 'true');
          return;
        }
        prevArrow.hidden = false;
        nextArrow.hidden = false;

        if (track.scrollLeft <= 2) {
          prevArrow.disabled = true;
          prevArrow.setAttribute('aria-disabled', 'true');
        } else {
          prevArrow.disabled = false;
          prevArrow.removeAttribute('aria-disabled');
        }

        if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 2) {
          nextArrow.disabled = true;
          nextArrow.setAttribute('aria-disabled', 'true');
        } else {
          nextArrow.disabled = false;
          nextArrow.removeAttribute('aria-disabled');
        }
      }

      updateArrows();

      const onScroll = function () {
        requestAnimationFrame(updateArrows);
      };
      track.addEventListener('scroll', onScroll);

      prevArrow.addEventListener('click', function (e) {
        e.preventDefault();
        scrollBy(-track.clientWidth * 0.85);
      });

      nextArrow.addEventListener('click', function (e) {
        e.preventDefault();
        scrollBy(track.clientWidth * 0.85);
      });

      function onResize() {
        updateArrows();
      }
      window.addEventListener('resize', onResize);
    });
  }

  function initVoucherCopy() {
    const vouchersSection = document.getElementById('section-vouchers');
    if (!vouchersSection) return;

    const originalTexts = new WeakMap();

    function tryCopyText(text) {
      text = text.trim();
      if (!navigator.clipboard) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } catch (e) {
          document.body.removeChild(textarea);
          return false;
        }
        document.body.removeChild(textarea);
        return true;
      }
      return navigator.clipboard.writeText(text);
    }

    function showToast(message) {
      if (window.ABMT && window.ABMT.toast) {
        window.ABMT.toast.success(message);
      }
    }

    function handleCopyClick(event) {
      const button = event.target.closest('.voucher-copy');
      if (!button) return;

      const code = button.getAttribute('data-code');
      if (!code) {
        const codeEl = button.closest('.voucher-card').querySelector('.voucher-code');
        if (codeEl) {
          code = codeEl.textContent;
        }
      }
      if (!code) return;

      const alreadyCopied = originalTexts.get(button);
      if (alreadyCopied) return;

      const success = tryCopyText(code);
      if (success) {
        originalTexts.set(button, true);
        const original = button.textContent;
        button.textContent = 'Đã sao chép';
        setTimeout(function () {
          button.textContent = original;
        }, 1800);
        showToast('Đã sao chép mã ' + code);
      } else {
        showToast('Không sao chép được, hãy chép mã thủ công.');
      }
    }

    vouchersSection.addEventListener('click', handleCopyClick);
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

    if (n < 2) {
      if (dotsWrap) dotsWrap.hidden = true;
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

    var prevArrow = document.getElementById('banner-prev');
    var nextArrow = document.getElementById('banner-next');
    if (prevArrow && nextArrow) {
      prevArrow.addEventListener('click', function () {
        go(current - 1);
      });
      nextArrow.addEventListener('click', function () {
        go(current + 1);
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
      var nextTarget = null;
      // focusout: nếu focus rời hẳn slider thì tiếp tục
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
})();
