const Category = require('../model/Category');

const DEFAULT_TTL_MS = 60 * 1000;
const configuredTtl = Number(process.env.CATEGORY_CACHE_TTL_MS);
const CACHE_TTL_MS =
  Number.isFinite(configuredTtl) && configuredTtl >= 0 ? configuredTtl : DEFAULT_TTL_MS;

let snapshot = null;
let snapshotGeneration = -1;
let generation = 0;
let cachedAt = 0;
let inflight = null;

const invalidateCategoryCache = () => {
  generation += 1;
  snapshot = null;
  snapshotGeneration = -1;
  cachedAt = 0;
};

const loadSnapshot = () =>
  Category.find({ isDeleted: false })
    .sort({ order: 1, name: 1, createdAt: 1 })
    .select('_id name slug parentId order isVisible createdAt updatedAt')
    .lean();

const getCategorySnapshot = async () => {
  const now = Date.now();
  if (snapshot && snapshotGeneration === generation && now - cachedAt < CACHE_TTL_MS) {
    return snapshot;
  }
  if (inflight) return inflight;

  const currentGeneration = generation;
  inflight = loadSnapshot()
    .then((docs) => {
      if (currentGeneration === generation) {
        snapshot = docs;
        snapshotGeneration = generation;
        cachedAt = Date.now();
      }
      return docs;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
};

const getCategoryCacheStats = () => ({
  hasSnapshot: Boolean(snapshot),
  size: snapshot ? snapshot.length : 0,
  cachedAt,
  ttlMs: CACHE_TTL_MS,
  generation,
  inFlight: Boolean(inflight),
});

module.exports = {
  CACHE_TTL_MS,
  getCategorySnapshot,
  getCategoryCacheStats,
  invalidateCategoryCache,
};
