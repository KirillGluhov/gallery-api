// Mock console.error to reduce noise during tests
global.console.error = jest.fn();

// Mock the database connection BEFORE importing the app
jest.mock("../db", () => ({
  connection: {
    query: jest.fn((sql, values, callback) => {
      // Default mock behavior: return empty results for all queries
      if (typeof callback === 'function') {
        // Handle both 2-parameter and 3-parameter calls to query
        callback(null, []);
      } else if (typeof values === 'function') {
        values(null, []);
      }
    })
  }
}));

const request = require("supertest");
const app = require("../app");

describe("Error Handling", () => {
  test("should return 404 for non-existent routes", async () => {
    const response = await request(app).get("/nonexistent").expect(404);
    expect(response.status).toBe(404);
  });
  
  test("should handle database errors gracefully", async () => {
    const mockQuery = require("../db").connection.query;
    const mockError = new Error("Database connection failed");
    mockQuery.mockImplementation((sql, callback) => {
      callback(mockError, null);
    });
    
    const response = await request(app).get("/all").expect(500);
    expect(response.status).toBe(500);
  });
});