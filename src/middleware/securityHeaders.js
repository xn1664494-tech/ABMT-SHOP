const crypto = require('crypto');
const helmet = require('helmet');

const NONCE_BYTES = 16;

/**
 * T7-1-1: tao nonce moi cho moi request. res.locals duoc Express tron vao
 * res.render(), nen template co the dung <%= cspNonce %> cho inline script/style.
 */
const attachCspNonce = (req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(NONCE_BYTES).toString('base64');
  next();
};

/**
 * Helmet CSP voi nonce.
 * - script-src: khong dung 'unsafe-inline' / 'unsafe-eval'.
 * - style-src: nonce cho cac block <style>; allow Google Fonts.
 * - style-src-attr: giu 'unsafe-inline' vi 14 thuoc tinh style="" con lai
 *   trong EJS; CSP3 khong ap dung nonce cho style attribute. Ghi ro trong report.
 * - font-src: allow Google Fonts static.
 * - img-src: allow https: vi anh san pham duoc luu tren CDN ngoai (seed dung
 *   cdn.example.com); giu 'self' va data: cho placeholder/noi bo.
 * - script-src: allow jsDelivr (Chart.js) va nonce cho inline script.
 * - upgrade-insecure-requests: bo qua de khong ep http://localhost sang https.
 *   Production ket thuc TLS tai reverse proxy.
 * - crossOriginEmbedderPolicy: tat de khong chan CDN/font khong co CORP header.
 */
const helmetMiddleware = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      'base-uri': ["'self'"],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'object-src': ["'none'"],
      'script-src': [
        "'self'",
        (req, res) => `'nonce-${res.locals.cspNonce}'`,
        'https://cdn.jsdelivr.net',
      ],
      'script-src-attr': ["'none'"],
      'style-src': [
        "'self'",
        (req, res) => `'nonce-${res.locals.cspNonce}'`,
        'https://fonts.googleapis.com',
      ],
      'style-src-attr': ["'unsafe-inline'"],
      'upgrade-insecure-requests': null,
    },
  },
});

const securityHeaders = (req, res, next) =>
  attachCspNonce(req, res, () => helmetMiddleware(req, res, next));

module.exports = securityHeaders;
module.exports.attachCspNonce = attachCspNonce;
