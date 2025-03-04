const express = require('express');
const path = require('path');
const db = require('./config/database');
const session = require('express-session');

const app = express();
const port = 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use((req, res, next) => {
    res.locals.userId = req.session.userId;
    res.locals.contractNumber = req.session.contractNumber;
    res.locals.userLogin = req.session.userLogin;
    next();
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

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
    const { contract_number, password } = req.body;
    
    db.query(
        `SELECT 
            c.user_id,
            c.contract_number,
            u.login 
        FROM contracts c 
        JOIN users u ON c.user_id = u.id 
        WHERE c.contract_number = ? AND c.password = ?`,
        [contract_number, password],
        (error, results) => {
            if (error) {
                console.error('Database error:', error);
                req.session.error = 'Внутренняя ошибка сервера';
                return res.redirect('/login');
            }

            if (results.length > 0) {
                req.session.userId = results[0].user_id;
                req.session.contractNumber = results[0].contract_number;
                req.session.userLogin = results[0].login;
                res.redirect('/profile');
            } else {
                req.session.error = 'Неверный номер договора или пароль';
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

app.get('/', (req, res) => {
    getTariffs((error, tariffs) => {
        if (error) {
            return res.render('index', { error: 'Unable to load tariffs' });
        }
        res.render('index', { tariffs });
    });
});

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

        db.query(
            'SELECT amount, type, date, is_debit FROM payments WHERE user_id = ? AND is_debit = false ORDER BY date DESC LIMIT 5',
            [req.session.userId],
            (error, paymentHistory) => {
                if (error) {
                    console.error('Error fetching payment history:', error);
                    paymentHistory = [];
                }

                const billingData = {
                    balance: parseFloat(results[0]?.balance || 0).toFixed(2),
                    nextPaymentDate: results[0]?.next_payment_date ? 
                        new Date(results[0].next_payment_date).toLocaleDateString('ru-RU') : '-',
                    nextPaymentAmount: parseFloat(results[0]?.next_payment_amount || 0).toFixed(2),
                    hasAutopay: Boolean(results[0]?.autopay),
                    autopayMinBalance: parseFloat(results[0]?.autopay_min_balance || 100).toFixed(2),
                    autopayAmount: parseFloat(results[0]?.autopay_amount || results[0]?.next_payment_amount || 0).toFixed(2),
                    defaultPaymentAmount: parseFloat(results[0]?.next_payment_amount || 100).toFixed(2),
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

app.post('/billing/pay', requireAuth, (req, res) => {
    const { amount, payment_method } = req.body;
    
    db.query(
        'UPDATE contracts SET balance = balance + ? WHERE user_id = ?',
        [amount, req.session.userId],
        (error) => {
            if (error) {
                console.error('Error processing payment:', error);
                return res.redirect('/billing?error=payment_failed');
            }
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

app.post('/tariffs/connect', (req, res) => {
    const { tariffId, name, phone, address, comment } = req.body;
    
    const query = `
        INSERT INTO connection_requests 
        (tariff_id, client_name, phone, address, comment, status) 
        VALUES (?, ?, ?, ?, ?, 'new')
    `;
    
    db.query(query, [tariffId, name, phone, address, comment], (error) => {
        if (error) {
            console.error('Error saving connection request:', error);
            return res.status(500).json({ error: 'Failed to save request' });
        }
        res.json({ success: true });
    });
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
            notifications = notifications.map(notification => ({
                ...notification,
                date: new Date(notification.date).toLocaleDateString('ru-RU')
            }));
            res.render('notifications', { notifications });
        }
    );
});

app.post('/profile/update', requireAuth, (req, res) => {
    const { login, email, password } = req.body;
    const userId = req.session.userId;

    db.query('SELECT id FROM users WHERE login = ? AND id != ?', [login, userId], (error, results) => {
        if (error) {
            return res.json({
                success: false,
                error: 'Ошибка при проверке логина'
            });
        }

        if (results.length > 0) {
            return res.json({
                success: false,
                error: 'Этот логин уже занят'
            });
        }

        let query = 'UPDATE users SET login = ?, email = ?';
        let params = [login, email];

        if (password) {
            query += ', password = ?';
            params.push(password);
        }

        query += ' WHERE id = ?';
        params.push(userId);

        db.query(query, params, (error, results) => {
            if (error) {
                console.error('Error updating profile:', error);
                return res.json({
                    success: false,
                    error: 'Ошибка при обновлении профиля'
                });
            }

            req.session.userLogin = login;

            res.json({
                success: true,
                message: 'Профиль успешно обновлен'
            });
        });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
