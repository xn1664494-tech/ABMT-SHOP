(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#2A2F36';
  }

  const CSS = {
    ink: getCssVar('--ink'),
    inkStrong: getCssVar('--ink-strong'),
    muted: getCssVar('--muted'),
    accent: getCssVar('--accent'),
    surface: getCssVar('--surface'),
    canvas: getCssVar('--canvas'),
  };

  ready(function () {
    initAdmin();
  });

  function initAdmin() {
    // ── (a) Sidebar mobile ────────────────────────────────────────
    (function () {
      var sb = document.getElementById('admin-sidebar');
      var togg = document.getElementById('sb-toggle');
      var main = document.getElementById('admin-main');
      var overlay = document.getElementById('sb-overlay');
      var closeBtn = document.getElementById('sb-close');
      var body = document.body;
      var mq = window.matchMedia('(min-width: 768px)');

      function openSb() {
        if (mq.matches) return;
        sb.style.left = '0';
        overlay.classList.add('is-open');
        body.classList.add('no-scroll');
        togg.setAttribute('aria-expanded', 'true');
      }

      function closeSb() {
        if (mq.matches) return;
        sb.style.left = '-260px';
        overlay.classList.remove('is-open');
        body.classList.remove('no-scroll');
        togg.setAttribute('aria-expanded', 'false');
      }

      if (togg) togg.addEventListener('click', openSb);
      if (closeBtn) closeBtn.addEventListener('click', closeSb);
      if (overlay) overlay.addEventListener('click', closeSb);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.key === 'Esc') {
          if (!mq.matches && sb.style.left !== '-260px') closeSb();
        }
      });
      if (mq.addEventListener) {
        mq.addEventListener('change', function () {
          if (mq.matches && sb.style.left !== '-260px') closeSb();
        });
      }
    })();

    // ── (b) Biểu đồ Chart.js ──────────────────────────────────────
    (function () {
      var chartDataEl = document.getElementById('admin-chart-data');
      var chartSection = document.getElementById('chart-section');

      if (!chartDataEl) {
        if (chartSection) {
          chartSection.innerHTML = '<p style="color: var(--muted);">Không có dữ liệu biểu đồ</p>';
        }
        return;
      }

      var chartData;
      try {
        chartData = JSON.parse(chartDataEl.textContent);
      } catch (e) {
        if (chartSection) {
          chartSection.innerHTML = '<p style="color: var(--muted);">Dữ liệu biểu đồ lỗi</p>';
        }
        return;
      }

      // Kiểm tra Chart.js có sẵn không
      if (typeof window.Chart === 'undefined') {
        if (chartSection) {
          chartSection.innerHTML =
            '<p style="color: var(--muted); font-size: 13px;">Thư viện Chart.js chưa được tải. ' +
            'Chờ nhóm duyệt thư viện hoặc liên hệ admin để bật tính năng thống kê.</p>';
        }
        return;
      }

      // Chart doanh thu ( đường )
      var ctx1 = document.getElementById('chart-doanh-thu').getContext('2d');
      var chart1 = new Chart(ctx1, {
        type: 'line',
        data: chartData.revenue || { labels: [], datasets: [] },
        options: {
          animation: { duration: 0 },
          scales: {
            y: { beginAtZero: true, ticks: { color: CSS.muted } },
            x: { ticks: { color: CSS.muted } }
          },
          plugins: {
            legend: { labels: { color: CSS.ink } },
            tooltip: { enabled: true, backgroundColor: CSS.canvas, titleColor: CSS.ink, bodyColor: CSS.ink }
          }
        }
      });

      // Chart cấu trúc ( doughnut )
      var ctx2 = document.getElementById('chart-cou-structure').getContext('2d');
      var labels2 = chartData.structure && chartData.structure.labels ? chartData.structure.labels : [];
      var data2 = chartData.structure && chartData.structure.datasets &&
        chartData.structure.datasets[0] && chartData.structure.datasets[0].data ?
        chartData.structure.datasets[0].data : [];

      var backgroundColors2 = [CSS.accent, getCssVar('--accent-deep'), getCssVar('--mint'), '#FCF1E8'];

      var chart2 = new Chart(ctx2, {
        type: 'doughnut',
        data: {
          labels: labels2,
          datasets: [{
            data: data2,
            backgroundColor: backgroundColors2.length > 0 ? backgroundColors2 : [
              '#8FB9A8', '#4E7F6D', '#EEF6F1', '#FCF1E8'
            ]
          }]
        },
        options: {
          animation: { duration: 0 },
          plugins: {
            legend: {
              labels: {
                color: CSS.ink,
                font: { size: 12 }
              }
            }
          }
        }
      });

      // Resize handling: hủy chart cũ rồi vẽ lại
      window.addEventListener('resize', function () {
        try { chart1.destroy(); } catch (e) {}
        try { chart2.destroy(); } catch (e) {}
        chart1 = new Chart(ctx1, {
          type: 'line',
          data: chartData.revenue || { labels: [], datasets: [] },
options: {
          animation: { duration: 0 },
          scales: {
            y: { beginAtZero: true, ticks: { color: CSS.muted } },
            x: { ticks: { color: CSS.muted } }
          },
          plugins: {
            legend: { labels: { color: CSS.ink } }
          }
        }
        });
        chart2 = new Chart(ctx2, {
          type: 'doughnut',
          data: {
            labels: labels2,
            datasets: [{
              data: data2,
              backgroundColor: backgroundColors2.length > 0 ? backgroundColors2 : [CSS.accent, getCssVar('--accent-deep'), getCssVar('--mint'), '#FCF1E8']
            }]
          },
          options: {
            animation: { duration: 0 },
            plugins: {
              legend: {
                labels: {
                  color: '#2A2F36',
                  font: { size: 12 }
                }
              }
            }
          }
        });
      });
    })();

    // ── (c) Form biến thể động ────────────────────────────────────
    (function () {
      var variantForm = document.querySelector('#pForm');
      if (!variantForm) return;

      var tpl = document.getElementById('variant-row-tpl');
      var rowsContainer = document.getElementById('variant-rows');
      var addBtn = document.getElementById('add-variant');
      var minRows = 1;

      if (!tpl || !rowsContainer) return;

      function updateVariantNames() {
        var rows = rowsContainer.querySelectorAll('.variant-row');
        rows.forEach(function (row, idx) {
          var nameInputs = row.querySelectorAll('[name*="variants"]');
          nameInputs.forEach(function (el) {
            var oldName = el.getAttribute('name') || '';
            if (oldName.includes('[0]')) {
              el.setAttribute('name', oldName.replace('[0]', '[' + idx + ']'));
            }
          });
        });
      }

      // Thêm biến thể
      if (addBtn) {
        addBtn.addEventListener('click', function () {
          var newRow = tpl.content.cloneNode(true);
          var index = rowsContainer.children.length;
          // Update name attributes
          var selects = newRow.querySelectorAll('select, input');
          selects.forEach(function (el) {
            var name = el.getAttribute('name') || '';
            if (name && name.includes('[0]')) {
              el.setAttribute('name', name.replace('[0]', '[' + index + ']'));
            }
          });
          // Disable remove btn if at min rows
          if (rowsContainer.children.length >= minRows) {
            var removeBtn = newRow.querySelector('.btn-remove-variant');
            if (removeBtn) {
              removeBtn.disabled = true;
              removeBtn.style.opacity = '0.5';
              removeBtn.style.pointerEvents = 'none';
            }
          }
          rowsContainer.appendChild(newRow);
          updateVariantNames();
          // Enable remove on rows after first
          var allRemoveBtns = rowsContainer.querySelectorAll('.btn-remove-variant');
          allRemoveBtns.forEach(function (btn, i) {
            if (i > 0) {
              btn.disabled = false;
              btn.style.opacity = '';
              btn.style.pointerEvents = '';
            }
          });
        });
      }

      // Remove variant row (không thể xóa dòng đầu tiên)
      if (rowsContainer) {
        rowsContainer.addEventListener('click', function (e) {
          if (e.target.classList.contains('btn-remove-variant')) {
            var row = e.target.closest('.variant-row');
            if (rowsContainer.children.length <= minRows) {
              // Chỉ disable thay vì xóa
              row.style.display = 'none';
              e.target.disabled = true;
              e.target.style.opacity = '0.5';
              e.target.style.pointerEvents = 'none';
              return;
            }
            rowsContainer.removeChild(row);
            updateVariantNames();
          }
        });
      }
    })();
  }

})();