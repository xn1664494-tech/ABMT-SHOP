const express = require('express');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const apiRoutes = require('./routes/api');
const notFound = require('./middleware/404');
const errorHandler = require('./middleware/errorHandler');
const { currentUser } = require('./middleware/currentUser');
const configViewEngine = require('./config/viewEngine');

const app = express();

/**
 * Cấu hình trust proxy chỉ khi được khai báo tường minh qua biến môi trường.
 * - Không bật mặc định để tránh tin X-Forwarded-For từ client trực tiếp.
 * - Khi chạy sau reverse proxy/TLS termination (ví dụ Render/nginx), đặt
 *   TRUST_PROXY theo đúng hạ tầng (thường là số hop, ví dụ "1").
 * - Giá trị số được chuyển sang Number; giá trị khác (vd "loopback") giữ nguyên
 *   để Express tự xử lý. Không dùng giá trị không rõ ràng.
 */
const configureTrustProxy = (expressApp) => {
  const raw = process.env.TRUST_PROXY;
  if (raw === undefined || raw === null || raw === '') {
    return;
  }

  const normalized = String(raw).trim();
  if (normalized === '' || normalized === '0' || normalized.toLowerCase() === 'false') {
    return;
  }

  const numeric = Number(normalized);
  expressApp.set('trust proxy', Number.isInteger(numeric) ? numeric : normalized);
};

configureTrustProxy(app);

// View engine (EJS) + static files — bổ sung từ nhánh UI
configViewEngine(app);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware nhận biết người dùng hiện tại.
// Phải chạy trước cả /api để các route API đọc được res.locals.currentUser
// (hiện tại là /api/cart của Dev 2); middleware này không chặn request,
// nên không thay thế authenticate/authorize ở các route cần bảo vệ.
app.use(currentUser);

// Routes — API chỉ mount dưới /api, trang HTML mount dưới /
app.use('/api', apiRoutes);
app.use('/', routes);

// Smoke check: server còn sống
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

// 404 cho route không khớp — sau toàn bộ routes
app.use(notFound);

// Xử lý lỗi tập trung — luôn đặt CUỐI CÙNG
app.use(errorHandler);

module.exports = app;

