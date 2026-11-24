// frontend/src/components/ProfileModal.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfileModal.css';

const GLASS_PRESETS = [200, 250, 300, 330, 500];

const ACTIVITY_LEVELS = [
    { value: 'sedentary', label: 'Мінімальна (сидячий спосіб життя)', factor: 1.2 },
    { value: 'light', label: 'Легка (тренування 1–3 рази/тиждень)', factor: 1.375 },
    { value: 'moderate', label: 'Помірна (тренування 3–5 разів/тиждень)', factor: 1.55 },
    { value: 'active', label: 'Висока (інтенсивні тренування 6–7 разів)', factor: 1.725 },
    { value: 'very_active', label: 'Дуже висока (фізична робота / 2 тренування)', factor: 1.9 },
];

const GOALS = [
    { value: 'lose', label: '📉 Схуднення (-15% ккал)', multiplier: 0.85, proteinPerKg: 2.0, fatPerKg: 0.85 },
    { value: 'maintain', label: '⚖️ Підтримка ваги', multiplier: 1.0, proteinPerKg: 1.6, fatPerKg: 0.9 },
    { value: 'gain', label: "💪 Набір м'язової маси (+15% ккал)", multiplier: 1.15, proteinPerKg: 1.8, fatPerKg: 1.0 },
];

