// backend/routes/api.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { isAuthenticated } = require('../middlewares/auth');
const axios = require('axios');
const {
    toUTCDate,
    formatUTCKey,
    addDaysUTC,
    calculateCycleInsights,
    calculateCocStatus,
    calculateCycleAverages,
} = require('../utils/cycleAdvisor');

function getDayBounds(dateStr) {
    let baseDate;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const [y, m, d] = dateStr.split('-').map(Number);
        baseDate = new Date(y, m - 1, d);
    } else {
        baseDate = new Date();
    }

    const startOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59, 999);
    return { startOfDay, endOfDay, baseDate };
}

function toLocalDateKey(dateInput) {
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// ==========================================
// 1. ОСОБИСТИЙ КАБІНЕТ ТА ЦІЛІ
// ==========================================

router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Помилка завантаження профілю' });
    }
});

router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const {
            weight, targetWeight, calorieGoal, proteinGoal, fatGoal, carbGoal, waterGoal,
            glassVolume, age, height, gender, activityLevel, goal,
            cycleLength, periodLength, lastPeriodStart
        } = req.body;

        const updateData = {
            weight: weight !== '' && weight !== null && weight !== undefined ? parseFloat(weight) : null,
            targetWeight: targetWeight !== '' && targetWeight !== null && targetWeight !== undefined ? parseFloat(targetWeight) : null,
            calorieGoal: calorieGoal ? parseInt(calorieGoal, 10) : 2000,
            proteinGoal: proteinGoal ? parseFloat(proteinGoal) : 150,
            fatGoal: fatGoal ? parseFloat(fatGoal) : 70,
            carbGoal: carbGoal ? parseFloat(carbGoal) : 200,
            waterGoal: waterGoal ? parseInt(waterGoal, 10) : 2000,
            glassVolume: glassVolume ? Math.max(50, parseInt(glassVolume, 10)) : 250,
            age: age !== '' && age !== null && age !== undefined ? parseInt(age, 10) : null,
            height: height !== '' && height !== null && height !== undefined ? parseFloat(height) : null,
            gender: gender || null,
            activityLevel: activityLevel || null,
            goal: goal || null,
        };

        if (cycleLength !== undefined) {
            updateData.cycleLength = Math.min(45, Math.max(20, parseInt(cycleLength, 10) || 28));
        }
        if (periodLength !== undefined) {
            updateData.periodLength = Math.min(10, Math.max(2, parseInt(periodLength, 10) || 5));
        }
        if (lastPeriodStart !== undefined) {
            updateData.lastPeriodStart = lastPeriodStart ? toUTCDate(lastPeriodStart) : null;
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: updateData
        });

        res.json(updatedUser);
    } catch (error) {
        console.error('Помилка оновлення профілю:', error);
        res.status(500).json({ error: 'Помилка оновлення профілю' });
    }
});

// ==========================================
// 2. ТРЕКЕР ВОДИ
// ==========================================

router.get('/water', isAuthenticated, async (req, res) => {
    try {
        const { startOfDay, endOfDay } = getDayBounds(req.query.date);

        const waterLogs = await prisma.waterLog.findMany({
            where: {
                userId: req.user.id,
                date: { gte: startOfDay, lte: endOfDay }
            },
            orderBy: { id: 'asc' }
        });

        const totalWater = waterLogs.reduce((sum, log) => sum + log.amount, 0);
        res.json({ totalWater, logs: waterLogs });
    } catch (error) {
        res.status(500).json({ error: 'Помилка завантаження води' });
    }
});

router.post('/water', isAuthenticated, async (req, res) => {
    try {
        const { amount, date } = req.body;
        const data = {
            amount: parseInt(amount, 10),
            userId: req.user.id
        };

        if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date !== toLocalDateKey(new Date())) {
            const [y, m, d] = date.split('-').map(Number);
            data.date = new Date(y, m - 1, d, 12, 0, 0);
        }

        const water = await prisma.waterLog.create({ data });
        res.status(201).json(water);
    } catch (error) {
        res.status(500).json({ error: 'Помилка збереження води' });
    }
});

router.delete('/water/:id', isAuthenticated, async (req, res) => {
    try {
        const waterId = parseInt(req.params.id, 10);
        const log = await prisma.waterLog.findUnique({ where: { id: waterId } });

        if (!log || log.userId !== req.user.id) {
            return res.status(403).json({ error: 'Відмовлено в доступі' });
        }

        await prisma.waterLog.delete({ where: { id: waterId } });
        res.json({ message: 'Запис води видалено' });
    } catch (error) {
        res.status(500).json({ error: 'Помилка скасування води' });
    }
});

// ==========================================
// 3. ЩОДЕННИК ХАРЧУВАННЯ
// ==========================================

router.get('/meals/today', isAuthenticated, async (req, res) => {
    try {
        const { startOfDay, endOfDay } = getDayBounds(req.query.date);

        const meals = await prisma.meal.findMany({
            where: {
                userId: req.user.id,
                date: { gte: startOfDay, lte: endOfDay }
            },
            include: { foodItems: true }
        });
        res.json(meals);
    } catch (error) {
        res.status(500).json({ error: 'Помилка завантаження щоденника' });
    }
});

router.post('/meals/add-food', isAuthenticated, async (req, res) => {
    try {
        const { type, name, weight, calories, proteins, fats, carbs, date } = req.body;
        const { startOfDay, endOfDay } = getDayBounds(date);

        let meal = await prisma.meal.findFirst({
            where: {
                userId: req.user.id,
                type: type,
                date: { gte: startOfDay, lte: endOfDay }
            }
        });

        if (!meal) {
            const mealData = { userId: req.user.id, type: type };
            if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && date !== toLocalDateKey(new Date())) {
                const [y, m, d] = date.split('-').map(Number);
                mealData.date = new Date(y, m - 1, d, 12, 0, 0);
            }
            meal = await prisma.meal.create({ data: mealData });
        }

        const parsedCalories = Math.round(parseFloat(calories) || 0);
        const parsedProteins = parseFloat(proteins) || 0;
        const parsedFats = parseFloat(fats) || 0;
        const parsedCarbs = parseFloat(carbs) || 0;

        const foodItem = await prisma.foodItem.create({
            data: {
                mealId: meal.id,
                name,
                weight: parseInt(weight, 10) || 100,
                calories: parsedCalories,
                proteins: parsedProteins,
                fats: parsedFats,
                carbs: parsedCarbs
            }
        });

        await prisma.meal.update({
            where: { id: meal.id },
            data: {
                totalCalories: meal.totalCalories + parsedCalories,
                totalProtein: meal.totalProtein + parsedProteins,
                totalFat: meal.totalFat + parsedFats,
                totalCarbs: meal.totalCarbs + parsedCarbs
            }
        });

        res.status(201).json(foodItem);
    } catch (error) {
        console.error('Помилка додавання продукту:', error);
        res.status(500).json({ error: 'Помилка додавання продукту' });
    }
});

router.delete('/meals/food-item/:id', isAuthenticated, async (req, res) => {
    try {
        const foodItemId = parseInt(req.params.id, 10);
        const foodItem = await prisma.foodItem.findUnique({
            where: { id: foodItemId },
            include: { meal: true }
        });

        if (!foodItem || foodItem.meal.userId !== req.user.id) {
            return res.status(403).json({ error: 'Відмовлено в доступі' });
        }

        await prisma.foodItem.delete({ where: { id: foodItemId } });

        await prisma.meal.update({
            where: { id: foodItem.mealId },
            data: {
                totalCalories: Math.max(0, foodItem.meal.totalCalories - foodItem.calories),
                totalProtein: Math.max(0, foodItem.meal.totalProtein - foodItem.proteins),
                totalFat: Math.max(0, foodItem.meal.totalFat - foodItem.fats),
                totalCarbs: Math.max(0, foodItem.meal.totalCarbs - foodItem.carbs)
            }
        });

        res.json({ message: 'Продукт видалено' });
    } catch (error) {
        res.status(500).json({ error: 'Помилка при видаленні продукту' });
    }
});

// ==========================================
// 4. СЕСІЯ ТА АНАЛІТИКА
// ==========================================
router.get('/user', async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const freshUser = await prisma.user.findUnique({ where: { id: req.user.id } });
            res.json({ user: freshUser || req.user });
        } catch {
            res.json({ user: req.user });
        }
    } else {
        res.json({ user: null });
    }
});

