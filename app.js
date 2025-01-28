const express = require('express');
const path = require('path');
const db = require('./config/database');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// Add this before the Basic route
app.get('/login', (req, res) => {
    res.render('login.hbs');
});

app.post('/login', (req, res) => {
    // Here you would handle the login logic
    // For now, just redirect back to home
    res.redirect('/');
});

// Basic route
app.get('/', (req, res) => {
    res.render('index.hbs');
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
