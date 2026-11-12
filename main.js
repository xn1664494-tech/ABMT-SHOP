require('dotenv').config();
const express = require("express");
const app = express();
const connectDB = require("./src/config/db");


const port = process.env.PORT || 3000;

connectDB().then(() => {
  app.listen(port, () => {
    console.log("Server đang chạy trên cổng:", port);
  });
});