router.get('/analytics', isAuthenticated, async (req, res) => {
    try {
        const { period = 'week', date } = req.query;
        const { startOfDay: anchorStart, endOfDay: anchorEnd, baseDate: anchorDate } = getDayBounds(date);
        let startDate = new Date(anchorStart);

        if (period === 'day') {
            startDate = new Date(anchorStart);
        } else if (period === 'week') {
            startDate.setDate(anchorStart.getDate() - 6);
        } else if (period === 'month') {
            startDate.setDate(anchorStart.getDate() - 29);
        } else if (period === 'year') {
            startDate = new Date(anchorStart.getFullYear(), 0, 1, 0, 0, 0, 0);
        }

        const [meals, waterLogs] = await Promise.all([
            prisma.meal.findMany({
                where: { userId: req.user.id, date: { gte: startDate, lte: anchorEnd } },
                include: { foodItems: true },
                orderBy: { date: 'asc' }
            }),
            prisma.waterLog.findMany({
                where: { userId: req.user.id, date: { gte: startDate, lte: anchorEnd } },
                orderBy: { date: 'asc' }
            })
        ]);

        const totalCalories = meals.reduce((sum, m) => sum + m.totalCalories, 0);
        const totalProtein = meals.reduce((sum, m) => sum + m.totalProtein, 0);
        const totalFat = meals.reduce((sum, m) => sum + m.totalFat, 0);
        const totalCarbs = meals.reduce((sum, m) => sum + m.totalCarbs, 0);
        const totalWater = waterLogs.reduce((sum, w) => sum + w.amount, 0);

        const daysCount = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 365;

        let chartData = [];
        let waterChartData = [];

        if (period === 'day') {
            const categoryNames = { BREAKFAST: 'Сніданок', LUNCH: 'Обід', DINNER: 'Вечеря', SNACK: 'Перекус' };
            chartData = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].map((type) => {
                const kcal = meals.filter((m) => m.type === type).reduce((sum, m) => sum + m.totalCalories, 0);
                return { label: categoryNames[type], kcal: Math.round(kcal) };
            });

            const timeBuckets = [
                { label: 'Ранок', test: (h) => h >= 6 && h < 12 },
                { label: 'День', test: (h) => h >= 12 && h < 18 },
                { label: 'Вечір', test: (h) => h >= 18 && h < 23 },
                { label: 'Ніч', test: (h) => h >= 23 || h < 6 },
            ];
            waterChartData = timeBuckets.map((bucket) => {
                const water = waterLogs
                    .filter((w) => bucket.test(new Date(w.date).getHours()))
                    .reduce((sum, w) => sum + w.amount, 0);
                return { label: bucket.label, water: Math.round(water) };
            });
        } else if (period === 'week') {
            const dayLabels = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
            for (let i = 6; i >= 0; i--) {
                const d = new Date(anchorDate);
                d.setDate(anchorDate.getDate() - i);
                const key = toLocalDateKey(d);

                const kcal = meals.filter((m) => toLocalDateKey(m.date) === key).reduce((sum, m) => sum + m.totalCalories, 0);
                const water = waterLogs.filter((w) => toLocalDateKey(w.date) === key).reduce((sum, w) => sum + w.amount, 0);

                chartData.push({ label: dayLabels[d.getDay()], date: key, kcal: Math.round(kcal) });
                waterChartData.push({ label: dayLabels[d.getDay()], date: key, water: Math.round(water) });
            }
        } else if (period === 'month') {
            for (let i = 29; i >= 0; i--) {
                const d = new Date(anchorDate);
                d.setDate(anchorDate.getDate() - i);
                const key = toLocalDateKey(d);
                const shortLabel = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;

                const kcal = meals.filter((m) => toLocalDateKey(m.date) === key).reduce((sum, m) => sum + m.totalCalories, 0);
                const water = waterLogs.filter((w) => toLocalDateKey(w.date) === key).reduce((sum, w) => sum + w.amount, 0);

                chartData.push({ label: shortLabel, kcal: Math.round(kcal) });
                waterChartData.push({ label: shortLabel, water: Math.round(water) });
            }
        } else if (period === 'year') {
            const monthLabels = ['Січ', 'Лют', 'Бер', 'Кві', 'Тра', 'Чер', 'Лип', 'Сер', 'Вер', 'Жов', 'Лис', 'Гру'];
            chartData = monthLabels.map((label, monthIdx) => {
                const kcal = meals.filter((m) => new Date(m.date).getMonth() === monthIdx).reduce((sum, m) => sum + m.totalCalories, 0);
                return { label, kcal: Math.round(kcal) };
            });
            waterChartData = monthLabels.map((label, monthIdx) => {
                const water = waterLogs.filter((w) => new Date(w.date).getMonth() === monthIdx).reduce((sum, w) => sum + w.amount, 0);
                return { label, water: Math.round(water) };
            });
        }

        res.json({
            period,
            totalMeals: meals.length,
            totals: {
                calories: Math.round(totalCalories),
                proteins: Math.round(totalProtein),
                fats: Math.round(totalFat),
                carbs: Math.round(totalCarbs),
                water: Math.round(totalWater)
            },
            averages: {
                calories: Math.round(totalCalories / daysCount),
                proteins: Math.round(totalProtein / daysCount),
                fats: Math.round(totalFat / daysCount),
                carbs: Math.round(totalCarbs / daysCount),
                water: Math.round(totalWater / daysCount)
            },
            chartData,
            waterChartData
        });
    } catch (error) {
        console.error('Помилка розрахунку аналітики:', error);
        res.status(500).json({ error: 'Помилка розрахунку аналітики' });
    }
});

// ==========================================
// 5. ВЛАСНІ ПРОДУКТИ ТА РЕЦЕПТИ
// ==========================================

router.get('/custom-foods', isAuthenticated, async (req, res) => {
    try {
        const { query } = req.query;
        const whereClause = { userId: req.user.id };
        if (query) {
            whereClause.name = { contains: query, mode: 'insensitive' };
        }
        const foods = await prisma.customFood.findMany({
            where: whereClause,
            orderBy: { id: 'desc' }
        });
        res.json(foods);
    } catch (error) {
        res.status(500).json({ error: 'Помилка завантаження власних продуктів' });
    }
});

router.post('/custom-foods', isAuthenticated, async (req, res) => {
    try {
        const { name, calories, proteins, fats, carbs } = req.body;
        const newFood = await prisma.customFood.create({
            data: {
                name,
                calories: parseInt(calories, 10),
                proteins: parseFloat(proteins) || 0,
                fats: parseFloat(fats) || 0,
                carbs: parseFloat(carbs) || 0,
                userId: req.user.id
            }
        });
        res.status(201).json(newFood);
    } catch (error) {
        res.status(500).json({ error: 'Помилка створення продукту' });
    }
});

router.delete('/custom-foods/:id', isAuthenticated, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const deleted = await prisma.customFood.deleteMany({
            where: { id, userId: req.user.id },
        });
        if (deleted.count === 0) {
            return res.status(404).json({ error: 'Продукт не знайдено або немає доступу' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Не вдалося видалити власний продукт' });
    }
});

router.get('/recipes', isAuthenticated, async (req, res) => {
    try {
        const query = (req.query.query || '').trim().toLowerCase();
        const recipes = await prisma.recipe.findMany({
            where: {
                OR: [{ userId: req.user.id }, { userId: null }],
            },
            orderBy: { id: 'desc' },
        });

        if (!query) return res.json(recipes);

        const filtered = recipes.filter(
            (r) =>
                (r.title || '').toLowerCase().includes(query) ||
                (r.instructions || '').toLowerCase().includes(query)
        );
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: 'Не вдалося завантажити рецепти' });
    }
});

router.post('/recipes', isAuthenticated, async (req, res) => {
    try {
        const { title, description, instructions, prepTime, calories, proteins, fats, carbs } = req.body;
        const newRecipe = await prisma.recipe.create({
            data: {
                title,
                description: description || null,
                instructions: instructions || null,
                prepTime: prepTime ? parseInt(prepTime, 10) : null,
                calories: parseInt(calories, 10),
                proteins: parseFloat(proteins) || 0,
                fats: parseFloat(fats) || 0,
                carbs: parseFloat(carbs) || 0,
                userId: req.user.id
            }
        });
        res.status(201).json(newRecipe);
    } catch (error) {
        res.status(500).json({ error: 'Помилка збереження рецепта' });
    }
});

router.delete('/recipes/:id', isAuthenticated, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const deleted = await prisma.recipe.deleteMany({
            where: { id, userId: req.user.id },
        });
        if (deleted.count === 0) {
            return res.status(404).json({ error: 'Рецепт не знайдено або немає доступу' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Не вдалося видалити рецепт' });
    }
});

// ==========================================
// 6. МЕНСТРУАЛЬНИЙ ЦИКЛ, КАЛЕНДАР ТА РЕКОМЕНДАЦІЇ
// ==========================================

// Допоміжна функція: синхронізує lastPeriodStart та середні показники циклу у профілі User
async function syncUserCycleStats(userId) {
    const [user, allPeriods] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.cyclePeriod.findMany({
            where: { userId },
            orderBy: { startDate: 'desc' },
        }),
    ]);

    const stats = calculateCycleAverages(
        allPeriods,
        user?.cycleLength || 28,
        user?.periodLength || 5
    );

    const updateData = {
        lastPeriodStart: allPeriods.length > 0 ? allPeriods[0].startDate : null,
    };

    if (stats.isCycleAuto) {
        updateData.cycleLength = stats.avgCycleLength;
    }
    if (stats.isPeriodAuto) {
        updateData.periodLength = stats.avgPeriodLength;
    }

    await prisma.user.update({
        where: { id: userId },
        data: updateData,
    });

    return stats;
}

// GET /api/cycle/overview?date=YYYY-MM-DD
router.get('/cycle/overview', isAuthenticated, async (req, res) => {
    try {
        const dateStr = req.query.date || toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);

        const [user, periods, wellnessToday] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id } }),
            prisma.cyclePeriod.findMany({
                where: { userId: req.user.id },
                orderBy: { startDate: 'desc' },
                take: 24,
            }),
            prisma.dailyWellnessLog.findUnique({
                where: { userId_date: { userId: req.user.id, date: targetUTC } },
            }),
        ]);

        const cycleStats = calculateCycleAverages(
            periods,
            user.cycleLength || 28,
            user.periodLength || 5
        );

        const effectiveStart = periods.length > 0 ? periods[0].startDate : user.lastPeriodStart;
        const insights = calculateCycleInsights({
            lastPeriodStart: effectiveStart,
            cycleLength: cycleStats.avgCycleLength,
            periodLength: cycleStats.avgPeriodLength,
            targetDateStr: dateStr,
            symptoms: wellnessToday?.symptoms || [],
        });

        res.json({
            ...insights,
            cycleStats,
            periods: periods.slice(0, 12),
            wellnessToday: wellnessToday || {
                date: dateStr,
                mood: null,
                energyLevel: null,
                symptoms: [],
                activityType: null,
                activityMinutes: null,
                notes: '',
            },
        });
    } catch (error) {
        console.error('Помилка отримання огляду циклу:', error);
        res.status(500).json({ error: 'Помилка розрахунку циклу' });
    }
});

