// Khai báo ứng dụng Express (KHÔNG gọi listen / connectDB ở đây).
// Tách riêng khỏi server.js để Supertest import được mà không mở cổng.
const express = require("express");

const app = express();

// TODO: các middleware / routes sẽ do Dev 1-3 bổ sung tại đây

module.exports = app;
