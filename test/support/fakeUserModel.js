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
    setOptions() {
      return this;
    },
    lean() {
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
        status: 'active',
        isDeleted: false,
        addresses: [],
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        ...doc,
      };
      users.push(user);
      return user;
    },
    findById(id) {
      return withSelect(users.find((user) => String(user._id) === String(id)) || null);
    },
    async updateOne(filter = {}, update = {}) {
      const user = users.find((item) => String(item._id) === String(filter._id));
      if (user && update.$inc && typeof update.$inc.tokenVersion === 'number') {
        user.tokenVersion = (user.tokenVersion || 0) + update.$inc.tokenVersion;
      }
      return { modifiedCount: user ? 1 : 0 };
    },
    async findOneAndUpdate(filter = {}, update = {}, options = {}) {
      const user = users.find(
        (item) =>
          String(item._id) === String(filter._id) &&
          (filter.tokenVersion === undefined || item.tokenVersion === filter.tokenVersion) &&
          (filter.status === undefined || item.status === filter.status) &&
          (filter.isDeleted === undefined || item.isDeleted === filter.isDeleted),
      );

      if (!user) {
        return null;
      }

      if (update.$set) {
        Object.assign(user, update.$set);
      }

      if (update.$inc && typeof update.$inc.tokenVersion === 'number') {
        user.tokenVersion = (user.tokenVersion || 0) + update.$inc.tokenVersion;
      }

      return options.new || options.returnDocument === 'after' ? { ...user } : user;
    },
    async findByIdAndUpdate(id, update = {}, options = {}) {
      const index = users.findIndex((item) => String(item._id) === String(id));
      if (index === -1) {
        return null;
      }

      if (update.$set) {
        Object.assign(users[index], update.$set);
      }

      return options.new || options.returnDocument === 'after'
        ? { ...users[index] }
        : users[index];
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
