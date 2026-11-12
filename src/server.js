require('dotenv').config();
const express = require('express');
const app = express();
const connectDB = require('./config/db');
const notFound = require('./middleware/404');
const errorHandler = require('./middleware/errorHandler');

const port = process.env.PORT || 3000;

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// TODO: gắn routes tại đây khi hoàn thiện
// app.use('/api/products', require('./routes/products.route'));

// 404 cho route không khớp
app.use(notFound);

// Xử lý lỗi tập trung — luôn đặt CUỐI CÙNG, sau routes và 404
app.use(errorHandler);

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server đang chạy trên cổng: ${port}`);
    });
  })
  .catch((error) => {
    console.error('Không thể kết nối MongoDB:', error.message);
    process.exit(1);
  });
