'use strict';

// T7-1-2: kiem tra output encoding tai diem render cho mega menu cua header.
// Khong sanitize du lieu DB/API; chi kiem tra HTML tra ve.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

const { escapeHtml, safeHref } = require('../src/utils/htmlSafety');

const VIEWS_DIR = path.join(__dirname, '..', 'src', 'views');
const HEADER = path.join(VIEWS_DIR, 'partials', 'header.ejs');

const renderHeader = (navCategories) =>
  new Promise((resolve, reject) => {
    ejs.renderFile(
      HEADER,
      { cspNonce: 'nonce-test', navCategories, escapeHtml, safeHref },
      (err, html) => (err ? reject(err) : resolve(html))
    );
  });

const navRoots = (childNameNu) => [
  { name: 'Nam', slug: 'nam', children: [{ name: 'Áo thun', slug: 'ao-thun-nam' }] },
  { name: 'Nữ', slug: 'nu', children: [{ name: childNameNu, slug: 'ao-nu' }] },
];

test('T7-1-2: XSS payload trong ten danh muc duoc escape tai diem render', async () => {
  const payload = '<img src=x onerror=alert(1)>';
  const html = await renderHeader(navRoots(payload));

  assert.equal(html.includes(payload), false);
  assert.doesNotMatch(html, /<img[^>]+onerror/i);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('T7-1-2: XSS payload trong tieu de cot va ten lien ket duoc escape', async () => {
  const payload = '<script>alert(2)</script>';
  const html = await renderHeader(navRoots(payload));

  assert.equal(html.includes(payload), false);
  assert.doesNotMatch(html, /<script>alert\(2\)<\/script>/);
  assert.match(html, /<h4>&lt;script&gt;alert\(2\)&lt;\/script&gt;<\/h4>/);
  assert.match(html, />&lt;script&gt;alert\(2\)&lt;\/script&gt;<\/a>/);
});

test('T7-1-2: ky tu HTML hop le van hien thi dang da escape', async () => {
  const html = await renderHeader(navRoots('Áo <b>đẹp</b> & basic'));

  assert.match(html, /&lt;b&gt;đẹp&lt;\/b&gt; &amp; basic/);
  assert.doesNotMatch(html, /<b>đẹp<\/b>/);
});

test('T7-1-2: slug doc hai duoc ma hoa truoc khi vao href', async () => {
  const html = await renderHeader([
    {
      name: 'Nam',
      slug: 'x" onmouseover="alert(1)',
      children: [{ name: 'Áo', slug: 'y" onfocus="alert(2)' }],
    },
    { name: 'Nữ', slug: 'nu', children: [{ name: 'Váy', slug: 'vay' }] },
  ]);

  assert.doesNotMatch(html, /onmouseover=|onfocus=/);
  assert.match(html, /category=x%22%20onmouseover%3D%22alert\(1\)/);
  assert.match(html, /category=y%22%20onfocus%3D%22alert\(2\)/);
});

test('T7-1-2: tu choi scheme nguy hiem va duong dan protocol-relative', () => {
  const bad = [
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'java\nscript:alert(1)',
    'javascript&#58;alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'about:blank',
    'admin:alert(1)',
    '//evil.example/x',
    '  javascript:alert(1)',
    '',
  ];

  for (const href of bad) assert.equal(safeHref(href), '#', href);
});

test('T7-1-2: giu nguyen href hop le va escape attribute', () => {
  assert.equal(safeHref('/catalog?category=nam'), '/catalog?category=nam');
  assert.equal(safeHref('/catalog?sort=newest&new=1'), '/catalog?sort=newest&amp;new=1');
  assert.equal(safeHref('/catalog?a="x"'), '/catalog?a=&quot;x&quot;');
  assert.equal(safeHref('https://example.com/a?x=1&y=2'), 'https://example.com/a?x=1&amp;y=2');
  assert.equal(safeHref('HTTP://example.com/a'), 'HTTP://example.com/a');
  assert.equal(safeHref('#section-new'), '#section-new');
  assert.equal(safeHref('?sort=price_asc&view=grid'), '?sort=price_asc&amp;view=grid');
});

test('T7-1-2: moi raw <%- %> trong src/views nam trong danh sach phan loai', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ejs')) files.push(full);
    }
  };
  walk(VIEWS_DIR);
  assert.ok(files.length > 0);

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/<%-([\s\S]*?)%>/g)) {
      const expr = match[1].trim();
      const allowed =
        expr.startsWith('include(') ||
        expr.startsWith('navActive ===') ||
        expr.startsWith('tab.isActive ?') ||
        (expr.startsWith('JSON.stringify(') && expr.includes('replace(')) ||
        expr.startsWith('renderMega(');

      assert.ok(allowed, `${path.relative(VIEWS_DIR, file)}: raw EJS ngoai danh sach -> ${expr}`);
    }
  }
});

test('T7-1-2: renderMega dung escapeHtml/safeHref cho moi truong du lieu', () => {
  const source = fs.readFileSync(HEADER, 'utf8');

  for (const snippet of [
    'safeHref(link.href)',
    'escapeHtml(link.name)',
    'escapeHtml(col.title)',
    'escapeHtml(root.name)',
    "safeHref(rootHref(root, '/catalog'))",
  ]) {
    assert.ok(source.includes(snippet), `thieu ${snippet}`);
  }
});
