const mongoose = require('mongoose');
const Order = require('../model/Order');
const Cart = require('../model/Cart');
const ErrorResponse = require('../utils/appError');
const { decrementStock, restoreStock } = require('./ProductsServices');

async function createOrder({ userId, orderPayload, selectedItemId }) {
  const deductions = (orderPayload.items || []).map((item) => ({
    productId: item.product,
    variantSku: item.sku,
    qty: item.qty,
  }));

  let stockDeducted = false;
  let order = null;

  try {
    await decrementStock(deductions);
    stockDeducted = true;

    order = await Order.create({
      ...orderPayload,
      user: userId,
      paymentStatus: 'unpaid',
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          at: new Date(),
          by: userId,
          note: 'Tạo đơn hàng',
        },
      ],
    });

    if (selectedItemId) {
      const itemObjectId = new mongoose.Types.ObjectId(selectedItemId);
      const result = await Cart.updateOne(
        { user: userId, 'items._id': itemObjectId },
        { $pull: { items: { _id: itemObjectId } } }
      );

      if (!result.matchedCount) {
        throw new ErrorResponse('Giỏ hàng đã thay đổi, vui lòng thử lại', 409);
      }
    } else {
      const result = await Cart.deleteOne({ user: userId });

      if (!result.deletedCount) {
        throw new ErrorResponse('Giỏ hàng đã thay đổi, vui lòng thử lại', 409);
      }
    }

    return order;
  } catch (error) {
    if (order) {
      await Order.deleteOne({ _id: order._id, status: 'pending' });
    }

    if (stockDeducted) {
      await restoreStock(deductions);
    }

    throw error;
  }
}

module.exports = { createOrder };
