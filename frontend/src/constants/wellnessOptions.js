// frontend/src/constants/wellnessOptions.js

export const MOOD_OPTIONS = [
    { id: 'GREAT', emoji: '🤩', label: 'Чудовий' },
    { id: 'GOOD', emoji: '🙂', label: 'Добрий' },
    { id: 'NEUTRAL', emoji: '😐', label: 'Спокійний' },
    { id: 'TIRED', emoji: '😴', label: 'Втомлений' },
    { id: 'IRRITABLE', emoji: '😤', label: 'Дратівливий' },
    { id: 'SAD', emoji: '😢', label: 'Сумний' },
];

export const SYMPTOM_OPTIONS = [
    { id: 'CRAMPS', emoji: '💢', label: 'Біль у животі', quick: true },
    { id: 'FATIGUE', emoji: '🔋', label: 'Втома', quick: true },
    { id: 'BLOATING', emoji: '🎈', label: 'Набряки / здуття', quick: true },
    { id: 'HEADACHE', emoji: '🤕', label: 'Головний біль', quick: true },
    { id: 'CRAVINGS', emoji: '🍫', label: 'Тяга до солодкого', quick: true },
    { id: 'MOOD_SWINGS', emoji: '🎭', label: 'Перепади настрою', quick: false },
    { id: 'ACNE', emoji: '✨', label: 'Висипання на шкірі', quick: false },
    { id: 'BREAST_TENDERNESS', emoji: '🌸', label: 'Чутливість грудей', quick: false },
];

export const ACTIVITY_OPTIONS = [
    { id: 'STRENGTH', emoji: '🏋️‍♀️', label: 'Силове тренування' },
    { id: 'CARDIO', emoji: '🏃‍♀️', label: 'Кардіо / Біг' },
    { id: 'YOGA', emoji: '🧘‍♀️', label: 'Йога / Пілатес / Розтяжка' },
    { id: 'WALKING', emoji: '🚶‍♀️', label: 'Активна ходьба' },
    { id: 'REST', emoji: '🛋️', label: 'День відновлення' },
];

export const FLOW_OPTIONS = [
    { id: 'LIGHT', label: '💧 Мізерні' },
    { id: 'MEDIUM', label: '🩸 Помірні' },
    { id: 'HEAVY', label: '🩸🩸 Рясні' },
];

export const MED_CATEGORIES = [
    { id: 'COC', label: '💊 КОК (контрацептиви)' },
    { id: 'VITAMIN', label: '🌿 Вітаміни / БАД' },
    { id: 'OTHER', label: '🩺 Інший препарат' },
];

export function getTodayLocalStr() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function shiftDateStr(dateStr, deltaDays) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
}

export function formatReadableDate(dateStr) {
    if (!dateStr) return '';
    const today = getTodayLocalStr();
    if (dateStr === today) return 'Сьогодні';
    if (dateStr === shiftDateStr(today, -1)) return 'Вчора';
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
}