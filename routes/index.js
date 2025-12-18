let fs = require('fs');
let path = require('path');
let express = require('express');
let db = require("../db");
let router = express.Router();
let { v4: uuidv4 } = require('uuid');

// Ensure public/images directory exists
const imagesDir = path.join(__dirname, '../public/images');
try {
    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }
} catch (error) {
    console.error('Error creating images directory:', error);
}

function streamToString(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    })
}

/* GET index page */
router.get('/', function (req, res, next) {
    res.render('index', {title: 'PhotoGallery', version: "0.1.0"});
});

/* POST new image */
router.post('/new', async function (req, res, next) {
    console.log('Request fields:', req.body);
    console.log('Request files:', Object.getOwnPropertyNames(req.files));

    if (!req.files['image']) {
        return res.status(400).send('image required');
    }

    // Extract filename without extension to use as default name
    const originalFilename = req.files['image'] && req.files['image'].name ? req.files['image'].name : 'image';
    const fileExtensionMatch = originalFilename.match(/\.[^/.]+$/);
    const fileExtension = fileExtensionMatch ? fileExtensionMatch[0] : '.jpg'; // Default to .jpg if no extension
    const fileName = uuidv4() + fileExtension;
    const imageDataString = await streamToString(req.files['image']);

    // Use original filename (without extension) as default name if name is not provided
    const name = req.body['name'] || (originalFilename ? originalFilename.replace(/\.[^/.]+$/, "").replace(/[_-]/g, ' ') : 'Untitled');
    const description = req.body['description'] || '';
    const author = req.body['author'] || '';

    fs.writeFileSync('./public/images/' + fileName, imageDataString);

    // Use prepared statement to prevent SQL injection
    const sql = 'INSERT INTO data (name, description, author, path) VALUES (?, ?, ?, ?)';
    const values = [name, description, author, fileName];

    db.connection.query(sql, values, function(err, rows, fields) {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send(err.toString());
            return;
        }

        console.log(rows);
        res.send(fileName);
    });
});

/* GET all images */
router.get('/all', async function (req, res, next) {
    db.connection.query('SELECT * from data', function (err, rows, fields) {
        if (err) {
            console.error('Database error:', err);
            res.status(500).send(err);
        } else {
            res.json(rows || []);
        }
    });
});

/* GET upload page */
router.get('/upload', function (req, res, next) {
    res.render('upload', {title: 'Upload Image'});
});

/* DELETE image */
router.delete('/image/:id', async function (req, res, next) {
    const imageId = req.params.id;

    // First get the image record to get the file path
    const selectSql = 'SELECT path FROM data WHERE id = ?';
    db.connection.query(selectSql, [imageId], function(err, rows) {
        if (err) {
            console.error('Database error when selecting image:', err);
            res.status(500).send('Database error');
            return;
        }

        if (rows.length === 0) {
            res.status(404).send('Image not found');
            return;
        }

        const imagePath = rows[0].path;

        // Now delete the record from the database
        const deleteSql = 'DELETE FROM data WHERE id = ?';
        db.connection.query(deleteSql, [imageId], function(err, result) {
            if (err) {
                console.error('Database error when deleting image:', err);
                res.status(500).send('Database error');
                return;
            }

            if (result.affectedRows > 0) {
                // Delete the actual image file from the server
                const fs = require('fs');
                const imagePathFull = './public/images/' + imagePath;

                if (fs.existsSync(imagePathFull)) {
                    fs.unlink(imagePathFull, (err) => {
                        if (err) {
                            console.error('Error deleting file:', err);
                            // Still send success response as the DB record was deleted
                        } else {
                            console.log('File deleted successfully:', imagePathFull);
                        }
                    });
                }

                res.status(200).send('Image deleted successfully');
            } else {
                res.status(500).send('Failed to delete image from database');
            }
        });
    });
});

/* POST increment view count */
router.post('/image/:id/view', async function (req, res, next) {
    const imageId = req.params.id;

    const sql = 'UPDATE data SET views = views + 1 WHERE id = ?';

    db.connection.query(sql, [imageId], function(err, result) {
        if (err) {
            console.error('Database error when updating view count:', err);
            res.status(500).send('Database error');
            return;
        }

        if (result.affectedRows > 0) {
            res.status(200).send('View count updated');
        } else {
            res.status(404).send('Image not found');
        }
    });
});

/* GET gallery page */
router.get('/gallery', async function (req, res, next) {
    db.connection.query('SELECT * from data ORDER BY date DESC', function (err, rows, fields) {
        if (err) {
            console.error('Database error:', err);
            res.status(500).render('error', {message: 'Database error', error: {}});
        } else {
            // Format dates for display
            const formattedImages = (rows || []).map(image => {
                if (image.date instanceof Date) {
                    image.formattedDate = image.date.toLocaleDateString();
                } else if (typeof image.date === 'string') {
                    // Convert string to date if necessary
                    const dateObj = new Date(image.date);
                    image.formattedDate = dateObj.toLocaleDateString();
                } else {
                    image.formattedDate = image.date ? image.date.toString().substring(0, 10) : '';
                }
                return image;
            });

            res.render('gallery', {title: 'Photo Gallery', images: formattedImages});
        }
    });
});

module.exports = router;
