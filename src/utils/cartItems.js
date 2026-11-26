const mongoose = require('mongoose');

const ensureCartItemIds = (cart) => {
  let changed = false;

  for (const item of (cart && cart.items) || []) {
    if (!item._id) {
      item._id = new mongoose.Types.ObjectId();
      changed = true;
    }
  }

  return changed;
};

module.exports = { ensureCartItemIds };
