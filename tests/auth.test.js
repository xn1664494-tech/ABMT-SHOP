// Test xác thực end-to-end qua Supertest (T3-4-3).
// .env.test chưa có JWT_SECRET nên đặt secret riêng cho tiến trình test;
// vẫn dùng jwt thật, không mock.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-only-jwt-secret";

const request = require("supertest");
const app = require("../src/app");

const PASSWORD = "Password123";
const SHEET_LOGIN_ERROR = "Email hoặc mật khẩu không đúng";

// Email ngẫu nhiên để tránh va chạm giữa các test / lần chạy.
let counter = 0;
const uniqueEmail = () => {
  counter += 1;
  return `auth-test-${Date.now()}-${counter}-${Math.random().toString(36).slice(2)}@example.com`;
};

const registerUser = (email, password = PASSWORD) =>
  request(app)
    .post("/api/auth/register")
    .send({ name: "Người Dùng Test", email, password });

const loginUser = (email, password) =>
  request(app).post("/api/auth/login").send({ email, password });

describe("Xác thực (auth)", () => {
  test("đăng ký trùng email trả 409", async () => {
    const email = uniqueEmail();

    const first = await registerUser(email);
    expect(first.statusCode).toBe(201);

    const second = await registerUser(email);
    expect(second.statusCode).toBe(409);
  });

  test("sai mật khẩu bị từ chối 401, đúng thông báo và không cấp cookie", async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const res = await loginUser(email, "SaiMatKhau123");

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe(SHEET_LOGIN_ERROR);

    const setCookie = res.headers["set-cookie"] || [];
    expect(setCookie.some((cookie) => cookie.startsWith("accessToken="))).toBe(false);
  });

  test("email không tồn tại trả cùng thông báo như sai mật khẩu (không lộ tài khoản)", async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const wrongPassword = await loginUser(email, "SaiMatKhau123");
    const noSuchEmail = await loginUser(uniqueEmail(), "SaiMatKhau123");

    expect(noSuchEmail.statusCode).toBe(wrongPassword.statusCode);
    expect(noSuchEmail.body.error).toBe(wrongPassword.body.error);
  });

  test("cookie JWT có cờ HttpOnly và SameSite", async () => {
    const email = uniqueEmail();
    await registerUser(email);

    const res = await loginUser(email, PASSWORD);
    expect(res.statusCode).toBe(200);

    const setCookie = res.headers["set-cookie"] || [];
    const accessCookie = setCookie.find((cookie) => cookie.startsWith("accessToken="));
    expect(accessCookie).toBeDefined();
    expect(accessCookie).toMatch(/HttpOnly/i);
    expect(accessCookie).toMatch(/SameSite=Strict/i);
    // Secure chỉ bật ở production (NODE_ENV=test nên không có Secure).
  });

  test("phản hồi đăng ký/đăng nhập không lộ mật khẩu hay hash", async () => {
    const email = uniqueEmail();

    const registerRes = await registerUser(email);
    const loginRes = await loginUser(email, PASSWORD);

    expect(registerRes.statusCode).toBe(201);
    expect(loginRes.statusCode).toBe(200);

    for (const res of [registerRes, loginRes]) {
      const bodyText = JSON.stringify(res.body);
      expect(bodyText).not.toMatch(/password/i);
      expect(bodyText).not.toContain(PASSWORD);
      expect(bodyText).not.toMatch(/\$2[aby]\$\d{2}\$/);
    }
  });
});
