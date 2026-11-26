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

  const matchesCondition = (user, key, condition) => {
    const value = user[key];

    if (condition && typeof condition === 'object' && !(condition instanceof RegExp)) {
      if (Object.prototype.hasOwnProperty.call(condition, '$ne')) {
        return value !== condition.$ne;
      }
      if (condition.$regex !== undefined) {
        const regex =
          condition.$regex instanceof RegExp
            ? condition.$regex
            : new RegExp(condition.$regex, condition.$options || '');
        return typeof value === 'string' && regex.test(value);
      }
      return false;
    }

    return String(value) === String(condition);
  };

  const matchesFilter = (user, filter = {}) =>
    Object.entries(filter).every(([key, condition]) => {
      if (key === '$or') {
        return (
          Array.isArray(condition) &&
          condition.some((clause) => matchesFilter(user, clause))
        );
      }
      return matchesCondition(user, key, condition);
    });

  const createFindQuery = (input) => {
    let result = [...input];

    const query = {
      select() {
        return query;
      },
      setOptions() {
        return query;
      },
      sort(spec = {}) {
        const entries = Object.entries(spec);
        result = [...result].sort((left, right) => {
          for (const [key, direction] of entries) {
            const leftValue = left[key];
            const rightValue = right[key];
            if (leftValue === rightValue) continue;
            const factor = direction < 0 ? -1 : 1;
            return leftValue > rightValue ? factor : -factor;
          }
          return 0;
        });
        return query;
      },
      skip(count = 0) {
        result = result.slice(count);
        return query;
      },
      limit(count) {
        if (Number.isInteger(count) && count >= 0) {
          result = result.slice(0, count);
        }
        return query;
      },
      lean() {
        return Promise.resolve(result);
      },
      then(resolve, reject) {
        return Promise.resolve(result).then(resolve, reject);
      },
      catch(reject) {
        return Promise.resolve(result).catch(reject);
      },
    };

    return query;
  };

  return {
    users,
    find(filter = {}) {
      return createFindQuery(users.filter((user) => matchesFilter(user, filter)));
    },
    async countDocuments(filter = {}) {
      return users.filter((user) => matchesFilter(user, filter)).length;
    },
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
      return withSelect(users.find((user) => String(user._id).toLowerCase() === String(id).toLowerCase()) || null);
    },
    async updateOne(filter = {}, update = {}) {
      const user = users.find((item) => String(item._id).toLowerCase() === String(filter._id).toLowerCase());
      if (user && update.$inc && typeof update.$inc.tokenVersion === 'number') {
        user.tokenVersion = (user.tokenVersion || 0) + update.$inc.tokenVersion;
      }
      return { modifiedCount: user ? 1 : 0 };
    },
    async findOneAndUpdate(filter = {}, update = {}, options = {}) {
      const user = users.find(
        (item) =>
          String(item._id).toLowerCase() === String(filter._id).toLowerCase() &&
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
      const index = users.findIndex((item) => String(item._id).toLowerCase() === String(id).toLowerCase());
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