const ProfileModal = ({ isOpen, onClose, user, onUpdateSuccess, theme = 'light' }) => {
    const [formData, setFormData] = useState({
        weight: '',
        targetWeight: '',
        age: '',
        height: '',
        gender: 'female',
        activityLevel: 'moderate',
        goal: 'maintain',
        calorieGoal: 2000,
        proteinGoal: 150,
        fatGoal: 70,
        carbGoal: 200,
        waterGoal: 2000,
        glassVolume: 250,
        cycleLength: user?.cycleLength ?? 28,
        periodLength: user?.periodLength ?? 5,
        lastPeriodStart: user?.lastPeriodStart ? String(user.lastPeriodStart).slice(0, 10) : '',
    });
    const [saving, setSaving] = useState(false);
    const [calcInfo, setCalcInfo] = useState('');

    useEffect(() => {
        if (user && isOpen) {
            const savedLocalGlass = Number(localStorage.getItem(`glassVolume_${user.id}`));
            setFormData({
                weight: user.weight ?? '',
                targetWeight: user.targetWeight ?? '',
                age: user.age ?? '',
                height: user.height ?? '',
                gender: user.gender || 'female',
                activityLevel: user.activityLevel || 'moderate',
                goal: user.goal || 'maintain',
                calorieGoal: user.calorieGoal ?? 2000,
                proteinGoal: user.proteinGoal ?? 150,
                fatGoal: user.fatGoal ?? 70,
                carbGoal: user.carbGoal ?? 200,
                waterGoal: user.waterGoal ?? 2000,
                glassVolume: user.glassVolume || savedLocalGlass || 250,
                cycleLength: user.cycleLength ?? 28,
                periodLength: user.periodLength ?? 5,
                lastPeriodStart: user.lastPeriodStart ? String(user.lastPeriodStart).slice(0, 10) : '',
            });
            setCalcInfo('');
        }
    }, [user, isOpen]);

    if (!isOpen || !user) return null;

    const handleAutoCalculate = () => {
        const w = parseFloat(formData.weight);
        const h = parseFloat(formData.height);
        const a = parseInt(formData.age, 10);

        if (!w || !h || !a || w <= 0 || h <= 0 || a <= 0) {
            setCalcInfo('⚠️ Вкажіть поточну вагу, зріст та вік для розрахунку.');
            return;
        }

        // Формула Міффліна — Сан-Жеора
        const bmr =
            formData.gender === 'male'
                ? 10 * w + 6.25 * h - 5 * a + 5
                : 10 * w + 6.25 * h - 5 * a - 161;

        const activityObj = ACTIVITY_LEVELS.find((item) => item.value === formData.activityLevel) || ACTIVITY_LEVELS[2];
        const goalObj = GOALS.find((item) => item.value === formData.goal) || GOALS[1];

        const tdee = Math.round(bmr * activityObj.factor);
        const targetCalories = Math.max(1100, Math.round(tdee * goalObj.multiplier));

        const proteins = Math.round(w * goalObj.proteinPerKg);
        const fats = Math.round(w * goalObj.fatPerKg);
        const remainingKcal = Math.max(200, targetCalories - (proteins * 4 + fats * 9));
        const carbs = Math.round(remainingKcal / 4);
        const suggestedWater = Math.round((w * 30) / 50) * 50;

        setFormData((prev) => ({
            ...prev,
            calorieGoal: targetCalories,
            proteinGoal: proteins,
            fatGoal: fats,
            carbGoal: carbs,
            waterGoal: suggestedWater || prev.waterGoal,
        }));

        setCalcInfo(`✅ Базовий обмін (BMR): ${Math.round(bmr)} ккал • Підтримка (TDEE): ${tdee} ккал`);
    };

    const parsedWaterGoal = Math.max(100, parseInt(formData.waterGoal, 10) || 2000);
    const parsedGlassVolume = Math.max(50, parseInt(formData.glassVolume, 10) || 250);
    const fullGlasses = Math.floor(parsedWaterGoal / parsedGlassVolume);
    const remainderMl = parsedWaterGoal % parsedGlassVolume;
    const totalGlasses = Math.ceil(parsedWaterGoal / parsedGlassVolume);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            localStorage.setItem(`glassVolume_${user.id}`, String(parsedGlassVolume));

            const res = await axios.put('/api/profile', {
                ...formData,
                waterGoal: parsedWaterGoal,
                glassVolume: parsedGlassVolume,
            });

            const updatedUser = {
                ...user,
                ...(res.data?.user || res.data || {}),
                waterGoal: parsedWaterGoal,
                glassVolume: res.data?.glassVolume || parsedGlassVolume,
            };

            onUpdateSuccess(updatedUser);
        } catch (err) {
            console.error('Помилка збереження профілю:', err);
            alert(err.response?.data?.error || 'Помилка збереження профілю');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div onClick={onClose} className={`profile-modal-overlay ${theme}`}>
            <div onClick={(e) => e.stopPropagation()} className="pm-modal">
                <div className="pm-header">
                    <h3 className="pm-title">⚙️ Налаштування профілю та цілей</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="pm-close-btn"
                        title="Закрити"
                        aria-label="Закрити"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="pm-grid-2 pm-form-group">
                        <div>
                            <label className="pm-field-label">Поточна вага (кг)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                className="pm-input"
                            />
                        </div>
                        <div>
                            <label className="pm-field-label">Цільова вага (кг)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.targetWeight}
                                onChange={(e) => setFormData({ ...formData, targetWeight: e.target.value })}
                                className="pm-input"
                            />
                        </div>
                    </div>

                    <div className="pm-grid-3 pm-form-group">
                        <div>
                            <label className="pm-field-label">Вік</label>
                            <input
                                type="number"
                                min="1"
                                max="120"
                                value={formData.age}
                                onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                className="pm-input"
                            />
                        </div>
                        <div>
                            <label className="pm-field-label">Зріст (см)</label>
                            <input
                                type="number"
                                step="0.5"
                                value={formData.height}
                                onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                                className="pm-input"
                            />
                        </div>
                        <div>
                            <label className="pm-field-label">Стать</label>
                            <select
                                value={formData.gender}
                                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                                className="pm-input"
                            >
                                <option value="female">Жіноча</option>
                                <option value="male">Чоловіча</option>
                            </select>
                        </div>
                    </div>

                    {/* Активність, ціль та авторозрахунок КБЖВ */}
                    <div className="pm-sub-box pm-sub-box--calc">
                        <div className="pm-grid-2 pm-form-group-sm">
                            <div>
                                <label className="pm-field-label">Рівень активності</label>
                                <select
                                    value={formData.activityLevel}
                                    onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value })}
                                    className="pm-input"
                                >
                                    {ACTIVITY_LEVELS.map((act) => (
                                        <option key={act.value} value={act.value}>
                                            {act.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="pm-field-label">Ваша ціль</label>
                                <select
                                    value={formData.goal}
                                    onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                                    className="pm-input"
                                >
                                    {GOALS.map((g) => (
                                        <option key={g.value} value={g.value}>
                                            {g.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleAutoCalculate}
                            className="pm-calc-btn"
                        >
                            🧮 Розрахувати норму КБЖВ та води (Міффлін — Сан-Жеор)
                        </button>

                        {calcInfo && <div className="pm-calc-info">{calcInfo}</div>}
                    </div>

                    <div className="pm-form-group">
                        <label className="pm-field-label">Денна норма калорій (ккал)</label>
                        <input
                            type="number"
                            step="1"
                            min="500"
                            value={formData.calorieGoal}
                            onChange={(e) => setFormData({ ...formData, calorieGoal: e.target.value })}
                            className="pm-input"
                            required
                        />
                    </div>

                    <div className="pm-grid-3 pm-form-group-lg">
                        <div>
                            <label className="pm-field-label pm-field-label--xs">Білки (г)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.proteinGoal}
                                onChange={(e) => setFormData({ ...formData, proteinGoal: e.target.value })}
                                className="pm-input"
                            />
                        </div>
                        <div>
                            <label className="pm-field-label pm-field-label--xs">Жири (г)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.fatGoal}
                                onChange={(e) => setFormData({ ...formData, fatGoal: e.target.value })}
                                className="pm-input"
                            />
                        </div>
                        <div>
                            <label className="pm-field-label pm-field-label--xs">Вуглеводи (г)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.carbGoal}
                                onChange={(e) => setFormData({ ...formData, carbGoal: e.target.value })}
                                className="pm-input"
                            />
                        </div>
                    </div>

                    {/* Налаштування води та об'єму склянки */}
                    <div className="pm-sub-box pm-sub-box--water">
                        <div className="pm-grid-2 pm-form-group-sm">
                            <div>
                                <label className="pm-field-label pm-water-label">Норма води (мл)</label>
                                <input
                                    type="number"
                                    step="1"
                                    min="100"
                                    value={formData.waterGoal}
                                    onChange={(e) => setFormData({ ...formData, waterGoal: e.target.value })}
                                    className="pm-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="pm-field-label pm-water-label">Об'єм склянки (мл)</label>
                                <input
                                    type="number"
                                    step="1"
                                    min="50"
                                    max="2000"
                                    value={formData.glassVolume}
                                    onChange={(e) => setFormData({ ...formData, glassVolume: e.target.value })}
                                    className="pm-input"
                                    required
                                />
                            </div>
                        </div>

                        <div className="pm-presets-row">
                            {GLASS_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, glassVolume: preset })}
                                    className={`pm-preset-btn ${Number(formData.glassVolume) === preset ? 'active' : ''}`}
                                >
                                    {preset} мл
                                </button>
                            ))}
                        </div>

                        <div className="pm-water-summary">
                            💧 Усього склянок на день: <strong>{totalGlasses}</strong>
                            {remainderMl > 0
                                ? ` (${fullGlasses} повних по ${parsedGlassVolume} мл + 1 склянка ${remainderMl} мл)`
                                : ` (по ${parsedGlassVolume} мл)`}
                        </div>
                    </div>

                    {/* Параметри менструального циклу */}
                    <div className="pm-sub-box pm-sub-box--cycle">
                        <div className="pm-cycle-heading">🌸 Параметри менструального циклу</div>
                        <div className="pm-grid-cycle">
                            <div>
                                <label className="pm-field-label pm-field-label--xs">Цикл (днів)</label>
                                <input
                                    type="number"
                                    min="20"
                                    max="45"
                                    value={formData.cycleLength}
                                    onChange={(e) => setFormData({ ...formData, cycleLength: e.target.value })}
                                    className="pm-input"
                                />
                            </div>
                            <div>
                                <label className="pm-field-label pm-field-label--xs">Менструація (дн.)</label>
                                <input
                                    type="number"
                                    min="2"
                                    max="10"
                                    value={formData.periodLength}
                                    onChange={(e) => setFormData({ ...formData, periodLength: e.target.value })}
                                    className="pm-input"
                                />
                            </div>
                            <div>
                                <label className="pm-field-label pm-field-label--xs">Початок останньої</label>
                                <input
                                    type="date"
                                    value={formData.lastPeriodStart}
                                    onChange={(e) => setFormData({ ...formData, lastPeriodStart: e.target.value })}
                                    className="pm-input"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pm-footer-actions">
                        <button type="button" onClick={onClose} className="pm-btn-secondary">
                            Скасувати
                        </button>
                        <button type="submit" disabled={saving} className="pm-btn-primary">
                            {saving ? 'Збереження...' : 'Зберегти зміни'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileModal;