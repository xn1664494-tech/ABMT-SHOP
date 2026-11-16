const express = require('express');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const notFound = require('./middleware/404');
const errorHandler = require('./middleware/errorHandler');
const configViewEngine = require('./config/viewEngine');

const app = express();

// View engine (EJS) + static files — bổ sung từ nhánh UI
configViewEngine(app);

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes — API dưới /api, đồng thời mount gốc cho trang chủ (EJS)
app.use('/api', routes);
app.use('/', routes);

// 404 cho route không khớp — sau toàn bộ routes
app.use(notFound);

// Xử lý lỗi tập trung — luôn đặt CUỐI CÙNG
app.use(errorHandler);

module.exports = app;
