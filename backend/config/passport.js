// backend/config/passport.js
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = function (passport) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: process.env.GOOGLE_CLIENT_ID,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
                proxy: true,
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    let user = await prisma.user.findUnique({
                        where: { googleId: profile.id },
                    });

                    const avatar =
                        profile.photos && profile.photos.length > 0
                            ? profile.photos[0].value
                            : null;
                    const email =
                        profile.emails && profile.emails.length > 0
                            ? profile.emails[0].value
                            : null;

                    if (!user) {
                        user = await prisma.user.create({
                            data: {
                                googleId: profile.id,
                                email,
                                name: profile.displayName,
                                avatarUrl: avatar,
                                role: 'USER',
                            },
                        });
                    } else if (user.avatarUrl !== avatar) {
                        user = await prisma.user.update({
                            where: { id: user.id },
                            data: { avatarUrl: avatar },
                        });
                    }

                    done(null, user);
                } catch (error) {
                    done(error, null);
                }
            }
        )
    );

    // Збереження ID користувача в сесію
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // Отримання користувача з БД за ID із сесії
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await prisma.user.findUnique({ where: { id } });
            done(null, user);
        } catch (error) {
            done(error, null);
        }
    });
};