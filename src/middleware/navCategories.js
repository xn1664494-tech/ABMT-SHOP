const Category = require('../model/Category');

const CACHE_TTL = 60 * 1000;
const MAX_CHILDREN = 8;

let cached = null;
let cachedAt = 0;

async function loadNavCategories() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL) return cached;

  const all = await Category.find({ isDeleted: false })
    .sort({ order: 1, name: 1 })
    .select('name slug parentId order')
    .lean();

  const byParent = new Map();
  for (const cat of all) {
    const key = cat.parentId ? cat.parentId.toString() : '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(cat);
  }

  const roots = (byParent.get('') || []).map((root) => ({
    name: root.name,
    slug: root.slug,
    children: (byParent.get(root._id.toString()) || [])
      .slice(0, MAX_CHILDREN)
      .map((child) => ({ name: child.name, slug: child.slug })),
  }));

  cached = roots;
  cachedAt = now;
  return roots;
}

function navCategories(req, res, next) {
  loadNavCategories()
    .then((roots) => { res.locals.navCategories = roots; })
    .catch(() => { res.locals.navCategories = []; })
    .then(() => next());
}

module.exports = { navCategories };
