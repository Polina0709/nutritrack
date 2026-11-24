// frontend/src/components/FoodWaterTab.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import SearchModal from './SearchModal';
import { getTodayLocalStr, shiftDateStr, formatReadableDate } from '../constants/wellnessOptions';
import './FoodWaterTab.css';

const CATEGORIES = [
    { id: 'BREAKFAST', label: '🍳 Сніданок' },
    { id: 'LUNCH', label: '🍲 Обід' },
    { id: 'DINNER', label: '🥗 Вечеря' },
    { id: 'SNACK', label: '🍎 Перекус' },
];

const FoodWaterTab = ({ user, theme, selectedDate, onDateChange, onDataChanged, refreshTrigger = 0 }) => {
    const [meals, setMeals] = useState([]);
    const [waterData, setWaterData] = useState({ totalWater: 0, logs: [] });
    const [dynamicGoal, setDynamicGoal] = useState(null);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [activeCategory, setActiveCategory] = useState(null);

    const fetchDayDiary = async () => {
        try {
            const [mealsRes, waterRes, dynamicRes] = await Promise.allSettled([
                axios.get('/api/meals/today', { params: { date: selectedDate } }),
                axios.get('/api/water', { params: { date: selectedDate } }),
                axios.get('/api/nutrition/dynamic-goal', { params: { date: selectedDate } }),
            ]);

            if (mealsRes.status === 'fulfilled') {
                setMeals(mealsRes.value.data || []);
            }
            if (waterRes.status === 'fulfilled') {
                setWaterData(waterRes.value.data || { totalWater: 0, logs: [] });
            }
            if (dynamicRes.status === 'fulfilled') {
                setDynamicGoal(dynamicRes.value.data);
            }
        } catch (err) {
            console.error('Помилка завантаження щоденника:', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchDayDiary();
        }
    }, [user, selectedDate, refreshTrigger]);

    const waterGoal = user?.waterGoal || 2000;
    const savedLocalGlass = user?.id ? Number(localStorage.getItem(`glassVolume_${user.id}`)) : 0;
    const glassVolume = user?.glassVolume || savedLocalGlass || 250;

    const goalGlassesCount = Math.ceil(waterGoal / glassVolume);
    const remainderMl = waterGoal % glassVolume;
    const extraWater = Math.max(0, waterData.totalWater - waterGoal);
    const extraGlassesCount = Math.ceil(extraWater / glassVolume);
    const totalDisplayGlasses = goalGlassesCount + extraGlassesCount;

    const filledGlassesCount =
        waterData.totalWater <= 0
            ? 0
            : Math.min(totalDisplayGlasses, Math.ceil(waterData.totalWater / glassVolume));

    const waterGlasses = Array(totalDisplayGlasses)
        .fill(false)
        .map((_, index) => index < filledGlassesCount);

    const getGlassAmount = (index) => {
        if (index === goalGlassesCount - 1 && remainderMl > 0) return remainderMl;
        return glassVolume;
    };

    const hasWaterLogs = Array.isArray(waterData.logs) && waterData.logs.length > 0;
    const lastWaterLog = hasWaterLogs ? waterData.logs[waterData.logs.length - 1] : null;

    const handleAddWater = async (amount) => {
        try {
            await axios.post('/api/water', { amount, date: selectedDate });
            await fetchDayDiary();
            if (onDataChanged) onDataChanged();
        } catch {
            alert('Помилка збереження води');
        }
    };

    const handleDeleteWater = async (id) => {
        try {
            await axios.delete(`/api/water/${id}`);
            await fetchDayDiary();
            if (onDataChanged) onDataChanged();
        } catch {
            alert('Помилка скасування води');
        }
    };

    const handleRemoveLastGlass = async () => {
        if (!lastWaterLog) return;
        await handleDeleteWater(lastWaterLog.id);
    };

    const handleToggleGlass = async (index) => {
        if (waterGlasses[index]) {
            await handleRemoveLastGlass();
        } else {
            await handleAddWater(getGlassAmount(index));
        }
    };

    const handleDeleteFoodItem = async (foodItemId) => {
        try {
            await axios.delete(`/api/meals/food-item/${foodItemId}`);
            await fetchDayDiary();
            if (onDataChanged) onDataChanged();
        } catch {
            alert('Помилка видалення продукту');
        }
    };

    const todayStr = getTodayLocalStr();
    const isToday = selectedDate === todayStr;

    const baseCalorieGoal = user?.calorieGoal || 2000;
    const effectiveCalorieGoal = dynamicGoal?.effectiveGoal ?? baseCalorieGoal;

    const totalDayCalories = meals.reduce((sum, m) => sum + (m.totalCalories || 0), 0);
    const totalDayProtein = Math.round(meals.reduce((sum, m) => sum + (m.totalProtein || 0), 0) * 10) / 10;
    const totalDayFat = Math.round(meals.reduce((sum, m) => sum + (m.totalFat || 0), 0) * 10) / 10;
    const totalDayCarbs = Math.round(meals.reduce((sum, m) => sum + (m.totalCarbs || 0), 0) * 10) / 10;

    const caloriesDiff = effectiveCalorieGoal - totalDayCalories;
    const calorieProgressPct = Math.min(100, Math.round((totalDayCalories / Math.max(1, effectiveCalorieGoal)) * 100));

    return (
        <div className={`food-water-tab ${theme}`}>
            {/* ПЕРЕМИКАЧ ДАТИ */}
            <div className="fw-date-bar">
                <div className="fw-date-controls">
                    <button
                        type="button"
                        onClick={() => onDateChange(shiftDateStr(selectedDate, -1))}
                        className="fw-date-nav-btn"
                        aria-label="Попередній день"
                    >
                        ◀
                    </button>

                    <input
                        type="date"
                        max={todayStr}
                        value={selectedDate}
                        onChange={(e) => e.target.value && onDateChange(e.target.value)}
                        className="fw-date-input"
                    />

                    <button
                        type="button"
                        disabled={isToday}
                        onClick={() => onDateChange(shiftDateStr(selectedDate, 1))}
                        className="fw-date-nav-btn"
                        aria-label="Наступний день"
                    >
                        ▶
                    </button>
                </div>

                <div className="fw-date-summary-group">
                    <span className="fw-date-summary">
                        📆 {formatReadableDate(selectedDate)} ({totalDayCalories} / {effectiveCalorieGoal} ккал)
                    </span>
                    {!isToday && (
                        <button
                            type="button"
                            onClick={() => onDateChange(todayStr)}
                            className="fw-today-btn"
                        >
                            На сьогодні
                        </button>
                    )}
                </div>
            </div>

            {/* ЗВЕДЕННЯ КБЖВ ЗА ДЕНЬ З АДАПТИВНОЮ НОРМОЮ КАЛОРІЙ */}
            <div className="fw-macros-grid">
                <div className="fw-macro-card">
                    <div className="fw-macro-value fw-accent-berry">{totalDayCalories} ккал</div>
                    <div className="fw-macro-target">
                        Ціль: <strong>{effectiveCalorieGoal}</strong>{' '}
                        <span className={caloriesDiff >= 0 ? 'fw-diff-ok' : 'fw-diff-over'}>
                            ({caloriesDiff >= 0 ? `залиш. ${caloriesDiff}` : `+${Math.abs(caloriesDiff)}`})
                        </span>
                    </div>

                    <div className="fw-progress-track">
                        <div
                            className={`fw-progress-fill ${caloriesDiff < 0 ? 'fw-progress-fill--over' : ''}`}
                            style={{ width: `${calorieProgressPct}%` }}
                        />
                    </div>

                    {dynamicGoal?.hasAdjustment && (
                        <div className="fw-dynamic-note">
                            База {dynamicGoal.baseGoal}
                            {dynamicGoal.activityBonus > 0 ? ` + ${dynamicGoal.activityBonus} спорт` : ''}
                            {dynamicGoal.lutealBonus > 0 ? ` + ${dynamicGoal.lutealBonus} фаза` : ''}
                        </div>
                    )}
                </div>

                <div className="fw-macro-card fw-macro-card--centered">
                    <div className="fw-macro-value fw-accent-olive">Б: {totalDayProtein} г</div>
                    <div className="fw-macro-target">Ціль: {user?.proteinGoal || 150} г</div>
                </div>

                <div className="fw-macro-card fw-macro-card--centered">
                    <div className="fw-macro-value fw-accent-amber">Ж: {totalDayFat} г</div>
                    <div className="fw-macro-target">Ціль: {user?.fatGoal || 70} г</div>
                </div>

                <div className="fw-macro-card fw-macro-card--centered">
                    <div className="fw-macro-value fw-accent-plum">В: {totalDayCarbs} г</div>
                    <div className="fw-macro-target">Ціль: {user?.carbGoal || 200} г</div>
                </div>
            </div>

            {/* ТРЕКЕР ВОДИ */}
            <section className="fw-water-card">
                <div className="fw-water-header">
                    <h3 className="fw-water-title">💧 Водний баланс ({formatReadableDate(selectedDate)})</h3>
                    <span className="fw-water-counter">
                        {waterData.totalWater} / {waterGoal} мл ({Math.min(filledGlassesCount, goalGlassesCount)}/{goalGlassesCount} скл.
                        {extraGlassesCount > 0 ? ` + ${extraGlassesCount} поза нормою` : ''})
                    </span>
                </div>

                <p className="fw-water-hint">
                    Натисніть на склянку ({glassVolume} мл{remainderMl > 0 ? `, остання за нормою — ${remainderMl} мл` : ''}), щоб позначити випиту воду або скасувати.
                </p>

                <div className="fw-glasses-grid">
                    {waterGlasses.map((isFull, idx) => {
                        const currentGlassMl = getGlassAmount(idx);
                        const isRemainderGlass = idx === goalGlassesCount - 1 && remainderMl > 0;
                        const isExtraGlass = idx >= goalGlassesCount;

                        const glassClasses = [
                            'fw-glass',
                            isFull ? 'fw-glass--full' : '',
                            isRemainderGlass ? 'fw-glass--remainder' : '',
                            isExtraGlass ? 'fw-glass--extra' : '',
                        ]
                            .filter(Boolean)
                            .join(' ');

                        return (
                            <div
                                key={idx}
                                onClick={() => handleToggleGlass(idx)}
                                className={glassClasses}
                                title={`Склянка ${idx + 1} (${currentGlassMl} мл)`}
                            >
                                {isFull && <span className="fw-glass-badge">✕</span>}
                            </div>
                        );
                    })}
                </div>

                <div className="fw-water-actions">
                    <button
                        type="button"
                        onClick={() => handleAddWater(glassVolume)}
                        className="fw-water-add-btn"
                    >
                        + Додати склянку ({glassVolume} мл)
                    </button>

                    <button
                        type="button"
                        disabled={!hasWaterLogs}
                        onClick={handleRemoveLastGlass}
                        className="fw-water-undo-btn"
                    >
                        ✕ Скасувати останню{lastWaterLog ? ` (${lastWaterLog.amount} мл)` : ''}
                    </button>
                </div>
            </section>

            {/* ПРИЙОМИ ЇЖІ */}
            <h3 className="fw-section-heading">🍽️ Щоденник харчування ({formatReadableDate(selectedDate)})</h3>
            {CATEGORIES.map((category) => {
                const mealData = meals.find((m) => m.type === category.id);
                return (
                    <section key={category.id} className="fw-meal-card">
                        <div className="fw-meal-header">
                            <h4 className="fw-meal-title">{category.label}</h4>
                            <span className="fw-meal-kcal">{mealData ? mealData.totalCalories : 0} ккал</span>
                        </div>

                        {mealData && mealData.foodItems.length > 0 ? (
                            <ul className="fw-food-list">
                                {mealData.foodItems.map((item) => (
                                    <li key={item.id} className="fw-food-item">
                                        <span className="fw-food-info">
                                            {item.name} ({item.weight}г) —{' '}
                                            <small className="fw-food-kcal">{item.calories} ккал</small>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteFoodItem(item.id)}
                                            className="fw-food-delete-btn"
                                            title="Видалити продукт"
                                        >
                                            🗑️
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="fw-meal-empty">Нічого не додано</p>
                        )}

                        <button
                            type="button"
                            onClick={() => {
                                setActiveCategory(category);
                                setIsSearchOpen(true);
                            }}
                            className="fw-add-food-btn"
                        >
                            + Додати продукт
                        </button>
                    </section>
                );
            })}

            {activeCategory && (
                <SearchModal
                    isOpen={isSearchOpen}
                    onClose={() => setIsSearchOpen(false)}
                    mealType={activeCategory.id}
                    mealLabel={activeCategory.label}
                    selectedDate={selectedDate}
                    theme={theme}
                    onAddSuccess={() => {
                        setIsSearchOpen(false);
                        setActiveCategory(null);
                        fetchDayDiary();
                        if (onDataChanged) onDataChanged();
                    }}
                />
            )}
        </div>
    );
};

export default FoodWaterTab;