// frontend/src/components/WeightProgressSection.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid,
    ReferenceLine,
} from 'recharts';
import { getTodayLocalStr, formatReadableDate } from '../constants/wellnessOptions';
import './WeightProgressSection.css';

const WEEKLY_LOSS_PRESETS = [
    { value: 0.25, label: '0.25 кг/тиж', desc: 'М’який' },
    { value: 0.5, label: '0.5 кг/тиж', desc: 'Оптимальний' },
    { value: 0.75, label: '0.75 кг/тиж', desc: 'Активний' },
    { value: 1.0, label: '1.0 кг/тиж', desc: 'Інтенсивний' },
];

const WEEKLY_GAIN_PRESETS = [
    { value: 0.2, label: '+0.2 кг/тиж', desc: 'Чистий набір' },
    { value: 0.3, label: '+0.3 кг/тиж', desc: 'Оптимальний' },
    { value: 0.5, label: '+0.5 кг/тиж', desc: 'Активний' },
    { value: 0.75, label: '+0.75 кг/тиж', desc: 'Інтенсивний' },
];

const FORECAST_SOURCE_LABELS = {
    chosen_pace: 'За обраним тижневим темпом',
    actual_trend: 'За вашим фактичним темпом зважувань',
    calorie_deficit: 'За балансом калорій (КБЖВ профілю)',
    safe_default: 'Орієнтовний безпечний темп',
};

