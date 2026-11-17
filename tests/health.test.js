const request = require("supertest");
const app = require("../src/app");

describe("GET /health (smoke test)", () => {
  test("trả về 200 và status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
