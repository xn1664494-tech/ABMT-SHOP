'use strict';

const MASK = String.fromCharCode(0x2022);

function maskPhone(phone) {
  const raw = phone === null || phone === undefined ? '' : String(phone);
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }
  const last3 = digits.slice(-3);
  const masked = MASK.repeat(Math.max(0, digits.length - 3));
  return masked + last3;
}

module.exports = { maskPhone };