// Допоміжний пошук першої наявної Prisma-моделі зі списку кандидатів
function findPrismaDelegate(prismaClient, candidates) {
    for (const name of candidates) {
        if (prismaClient[name] && typeof prismaClient[name].findMany === 'function') {
            return prismaClient[name];
        }
    }
    return null;
}

// Коефіцієнти MET для розрахунку витрачених калорій за активність
const ACTIVITY_MET_MAP = {
    walking: 3.5,
    walk: 3.5,
    yoga: 3.0,
    stretching: 2.8,
    pilates: 3.2,
    strength: 5.5,
    gym: 5.5,
    workout: 5.5,
    cycling: 6.5,
    bike: 6.5,
    dancing: 5.0,
    dance: 5.0,
    swimming: 7.0,
    swim: 7.0,
    cardio: 7.0,
    running: 8.5,
    run: 8.5,
};

const MEAL_TYPE_LABELS = {
    breakfast: '🌅 Сніданок',
    lunch: '☀️ Обід',
    dinner: '🌙 Вечеря',
    snack: '🍎 Перекус',
};

function determineCyclePhaseForDate({ targetUTC, cycleLength, periodLength, latestStart }) {
    if (!latestStart) {
        return {
            configured: false,
            cycleDay: null,
            cycleLength,
            phaseKey: 'unknown',
            phaseName: 'Цикл не налаштовано',
            badgeColor: '#ec4899',
        };
    }

    const startUTC = toUTCDate(latestStart);
    const diffDays = Math.round((targetUTC - startUTC) / (24 * 60 * 60 * 1000));
    const normalizedDay = (((diffDays % cycleLength) + cycleLength) % cycleLength) + 1;
    const ovulationDay = Math.max(periodLength + 2, cycleLength - 14);

    if (normalizedDay <= periodLength) {
        return {
            configured: true,
            cycleDay: normalizedDay,
            cycleLength,
            phaseKey: 'menstrual',
            phaseName: 'Менструальна фаза',
            badgeColor: '#e11d48',
        };
    }
    if (normalizedDay < ovulationDay - 1) {
        return {
            configured: true,
            cycleDay: normalizedDay,
            cycleLength,
            phaseKey: 'follicular',
            phaseName: 'Фолікулярна фаза',
            badgeColor: '#10b981',
        };
    }
    if (normalizedDay <= ovulationDay + 1) {
        return {
            configured: true,
            cycleDay: normalizedDay,
            cycleLength,
            phaseKey: 'ovulation',
            phaseName: 'Овуляторна фаза',
            badgeColor: '#f59e0b',
        };
    }
    return {
        configured: true,
        cycleDay: normalizedDay,
        cycleLength,
        phaseKey: 'luteal',
        phaseName: 'Лютеїнова фаза',
        badgeColor: '#8b5cf6',
    };
}

// Розрахунок адаптивної денної норми калорій (база + витрати на тренування + поправка лютеїнової фази)
function calculateDynamicCalorieTarget({
                                           baseCalorieGoal = 2000,
                                           weightKg = 60,
                                           activityType = '',
                                           activityMinutes = 0,
                                           phaseKey = 'unknown',
                                           includeLutealBonus = true,
                                       }) {
    const base = Math.max(1000, Number(baseCalorieGoal) || 2000);
    const mins = Math.max(0, Number(activityMinutes) || 0);
    const actKey = String(activityType || '').trim().toLowerCase();

    let activityBonus = 0;
    if (actKey && mins > 0) {
        const met = ACTIVITY_MET_MAP[actKey] || 4.5;
        const w = Number(weightKg) > 25 ? Number(weightKg) : 60;
        activityBonus = Math.round(met * w * (mins / 60));
    }

    // У лютеїнову фазу основний обмін зростає приблизно на 100–150 ккал/добу
    const lutealBonus = includeLutealBonus && phaseKey === 'luteal' ? 120 : 0;
    const effectiveGoal = base + activityBonus + lutealBonus;

    return {
        baseGoal: base,
        activityBonus,
        lutealBonus,
        effectiveGoal,
        hasAdjustment: activityBonus > 0 || lutealBonus > 0,
    };
}

// GET /api/nutrition/dynamic-goal?date=YYYY-MM-DD - Адаптована норма калорій на дату
router.get('/nutrition/dynamic-goal', isAuthenticated, async (req, res) => {
    try {
        const dateStr =
            req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
                ? req.query.date
                : toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);
        const nextDayUTC = addDaysUTC(targetUTC, 1);
        const includeLutealBonus = req.query.luteal !== 'false';

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const wellnessModel = findPrismaDelegate(prisma, [
            'wellnessLog',
            'dailyWellness',
            'wellnessEntry',
            'wellness',
            'healthLog',
        ]);
        const periodModel = findPrismaDelegate(prisma, [
            'cyclePeriod',
            'periodLog',
            'menstrualPeriod',
            'period',
        ]);

        let wellness = null;
        if (wellnessModel) {
            try {
                wellness = await wellnessModel.findFirst({
                    where: { userId: req.user.id, date: { gte: targetUTC, lt: nextDayUTC } },
                });
            } catch {
                wellness = await wellnessModel.findFirst({
                    where: { userId: req.user.id, date: dateStr },
                });
            }
        }

        const periods = periodModel
            ? await periodModel.findMany({
                where: { userId: req.user.id },
                orderBy: { startDate: 'desc' },
                take: 3,
            })
            : [];

        const cycle = determineCyclePhaseForDate({
            targetUTC,
            cycleLength: user?.cycleLength || 28,
            periodLength: user?.periodLength || 5,
            latestStart: periods?.[0]?.startDate || user?.lastPeriodStart,
        });

        const dynamicGoal = calculateDynamicCalorieTarget({
            baseCalorieGoal: user?.calorieGoal || 2000,
            weightKg: user?.weight || 60,
            activityType: wellness?.activityType || '',
            activityMinutes: wellness?.activityMinutes || 0,
            phaseKey: cycle.phaseKey,
            includeLutealBonus,
        });

        res.json({
            date: dateStr,
            cycle,
            activity: {
                type: wellness?.activityType || '',
                minutes: wellness?.activityMinutes || 0,
            },
            ...dynamicGoal,
        });
    } catch (error) {
        console.error('Помилка розрахунку адаптивної норми калорій:', error);
        res.status(500).json({ error: 'Не вдалося розрахувати адаптивну норму калорій' });
    }
});

// GET /api/cycle/day-summary?date=YYYY-MM-DD - Зведена статистика дня + деталізація страв + адаптивна норма
router.get('/cycle/day-summary', isAuthenticated, async (req, res) => {
    try {
        const dateStr =
            req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
                ? req.query.date
                : toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);
        const { startOfDay, endOfDay } = getDayBounds(dateStr);

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });

        const [wellness, weightLog, meals, waters, periods] = await Promise.all([
            prisma.dailyWellnessLog.findUnique({
                where: { userId_date: { userId: req.user.id, date: targetUTC } },
            }),
            prisma.weightLog.findUnique({
                where: { userId_date: { userId: req.user.id, date: targetUTC } },
            }),
            prisma.meal.findMany({
                where: {
                    userId: req.user.id,
                    date: { gte: startOfDay, lte: endOfDay },
                },
                include: {
                    foodItems: { orderBy: { id: 'asc' } },
                },
                orderBy: { id: 'asc' },
            }),
            prisma.waterLog.findMany({
                where: {
                    userId: req.user.id,
                    date: { gte: startOfDay, lte: endOfDay },
                },
                orderBy: { id: 'asc' },
            }),
            prisma.cyclePeriod.findMany({
                where: { userId: req.user.id },
                orderBy: { startDate: 'desc' },
                take: 6,
            }),
        ]);

        const cycle = determineCyclePhaseForDate({
            targetUTC,
            cycleLength: user?.cycleLength || 28,
            periodLength: user?.periodLength || 5,
            latestStart: periods?.[0]?.startDate || user?.lastPeriodStart,
        });

        const dynamicCalories = calculateDynamicCalorieTarget({
            baseCalorieGoal: user?.calorieGoal || 2000,
            weightKg: weightLog?.weight ?? user?.weight ?? 60,
            activityType: wellness?.activityType || '',
            activityMinutes: wellness?.activityMinutes || 0,
            phaseKey: cycle.phaseKey,
            includeLutealBonus: true,
        });

        const formattedMeals = (meals || []).flatMap((meal) => {
            const rawMealType = String(meal.type || 'SNACK').toLowerCase();
            const mealLabel = MEAL_TYPE_LABELS[rawMealType] || '🍽️ Прийом їжі';

            return (meal.foodItems || []).map((item) => ({
                id: item.id,
                name: item.name,
                mealType: rawMealType,
                mealLabel,
                grams: Number(item.weight) || 100,
                calories: Math.round(Number(item.calories) || 0),
                proteins: Number((Number(item.proteins) || 0).toFixed(1)),
                fats: Number((Number(item.fats) || 0).toFixed(1)),
                carbs: Number((Number(item.carbs) || 0).toFixed(1)),
            }));
        });

        const nutrition = formattedMeals.reduce(
            (acc, item) => ({
                calories: acc.calories + item.calories,
                proteins: Number((acc.proteins + item.proteins).toFixed(1)),
                fats: Number((acc.fats + item.fats).toFixed(1)),
                carbs: Number((acc.carbs + item.carbs).toFixed(1)),
                entriesCount: acc.entriesCount + 1,
            }),
            { calories: 0, proteins: 0, fats: 0, carbs: 0, entriesCount: 0 }
        );

        const waterMl = (waters || []).reduce(
            (sum, w) => sum + (Number(w.amount) || 0),
            0
        );

        res.json({
            date: dateStr,
            cycle,
            dynamicCalories,
            wellness: {
                mood: wellness?.mood ?? null,
                energyLevel: wellness?.energyLevel ?? null,
                symptoms: Array.isArray(wellness?.symptoms) ? wellness.symptoms : [],
                activityType: wellness?.activityType || '',
                activityMinutes: wellness?.activityMinutes ?? null,
                notes: wellness?.notes || '',
            },
            nutrition: {
                ...nutrition,
                baseCalorieGoal: dynamicCalories.baseGoal,
                calorieGoal: dynamicCalories.effectiveGoal,
                meals: formattedMeals,
            },
            hydration: {
                waterMl,
                waterGoal: user?.waterGoal || 2000,
            },
            weight: weightLog ? weightLog.weight : null,
        });
    } catch (error) {
        console.error('Помилка отримання сводки дня:', error);
        res.status(500).json({ error: 'Не вдалося завантажити сводку за обраний день' });
    }
});

