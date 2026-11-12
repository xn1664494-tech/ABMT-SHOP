/**
 * Bọc async controller/handler để lỗi trong promise
 * được chuyển tới errorHandler qua next(err).
 *
 * Dùng: router.get('/', asyncHandler(async (req, res) => { ... }))
 */
const asyncHandler = (fn) => (req, res, next) => {
    return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
