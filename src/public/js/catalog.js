(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(initCatalog);

  function initCatalog() {
    const filterForm = document.querySelector('#filter-form');
    if (!filterForm) return;

    const filterToggle = document.querySelector('#filter-toggle');
    const filterDrawer = document.querySelector('#filter-drawer');
    const filterOverlay = document.querySelector('#filter-overlay');
    const filterClose = document.querySelector('#filter-close');
    const body = document.body;

    if (filterToggle && filterDrawer && filterOverlay) {
      const closeDrawer = () => {
        filterDrawer.classList.remove('is-open');
        filterOverlay.classList.remove('is-open');
        body.classList.remove('no-scroll');
        filterToggle.setAttribute('aria-expanded', 'false');
      };
      filterToggle.addEventListener('click', () => {
        filterDrawer.classList.add('is-open');
        filterOverlay.classList.add('is-open');
        body.classList.add('no-scroll');
        filterToggle.setAttribute('aria-expanded', 'true');
      });
      if (filterClose) filterClose.addEventListener('click', (e) => { e.preventDefault(); closeDrawer(); });
      filterOverlay.addEventListener('click', closeDrawer);
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
      const mq = window.matchMedia('(min-width: 768px)');
      const handleMq = () => { if (mq.matches) closeDrawer(); };
      if (mq.addEventListener) mq.addEventListener('change', handleMq);
      else if (mq.addListener) mq.addListener(handleMq);
    }

    const minInput = document.querySelector('#price-min');
    const maxInput = document.querySelector('#price-max');
    const range = document.querySelector('#price-range');

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
    function syncRange() {
      if (!range) return;
      const min = parseInt(range.min || '0', 10);
      const max = parseInt(range.max || '1000000', 10);
      const a = clamp(parseInt((minInput && minInput.value) || '0', 10) || 0, min, max);
      const b = clamp(parseInt((maxInput && maxInput.value) || String(max), 10) || max, min, max);
      range.value = String(Math.min(a, b));
    }
    if (minInput) minInput.addEventListener('input', syncRange);
    if (maxInput) maxInput.addEventListener('input', syncRange);
    if (range) range.addEventListener('input', () => { if (minInput) minInput.value = range.value; });

    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(filterForm);
      const params = new URLSearchParams();
      for (const [key, value] of fd.entries()) {
        const v = String(value || '').trim();
        if (!v) continue;
        if (key === 'minPrice' || key === 'maxPrice') {
          const n = parseInt(v, 10);
          if (!Number.isFinite(n) || n <= 0) continue;
          params.set(key, String(n));
          continue;
        }
        params.set(key, v);
      }
      const base = filterForm.getAttribute('action') || '/catalog';
      const qs = params.toString();
      window.location.href = qs ? base + '?' + qs : base;
    });
  }
})();
