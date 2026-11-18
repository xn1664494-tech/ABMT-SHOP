require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const viewEngine = require('./config/viewEngine');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

viewEngine(app);
app.use('/', routes);
app.use(errorHandler);

if (require.main === module) {
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
}

module.exports = app;
