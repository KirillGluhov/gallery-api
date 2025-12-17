let express = require('express');
let router = express.Router();
let db = require("../db");

// GET /analytics - основная страница аналитики
router.get('/', function(req, res, next) {
    // Выполняем все необходимые запросы для получения метрик
    const countSql = `
        SELECT
            COUNT(*) as total_images,
            COUNT(DISTINCT author) as unique_authors,
            COUNT(DISTINCT CASE WHEN author IS NOT NULL AND author != '' THEN author END) as authors_with_images
        FROM data
    `;

    const timelineSql = `
        SELECT
            DATE(date) as upload_date,
            COUNT(*) as count
        FROM data
        GROUP BY DATE(date)
        ORDER BY upload_date DESC
        LIMIT 30
    `;

    const authorsSql = `
        SELECT
            author,
            COUNT(*) as image_count
        FROM data
        WHERE author IS NOT NULL AND author != ''
        GROUP BY author
        ORDER BY image_count DESC
        LIMIT 10
    `;

    const popularSql = `
        SELECT
            name,
            views,
            path
        FROM data
        ORDER BY views DESC
        LIMIT 10
    `;

    // Выполняем все запросы параллельно
    db.connection.query(countSql, function(countErr, countRows) {
        if (countErr) {
            console.error('Database error:', countErr);
            res.status(500).render('error', {message: 'Database error', error: {}});
            return;
        }

        db.connection.query(timelineSql, function(timelineErr, timelineRows) {
            if (timelineErr) {
                console.error('Database error:', timelineErr);
                res.status(500).render('error', {message: 'Database error', error: {}});
                return;
            }

            db.connection.query(authorsSql, function(authorsErr, authorsRows) {
                if (authorsErr) {
                    console.error('Database error:', authorsErr);
                    res.status(500).render('error', {message: 'Database error', error: {}});
                    return;
                }

                db.connection.query(popularSql, function(popularErr, popularRows) {
                    if (popularErr) {
                        console.error('Database error:', popularErr);
                        res.status(500).render('error', {message: 'Database error', error: {}});
                        return;
                    }

                    // Преобразуем даты в читаемый формат
                    const readableTimeline = timelineRows.map(item => {
                        const date = new Date(item.upload_date);
                        const options = { year: 'numeric', month: 'long', day: 'numeric' };
                        return {
                            ...item,
                            readable_date: date.toLocaleDateString('en-US', options)
                        };
                    });

                    res.render('analytics', {
                        title: 'Analytics Dashboard',
                        stats: countRows[0],
                        timeline: readableTimeline,
                        authors: authorsRows,
                        popular: popularRows
                    });
                });
            });
        });
    });
});

// GET /analytics/raw/count - общая статистика по таблице data
router.get('/raw/count', function(req, res, next) {
    const sql = `
        SELECT
            COUNT(*) as total_images,
            COUNT(DISTINCT author) as unique_authors,
            COUNT(DISTINCT CASE WHEN author IS NOT NULL AND author != '' THEN author END) as authors_with_images
        FROM data
    `;

    db.connection.query(sql, function(err, rows) {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({error: 'Database error'});
            return;
        }

        res.json(rows[0]);
    });
});

// GET /analytics/raw/timeline - статистика по загрузкам по датам
router.get('/raw/timeline', function(req, res, next) {
    const sql = `
        SELECT
            DATE(date) as upload_date,
            COUNT(*) as count
        FROM data
        GROUP BY DATE(date)
        ORDER BY upload_date DESC
        LIMIT 30
    `;

    db.connection.query(sql, function(err, rows) {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({error: 'Database error'});
            return;
        }

        res.json(rows);
    });
});

// GET /analytics/raw/authors - статистика по авторам
router.get('/raw/authors', function(req, res, next) {
    const sql = `
        SELECT
            author,
            COUNT(*) as image_count
        FROM data
        WHERE author IS NOT NULL AND author != ''
        GROUP BY author
        ORDER BY image_count DESC
        LIMIT 20
    `;

    db.connection.query(sql, function(err, rows) {
        if (err) {
            console.error('Database error:', err);
            res.status(500).json({error: 'Database error'});
            return;
        }

        res.json(rows);
    });
});

module.exports = router;