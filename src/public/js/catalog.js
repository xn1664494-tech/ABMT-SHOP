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
    initCatalog();
  });

  /**
   * Catalog initialization
   * Exits early if no filter form exists
   */
  function initCatalog() {
    const filterForm = document.querySelector('#filter-form, #catalog-filter, form[action*="catalog"]');
    if (!filterForm) return;

    // ── Drawer mobile filter ────────────────────────────────────────
    const filterToggle = document.querySelector('#filter-toggle, #fOpen');
    const filterDrawer = document.querySelector('#filter-drawer, #drawer');
    const filterOverlay = document.querySelector('#filter-overlay, #scrim');
    const filterClose = document.querySelector('#filter-close, #fClose');
    const body = document.body;

    if (filterToggle && filterDrawer && filterOverlay) {
      let drawerOpen = false;

      function openDrawer() {
        if (drawerOpen) return;
        drawerOpen = true;
        filterDrawer.classList.add('is-open');
        filterOverlay.classList.add('is-open');
        body.classList.add('no-scroll');
        filterToggle.setAttribute('aria-expanded', 'true');
        filterToggle.focus();
      }

      function closeDrawer(restoreFocus = true) {
        if (!drawerOpen) return;
        drawerOpen = false;
        filterDrawer.classList.remove('is-open');
        filterOverlay.classList.remove('is-open');
        body.classList.remove('no-scroll');
        filterToggle.setAttribute('aria-expanded', 'false');
        if (restoreFocus) {
          filterToggle.focus();
        }
      }

      filterToggle.addEventListener('click', openDrawer);

      filterClose.addEventListener('click', function (e) {
        e.stopPropagation();
        closeDrawer(true);
      });

      filterOverlay.addEventListener('click', function () {
        closeDrawer(true);
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          if (drawerOpen) closeDrawer(true);
        }
      });

      // Close from 768px Up
      const mq = window.matchMedia('(min-width: 768px)');
      function handleMqChange() {
        if (mq.matches && drawerOpen) {
          closeDrawer(false);
        }
      }
      if (mq.addEventListener) {
        mq.addEventListener('change', handleMqChange);
      } else if (mq.addListener) {
        mq.addListener(handleMqChange);
      }
    }

    // ── Price range slider ──────────────────────────────────────────
    const priceSlider = document.querySelector('#price-slider, #price-range');
    const priceMinInput = document.querySelector('#price-min, #min-price');
    const priceMaxInput = document.querySelector('#price-max, #max-price');
    const priceTrack = document.querySelector('#price-track');
    const priceHandle = document.querySelector('#price-handle');

    if (priceSlider) {
      // Default values - server will set via data attributes or use sensible defaults
      let minVal = parseInt(priceSlider.getAttribute('data-min') || '0');
      let maxVal = parseInt(priceSlider.getAttribute('data-max') || '1000000');
      let step = parseInt(priceSlider.getAttribute('data-step') || '1000');

      // UI elements fallback
      if (!priceMinInput) priceMinInput = document.querySelector('input[name="price_min"]');
      if (!priceMaxInput) priceMaxInput = document.querySelector('input[name="price_max"]');

      function clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
      }

      function updateInputsFromSlider() {
        if (priceMinInput && priceMaxInput) {
          priceMinInput.value = Math.round(priceSlider.value);
          priceMaxInput.value = Math.round(priceSlider.max - 0);
        }
      }

      function updateSliderFromInput(min, max) {
        // Ensure integer
        const intMin = Math.round(min);
        const intMax = Math.round(max);
        priceSlider.value = intMin;
        if (priceMaxInput) priceMaxInput.value = intMax;
        // Swap if min > max
        if (intMin > intMax) {
          priceMinInput.value = intMax;
          priceMaxInput.value = intMin;
          priceSlider.value = intMax; // set max to the higher value
          ABMT.toast.error('Giá min không được lớn hơn giá max');
        }
      }

      // Initialize slider
      if (priceTrack && priceHandle) {
        priceTrack.style.width = '100%';
        priceHandle.style.left = '0%';
      }

      // Sync inputs → slider
      if (priceMinInput) {
        priceMinInput.addEventListener('change', function () {
          let val = parseInt(this.value) || 0;
          val = clamp(val, 0, maxVal);
          this.value = val;
          if (priceMaxInput && parseInt(priceMaxInput.value) < val) {
            priceMaxInput.value = val;
          }
          updateSliderFromInput(val, parseInt(priceMaxInput.value) || maxVal);
        });
      }
      if (priceMaxInput) {
        priceMaxInput.addEventListener('change', function () {
          let val = parseInt(this.value) || maxVal;
          val = clamp(val, minVal, 1000000);
          this.value = val;
          if (priceMinInput && parseInt(priceMinInput.value) > val) {
            priceMinInput.value = val;
            ABMT.toast.error('Giá min không được lớn hơn giá max');
          }
          updateSliderFromInput(parseInt(priceMinInput.value) || minVal, val);
        });
      }

      // Slider input
      if (priceSlider) {
        priceSlider.addEventListener('input', function () {
          const val = parseInt(this.value) || 0;
          this.value = val;
          if (priceMinInput) priceMinInput.value = val;
          if (priceMaxInput) priceMaxInput.value = Math.round(parseFloat(priceSlider.max) || 1000000);
        });
      }
    }

    // ── Filter form submit ──────────────────────────────────────────
    const submitBtn = filterForm.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', function (e) {
        // Form will submit normally via GET; we just ensure no empty defaults
        const formData = new FormData(filterForm);
        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
          if (value && value !== '') {
            params.append(key, value);
          }
        }
        // Remove minPrice/maxPrice if equal to default/empty
        if (params.has('minPrice')) {
          const pm = parseInt(params.get('minPrice'), 10);
          if (isNaN(pm) || pm === 0) params.delete('minPrice');
        }
        if (params.has('maxPrice')) {
          const pm = parseInt(params.get('maxPrice'), 10);
          if (isNaN(pm) || pm === 0) params.delete('maxPrice');
        }

        // Build URL with params, reset page to 1
        const baseUrl = filterForm.action.split('?')[0];
        let newUrl = baseUrl + '?' + params.toString() + '&page=1';
        // Remove trailing &
        if (newUrl.endsWith('&page=1')) {
          newUrl = newUrl.slice(0, -5);
        }
        // If there are no params, go to base (clear filters)
        if (!params.toString()) {
          newUrl = baseUrl;
        }
        window.location.href = newUrl;
      });
    }

    // ── Pagination links ────────────────────────────────────────────
    const paginatedLinks = filterForm.querySelectorAll('a.pagination-link, a.page-link');
    paginatedLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        // Keep existing filter/sort params, only change page
        const href = this.getAttribute('href');
        if (!href) return;

        const url = new URL(href, window.location.origin);
        // Remove existing page param, then set new one
        url.searchParams.delete('page');
        url.searchParams.set('page', '1'); // default, will be overridden by link text

        // Extract page from link text or href query
        const linkPage = url.searchParams.get('page');
        if (linkPage) {
          // Already has page from server params in href, just use it
          window.location.href = url.toString();
        } else {
          // No page param in href, append page=1
          url.searchParams.set('page', '1');
          window.location.href = url.toString();
        }
      });
    });

    // ── Clear filters button ────────────────────────────────────────
    const clearBtn = document.querySelector('#clear-filters, #reset-filters');
    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        window.location.href = filterForm.action;
      });
    }
  }

})();