// Mock console.error to reduce noise during tests
global.console.error = jest.fn();

// Mock the database connection BEFORE importing the router
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
const express = require("express");
const analyticsRouter = require("../routes/analytics");

// Create a test app specifically for analytics without auth middleware
const testApp = express();
testApp.use(analyticsRouter);

describe("Analytics API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  test("should return raw count data", async () => {
    const mockQuery = require("../db").connection.query;
    const mockStats = { total_images: 10, unique_authors: 5, authors_with_images: 4 };
    
    mockQuery.mockImplementation((sql, callback) => {
      if (sql.includes("COUNT")) {
        callback(null, [mockStats]);
      }
    });
    
    const response = await request(testApp).get("/raw/count").expect(200);
    
    expect(response.body).toEqual(mockStats);
  });
  
  test("should return timeline data", async () => {
    const mockQuery = require("../db").connection.query;
    const mockTimeline = [
      { upload_date: "2023-01-01", count: 5 },
      { upload_date: "2023-01-02", count: 3 }
    ];
    
    mockQuery.mockImplementation((sql, callback) => {
      if (sql.includes("DATE(date)")) {
        callback(null, mockTimeline);
      }
    });
    
    const response = await request(testApp).get("/raw/timeline").expect(200);
    
    expect(response.body).toEqual(mockTimeline);
  });
  
  test("should handle database errors in analytics", async () => {
    const mockQuery = require("../db").connection.query;
    const mockError = new Error("Database error");
    
    mockQuery.mockImplementation((sql, callback) => {
      callback(mockError, null);
    });
    
    const response = await request(testApp).get("/raw/count").expect(500);
    
    expect(response.body).toEqual({ error: "Database error" });
  });
});
