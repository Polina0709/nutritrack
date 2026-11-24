// frontend/src/components/BrowserReminderManager.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { getTodayLocalStr } from '../constants/wellnessOptions';
import './BrowserReminderManager.css';

const WATER_INTERVAL_OPTIONS = [
    { minutes: 0, label: 'Вимкнено' },
    { minutes: 90, label: 'Кожні 1.5 год' },
    { minutes: 120, label: 'Кожні 2 год' },
    { minutes: 180, label: 'Кожні 3 год' },
];

const BrowserReminderManager = ({ user, theme = 'light', refreshTrigger = 0 }) => {
    const supported = typeof window !== 'undefined' && 'Notification' in window;
    const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'unsupported'));

    const intervalStorageKey = user?.id ? `waterNotifyInterval_${user.id}` : 'waterNotifyInterval';
    const [waterIntervalMin, setWaterIntervalMin] = useState(() => {
        const saved = localStorage.getItem(intervalStorageKey);
        return saved !== null ? Number(saved) : 120;
    });

    const requestPermission = async () => {
        if (!supported) return;
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            new Notification('NutriTrack 🌸 — Сповіщення активовано', {
                body: 'Ви отримуватимете системні нагадування про прийом КОК, вітамінів та водний баланс.',
            });
        }
    };

    const sendTestNotification = () => {
        if (!supported || Notification.permission !== 'granted') return;
        new Notification('💊 Тестове нагадування NutriTrack', {
            body: 'Нагадування про прийом препаратів та воду працюють коректно!',
        });
    };

    const handleWaterIntervalChange = (mins) => {
        const val = Number(mins);
        setWaterIntervalMin(val);
        localStorage.setItem(intervalStorageKey, String(val));
    };

    useEffect(() => {
        if (!user || !supported || permission !== 'granted') return;

        const checkAndNotify = async () => {
            const todayStr = getTodayLocalStr();
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const currentHHMM = `${hh}:${mm}`;

            // 1. Перевірка прийому препаратів / КОК на сьогодні
            try {
                const medsRes = await axios.get('/api/medications', { params: { date: todayStr } });
                const meds = Array.isArray(medsRes.data) ? medsRes.data : [];

                for (const med of meds) {
                    if (!med.takenToday && med.reminderTime && currentHHMM >= med.reminderTime) {
                        const dedupeKey = `notified_med_${user.id}_${med.id}_${todayStr}`;
                        if (!localStorage.getItem(dedupeKey)) {
                            localStorage.setItem(dedupeKey, '1');
                            new Notification(`💊 Час прийому: ${med.name}`, {
                                body: `${med.dosage ? `Дозування: ${med.dosage}. ` : ''}Запланований час: ${med.reminderTime}. Відмітьте прийом у NutriTrack.`,
                                tag: `med_${med.id}_${todayStr}`,
                            });
                        }
                    }
                }
            } catch {
                // Ігноруємо тимчасові мережеві збої у фоновому опитуванні
            }

            // 2. Періодичні нагадування про воду в денний час (09:00 – 21:00)
            const hour = now.getHours();
            if (waterIntervalMin > 0 && hour >= 9 && hour <= 21) {
                const lastWaterNotifyKey = `last_water_notify_${user.id}`;
                const lastTs = Number(localStorage.getItem(lastWaterNotifyKey) || 0);
                const elapsedMs = Date.now() - lastTs;

                if (elapsedMs >= waterIntervalMin * 60 * 1000) {
                    localStorage.setItem(lastWaterNotifyKey, String(Date.now()));
                    new Notification('💧 Нагадування про водний баланс', {
                        body: `Час випити склянку води (${user.glassVolume || 250} мл), щоб підтримати денну норму ${user.waterGoal || 2000} мл.`,
                        tag: `water_reminder_${todayStr}`,
                    });
                }
            }
        };

        checkAndNotify();
        const intervalId = setInterval(checkAndNotify, 60 * 1000);
        return () => clearInterval(intervalId);
    }, [user, supported, permission, waterIntervalMin, refreshTrigger]);

    if (!user || !supported || permission === 'denied') return null;

    return (
        <div className={`browser-reminder-manager ${theme}`}>
            {permission !== 'granted' ? (
                <>
                    <span className="brm-prompt-text">
                        🔔 <strong>Системні нагадування браузера вимкнено.</strong> Увімкніть, щоб отримувати сповіщення про КОК, вітаміни та воду навіть коли вкладка згорнута.
                    </span>
                    <button
                        type="button"
                        onClick={requestPermission}
                        className="brm-enable-btn"
                    >
                        Увімкнути сповіщення
                    </button>
                </>
            ) : (
                <>
                    <div className="brm-active-group">
                        <span className="brm-status-active">🔔 Сповіщення браузера активні</span>
                        <span className="brm-interval-label">• Нагадування про воду:</span>
                        <select
                            value={waterIntervalMin}
                            onChange={(e) => handleWaterIntervalChange(e.target.value)}
                            className="brm-select"
                            aria-label="Інтервал нагадувань про воду"
                        >
                            {WATER_INTERVAL_OPTIONS.map((opt) => (
                                <option key={opt.minutes} value={opt.minutes}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={sendTestNotification}
                        className="brm-test-btn"
                    >
                        Перевірити звук / банер
                    </button>
                </>
            )}
        </div>
    );
};

export default BrowserReminderManager;