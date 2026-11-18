// tests/setup.js - chạy trước mỗi file test (setupFilesAfterEnv trong jest.config.js)
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

// 1) Nạp biến môi trường test (không đụng tới file .env của dev)
dotenv.config({ path: path.resolve(__dirname, "../.env.test"), quiet: true });
process.env.NODE_ENV = "test";

const LEGACY_URI = process.env.TEST_MONGODB_URI;
const uri = process.env.MONGODB_URI_TEST || LEGACY_URI;

if (!process.env.MONGODB_URI_TEST && LEGACY_URI) {
  console.warn(
    "[deprecated] TEST_MONGODB_URI đã được thay bằng MONGODB_URI_TEST; tên cũ sẽ bị bỏ sau 1 sprint.",
  );
}

// Lấy tên database từ chuỗi kết nối: mongodb(+srv)://host/<dbName>?options
const getDbName = (connectionString) => {
  const match = /^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/.exec(connectionString || "");
  return match ? decodeURIComponent(match[1]) : "";
};

// 2) Chốt chặn an toàn TRƯỚC khi kết nối (tránh xóa nhầm dữ liệu thật)
if (!uri) {
  throw new Error("Thiếu MONGODB_URI_TEST. Hãy tạo file .env.test từ .env.test.example.");
}
if (!/test/i.test(getDbName(uri))) {
  throw new Error(
    `Tên database trong MONGODB_URI_TEST phải chứa "test" (hiện tại: "${getDbName(uri) || "(trống)"}"). Dừng để tránh xóa nhầm dữ liệu thật.`,
  );
}
if (process.env.MONGODB_URI && process.env.MONGODB_URI === uri) {
  throw new Error("MONGODB_URI_TEST không được trùng MONGODB_URI (CSDL dev/production).");
}

// Nếu code trong src/ gọi connectDB() (đọc MONGODB_URI) thì cũng trỏ về CSDL test.
process.env.MONGODB_URI = uri;

// 3) Kết nối trước khi chạy test
beforeAll(async () => {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  if (!/test/i.test(mongoose.connection.name)) {
    await mongoose.disconnect();
    throw new Error(
      `Đang kết nối nhầm database "${mongoose.connection.name}" (không phải CSDL test). Đã ngắt kết nối.`,
    );
  }
}, 30000);

// 4) Dọn dữ liệu sau mỗi test
afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
});

// 5) Đóng kết nối khi xong
afterAll(async () => {
  await mongoose.disconnect();
});
