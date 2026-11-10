require('dotenv').config();
const express = require("express");
const app = express();
const connectDB = require("./config/db");

const port = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log("Server đang chạy trên cổng:", port);
    });
  })
  .catch((error) => {
    console.error("Không thể kết nối MongoDB:", error.message);
    process.exit(1);
  });
