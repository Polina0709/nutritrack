// backend/server.js
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const passport = require('passport');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
require('./config/passport')(passport);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Довіра до першого проксі (Render / Railway / Nginx) для коректної роботи secure-cookie
app.set('trust proxy', 1);

// 1. Захист HTTP-заголовків (приховує X-Powered-By, додає X-Frame-Options, nosniff тощо)
app.use(
    helmet({
        contentSecurityPolicy: false, // вимкнено для сумісності з інлайн-стилями EJS та Google Fonts
    })
);

// 2. Обмеження частоти запитів (захист від DoS та перебору)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 хвилин
    max: 400,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Забагато запитів. Спробуйте пізніше.' },
});
app.use('/api', apiLimiter);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: true, limit: '200kb' }));

// 3. Безпечні налаштування сесійних cookie
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true, // Захист від крадіжки cookie через XSS (document.cookie)
            sameSite: 'lax', // Базовий захист від CSRF
            secure: isProd, // Передача лише по HTTPS у production
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 днів
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());

// 4. Перевірка Origin / Referer для state-changing запитів (додатковий захист від CSRF)
app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const currentHostOrigin = req.get('host') ? `${req.protocol}://${req.get('host')}` : '';
    const allowedOrigins = [
        `http://localhost:${PORT}`,
        'http://localhost:5173',
        currentHostOrigin,
        (process.env.CLIENT_URL || '').replace(/\/$/, ''),
    ].filter(Boolean);

    const origin = req.get('origin');
    const referer = req.get('referer');
    const source = origin || referer;

    if (source && !allowedOrigins.some((allowed) => source.startsWith(allowed))) {
        return res.status(403).json({ error: 'Запит заблоковано політикою безпеки (CSRF check)' });
    }
    return next();
});

// Автоматичне надання прав ADMIN користувачу з ADMIN_EMAIL у .env
app.use(async (req, res, next) => {
    try {
        const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
        if (req.user && adminEmail && req.user.email?.toLowerCase() === adminEmail && req.user.role !== 'ADMIN') {
            const updated = await prisma.user.update({
                where: { id: req.user.id },
                data: { role: 'ADMIN' },
            });
            req.user.role = updated.role;
        }
    } catch (err) {
        console.error('Помилка перевірки ролі адміністратора:', err);
    }
    next();
});

app.use('/auth', require('./routes/auth'));
app.use('/', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// 5. Роздача зібраного React-фронтенду у production або резервний EJS-рендер локально
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));

    app.use((req, res, next) => {
        if (req.method !== 'GET') return next();
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.render('index', {
            title: 'NutriTrack',
            user: req.user,
        });
    });
}

app.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
});