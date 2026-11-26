'use strict';

/**
 * Dịch vụ tra cứu / gợi ý địa chỉ 2 cấp (Tỉnh/Thành -> Phường/Xã/Đặc khu).
 * Dữ liệu nạp một lần từ src/data/address và cache trong bộ nhớ.
 */

const provinces = require('../data/address/provinces.json');
const wards = require('../data/address/wards.json');
const wardAliases = require('../data/address/ward-aliases.json');

const WARD_PREFIXES = ['phuong', 'xa', 'dac khu'];

/** Chuẩn hóa: bỏ dấu tiếng Việt, đ->d, bỏ ký tự lạ, gộp khoảng trắng. */
function normalize(text) {
  if (text === undefined || text === null) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripPrefix(normalized, prefixes) {
  for (let i = 0; i < prefixes.length; i += 1) {
    const prefix = prefixes[i];
    if (normalized === prefix) return '';
    if (normalized.indexOf(prefix + ' ') === 0) {
      return normalized.slice(prefix.length + 1);
    }
  }
  return normalized;
}

function splitWords(normalized) {
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

const provinceByCode = new Map();
for (const province of provinces) {
  provinceByCode.set(String(province.code), province);
}

const wardByKey = new Map();
const searchIndex = [];

for (const ward of wards) {
  const province = provinceByCode.get(String(ward.provinceCode));
  if (!province) continue;

  const key = String(ward.provinceCode) + '-' + String(ward.code);
  wardByKey.set(key, ward);

  const wardCore = stripPrefix(normalize(ward.name), WARD_PREFIXES);
  const provinceNorm = normalize(province.fullName || province.name);
  const aliasLabels = wardAliases[key] || [];

  searchIndex.push({
    ward,
    province,
    key,
    wardCore,
    wardWords: splitWords(wardCore),
    provinceWords: splitWords(provinceNorm),
    aliasLabels,
    aliasWordLists: aliasLabels.map((label) => splitWords(normalize(label))),
  });
}

function getProvinces() {
  return provinces;
}

function startsWithAnyWord(token, words) {
  for (let i = 0; i < words.length; i += 1) {
    if (words[i].indexOf(token) === 0) return true;
  }
  return false;
}

/**
 * Hạng khớp trực tiếp của tất cả từ khóa với tên xã/tỉnh.
 * 1 = đầu tên xã, 2 = đầu một từ trong tên xã, 3 = đầu một từ trong tên tỉnh.
 * Trả Infinity nếu có từ không khớp.
 */
function directRank(tokens, candidate) {
  let score = 0;

  for (let t = 0; t < tokens.length; t += 1) {
    const token = tokens[t];
    let rank;

    if (candidate.wardCore.indexOf(token) === 0) {
      rank = 1;
    } else if (startsWithAnyWord(token, candidate.wardWords)) {
      rank = 2;
    } else if (startsWithAnyWord(token, candidate.provinceWords)) {
      rank = 3;
    } else {
      return Infinity;
    }

    if (rank > score) score = rank;
  }

  return score;
}

function aliasCoversAll(words, tokens) {
  for (let t = 0; t < tokens.length; t += 1) {
    if (!startsWithAnyWord(tokens[t], words)) return false;
  }
  return true;
}

/** Tìm một tên cũ (alias) chứa trọn tất cả từ khóa; trả nhãn hoặc null. */
function findAlias(tokens, candidate) {
  let best = null;

  for (let i = 0; i < candidate.aliasWordLists.length; i += 1) {
    if (!aliasCoversAll(candidate.aliasWordLists[i], tokens)) continue;
    const label = candidate.aliasLabels[i];
    if (!best || label.length < best.length) best = label;
  }

  return best;
}

/**
 * Gợi ý phường/xã theo từ khóa.
 * @param {string} query
 * @param {{ provinceCode?: string, limit?: number }} [options]
 */
function suggest(query, options) {
  const opts = options || {};
  const normalizedQuery = normalize(query);

  if (normalizedQuery.length < 2) return [];

  const tokens = splitWords(normalizedQuery);
  if (tokens.length === 0) return [];

  let max = 8;
  if (opts.limit !== undefined && opts.limit !== null) {
    const parsed = parseInt(opts.limit, 10);
    if (Number.isFinite(parsed)) max = parsed;
  }
  if (max > 10) max = 10;
  if (max < 1) max = 1;

  const filterProvince =
    opts.provinceCode !== undefined && opts.provinceCode !== null
      ? String(opts.provinceCode).trim()
      : '';

  const results = [];

  for (let i = 0; i < searchIndex.length; i += 1) {
    const candidate = searchIndex[i];

    if (filterProvince && String(candidate.ward.provinceCode) !== filterProvince) {
      continue;
    }

    let score = directRank(tokens, candidate);
    let matchedOld = null;

    if (score === Infinity) {
      const alias = findAlias(tokens, candidate);
      if (!alias) continue;
      score = 4;
      matchedOld = alias;
    }

    results.push({
      score,
      nameLength: candidate.ward.name.length,
      wardCode: candidate.ward.code,
      wardName: candidate.ward.name,
      provinceCode: candidate.ward.provinceCode,
      provinceName: candidate.province.name,
      label: candidate.ward.name + ', ' + candidate.province.fullName,
      matchedOld,
    });
  }

  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    if (a.nameLength !== b.nameLength) return a.nameLength - b.nameLength;
    return a.wardName.localeCompare(b.wardName, 'vi');
  });

  return results.slice(0, max).map((r) => ({
    wardCode: r.wardCode,
    wardName: r.wardName,
    provinceCode: r.provinceCode,
    provinceName: r.provinceName,
    label: r.label,
    matchedOld: r.matchedOld,
  }));
}

/** Tra cứu chuẩn theo mã; trả { ward, province } hoặc null. */
function findWard(provinceCode, wardCode) {
  if (provinceCode === undefined || provinceCode === null) return null;
  if (wardCode === undefined || wardCode === null) return null;

  const pCode = String(provinceCode).trim();
  const wCode = String(wardCode).trim();
  if (!pCode || !wCode) return null;

  const ward = wardByKey.get(pCode + '-' + wCode);
  if (!ward) return null;

  const province = provinceByCode.get(pCode);
  if (!province) return null;

  return { ward, province };
}

module.exports = {
  normalize,
  getProvinces,
  suggest,
  findWard,
};
