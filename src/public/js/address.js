(function () {
  'use strict';

  // Cache cho JSON address
  let addressData = null;

  // Tải dữ liệu địa chỉ VN một lần
  async function loadAddressData() {
    if (addressData) return addressData;
    try {
      const res = await fetch('/data/vietnam-address.json');
      if (!res.ok) throw new Error('Không tải được dữ liệu địa chỉ');
      addressData = await res.json();
      return addressData;
    } catch (err) {
      console.error('Load address data error:', err);
      addressData = { provinces: [] };
      return addressData;
    }
  }

  // Khởi tạo chuỗi đổ dữ liệu: Tỉnh -> Quận/Huyện -> Phường/Xã
  function initCascade(provSelect, distSelect, wardSelect) {
    loadAddressData().then(data => {
      const provinces = data.provinces || [];

      // Reset và đổ Tỉnh
      if (provSelect) {
        provSelect.innerHTML = '<option value="">-- Chọn Tỉnh/Thành --</option>';
        provinces.forEach(function (prov) {
          const opt = document.createElement('option');
          opt.value = prov.code;
          opt.textContent = prov.name;
          provSelect.appendChild(opt);
        });
      }

      // Reset Quận/Huyện và Phường/Xã khi đổi Tỉnh
      if (provSelect && distSelect && wardSelect) {
        provSelect.addEventListener('change', function () {
          // Reset Quận/Huyện
          if (distSelect) {
            distSelect.innerHTML = '<option value="">-- Chọn Quận/Huyện --</option>';
            distSelect.disabled = true;
          }
          // Reset Phường/Xã
          if (wardSelect) {
            wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
            wardSelect.disabled = true;
          }

          const code = provSelect ? provSelect.value : '';
          if (!code) return;

          const prov = provinces.find(function (p) { return p.code === code; });
          if (!prov || !prov.districts) return;

          // Đổ Quận/Huyện
          if (distSelect) {
            prov.districts.forEach(function (dist) {
              const opt = document.createElement('option');
              opt.value = dist.code;
              opt.textContent = dist.name;
              distSelect.appendChild(opt);
            });
            distSelect.disabled = false;
          }

          // Phường/Xã sẽ được reset khi quận thay đổi (dưới đây)
        });

        // Reset Phường/Xã khi đổi Quận/Huyện
        if (distSelect && wardSelect) {
          distSelect.addEventListener('change', function () {
            if (wardSelect) {
              wardSelect.innerHTML = '<option value="">-- Chọn Phường/Xã --</option>';
              wardSelect.disabled = true;
            }
            const code = distSelect ? distSelect.value : '';
            if (!code) return;

            const prov = provinces.find(function (p) { return p.code === ''; }) || {};
            const district = prov.districts ? prov.districts.find(function (d) { return d.code === code; }) : null;
            if (!district || !district.wards) return;

            if (wardSelect) {
              district.wards.forEach(function (ward) {
                const opt = document.createElement('option');
                opt.value = ward.code;
                opt.textContent = ward.name;
                wardSelect.appendChild(opt);
              });
              wardSelect.disabled = false;
            }
          });
        }
      }
    });
  }

  // Validate form address
  function validate(form) {
    let valid = true;
    let firstError = null;

    // Họ tên
    const nameInput = form.elements.name;
    if (nameInput && nameInput.value.trim() === '') {
      valid = false;
      nameInput.style.borderColor = 'var(--danger)';
      nameInput.setAttribute('aria-invalid', 'true');
      if (!firstError) firstError = nameInput;
    } else {
      nameInput.style.borderColor = '';
      nameInput.removeAttribute('aria-invalid');
    }

    // SĐT
    const phoneInput = form.elements.phone;
    if (phoneInput && phoneInput.value.trim() !== '') {
      const phonePattern = /^(0|\+84)\d{9}$/;
      if (!phonePattern.test(phoneInput.value.replace(/\s/g, ''))) {
        valid = false;
        phoneInput.style.borderColor = 'var(--danger)';
        phoneInput.setAttribute('aria-invalid', 'true');
        if (!firstError) firstError = phoneInput;
      } else {
        phoneInput.style.borderColor = '';
        phoneInput.removeAttribute('aria-invalid');
      }
    }

    // Tỉnh
    const provSelect = form.elements.province;
    if (provSelect && provSelect.value === '') {
      valid = false;
      provSelect.style.borderColor = 'var(--danger)';
      provSelect.setAttribute('aria-invalid', 'true');
      if (!firstError) firstError = provSelect;
    } else {
      provSelect.style.borderColor = '';
      provSelect.removeAttribute('aria-invalid');
    }

    // Phường/Xã
    const wardSelect = form.elements.ward;
    if (wardSelect && wardSelect.value === '') {
      valid = false;
      wardSelect.style.borderColor = 'var(--danger)';
      wardSelect.setAttribute('aria-invalid', 'true');
      if (!firstError) firstError = wardSelect;
    } else {
      wardSelect.style.borderColor = '';
      wardSelect.removeAttribute('aria-invalid');
    }

    // Địa chỉ cụ thể
    const streetInput = form.elements.street;
    if (streetInput && streetInput.value.trim() === '') {
      valid = false;
      streetInput.style.borderColor = 'var(--danger)';
      streetInput.setAttribute('aria-invalid', 'true');
      if (!firstError) firstError = streetInput;
    } else {
      streetInput.style.borderColor = '';
      streetInput.removeAttribute('aria-invalid');
    }

    // Focus ô lỗi đầu tiên
    if (!valid && firstError) {
      firstError.focus();
    }

    return valid;
  }

  //Expose ABMT.address
  if (window.ABMT === undefined) { window.ABMT = {}; }
  window.ABMT.address = {
    initCascade: initCascade,
    validate: validate,
    loadAddressData: loadAddressData
  };

})();