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
    const query = `
        SELECT 
            u.*,
            c.contract_number,
            c.balance,
            c.contract_status,
            t.name as tariff_name,
            t.speed,
            t.price
        FROM users u
        LEFT JOIN contracts c ON u.id = c.user_id
        LEFT JOIN tariffplans t ON c.tariff_id = t.id
        WHERE u.id = ?
    `;

    db.query(query, [req.session.userId], (error, results) => {
        if (error || results.length === 0) {
            console.error('Error fetching profile data:', error);
            return res.redirect('/login');
        }
        res.render('profile', { 
            user: results[0],
            contract: {
                number: results[0].contract_number,
                status: results[0].contract_status,
                balance: results[0].balance
            },
            tariff: {
                name: results[0].tariff_name,
                speed: results[0].speed,
                price: results[0].price
            }
        });
    });
});

// Utility function to fetch tariffs
function getTariffs(callback) {
    db.query(
        `SELECT 
            id, 
            name, 
            CASE 
                WHEN limit_gb = 0 THEN 'Безлимитный'
                ELSE limit_gb
            END as limit_gb, 
            speed, 
            price 
        FROM tariffplans 
        WHERE name NOT LIKE "%Служебный%"`,
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
    const query = `
        SELECT 
            COALESCE(c.balance, 0) as balance,
            c.next_payment_date,
            COALESCE(t.price, 0) as next_payment_amount,
            COALESCE(c.autopay, FALSE) as autopay,
            COALESCE(c.autopay_min_balance, 100) as autopay_min_balance,
            COALESCE(c.autopay_amount, 0) as autopay_amount
        FROM contracts c
        LEFT JOIN tariffplans t ON c.tariff_id = t.id
        WHERE c.user_id = ?
    `;

    db.query(query, [req.session.userId], (error, results) => {
        if (error) {
            console.error('Error fetching billing data:', error);
            return res.render('billing', { error: 'Unable to load billing data' });
        }

        // Получаем историю платежей
        db.query(
            'SELECT amount, type, date, is_debit FROM payments WHERE user_id = ? ORDER BY date DESC LIMIT 10',
            [req.session.userId],
            (error, paymentHistory) => {
                if (error) {
                    console.error('Error fetching payment history:', error);
                    paymentHistory = [];
                }

                // Форматируем данные для отображения
                const billingData = {
                    balance: parseFloat(results[0]?.balance || 0).toFixed(2),
                    nextPaymentDate: results[0]?.next_payment_date ? 
                        new Date(results[0].next_payment_date).toLocaleDateString('ru-RU') : '-',
                    nextPaymentAmount: parseFloat(results[0]?.next_payment_amount || 0).toFixed(2),
                    hasAutopay: Boolean(results[0]?.autopay),
                    autopayMinBalance: parseFloat(results[0]?.autopay_min_balance || 100).toFixed(2),
                    autopayAmount: parseFloat(results[0]?.autopay_amount || results[0]?.next_payment_amount || 0).toFixed(2),
                    defaultPaymentAmount: parseFloat(results[0]?.next_payment_amount || 100).toFixed(2), // Добавляем значение по умолчанию
                    paymentHistory: (paymentHistory || []).map(payment => ({
                        ...payment,
                        amount: parseFloat(payment.amount).toFixed(2),
                        date: new Date(payment.date).toLocaleDateString('ru-RU'),
                        isDebit: Boolean(payment.is_debit)
                    }))
                };

                res.render('billing', billingData);
            }
        );
    });
});

// Обработка платежа
app.post('/billing/pay', requireAuth, (req, res) => {
    const { amount, payment_method } = req.body;
    // Здесь должна быть логика обработки платежа
    // Это демо-версия, просто обновляем баланс
    db.query(
        'UPDATE contracts SET balance = balance + ? WHERE user_id = ?',
        [amount, req.session.userId],
        (error) => {
            if (error) {
                console.error('Error processing payment:', error);
                return res.redirect('/billing?error=payment_failed');
            }
            // Записываем платёж в историю
            db.query(
                'INSERT INTO payments (user_id, amount, type, is_debit) VALUES (?, ?, ?, ?)',
                [req.session.userId, amount, `Пополнение ${payment_method}`, false],
                (error) => {
                    if (error) {
                        console.error('Error saving payment history:', error);
                    }
                    res.redirect('/billing');
                }
            );
        }
    );
});

// Управление автоплатежом
app.post('/billing/autopay', requireAuth, (req, res) => {
    const { min_balance, autopay_amount } = req.body;
    
    db.query(
        'UPDATE contracts SET autopay = NOT autopay, autopay_min_balance = ?, autopay_amount = ? WHERE user_id = ?',
        [min_balance, autopay_amount, req.session.userId],
        (error) => {
            if (error) {
                console.error('Error updating autopay settings:', error);
                return res.redirect('/billing?error=autopay_failed');
            }
            res.redirect('/billing');
        }
    );
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
    db.query(
        'SELECT notifications.id, notifications.importance, notifications.content, notifications.date FROM notifications',
        (error, notifications) => {
            if (error) {
                console.error('Error fetching notifications:', error);
                return res.render('notifications', { error: 'Unable to load notifications' });
            }
            // Convert MySQL datetime to formatted string
            notifications = notifications.map(notification => ({
                ...notification,
                date: new Date(notification.date).toLocaleDateString('ru-RU')
            }));
            res.render('notifications', { notifications });
        }
    );
});

// Start server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
