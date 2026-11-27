const User = require('../model/User');
const ErrorResponse = require('../utils/appError');
const {
  AUDIT_ACTIONS,
  TARGET_TYPES,
  buildAuditEvent,
  publishAuditEvent,
} = require('./auditEvent');
const {
  buildPagination,
  escapeRegex,
  isObjectId,
} = require('../utils/productFilter');

// Chỉ các trường cần cho giao diện quản trị. Không bao giờ select password,
// reset token, tokenVersion hay các field nội bộ khác.
const ADMIN_USER_FIELDS = 'name email role status phone createdAt';

/**
 * Chuẩn hóa user cho response admin. Dùng whitelist thay vì trả document thô.
 */
const toAdminUser = (user) => ({
  id: String(user._id || user.id),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  phone: user.phone || null,
  createdAt: user.createdAt,
});

/**
 * Danh sách người dùng có phân trang và tìm kiếm theo name/email.
 * Soft-delete plugin của User tự loại bản ghi đã xóa; filter isDeleted:false
 * được khai báo tường minh để hành vi rõ ràng và dễ test.
 */
const listUsers = async (query = {}) => {
  const { page, limit, skip } = buildPagination(query);
  const filter = { isDeleted: false };

  const keyword = typeof query.q === 'string' ? query.q.trim() : '';
  if (keyword) {
    const pattern = escapeRegex(keyword);
    filter.$or = [
      { name: { $regex: pattern, $options: 'i' } },
      { email: { $regex: pattern, $options: 'i' } },
    ];
  }

  const findQuery = User.find(filter)
    .select(ADMIN_USER_FIELDS)
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const [total, users] = await Promise.all([
    User.countDocuments(filter),
    findQuery,
  ]);

  const items = (users || []).map(toAdminUser);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      itemCount: items.length,
    },
  };
};

/**
 * Đổi role của một user.
 * - Chỉ admin gọi được (route đã chặn bằng authorize('admin')).
 * - Admin không được tự hạ quyền chính mình.
 * - Role trùng role hiện tại: trả 200, changed=false (idempotent).
 */
const updateUserRole = async ({ targetUserId, role, actor }) => {
  if (!isObjectId(targetUserId)) {
    throw new ErrorResponse('Id nguoi dung khong hop le', 400);
  }

  const actorId = String(actor._id || actor.id).trim().toLowerCase();
  // ObjectId hex không phân biệt hoa/thường nên phải chuẩn hóa trước khi so
  // sánh, tránh lách guard tự hạ quyền bằng ID viết hoa.
  const isSelf = actorId === String(targetUserId).trim().toLowerCase();

  if (isSelf && role !== actor.role) {
    throw new ErrorResponse('Khong the tu ha quyen cua chinh minh', 403);
  }

  const existing = await User.findById(targetUserId).select(ADMIN_USER_FIELDS);
  if (!existing) {
    throw new ErrorResponse('Nguoi dung khong ton tai', 404);
  }

  if (existing.role === role) {
    return {
      user: toAdminUser(existing),
      changed: false,
    };
  }

  const updated = await User.findByIdAndUpdate(
    targetUserId,
    { $set: { role } },
    { new: true, runValidators: true },
  );

  if (!updated) {
    throw new ErrorResponse('Nguoi dung khong ton tai', 404);
  }

  // Audit publish fail-open: loi ghi log khong rollback viec doi role da luu.
  await publishAuditEvent(
    buildAuditEvent({
      actorId: actor._id || actor.id,
      actorRole: actor.role,
      action: AUDIT_ACTIONS.ADMIN_ROLE_CHANGED,
      targetType: TARGET_TYPES.USER,
      targetId: targetUserId,
      before: { role: existing.role },
      after: { role },
    }),
  );

  return {
    user: toAdminUser(updated),
    changed: true,
  };
};

module.exports = {
  ADMIN_USER_FIELDS,
  listUsers,
  toAdminUser,
  updateUserRole,
};
