const test = require('node:test');
const assert = require('node:assert/strict');
const { getFlash } = require('../src/utils/flash');

test('getFlash: request rong tra mang rong', () => {
  assert.deepEqual(getFlash({}), []);
  assert.deepEqual(getFlash(), []);
});

test('getFlash: doc query flash/success/error', () => {
  const messages = getFlash({
    query: { flash: 'Da cap nhat', type: 'success', success: 'Ok', error: 'Loi' },
  });

  assert.deepEqual(messages, [
    { type: 'success', message: 'Da cap nhat' },
    { type: 'success', message: 'Ok' },
    { type: 'error', message: 'Loi' },
  ]);
});

test('getFlash: doc cookie JSON dang object va mang', () => {
  const objectCookie = JSON.stringify({ type: 'error', message: 'Het hang' });
  assert.deepEqual(getFlash({ cookies: { flash: objectCookie } }), [
    { type: 'error', message: 'Het hang' },
  ]);

  const arrayCookie = JSON.stringify([
    { type: 'info', message: 'A' },
    'B',
    { message: 'C' },
    null,
  ]);
  assert.deepEqual(getFlash({ cookies: { flash: arrayCookie } }), [
    { type: 'info', message: 'A' },
    { type: 'info', message: 'B' },
    { type: 'info', message: 'C' },
  ]);
});

test('getFlash: cookie JSON hong khong lam crash', () => {
  assert.deepEqual(getFlash({ cookies: { flash: '{not-json' } }), []);
});
