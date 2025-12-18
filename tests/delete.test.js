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

// Mock the file system
jest.mock("fs", () => ({
  unlink: jest.fn(),
  existsSync: jest.fn()
}));

const request = require("supertest");
const app = require("../app");
const fs = require("fs");

describe("Delete Image API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test("should delete an image successfully", async () => {
    const mockQuery = require("../db").connection.query;
    // First call to get image path (returns the image)
    // Second call to delete the record (returns success)
    let callCount = 0;
    mockQuery.mockImplementation((sql, params, callback) => {
      callCount++;
      if (callCount === 1) {
        // First query to get image path
        callback(null, [{ path: "test-image.jpg" }]);
      } else {
        // Second query to delete record
        callback(null, { affectedRows: 1 });
      }
    });
    
    // Mock file exists and successfully delete
    const mockFs = require("fs");
    mockFs.existsSync.mockReturnValue(true);
    
    const response = await request(app).delete("/image/1").expect(200);
    
    expect(response.text).toBe("Image deleted successfully");
    expect(mockFs.unlink).toHaveBeenCalledWith(
      "./public/images/test-image.jpg",
      expect.any(Function)
    );
  });
  
  test("should return 404 when image not found", async () => {
    const mockQuery = require("../db").connection.query;
    mockQuery.mockImplementation((sql, params, callback) => {
      callback(null, []); // No image found
    });
    
    const response = await request(app).delete("/image/999").expect(404);
    
    expect(response.text).toBe("Image not found");
  });
  
  test("should handle database error during deletion", async () => {
    const mockQuery = require("../db").connection.query;
    const mockError = new Error("Database error");
    mockQuery.mockImplementation((sql, params, callback) => {
      callback(mockError, null);
    });
    
    const response = await request(app).delete("/image/1").expect(500);
    
    expect(response.text).toBe("Database error");
  });
});
