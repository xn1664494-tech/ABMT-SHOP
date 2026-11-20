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

  function initCarousels() {
    // Find all elements with [data-carousel]
    const carousels = document.querySelectorAll('[data-carousel]');
    carousels.forEach(function (carouselContainer) {
      // Find the actual scroll element (.carousel-track preferred, then .carousel)
      const track = carouselContainer.querySelector('.carousel-track') || carouselContainer.querySelector('.carousel');
      if (!track) return;

      // Get visible width
      function getVisibleWidth() {
        return track.clientWidth;
      }

      // Scroll amount
      function scrollBy(delta, useSmooth) {
        const behavior = useSmooth ? 'smooth' : 'auto';
        track.scrollBy({ left: delta, behavior: behavior });
      }

      // Check if content can be scrolled
      const canScroll = track.scrollWidth > track.clientWidth;

      // Prev button
      const prevBtn = carouselContainer.querySelector('[data-carousel-prev]');
      // Next button
      const nextBtn = carouselContainer.querySelector('[data-carousel-next]');

      // Update button states
      function updateButtons() {
        const scrollLeft = track.scrollLeft;
        const width = track.clientWidth;
        const scrollWidth = track.scrollWidth;

        if (prevBtn) {
          if (scrollLeft <= 2) {
            prevBtn.disabled = true;
            prevBtn.setAttribute('aria-disabled', 'true');
          } else {
            prevBtn.disabled = false;
            prevBtn.removeAttribute('aria-disabled');
          }
        }

        if (nextBtn) {
          if (scrollLeft + width >= scrollWidth - 2) {
            nextBtn.disabled = true;
            nextBtn.setAttribute('aria-disabled', 'true');
          } else {
            nextBtn.disabled = false;
            nextBtn.removeAttribute('aria-disabled');
          }
        }

        // If content doesn't scroll, hide both buttons
        if (!canScroll) {
          if (prevBtn) { prevBtn.hidden = true; prevBtn.disabled = true; }
          if (nextBtn) { nextBtn.hidden = true; nextBtn.disabled = true; }
        } else {
          if (prevBtn) { prevBtn.hidden = false; }
          if (nextBtn) { nextBtn.hidden = false; }
        }
      }

      // Click handler for prev
      if (prevBtn) {
        prevBtn.addEventListener('click', function (e) {
          e.preventDefault();
          scrollBy(-getVisibleWidth() * 0.85, true);
        });
      }

      // Click handler for next
      if (nextBtn) {
        nextBtn.addEventListener('click', function (e) {
          e.preventDefault();
          scrollBy(getVisibleWidth() * 0.85, true);
        });
      }

      // Update on scroll
      track.addEventListener('scroll', updateButtons);

      // Update on resize (debounced)
      let resizeTimeout;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(updateButtons, 100);
      });

      // Initial update
      updateButtons();
    });
  }

})();
