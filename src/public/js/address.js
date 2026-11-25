(function () {
  'use strict';

  var cachedData = null;
  var loadingPromise = null;
  var errorSeq = 0;

  /** Tải dữ liệu địa chỉ một lần và cache lại. */
  function loadAddressData() {
    if (cachedData) {
      return Promise.resolve(cachedData);
    }
    if (!loadingPromise) {
      loadingPromise = fetch('/data/vietnam-address.json', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error('Không tải được dữ liệu địa chỉ');
          }
          return response.json();
        })
        .then(function (json) {
          if (json && Array.isArray(json.provinces)) {
            cachedData = json;
          } else {
            cachedData = { provinces: [] };
          }
          return cachedData;
        })
        .catch(function () {
          cachedData = { provinces: [] };
          return cachedData;
        });
    }
    return loadingPromise;
  }

  function clearSelect(select, placeholder) {
    if (!select) return;
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
    var option = document.createElement('option');
    option.value = '';
    option.textContent = placeholder;
    select.appendChild(option);
  }

  function fillSelect(select, items, placeholder) {
    if (!select) return;
    clearSelect(select, placeholder);
    (items || []).forEach(function (item) {
      if (!item) return;
      var option = document.createElement('option');
      option.value = item.code;
      option.textContent = item.name;
      select.appendChild(option);
    });
  }

  function findProvince(provinces, code) {
    for (var i = 0; i < provinces.length; i += 1) {
      if (provinces[i].code === code) return provinces[i];
    }
    return null;
  }

  function findDistrict(province, code) {
    if (!province || !Array.isArray(province.districts)) return null;
    for (var i = 0; i < province.districts.length; i += 1) {
      if (province.districts[i].code === code) return province.districts[i];
    }
    return null;
  }

  /**
   * Khởi tạo chuỗi Tỉnh/Thành -> Quận/Huyện -> Phường/Xã.
   * Quận/Huyện không bắt buộc: nếu tỉnh không có quận/huyện thì bỏ qua cấp này.
   */
  function initCascade(provSelect, distSelect, wardSelect) {
    if (!provSelect) return;
    if (provSelect.dataset.abmtCascade === '1') return;
    provSelect.dataset.abmtCascade = '1';

    if (distSelect) distSelect.disabled = true;
    if (wardSelect) wardSelect.disabled = true;

    loadAddressData().then(function (data) {
      var provinces = data.provinces || [];

      fillSelect(provSelect, provinces, '-- Chọn Tỉnh/Thành --');

      function onProvinceChange() {
        var province = findProvince(provinces, provSelect.value);
        if (distSelect) {
          clearSelect(distSelect, '-- Chọn Quận/Huyện --');
          distSelect.disabled = true;
        }
        if (wardSelect) {
          clearSelect(wardSelect, '-- Chọn Phường/Xã --');
          wardSelect.disabled = true;
        }
        if (!province) return;

        if (Array.isArray(province.districts) && province.districts.length > 0) {
          fillSelect(distSelect, province.districts, '-- Chọn Quận/Huyện --');
          if (distSelect) distSelect.disabled = false;
          if (province.districts.length === 1) {
            distSelect.value = province.districts[0].code;
            onDistrictChange();
          }
          return;
        }

        // Hỗ trợ cấu trúc 2 cấp trong tương lai: tỉnh -> phường/xã.
        if (Array.isArray(province.wards) && province.wards.length > 0) {
          fillSelect(wardSelect, province.wards, '-- Chọn Phường/Xã --');
          if (wardSelect) wardSelect.disabled = false;
        }
      }

      function onDistrictChange() {
        if (!distSelect || !wardSelect) return;
        var province = findProvince(provinces, provSelect.value);
        var district = findDistrict(province, distSelect.value);
        clearSelect(wardSelect, '-- Chọn Phường/Xã --');
        wardSelect.disabled = true;
        if (!district) return;
        if (Array.isArray(district.wards) && district.wards.length > 0) {
          fillSelect(wardSelect, district.wards, '-- Chọn Phường/Xã --');
          wardSelect.disabled = false;
        }
      }

      provSelect.addEventListener('change', onProvinceChange);
      if (distSelect) {
        distSelect.addEventListener('change', onDistrictChange);
      }
      if (provSelect.value) {
        onProvinceChange();
      }
    });
  }

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
    if (!phoneField || !/^(0|\+84)\d{9}$/.test(phoneValue)) {
      mark(phoneField, 'Số điện thoại không hợp lệ (bắt đầu bằng 0 hoặc +84).');
    }

    var provinceField = getField(form, 'province');
    if (!provinceField || !provinceField.value) {
      mark(provinceField, 'Vui lòng chọn Tỉnh/Thành.');
    }

    var wardField = getField(form, 'ward');
    if (!wardField || !wardField.value) {
      mark(wardField, 'Vui lòng chọn Phường/Xã.');
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

  function selectedText(select) {
    if (!select || select.selectedIndex < 0) return '';
    var option = select.options[select.selectedIndex];
    return option ? option.textContent.trim() : '';
  }

  function buildAddressPayload(form) {
    var nameField = getField(form, 'name');
    var phoneField = getField(form, 'phone');
    var provinceField = getField(form, 'province');
    var districtField = getField(form, 'district');
    var wardField = getField(form, 'ward');
    var streetField = getField(form, 'street');
    var defaultField = getField(form, 'isDefault');

    return {
      fullName: nameField ? nameField.value.trim() : '',
      phone: phoneField ? phoneField.value.replace(/\s+/g, '') : '',
      province: selectedText(provinceField),
      district: selectedText(districtField),
      ward: selectedText(wardField),
      detail: streetField ? streetField.value.trim() : '',
      isDefault: Boolean(defaultField && defaultField.checked),
    };
  }

  function initForm() {
    var form = document.getElementById('aForm');
    if (!form) return;

    initCascade(
      getField(form, 'province'),
      getField(form, 'district'),
      getField(form, 'ward')
    );

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
        return window.ABMT.api.post('/api/addresses', payload);
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
    initCascade: initCascade,
    validate: validate,
    loadAddressData: loadAddressData,
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