// GET /api/analytics/trends?days=30 - Довгострокові тренди (калорії, вода, симптоми та фази циклу)
router.get('/analytics/trends', isAuthenticated, async (req, res) => {
    try {
        const daysCount = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
        const todayStr = toLocalDateKey(new Date());
        const { startOfDay: todayStart, endOfDay: endLocal } = getDayBounds(todayStr);

        const startLocal = new Date(todayStart);
        startLocal.setDate(todayStart.getDate() - (daysCount - 1));

        const endUTC = addDaysUTC(toUTCDate(todayStr), 1);
        const startUTC = addDaysUTC(toUTCDate(todayStr), -(daysCount - 1));

        const [user, wellnessList, mealsList, waterList, periods] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id } }),
            prisma.dailyWellnessLog.findMany({
                where: {
                    userId: req.user.id,
                    date: { gte: startUTC, lt: endUTC },
                },
            }),
            prisma.meal.findMany({
                where: {
                    userId: req.user.id,
                    date: { gte: startLocal, lte: endLocal },
                },
                include: { foodItems: true },
            }),
            prisma.waterLog.findMany({
                where: {
                    userId: req.user.id,
                    date: { gte: startLocal, lte: endLocal },
                },
            }),
            prisma.cyclePeriod.findMany({
                where: { userId: req.user.id },
                orderBy: { startDate: 'desc' },
                take: 8,
            }),
        ]);

        const byDate = {};
        for (let i = 0; i < daysCount; i++) {
            const dLocal = new Date(startLocal);
            dLocal.setDate(startLocal.getDate() + i);
            const key = toLocalDateKey(dLocal);
            const dUTC = toUTCDate(key);

            const cycleInfo = determineCyclePhaseForDate({
                targetUTC: dUTC,
                cycleLength: user?.cycleLength || 28,
                periodLength: user?.periodLength || 5,
                latestStart: periods?.[0]?.startDate || user?.lastPeriodStart,
            });

            byDate[key] = {
                date: key,
                shortDate: `${key.slice(8, 10)}.${key.slice(5, 7)}`,
                phaseKey: cycleInfo.phaseKey,
                phaseName: cycleInfo.phaseName,
                calories: 0,
                proteins: 0,
                waterMl: 0,
                energyLevel: null,
                symptoms: [],
                activityMinutes: 0,
                activityType: '',
            };
        }

        for (const meal of mealsList) {
            const k = toLocalDateKey(meal.date);
            if (!byDate[k]) continue;

            if (Array.isArray(meal.foodItems) && meal.foodItems.length > 0) {
                for (const item of meal.foodItems) {
                    byDate[k].calories += Math.round(Number(item.calories) || 0);
                    byDate[k].proteins = Number(
                        (byDate[k].proteins + (Number(item.proteins) || 0)).toFixed(1)
                    );
                }
            } else {
                byDate[k].calories += Math.round(Number(meal.totalCalories) || 0);
                byDate[k].proteins = Number(
                    (byDate[k].proteins + (Number(meal.totalProtein) || 0)).toFixed(1)
                );
            }
        }

        for (const w of waterList) {
            const k = toLocalDateKey(w.date);
            if (byDate[k]) {
                byDate[k].waterMl += Number(w.amount) || 0;
            }
        }

        const symptomCounts = {};
        for (const log of wellnessList) {
            const k = formatUTCKey(toUTCDate(log.date));
            const syms = Array.isArray(log.symptoms) ? log.symptoms : [];

            if (byDate[k]) {
                byDate[k].energyLevel = log.energyLevel ?? null;
                byDate[k].symptoms = syms;
                byDate[k].activityMinutes = Number(log.activityMinutes) || 0;
                byDate[k].activityType = log.activityType || '';
            }

            for (const s of syms) {
                symptomCounts[s] = (symptomCounts[s] || 0) + 1;
            }
        }

        const dailySeries = Object.values(byDate).map((day) => {
            const dyn = calculateDynamicCalorieTarget({
                baseCalorieGoal: user?.calorieGoal || 2000,
                weightKg: user?.weight || 60,
                activityType: day.activityType,
                activityMinutes: day.activityMinutes,
                phaseKey: day.phaseKey,
                includeLutealBonus: true,
            });
            return {
                ...day,
                targetCalories: dyn.effectiveGoal,
            };
        });

        const loggedCalorieDays = dailySeries.filter((d) => d.calories > 0);
        const loggedWaterDays = dailySeries.filter((d) => d.waterMl > 0);

        const avgCalories =
            loggedCalorieDays.length > 0
                ? Math.round(loggedCalorieDays.reduce((s, d) => s + d.calories, 0) / loggedCalorieDays.length)
                : 0;

        const avgWaterMl =
            loggedWaterDays.length > 0
                ? Math.round(loggedWaterDays.reduce((s, d) => s + d.waterMl, 0) / loggedWaterDays.length)
                : 0;

        const phaseBuckets = {
            menstrual: { phaseKey: 'menstrual', phaseName: 'Менструальна', color: '#e11d48', calSum: 0, calDays: 0, waterSum: 0, waterDays: 0, energySum: 0, energyDays: 0, symptoms: {} },
            follicular: { phaseKey: 'follicular', phaseName: 'Фолікулярна', color: '#10b981', calSum: 0, calDays: 0, waterSum: 0, waterDays: 0, energySum: 0, energyDays: 0, symptoms: {} },
            ovulation: { phaseKey: 'ovulation', phaseName: 'Овуляція', color: '#f59e0b', calSum: 0, calDays: 0, waterSum: 0, waterDays: 0, energySum: 0, energyDays: 0, symptoms: {} },
            luteal: { phaseKey: 'luteal', phaseName: 'Лютеїнова (ПМС)', color: '#8b5cf6', calSum: 0, calDays: 0, waterSum: 0, waterDays: 0, energySum: 0, energyDays: 0, symptoms: {} },
        };

        for (const day of dailySeries) {
            const bucket = phaseBuckets[day.phaseKey];
            if (!bucket) continue;
            if (day.calories > 0) {
                bucket.calSum += day.calories;
                bucket.calDays += 1;
            }
            if (day.waterMl > 0) {
                bucket.waterSum += day.waterMl;
                bucket.waterDays += 1;
            }
            if (day.energyLevel != null) {
                bucket.energySum += Number(day.energyLevel);
                bucket.energyDays += 1;
            }
            for (const s of day.symptoms) {
                bucket.symptoms[s] = (bucket.symptoms[s] || 0) + 1;
            }
        }

        const byPhase = Object.values(phaseBuckets).map((b) => {
            const topSymEntry = Object.entries(b.symptoms).sort((a, c) => c[1] - a[1])[0];
            return {
                phaseKey: b.phaseKey,
                phaseName: b.phaseName,
                color: b.color,
                avgCalories: b.calDays > 0 ? Math.round(b.calSum / b.calDays) : null,
                avgWaterMl: b.waterDays > 0 ? Math.round(b.waterSum / b.waterDays) : null,
                avgEnergy: b.energyDays > 0 ? Number((b.energySum / b.energyDays).toFixed(1)) : null,
                topSymptomId: topSymEntry ? topSymEntry[0] : null,
                topSymptomCount: topSymEntry ? topSymEntry[1] : 0,
            };
        });

        const topSymptoms = Object.entries(symptomCounts)
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count);

        res.json({
            daysCount,
            baseCalorieGoal: user?.calorieGoal || 2000,
            waterGoal: user?.waterGoal || 2000,
            avgCalories,
            avgWaterMl,
            loggedCalorieDaysCount: loggedCalorieDays.length,
            loggedWaterDaysCount: loggedWaterDays.length,
            dailySeries,
            topSymptoms,
            byPhase,
        });
    } catch (error) {
        console.error('Помилка завантаження аналітики трендів:', error);
        res.status(500).json({ error: 'Не вдалося завантажити аналітику трендів' });
    }
});

