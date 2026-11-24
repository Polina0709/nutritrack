// frontend/src/components/HomeOverviewTab.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    ReferenceLine,
} from 'recharts';
import { MOOD_OPTIONS, SYMPTOM_OPTIONS, getTodayLocalStr, formatReadableDate } from '../constants/wellnessOptions';
import WeightProgressSection from './WeightProgressSection';
import WellnessTrendsSection from './WellnessTrendsSection';
import './HomeOverviewTab.css';

const PERIOD_CHART_TITLES = {
    day: 'Калорії за прийомами їжі (сьогодні)',
    week: 'Калорії за останні 7 днів',
    month: 'Калорії за останні 30 днів',
    year: 'Калорії по місяцях року',
};

const PERIOD_WATER_CHART_TITLES = {
    day: 'Випита вода за часом доби (сьогодні)',
    week: 'Випита вода за останні 7 днів',
    month: 'Випита вода за останні 30 днів',
    year: 'Випита вода по місяцях року',
};

const HomeOverviewTab = ({ user, theme, onOpenProfile, onNavigateTab, refreshTrigger, onDataChanged }) => {
    const todayStr = getTodayLocalStr();
    const [period, setPeriod] = useState('week');
    const [analytics, setAnalytics] = useState(null);
    const [cycleOverview, setCycleOverview] = useState(null);
    const [dynamicGoal, setDynamicGoal] = useState(null);
    const [savingQuick, setSavingQuick] = useState(false);
    const [quickSavedBanner, setQuickSavedBanner] = useState(false);

    const isDark = theme === 'dark';
    const chartColors = {
        text: isDark ? '#f8eef3' : '#2b2328',
        subText: isDark ? '#bfa6b4' : '#7c5667',
        gridStroke: isDark ? '#3d3147' : '#f1d3df',
        tooltipBg: isDark ? '#1f1a24' : '#fff0f5',
        tooltipBorder: isDark ? '#3d3147' : '#f4c6d7',
    };

    const fetchDashboardData = async () => {
        try {
            const [analyticsRes, cycleRes, dynamicRes] = await Promise.allSettled([
                axios.get('/api/analytics', { params: { period, date: todayStr } }),
                axios.get('/api/cycle/overview', { params: { date: todayStr } }),
                axios.get('/api/nutrition/dynamic-goal', { params: { date: todayStr } }),
            ]);

            if (analyticsRes.status === 'fulfilled') {
                setAnalytics(analyticsRes.value.data);
            }
            if (cycleRes.status === 'fulfilled') {
                setCycleOverview(cycleRes.value.data);
            }
            if (dynamicRes.status === 'fulfilled') {
                setDynamicGoal(dynamicRes.value.data);
            }
        } catch (err) {
            console.error('Помилка завантаження головної панелі:', err);
        }
    };

    useEffect(() => {
        if (user) {
            fetchDashboardData();
        }
    }, [user, period, refreshTrigger]);

    const wellnessToday = cycleOverview?.wellnessToday || { mood: null, symptoms: [] };

    const handleQuickMoodSelect = async (moodId) => {
        const nextMood = wellnessToday.mood === moodId ? null : moodId;
        setSavingQuick(true);
        try {
            await axios.put('/api/wellness', { date: todayStr, mood: nextMood });
            const cycleRes = await axios.get('/api/cycle/overview', { params: { date: todayStr } });
            setCycleOverview(cycleRes.data);
            setQuickSavedBanner(true);
            setTimeout(() => setQuickSavedBanner(false), 1800);
        } catch (err) {
            console.error('Помилка збереження настрою:', err);
        } finally {
            setSavingQuick(false);
        }
    };

    const handleQuickSymptomToggle = async (symptomId) => {
        const currentSymptoms = Array.isArray(wellnessToday.symptoms) ? wellnessToday.symptoms : [];
        const nextSymptoms = currentSymptoms.includes(symptomId)
            ? currentSymptoms.filter((s) => s !== symptomId)
            : [...currentSymptoms, symptomId];

        setSavingQuick(true);
        try {
            await axios.put('/api/wellness', { date: todayStr, symptoms: nextSymptoms });
            const cycleRes = await axios.get('/api/cycle/overview', { params: { date: todayStr } });
            setCycleOverview(cycleRes.data);
            setQuickSavedBanner(true);
            setTimeout(() => setQuickSavedBanner(false), 1800);
        } catch (err) {
            console.error('Помилка збереження симптомів:', err);
        } finally {
            setSavingQuick(false);
        }
    };

    const baseCalorieGoal = user?.calorieGoal || 2000;
    const effectiveCalorieGoal = dynamicGoal?.effectiveGoal ?? baseCalorieGoal;
    const displayedCalorieGoal = period === 'day' ? effectiveCalorieGoal : baseCalorieGoal;

    const waterGoal = user?.waterGoal || 2000;
    const savedLocalGlass = user?.id ? Number(localStorage.getItem(`glassVolume_${user.id}`)) : 0;
    const glassVolume = user?.glassVolume || savedLocalGlass || 250;

    const currentMacros = analytics?.totals || { calories: 0, proteins: 0, fats: 0, carbs: 0, water: 0 };
    const showDailyGoalLine = period === 'week' || period === 'month';

    const macroData = [
        { name: 'Білки', value: (currentMacros.proteins || 0) * 4, color: '#4a6b2c' },
        { name: 'Жири', value: (currentMacros.fats || 0) * 9, color: '#f59e0b' },
        { name: 'Вуглеводи', value: (currentMacros.carbs || 0) * 4, color: '#c83768' },
    ];

    const barChartData = analytics?.chartData || [];
    const waterBarChartData = analytics?.waterChartData || [];
    const phase = cycleOverview?.phase;
    const cycleStats = cycleOverview?.cycleStats;

    const displayCycleLength = cycleStats?.avgCycleLength ?? user?.cycleLength ?? 28;
    const displayPeriodLength = cycleStats?.avgPeriodLength ?? user?.periodLength ?? 5;
    const isAutoCalculated = Boolean(cycleStats?.isCycleAuto || cycleStats?.isPeriodAuto);

    return (
        <div className={`home-overview-layout ${theme}`}>
            {/* ЛІВИЙ САЙДБАР: ОСОБИСТА ІНФОРМАЦІЯ ТА ЦІЛІ (ЛИШЕ ПЕРЕГЛЯД) */}
            <aside className="home-sidebar-card">
                <div className="home-profile-header">
                    <img
                        src={user?.avatarUrl || 'https://via.placeholder.com/56'}
                        alt="Аватар"
                        className="home-profile-avatar"
                        style={{ borderColor: phase?.badgeColor || '#c83768' }}
                    />
                    <div className="home-profile-meta">
                        <div className="home-profile-name">{user?.name || 'Користувачка'}</div>
                        <div className="home-profile-email">{user?.email}</div>
                    </div>
                </div>

                {/* Статус циклу в сайдбарі */}
                <div className="home-cycle-box">
                    <div className="home-cycle-day">
                        🌸 {cycleOverview?.configured ? `День циклу: ${cycleOverview.cycleDay}` : 'Цикл не налаштовано'}
                    </div>
                    <div className="home-cycle-phase">{phase?.name || 'Завантаження...'}</div>
                    {cycleOverview?.predictions?.daysUntilNextPeriod !== undefined && (
                        <div className="home-cycle-prediction">
                            До наступної менструації: ~{Math.max(0, cycleOverview.predictions.daysUntilNextPeriod)} дн.
                        </div>
                    )}
                </div>

                <h4 className="home-sidebar-heading">🎯 Мої параметри та цілі</h4>

                <div className="home-params-list">
                    <div className="home-param-row">
                        <span className="home-param-label">Поточна вага:</span>
                        <strong>{user?.weight ? `${user.weight} кг` : '—'}</strong>
                    </div>
                    <div className="home-param-row">
                        <span className="home-param-label">Цільова вага:</span>
                        <strong>{user?.targetWeight ? `${user.targetWeight} кг` : '—'}</strong>
                    </div>
                    <div className="home-param-row">
                        <span className="home-param-label">Вік / Зріст:</span>
                        <strong>
                            {user?.age ? `${user.age} р.` : '—'} / {user?.height ? `${user.height} см` : '—'}
                        </strong>
                    </div>
                    <div className="home-param-row home-param-row--stacked">
                        <div className="home-param-row-top">
                            <span className="home-param-label">
                                {dynamicGoal?.hasAdjustment ? 'Норма ккал сьогодні:' : 'Денна норма ккал:'}
                            </span>
                            <strong className="home-accent-berry">{effectiveCalorieGoal} ккал</strong>
                        </div>
                        {dynamicGoal?.hasAdjustment && (
                            <div className="home-dynamic-note">
                                База {dynamicGoal.baseGoal}
                                {dynamicGoal.activityBonus > 0 ? ` + ${dynamicGoal.activityBonus} спорт` : ''}
                                {dynamicGoal.lutealBonus > 0 ? ` + ${dynamicGoal.lutealBonus} фаза` : ''}
                            </div>
                        )}
                    </div>
                    <div className="home-param-row">
                        <span className="home-param-label">Білки / Жири / Вугл.:</span>
                        <strong>
                            {user?.proteinGoal || 150} / {user?.fatGoal || 70} / {user?.carbGoal || 200} г
                        </strong>
                    </div>
                    <div className="home-param-row">
                        <span className="home-param-label">Норма води (склянка):</span>
                        <strong className="home-accent-water">
                            {waterGoal} мл ({glassVolume} мл)
                        </strong>
                    </div>
                    <div className="home-param-row home-param-row--last">
                        <span className="home-param-label">
                            Цикл / менструація{isAutoCalculated ? ' (сер.)' : ''}:
                        </span>
                        <strong>
                            {displayCycleLength} / {displayPeriodLength} дн.
                        </strong>
                    </div>
                </div>

                <button type="button" onClick={onOpenProfile} className="home-sidebar-edit-btn">
                    ⚙️ Змінити параметри в профілі
                </button>
            </aside>

            {/* ЦЕНТРАЛЬНА ЗОНА: ПІДКАЗКИ ФАЗИ + ЧЕК-ІН + ВАГА + СТАТИСТИКА + ТРЕНДИ */}
            <div className="home-main-column">
                {/* 1. КАРТКА ПЕРСОНАЛЬНИХ РЕКОМЕНДАЦІЙ ЗА ФАЗОЮ ЦИКЛУ */}
                <section className="home-card">
                    <div className="home-card-header">
                        <div className="home-phase-badges">
                            <span
                                className="home-phase-pill"
                                style={{ backgroundColor: phase?.badgeColor || '#c83768' }}
                            >
                                {phase?.name || 'Аналіз циклу'}
                            </span>
                            {cycleOverview?.configured && (
                                <span className="home-cycle-subtitle">
                                    День {cycleOverview.cycleDay} із {displayCycleLength}
                                    {cycleStats?.isCycleAuto ? ` (автосер. за ${cycleStats.cyclesSampleCount} цикл.)` : ''}
                                </span>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => onNavigateTab('cycle')}
                            className="home-link-btn"
                        >
                            Відкрити календар циклу →
                        </button>
                    </div>

                    <p className="home-phase-summary">{phase?.summary}</p>

                    {/* ПОПЕРЕДЖЕННЯ ПРО ВІДХИЛЕННЯ ТРИВАЛОСТІ ЦИКЛУ АБО МЕНСТРУАЦІЇ */}
                    {Array.isArray(cycleStats?.deviations) && cycleStats.deviations.length > 0 && (
                        <div className="home-deviations-list">
                            {cycleStats.deviations.map((dev, idx) => (
                                <div key={`${dev.type}_${idx}`} className="home-deviation-alert">
                                    <div className="home-deviation-title">⚠️ {dev.title}</div>
                                    <div>{dev.message}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="home-tips-grid">
                        <div className="home-tip-tile">
                            <div className="home-tip-title home-tip-title--olive">🥗 Харчування сьогодні</div>
                            <div className="home-tip-text">{phase?.nutrition}</div>
                        </div>

                        <div className="home-tip-tile">
                            <div className="home-tip-title home-tip-title--water">💧 Водний баланс</div>
                            <div className="home-tip-text">{phase?.hydration}</div>
                        </div>

                        <div className="home-tip-tile">
                            <div className="home-tip-title home-tip-title--amber">🏃‍♀️ Активність</div>
                            <div className="home-tip-text">{phase?.activity}</div>
                        </div>

                        <div className="home-tip-tile">
                            <div className="home-tip-title home-tip-title--berry">💊 Вітаміни та підтримка</div>
                            <div className="home-tip-text">{phase?.supplements}</div>
                        </div>
                    </div>

                    {Array.isArray(cycleOverview?.symptomAdvice) && cycleOverview.symptomAdvice.length > 0 && (
                        <div className="home-symptom-advice-box">
                            <strong className="home-symptom-advice-title">
                                💡 Персональні підказки за відміченими симптомами:
                            </strong>
                            <ul className="home-symptom-advice-list">
                                {cycleOverview.symptomAdvice.map((tip, idx) => (
                                    <li key={idx}>{tip}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>

                {/* 2. ЗГОРНУТИЙ БЛОК ВІДМІТКИ НАСТРОЮ ТА СИМПТОМІВ */}
                <section className="home-card home-card--compact">
                    <div className="home-card-header home-card-header--sm">
                        <div className="home-checkin-title-group">
                            <h3 className="home-section-title">🩺 Швидкий чек-ін ({formatReadableDate(todayStr)})</h3>
                            {savingQuick && <span className="home-status-saving">Збереження...</span>}
                            {quickSavedBanner && <span className="home-status-saved">✓ Збережено</span>}
                        </div>

                        <button
                            type="button"
                            onClick={() => onNavigateTab('cycle')}
                            className="home-secondary-btn"
                        >
                            Розгорнути повний чек-ін ↗
                        </button>
                    </div>

                    {/* Настрій в один рядок */}
                    <div className="home-chip-row home-chip-row--mb">
                        <span className="home-chip-label">Настрій:</span>
                        {MOOD_OPTIONS.map((m) => {
                            const active = wellnessToday.mood === m.id;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => handleQuickMoodSelect(m.id)}
                                    title={m.label}
                                    className={`home-mood-chip ${active ? 'active' : ''}`}
                                >
                                    <span>{m.emoji}</span>
                                    <span className="home-chip-text">{m.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Основні симптоми компактними чіпами */}
                    <div className="home-chip-row">
                        <span className="home-chip-label">Симптоми:</span>
                        {SYMPTOM_OPTIONS.filter((s) => s.quick).map((sym) => {
                            const active = (wellnessToday.symptoms || []).includes(sym.id);
                            return (
                                <button
                                    key={sym.id}
                                    type="button"
                                    onClick={() => handleQuickSymptomToggle(sym.id)}
                                    className={`home-symptom-chip ${active ? 'active' : ''}`}
                                >
                                    {sym.emoji} {sym.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <WeightProgressSection
                    user={user}
                    theme={theme}
                    refreshTrigger={refreshTrigger}
                    onWeightUpdated={onDataChanged}
                    onOpenProfile={onOpenProfile}
                />

                {/* 3. СТАТИСТИКА ТА ГРАФІКИ */}
                <section className="home-card">
                    <div className="home-card-header home-card-header--md">
                        <div>
                            <h3 className="home-section-title home-section-title--lg">📊 Статистика харчування та води</h3>
                            {period === 'day' && dynamicGoal?.hasAdjustment && (
                                <div className="home-dynamic-banner">
                                    🔥 Адаптована норма на сьогодні: {effectiveCalorieGoal} ккал (база {dynamicGoal.baseGoal}
                                    {dynamicGoal.activityBonus > 0 ? ` + ${dynamicGoal.activityBonus} спорт` : ''}
                                    {dynamicGoal.lutealBonus > 0 ? ` + ${dynamicGoal.lutealBonus} лютеїнова фаза` : ''})
                                </div>
                            )}
                        </div>

                        <div className="home-period-pills">
                            {['day', 'week', 'month', 'year'].map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPeriod(p)}
                                    className={`home-period-btn ${period === p ? 'active' : ''}`}
                                >
                                    {p === 'day' ? 'День' : p === 'week' ? 'Тиждень' : p === 'month' ? 'Місяць' : 'Рік'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {analytics && (
                        <>
                            <div className="home-kpi-grid">
                                <div className="home-kpi-tile">
                                    <div className="home-kpi-value home-accent-berry">
                                        {period === 'day' ? analytics.totals.calories : analytics.averages.calories} / {displayedCalorieGoal}
                                    </div>
                                    <div className="home-kpi-label">
                                        {period === 'day'
                                            ? dynamicGoal?.hasAdjustment
                                                ? 'Ккал (адапт. норма)'
                                                : 'Ккал (сьогодні)'
                                            : 'Ккал/день (сер)'}
                                    </div>
                                </div>

                                <div className="home-kpi-tile">
                                    <div className="home-kpi-value home-accent-olive">
                                        {period === 'day' ? analytics.totals.proteins : analytics.averages.proteins} / {user?.proteinGoal || 150}г
                                    </div>
                                    <div className="home-kpi-label">Білки</div>
                                </div>

                                <div className="home-kpi-tile">
                                    <div className="home-kpi-value home-accent-amber">
                                        {period === 'day' ? analytics.totals.fats : analytics.averages.fats} / {user?.fatGoal || 70}г
                                    </div>
                                    <div className="home-kpi-label">Жири</div>
                                </div>

                                <div className="home-kpi-tile">
                                    <div className="home-kpi-value home-accent-plum">
                                        {period === 'day' ? analytics.totals.carbs : analytics.averages.carbs} / {user?.carbGoal || 200}г
                                    </div>
                                    <div className="home-kpi-label">Вуглеводи</div>
                                </div>

                                <div className="home-kpi-tile">
                                    <div className="home-kpi-value home-accent-water">
                                        {period === 'day' ? (analytics.totals?.water ?? 0) : (analytics.averages?.water ?? 0)} / {waterGoal} мл
                                    </div>
                                    <div className="home-kpi-label">💧 Вода</div>
                                </div>
                            </div>

                            <div className="home-charts-grid">
                                <div className="home-chart-box home-chart-box--center">
                                    <h4 className="home-chart-title">Баланс БЖВ (Ккал)</h4>
                                    <div className="home-chart-canvas home-chart-canvas--donut">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={macroData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={4} dataKey="value" stroke="none">
                                                    {macroData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    formatter={(val) => `${Math.round(val)} ккал`}
                                                    contentStyle={{
                                                        background: chartColors.tooltipBg,
                                                        color: chartColors.text,
                                                        borderRadius: '10px',
                                                        border: `1px solid ${chartColors.tooltipBorder}`,
                                                        fontSize: '12px',
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="home-donut-center">
                                            <div className="home-donut-kcal">{currentMacros.calories || 0}</div>
                                            <div className="home-donut-unit">ккал</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="home-chart-box">
                                    <h4 className="home-chart-title home-chart-title--center">
                                        {PERIOD_CHART_TITLES[period]}
                                    </h4>
                                    <div className="home-chart-canvas">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={barChartData} margin={{ top: 14, right: 5, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.gridStroke} />
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chartColors.subText }} />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 11, fill: chartColors.subText }}
                                                    domain={[0, (dataMax) => Math.max(dataMax || 0, showDailyGoalLine ? baseCalorieGoal : 0)]}
                                                />
                                                <Tooltip
                                                    formatter={(val) => [`${val} ккал`, 'Калорійність']}
                                                    contentStyle={{
                                                        background: chartColors.tooltipBg,
                                                        color: chartColors.text,
                                                        borderRadius: '10px',
                                                        border: `1px solid ${chartColors.tooltipBorder}`,
                                                        fontSize: '12px',
                                                    }}
                                                />
                                                {showDailyGoalLine && (
                                                    <ReferenceLine
                                                        y={baseCalorieGoal}
                                                        stroke="#4a6b2c"
                                                        strokeDasharray="4 4"
                                                        label={{ value: `База: ${baseCalorieGoal}`, position: 'insideTopRight', fill: '#4a6b2c', fontSize: 10, fontWeight: 'bold' }}
                                                    />
                                                )}
                                                <Bar dataKey="kcal" fill="#c83768" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="home-chart-box">
                                    <h4 className="home-chart-title home-chart-title--center">
                                        {PERIOD_WATER_CHART_TITLES[period]}
                                    </h4>
                                    <div className="home-chart-canvas">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={waterBarChartData} margin={{ top: 14, right: 5, left: -15, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.gridStroke} />
                                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: chartColors.subText }} />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 11, fill: chartColors.subText }}
                                                    domain={[0, (dataMax) => Math.max(dataMax || 0, showDailyGoalLine ? waterGoal : 0)]}
                                                />
                                                <Tooltip
                                                    formatter={(val) => [`${val} мл`, 'Випито води']}
                                                    contentStyle={{
                                                        background: chartColors.tooltipBg,
                                                        color: chartColors.text,
                                                        borderRadius: '10px',
                                                        border: `1px solid ${chartColors.tooltipBorder}`,
                                                        fontSize: '12px',
                                                    }}
                                                />
                                                {showDailyGoalLine && (
                                                    <ReferenceLine
                                                        y={waterGoal}
                                                        stroke="#0284c7"
                                                        strokeDasharray="4 4"
                                                        label={{ value: `Норма: ${waterGoal}`, position: 'insideTopRight', fill: '#0284c7', fontSize: 10, fontWeight: 'bold' }}
                                                    />
                                                )}
                                                <Bar dataKey="water" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {/* 4. ДОВГОСТРОКОВІ ТРЕНДИ ТА АНАЛІТИКА ПО ФАЗАХ ЦИКЛУ */}
                <WellnessTrendsSection theme={theme} refreshTrigger={refreshTrigger} />
            </div>
        </div>
    );
};

export default HomeOverviewTab;