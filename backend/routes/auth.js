// backend/routes/auth.js
const express = require('express');
const passport = require('passport');
const router = express.Router();

const defaultClientUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
const CLIENT_URL = (process.env.CLIENT_URL ?? defaultClientUrl).replace(/\/$/, '');

// Відправка користувача на сторінку логіну Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Обробка повернення від Google
router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/` }),
    (req, res) => {
        res.redirect(`${CLIENT_URL}/`);
    }
);

// Безпечний вихід із системи: очищення Passport, знищення сесії та видалення cookie
router.get('/logout', (req, res, next) => {
    req.logout((err) => {
        if (err) return next(err);
        if (req.session) {
            req.session.destroy(() => {
                res.clearCookie('connect.sid');
                res.redirect(`${CLIENT_URL}/`);
            });
        } else {
            res.clearCookie('connect.sid');
            res.redirect(`${CLIENT_URL}/`);
        }
    });
});

module.exports = router;