// POST /api/cycle/periods - Відмітити початок (та за бажанням кінець) менструації
router.post('/cycle/periods', isAuthenticated, async (req, res) => {
    try {
        const { startDate, endDate, flowIntensity, notes } = req.body;
        if (!startDate) {
            return res.status(400).json({ error: 'Вкажіть дату початку менструації' });
        }

        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const parsedStart = toUTCDate(startDate);
        const parsedEnd = endDate
            ? toUTCDate(endDate)
            : addDaysUTC(parsedStart, Math.max(1, (user.periodLength || 5) - 1));

        const period = await prisma.cyclePeriod.create({
            data: {
                userId: req.user.id,
                startDate: parsedStart,
                endDate: parsedEnd,
                flowIntensity: flowIntensity || 'MEDIUM',
                notes: notes || null,
            },
        });

        const cycleStats = await syncUserCycleStats(req.user.id);
        res.status(201).json({ period, cycleStats });
    } catch (error) {
        console.error('Помилка створення запису менструації:', error);
        res.status(500).json({ error: 'Не вдалося зберегти дату циклу' });
    }
});

// POST /api/cycle/toggle-day - Точково додати або прибрати один день менструації
router.post('/cycle/toggle-day', isAuthenticated, async (req, res) => {
    try {
        const { date, flowIntensity } = req.body;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: 'Некоректний формат дати' });
        }

        const target = toUTCDate(date);
        const targetTime = target.getTime();
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const defaultLen = user?.periodLength || 5;

        const periods = await prisma.cyclePeriod.findMany({
            where: { userId: req.user.id },
            orderBy: { startDate: 'asc' },
        });

        // 1. Якщо дата вже входить у відмічений період — прибираємо її
        const containing = periods.find((p) => {
            const s = toUTCDate(p.startDate).getTime();
            const e = p.endDate
                ? toUTCDate(p.endDate).getTime()
                : addDaysUTC(toUTCDate(p.startDate), defaultLen - 1).getTime();
            return targetTime >= s && targetTime <= e;
        });

        if (containing) {
            const sDate = toUTCDate(containing.startDate);
            const eDate = containing.endDate
                ? toUTCDate(containing.endDate)
                : addDaysUTC(sDate, defaultLen - 1);

            if (sDate.getTime() === targetTime && eDate.getTime() === targetTime) {
                await prisma.cyclePeriod.delete({ where: { id: containing.id } });
            } else if (sDate.getTime() === targetTime) {
                await prisma.cyclePeriod.update({
                    where: { id: containing.id },
                    data: { startDate: addDaysUTC(sDate, 1), endDate: eDate },
                });
            } else if (eDate.getTime() === targetTime) {
                await prisma.cyclePeriod.update({
                    where: { id: containing.id },
                    data: { endDate: addDaysUTC(eDate, -1) },
                });
            } else {
                await prisma.cyclePeriod.update({
                    where: { id: containing.id },
                    data: { endDate: addDaysUTC(target, -1) },
                });
                await prisma.cyclePeriod.create({
                    data: {
                        userId: req.user.id,
                        startDate: addDaysUTC(target, 1),
                        endDate: eDate,
                        flowIntensity: containing.flowIntensity || 'MEDIUM',
                        notes: containing.notes || null,
                    },
                });
            }

            const cycleStats = await syncUserCycleStats(req.user.id);
            return res.json({ action: 'removed', date, cycleStats });
        }

        // 2. Якщо дата ще не відмічена — додаємо та об'єднуємо із сусідніми днями
        const prevDayTime = addDaysUTC(target, -1).getTime();
        const nextDayTime = addDaysUTC(target, 1).getTime();

        const prevPeriod = periods.find((p) => {
            const s = toUTCDate(p.startDate);
            const e = p.endDate ? toUTCDate(p.endDate) : addDaysUTC(s, defaultLen - 1);
            return e.getTime() === prevDayTime;
        });

        const nextPeriod = periods.find((p) => {
            const s = toUTCDate(p.startDate);
            return s.getTime() === nextDayTime;
        });

        if (prevPeriod && nextPeriod) {
            const nextEnd = nextPeriod.endDate
                ? toUTCDate(nextPeriod.endDate)
                : addDaysUTC(toUTCDate(nextPeriod.startDate), defaultLen - 1);
            await prisma.cyclePeriod.update({
                where: { id: prevPeriod.id },
                data: { endDate: nextEnd },
            });
            await prisma.cyclePeriod.delete({ where: { id: nextPeriod.id } });
        } else if (prevPeriod) {
            await prisma.cyclePeriod.update({
                where: { id: prevPeriod.id },
                data: { endDate: target },
            });
        } else if (nextPeriod) {
            await prisma.cyclePeriod.update({
                where: { id: nextPeriod.id },
                data: { startDate: target },
            });
        } else {
            await prisma.cyclePeriod.create({
                data: {
                    userId: req.user.id,
                    startDate: target,
                    endDate: target,
                    flowIntensity: flowIntensity || 'MEDIUM',
                },
            });
        }

        const cycleStats = await syncUserCycleStats(req.user.id);
        return res.json({ action: 'added', date, cycleStats });
    } catch (error) {
        console.error('Помилка редагування дня менструації:', error);
        res.status(500).json({ error: 'Не вдалося оновити день менструації' });
    }
});

// PUT /api/cycle/periods/:id - Оновити період
router.put('/cycle/periods/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existing = await prisma.cyclePeriod.findUnique({ where: { id } });
        if (!existing || existing.userId !== req.user.id) {
            return res.status(403).json({ error: 'Відмовлено в доступі' });
        }

        const { startDate, endDate, flowIntensity, notes } = req.body;
        const updated = await prisma.cyclePeriod.update({
            where: { id },
            data: {
                ...(startDate ? { startDate: toUTCDate(startDate) } : {}),
                ...(endDate !== undefined ? { endDate: endDate ? toUTCDate(endDate) : null } : {}),
                ...(flowIntensity !== undefined ? { flowIntensity } : {}),
                ...(notes !== undefined ? { notes } : {}),
            },
        });

        const cycleStats = await syncUserCycleStats(req.user.id);
        res.json({ period: updated, cycleStats });
    } catch (error) {
        res.status(500).json({ error: 'Помилка оновлення запису циклу' });
    }
});

// DELETE /api/cycle/periods/:id
router.delete('/cycle/periods/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existing = await prisma.cyclePeriod.findUnique({ where: { id } });
        if (!existing || existing.userId !== req.user.id) {
            return res.status(403).json({ error: 'Відмовлено в доступі' });
        }

        await prisma.cyclePeriod.delete({ where: { id } });
        const cycleStats = await syncUserCycleStats(req.user.id);

        res.json({ success: true, cycleStats });
    } catch (error) {
        res.status(500).json({ error: 'Помилка видалення запису циклу' });
    }
});

// GET /api/cycle/calendar?year=2026&month=11 - Дані для сітки календаря на місяць
router.get('/cycle/calendar', isAuthenticated, async (req, res) => {
    try {
        const now = new Date();
        const year = parseInt(req.query.year, 10) || now.getFullYear();
        const month = parseInt(req.query.month, 10) || now.getMonth() + 1;

        const monthStart = new Date(Date.UTC(year, month - 1, 1));
        const monthEnd = new Date(Date.UTC(year, month, 0));

        const [user, periods, wellnessLogs, medLogs] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id } }),
            prisma.cyclePeriod.findMany({
                where: { userId: req.user.id },
                orderBy: { startDate: 'desc' },
            }),
            prisma.dailyWellnessLog.findMany({
                where: {
                    userId: req.user.id,
                    date: { gte: monthStart, lte: monthEnd },
                },
            }),
            prisma.medicationLog.findMany({
                where: {
                    medication: { userId: req.user.id },
                    date: { gte: monthStart, lte: monthEnd },
                    taken: true,
                },
            }),
        ]);

        const cycleStats = calculateCycleAverages(
            periods,
            user.cycleLength || 28,
            user.periodLength || 5
        );

        const actualPeriodDays = new Set();
        periods.forEach((p) => {
            const s = toUTCDate(p.startDate);
            const e = p.endDate ? toUTCDate(p.endDate) : addDaysUTC(s, cycleStats.avgPeriodLength - 1);
            for (let d = new Date(s); d <= e; d = addDaysUTC(d, 1)) {
                actualPeriodDays.add(formatUTCKey(d));
            }
        });

        const predictedPeriodDays = new Set();
        const fertileDays = new Set();
        const ovulationDays = new Set();

        const anchorStart = periods.length > 0 ? toUTCDate(periods[0].startDate) : user.lastPeriodStart ? toUTCDate(user.lastPeriodStart) : null;
        if (anchorStart) {
            const cLen = cycleStats.avgCycleLength;
            const pLen = cycleStats.avgPeriodLength;
            const ovuOffset = Math.max(pLen + 1, cLen - 14 - 1);

            for (let cycleIdx = 0; cycleIdx <= 4; cycleIdx++) {
                const cStart = addDaysUTC(anchorStart, cycleIdx * cLen);
                if (cycleIdx > 0) {
                    for (let d = 0; d < pLen; d++) {
                        predictedPeriodDays.add(formatUTCKey(addDaysUTC(cStart, d)));
                    }
                }
                const ovuDate = addDaysUTC(cStart, ovuOffset);
                ovulationDays.add(formatUTCKey(ovuDate));
                for (let f = -4; f <= 1; f++) {
                    fertileDays.add(formatUTCKey(addDaysUTC(ovuDate, f)));
                }
            }
        }

        const wellnessByDate = {};
        wellnessLogs.forEach((log) => {
            wellnessByDate[formatUTCKey(log.date)] = log;
        });

        const medsCountByDate = {};
        medLogs.forEach((ml) => {
            const k = formatUTCKey(ml.date);
            medsCountByDate[k] = (medsCountByDate[k] || 0) + 1;
        });

        res.json({
            year,
            month,
            cycleStats,
            actualPeriodDays: Array.from(actualPeriodDays),
            predictedPeriodDays: Array.from(predictedPeriodDays),
            fertileDays: Array.from(fertileDays),
            ovulationDays: Array.from(ovulationDays),
            wellnessByDate,
            medsCountByDate,
        });
    } catch (error) {
        console.error('Помилка завантаження календаря циклу:', error);
        res.status(500).json({ error: 'Помилка завантаження календаря' });
    }
});

