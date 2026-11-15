/**
 * Fake model User dùng cho integration test HTTP.
 * Không kết nối MongoDB, không ghi dữ liệu thật.
 */
const createFakeUserModel = () => {
  const users = [];

  const withSelect = (result) => ({
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(result).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(result).catch(reject);
    },
  });

  return {
    users,
    findOne(filter = {}) {
      const found =
        users.find((user) =>
          Object.entries(filter).every(([key, value]) => user[key] === value),
        ) || null;
      return withSelect(found);
    },
    async create(doc) {
      if (users.some((user) => user.email === doc.email)) {
        const error = new Error('E11000 duplicate key error');
        error.code = 11000;
        error.keyValue = { email: doc.email };
        throw error;
      }
      const user = {
        _id: String(users.length + 1),
        tokenVersion: 0,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        ...doc,
      };
      users.push(user);
      return user;
    },
    async findById(id) {
      return withSelect(users.find((user) => String(user._id) === String(id)) || null);
    },
    async updateOne(filter = {}, update = {}) {
      const user = users.find((item) => String(item._id) === String(filter._id));
      if (user && update.$inc && typeof update.$inc.tokenVersion === 'number') {
        user.tokenVersion = (user.tokenVersion || 0) + update.$inc.tokenVersion;
      }
      return { modifiedCount: user ? 1 : 0 };
    },
  };
};

const installFakeUserModel = (model) => {
  const modelPath = require.resolve('../../src/model/User');
  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: model,
  };
};

module.exports = { createFakeUserModel, installFakeUserModel };
