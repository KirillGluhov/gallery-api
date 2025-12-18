// Mock console.error to reduce noise during tests
global.console.error = jest.fn();

// Mock the database connection BEFORE importing the router
jest.mock('../db', () => ({
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

const request = require('supertest');
const express = require('express');
const indexRouter = require('../routes/index');
const db = require('../db');

// Create a test app instance
const app = express();
app.use(express.json());
const formData = require('express-form-data');
const os = require('os');

const options = {
  uploadDir: os.tmpdir(),
  autoClean: true
};

app.use(formData.parse(options));
app.use(formData.format());
app.use(formData.stream());
app.use(indexRouter);

describe('Image Upload API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should upload a new image successfully', async () => {
    // Mock database query response
    const mockQuery = require('../db').connection.query;
    mockQuery.mockImplementation((sql, values, callback) => {
      callback(null, { insertId: 1 }, null); // Simulate successful insertion
    });

    // Make request with form data
    const response = await request(app)
      .post('/new')
      .attach('image', Buffer.from('fake image data'), 'test.jpg')
      .field('name', 'Test Image')
      .field('description', 'Test description')
      .field('author', 'Test Author')
      .expect(200);

    expect(response.text).toBeDefined(); // Should return the filename
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO data'),
      expect.arrayContaining(['Test Image', 'Test description', 'Test Author']),
      expect.any(Function)
    );
  });

  test('should return 400 when image is not provided', async () => {
    const response = await request(app)
      .post('/new')
      .field('name', 'Test Image')
      .expect(400);

    expect(response.text).toContain('image required');
  });

  test('should use default name when no name is provided', async () => {
    const mockQuery = require('../db').connection.query;
    mockQuery.mockImplementation((sql, values, callback) => {
      callback(null, { insertId: 1 }, null);
    });

    const response = await request(app)
      .post('/new')
      .attach('image', Buffer.from('fake image data'), 'my-photo.jpg')
      .expect(200);

    expect(response.text).toBeDefined();
    // Name should be extracted from filename (my photo with spaces instead of hyphens)
  });

  test('should handle database errors during upload', async () => {
    const mockQuery = require('../db').connection.query;
    const mockError = new Error('Database error');
    mockQuery.mockImplementation((sql, values, callback) => {
      callback(mockError, null, null);
    });

    const response = await request(app)
      .post('/new')
      .attach('image', Buffer.from('fake image data'), 'test.jpg')
      .field('name', 'Test Image')
      .expect(500);

    expect(response.text).toContain('Database error');
  });
});