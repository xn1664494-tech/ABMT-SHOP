// Mở/đóng menu mobile và slider banner đơn giản
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.getElementById('menu-toggle');
  var nav = document.getElementById('site-nav');
  var closeBtn = document.getElementById('menu-close');
  var overlay = document.getElementById('nav-overlay');

  function openMenu() {
    if (!nav) return;
    nav.classList.add('is-open');
    if (overlay) overlay.classList.add('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function closeMenu() {
    if (!nav) return;
    nav.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle) toggle.addEventListener('click', openMenu);
  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  if (overlay) overlay.addEventListener('click', closeMenu);

  var links = document.querySelectorAll('.nav-link');
  links.forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  // Slider banner
  var slides = document.querySelectorAll('.banner-slide');
  var dots = document.querySelectorAll('.banner-dot');
  var current = 0;

  function showSlide(index) {
    if (!slides.length) return;
    slides[current].classList.remove('is-active');
    if (dots[current]) dots[current].classList.remove('is-active');
    current = index;
    slides[current].classList.add('is-active');
    if (dots[current]) dots[current].classList.add('is-active');
  }

  dots.forEach(function (dot) {
    dot.addEventListener('click', function () {
      var idx = parseInt(dot.getAttribute('data-slide'), 10);
      if (!isNaN(idx)) showSlide(idx);
    });
  });

  if (slides.length > 1) {
    setInterval(function () {
      var next = (current + 1) % slides.length;
      showSlide(next);
    }, 4000);
  }
});