// ==========================================
// 7. НАСТРІЙ, СИМПТОМИ ТА АКТИВНІСТЬ (DAILY WELLNESS)
// ==========================================

router.get('/wellness', isAuthenticated, async (req, res) => {
    try {
        const dateStr = req.query.date || toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);

        const log = await prisma.dailyWellnessLog.findUnique({
            where: { userId_date: { userId: req.user.id, date: targetUTC } },
        });

        res.json(
            log || {
                date: dateStr,
                mood: null,
                energyLevel: null,
                symptoms: [],
                activityType: null,
                activityMinutes: null,
                notes: '',
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Помилка завантаження самопочуття' });
    }
});

router.put('/wellness', isAuthenticated, async (req, res) => {
    try {
        const { date, mood, energyLevel, symptoms, activityType, activityMinutes, notes } = req.body;
        const dateStr = date || toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);

        const patch = {};
        if (mood !== undefined) patch.mood = mood || null;
        if (energyLevel !== undefined) patch.energyLevel = energyLevel ? parseInt(energyLevel, 10) : null;
        if (symptoms !== undefined) patch.symptoms = Array.isArray(symptoms) ? symptoms : [];
        if (activityType !== undefined) patch.activityType = activityType || null;
        if (activityMinutes !== undefined) {
            patch.activityMinutes = activityMinutes !== '' && activityMinutes !== null ? parseInt(activityMinutes, 10) : null;
        }
        if (notes !== undefined) patch.notes = notes || null;

        const saved = await prisma.dailyWellnessLog.upsert({
            where: { userId_date: { userId: req.user.id, date: targetUTC } },
            update: patch,
            create: {
                userId: req.user.id,
                date: targetUTC,
                mood: patch.mood ?? null,
                energyLevel: patch.energyLevel ?? null,
                symptoms: patch.symptoms ?? [],
                activityType: patch.activityType ?? null,
                activityMinutes: patch.activityMinutes ?? null,
                notes: patch.notes ?? null,
            },
        });

        res.json(saved);
    } catch (error) {
        console.error('Помилка збереження самопочуття:', error);
        res.status(500).json({ error: 'Не вдалося зберегти стан за день' });
    }
});

// ==========================================
// 8. ТРЕКЕР ПРЕПАРАТІВ (КОК, ВІТАМІНИ, ІНШІ)
// ==========================================

router.get('/medications', isAuthenticated, async (req, res) => {
    try {
        const dateStr = req.query.date || toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);

        const medications = await prisma.medication.findMany({
            where: { userId: req.user.id, isActive: true },
            include: {
                logs: {
                    where: { date: targetUTC },
                },
            },
            orderBy: { id: 'asc' },
        });

        const formatted = medications.map((med) => ({
            ...med,
            takenToday: med.logs.length > 0 && med.logs[0].taken,
            cocStatus: calculateCocStatus(med, dateStr),
        }));

        res.json(formatted);
    } catch (error) {
        console.error('Помилка завантаження препаратів:', error);
        res.status(500).json({ error: 'Помилка завантаження препаратів' });
    }
});

router.post('/medications', isAuthenticated, async (req, res) => {
    try {
        const { name, category, dosage, cocScheme, packStart, reminderTime } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Вкажіть назву препарату' });
        }

        const med = await prisma.medication.create({
            data: {
                userId: req.user.id,
                name: name.trim(),
                category: category || 'VITAMIN',
                dosage: dosage || null,
                cocScheme: category === 'COC' ? cocScheme || '21/7' : null,
                packStart: category === 'COC' && packStart ? toUTCDate(packStart) : null,
                reminderTime: reminderTime || null,
            },
        });

        res.status(201).json(med);
    } catch (error) {
        console.error('Помилка створення препарату:', error);
        res.status(500).json({ error: 'Не вдалося додати препарат' });
    }
});

router.post('/medications/:id/toggle', isAuthenticated, async (req, res) => {
    try {
        const medicationId = parseInt(req.params.id, 10);
        const dateStr = req.body.date || toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);

        const med = await prisma.medication.findUnique({ where: { id: medicationId } });
        if (!med || med.userId !== req.user.id) {
            return res.status(403).json({ error: 'Відмовлено в доступі' });
        }

        const existingLog = await prisma.medicationLog.findUnique({
            where: { medicationId_date: { medicationId, date: targetUTC } },
        });

        if (existingLog) {
            const updated = await prisma.medicationLog.update({
                where: { id: existingLog.id },
                data: { taken: !existingLog.taken },
            });
            return res.json({ taken: updated.taken });
        } else {
            const created = await prisma.medicationLog.create({
                data: { medicationId, date: targetUTC, taken: true },
            });
            return res.json({ taken: created.taken });
        }
    } catch (error) {
        console.error('Помилка відмітки прийому препарату:', error);
        res.status(500).json({ error: 'Не вдалося оновити прийом препарату' });
    }
});

router.delete('/medications/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const med = await prisma.medication.findUnique({ where: { id } });
        if (!med || med.userId !== req.user.id) {
            return res.status(403).json({ error: 'Відмовлено в доступі' });
        }

        await prisma.medication.update({
            where: { id },
            data: { isActive: false },
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Не вдалося видалити препарат' });
    }
});

// ==========================================
// 9. FATSECRET API + УКРАЇНСЬКИЙ ПОШУК (ПЕРЕКЛАД + OPEN FOOD FACTS UA)
// ==========================================
let fsAccessToken = null;
let fsTokenExpiry = null;
const translationCache = new Map();

const hasCyrillic = (text = '') => /[а-яіїєґА-ЯІЇЄҐ]/.test(text);

async function translateText(text, sourceLang, targetLang) {
    const clean = (text || '').trim();
    if (!clean) return clean;

    const cacheKey = `${sourceLang}:${targetLang}:${clean.toLowerCase()}`;
    if (translationCache.has(cacheKey)) {
        return translationCache.get(cacheKey);
    }

    try {
        const { data } = await axios.get('https://translate.googleapis.com/translate_a/single', {
            params: {
                client: 'gtx',
                sl: sourceLang,
                tl: targetLang,
                dt: 't',
                q: clean,
            },
            timeout: 2500,
        });

        const translated = Array.isArray(data?.[0])
            ? data[0].map((part) => part?.[0] || '').join('').trim()
            : clean;

        if (translated) {
            if (translationCache.size > 2000) translationCache.clear();
            translationCache.set(cacheKey, translated);
            return translated;
        }
        return clean;
    } catch {
        return clean;
    }
}

async function searchOpenFoodFactsUA(query, limit = 6) {
    try {
        const { data } = await axios.get('https://uk.openfoodfacts.org/cgi/search.pl', {
            params: {
                search_terms: query,
                search_simple: 1,
                action: 'process',
                json: 1,
                page_size: limit,
                fields: 'code,product_name,product_name_uk,brands,image_front_small_url,nutriments',
            },
            headers: {
                'User-Agent': 'NutriTrack/1.0 (https://nutritrack-cu8u.onrender.com)',
            },
            timeout: 3500,
        });

        const products = Array.isArray(data?.products) ? data.products : [];

        return products
            .map((p) => {
                const name = (p.product_name_uk || p.product_name || '').trim();
                const n = p.nutriments || {};
                const rawKcal =
                    n['energy-kcal_100g'] ??
                    n['energy-kcal'] ??
                    (n['energy_100g'] ? Number(n['energy_100g']) / 4.184 : null);

                if (!name || rawKcal === null || Number.isNaN(Number(rawKcal))) return null;

                const calories = Math.round(Number(rawKcal) * 10) / 10;
                const proteins = Math.round((Number(n['proteins_100g']) || 0) * 10) / 10;
                const fats = Math.round((Number(n['fat_100g']) || 0) * 10) / 10;
                const carbs = Math.round((Number(n['carbohydrates_100g']) || 0) * 10) / 10;

                return {
                    id: `off-${p.code}`,
                    product_name: name,
                    brand: (p.brands || 'Open Food Facts UA').split(',')[0].trim(),
                    description: `Ккал: ${calories} | Б: ${proteins}г | Ж: ${fats}г | В: ${carbs}г (на 100г)`,
                    isCustom: true,
                    image_url: p.image_front_small_url || 'https://via.placeholder.com/100?text=UA',
                    nutriments: {
                        'energy-kcal_100g': calories,
                        'proteins_100g': proteins,
                        'fat_100g': fats,
                        'carbohydrates_100g': carbs,
                    },
                };
            })
            .filter(Boolean);
    } catch {
        return [];
    }
}

