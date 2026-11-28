const buildChildrenMap = (categories = []) => {
  const map = new Map();

  for (const category of categories || []) {
    if (!category || !category.parentId) continue;
    const parentId = String(category.parentId);
    if (!map.has(parentId)) map.set(parentId, []);
    map.get(parentId).push(category);
  }

  return map;
};

const collectDescendantIds = (rootId, categories = []) => {
  const childrenMap = buildChildrenMap(categories);
  const root = String(rootId);
  const ids = [root];
  const seen = new Set(ids);
  const queue = [root];

  while (queue.length) {
    const current = queue.shift();
    for (const child of childrenMap.get(current) || []) {
      const childId = String(child._id);
      if (seen.has(childId)) continue;
      seen.add(childId);
      ids.push(childId);
      queue.push(childId);
    }
  }

  return ids;
};

module.exports = {
  buildChildrenMap,
  collectDescendantIds,
};
