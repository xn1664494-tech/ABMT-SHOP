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

    const priceArea = document.querySelector('[data-price-range]');
    const minInput = document.querySelector('#price-min');
    const maxInput = document.querySelector('#price-max');
    const minRange = document.querySelector('#price-min-range');
    const maxRange = document.querySelector('#price-max-range');
    const fill = priceArea && priceArea.querySelector('.price-track-fill');

    if (priceArea && minInput && maxInput && minRange && maxRange) {
      const boundMin = Number(priceArea.dataset.min || 0);
      const boundMax = Number(priceArea.dataset.max || 1000000);
      const step = Number(priceArea.dataset.step || 10000);

      const parseMoney = (value) => {
        const digits = String(value || '').replace(/[^\d]/g, '');
        return digits ? Number(digits) : null;
      };
      const formatMoney = (value) => `${Number(value).toLocaleString('vi-VN')}₫`;
      const clamp = (value) => Math.max(boundMin, Math.min(boundMax, value));
      const roundStep = (value) => Math.round(value / step) * step;
      const read = (input, fallback) => {
        const parsed = parseMoney(input.value);
        return parsed === null ? fallback : clamp(parsed);
      };

      function paint() {
        let low = read(minInput, boundMin);
        let high = read(maxInput, boundMax);
        if (low > high) {
          const swap = low;
          low = high;
          high = swap;
          minInput.value = formatMoney(low);
          maxInput.value = formatMoney(high);
        }
        minRange.value = String(low);
        maxRange.value = String(high);
        if (fill) {
          const span = Math.max(1, boundMax - boundMin);
          fill.style.left = `${((low - boundMin) / span) * 100}%`;
          fill.style.width = `${((high - low) / span) * 100}%`;
        }
      }

      function fromRange(source) {
        let low = Number(minRange.value);
        let high = Number(maxRange.value);
        if (source === minRange && low > high) low = high;
        if (source === maxRange && high < low) high = low;
        minRange.value = String(clamp(low));
        maxRange.value = String(clamp(high));
        if (low <= boundMin && source === minRange && parseMoney(minInput.value) === null) minInput.value = '';
        else minInput.value = formatMoney(roundStep(low));
        if (high >= boundMax && source === maxRange && parseMoney(maxInput.value) === null) maxInput.value = '';
        else maxInput.value = formatMoney(roundStep(high));
        paint();
      }

      minRange.addEventListener('input', () => fromRange(minRange));
      maxRange.addEventListener('input', () => fromRange(maxRange));
      minInput.addEventListener('input', paint);
      maxInput.addEventListener('input', paint);
      minInput.addEventListener('blur', () => {
        const value = parseMoney(minInput.value);
        minInput.value = value === null ? '' : formatMoney(value);
        paint();
      });
      maxInput.addEventListener('blur', () => {
        const value = parseMoney(maxInput.value);
        maxInput.value = value === null ? '' : formatMoney(value);
        paint();
      });
      paint();
    }

    filterForm.addEventListener('submit', function (e) {
      e.preventDefault();
      const fd = new FormData(filterForm);
      const params = new URLSearchParams();
      for (const [key, value] of fd.entries()) {
        const v = String(value || '').trim();
        if (!v) continue;
        if (key === 'minPrice' || key === 'maxPrice') {
          const n = Number(v.replace(/[^\d]/g, ''));
          if (!Number.isFinite(n) || n < 0) continue;
          if (n === 0 && key === 'minPrice') continue;
          params.set(key, String(n));
          continue;
        }
        params.set(key, v);
      }
      const min = params.get('minPrice');
      const max = params.get('maxPrice');
      if (min !== null && max !== null && Number(min) > Number(max)) {
        params.set('minPrice', max);
        params.set('maxPrice', min);
      }
      const base = filterForm.getAttribute('action') || '/catalog';
      const qs = params.toString();
      window.location.href = qs ? base + '?' + qs : base;
    });
  }
})();