async function getFatSecretToken(forceRefresh = false) {
    if (!forceRefresh && fsAccessToken && fsTokenExpiry && Date.now() < fsTokenExpiry) {
        return fsAccessToken;
    }

    const clientId = process.env.FATSECRET_CLIENT_ID?.trim();
    const clientSecret = process.env.FATSECRET_CLIENT_SECRET?.trim();

    if (!clientId || !clientSecret) {
        throw new Error('FATSECRET_CLIENT_ID або FATSECRET_CLIENT_SECRET не задані у .env');
    }

    const authStr = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await axios.post(
        'https://oauth.fatsecret.com/connect/token',
        'grant_type=client_credentials&scope=basic',
        {
            headers: {
                Authorization: `Basic ${authStr}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 8000,
        }
    );

    fsAccessToken = response.data.access_token;
    fsTokenExpiry = Date.now() + Math.max(60, (response.data.expires_in || 3600) - 300) * 1000;
    return fsAccessToken;
}

function normalizeFatSecretFoods(rawFoods) {
    if (!rawFoods) return [];
    const foodsArray = Array.isArray(rawFoods) ? rawFoods : [rawFoods];

    return foodsArray.map((food) => {
        const desc = food.food_description || '';

        const kcalMatch = desc.match(/Calories:\s*([\d.]+)\s*kcal/i);
        const fatMatch = desc.match(/Fat:\s*([\d.]+)\s*g/i);
        const carbsMatch = desc.match(/Carbs:\s*([\d.]+)\s*g/i);
        const proteinMatch = desc.match(/Protein:\s*([\d.]+)\s*g/i);

        let baseWeight = 100;
        const weightMatch =
            desc.match(/\((\d+(?:\.\d+)?)\s*(?:g|ml)\)/i) ||
            desc.match(/Per\s+(\d+(?:\.\d+)?)\s*(?:g|ml)/i);
        if (weightMatch) {
            baseWeight = parseFloat(weightMatch[1]) || 100;
        }

        const multiplier = 100 / baseWeight;

        const calories = Math.round(((kcalMatch ? parseFloat(kcalMatch[1]) : 0) * multiplier) * 10) / 10;
        const fats = Math.round(((fatMatch ? parseFloat(fatMatch[1]) : 0) * multiplier) * 10) / 10;
        const carbs = Math.round(((carbsMatch ? parseFloat(carbsMatch[1]) : 0) * multiplier) * 10) / 10;
        const proteins = Math.round(((proteinMatch ? parseFloat(proteinMatch[1]) : 0) * multiplier) * 10) / 10;

        return {
            id: `fs-${food.food_id}`,
            product_name: food.food_name,
            brand: food.brand_name || 'Загальна база',
            description: desc,
            isCustom: true,
            image_url: 'https://via.placeholder.com/100?text=FatSecret',
            nutriments: {
                'energy-kcal_100g': calories,
                'proteins_100g': proteins,
                'fat_100g': fats,
                'carbohydrates_100g': carbs,
            },
        };
    });
}

async function fetchFatSecretFoods(searchExpression, maxResults) {
    const runSearch = async (forceRefreshToken = false) => {
        const token = await getFatSecretToken(forceRefreshToken);
        return axios.get('https://platform.fatsecret.com/rest/server.api', {
            params: {
                method: 'foods.search',
                search_expression: searchExpression,
                format: 'json',
                max_results: maxResults,
            },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 8000,
        });
    };

    let response;
    try {
        response = await runSearch(false);
    } catch (err) {
        if (err.response && err.response.status === 401) {
            response = await runSearch(true);
        } else {
            throw err;
        }
    }

    if (response.data?.error) {
        const code = response.data.error.code;
        if (code === 13 || code === 14 || /token|auth/i.test(response.data.error.message || '')) {
            response = await runSearch(true);
        } else {
            throw new Error(response.data.error.message || 'Помилка FatSecret API');
        }
    }

    return normalizeFatSecretFoods(response.data?.foods?.food);
}

router.get('/fatsecret/search', isAuthenticated, async (req, res) => {
    try {
        const query = (req.query.query || '').trim();
        const maxResults = Math.min(25, Math.max(1, parseInt(req.query.maxResults, 10) || 15));
        if (!query || query.length < 2) return res.json([]);

        const isUkrainianQuery = hasCyrillic(query);

        // Якщо запит латиницею — шукаємо напряму у FatSecret без перекладу
        if (!isUkrainianQuery) {
            const foods = await fetchFatSecretFoods(query, maxResults);
            return res.json(foods);
        }

        // Якщо запит українською — перекладаємо для FatSecret та паралельно шукаємо в українському Open Food Facts
        const englishQuery = await translateText(query, 'uk', 'en');

        const [fsSettled, offUaSettled] = await Promise.allSettled([
            !hasCyrillic(englishQuery)
                ? fetchFatSecretFoods(englishQuery, maxResults)
                : Promise.resolve([]),
            searchOpenFoodFactsUA(query, 6),
        ]);

        let fsFoods = fsSettled.status === 'fulfilled' ? fsSettled.value : [];
        const offUaFoods = offUaSettled.status === 'fulfilled' ? offUaSettled.value : [];

        // Перекладаємо назви знайдених продуктів із FatSecret українською (збережемо англійську назву в описі)
        if (fsFoods.length > 0) {
            fsFoods = await Promise.all(
                fsFoods.map(async (item) => {
                    const ukName = await translateText(item.product_name, 'en', 'uk');
                    return {
                        ...item,
                        product_name: ukName,
                        description:
                            ukName.toLowerCase() !== item.product_name.toLowerCase()
                                ? `${item.product_name} • ${item.description}`
                                : item.description,
                    };
                })
            );
        }

        const combined = [...offUaFoods, ...fsFoods].slice(0, maxResults);
        res.json(combined);
    } catch (error) {
        console.error('FatSecret Search Error:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Помилка при запиті до бази продуктів',
            details: error.message,
        });
    }
});

function calculateWeightProgress({
                                     logs = [],
                                     currentWeight,
                                     targetWeight,
                                     calorieGoal,
                                     height,
                                     age,
                                     gender,
                                     activityLevel,
                                     desiredWeeklyRate = null,
                                 }) {
    const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
    const latestWeight = sorted.length > 0 ? sorted[sorted.length - 1].weight : (currentWeight ?? null);
    const startWeight = sorted.length > 0 ? sorted[0].weight : latestWeight;

    if (latestWeight === null || targetWeight === null || targetWeight === undefined) {
        return {
            configured: false,
            startWeight,
            currentWeight: latestWeight,
            targetWeight: targetWeight ?? null,
            logs: sorted.map((l) => ({
                id: l.id,
                date: formatUTCKey(toUTCDate(l.date)),
                weight: l.weight,
            })),
        };
    }

    const totalDelta = Number((targetWeight - startWeight).toFixed(1));
    const remainingDelta = Number((targetWeight - latestWeight).toFixed(1));
    const achievedDelta = Number((latestWeight - startWeight).toFixed(1));
    const isLossGoal = targetWeight < latestWeight || (latestWeight === targetWeight && targetWeight < startWeight);
    const isGainGoal = targetWeight > latestWeight || (latestWeight === targetWeight && targetWeight > startWeight);

    // Відсоток досягнення цілі
    let progressPercent = 0;
    if (Math.abs(remainingDelta) < 0.1) {
        progressPercent = 100;
    } else if (isLossGoal && startWeight > targetWeight) {
        progressPercent = Math.max(
            0,
            Math.min(100, Math.round(((startWeight - latestWeight) / (startWeight - targetWeight)) * 100))
        );
    } else if (isGainGoal && targetWeight > startWeight) {
        progressPercent = Math.max(
            0,
            Math.min(100, Math.round(((latestWeight - startWeight) / (targetWeight - startWeight)) * 100))
        );
    }

    // 1. Фактичний темп (кг/тиждень) за історією зважувань
    let actualWeeklyRate = null;
    if (sorted.length >= 2) {
        const firstDate = new Date(sorted[0].date);
        const lastDate = new Date(sorted[sorted.length - 1].date);
        const daysElapsed = Math.max(1, Math.round((lastDate - firstDate) / (24 * 60 * 60 * 1000)));
        if (daysElapsed >= 1) {
            actualWeeklyRate = Number((((latestWeight - startWeight) / daysElapsed) * 7).toFixed(2));
        }
    }

    // 2. Розрахунок TDEE (добової витрати енергії) за формулою Міффліна — Сан-Жеора
    let tdee = null;
    let theoreticalWeeklyRate = null;
    if (latestWeight && height && age) {
        const s = String(gender).toLowerCase() === 'male' ? 5 : -161;
        const bmr = 10 * latestWeight + 6.25 * height - 5 * age + s;
        const multipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9,
        };
        const factor = multipliers[String(activityLevel).toLowerCase()] || 1.375;
        tdee = Math.round(bmr * factor);
        if (calorieGoal) {
            const dailyBalance = calorieGoal - tdee;
            theoreticalWeeklyRate = Number(((dailyBalance * 7) / 7700).toFixed(2));
        }
    }

    // 3. Визначаємо темп для прогнозу (схуднення або набір маси)
    const parsedDesiredRate = desiredWeeklyRate ? Math.abs(parseFloat(desiredWeeklyRate)) : null;
    let activeWeeklyRate = null;
    let forecastSource = 'safe_default';
    let recommendedCalories = null;

    if (isLossGoal && parsedDesiredRate && parsedDesiredRate >= 0.1 && parsedDesiredRate <= 2.0) {
        activeWeeklyRate = -Number(parsedDesiredRate.toFixed(2));
        forecastSource = 'chosen_pace';
        if (tdee) {
            const dailyDeficit = Math.round((parsedDesiredRate * 7700) / 7);
            recommendedCalories = Math.max(1200, tdee - dailyDeficit);
        }
    } else if (isGainGoal && parsedDesiredRate && parsedDesiredRate >= 0.1 && parsedDesiredRate <= 2.0) {
        activeWeeklyRate = Number(parsedDesiredRate.toFixed(2));
        forecastSource = 'chosen_pace';
        if (tdee) {
            const dailySurplus = Math.round((parsedDesiredRate * 7700) / 7);
            recommendedCalories = Math.min(6000, tdee + dailySurplus);
        }
    } else if (
        actualWeeklyRate !== null &&
        ((isLossGoal && actualWeeklyRate < -0.05) || (isGainGoal && actualWeeklyRate > 0.05))
    ) {
        activeWeeklyRate = actualWeeklyRate;
        forecastSource = 'actual_trend';
    } else if (
        theoreticalWeeklyRate !== null &&
        ((isLossGoal && theoreticalWeeklyRate < -0.05) || (isGainGoal && theoreticalWeeklyRate > 0.05))
    ) {
        activeWeeklyRate = theoreticalWeeklyRate;
        forecastSource = 'calorie_deficit';
    } else if (Math.abs(remainingDelta) >= 0.1) {
        activeWeeklyRate = isLossGoal ? -0.5 : 0.3;
        forecastSource = 'safe_default';
    }

    let estimatedDays = null;
    let estimatedWeeks = null;
    let estimatedDate = null;

    if (Math.abs(remainingDelta) < 0.1) {
        estimatedDays = 0;
        estimatedWeeks = 0;
        estimatedDate = formatUTCKey(toUTCDate(new Date()));
    } else if (activeWeeklyRate) {
        estimatedDays = Math.ceil((Math.abs(remainingDelta) / Math.abs(activeWeeklyRate)) * 7);
        estimatedWeeks = Number((estimatedDays / 7).toFixed(1));
        estimatedDate = formatUTCKey(addDaysUTC(toUTCDate(new Date()), estimatedDays));
    }

    return {
        configured: true,
        isLossGoal,
        isGainGoal,
        startWeight,
        currentWeight: latestWeight,
        targetWeight,
        totalDelta,
        achievedDelta,
        remainingDelta,
        progressPercent,
        actualWeeklyRate,
        theoreticalWeeklyRate,
        activeWeeklyRate,
        forecastSource,
        recommendedCalories,
        tdee,
        estimatedDays,
        estimatedWeeks,
        estimatedDate,
        logs: sorted.map((l) => ({
            id: l.id,
            date: formatUTCKey(toUTCDate(l.date)),
            weight: l.weight,
        })),
    };
}

// ==========================================
// 10. ТРЕКЕР ВАГИ ТА ПРОГНОЗ ДОСЯГНЕННЯ ЦІЛІ
// ==========================================

// GET /api/weight - Отримати історію зважувань, статистику та прогноз
router.get('/weight', isAuthenticated, async (req, res) => {
    try {
        const rawRate = req.query.weeklyRate ?? req.query.weeklyLoss;
        const desiredWeeklyRate = rawRate ? parseFloat(rawRate) : null;

        const [user, logs] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id } }),
            prisma.weightLog.findMany({
                where: { userId: req.user.id },
                orderBy: { date: 'asc' },
                take: 120,
            }),
        ]);

        let effectiveLogs = logs;
        if (logs.length === 0 && user?.weight) {
            const initialLog = await prisma.weightLog.create({
                data: {
                    userId: req.user.id,
                    weight: user.weight,
                    date: toUTCDate(toLocalDateKey(new Date())),
                },
            });
            effectiveLogs = [initialLog];
        }

        const stats = calculateWeightProgress({
            logs: effectiveLogs,
            currentWeight: user?.weight,
            targetWeight: user?.targetWeight,
            calorieGoal: user?.calorieGoal,
            height: user?.height,
            age: user?.age,
            gender: user?.gender,
            activityLevel: user?.activityLevel,
            desiredWeeklyRate,
        });

        res.json(stats);
    } catch (error) {
        console.error('Помилка завантаження статистики ваги:', error);
        res.status(500).json({ error: 'Помилка завантаження ваги' });
    }
});

// POST /api/weight - Оновити поточну вагу (зі збереженням стартової точки)
router.post('/weight', isAuthenticated, async (req, res) => {
    try {
        const { weight, date } = req.body;
        const parsedWeight = parseFloat(weight);
        if (!parsedWeight || parsedWeight < 25 || parsedWeight > 350) {
            return res.status(400).json({ error: 'Вкажіть коректну вагу (від 25 до 350 кг)' });
        }

        const dateStr = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toLocalDateKey(new Date());
        const targetUTC = toUTCDate(dateStr);

        const existingLogs = await prisma.weightLog.findMany({
            where: { userId: req.user.id },
            orderBy: { date: 'asc' },
        });

        // Якщо є лише 1 стартовий запис на ту саму дату, переносимо його на 1 день назад
        if (
            existingLogs.length === 1 &&
            existingLogs[0].date.getTime() === targetUTC.getTime() &&
            existingLogs[0].weight !== parsedWeight
        ) {
            const prevDayUTC = addDaysUTC(targetUTC, -1);
            await prisma.weightLog.update({
                where: { id: existingLogs[0].id },
                data: { date: prevDayUTC },
            });
        }

        await prisma.weightLog.upsert({
            where: { userId_date: { userId: req.user.id, date: targetUTC } },
            update: { weight: parsedWeight },
            create: { userId: req.user.id, date: targetUTC, weight: parsedWeight },
        });

        const latestLog = await prisma.weightLog.findFirst({
            where: { userId: req.user.id },
            orderBy: { date: 'desc' },
        });

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: { weight: latestLog ? latestLog.weight : parsedWeight },
        });

        res.status(201).json({ user: updatedUser });
    } catch (error) {
        console.error('Помилка збереження ваги:', error);
        res.status(500).json({ error: 'Не вдалося оновити вагу' });
    }
});

// PUT /api/weight/start - Пряме редагування стартової ваги без зміни поточної
router.put('/weight/start', isAuthenticated, async (req, res) => {
    try {
        const parsedStart = parseFloat(req.body.startWeight);
        if (!parsedStart || parsedStart < 25 || parsedStart > 350) {
            return res.status(400).json({ error: 'Вкажіть коректну стартову вагу (25–350 кг)' });
        }

        const [user, logs] = await Promise.all([
            prisma.user.findUnique({ where: { id: req.user.id } }),
            prisma.weightLog.findMany({
                where: { userId: req.user.id },
                orderBy: { date: 'asc' },
            }),
        ]);

        const todayUTC = toUTCDate(toLocalDateKey(new Date()));

        if (logs.length === 0) {
            const yesterdayUTC = addDaysUTC(todayUTC, -1);
            await prisma.weightLog.create({
                data: { userId: req.user.id, weight: parsedStart, date: yesterdayUTC },
            });
            if (user?.weight) {
                await prisma.weightLog.create({
                    data: { userId: req.user.id, weight: user.weight, date: todayUTC },
                });
            }
        } else if (logs.length === 1) {
            const currentVal = logs[0].weight;
            const prevDayUTC = addDaysUTC(logs[0].date, -1);
            await prisma.weightLog.update({
                where: { id: logs[0].id },
                data: { weight: parsedStart, date: prevDayUTC },
            });
            await prisma.weightLog.create({
                data: { userId: req.user.id, weight: currentVal, date: logs[0].date },
            });
        } else {
            await prisma.weightLog.update({
                where: { id: logs[0].id },
                data: { weight: parsedStart },
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Помилка оновлення стартової ваги:', error);
        res.status(500).json({ error: 'Не вдалося змінити стартову вагу' });
    }
});

// POST /api/weight/reset-goal - Скинути ціль і почати відлік заново від поточної ваги
router.post('/weight/reset-goal', isAuthenticated, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.user.id } });
        const todayUTC = toUTCDate(toLocalDateKey(new Date()));

        await prisma.weightLog.deleteMany({ where: { userId: req.user.id } });

        if (user?.weight) {
            await prisma.weightLog.create({
                data: {
                    userId: req.user.id,
                    weight: user.weight,
                    date: todayUTC,
                },
            });
        }

        const updatedUser = await prisma.user.update({
            where: { id: req.user.id },
            data: {
                targetWeight: null,
                goal: 'maintain',
            },
        });

        res.json({ user: updatedUser });
    } catch (error) {
        console.error('Помилка скидання цілі ваги:', error);
        res.status(500).json({ error: 'Не вдалося скинути ціль' });
    }
});

// DELETE /api/weight/:id - Видалити окремий запис зважування
router.delete('/weight/:id', isAuthenticated, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const existing = await prisma.weightLog.findUnique({ where: { id } });
        if (!existing || existing.userId !== req.user.id) {
            return res.status(403).json({ error: 'Відмовлено в доступі' });
        }

        await prisma.weightLog.delete({ where: { id } });

        const latestLog = await prisma.weightLog.findFirst({
            where: { userId: req.user.id },
            orderBy: { date: 'desc' },
        });

        if (latestLog) {
            await prisma.user.update({
                where: { id: req.user.id },
                data: { weight: latestLog.weight },
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Не вдалося видалити запис ваги' });
    }
});

module.exports = router;