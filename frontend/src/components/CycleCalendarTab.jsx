// frontend/src/components/CycleCalendarTab.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    MOOD_OPTIONS,
    SYMPTOM_OPTIONS,
    ACTIVITY_OPTIONS,
    FLOW_OPTIONS,
    MED_CATEGORIES,
    getTodayLocalStr,
    formatReadableDate,
} from '../constants/wellnessOptions';
import DaySummaryModal from './DaySummaryModal';
import './CycleCalendarTab.css';

const MONTH_NAMES_UA = [
    'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
    'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];

const WEEKDAYS_UA = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

function buildMonthGrid(year, month) {
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    const cells = [];
    for (let i = 0; i < startWeekday; i++) {
        cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, dateKey: key });
    }
    return cells;
}

function getCurrentHHMM() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

const CycleCalendarTab = ({ theme, selectedDate, onDateChange, onCycleDataChanged }) => {
    const [viewYear, setViewYear] = useState(() => Number(selectedDate.split('-')[0]));
    const [viewMonth, setViewMonth] = useState(() => Number(selectedDate.split('-')[1]));

    const [calendarData, setCalendarData] = useState(null);
    const [cycleOverview, setCycleOverview] = useState(null);
    const [medications, setMedications] = useState([]);

    // Вспливаюче вікно сводки та рекомендацій за обраний день
    const [summaryModalDate, setSummaryModalDate] = useState(null);

    // Режим швидкого редагування днів менструації кліком по календарю
    const [isEditDaysMode, setIsEditDaysMode] = useState(false);
    const [togglingDay, setTogglingDay] = useState(false);

    // Редагування конкретного запису в історії менструацій
    const [editingPeriodId, setEditingPeriodId] = useState(null);
    const [editPeriodForm, setEditPeriodForm] = useState({
        startDate: '',
        endDate: '',
        flowIntensity: 'MEDIUM',
    });

    // Розгорнута форма самопочуття, симптомів та активності
    const [wellnessForm, setWellnessForm] = useState({
        mood: null,
        energyLevel: 3,
        symptoms: [],
        activityType: '',
        activityMinutes: '',
        notes: '',
    });
    const [savingWellness, setSavingWellness] = useState(false);
    const [wellnessSavedMsg, setWellnessSavedMsg] = useState('');

    // Форма додавання нового циклу (одразу на кілька днів)
    const [showPeriodForm, setShowPeriodForm] = useState(false);
    const [periodForm, setPeriodForm] = useState({
        startDate: selectedDate,
        endDate: '',
        flowIntensity: 'MEDIUM',
        notes: '',
    });

    // Форма додавання препарату
    const [showMedForm, setShowMedForm] = useState(false);
    const [medForm, setMedForm] = useState({
        name: '',
        category: 'COC',
        dosage: '1 табл.',
        cocScheme: '21/7',
        packStart: selectedDate,
        reminderTime: '09:00',
    });

    const fetchAllCycleData = async () => {
        try {
            const [calRes, overRes, wellRes, medsRes] = await Promise.all([
                axios.get('/api/cycle/calendar', { params: { year: viewYear, month: viewMonth } }),
                axios.get('/api/cycle/overview', { params: { date: selectedDate } }),
                axios.get('/api/wellness', { params: { date: selectedDate } }),
                axios.get('/api/medications', { params: { date: selectedDate } }),
            ]);

            setCalendarData(calRes.data);
            setCycleOverview(overRes.data);
            setMedications(medsRes.data || []);

            const w = wellRes.data || {};
            setWellnessForm({
                mood: w.mood || null,
                energyLevel: w.energyLevel || 3,
                symptoms: Array.isArray(w.symptoms) ? w.symptoms : [],
                activityType: w.activityType || '',
                activityMinutes: w.activityMinutes ?? '',
                notes: w.notes || '',
            });
        } catch (err) {
            console.error('Помилка завантаження даних календаря циклу:', err);
        }
    };

    useEffect(() => {
        fetchAllCycleData();
    }, [viewYear, viewMonth, selectedDate]);

    useEffect(() => {
        setPeriodForm((prev) => ({ ...prev, startDate: selectedDate }));
        setMedForm((prev) => ({ ...prev, packStart: selectedDate }));
    }, [selectedDate]);

    const handlePrevMonth = () => {
        if (viewMonth === 1) {
            setViewYear((y) => y - 1);
            setViewMonth(12);
        } else {
            setViewMonth((m) => m - 1);
        }
    };

    const handleNextMonth = () => {
        if (viewMonth === 12) {
            setViewYear((y) => y + 1);
            setViewMonth(1);
        } else {
            setViewMonth((m) => m + 1);
        }
    };

    // Точкове додавання або видалення дня менструації
    const handleTogglePeriodDay = async (targetDateKey) => {
        if (togglingDay) return;
        setTogglingDay(true);
        try {
            await axios.post('/api/cycle/toggle-day', { date: targetDateKey });
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
        } catch {
            alert('Не вдалося оновити день менструації');
        } finally {
            setTogglingDay(false);
        }
    };

    const handleDayCellClick = async (dateKey) => {
        onDateChange(dateKey);
        if (isEditDaysMode) {
            await handleTogglePeriodDay(dateKey);
        } else {
            setSummaryModalDate(dateKey);
        }
    };

    const handleSaveWellness = async (e) => {
        e.preventDefault();
        setSavingWellness(true);
        try {
            await axios.put('/api/wellness', {
                date: selectedDate,
                ...wellnessForm,
            });
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
            setWellnessSavedMsg('✓ Запис стану збережено');
            setTimeout(() => setWellnessSavedMsg(''), 2500);
        } catch {
            alert('Помилка збереження запису');
        } finally {
            setSavingWellness(false);
        }
    };

    const toggleSymptom = (symId) => {
        setWellnessForm((prev) => ({
            ...prev,
            symptoms: prev.symptoms.includes(symId)
                ? prev.symptoms.filter((id) => id !== symId)
                : [...prev.symptoms, symId],
        }));
    };

    const handleCreatePeriod = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/cycle/periods', periodForm);
            setShowPeriodForm(false);
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
        } catch {
            alert('Помилка збереження менструації');
        }
    };

    const startEditingPeriod = (period) => {
        setEditingPeriodId(period.id);
        setEditPeriodForm({
            startDate: period.startDate.slice(0, 10),
            endDate: period.endDate ? period.endDate.slice(0, 10) : period.startDate.slice(0, 10),
            flowIntensity: period.flowIntensity || 'MEDIUM',
        });
    };

    const handleSaveEditedPeriod = async (e) => {
        e.preventDefault();
        if (!editingPeriodId) return;
        try {
            await axios.put(`/api/cycle/periods/${editingPeriodId}`, editPeriodForm);
            setEditingPeriodId(null);
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
        } catch {
            alert('Помилка оновлення інтервалу менструації');
        }
    };

    const handleDeletePeriod = async (id) => {
        try {
            await axios.delete(`/api/cycle/periods/${id}`);
            if (editingPeriodId === id) setEditingPeriodId(null);
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
        } catch {
            alert('Помилка видалення запису');
        }
    };

    const handleCreateMedication = async (e) => {
        e.preventDefault();
        if (!medForm.name.trim()) return;
        try {
            await axios.post('/api/medications', medForm);
            setMedForm({
                name: '',
                category: 'COC',
                dosage: '1 табл.',
                cocScheme: '21/7',
                packStart: selectedDate,
                reminderTime: '09:00',
            });
            setShowMedForm(false);
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
        } catch {
            alert('Помилка додавання препарату');
        }
    };

    const handleToggleMedication = async (medId) => {
        try {
            await axios.post(`/api/medications/${medId}/toggle`, { date: selectedDate });
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
        } catch {
            alert('Помилка відмітки прийому препарату');
        }
    };

    const handleDeleteMedication = async (medId) => {
        try {
            await axios.delete(`/api/medications/${medId}`);
            await fetchAllCycleData();
            if (onCycleDataChanged) onCycleDataChanged();
        } catch {
            alert('Помилка видалення препарату');
        }
    };

    const actualSet = new Set(calendarData?.actualPeriodDays || []);
    const predictedSet = new Set(calendarData?.predictedPeriodDays || []);
    const fertileSet = new Set(calendarData?.fertileDays || []);
    const ovulationSet = new Set(calendarData?.ovulationDays || []);
    const wellnessMap = calendarData?.wellnessByDate || {};
    const medsCountMap = calendarData?.medsCountByDate || {};

    const getDayCycleMeta = (dateKey) => {
        if (!dateKey) return null;
        if (actualSet.has(dateKey)) {
            return { phaseKey: 'menstrual', phaseName: 'Менструальна фаза (відмічено)', badgeColor: '#e11d48' };
        }
        if (predictedSet.has(dateKey)) {
            return { phaseKey: 'menstrual', phaseName: 'Прогноз менструації', badgeColor: '#ec4899' };
        }
        if (ovulationSet.has(dateKey)) {
            return { phaseKey: 'ovulation', phaseName: 'Овуляція (прогноз)', badgeColor: '#f59e0b' };
        }
        if (fertileSet.has(dateKey)) {
            return { phaseKey: 'follicular', phaseName: 'Фертильне вікно', badgeColor: '#10b981' };
        }
        return null;
    };

    const isSelectedPeriodDay = actualSet.has(selectedDate);
    const monthCells = buildMonthGrid(viewYear, viewMonth);
    const todayStr = getTodayLocalStr();
    const isTodaySelected = selectedDate === todayStr;
    const currentTimeStr = getCurrentHHMM();

    return (
        <div className={`cycle-calendar-tab ${theme}`}>
            {/* ЛІВА КОЛОНКА: КАЛЕНДАР ЦИКЛУ ТА РЕДАГУВАННЯ ДНІВ */}
            <div className="cc-column-left">
                <section className="cc-card">
                    {/* Шапка місяця + перемикач режиму редагування днів */}
                    <div className="cc-month-header">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="cc-nav-btn"
                            aria-label="Попередній місяць"
                        >
                            ◀
                        </button>

                        <div className="cc-month-title-box">
                            <strong className="cc-month-title">
                                {MONTH_NAMES_UA[viewMonth - 1]} {viewYear}
                            </strong>
                            <div className="cc-selected-subtitle">
                                Обрано: {formatReadableDate(selectedDate)}
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="cc-nav-btn"
                            aria-label="Наступний місяць"
                        >
                            ▶
                        </button>
                    </div>

                    {/* Кнопка увімкнення швидкого редагування днів кліком */}
                    <div className="cc-edit-mode-wrap">
                        <button
                            type="button"
                            onClick={() => setIsEditDaysMode((prev) => !prev)}
                            className={`cc-edit-mode-btn ${isEditDaysMode ? 'active' : ''}`}
                        >
                            {isEditDaysMode
                                ? '✓ Режим редагування увімкнено: натискайте на дні в календарі, щоб додати або прибрати менструацію'
                                : '✏️ Редагувати дні менструації кліком по календарю'}
                        </button>
                    </div>

                    {/* Дні тижня */}
                    <div className="cc-weekdays-grid">
                        {WEEKDAYS_UA.map((wd) => (
                            <div key={wd} className="cc-weekday-label">
                                {wd}
                            </div>
                        ))}
                    </div>

                    {/* Сітка днів місяця */}
                    <div className="cc-days-grid">
                        {monthCells.map((cell, idx) => {
                            if (!cell) return <div key={`empty_${idx}`} />;

                            const { day, dateKey } = cell;
                            const isSelected = dateKey === selectedDate;
                            const isToday = dateKey === todayStr;
                            const isActualPeriod = actualSet.has(dateKey);
                            const isPredictedPeriod = !isActualPeriod && predictedSet.has(dateKey);
                            const isOvulation = ovulationSet.has(dateKey);
                            const isFertile = !isActualPeriod && !isPredictedPeriod && fertileSet.has(dateKey);

                            const dayLog = wellnessMap[dateKey];
                            const moodObj = dayLog?.mood ? MOOD_OPTIONS.find((m) => m.id === dayLog.mood) : null;
                            const medsCount = medsCountMap[dateKey] || 0;

                            const cellClasses = [
                                'cc-day-cell',
                                isActualPeriod ? 'cc-day-cell--actual' : '',
                                isPredictedPeriod ? 'cc-day-cell--predicted' : '',
                                isOvulation ? 'cc-day-cell--ovulation' : '',
                                isFertile ? 'cc-day-cell--fertile' : '',
                                isSelected ? 'cc-day-cell--selected' : '',
                            ]
                                .filter(Boolean)
                                .join(' ');

                            return (
                                <button
                                    key={dateKey}
                                    type="button"
                                    onClick={() => handleDayCellClick(dateKey)}
                                    title={
                                        isEditDaysMode
                                            ? 'Натисніть, щоб додати або прибрати день менструації'
                                            : 'Натисніть, щоб переглянути сводку дня та рекомендації'
                                    }
                                    className={cellClasses}
                                >
                                    <span
                                        className={`cc-day-number ${isToday || isSelected ? 'cc-day-number--bold' : ''} ${
                                            isToday ? 'cc-day-number--today' : ''
                                        }`}
                                    >
                                        {day}
                                    </span>

                                    <div className="cc-day-icons">
                                        {isEditDaysMode && (
                                            <span
                                                className={`cc-day-edit-marker ${
                                                    isActualPeriod ? 'cc-day-edit-marker--active' : ''
                                                }`}
                                            >
                                                {isActualPeriod ? '🩸' : '+'}
                                            </span>
                                        )}
                                        {!isEditDaysMode && isOvulation && <span title="Прогноз овуляції">✨</span>}
                                        {!isEditDaysMode && moodObj && <span title={moodObj.label}>{moodObj.emoji}</span>}
                                        {!isEditDaysMode && medsCount > 0 && (
                                            <span title={`Прийнято препаратів: ${medsCount}`}>💊</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Легенда календаря */}
                    <div className="cc-legend">
                        <span>🟥 Менструація</span>
                        <span>🩷 Прогноз циклу</span>
                        <span>🟩 Фертильне вікно</span>
                        <span>✨ Овуляція</span>
                        <span>💊 Препарати</span>
                    </div>

                    {/* ПАНЕЛЬ ШВИДКИХ ДІЙ ДЛЯ ОБРАНОГО ДНЯ */}
                    <div className="cc-quick-actions">
                        <button
                            type="button"
                            onClick={() => setSummaryModalDate(selectedDate)}
                            className="cc-action-btn cc-action-btn--summary"
                        >
                            📋 Сводка та рекомендації за {formatReadableDate(selectedDate)}
                        </button>

                        <button
                            type="button"
                            disabled={togglingDay}
                            onClick={() => handleTogglePeriodDay(selectedDate)}
                            className={`cc-action-btn cc-action-btn--toggle-day ${
                                isSelectedPeriodDay ? 'is-marked' : ''
                            }`}
                        >
                            {isSelectedPeriodDay
                                ? `✕ Прибрати день (${formatReadableDate(selectedDate)})`
                                : `🩸 Додати 1 день (${formatReadableDate(selectedDate)})`}
                        </button>

                        <button
                            type="button"
                            onClick={() => setShowPeriodForm((prev) => !prev)}
                            className="cc-action-btn cc-action-btn--interval"
                        >
                            {showPeriodForm ? '✕ Закрити форму' : '📅 Новий цикл (інтервал)'}
                        </button>
                    </div>

                    {showPeriodForm && (
                        <form onSubmit={handleCreatePeriod} className="cc-sub-form">
                            <div className="cc-grid-2">
                                <div>
                                    <label className="cc-field-label">Початок</label>
                                    <input
                                        type="date"
                                        value={periodForm.startDate}
                                        onChange={(e) => setPeriodForm({ ...periodForm, startDate: e.target.value })}
                                        className="cc-input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="cc-field-label">Кінець (або авто)</label>
                                    <input
                                        type="date"
                                        value={periodForm.endDate}
                                        onChange={(e) => setPeriodForm({ ...periodForm, endDate: e.target.value })}
                                        className="cc-input"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="cc-field-label">Інтенсивність</label>
                                <select
                                    value={periodForm.flowIntensity}
                                    onChange={(e) => setPeriodForm({ ...periodForm, flowIntensity: e.target.value })}
                                    className="cc-input"
                                >
                                    {FLOW_OPTIONS.map((f) => (
                                        <option key={f.id} value={f.id}>
                                            {f.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button type="submit" className="cc-primary-btn cc-primary-btn--crimson">
                                Зберегти період менструації
                            </button>
                        </form>
                    )}
                </section>

                {/* АВТОМАТИЧНА СТАТИСТИКА ЦИКЛУ ТА ПОПЕРЕДЖЕННЯ ПРО ВІДХИЛЕННЯ */}
                {cycleOverview?.cycleStats && (
                    <section className="cc-card cc-card--compact">
                        <div className="cc-section-header">
                            <h4 className="cc-sub-heading">📊 Середні показники (авторозрахунок)</h4>
                            <span className="cc-sync-badge">Синхронізовано з профілем</span>
                        </div>

                        <div className="cc-grid-2">
                            <div className="cc-stat-tile">
                                <div className="cc-stat-label">Тривалість циклу</div>
                                <div className="cc-stat-value cc-accent-berry">
                                    {cycleOverview.cycleStats.avgCycleLength} дн.
                                </div>
                                <div className="cc-stat-hint">
                                    {cycleOverview.cycleStats.isCycleAuto
                                        ? `За ${cycleOverview.cycleStats.cyclesSampleCount} інтервал. між циклами`
                                        : 'Базове значення (потрібно ≥ 2 цикли)'}
                                </div>
                            </div>

                            <div className="cc-stat-tile">
                                <div className="cc-stat-label">Тривалість менструації</div>
                                <div className="cc-stat-value cc-accent-crimson">
                                    {cycleOverview.cycleStats.avgPeriodLength} дн.
                                </div>
                                <div className="cc-stat-hint">
                                    {cycleOverview.cycleStats.isPeriodAuto
                                        ? `За ${cycleOverview.cycleStats.periodsSampleCount} збереженими періодами`
                                        : 'Базове значення з налаштувань'}
                                </div>
                            </div>
                        </div>

                        {Array.isArray(cycleOverview.cycleStats.deviations) &&
                            cycleOverview.cycleStats.deviations.length > 0 && (
                                <div className="cc-deviations-list">
                                    {cycleOverview.cycleStats.deviations.map((dev, idx) => (
                                        <div key={`${dev.type}_${idx}`} className="cc-deviation-alert">
                                            <div className="cc-deviation-title">💡 {dev.title}</div>
                                            <div>{dev.message}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                    </section>
                )}

                {/* ІСТОРІЯ ОСТАННІХ ЦИКЛІВ ІЗ МОЖЛИВІСТЮ РЕДАГУВАННЯ ДАТ */}
                {Array.isArray(cycleOverview?.periods) && cycleOverview.periods.length > 0 && (
                    <section className="cc-card cc-card--compact">
                        <h4 className="cc-sub-heading cc-sub-heading--mb">
                            📅 Історія менструацій (можна змінити дати)
                        </h4>
                        <div className="cc-history-list">
                            {cycleOverview.periods.slice(0, 6).map((p) => {
                                const startStr = p.startDate.slice(0, 10);
                                const endStr = p.endDate ? p.endDate.slice(0, 10) : '';
                                const isEditing = editingPeriodId === p.id;

                                if (isEditing) {
                                    return (
                                        <form
                                            key={p.id}
                                            onSubmit={handleSaveEditedPeriod}
                                            className="cc-history-edit-form"
                                        >
                                            <div className="cc-grid-2">
                                                <div>
                                                    <label className="cc-field-label cc-field-label--xs">Початок</label>
                                                    <input
                                                        type="date"
                                                        value={editPeriodForm.startDate}
                                                        onChange={(e) =>
                                                            setEditPeriodForm({ ...editPeriodForm, startDate: e.target.value })
                                                        }
                                                        className="cc-input cc-input--sm"
                                                        required
                                                    />
                                                </div>
                                                <div>
                                                    <label className="cc-field-label cc-field-label--xs">Кінець</label>
                                                    <input
                                                        type="date"
                                                        min={editPeriodForm.startDate}
                                                        value={editPeriodForm.endDate}
                                                        onChange={(e) =>
                                                            setEditPeriodForm({ ...editPeriodForm, endDate: e.target.value })
                                                        }
                                                        className="cc-input cc-input--sm"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="cc-edit-actions-row">
                                                <button type="submit" className="cc-save-small-btn">
                                                    ✓ Зберегти
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingPeriodId(null)}
                                                    className="cc-cancel-small-btn"
                                                >
                                                    Скасувати
                                                </button>
                                            </div>
                                        </form>
                                    );
                                }

                                return (
                                    <div key={p.id} className="cc-history-row">
                                        <span>
                                            🩸 <strong>{formatReadableDate(startStr)}</strong>
                                            {endStr && endStr !== startStr ? ` — ${formatReadableDate(endStr)}` : ''}
                                        </span>
                                        <div className="cc-row-icon-actions">
                                            <button
                                                type="button"
                                                onClick={() => startEditingPeriod(p)}
                                                className="cc-icon-btn cc-icon-btn--edit"
                                                title="Редагувати дати початку/закінчення"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePeriod(p.id)}
                                                className="cc-icon-btn cc-icon-btn--delete"
                                                title="Видалити запис"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}
            </div>

            {/* ПРАВА КОЛОНКА: РОЗГОРНУТИЙ ЧЕК-ІН (НАСТРІЙ, СИМПТОМИ, АКТИВНІСТЬ) + ПРЕПАРАТИ */}
            <div className="cc-column-right">
                <form onSubmit={handleSaveWellness} className="cc-card">
                    <div className="cc-section-header">
                        <h3 className="cc-main-heading">
                            🌸 Детальний щоденник стану ({formatReadableDate(selectedDate)})
                        </h3>
                        {wellnessSavedMsg && <span className="cc-saved-msg">{wellnessSavedMsg}</span>}
                    </div>

                    {/* Настрій */}
                    <div className="cc-form-group">
                        <label className="cc-group-label">Настрій та емоційний стан</label>
                        <div className="cc-mood-grid">
                            {MOOD_OPTIONS.map((m) => {
                                const active = wellnessForm.mood === m.id;
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setWellnessForm({ ...wellnessForm, mood: active ? null : m.id })}
                                        className={`cc-mood-btn ${active ? 'active' : ''}`}
                                    >
                                        <span>{m.emoji}</span>
                                        <span>{m.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Рівень енергії */}
                    <div className="cc-form-group">
                        <label className="cc-group-label">
                            Рівень енергії: <strong>{wellnessForm.energyLevel || 3} / 5 ⚡</strong>
                        </label>
                        <div className="cc-energy-row">
                            {[1, 2, 3, 4, 5].map((lvl) => (
                                <button
                                    key={lvl}
                                    type="button"
                                    onClick={() => setWellnessForm({ ...wellnessForm, energyLevel: lvl })}
                                    className={`cc-energy-btn ${wellnessForm.energyLevel === lvl ? 'active' : ''}`}
                                >
                                    {lvl} ⚡
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Повний перелік симптомів */}
                    <div className="cc-form-group">
                        <label className="cc-group-label">Симптоми та тілесні відчуття</label>
                        <div className="cc-symptoms-wrap">
                            {SYMPTOM_OPTIONS.map((sym) => {
                                const active = wellnessForm.symptoms.includes(sym.id);
                                return (
                                    <button
                                        key={sym.id}
                                        type="button"
                                        onClick={() => toggleSymptom(sym.id)}
                                        className={`cc-symptom-chip ${active ? 'active' : ''}`}
                                    >
                                        {sym.emoji} {sym.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Фізична активність */}
                    <div className="cc-activity-grid">
                        <div>
                            <label className="cc-field-label">🏃‍♀️ Фізична активність</label>
                            <select
                                value={wellnessForm.activityType}
                                onChange={(e) => setWellnessForm({ ...wellnessForm, activityType: e.target.value })}
                                className="cc-input"
                            >
                                <option value="">Не обрано</option>
                                {ACTIVITY_OPTIONS.map((act) => (
                                    <option key={act.id} value={act.id}>
                                        {act.emoji} {act.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="cc-field-label">Тривалість (хв)</label>
                            <input
                                type="number"
                                min="0"
                                max="600"
                                placeholder="45"
                                value={wellnessForm.activityMinutes}
                                onChange={(e) => setWellnessForm({ ...wellnessForm, activityMinutes: e.target.value })}
                                className="cc-input"
                            />
                        </div>
                    </div>

                    {/* Нотатки */}
                    <div className="cc-form-group cc-form-group--sm">
                        <label className="cc-field-label">📝 Нотатки за день</label>
                        <textarea
                            rows="2"
                            placeholder="Самопочуття, сон, реакція на навантаження або харчування..."
                            value={wellnessForm.notes}
                            onChange={(e) => setWellnessForm({ ...wellnessForm, notes: e.target.value })}
                            className="cc-input cc-textarea"
                        />
                    </div>

                    <button type="submit" disabled={savingWellness} className="cc-primary-btn">
                        {savingWellness ? 'Збереження...' : '💾 Зберегти настрій, симптоми та активність'}
                    </button>
                </form>

                {/* ТРЕКЕР ПРЕПАРАТІВ (КОК, ВІТАМІНИ, ІНШІ) */}
                <section className="cc-card">
                    <div className="cc-section-header">
                        <h3 className="cc-main-heading">💊 Прийом препаратів ({formatReadableDate(selectedDate)})</h3>
                        <button
                            type="button"
                            onClick={() => setShowMedForm((prev) => !prev)}
                            className={`cc-med-add-toggle ${showMedForm ? 'is-open' : ''}`}
                        >
                            {showMedForm ? '✕ Закрити' : '+ Додати препарат / КОК'}
                        </button>
                    </div>

                    {showMedForm && (
                        <form onSubmit={handleCreateMedication} className="cc-sub-form cc-sub-form--mb">
                            <div className="cc-grid-2">
                                <div>
                                    <label className="cc-field-label">Категорія</label>
                                    <select
                                        value={medForm.category}
                                        onChange={(e) => setMedForm({ ...medForm, category: e.target.value })}
                                        className="cc-input"
                                    >
                                        {MED_CATEGORIES.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="cc-field-label">Назва препарату</label>
                                    <input
                                        type="text"
                                        placeholder={medForm.category === 'COC' ? 'Напр. Джаз Плюс' : 'Напр. Вітамін D3 / Магній'}
                                        value={medForm.name}
                                        onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                                        className="cc-input"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="cc-grid-2">
                                <div>
                                    <label className="cc-field-label">Дозування</label>
                                    <input
                                        type="text"
                                        placeholder="1 табл. / 2000 МО"
                                        value={medForm.dosage}
                                        onChange={(e) => setMedForm({ ...medForm, dosage: e.target.value })}
                                        className="cc-input"
                                    />
                                </div>
                                <div>
                                    <label className="cc-field-label">Час прийому</label>
                                    <input
                                        type="time"
                                        value={medForm.reminderTime}
                                        onChange={(e) => setMedForm({ ...medForm, reminderTime: e.target.value })}
                                        className="cc-input"
                                    />
                                </div>
                            </div>

                            {medForm.category === 'COC' && (
                                <div className="cc-grid-2">
                                    <div>
                                        <label className="cc-field-label">Схема блістера КОК</label>
                                        <select
                                            value={medForm.cocScheme}
                                            onChange={(e) => setMedForm({ ...medForm, cocScheme: e.target.value })}
                                            className="cc-input"
                                        >
                                            <option value="21/7">21 активна + 7 перерва</option>
                                            <option value="24/4">24 активні + 4 плацебо</option>
                                            <option value="28">28 безперервно</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="cc-field-label">Початок упаковки</label>
                                        <input
                                            type="date"
                                            value={medForm.packStart}
                                            onChange={(e) => setMedForm({ ...medForm, packStart: e.target.value })}
                                            className="cc-input"
                                        />
                                    </div>
                                </div>
                            )}

                            <button type="submit" className="cc-primary-btn cc-primary-btn--olive">
                                Додати до списку прийому
                            </button>
                        </form>
                    )}

                    {medications.length === 0 ? (
                        <p className="cc-empty-text">
                            Список препаратів порожній. Додайте КОК, вітаміни або інші добавки для щоденного контролю.
                        </p>
                    ) : (
                        <div className="cc-meds-list">
                            {medications.map((med) => {
                                const isDueNow =
                                    isTodaySelected &&
                                    !med.takenToday &&
                                    med.reminderTime &&
                                    currentTimeStr >= med.reminderTime;

                                const itemClasses = [
                                    'cc-med-item',
                                    med.takenToday ? 'cc-med-item--taken' : '',
                                    isDueNow ? 'cc-med-item--due' : '',
                                ]
                                    .filter(Boolean)
                                    .join(' ');

                                return (
                                    <div key={med.id} className={itemClasses}>
                                        <div>
                                            <div className="cc-med-title-row">
                                                <strong className="cc-med-name">{med.name}</strong>
                                                {med.dosage && <span className="cc-med-dosage">({med.dosage})</span>}
                                                {med.reminderTime && (
                                                    <span className={`cc-med-time ${isDueNow ? 'is-due' : ''}`}>
                                                        ⏰ {med.reminderTime} {isDueNow ? '• Час прийому' : ''}
                                                    </span>
                                                )}
                                            </div>

                                            {med.cocStatus && (
                                                <div
                                                    className={`cc-coc-status ${
                                                        med.cocStatus.isBreakDay ? 'is-break' : 'is-active'
                                                    }`}
                                                >
                                                    💊 Блістер ({med.cocStatus.scheme}): {med.cocStatus.statusLabel}
                                                </div>
                                            )}
                                        </div>

                                        <div className="cc-med-actions">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleMedication(med.id)}
                                                className={`cc-med-take-btn ${
                                                    med.takenToday ? 'is-taken' : isDueNow ? 'is-due' : ''
                                                }`}
                                            >
                                                {med.takenToday ? '✓ Прийнято' : 'Відмітити прийом'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => handleDeleteMedication(med.id)}
                                                className="cc-icon-btn cc-icon-btn--delete"
                                                title="Видалити препарат"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>

            {/* ВСПЛИВАЮЧЕ ВІКНО СВОДКИ ТА ПЕРСОНАЛІЗОВАНИХ РЕКОМЕНДАЦІЙ ЗА ДЕНЬ */}
            <DaySummaryModal
                isOpen={Boolean(summaryModalDate)}
                dateStr={summaryModalDate}
                calendarDayMeta={getDayCycleMeta(summaryModalDate)}
                theme={theme}
                onClose={() => setSummaryModalDate(null)}
                onEditDay={(d) => onDateChange(d)}
            />
        </div>
    );
};

export default CycleCalendarTab;