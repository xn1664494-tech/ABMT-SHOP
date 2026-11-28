const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters-long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.APP_ORIGIN = 'http://localhost:3000';

const { createFakeUserModel, installFakeUserModel } = require('./support/fakeUserModel');
const { installFakeModel } = require('./support/fakeCartModels');

installFakeUserModel(createFakeUserModel());

const emptyQuery = () => {
  const query = {
    sort() { return query; },
    select() { return query; },
    lean() { return Promise.resolve([]); },
    then(resolve, reject) { return Promise.resolve([]).then(resolve, reject); },
    catch(reject) { return Promise.resolve([]).catch(reject); },
  };
  return query;
};
installFakeModel('../../src/model/Category', { find: () => emptyQuery() });

const request = require('supertest');
const app = require('../src/app');

const NONCE_RE = /'nonce-([A-Za-z0-9+/]{22}==)'/;

const extractNonce = (res) => {
  const csp = res.headers['content-security-policy'];
  assert.ok(csp, 'Thieu CSP header');
  const match = csp.match(NONCE_RE);
  assert.ok(match, 'CSP nonce sai format: ' + csp);
  return match[1];
};

test('T7-1-1: CSP co nonce rieng cho moi request', async () => {
  const first = await request(app).get('/health');
  const second = await request(app).get('/health');

  assert.equal(first.status, 200);
  const nonceA = extractNonce(first);
  const nonceB = extractNonce(second);
  assert.notEqual(nonceA, nonceB, 'Nonce khong duoc tai su dung giua cac request');
});

test('T7-1-1: nonce trong HTML khop header va script-src khong co unsafe-inline/unsafe-eval', async () => {
  const res = await request(app).get('/login');
  assert.equal(res.status, 200);

  const nonce = extractNonce(res);
  // nonce base64 co chua '+'/'=' -> so sanh chuoi truc tiep, khong dung RegExp.
  assert.ok(res.text.includes('<style nonce="' + nonce + '">'), 'Thieu style nonce khong khop header');
  assert.ok(res.text.includes('<script nonce="' + nonce + '">'), 'Thieu script nonce khong khop header');

  const csp = res.headers['content-security-policy'];
  const scriptSrc = csp
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('script-src '));
  assert.ok(scriptSrc, 'Thieu script-src directive');
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'/);
  assert.doesNotMatch(scriptSrc, /'unsafe-eval'/);
});

test('T7-1-1: CSP cho phep CDN/font hien co va style-src-attr duoc khai bao ro', async () => {
  const res = await request(app).get('/login');
  const csp = res.headers['content-security-policy'];

  assert.match(csp, /script-src[^;]*https:\/\/cdn\.jsdelivr\.net/);
  assert.match(csp, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /img-src[^;]*https:/);
  assert.match(csp, /style-src-attr[^;]*'unsafe-inline'/);
});

test('T7-1-1: moi inline script/style trong EJS deu co nonce cspNonce', () => {
  const viewsDir = path.join(__dirname, '..', 'src', 'views');
  const files = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ejs')) files.push(full);
    }
  };
  walk(viewsDir);

  assert.ok(files.length > 0, 'Khong tim thay file EJS');

  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!/<(script|style)\b/.test(line)) continue;
      // <script src="..."> duoc phu boi 'self' -> khong can nonce.
      if (/<script\b[^>]*\bsrc\s*=/.test(line)) continue;
      assert.match(
        line,
        /nonce="<%=\s*cspNonce\s*%>"/,
        `${path.relative(process.cwd(), file)}: ${line.trim()}`,
      );
    }
  }
});
