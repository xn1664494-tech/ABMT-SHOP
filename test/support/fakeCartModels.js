const mongoose = require('mongoose');

const thenable = (value, extra = {}) => ({
  ...extra,
  select() {
    return this;
  },
  populate() {
    return this;
  },
  lean() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
  catch(reject) {
    return Promise.resolve(value).catch(reject);
  },
});

const matches = (doc, filter) =>
  Object.entries(filter).every(([key, value]) => {
    if (['_id', 'user', 'product', 'sessionId'].includes(key)) {
      return String(doc[key]) === String(value);
    }
    return doc[key] === value;
  });

const createFakeCartModel = (carts = []) => ({
  carts,
  findOne(filter = {}) {
    return thenable(carts.find((cart) => matches(cart, filter)) || null);
  },
  async create(doc) {
    const cart = {
      _id: new mongoose.Types.ObjectId(),
      items: [],
      expiresAt: null,
      ...doc,
      async save() {
        return this;
      },
    };
    carts.push(cart);
    return cart;
  },
  async updateOne(filter, update) {
    const cart = carts.find((item) => matches(item, filter));
    if (!cart) return { modifiedCount: 0 };
    Object.assign(cart, update.$set || {});
    return { modifiedCount: 1 };
  },
  async deleteOne(filter) {
    const index = carts.findIndex((item) => matches(item, filter));
    if (index < 0) return { deletedCount: 0 };
    carts.splice(index, 1);
    return { deletedCount: 1 };
  },
});

const createFakeProductModel = (products = []) => ({
  products,
  findById(id) {
    return Promise.resolve(
      products.find((product) => String(product._id) === String(id)) || null,
    );
  },
  find(filter = {}) {
    const ids = filter._id && Array.isArray(filter._id.$in) ? filter._id.$in : null;
    const found = products.filter((product) => {
      if (ids && !ids.some((id) => String(id) === String(product._id))) return false;
      return Object.entries(filter).every(([key, value]) => {
        if (key === '_id') return true;
        return matches(product, { [key]: value });
      });
    });
    return thenable(found);
  },
});

const installFakeModel = (relativePath, model) => {
  const modelPath = require.resolve(relativePath);
  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: model,
  };
};

module.exports = {
  createFakeCartModel,
  createFakeProductModel,
  installFakeModel,
};
