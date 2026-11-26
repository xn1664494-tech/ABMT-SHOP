'use strict';

/**
 * Sinh dữ liệu địa chỉ 2 cấp (Tỉnh/Thành -> Phường/Xã/Đặc khu) từ CSV.
 * Chạy: node scripts/build-address-data.js
 *
 * Nguồn: data-source/address/{tinh,xa,xa-cu-moi}.csv (UTF-8 BOM)
 * Đích:  src/data/address/{provinces,wards,ward-aliases}.json (UTF-8, không BOM)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data-source', 'address');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'address');

/** Đọc CSV: xử lý BOM, dấu ngoặc kép, dấu phẩy trong ngoặc. */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      // bỏ qua CR (xử lý CRLF)
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function readCsvRecords(filename) {
  const raw = fs.readFileSync(path.join(SRC_DIR, filename), 'utf8');
  const rows = parseCsv(raw);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const records = [];

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    if (!cells || cells.length === 0) continue;
    // Bỏ qua dòng trống hoàn toàn
    if (cells.length === 1 && cells[0].trim() === '') continue;

    const obj = {};
    for (let c = 0; c < header.length; c += 1) {
      obj[header[c]] = cells[c] !== undefined ? cells[c] : '';
    }
    records.push(obj);
  }

  return records;
}

function fail(message) {
  console.error('[build-address-data] LỖI: ' + message);
  process.exit(1);
}

function buildProvinces() {
  const records = readCsvRecords('tinh.csv');
  const provinces = records.map((r) => ({
    code: String(r.ma_tinh || '').trim(),
    name: String(r.ten || '').trim(),
    fullName: String(r.ten_day_du || '').trim(),
    type: String(r.loai || '').trim(),
    wardCount: Number(String(r.so_don_vi_cap_xa || '').trim()) || 0,
  }));

  if (provinces.length !== 34) {
    fail('Số tỉnh/thành phải là 34, nhận được ' + provinces.length);
  }

  for (const p of provinces) {
    if (!p.code || !p.name || !p.fullName) {
      fail('Tỉnh/thành thiếu mã hoặc tên: ' + JSON.stringify(p));
    }
  }

  return provinces;
}

function buildWards() {
  const records = readCsvRecords('xa.csv');
  const wards = records.map((r) => ({
    code: String(r.ma_xa || '').trim(),
    name: String(r.ten || '').trim(),
    type: String(r.loai || '').trim(),
    provinceCode: String(r.ma_tinh || '').trim(),
  }));

  if (wards.length !== 3321) {
    fail('Số xã/phường phải là 3321, nhận được ' + wards.length);
  }

  return wards;
}

function buildWardAliases() {
  const records = readCsvRecords('xa-cu-moi.csv');
  const aliases = {};
  const seen = {};

  for (const r of records) {
    const provinceCode = String(r.ma_tinh || '').trim();
    const wardCode = String(r.ma_xa_moi || '').trim();
    const oldName = String(r.ten_xa_cu || '').trim();
    const newName = String(r.ten_xa_moi || '').trim();
    const oldDistrict = String(r.quan_huyen_cu || '').trim();
    const oldProvince = String(r.tinh_cu || '').trim();

    if (!provinceCode || !wardCode || !oldName) continue;
    if (oldName.toLowerCase() === newName.toLowerCase()) continue;

    const key = provinceCode + '-' + wardCode;
    const label = oldName + ' (' + oldDistrict + ', ' + oldProvince + ')';

    if (!aliases[key]) {
      aliases[key] = [];
      seen[key] = new Set();
    }

    const dedupeKey = label.toLowerCase();
    if (seen[key].has(dedupeKey)) continue;
    seen[key].add(dedupeKey);
    aliases[key].push(label);
  }

  return aliases;
}

function validate(provinces, wards) {
  const provinceCodes = new Set(provinces.map((p) => p.code));
  const seenPair = new Set();
  const countByProvince = {};

  for (const w of wards) {
    if (!w.code || !w.name) {
      fail('Xã/phường thiếu mã hoặc tên: ' + JSON.stringify(w));
    }
    if (!provinceCodes.has(w.provinceCode)) {
      fail('Xã ' + w.code + ' có provinceCode không tồn tại: ' + w.provinceCode);
    }
    const pair = w.provinceCode + '-' + w.code;
    if (seenPair.has(pair)) {
      fail('Trùng cặp (provinceCode, code): ' + pair);
    }
    seenPair.add(pair);
    countByProvince[w.provinceCode] = (countByProvince[w.provinceCode] || 0) + 1;
  }

  for (const p of provinces) {
    const actual = countByProvince[p.code] || 0;
    if (actual !== p.wardCount) {
      fail(
        'Tỉnh ' + p.code + ' (' + p.name + ') có ' + actual +
        ' xã nhưng so_don_vi_cap_xa = ' + p.wardCount,
      );
    }
  }
}

function writeJson(filename, data) {
  const filePath = path.join(OUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
  const size = fs.statSync(filePath).size;
  return { filePath, size };
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    fail('Không tìm thấy thư mục nguồn: ' + SRC_DIR);
  }

  const provinces = buildProvinces();
  const wards = buildWards();
  const aliases = buildWardAliases();

  validate(provinces, wards);

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Bỏ wardCount khỏi provinces.json (chỉ dùng để kiểm tra).
  const provincesOut = provinces.map((p) => ({
    code: p.code,
    name: p.name,
    fullName: p.fullName,
    type: p.type,
  }));

  const pFile = writeJson('provinces.json', provincesOut);
  const wFile = writeJson('wards.json', wards);
  const aFile = writeJson('ward-aliases.json', aliases);

  const aliasKeys = Object.keys(aliases).length;
  const aliasTotal = Object.keys(aliases).reduce((sum, k) => sum + aliases[k].length, 0);

  console.log('[build-address-data] Hoàn tất.');
  console.log('  Tỉnh/thành: ' + provinces.length);
  console.log('  Xã/phường/đặc khu: ' + wards.length);
  console.log('  Khóa alias: ' + aliasKeys + ' (tổng tên cũ: ' + aliasTotal + ')');
  console.log('  ' + path.basename(pFile.filePath) + ': ' + pFile.size + ' bytes');
  console.log('  ' + path.basename(wFile.filePath) + ': ' + wFile.size + ' bytes');
  console.log('  ' + path.basename(aFile.filePath) + ': ' + aFile.size + ' bytes');
}

main();
