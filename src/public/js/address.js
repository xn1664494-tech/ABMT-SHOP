(function () {
  'use strict';

  var errorSeq = 0;

  function getField(form, name) {
    if (!form) return null;
    if (form.elements && form.elements[name]) return form.elements[name];
    return form.querySelector('[name="' + name + '"]');
  }

  function getErrorEl(field) {
    if (!field) return null;
    var container = field.closest('.field') || field.parentNode;
    if (!container) return null;
    var el = container.querySelector('.field-error-msg');
    if (!el) {
      el = document.createElement('small');
      el.className = 'field-error-msg';
      errorSeq += 1;
      el.id = 'field-error-' + errorSeq;
      container.appendChild(el);
    }
    return el;
  }

  function setFieldError(field, message) {
    if (!field) return;
    var el = getErrorEl(field);
    if (message) {
      field.setAttribute('aria-invalid', 'true');
      if (el) el.textContent = message;
    } else {
      field.removeAttribute('aria-invalid');
      if (el) el.textContent = '';
    }
  }

  function clearErrors(form) {
    if (!form) return;
    var fields = form.querySelectorAll('[aria-invalid="true"]');
    Array.prototype.forEach.call(fields, function (field) {
      setFieldError(field, '');
    });
  }

  /** Kiểm tra hợp lệ form địa chỉ; hiển thị lỗi từng ô và focus ô lỗi đầu tiên. */
  function validate(form) {
    if (!form) return false;
    clearErrors(form);

    var firstError = null;

    function mark(field, message) {
      if (!field) return;
      setFieldError(field, message);
      if (!firstError) firstError = field;
    }

    var nameField = getField(form, 'name');
    if (!nameField || nameField.value.trim() === '') {
      mark(nameField, 'Vui lòng nhập họ tên.');
    }

    var phoneField = getField(form, 'phone');
    var phoneValue = phoneField ? phoneField.value.replace(/\s+/g, '') : '';
    if (!phoneField || !/^(0|\+84)[0-9]{9,10}$/.test(phoneValue)) {
      mark(phoneField, 'Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84).');
    }

    var wardCodeField = getField(form, 'wardCode');
    var searchField = form.querySelector('[data-addr-search]');
    if (!wardCodeField || !wardCodeField.value) {
      mark(
        searchField || wardCodeField,
        'Vui lòng chọn phường/xã từ danh sách gợi ý'
      );
    }

    var streetField = getField(form, 'street');
    if (!streetField || streetField.value.trim() === '') {
      mark(streetField, 'Vui lòng nhập địa chỉ cụ thể.');
    }

    if (firstError) {
      firstError.focus();
    }
    return !firstError;
  }

  function buildAddressPayload(form) {
    var nameField = getField(form, 'name');
    var phoneField = getField(form, 'phone');
    var provinceField = getField(form, 'province');
    var provinceCodeField = getField(form, 'provinceCode');
    var wardField = getField(form, 'ward');
    var wardCodeField = getField(form, 'wardCode');
    var streetField = getField(form, 'street');

    return {
      fullName: nameField ? nameField.value.trim() : '',
      phone: phoneField ? phoneField.value.replace(/\s+/g, '') : '',
      province: provinceField ? provinceField.value.trim() : '',
      provinceCode: provinceCodeField ? provinceCodeField.value.trim() : '',
      ward: wardField ? wardField.value.trim() : '',
      wardCode: wardCodeField ? wardCodeField.value.trim() : '',
      detail: streetField ? streetField.value.trim() : '',
    };
  }

  var autocompleteSeq = 0;

  function initAutocomplete(root) {
    if (!root) return;
    if (root.dataset && root.dataset.abmtAutocomplete === '1') return;

    var search = root.querySelector('[data-addr-search]');
    var list = root.querySelector('[data-addr-list]');
    if (!search || !list) return;

    if (root.dataset) root.dataset.abmtAutocomplete = '1';

    var chip = root.querySelector('[data-addr-chip]');
    var chipLabel = root.querySelector('[data-addr-chip-label]');
    var changeBtn = root.querySelector('[data-addr-change]');
    var provinceField = root.querySelector('[name="province"]');
    var provinceCodeField = root.querySelector('[name="provinceCode"]');
    var wardField = root.querySelector('[name="ward"]');
    var wardCodeField = root.querySelector('[name="wardCode"]');

    autocompleteSeq += 1;
    var uid = 'addr-' + autocompleteSeq;

    var items = [];
    var activeIndex = -1;
    var controller = null;
    var debounceTimer = null;
    var requestSeq = 0;

    if (!list.id) list.id = uid + '-list';
    list.setAttribute('role', 'listbox');
    search.setAttribute('role', 'combobox');
    search.setAttribute('aria-autocomplete', 'list');
    search.setAttribute('aria-controls', list.id);
    search.setAttribute('aria-expanded', 'false');

    function setExpanded(open) {
      search.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function clearActive() {
      for (var i = 0; i < list.children.length; i += 1) {
        var node = list.children[i];
        if (node && node.getAttribute) node.setAttribute('aria-selected', 'false');
      }
      search.removeAttribute('aria-activedescendant');
      activeIndex = -1;
    }

    function closeList() {
      list.hidden = true;
      setExpanded(false);
      clearActive();
    }

    function openList() {
      list.hidden = false;
      setExpanded(true);
    }

    function clearList() {
      while (list.firstChild) list.removeChild(list.firstChild);
      items = [];
      clearActive();
    }

    function clearSelection() {
      if (provinceField) provinceField.value = '';
      if (provinceCodeField) provinceCodeField.value = '';
      if (wardField) wardField.value = '';
      if (wardCodeField) wardCodeField.value = '';
      if (chip) chip.hidden = true;
      if (chipLabel) chipLabel.textContent = '';
    }

    function setActive(index) {
      if (index < 0 || index >= items.length) return;
      activeIndex = index;
      for (var i = 0; i < list.children.length; i += 1) {
        var node = list.children[i];
        if (!node || !node.getAttribute) continue;
        node.setAttribute('aria-selected', i === index ? 'true' : 'false');
      }
      var activeNode = list.children[index];
      if (activeNode && activeNode.id) {
        search.setAttribute('aria-activedescendant', activeNode.id);
        if (activeNode.scrollIntoView) {
          activeNode.scrollIntoView({ block: 'nearest' });
        }
      }
    }

    function selectItem(index) {
      var item = items[index];
      if (!item) return;

      if (provinceField) provinceField.value = item.provinceName || '';
      if (provinceCodeField) provinceCodeField.value = item.provinceCode || '';
      if (wardField) wardField.value = item.wardName || '';
      if (wardCodeField) wardCodeField.value = item.wardCode || '';

      if (chipLabel) {
        chipLabel.textContent = item.label || item.wardName + ', ' + item.provinceName;
      }
      if (chip) chip.hidden = false;

      search.value = item.wardName || item.label || '';
      setFieldError(search, '');
      clearList();
      closeList();
    }

    function makeOption(item, index) {
      var li = document.createElement('li');
      li.className = 'addr-option';
      li.id = uid + '-opt-' + index;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');

      var main = document.createElement('span');
      main.textContent = item.label || item.wardName + ', ' + item.provinceName;
      li.appendChild(main);

      if (item.matchedOld) {
        var sub = document.createElement('small');
        sub.textContent = 'trước đây: ' + item.matchedOld;
        li.appendChild(sub);
      }

      function choose(event) {
        if (event) event.preventDefault();
        selectItem(index);
      }

      li.addEventListener('pointerdown', choose);
      li.addEventListener('click', choose);

      return li;
    }

    function renderMessage(text, className) {
      clearList();
      var node = document.createElement('li');
      node.className = className;
      node.textContent = text;
      list.appendChild(node);
      openList();
    }

    function renderItems(nextItems) {
      clearList();
      items = nextItems || [];
      if (items.length === 0) {
        renderMessage(
          'Không tìm thấy, thử gõ tên phường/xã hoặc tên tỉnh',
          'addr-empty'
        );
        return;
      }
      for (var i = 0; i < items.length; i += 1) {
        list.appendChild(makeOption(items[i], i));
      }
      openList();
    }

    function fetchSuggestions(query) {
      if (!window.ABMT || !window.ABMT.api || !window.ABMT.api.get) return;

      if (controller) controller.abort();
      controller = new AbortController();
      var currentController = controller;
      requestSeq += 1;
      var seq = requestSeq;

      renderMessage('Đang tìm...', 'addr-loading');

      window.ABMT.api
        .get('/api/address/suggest?q=' + encodeURIComponent(query) + '&limit=8', {
          signal: currentController.signal,
        })
        .then(function (response) {
          if (seq !== requestSeq || currentController.signal.aborted) return;
          var suggestions =
            response && response.data && Array.isArray(response.data.suggestions)
              ? response.data.suggestions
              : [];
          renderItems(suggestions);
        })
        .catch(function () {
          if (seq !== requestSeq || currentController.signal.aborted) return;
          renderMessage(
            'Không tìm thấy, thử gõ tên phường/xã hoặc tên tỉnh',
            'addr-empty'
          );
        });
    }

    function onInput() {
      if (wardCodeField && wardCodeField.value) {
        clearSelection();
      }

      var query = search.value.trim();
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
        debounceTimer = null;
      }

      if (query.length < 2) {
        if (controller) controller.abort();
        clearList();
        closeList();
        return;
      }

      debounceTimer = window.setTimeout(function () {
        fetchSuggestions(query);
      }, 200);
    }

    function onKeyDown(event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (list.hidden) {
          if (search.value.trim().length >= 2) onInput();
          return;
        }
        if (items.length === 0) return;
        setActive(activeIndex + 1 >= items.length ? 0 : activeIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (list.hidden || items.length === 0) return;
        setActive(activeIndex - 1 < 0 ? items.length - 1 : activeIndex - 1);
      } else if (event.key === 'Enter') {
        if (!list.hidden && activeIndex >= 0 && items[activeIndex]) {
          event.preventDefault();
          selectItem(activeIndex);
        }
      } else if (event.key === 'Escape') {
        closeList();
      } else if (event.key === 'Tab') {
        closeList();
      }
    }

    function onDocumentPointerDown(event) {
      if (!root.contains(event.target)) closeList();
    }

    search.addEventListener('input', onInput);
    search.addEventListener('keydown', onKeyDown);
    search.addEventListener('focus', function () {
      if (search.value.trim().length >= 2 && items.length > 0 && list.hidden) {
        openList();
      }
    });
    document.addEventListener('pointerdown', onDocumentPointerDown);

    if (changeBtn) {
      changeBtn.addEventListener('click', function (event) {
        event.preventDefault();
        clearSelection();
        search.value = '';
        closeList();
        search.focus();
      });
    }
  }

  function initForm() {
    var form = document.getElementById('aForm');
    if (!form) return;

    var combo = form.querySelector('[data-addr-combo]');
    if (combo) initAutocomplete(combo);

    // Trang checkout có #aList: việc đặt hàng do checkout.js xử lý.
    if (document.getElementById('aList')) return;

    var submitting = false;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (submitting) return;
      if (!validate(form)) return;

      var submitBtn = form.querySelector('button[type="submit"]');
      var payload = buildAddressPayload(form);
      submitting = true;

      var request = function () {
        return window.ABMT.api.post('/api/profile/addresses', payload);
      };
      var run = function () {
        if (window.ABMT && window.ABMT.withButtonLock && submitBtn) {
          return window.ABMT.withButtonLock(submitBtn, request);
        }
        return request();
      };

      Promise.resolve()
        .then(run)
        .then(function () {
          if (window.ABMT && window.ABMT.toast) {
            window.ABMT.toast.success('Đã lưu địa chỉ mới.');
          }
          window.setTimeout(function () {
            if (window.history.length > 1) {
              window.history.back();
            } else {
              window.location.href = '/account';
            }
          }, 400);
        })
        .catch(function (error) {
          submitting = false;
          if (window.ABMT && window.ABMT.toast) {
            window.ABMT.toast.fromError(error);
          }
        });
    });
  }

  if (window.ABMT === undefined) {
    window.ABMT = {};
  }
  window.ABMT.address = {
    initAutocomplete: initAutocomplete,
    validate: validate,
    buildAddressPayload: buildAddressPayload,
  };

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(initForm);
})();
