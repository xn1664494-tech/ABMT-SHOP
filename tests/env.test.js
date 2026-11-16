const { connectDB } = require("../src/config/db");

describe("Validate biến môi trường", () => {
  const original = process.env.MONGODB_URI;

  // Khôi phục để không ảnh hưởng các test khác
  afterEach(() => {
    process.env.MONGODB_URI = original;
  });

  test("connectDB ném lỗi khi thiếu MONGODB_URI", async () => {
    delete process.env.MONGODB_URI;
    await expect(connectDB()).rejects.toThrow("Thiếu MONGODB_URI");
  });

  test("connectDB ném lỗi khi MONGODB_URI rỗng", async () => {
    process.env.MONGODB_URI = "";
    await expect(connectDB()).rejects.toThrow("Thiếu MONGODB_URI");
  });
});
