require('dotenv').config();
const express = require('express');
const path = require('path');
const app = require('./app');
const connectDB = require('./config/db');

const port = process.env.PORT || 3000;

// Chỉ khởi động HTTP server khi chạy trực tiếp (không phải khi test require).
if (require.main === module) {
  connectDB()
    .then(() => {
      app.listen(port, () => {
        console.log(`Server dang chay tren cong: ${port}`);
      });
    })
    .catch((error) => {
      console.error('Khong the ket noi MongoDB:', error.message);
      process.exit(1);
    });
}

// Cấu hình cache tài nguyên tĩnh
app.use(express.static(path.join(__dirname, '..', 'public')));
// Thêm header Cache-Control cho các loại file tĩnh (ảnh/font/css/js)
// Express.static đã bật etag mặc định; setHeaders không hoạt động ở Express 5.x qua phương thức này,
// nên dùng middleware sau để inject header (chỉ cho file tĩnh, KHÔNG cho /api và HTML/EJS)
app.use((req, res, next) => {
  const origSetHeader = res.setHeader;
  if (req.path && req.path.startsWith('/') && !req.path.startsWith('/api') && !req.path.startsWith('/')) {
    const ext = req.path.split('.').pop().toLowerCase();
    const isStatic = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'woff', 'woff2', 'ttf', 'eot', 'css', 'js'].includes(ext);
    if (isStatic) {
      const maxAge = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'woff', 'woff2', 'ttf', 'eot'].includes(ext) ? 604800 : 86400;
      // Sử dụng original setHeader nhưng thêm max-age
      res.setHeader('Cache-Control', 'public, max-age=' + maxAge);
    }
  }
  next();
});

module.exports = app;
