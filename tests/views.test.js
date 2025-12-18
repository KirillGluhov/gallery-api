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

describe("Increment View Count API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test("should increment view count for an image", async () => {
    const mockQuery = require("../db").connection.query;
    mockQuery.mockImplementation((sql, params, callback) => {
      callback(null, { affectedRows: 1 });
    });
    
    const response = await request(app)
      .post("/image/1/view")
      .expect(200);
    
    expect(response.text).toBe("View count updated");
    expect(mockQuery).toHaveBeenCalledWith(
      "UPDATE data SET views = views + 1 WHERE id = ?",
      ["1"], // IDs from URL params are strings
      expect.any(Function)
    );
  });
  
  test("should return 404 when image not found", async () => {
    const mockQuery = require("../db").connection.query;
    mockQuery.mockImplementation((sql, params, callback) => {
      callback(null, { affectedRows: 0 }); // No rows affected = image not found
    });
    
    const response = await request(app)
      .post("/image/999/view")
      .expect(404);
    
    expect(response.text).toBe("Image not found");
  });
  
  test("should handle database error when incrementing view count", async () => {
    const mockQuery = require("../db").connection.query;
    const mockError = new Error("Database error");
    mockQuery.mockImplementation((sql, params, callback) => {
      callback(mockError, null);
    });
    
    const response = await request(app)
      .post("/image/1/view")
      .expect(500);
    
    expect(response.text).toContain("Database error");
  });
});
