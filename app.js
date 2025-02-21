const express = require('express');
const path = require('path');
const db = require('./config/database');
const session = require('express-session');

const app = express();
const port = 4000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // set to true if using HTTPS
}));

// Add middleware to make user data available to all views
app.use((req, res, next) => {
    res.locals.userId = req.session.userId;
    res.locals.userLogin = req.session.userLogin;
    next();
});

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Middleware to check if user is authenticated
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
};

app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/profile');
    }
    res.render('login', { error: req.session.error });
    delete req.session.error;
});

app.post('/login', (req, res) => {
    const { login, password } = req.body;
    
    db.query(
        'SELECT * FROM users WHERE login = ? AND password = ?',
        [login, password],
        (error, results) => {
            if (error) {
                console.error('Database error:', error);
                req.session.error = 'Внутренняя ошибка сервера';
                return res.redirect('/login');
            }

            if (results.length > 0) {
                req.session.userId = results[0].id;
                req.session.userLogin = results[0].login;
                res.redirect('/profile');
            } else {
                req.session.error = 'Неверный логин или пароль';
                res.redirect('/login');
            }
        }
    );
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/profile', requireAuth, (req, res) => {
    db.query(
        'SELECT * FROM users WHERE id = ?',
        [req.session.userId],
        (error, results) => {
            if (error || results.length === 0) {
                return res.redirect('/login');
            }
            res.render('profile', { user: results[0] });
        }
    );
});

// Utility function to fetch tariffs
function getTariffs(callback) {
    db.query(
        'SELECT id, name, limit_gb, speed, price FROM tariffplans',
        (error, results) => {
            if (error) {
                console.error('Error fetching tariffs:', error);
                callback(error, null);
            } else {
                callback(null, results);
            }
        }
    );
}

// Modify root route to include tariffs
app.get('/', (req, res) => {
    getTariffs((error, tariffs) => {
        if (error) {
            return res.render('index', { error: 'Unable to load tariffs' });
        }
        res.render('index', { tariffs });
    });
});

// Modify tariffs route
app.get('/tariffs', requireAuth, (req, res) => {
    getTariffs((error, tariffs) => {
        if (error) {
            return res.render('tariffs', { error: 'Unable to load tariffs' });
        }
        res.render('tariffs', { tariffs });
    });
});

app.get('/billing', requireAuth, (req, res) => {
    res.render('billing');
});

app.get('/support', requireAuth, (req, res) => {
    res.render('support');
});

app.get('/connection', requireAuth, (req, res) => {
    res.render('connection');
});

app.get('/history', requireAuth, (req, res) => {
    res.render('history');
});

app.get('/notifications', requireAuth, (req, res) => {
    res.render('notifications');
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
