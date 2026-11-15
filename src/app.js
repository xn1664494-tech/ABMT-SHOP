const express = require('express');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const notFound = require('./middleware/404');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api', routes);

// 404 cho route không khớp — sau toàn bộ routes
app.use(notFound);

// Xử lý lỗi tập trung — luôn đặt CUỐI CÙNG
app.use(errorHandler);

module.exports = app;
