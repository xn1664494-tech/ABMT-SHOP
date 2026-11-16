// Test mẫu chứng minh hạ tầng test chạy được (T2-4-1).
const mongoose = require("mongoose");

const InfraCheck = mongoose.model("InfraCheck", new mongoose.Schema({ name: String }));

describe("Hạ tầng test", () => {
  test("NODE_ENV là 'test'", () => {
    expect(process.env.NODE_ENV).toBe("test");
  });

  test("đã kết nối CSDL test riêng", () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name).toMatch(/test/i);
  });

  test("ghi và đọc được dữ liệu", async () => {
    await InfraCheck.create({ name: "hello" });
    expect(await InfraCheck.countDocuments()).toBe(1);
  });

  // Chạy ngay sau test trên: afterEach trong setup.js phải đã dọn sạch dữ liệu
  test("dữ liệu của test trước đã được dọn sạch", async () => {
    expect(await InfraCheck.countDocuments()).toBe(0);
  });

  test("import được app Express mà không mở cổng", () => {
    const app = require("../src/app");
    expect(typeof app).toBe("function");
  });
});