const WeightProgressSection = ({
                                   user,
                                   theme = 'light',
                                   refreshTrigger,
                                   onWeightUpdated,
                                   onOpenProfile,
                               }) => {
    const lossStorageKey = user?.id ? `desiredWeeklyLoss_${user.id}` : 'desiredWeeklyLoss';
    const gainStorageKey = user?.id ? `desiredWeeklyGain_${user.id}` : 'desiredWeeklyGain';

    const [weightStats, setWeightStats] = useState(null);
    const [newWeight, setNewWeight] = useState(() => (user?.weight != null ? String(user.weight) : ''));
    const [logDate, setLogDate] = useState(() => getTodayLocalStr());
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');

    // Інлайн-встановлення нової цільової ваги (коли ціль не задана або скинута)
    const [inlineCurrentWeight, setInlineCurrentWeight] = useState(() =>
        user?.weight != null ? String(user.weight) : ''
    );
    const [inlineTargetWeight, setInlineTargetWeight] = useState('');
    const [savingTarget, setSavingTarget] = useState(false);

    // Редагування стартової ваги кліком по "Старт"
    const [isEditingStart, setIsEditingStart] = useState(false);
    const [startWeightInput, setStartWeightInput] = useState('');

    // Бажаний темп зміни ваги за тиждень (кг/тиж) окремо для схуднення та набору
    const [desiredWeeklyLoss, setDesiredWeeklyLoss] = useState(() => {
        const saved = localStorage.getItem(lossStorageKey);
        return saved ? Number(saved) : 0.5;
    });
    const [desiredWeeklyGain, setDesiredWeeklyGain] = useState(() => {
        const saved = localStorage.getItem(gainStorageKey);
        return saved ? Number(saved) : 0.3;
    });
    const [applyingCalorieGoal, setApplyingCalorieGoal] = useState(false);

    // Розгортання списку окремих записів зважувань
    const [showHistoryList, setShowHistoryList] = useState(false);

    const isDark = theme === 'dark';
    const chartPalette = {
        gridStroke: isDark ? '#3d3147' : '#f4c6d7',
        axisTick: isDark ? '#bfa6b4' : '#7c5667',
        tooltipBg: isDark ? '#141118' : '#ffffff',
        tooltipText: isDark ? '#f8eef3' : '#2b2328',
        tooltipBorder: isDark ? '#3d3147' : '#f4c6d7',
        berry: isDark ? '#f472b6' : '#c83768',
        olive: isDark ? '#8ab85c' : '#4a6b2c',
    };

    const getDefaultIsGain = () =>
        user?.targetWeight != null && user?.weight != null && Number(user.targetWeight) > Number(user.weight);

    const fetchWeightStats = async (overrideRate = null, isGainHint = null) => {
        try {
            const isGain = isGainHint !== null ? isGainHint : (weightStats?.isGainGoal ?? getDefaultIsGain());
            const rateToSend = overrideRate !== null ? overrideRate : (isGain ? desiredWeeklyGain : desiredWeeklyLoss);

            const res = await axios.get('/api/weight', {
                params: { weeklyRate: rateToSend || undefined },
            });

            if (overrideRate === null && isGainHint === null && res.data?.configured && res.data.isGainGoal !== isGain) {
                const correctedRate = res.data.isGainGoal ? desiredWeeklyGain : desiredWeeklyLoss;
                const correctedRes = await axios.get('/api/weight', {
                    params: { weeklyRate: correctedRate || undefined },
                });
                setWeightStats(correctedRes.data);
                if (correctedRes.data?.currentWeight != null) {
                    setNewWeight(String(correctedRes.data.currentWeight));
                    setInlineCurrentWeight(String(correctedRes.data.currentWeight));
                }
                return;
            }

            setWeightStats(res.data);
            if (res.data?.currentWeight != null) {
                setNewWeight(String(res.data.currentWeight));
                setInlineCurrentWeight(String(res.data.currentWeight));
            }
        } catch (err) {
            console.error('Помилка завантаження динаміки ваги:', err);
        }
    };

    useEffect(() => {
        if (user) {
            const savedLoss = localStorage.getItem(lossStorageKey);
            const savedGain = localStorage.getItem(gainStorageKey);
            const lossRate = savedLoss ? Number(savedLoss) : 0.5;
            const gainRate = savedGain ? Number(savedGain) : 0.3;
            setDesiredWeeklyLoss(lossRate);
            setDesiredWeeklyGain(gainRate);

            const isGain = getDefaultIsGain();
            fetchWeightStats(isGain ? gainRate : lossRate, isGain);
        }
    }, [user, refreshTrigger]);

    const handleQuickSetTarget = async (e) => {
        e.preventDefault();
        const parsedTarget = parseFloat(inlineTargetWeight);
        const existingCurrent = weightStats?.currentWeight ?? user?.weight;
        const parsedCurrent = existingCurrent != null ? Number(existingCurrent) : parseFloat(inlineCurrentWeight);

        if (!parsedTarget || parsedTarget < 25 || parsedTarget > 350) {
            alert('Вкажіть коректну цільову вагу (від 25 до 350 кг)');
            return;
        }
        if (!parsedCurrent || parsedCurrent < 25 || parsedCurrent > 350) {
            alert('Вкажіть вашу поточну вагу (від 25 до 350 кг)');
            return;
        }

        setSavingTarget(true);
        try {
            const isGain = parsedTarget > parsedCurrent;
            const isLoss = parsedTarget < parsedCurrent;
            const nextGoal = isLoss ? 'lose' : isGain ? 'gain' : 'maintain';

            if (existingCurrent == null) {
                await axios.post('/api/weight', {
                    weight: parsedCurrent,
                    date: getTodayLocalStr(),
                });
            }

            await axios.put('/api/profile', {
                ...user,
                weight: parsedCurrent,
                targetWeight: parsedTarget,
                goal: nextGoal,
            });

            setInlineTargetWeight('');
            await fetchWeightStats(isGain ? desiredWeeklyGain : desiredWeeklyLoss, isGain);
            if (onWeightUpdated) onWeightUpdated();
            setSavedMsg('✓ Цільову вагу встановлено');
            setTimeout(() => setSavedMsg(''), 2400);
        } catch (err) {
            alert(err.response?.data?.error || 'Не вдалося зберегти цільову вагу');
        } finally {
            setSavingTarget(false);
        }
    };

    const handleSelectWeeklyRate = (val) => {
        const num = Number(val);
        if (!num || num <= 0) return;

        if (weightStats?.isGainGoal) {
            setDesiredWeeklyGain(num);
            localStorage.setItem(gainStorageKey, String(num));
            fetchWeightStats(num, true);
        } else {
            setDesiredWeeklyLoss(num);
            localStorage.setItem(lossStorageKey, String(num));
            fetchWeightStats(num, false);
        }
    };

    const handleApplyRecommendedCalories = async () => {
        if (!weightStats?.recommendedCalories || !user) return;
        setApplyingCalorieGoal(true);
        try {
            const targetKcal = weightStats.recommendedCalories;
            const w = weightStats.currentWeight || user.weight || 60;
            const isGain = Boolean(weightStats.isGainGoal);

            const proteins = Math.round(w * (isGain ? 1.8 : 1.9));
            const fats = Math.round(w * (isGain ? 1.0 : 0.85));
            const carbs = Math.max(50, Math.round((targetKcal - (proteins * 4 + fats * 9)) / 4));

            await axios.put('/api/profile', {
                ...user,
                goal: isGain ? 'gain' : 'lose',
                calorieGoal: targetKcal,
                proteinGoal: proteins,
                fatGoal: fats,
                carbGoal: carbs,
            });
            if (onWeightUpdated) onWeightUpdated();
            setSavedMsg(`✓ Норму оновлено до ${targetKcal} ккал`);
            setTimeout(() => setSavedMsg(''), 2500);
        } catch {
            alert('Не вдалося оновити норму калорій');
        } finally {
            setApplyingCalorieGoal(false);
        }
    };

    const handleSaveWeight = async (e) => {
        e.preventDefault();
        if (!newWeight) return;
        setSaving(true);
        try {
            await axios.post('/api/weight', { weight: parseFloat(newWeight), date: logDate });
            await fetchWeightStats();
            if (onWeightUpdated) onWeightUpdated();
            setSavedMsg('✓ Вагу оновлено');
            setTimeout(() => setSavedMsg(''), 2200);
        } catch (err) {
            alert(err.response?.data?.error || 'Не вдалося зберегти вагу');
        } finally {
            setSaving(false);
        }
    };

    const openStartEditor = () => {
        setStartWeightInput(weightStats?.startWeight != null ? String(weightStats.startWeight) : '');
        setIsEditingStart(true);
    };

    const handleSaveStartWeight = async (e) => {
        e.preventDefault();
        const parsed = parseFloat(startWeightInput);
        if (!parsed || parsed < 25 || parsed > 350) return;
        try {
            await axios.put('/api/weight/start', { startWeight: parsed });
            setIsEditingStart(false);
            await fetchWeightStats();
            if (onWeightUpdated) onWeightUpdated();
            setSavedMsg('✓ Стартову вагу змінено');
            setTimeout(() => setSavedMsg(''), 2200);
        } catch (err) {
            alert(err.response?.data?.error || 'Не вдалося оновити стартову вагу');
        }
    };

    const handleDeleteLog = async (logId) => {
        try {
            await axios.delete(`/api/weight/${logId}`);
            await fetchWeightStats();
            if (onWeightUpdated) onWeightUpdated();
        } catch {
            alert('Не вдалося видалити запис зважування');
        }
    };

    const handleResetGoal = async () => {
        const confirmed = window.confirm(
            'Скинути поточну цільову вагу та очистити історію прогресу? Поточна вага залишиться без змін.'
        );
        if (!confirmed) return;

        try {
            await axios.post('/api/weight/reset-goal');
            setIsEditingStart(false);
            setInlineTargetWeight('');
            await fetchWeightStats();
            if (onWeightUpdated) onWeightUpdated();
            setSavedMsg('✓ Ціль скинуто');
            setTimeout(() => setSavedMsg(''), 2200);
        } catch {
            alert('Не вдалося скинути ціль');
        }
    };

    const rawLogs = weightStats?.logs || [];
    const chartData = rawLogs.map((item) => ({
        ...item,
        shortDate: `${item.date.slice(8, 10)}.${item.date.slice(5, 7)}`,
    }));

    const isGoalReached = weightStats?.configured && weightStats.progressPercent >= 100;
    const remainingAbs = weightStats?.remainingDelta !== undefined ? Math.abs(weightStats.remainingDelta) : null;
    const isGainMode = Boolean(weightStats?.isGainGoal);
    const activePresets = isGainMode ? WEEKLY_GAIN_PRESETS : WEEKLY_LOSS_PRESETS;
    const activeDesiredRate = isGainMode ? desiredWeeklyGain : desiredWeeklyLoss;

    // Попередній розрахунок різниці в інлайн-формі нової цілі
    const knownCurrentWeight = weightStats?.currentWeight ?? user?.weight ?? null;
    const previewCurrent = knownCurrentWeight != null ? Number(knownCurrentWeight) : parseFloat(inlineCurrentWeight);
    const previewTarget = parseFloat(inlineTargetWeight);
    const hasValidPreview =
        !Number.isNaN(previewCurrent) &&
        !Number.isNaN(previewTarget) &&
        previewCurrent >= 25 &&
        previewTarget >= 25 &&
        previewTarget <= 350;
    const previewDiff = hasValidPreview ? Number((previewTarget - previewCurrent).toFixed(1)) : null;

    return (
        <section className={`weight-progress-section ${theme}`}>
            {/* ШАПКА БЛОКУ ТА ФОРМА ШВИДКОГО ОНОВЛЕННЯ ВАГИ */}
            <div className="wps-header">
                <div className="wps-title-group">
                    <h3 className="wps-title">⚖️ Динаміка ваги та прогноз досягнення мети</h3>
                    {savedMsg && <span className="wps-saved-badge">{savedMsg}</span>}
                </div>

                <form onSubmit={handleSaveWeight} className="wps-log-form">
                    <input
                        type="date"
                        value={logDate || ''}
                        max={getTodayLocalStr()}
                        onChange={(e) => setLogDate(e.target.value)}
                        className="wps-input wps-date-input"
                    />
                    <input
                        type="number"
                        step="0.1"
                        min="25"
                        max="350"
                        placeholder="Вага (кг)"
                        value={newWeight ?? ''}
                        onChange={(e) => setNewWeight(e.target.value)}
                        required
                        className="wps-input wps-weight-input"
                    />
                    <button type="submit" disabled={saving} className="wps-btn-primary">
                        {saving ? '...' : '+ Оновити вагу'}
                    </button>
                </form>
            </div>

            {!weightStats?.configured ? (
                <div className="wps-setup-box">
                    <div className="wps-setup-header">
                        <span className="wps-setup-hint">
                            🎯 Встановіть нову цільову вагу, щоб увімкнути шкалу прогресу та прогноз дати:
                        </span>
                        <button type="button" onClick={onOpenProfile} className="wps-link-btn">
                            Відкрити повні налаштування профілю ↗
                        </button>
                    </div>

                    <form onSubmit={handleQuickSetTarget} className="wps-setup-form">
                        {knownCurrentWeight != null ? (
                            <span className="wps-current-pill">
                                Поточна вага: <strong>{knownCurrentWeight} кг</strong>
                            </span>
                        ) : (
                            <input
                                type="number"
                                step="0.1"
                                min="25"
                                max="350"
                                placeholder="Поточна (кг)"
                                value={inlineCurrentWeight ?? ''}
                                onChange={(e) => setInlineCurrentWeight(e.target.value)}
                                required
                                className="wps-input wps-inline-current"
                            />
                        )}

                        <span className="wps-arrow">→</span>

                        <input
                            type="number"
                            step="0.1"
                            min="25"
                            max="350"
                            placeholder="Цільова вага (кг)"
                            value={inlineTargetWeight ?? ''}
                            onChange={(e) => setInlineTargetWeight(e.target.value)}
                            required
                            className="wps-input wps-inline-target"
                        />

                        <button type="submit" disabled={savingTarget} className="wps-btn-primary">
                            {savingTarget ? 'Збереження...' : '🎯 Встановити ціль'}
                        </button>

                        {previewDiff !== null && (
                            <span
                                className={`wps-preview-diff ${
                                    previewDiff === 0
                                        ? 'neutral'
                                        : previewDiff < 0
                                            ? 'loss'
                                            : 'gain'
                                }`}
                            >
                                {previewDiff < 0
                                    ? `📉 Схуднення на ${Math.abs(previewDiff)} кг`
                                    : previewDiff > 0
                                        ? `📈 Набір +${previewDiff} кг`
                                        : '⚖️ Підтримка поточної ваги'}
                            </span>
                        )}
                    </form>
                </div>
            ) : (
                <>
                    {/* ПРОГРЕС-БАР ТА ІНЛАЙН-РЕДАГУВАННЯ СТАРТОВОЇ ВАГИ + СКИДАННЯ ЦІЛІ */}
                    <div className="wps-sub-card">
                        <div className="wps-progress-top">
                            <div className="wps-milestones">
                                {!isEditingStart ? (
                                    <button
                                        type="button"
                                        onClick={openStartEditor}
                                        title="Натисніть, щоб змінити стартову вагу"
                                        className="wps-start-btn"
                                    >
                                        Старт: <strong>{weightStats.startWeight} кг</strong> ✏️
                                    </button>
                                ) : (
                                    <form onSubmit={handleSaveStartWeight} className="wps-start-edit-form">
                                        <span className="wps-muted-xs">Старт:</span>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="25"
                                            max="350"
                                            value={startWeightInput ?? ''}
                                            onChange={(e) => setStartWeightInput(e.target.value)}
                                            autoFocus
                                            className="wps-input wps-start-input"
                                        />
                                        <button type="submit" className="wps-mini-btn wps-mini-btn--ok">
                                            ✓
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setIsEditingStart(false)}
                                            className="wps-mini-btn wps-mini-btn--cancel"
                                        >
                                            ✕
                                        </button>
                                    </form>
                                )}

                                <span className="wps-arrow">→</span>
                                <span>
                                    Зараз: <strong className="wps-current-val">{weightStats.currentWeight} кг</strong>
                                </span>
                                <span className="wps-arrow">→</span>
                                <span>
                                    Ціль: <strong className="wps-target-val">{weightStats.targetWeight} кг</strong>
                                </span>
                            </div>

                            <div className="wps-progress-right">
                                <strong className={`wps-percent-label ${isGoalReached ? 'reached' : ''}`}>
                                    {weightStats.progressPercent}% виконано
                                </strong>
                                <button
                                    type="button"
                                    onClick={handleResetGoal}
                                    className="wps-reset-btn"
                                    title="Скинути поточну цільову вагу"
                                >
                                    🔄 Скинути ціль
                                </button>
                            </div>
                        </div>

                        <div className="wps-progress-track">
                            <div
                                className={`wps-progress-fill ${isGoalReached ? 'reached' : ''}`}
                                style={{ width: `${weightStats.progressPercent}%` }}
                            />
                        </div>

                        {/* ВИБІР БАЖАНОГО ТЕМПУ СХУДНЕННЯ АБО НАБОРУ ВАГИ НА ТИЖДЕНЬ */}
                        {(weightStats.isLossGoal || weightStats.isGainGoal) && !isGoalReached && (
                            <div className="wps-pace-box">
                                <div className="wps-pace-top">
                                    <span className="wps-pace-question">
                                        {isGainMode
                                            ? '📈 Скільки кілограмів бажаєте набирати за тиждень?'
                                            : '📉 Скільки кілограмів бажаєте скидати за тиждень?'}
                                    </span>

                                    {weightStats.recommendedCalories && (
                                        <div className="wps-pace-kcal-row">
                                            <span className="wps-pace-kcal-hint">
                                                Для цього темпу потрібно ~
                                                <strong className="wps-berry-text">
                                                    {weightStats.recommendedCalories} ккал/день
                                                </strong>
                                            </span>
                                            {user?.calorieGoal !== weightStats.recommendedCalories && (
                                                <button
                                                    type="button"
                                                    disabled={applyingCalorieGoal}
                                                    onClick={handleApplyRecommendedCalories}
                                                    className="wps-apply-kcal-btn"
                                                >
                                                    {applyingCalorieGoal ? '...' : 'Застосувати норму'}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="wps-presets-row">
                                    {activePresets.map((preset) => {
                                        const isSelected = Math.abs(activeDesiredRate - preset.value) < 0.01;
                                        return (
                                            <button
                                                key={preset.value}
                                                type="button"
                                                onClick={() => handleSelectWeeklyRate(preset.value)}
                                                className={`wps-preset-btn ${isSelected ? 'active' : ''}`}
                                            >
                                                {preset.label}{' '}
                                                <span className="wps-preset-desc">({preset.desc})</span>
                                            </button>
                                        );
                                    })}

                                    <div className="wps-custom-rate">
                                        <input
                                            type="number"
                                            step="0.05"
                                            min="0.1"
                                            max="2.0"
                                            value={activeDesiredRate ?? ''}
                                            onChange={(e) => handleSelectWeeklyRate(e.target.value)}
                                            className="wps-input wps-rate-input"
                                        />
                                        <span className="wps-muted-xs">кг/тиж</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* КАРТКИ СТАТИСТИКИ ТА АВТОМАТИЧНОГО ПРОГНОЗУ ПЕРІОДУ */}
                        <div className="wps-stats-grid">
                            <div className="wps-stat-tile">
                                <div className="wps-stat-label">Зміна від старту</div>
                                <div
                                    className={`wps-stat-value ${
                                        weightStats.achievedDelta === 0 ? '' : 'wps-olive-text'
                                    }`}
                                >
                                    {weightStats.achievedDelta > 0
                                        ? `+${weightStats.achievedDelta}`
                                        : weightStats.achievedDelta}{' '}
                                    кг
                                </div>
                                <div className="wps-stat-sub">
                                    {isGoalReached ? 'Цільову вагу досягнуто! 🎉' : `Залишилося: ${remainingAbs} кг`}
                                </div>
                            </div>

                            <div className="wps-stat-tile">
                                <div className="wps-stat-label">Цільовий / фактичний темп</div>
                                <div className="wps-stat-value wps-purple-text">
                                    {weightStats.activeWeeklyRate
                                        ? `${weightStats.activeWeeklyRate > 0 ? '+' : ''}${weightStats.activeWeeklyRate} кг / тиж.`
                                        : '—'}
                                </div>
                                <div className="wps-stat-sub">
                                    {weightStats.actualWeeklyRate !== null
                                        ? `Фактично за замірами: ${weightStats.actualWeeklyRate > 0 ? '+' : ''}${weightStats.actualWeeklyRate} кг/тиж`
                                        : FORECAST_SOURCE_LABELS[weightStats.forecastSource]}
                                </div>
                            </div>

                            <div className="wps-stat-tile">
                                <div className="wps-stat-label">Прогноз досягнення мети</div>
                                <div className="wps-stat-value wps-berry-text">
                                    {isGoalReached
                                        ? 'Вже досягнуто'
                                        : weightStats.estimatedDate
                                            ? formatReadableDate(weightStats.estimatedDate)
                                            : '—'}
                                </div>
                                <div className="wps-stat-sub">
                                    {isGoalReached
                                        ? 'Підтримуйте поточний режим'
                                        : weightStats.estimatedDays !== null
                                            ? `Приблизно ${weightStats.estimatedDays} дн. (~${weightStats.estimatedWeeks} тиж.)`
                                            : 'Оновлюйте вагу для точнішого прогнозу'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ГРАФІК ЗМІНИ ВАГИ + КЕРУВАННЯ ЗАПИСАМИ ЗВАЖУВАНЬ */}
                    {chartData.length > 0 && (
                        <div className="wps-sub-card wps-sub-card--flush">
                            <div className="wps-chart-header">
                                <span className="wps-chart-title">
                                    📈 Графік зважувань ({chartData.length} запис.)
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowHistoryList((prev) => !prev)}
                                    className="wps-history-toggle-btn"
                                >
                                    {showHistoryList
                                        ? '▲ Сховати записи'
                                        : `📋 Переглянути / видалити записи (${rawLogs.length})`}
                                </button>
                            </div>

                            <div className="wps-chart-wrap">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 12, right: 16, left: -15, bottom: 0 }}>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            vertical={false}
                                            stroke={chartPalette.gridStroke}
                                        />
                                        <XAxis
                                            dataKey="shortDate"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: chartPalette.axisTick }}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: chartPalette.axisTick }}
                                            domain={[
                                                (dataMin) => Math.floor(Math.min(dataMin, weightStats.targetWeight) - 1.5),
                                                (dataMax) => Math.ceil(Math.max(dataMax, weightStats.targetWeight) + 1.5),
                                            ]}
                                        />
                                        <Tooltip
                                            formatter={(val) => [`${val} кг`, 'Вага']}
                                            labelFormatter={(label, payload) =>
                                                payload?.[0]?.payload?.date
                                                    ? formatReadableDate(payload[0].payload.date)
                                                    : label
                                            }
                                            contentStyle={{
                                                background: chartPalette.tooltipBg,
                                                color: chartPalette.tooltipText,
                                                borderRadius: '14px',
                                                border: `1px solid ${chartPalette.tooltipBorder}`,
                                                fontSize: '12px',
                                            }}
                                        />
                                        <ReferenceLine
                                            y={weightStats.targetWeight}
                                            stroke={chartPalette.olive}
                                            strokeDasharray="4 4"
                                            label={{
                                                value: `Ціль: ${weightStats.targetWeight} кг`,
                                                position: 'insideTopRight',
                                                fill: chartPalette.olive,
                                                fontSize: 11,
                                                fontWeight: 'bold',
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="weight"
                                            stroke={chartPalette.berry}
                                            strokeWidth={2.5}
                                            dot={{ r: 4, fill: chartPalette.berry }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* СПИСОК ОКРЕМИХ ЗАПИСІВ ЗВАЖУВАНЬ ІЗ ВИДАЛЕННЯМ */}
                            {showHistoryList && (
                                <div className="wps-history-list">
                                    {[...rawLogs].reverse().map((entry, idx, arr) => {
                                        const prevEntry = arr[idx + 1];
                                        const diff = prevEntry
                                            ? Number((entry.weight - prevEntry.weight).toFixed(1))
                                            : null;
                                        const isStartRecord = entry.id === rawLogs[0]?.id;
                                        const isPositiveTrend = isGainMode ? diff > 0 : diff < 0;

                                        return (
                                            <div key={entry.id} className="wps-history-row">
                                                <div className="wps-history-left">
                                                    <span className="wps-history-date">
                                                        {formatReadableDate(entry.date)}
                                                    </span>
                                                    <strong>{entry.weight} кг</strong>
                                                    {isStartRecord && (
                                                        <span className="wps-start-tag">Старт</span>
                                                    )}
                                                    {diff !== null && diff !== 0 && (
                                                        <span
                                                            className={`wps-diff-badge ${
                                                                isPositiveTrend ? 'positive' : 'neutral'
                                                            }`}
                                                        >
                                                            ({diff > 0 ? `+${diff}` : diff} кг)
                                                        </span>
                                                    )}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteLog(entry.id)}
                                                    className="wps-delete-log-btn"
                                                    title="Видалити запис зважування"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default WeightProgressSection;