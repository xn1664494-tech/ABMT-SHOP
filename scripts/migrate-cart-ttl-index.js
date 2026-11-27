/**
 * T5-2-3 — Di chuyển TTL index của carts về expireAfterSeconds = 0.
 *
 * Chạy: MIGRATE_CONFIRM=1 npm run migrate:cart-ttl
 *   - Dùng chung MONGODB_URI với app (xem src/config/db.js).
 *   - Chạy TRƯỚC khi deploy code mới / restart app để tránh IndexOptionsConflict.
 *   - Idempotent: nếu index đã đúng thì không làm gì.
 *   - Dev và Atlas đều dùng được; ưu tiên collMod, fallback drop/recreate.
 */
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');

const COLLECTION = 'carts';
const TTL_KEY = { expiresAt: 1 };
const TTL_OPTIONS = { expireAfterSeconds: 0 };

const findTtlIndex = (indexes = []) =>
  indexes.find(
    (index) =>
      index.key &&
      index.key.expiresAt === 1 &&
      Object.keys(index.key).length === 1,
  );

const migrate = async () => {
  if (process.env.MIGRATE_CONFIRM !== '1') {
    console.error(
      'Can xac nhan: MIGRATE_CONFIRM=1 npm run migrate:cart-ttl',
    );
    process.exitCode = 1;
    return;
  }

  await connectDB();

  const db = mongoose.connection.db;
  const collection = db.collection(COLLECTION);
  const before = await collection.indexes();
  const current = findTtlIndex(before);

  if (!current) {
    await collection.createIndex(TTL_KEY, TTL_OPTIONS);
    console.log('[migrate] da tao TTL index expireAfterSeconds=0');
  } else if (current.expireAfterSeconds !== 0) {
    console.log(
      `[migrate] TTL index dang co expireAfterSeconds=${current.expireAfterSeconds}; chuyen ve 0`,
    );

    try {
      await db.command({
        collMod: COLLECTION,
        index: { keyPattern: TTL_KEY, expireAfterSeconds: 0 },
      });
      console.log('[migrate] collMod thanh cong');
    } catch (error) {
      console.warn(
        `[migrate] collMod that bai (${error.message}); fallback drop/recreate`,
      );
      await collection.dropIndex(current.name);
      await collection.createIndex(TTL_KEY, TTL_OPTIONS);
      console.log('[migrate] drop/recreate thanh cong');
    }
  } else {
    console.log('[migrate] TTL index da dung, bo qua');
  }

  const after = await collection.indexes();
  const verified = findTtlIndex(after);
  console.log('[migrate] index sau di chuyen:', JSON.stringify(verified));

  if (!verified || verified.expireAfterSeconds !== 0) {
    throw new Error('Xac minh TTL index that bai');
  }
};

migrate()
  .catch((error) => {
    console.error('[migrate] loi:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
