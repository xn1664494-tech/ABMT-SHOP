require('dotenv').config();
const mongoose = require('mongoose');

const MAX_RETRIES = Number(process.env.DB_MAX_RETRIES) || 5;
const RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS) || 3000;

const connectOptions = {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  autoIndex: process.env.NODE_ENV !== 'production',
};

let eventsRegistered = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const registerEvents = () => {
  if (eventsRegistered) return;
  eventsRegistered = true;

  const { connection } = mongoose;
  connection.on('connected', () => {
    console.log(`MongoDB Connected: ${connection.host}`);
  });
  connection.on('error', (error) => {
    console.error('MongoDB error:', error.message);
  });
  connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });
  connection.on('reconnected', () => {
    console.log('MongoDB reconnected');
  });
};

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('Thiếu MONGODB_URI trong file .env');
  }

  registerEvents();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await mongoose.connect(uri, connectOptions);
      return mongoose.connection;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = RETRY_DELAY_MS * attempt;
      console.warn(
        `Kết nối MongoDB thất bại (lần ${attempt}/${MAX_RETRIES}): ${error.message}. Thử lại sau ${delay}ms`,
      );
      await sleep(delay);
    }
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;
