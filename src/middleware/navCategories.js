const { getCategorySnapshot } = require('../services/categoryCacheService');

const MAX_CHILDREN = 8;

const buildNavCategories = (categories = []) => {
  const visible = categories.filter((category) => category.isVisible !== false);
  const byParent = new Map();

  for (const category of visible) {
    const key = category.parentId ? category.parentId.toString() : '';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(category);
  }

  return (byParent.get('') || []).map((root) => ({
    name: root.name,
    slug: root.slug,
    children: (byParent.get(root._id.toString()) || [])
      .slice(0, MAX_CHILDREN)
      .map((child) => ({ name: child.name, slug: child.slug })),
  }));
};

const loadNavCategories = async () => {
  const all = await getCategorySnapshot();
  return buildNavCategories(all);
};

function navCategories(req, res, next) {
  loadNavCategories()
    .then((roots) => { res.locals.navCategories = roots; })
    .catch(() => { res.locals.navCategories = []; })
    .then(() => next());
}

module.exports = { buildNavCategories, navCategories };
