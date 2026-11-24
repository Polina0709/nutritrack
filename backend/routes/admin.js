// backend/routes/admin.js
const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware перевірки прав адміністратора
const requireAdmin = (req, res, next) => {
    if (!req.isAuthenticated || !req.isAuthenticated() || !req.user) {
        return res.redirect('/auth/google');
    }
    if (req.user.role !== 'ADMIN') {
        return res.status(403).render('admin', {
            user: req.user,
            forbidden: true,
            stats: null,
            users: [],
            recipes: [],
            query: '',
        });
    }
    return next();
};

// 1. ДИНАМІЧНА SSR-СТОРІНКА: ПУБЛІЧНИЙ КАТАЛОГ РЕЦЕПТІВ (/catalog)
router.get('/catalog', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const scope = req.query.scope === 'system' ? 'system' : 'all';

        const where = {
            ...(scope === 'system' ? { userId: null } : {}),
            ...(q
                ? {
                    OR: [
                        { title: { contains: q, mode: 'insensitive' } },
                        { description: { contains: q, mode: 'insensitive' } },
                        { instructions: { contains: q, mode: 'insensitive' } },
                    ],
                }
                : {}),
        };

        const recipes = await prisma.recipe.findMany({
            where,
            include: { user: { select: { name: true, email: true } } },
            orderBy: [{ userId: 'asc' }, { id: 'desc' }],
        });

        res.render('catalog', {
            user: req.user || null,
            recipes,
            q,
            scope,
        });
    } catch (err) {
        console.error('Помилка рендеру каталогу:', err);
        res.status(500).send('Помилка завантаження каталогу рецептів');
    }
});

// 2. АДМІНІСТРАТИВНА ПАНЕЛЬ (/admin)
router.get('/admin', requireAdmin, async (req, res) => {
    try {
        const query = (req.query.q || '').trim();

        const [usersCount, mealsCount, waterLogsCount, recipesCount, customFoodsCount, users, recipes] =
            await Promise.all([
                prisma.user.count(),
                prisma.meal.count(),
                prisma.waterLog.count(),
                prisma.recipe.count(),
                prisma.customFood.count(),
                prisma.user.findMany({
                    where: query
                        ? {
                            OR: [
                                { email: { contains: query, mode: 'insensitive' } },
                                { name: { contains: query, mode: 'insensitive' } },
                            ],
                        }
                        : undefined,
                    include: {
                        _count: {
                            select: { meals: true, recipes: true, customFoods: true },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                }),
                prisma.recipe.findMany({
                    include: { user: { select: { name: true, email: true } } },
                    orderBy: [{ userId: 'asc' }, { id: 'desc' }],
                    take: 30,
                }),
            ]);

        res.render('admin', {
            user: req.user,
            forbidden: false,
            stats: {
                usersCount,
                mealsCount,
                waterLogsCount,
                recipesCount,
                customFoodsCount,
            },
            users,
            recipes,
            query,
        });
    } catch (err) {
        console.error('Помилка рендеру адмін-панелі:', err);
        res.status(500).send('Помилка завантаження панелі адміністратора');
    }
});

// 3. ЗМІНА РОЛІ КОРИСТУВАЧА (USER <-> ADMIN)
router.post('/admin/users/:id/role', requireAdmin, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const nextRole = req.body.role === 'ADMIN' ? 'ADMIN' : 'USER';

        // Захист від випадкового зняття адмін-прав із самого себе
        if (targetId === req.user.id && nextRole !== 'ADMIN') {
            return res.redirect('/admin');
        }

        await prisma.user.update({
            where: { id: targetId },
            data: { role: nextRole },
        });

        res.redirect('/admin');
    } catch (err) {
        console.error('Помилка оновлення ролі:', err);
        res.status(500).send('Не вдалося оновити роль користувача');
    }
});

// 4. ДОДАВАННЯ СИСТЕМНОГО РЕЦЕПТУ АДМІНІСТРАТОРОМ (userId = null)
router.post('/admin/recipes', requireAdmin, async (req, res) => {
    try {
        const { title, description, instructions, prepTime, calories, proteins, fats, carbs } = req.body;
        if (!title || !title.trim()) {
            return res.redirect('/admin');
        }

        await prisma.recipe.create({
            data: {
                userId: null, // Системний рецепт, доступний усім користувачам
                title: title.trim(),
                description: description?.trim() || null,
                instructions: instructions?.trim() || null,
                prepTime: prepTime ? parseInt(prepTime, 10) : null,
                calories: parseInt(calories, 10) || 0,
                proteins: parseFloat(proteins) || 0,
                fats: parseFloat(fats) || 0,
                carbs: parseFloat(carbs) || 0,
            },
        });

        res.redirect('/admin');
    } catch (err) {
        console.error('Помилка створення системного рецепту:', err);
        res.status(500).send('Не вдалося створити системний рецепт');
    }
});

// 5. ВИДАЛЕННЯ РЕЦЕПТУ АДМІНІСТРАТОРОМ
router.post('/admin/recipes/:id/delete', requireAdmin, async (req, res) => {
    try {
        const recipeId = parseInt(req.params.id, 10);
        await prisma.recipe.delete({ where: { id: recipeId } });
        res.redirect('/admin');
    } catch (err) {
        console.error('Помилка видалення рецепту:', err);
        res.status(500).send('Не вдалося видалити рецепт');
    }
});

module.exports = router;