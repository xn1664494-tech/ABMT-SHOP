'use strict';

// T7-1-2: output encoding cho du lieu dua vao HTML truc tiep tu EJS.
// Khong sanitize/luu du lieu; chi ma hoa tai diem render.

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value) {
  const text = value === undefined || value === null ? '' : String(value);
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

const ALLOWED_ABSOLUTE_SCHEMES = new Set(['http', 'https']);

/**
 * Tra ve href an toan de dua vao attribute cua the <a>.
 * - Tu choi moi scheme khac http/https (javascript:, data:, vbscript:, file:, ...).
 * - Tu choi protocol-relative (//evil.example) va cac chuoi khong co dang duong dan.
 * - Loai control characters truoc khi xet scheme de tranh "java\nscript:".
 * - Ma hoa HTML de khong thoat khoi attribute (", ', &, <, >).
 */
function safeHref(value) {
  const raw = value === undefined || value === null ? '' : String(value).trim();
  if (!raw) return '#';

  const normalized = raw.replace(/[\u0000-\u0020\u007f]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(normalized);
  if (scheme) {
    return ALLOWED_ABSOLUTE_SCHEMES.has(scheme[1].toLowerCase()) ? escapeHtml(raw) : '#';
  }

  if (raw.startsWith('/') && !raw.startsWith('//')) return escapeHtml(raw);
  if (raw.startsWith('?') || raw.startsWith('#')) return escapeHtml(raw);
  return '#';
}

module.exports = { escapeHtml, safeHref };
