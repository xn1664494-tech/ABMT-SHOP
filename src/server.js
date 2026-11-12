require('dotenv').config();
const express = require("express");
const app = express();
const { connectDB, disconnectDB } = require("./config/db");

const port = process.env.PORT || 3000;
const SHUTDOWN_TIMEOUT_MS = 10000;

connectDB()
  .then(() => {
    const server = app.listen(port, () => {
      console.log("Server đang chạy trên cổng:", port);
    });

    const shutdown = (signal) => {
      console.log(`Nhận ${signal}, đang tắt server...`);

      const forceExit = setTimeout(() => {
        console.error("Quá thời gian chờ, buộc thoát.");
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      forceExit.unref();

      server.close(async () => {
        try {
          await disconnectDB();
          clearTimeout(forceExit);
          console.log("Đã đóng server và ngắt kết nối MongoDB.");
          process.exit(0);
        } catch (error) {
          console.error("Lỗi khi ngắt kết nối MongoDB:", error.message);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  })
  .catch((error) => {
    console.error("Không thể kết nối MongoDB:", error.message);
    process.exit(1);
  });
