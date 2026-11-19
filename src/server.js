require('dotenv').config();
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

module.exports = app;
