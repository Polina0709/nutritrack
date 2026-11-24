// frontend/src/components/DailyAlertsBar.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getTodayLocalStr } from '../constants/wellnessOptions';
import './DailyAlertsBar.css';

function getCurrentHHMM() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
}

const DailyAlertsBar = ({
                            theme = 'light',
                            selectedDate,
                            totalWater: propTotalWater,
                            waterGoal: propWaterGoal,
                            refreshTrigger = 0,
                            onMedicationChanged,
                        }) => {
    const [fetchedWater, setFetchedWater] = useState(0);
    const [fetchedGoal, setFetchedGoal] = useState(2000);
    const [medications, setMedications] = useState([]);
    const [nowTime, setNowTime] = useState(getCurrentHHMM);
    const [dismissedMedIds, setDismissedMedIds] = useState([]);
    const [notifPermission, setNotifPermission] = useState(() =>
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );

    const isToday = selectedDate === getTodayLocalStr();

    const loadAlertsData = useCallback(async () => {
        try {
            const requests = [axios.get('/api/medications', { params: { date: selectedDate } })];

            if (propTotalWater === undefined || propWaterGoal === undefined) {
                requests.push(axios.get('/api/water', { params: { date: selectedDate } }));
                requests.push(axios.get('/api/profile'));
            }

            const [medsRes, waterRes, profileRes] = await Promise.all(requests);
            setMedications(Array.isArray(medsRes.data) ? medsRes.data : []);

            if (waterRes) setFetchedWater(waterRes.data?.totalWater || 0);
            if (profileRes) setFetchedGoal(profileRes.data?.waterGoal || 2000);
        } catch (err) {
            console.error('Помилка завантаження сповіщень:', err);
        }
    }, [selectedDate, propTotalWater, propWaterGoal]);

    useEffect(() => {
        loadAlertsData();
    }, [loadAlertsData, refreshTrigger]);

    // Оновлюємо поточний час кожні 30 секунд та надсилаємо браузерні сповіщення
    useEffect(() => {
        if (!isToday) return;

        const checkReminders = () => {
            const current = getCurrentHHMM();
            setNowTime(current);

            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                medications.forEach((med) => {
                    if (!med.takenToday && med.reminderTime && current >= med.reminderTime) {
                        const storageKey = `med_notified_${selectedDate}_${med.id}`;
                        if (!localStorage.getItem(storageKey)) {
                            new Notification('💊 Час прийняти препарат', {
                                body: `${med.name}${med.dosage ? ` (${med.dosage})` : ''} — заплановано на ${med.reminderTime}`,
                            });
                            localStorage.setItem(storageKey, '1');
                        }
                    }
                });
            }
        };

        checkReminders();
        const timer = setInterval(checkReminders, 30000);
        return () => clearInterval(timer);
    }, [isToday, medications, selectedDate]);

    const handleRequestBrowserNotifications = async () => {
        if (typeof Notification === 'undefined') return;
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
    };

    const handleQuickTakeMed = async (medId) => {
        try {
            await axios.post(`/api/medications/${medId}/toggle`, { date: selectedDate });
            await loadAlertsData();
            if (onMedicationChanged) onMedicationChanged();
        } catch {
            alert('Не вдалося відмітити прийом препарату');
        }
    };

    const activeWater = propTotalWater !== undefined ? propTotalWater : fetchedWater;
    const activeGoal = propWaterGoal !== undefined ? propWaterGoal : fetchedGoal;

    // Розрахунок перевищення води
    const waterRatio = activeGoal > 0 ? activeWater / activeGoal : 0;
    const excessMl = Math.max(0, activeWater - activeGoal);
    const showExcessWarning = waterRatio >= 1.3; // Перевищення ≥ 130%
    const showGoalReachedInfo = waterRatio > 1.0 && waterRatio < 1.3;

    // Фільтрація препаратів на сьогодні
    const untakenMeds = medications.filter((m) => !m.takenToday);
    const dueMeds = isToday
        ? untakenMeds.filter(
            (m) =>
                !dismissedMedIds.includes(m.id) &&
                (!m.reminderTime || nowTime >= m.reminderTime)
        )
        : [];

    const upcomingMeds = isToday
        ? untakenMeds.filter((m) => m.reminderTime && nowTime < m.reminderTime)
        : [];

    if (!showExcessWarning && !showGoalReachedInfo && dueMeds.length === 0 && upcomingMeds.length === 0) {
        return null;
    }

    return (
        <div className={`daily-alerts-bar ${theme}`}>
            {/* 1. ПОПЕРЕДЖЕННЯ ПРО ПЕРЕВИЩЕННЯ НОРМИ ВОДИ */}
            {showExcessWarning && (
                <div className="dab-alert dab-alert--danger" role="alert">
                    <span className="dab-alert-icon" aria-hidden="true">
                        ⚠️
                    </span>
                    <div>
                        <strong className="dab-danger-title">
                            Перевищення денної норми води (+{excessMl} мл)
                        </strong>
                        <div className="dab-danger-desc">
                            Випито {activeWater} мл при нормі {activeGoal} мл ({Math.round(waterRatio * 100)}%). Надмірна кількість рідини може перевантажувати нирки та вимивати електроліти — пийте далі лише за відчуттям спраги.
                        </div>
                    </div>
                </div>
            )}

            {showGoalReachedInfo && (
                <div className="dab-alert dab-alert--water">
                    💧 <strong>Денну норму води перевищено на {excessMl} мл</strong> ({activeWater} / {activeGoal} мл). Додаткова вода доречна після тренування або у спеку.
                </div>
            )}

            {/* 2. АКТИВНІ НАГАДУВАННЯ ПРО ПРИЙОМ ПРЕПАРАТІВ */}
            {dueMeds.length > 0 && (
                <div className="dab-alert dab-alert--meds">
                    <div className="dab-meds-header">
                        <strong className="dab-meds-title">
                            💊 Нагадування: час прийняти препарати ({dueMeds.length})
                        </strong>

                        {typeof Notification !== 'undefined' && notifPermission === 'default' && (
                            <button
                                type="button"
                                onClick={handleRequestBrowserNotifications}
                                className="dab-push-btn"
                            >
                                🔔 Увімкнути push-сповіщення
                            </button>
                        )}
                    </div>

                    <div className="dab-meds-list">
                        {dueMeds.map((med) => (
                            <div key={med.id} className="dab-med-row">
                                <div className="dab-med-info">
                                    <strong>{med.name}</strong>
                                    {med.dosage && <span className="dab-med-dosage"> ({med.dosage})</span>}
                                    {med.reminderTime && (
                                        <span className="dab-med-time">⏰ {med.reminderTime}</span>
                                    )}
                                </div>

                                <div className="dab-med-actions">
                                    <button
                                        type="button"
                                        onClick={() => handleQuickTakeMed(med.id)}
                                        className="dab-btn-take"
                                    >
                                        ✓ Випито
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setDismissedMedIds((prev) => [...prev, med.id])}
                                        className="dab-btn-later"
                                        title="Приховати нагадування до оновлення сторінки"
                                    >
                                        Пізніше
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. ЗАПЛАНОВАНІ НА СЬОГОДНІ ПРЕПАРАТИ */}
            {upcomingMeds.length > 0 && (
                <div className="dab-upcoming-bar">
                    <span className="dab-upcoming-label">🕒 Заплановано на сьогодні:</span>
                    {upcomingMeds.map((m) => (
                        <span key={m.id} className="dab-upcoming-pill">
                            {m.name} о {m.reminderTime}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DailyAlertsBar;