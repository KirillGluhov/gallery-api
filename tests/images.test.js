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

describe("Get All Images API", () => {
  test("should return all images", async () => {
    const mockImages = [
      { id: 1, name: "Test Image 1", path: "test1.jpg", author: "Author 1" },
      { id: 2, name: "Test Image 2", path: "test2.jpg", author: "Author 2" }
    ];
    
    // Mock database query response
    const mockQuery = require("../db").connection.query;
    mockQuery.mockImplementation((sql, callback) => {
      if (sql.includes("SELECT * from data")) {
        callback(null, mockImages);
      }
    });
    
    const response = await request(app).get("/all").expect(200);
    
    expect(response.body).toEqual(mockImages);
    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT * from data",
      expect.any(Function)
    );
  });
  
  test("should handle database errors when getting all images", async () => {
    const mockQuery = require("../db").connection.query;
    const mockError = new Error("Database error");
    mockQuery.mockImplementation((sql, callback) => {
      callback(mockError, null);
    });
    
    const response = await request(app).get("/all").expect(500);
    
    // Changed from response.text to response.body or response.status for JSON responses
    expect(response.status).toBe(500);
  });
});
