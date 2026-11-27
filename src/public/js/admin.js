(function () {
  'use strict';

  function cssVar(name) {
    var value = window.getComputedStyle(document.documentElement).getPropertyValue(name);
    return value ? value.trim() : '';
  }

  /* === Sidebar === */
  function initSidebar() {
    var sidebar = document.getElementById('sb');
    var toggle = document.getElementById('tg');
    var scrim = document.getElementById('scrim');
    if (!sidebar || !toggle) return;

    function openSidebar() {
      sidebar.classList.add('is-open');
      if (scrim) scrim.classList.add('is-open');
      document.body.classList.add('no-scroll');
      toggle.setAttribute('aria-expanded', 'true');
    }

    function closeSidebar() {
      sidebar.classList.remove('is-open');
      if (scrim) scrim.classList.remove('is-open');
      document.body.classList.remove('no-scroll');
      toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () {
      if (sidebar.classList.contains('is-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    if (scrim) scrim.addEventListener('click', closeSidebar);

    var closeBtn = sidebar.querySelector('[data-adm-close]') || sidebar.querySelector('.admin-side-close');
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

    sidebar.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeSidebar();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeSidebar();
    });

    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 1024px)');
      var onChange = function (event) {
        if (event.matches) closeSidebar();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* === Logout === */
  function initLogout() {
    var button = document.querySelector('[data-adm-logout]');
    if (!button || !window.ABMT || !window.ABMT.api) return;

    var inProgress = false;

    button.addEventListener('click', function () {
      if (inProgress) return;
      inProgress = true;
      button.disabled = true;

      window.ABMT.api.post('/api/auth/logout')
        .then(function () {
          window.location.replace('/login');
        })
        .catch(function (error) {
          if (error && (error.status === 401 || error.code === 401)) {
            window.location.replace('/login');
            return;
          }
          if (window.ABMT.toast) window.ABMT.toast.fromError(error);
          inProgress = false;
          button.disabled = false;
        });
    });
  }

  /* === Charts === */
  var charts = Object.create(null);

  function readChartData() {
    var el = document.getElementById('admin-chart-data');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || '{}');
    } catch (error) {
      return null;
    }
  }

  function seriesOf(source) {
    if (!source || typeof source !== 'object') return null;
    var labels = Array.isArray(source.labels) ? source.labels : [];
    var values = Array.isArray(source.data)
      ? source.data
      : Array.isArray(source.values)
        ? source.values
        : [];
    if (labels.length === 0 || values.length === 0) return null;
    return { labels: labels, values: values.map(function (v) { return Number(v) || 0; }) };
  }

  function showChartFallback(canvas, message) {
    if (!canvas) return;
    var box = canvas.parentNode;
    canvas.hidden = true;
    if (!box) return;
    var fallback = box.querySelector('[data-chart-fallback]');
    if (!fallback) {
      fallback = document.createElement('p');
      fallback.className = 'chart-fallback';
      fallback.setAttribute('data-chart-fallback', '');
      box.appendChild(fallback);
    }
    fallback.textContent = message;
    fallback.hidden = false;
  }

  function showChartCanvas(canvas) {
    if (!canvas) return;
    canvas.hidden = false;
    var box = canvas.parentNode;
    if (!box) return;
    var fallback = box.querySelector('[data-chart-fallback]');
    if (fallback) fallback.hidden = true;
  }

  function formatCompact(value) {
    var number = Number(value) || 0;
    if (number >= 1000000000) return (number / 1000000000).toFixed(1) + ' tỷ';
    if (number >= 1000000) return (number / 1000000).toFixed(0) + ' tr';
    if (number >= 1000) return (number / 1000).toFixed(0) + ' k';
    return String(number);
  }

  function initCharts() {
    var revenueCanvas = document.getElementById('chart');
    var donutCanvas = document.getElementById('donut');
    if (!revenueCanvas && !donutCanvas) return;

    var data = readChartData();
    if (!window.Chart) {
      showChartFallback(revenueCanvas, 'Không tải được thư viện biểu đồ.');
      showChartFallback(donutCanvas, 'Không tải được thư viện biểu đồ.');
      return;
    }

    var colors = {
      ink: cssVar('--ink-soft') || '#5f6773',
      inkStrong: cssVar('--ink-strong') || '#2a2f36',
      line: cssVar('--line') || '#e3e6ea',
      surface: cssVar('--surface') || '#f7f4ee',
      accent: cssVar('--accent') || '#e8c987',
      accentDeep: cssVar('--accent-deep') || '#a97a24',
      danger: cssVar('--danger') || '#b3261e',
      sky: cssVar('--sky') || '#cfe3f3',
      lilac: cssVar('--lilac') || '#e2d7f2',
      sand: cssVar('--sand') || '#efe3cf',
    };

    window.Chart.defaults.color = colors.ink;
    window.Chart.defaults.borderColor = colors.line;

    if (revenueCanvas) {
      var revenue = data ? seriesOf(data.revenue) || seriesOf(data.chart) || seriesOf(data.orders) : null;
      if (!revenue) {
        showChartFallback(revenueCanvas, 'Chưa có dữ liệu để vẽ biểu đồ.');
      } else {
        showChartCanvas(revenueCanvas);
        if (charts.revenue) charts.revenue.destroy();
        charts.revenue = new window.Chart(revenueCanvas, {
          type: 'bar',
          data: {
            labels: revenue.labels,
            datasets: [
              {
                label: 'Doanh thu',
                data: revenue.values,
                backgroundColor: colors.accentDeep,
                borderRadius: 6,
                maxBarThickness: 42,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return formatCompact(context.parsed.y) + ' ₫';
                  },
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: colors.ink },
              },
              y: {
                beginAtZero: true,
                grid: { color: colors.line },
                ticks: {
                  color: colors.ink,
                  callback: function (value) { return formatCompact(value); },
                },
              },
            },
          },
        });
      }
    }

    if (donutCanvas) {
      var donut = data ? seriesOf(data.donut) : null;
      var total = donut ? donut.values.reduce(function (sum, v) { return sum + v; }, 0) : 0;
      if (!donut || total <= 0) {
        showChartFallback(donutCanvas, 'Chưa có dữ liệu để vẽ biểu đồ.');
      } else {
        showChartCanvas(donutCanvas);
        if (charts.donut) charts.donut.destroy();
        charts.donut = new window.Chart(donutCanvas, {
          type: 'doughnut',
          data: {
            labels: donut.labels,
            datasets: [
              {
                data: donut.values,
                backgroundColor: [
                  colors.accentDeep,
                  colors.danger,
                  colors.ink,
                  colors.sky,
                  colors.lilac,
                  colors.sand,
                ],
                borderColor: colors.surface,
                borderWidth: 2,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: colors.inkStrong, boxWidth: 12, padding: 12 },
              },
            },
          },
        });
      }
    }
  }

  /* === Variants === */
  function initVariants() {
    var form = document.getElementById('pForm');
    var rowsEl = document.getElementById('variant-rows');
    var tpl = document.getElementById('variant-row-tpl');
    var addBtn = document.getElementById('addVariant');
    if (!form || !rowsEl) return;

    function getRows() {
      return Array.prototype.slice.call(rowsEl.querySelectorAll('.variant-row'));
    }

    function fieldOf(row, name) {
      return row.querySelector('[data-field="' + name + '"]');
    }

    function getErrorEl(row) {
      var el = row.querySelector('.variant-error');
      if (!el) {
        el = document.createElement('p');
        el.className = 'variant-error';
        row.appendChild(el);
      }
      return el;
    }

    function reindex() {
      getRows().forEach(function (row, index) {
        row.dataset.index = String(index);
        Array.prototype.forEach.call(row.querySelectorAll('[data-field]'), function (input) {
          input.name = 'variants[' + index + '][' + input.dataset.field + ']';
        });
      });
    }

    function syncRemoveButtons() {
      var rows = getRows();
      rows.forEach(function (row) {
        var btn = row.querySelector('[data-remove-variant]');
        if (btn) btn.disabled = rows.length <= 1;
      });
    }

    function clearRowError(row) {
      row.classList.remove('has-error');
      var errorEl = row.querySelector('.variant-error');
      if (errorEl) errorEl.textContent = '';
      Array.prototype.forEach.call(row.querySelectorAll('[aria-invalid="true"]'), function (input) {
        input.removeAttribute('aria-invalid');
      });
    }

    function isNonNegativeInteger(value) {
      return /^\d+$/.test(String(value));
    }

    var SKU_PATTERN = /^SP-(AO|QU|VY|DM|PK|GD|TN)-\d{3}-[A-Z0-9]{1,5}-[A-Z0-9]{1,10}$/;

    function validateRow(row) {
      var messages = [];
      var color = fieldOf(row, 'color');
      var size = fieldOf(row, 'size');
      var sku = fieldOf(row, 'sku');
      var price = fieldOf(row, 'price');
      var stock = fieldOf(row, 'stock');

      if (!color || color.value.trim() === '') messages.push('Nhập màu sắc.');
      if (!size || size.value.trim() === '') messages.push('Nhập kích cỡ.');
      if (!sku || !SKU_PATTERN.test(sku.value.trim().toUpperCase())) {
        messages.push('SKU không đúng định dạng SP-{CAT}-{NNN}-{SIZE}-{COLOR}.');
      }
      if (stock && stock.value !== '' && !isNonNegativeInteger(stock.value)) {
        messages.push('Tồn kho phải là số nguyên không âm.');
      }
      if (price && price.value !== '' && !isNonNegativeInteger(price.value)) {
        messages.push('Giá phải là số nguyên không âm.');
      }

      return {
        row: row,
        messages: messages,
        color: color ? color.value.trim() : '',
        size: size ? size.value.trim() : '',
        stock: stock,
      };
    }

    function validateVariants() {
      var rows = getRows();
      if (rows.length === 0) {
        if (window.ABMT && window.ABMT.toast) {
          window.ABMT.toast.error('Sản phẩm phải có ít nhất một biến thể.');
        }
        return false;
      }

      var entries = rows.map(validateRow);
      var keyMap = Object.create(null);

      entries.forEach(function (entry) {
        if (entry.color && entry.size) {
          var key = entry.size.toUpperCase() + '__' + entry.color.toLowerCase();
          if (!keyMap[key]) keyMap[key] = [];
          keyMap[key].push(entry);
        }
      });

      Object.keys(keyMap).forEach(function (key) {
        if (keyMap[key].length > 1) {
          keyMap[key].forEach(function (entry) {
            entry.messages.push('Biến thể trùng Size/Màu.');
          });
        }
      });

      var firstInvalid = null;
      entries.forEach(function (entry) {
        var errorEl = getErrorEl(entry.row);
        clearRowError(entry.row);

        if (entry.messages.length > 0) {
          entry.row.classList.add('has-error');
          errorEl.textContent = entry.messages.join(' ');
          Array.prototype.forEach.call(entry.row.querySelectorAll('[data-field]'), function (input) {
            input.setAttribute('aria-invalid', 'true');
          });
          if (!firstInvalid) firstInvalid = entry.row;
        }

        if (entry.stock && entry.stock.value === '') entry.stock.value = '0';
      });

      if (firstInvalid) {
        var focusable = firstInvalid.querySelector('[data-field][aria-invalid="true"]') || firstInvalid;
        focusable.focus();
        return false;
      }
      return true;
    }

    reindex();
    syncRemoveButtons();

    if (addBtn && tpl) {
      addBtn.addEventListener('click', function () {
        var node = tpl.content && tpl.content.firstElementChild
          ? tpl.content.firstElementChild.cloneNode(true)
          : null;
        if (!node) return;
        rowsEl.appendChild(node);
        reindex();
        syncRemoveButtons();
        var firstInput = node.querySelector('[data-field]');
        if (firstInput) firstInput.focus();
      });
    }

    rowsEl.addEventListener('click', function (event) {
      var btn = event.target.closest('[data-remove-variant]');
      if (!btn) return;
      var row = btn.closest('.variant-row');
      if (!row) return;
      if (getRows().length <= 1) {
        if (window.ABMT && window.ABMT.toast) {
          window.ABMT.toast.error('Sản phẩm phải có ít nhất một biến thể.');
        }
        return;
      }
      row.parentNode.removeChild(row);
      reindex();
      syncRemoveButtons();
    });

    form.addEventListener('input', function (event) {
      var input = event.target.closest('[data-integer]');
      if (!input) return;
      var cleaned = input.value.replace(/[^\d]/g, '');
      if (cleaned !== input.value) input.value = cleaned;
      var row = input.closest('.variant-row');
      if (row) clearRowError(row);
    });

    form.addEventListener('keydown', function (event) {
      var input = event.target.closest('[data-integer]');
      if (!input) return;
      if (['-', '+', '.', ',', 'e', 'E'].indexOf(event.key) !== -1) {
        event.preventDefault();
      }
    });

    function collectProductPayload() {
      var nameEl = form.querySelector('[name="name"]');
      var categoryEl = form.querySelector('[name="category"]');
      var priceEl = form.querySelector('[name="basePrice"]');
      var descEl = form.querySelector('[name="description"]');

      var variants = getRows().map(function (row) {
        function read(field) {
          var el = fieldOf(row, field);
          return el ? String(el.value).trim() : '';
        }
        var priceRaw = read('price');
        var stockRaw = read('stock');
        return {
          color: read('color'),
          size: read('size').toUpperCase(),
          sku: read('sku').toUpperCase(),
          price: priceRaw === '' ? null : Number(priceRaw),
          stock: stockRaw === '' ? 0 : Number(stockRaw),
        };
      });

      return {
        name: nameEl ? nameEl.value.trim() : '',
        category: categoryEl ? categoryEl.value : '',
        basePrice: priceEl ? Number(String(priceEl.value).trim()) : 0,
        description: descEl ? descEl.value.trim() : '',
        images: [],
        variants: variants,
        isActive: true,
      };
    }

    function submitProduct(button) {
      var payload = collectProductPayload();
      var request = function () {
        return window.ABMT.api.post('/api/products', payload);
      };
      var action = button && window.ABMT.loading
        ? window.ABMT.loading.wrap(button, request)
        : request();

      Promise.resolve(action)
        .then(function () {
          if (window.ABMT && window.ABMT.toast) {
            window.ABMT.toast.success('Đã tạo sản phẩm.');
          }
          window.setTimeout(function () {
            window.location.href = '/admin';
          }, 450);
        })
        .catch(function (error) {
          if (window.ABMT && window.ABMT.toast) {
            window.ABMT.toast.fromError(error);
          }
        });
    }

    form.addEventListener('submit', function (event) {
      reindex();
      if (!validateVariants()) {
        event.preventDefault();
        return;
      }
      if (form.dataset.api !== 'json') return;
      event.preventDefault();
      submitProduct(event.submitter || form.querySelector('button[type="submit"]'));
    });
  }

  initSidebar();
  initLogout();
  initCharts();
  initVariants();
})();
