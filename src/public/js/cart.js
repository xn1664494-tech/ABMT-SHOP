(function () {
  'use strict';

  var DEBOUNCE_MS = 400;
  var moneyFormatter = new Intl.NumberFormat('vi-VN');

  var linesEl = document.getElementById('lines');
  var fullEl = document.getElementById('full');
  var emptyEl = document.getElementById('empty');

  if (!linesEl || !fullEl) {
    return;
  }

  var timers = Object.create(null);
  var busy = Object.create(null);

  function formatMoney(value) {
    var number = Number(value);
    if (!isFinite(number)) return '';
    return moneyFormatter.format(number) + ' ₫';
  }

  function unwrap(response) {
    if (response && response.data) return response.data;
    return response || {};
  }

  function findLine(itemId) {
    return linesEl.querySelector('.cart-line[data-item-id="' + itemId + '"]');
  }

  function getLineError(line) {
    var el = line.querySelector('.cart-line-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'cart-line-error';
      el.setAttribute('aria-live', 'polite');
      line.appendChild(el);
    }
    return el;
  }

  function setLineError(line, message) {
    var el = getLineError(line);
    el.textContent = message || '';
    if (message) {
      line.classList.add('has-error');
    } else {
      line.classList.remove('has-error');
    }
  }

  function setBusy(line, value) {
    if (!line) return;
    if (value) {
      line.classList.add('is-busy');
      line.setAttribute('aria-busy', 'true');
    } else {
      line.classList.remove('is-busy');
      line.removeAttribute('aria-busy');
    }
  }

  function setMoney(id, value) {
    if (value === undefined || value === null) return;
    var el = document.getElementById(id);
    if (el) el.textContent = formatMoney(value);
  }

  function updateHeaderBadge(count) {
    var link = document.querySelector('.header-cart');
    if (!link) return;
    var badge = link.querySelector('.header-cart-badge');
    var safeCount = Math.max(0, Number(count) || 0);

    if (safeCount > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'header-cart-badge';
        badge.setAttribute('aria-hidden', 'true');
        link.appendChild(badge);
      }
      badge.textContent = safeCount > 99 ? '99+' : String(safeCount);
    } else if (badge) {
      badge.parentNode.removeChild(badge);
    }

    link.setAttribute(
      'aria-label',
      safeCount > 0 ? 'Giỏ hàng, ' + safeCount + ' sản phẩm' : 'Giỏ hàng'
    );
  }

  function applySummary(data) {
    setMoney('sub', data.subtotal);
    setMoney('ship', data.shippingFee);
    setMoney('total', data.total);

    if (data.count !== undefined) {
      var count = Math.max(0, Number(data.count) || 0);
      var countEl = document.getElementById('count');
      if (countEl) countEl.textContent = String(count);
      updateHeaderBadge(count);
    }
  }

  function toggleEmpty(hasItems) {
    fullEl.hidden = !hasItems;
    if (emptyEl) emptyEl.hidden = hasItems;
  }

  function updateLineFromItem(line, item) {
    var input = line.querySelector('.qty-field');
    if (input) {
      input.value = String(item.qty);
      input.dataset.saved = String(item.qty);
    }
    var unitEl = line.querySelector('[data-unit-price]') || line.querySelector('.cart-line-unit');
    if (unitEl && item.unitPrice !== undefined) {
      unitEl.textContent = formatMoney(item.unitPrice);
    }
    var totalEl = line.querySelector('[data-line-total]') || line.querySelector('.cart-line-total');
    if (totalEl && item.unitPrice !== undefined && item.qty !== undefined) {
      totalEl.textContent = formatMoney(Number(item.unitPrice) * Number(item.qty));
    }
  }

  function syncItems(items) {
    if (!Array.isArray(items)) return;
    var byId = Object.create(null);
    items.forEach(function (item) {
      if (!item) return;
      byId[String(item._id || item.id || item.sku)] = item;
    });

    var domLines = linesEl.querySelectorAll('.cart-line');
    Array.prototype.forEach.call(domLines, function (line) {
      var item = byId[line.dataset.itemId];
      if (!item) {
        line.parentNode.removeChild(line);
        return;
      }
      updateLineFromItem(line, item);
    });
  }

  function renderFromResponse(data) {
    applySummary(data);
    syncItems(data.items);
    var hasItems = Array.isArray(data.items)
      ? data.items.length > 0
      : linesEl.querySelector('.cart-line') !== null;
    toggleEmpty(hasItems);
  }

  function sendUpdate(itemId, desiredQty) {
    var line = findLine(itemId);
    if (!line || busy[itemId]) return;

    var input = line.querySelector('.qty-field');
    if (!input) return;

    var saved = Number(input.dataset.saved || input.value) || 1;
    var max = Number(input.max) || 0;
    var qty = Math.round(Number(desiredQty));
    if (!isFinite(qty) || qty < 1) qty = 1;
    if (max > 0 && qty > max) qty = max;

    input.value = String(qty);
    if (qty === saved) return;

    busy[itemId] = true;
    setLineError(line, '');
    setBusy(line, true);

    window.ABMT.api
      .patch('/api/cart/items/' + encodeURIComponent(itemId), { quantity: qty })
      .then(function (response) {
        renderFromResponse(unwrap(response));
      })
      .catch(function (error) {
        input.value = String(saved);
        setLineError(line, error && error.message ? error.message : 'Không cập nhật được số lượng.');
        if (window.ABMT.toast) window.ABMT.toast.fromError(error);
      })
      .then(function () {
        busy[itemId] = false;
        setBusy(line, false);
      });
  }

  function queueUpdate(itemId, value, immediate) {
    if (timers[itemId]) {
      window.clearTimeout(timers[itemId]);
      delete timers[itemId];
    }
    if (immediate) {
      sendUpdate(itemId, value);
      return;
    }
    timers[itemId] = window.setTimeout(function () {
      delete timers[itemId];
      sendUpdate(itemId, value);
    }, DEBOUNCE_MS);
  }

  function removeItem(itemId) {
    var line = findLine(itemId);
    if (!line || busy[itemId]) return;

    busy[itemId] = true;
    setLineError(line, '');
    setBusy(line, true);

    window.ABMT.api
      .del('/api/cart/items/' + encodeURIComponent(itemId))
      .then(function (response) {
        var data = unwrap(response);
        if (line.parentNode) line.parentNode.removeChild(line);
        applySummary(data);
        syncItems(data.items);
        var hasItems = Array.isArray(data.items)
          ? data.items.length > 0
          : linesEl.querySelector('.cart-line') !== null;
        toggleEmpty(hasItems);
        if (window.ABMT.toast) window.ABMT.toast.success('Đã xóa sản phẩm khỏi giỏ.');
      })
      .catch(function (error) {
        setLineError(line, error && error.message ? error.message : 'Không xóa được sản phẩm.');
        if (window.ABMT.toast) window.ABMT.toast.fromError(error);
      })
      .then(function () {
        busy[itemId] = false;
        setBusy(line, false);
      });
  }

  linesEl.addEventListener('click', function (event) {
    var button = event.target.closest('[data-action]');
    if (!button || !linesEl.contains(button)) return;

    var line = button.closest('.cart-line');
    if (!line) return;
    var itemId = line.dataset.itemId;
    if (!itemId) return;

    var action = button.dataset.action;
    if (action === 'remove') {
      removeItem(itemId);
      return;
    }

    var input = line.querySelector('.qty-field');
    if (!input) return;

    var current = Math.max(1, Math.round(Number(input.value) || 1));
    var max = Number(input.max) || 0;
    var next = current;

    if (action === 'dec') next = Math.max(1, current - 1);
    if (action === 'inc') {
      next = current + 1;
      if (max > 0 && next > max) next = max;
    }

    input.value = String(next);
    setLineError(line, '');
    queueUpdate(itemId, next, true);
  });

  linesEl.addEventListener('input', function (event) {
    var input = event.target.closest('.qty-field');
    if (!input || !linesEl.contains(input)) return;
    var line = input.closest('.cart-line');
    if (!line) return;
    var itemId = line.dataset.itemId;
    if (!itemId || busy[itemId]) return;

    setLineError(line, '');
    if (input.value === '') return;
    queueUpdate(itemId, input.value, false);
  });

  linesEl.addEventListener('focusout', function (event) {
    var input = event.target.closest('.qty-field');
    if (!input || !linesEl.contains(input)) return;
    var line = input.closest('.cart-line');
    if (!line) return;
    var itemId = line.dataset.itemId;
    if (!itemId || busy[itemId]) return;

    if (input.value === '') input.value = input.dataset.saved || '1';
    queueUpdate(itemId, input.value, true);
  });

  linesEl.addEventListener('keydown', function (event) {
    var input = event.target.closest('.qty-field');
    if (!input || event.key !== 'Enter') return;
    event.preventDefault();
    var line = input.closest('.cart-line');
    if (!line) return;
    var itemId = line.dataset.itemId;
    if (!itemId) return;
    queueUpdate(itemId, input.value, true);
  });
})();
