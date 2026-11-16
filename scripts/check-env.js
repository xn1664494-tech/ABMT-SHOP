/**
 * Kiem tra bien moi truong bat buoc ma KHONG in gia tri bi mat.
 * Cach dung: node scripts/check-env.js
 */
require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
const optional = [
  'NODE_ENV',
  'PORT',
  'DB_MAX_RETRIES',
  'DB_RETRY_DELAY_MS',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'APP_ORIGIN',
  'AUTH_RATE_LIMIT_WINDOW_MS',
  'AUTH_RATE_LIMIT_MAX',
];

const status = (name) => {
  const value = process.env[name];
  if (!value || !String(value).trim()) return 'MISSING';
  return `SET (${String(value).length} ky tu)`;
};

let failed = false;

console.log('Bien moi truong bat buoc:');
for (const name of required) {
  const state = status(name);
  if (state === 'MISSING') failed = true;
  console.log(`- ${name}: ${state}`);
}

console.log('\nBien moi truong tuy chon:');
for (const name of optional) {
  console.log(`- ${name}: ${status(name)}`);
}

if (process.env.MONGODB_URI && /^mongodb(\+srv)?:\/\//.test(process.env.MONGODB_URI)) {
  const withoutParams = process.env.MONGODB_URI.split('?')[0];
  const scheme = withoutParams.startsWith('mongodb+srv://') ? 'mongodb+srv' : 'mongodb';
  console.log(`\nMONGODB_URI: scheme=${scheme}, dinh dang hop le`);
} else if (process.env.MONGODB_URI) {
  failed = true;
  console.log('\nMONGODB_URI: SAI DINH DANG');
}

if (failed) {
  console.error('\nThieu hoac sai cau hinh bat buoc. Xem .env.example.');
  process.exit(1);
}

console.log('\nCau hinh bat buoc da san sang.');
