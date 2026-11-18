require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const viewEngine = require('./config/viewEngine');

const app = express();
const port = process.env.PORT || 3000;

viewEngine(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', routes);
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
