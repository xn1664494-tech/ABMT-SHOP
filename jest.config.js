module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  testTimeout: 30000,
  maxWorkers: 1, // các file test dùng chung 1 CSDL test -> chạy tuần tự
  clearMocks: true,
  verbose: true,
};
