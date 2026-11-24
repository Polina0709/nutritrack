// frontend/src/components/DaySummaryModal.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    MOOD_OPTIONS,
    SYMPTOM_OPTIONS,
    ACTIVITY_OPTIONS,
    formatReadableDate,
} from '../constants/wellnessOptions';
import './DaySummaryModal.css';

const MEAL_GROUP_ORDER = [
    { key: 'breakfast', label: '🌅 Сніданок' },
    { key: 'lunch', label: '☀️ Обід' },
    { key: 'dinner', label: '🌙 Вечеря' },
    { key: 'snack', label: '🍎 Перекус' },
];

function normalizeSymptomsArray(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } catch {
            return raw.split(',').map((s) => s.trim()).filter(Boolean);
        }
    }
    return [];
}

function buildPersonalizedRecommendations({
                                              phaseKey,
                                              dynamicCalories,
                                              moodObj,
                                              rawMood,
                                              energyLevel,
                                              symptomObjs,
                                              activityObj,
                                              activityType,
                                              activityMinutes,
                                              takenMeds,
                                              pendingMeds,
                                              nutrition,
                                              hydration,
                                          }) {
    const recs = [];
    const matchedSymptomGroups = new Set();

    // 1. Адаптація норми калорій під активність і лютеїнову фазу
    if (dynamicCalories?.hasAdjustment) {
        const parts = [];
        if (dynamicCalories.activityBonus > 0) {
            parts.push(`+${dynamicCalories.activityBonus} ккал за активність`);
        }
        if (dynamicCalories.lutealBonus > 0) {
            parts.push(`+${dynamicCalories.lutealBonus} ккал (підвищений обмін у лютеїновій фазі)`);
        }
        recs.push({
            icon: '🔥',
            category: 'Адаптивна норма калорій',
            title: `Сьогоднішня норма: ${dynamicCalories.effectiveGoal} ккал (база ${dynamicCalories.baseGoal})`,
            text: `До базового ліміту враховано ${parts.join(' та ')}. Це допомагає відновлюватися без перевантаження нервової системи та зривів.`,
        });
    }

    // 2. Рекомендації за фазою циклу
    if (phaseKey === 'menstrual') {
        recs.push({
            icon: '🩸',
            category: 'Фаза циклу',
            title: 'Відновлення запасів заліза',
            text: 'Під час менструації організм втрачає залізо. Додайте в раціон гречку, шпинат, яловичину, сочевицю або гарбузове насіння у поєднанні з вітаміном C.',
        });
    } else if (phaseKey === 'follicular') {
        recs.push({
            icon: '🌱',
            category: 'Фаза циклу',
            title: 'Пік енергії та метаболізму',
            text: 'У фолікулярній фазі чутливість до інсуліну висока — це найкращий час для силових чи активних тренувань, білкових страв і складних вуглеводів.',
        });
    } else if (phaseKey === 'ovulation') {
        recs.push({
            icon: '✨',
            category: 'Фаза циклу',
            title: 'Антиоксиданти та водний баланс',
            text: 'Підтримайте організм під час овуляції хрестоцвітими овочами (броколі, цвітна капуста), ягодами, клітковиною та достатньою кількістю чистої води.',
        });
    } else if (phaseKey === 'luteal') {
        recs.push({
            icon: '🌙',
            category: 'Фаза циклу',
            title: 'Стабілізація апетиту та ПМС',
            text: 'У лютеїнову фазу тяга до солодкого посилюється. Робіть акцент на магній (горіхи, какао, зелень), білок та повільні вуглеводи.',
        });
    }

    // 3. Рекомендації за кожним відміченим симптомом
    for (const sym of symptomObjs) {
        const key = `${String(sym.id).toLowerCase()} ${String(sym.label).toLowerCase()}`;

        if (/cramp|pain|ache|спазм|біль|живіт|поперек|тягн/.test(key)) {
            if (!matchedSymptomGroups.has('pain')) {
                matchedSymptomGroups.add('pain');
                recs.push({
                    icon: '♨️',
                    category: `Симптом: ${sym.label}`,
                    title: 'Полегшення спазмів і болю',
                    text: 'Допоможуть сухе тепло на низ живота або поперек, теплий ромашковий чи м’ятний чай, продукти з магнієм та м’яка розтяжка.',
                });
            }
        } else if (/head|migraine|голов|мігрен/.test(key)) {
            if (!matchedSymptomGroups.has('headache')) {
                matchedSymptomGroups.add('headache');
                recs.push({
                    icon: '🧠',
                    category: `Симптом: ${sym.label}`,
                    title: 'Підтримка при головному болю',
                    text: 'Випийте склянку води, провітріть кімнату, зменшіть яскравість екранів і не пропускайте прийоми їжі, щоб уникнути падіння глюкози.',
                });
            }
        } else if (/fatigue|tired|weak|sleepy|втом|слабк|сонлив|знесил/.test(key)) {
            if (!matchedSymptomGroups.has('fatigue')) {
                matchedSymptomGroups.add('fatigue');
                recs.push({
                    icon: '🔋',
                    category: `Симптом: ${sym.label}`,
                    title: 'Відновлення енергетичного ресурсу',
                    text: 'Поєднайте білок зі складними вуглеводами (крупи, цільнозерновий хліб, овочі) та заплануйте сон на 30–60 хв раніше.',
                });
            }
        } else if (/bloat|swell|edema|здут|набряк|важк/.test(key)) {
            if (!matchedSymptomGroups.has('bloating')) {
                matchedSymptomGroups.add('bloating');
                recs.push({
                    icon: '💧',
                    category: `Симптом: ${sym.label}`,
                    title: 'Зменшення набряків та здуття',
                    text: 'Обмежте солоні снеки та газовані напої, пийте чисту воду рівномірно протягом дня та додайте джерела калію (банан, авокадо, зелень).',
                });
            }
        } else if (/swing|irritab|anxi|stress|перепад|дратів|тривог|плакс/.test(key)) {
            if (!matchedSymptomGroups.has('emotional_sym')) {
                matchedSymptomGroups.add('emotional_sym');
                recs.push({
                    icon: '🧘‍♀️',
                    category: `Симптом: ${sym.label}`,
                    title: 'Стабілізація емоційного фону',
                    text: 'Скоротіть кофеїн у другій половині дня, додайте продукти з вітамінами групи B та омега-3 (риба, волоські горіхи, насіння льону).',
                });
            }
        } else if (/crav|sweet|appetite|hunger|солодк|апетит|голод/.test(key)) {
            if (!matchedSymptomGroups.has('cravings')) {
                matchedSymptomGroups.add('cravings');
                recs.push({
                    icon: '🍫',
                    category: `Симптом: ${sym.label}`,
                    title: 'Контроль тяги до солодкого',
                    text: 'Обирайте чорний шоколад (від 75%), ягоди з кисломолочним сиром або горіхами замість швидких солодощів натщесерце.',
                });
            }
        } else {
            recs.push({
                icon: sym.emoji || '🩺',
                category: `Симптом: ${sym.label}`,
                title: `Увага до самопочуття (${sym.label})`,
                text: `Зафіксовано «${sym.label}». Дотримуйтеся помірного режиму навантажень і підтримуйте водний баланс.`,
            });
        }
    }

    // 4. Настрій та енергія
    const moodText = `${String(moodObj?.id || rawMood || '').toLowerCase()} ${String(moodObj?.label || '').toLowerCase()}`.trim();
    if (moodText && /sad|anxi|stress|irritab|angry|tired|apathetic|tearful|bad|low|сум|тривог|стрес|дратів|зліст|апат|поган|пригніч|втом/.test(moodText)) {
        recs.push({
            icon: moodObj?.emoji || '💛',
            category: `Настрій: ${moodObj?.label || rawMood}`,
            title: 'Дбайлива підтримка емоційного стану',
            text: 'Коротка прогулянка на свіжому повітрі, теплий напій та повноцінний прийом їжі допоможуть стабілізувати стан без жорстких обмежень.',
        });
    }

    if (energyLevel != null && Number(energyLevel) <= 2 && !matchedSymptomGroups.has('fatigue')) {
        recs.push({
            icon: '🪫',
            category: `Енергія: ${energyLevel}/5`,
            title: 'Низький рівень енергії',
            text: 'Замість інтенсивного кардіо оберіть спокійну ходьбу або відпочинок і додайте складні вуглеводи в раціон.',
        });
    }

    // 5. Фізична активність
    const actLabel = activityObj?.label || activityType;
    if (actLabel) {
        const mins = Number(activityMinutes) || 0;
        recs.push({
            icon: activityObj?.emoji || '🏃‍♀️',
            category: `Активність: ${actLabel}${mins > 0 ? ` (${mins} хв)` : ''}`,
            title: 'Відновлення після тренування',
            text:
                mins >= 30
                    ? `Після ${mins} хв активності варто поповнити водний баланс (+300–500 мл води) та додати 20–30 г білка у наступний прийом їжі.`
                    : 'Навіть коротка активність покращує кровообіг у малому тазу та знижує рівень стресу. Не забудьте випити склянку води.',
        });
    }

    // 6. Препарати
    if (Array.isArray(pendingMeds) && pendingMeds.length > 0) {
        recs.push({
            icon: '💊',
            category: 'Препарати',
            title: 'Не відмічено прийом препаратів',
            text: `За цей день ще не відмічено: ${pendingMeds.map((m) => m.name).join(', ')}.`,
        });
    }

    // 7. Вода та харчування
    if (hydration?.waterGoal > 0 && hydration?.waterMl > 0 && hydration.waterMl < hydration.waterGoal * 0.7) {
        const missingMl = Math.max(0, hydration.waterGoal - hydration.waterMl);
        recs.push({
            icon: '🚰',
            category: 'Водний баланс',
            title: `Недобір води (${hydration.waterMl} із ${hydration.waterGoal} мл)`,
            text: `До денної норми залишилося ${missingMl} мл. Достатня гідратація зменшує втому та набряки.`,
        });
    }

    if (nutrition?.entriesCount > 0 && nutrition.calories < nutrition.calorieGoal * 0.65) {
        recs.push({
            icon: '🍽️',
            category: 'Харчування',
            title: 'Низька калорійність відносно адаптованої норми',
            text: `Зафіксовано ${nutrition.calories} ккал із ${nutrition.calorieGoal} ккал. Надмірний дефіцит може посилювати втому та впливати на цикл.`,
        });
    }

    if (recs.length === 0) {
        recs.push({
            icon: '🌟',
            category: 'Підсумок дня',
            title: 'Збалансований день',
            text: 'Показники за цей день у нормі. Продовжуйте фіксувати стан і харчування для точніших порад.',
        });
    }

    return recs;
}

const DaySummaryModal = ({
                             isOpen,
                             dateStr,
                             calendarDayMeta = null,
                             theme = 'light',
                             onClose,
                             onEditDay,
                         }) => {
    const [summary, setSummary] = useState(null);
    const [dayWellness, setDayWellness] = useState(null);
    const [dayMeds, setDayMeds] = useState([]);
    const [dayOverview, setDayOverview] = useState(null);
    const [loading, setLoading] = useState(false);

    // Розгортання деталізації страв та прийомів їжі
    const [showMealsDetail, setShowMealsDetail] = useState(false);

    useEffect(() => {
        if (!isOpen || !dateStr) return;
        setShowMealsDetail(false);

        let cancelled = false;
        const loadAllDayInfo = async () => {
            setLoading(true);
            try {
                const [sumRes, wellRes, medsRes, overRes] = await Promise.allSettled([
                    axios.get('/api/cycle/day-summary', { params: { date: dateStr } }),
                    axios.get('/api/wellness', { params: { date: dateStr } }),
                    axios.get('/api/medications', { params: { date: dateStr } }),
                    axios.get('/api/cycle/overview', { params: { date: dateStr } }),
                ]);

                if (cancelled) return;

                setSummary(sumRes.status === 'fulfilled' ? sumRes.value.data : null);
                setDayWellness(wellRes.status === 'fulfilled' ? wellRes.value.data : null);
                setDayMeds(
                    medsRes.status === 'fulfilled' && Array.isArray(medsRes.value.data)
                        ? medsRes.value.data
                        : []
                );
                setDayOverview(overRes.status === 'fulfilled' ? overRes.value.data : null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        loadAllDayInfo();
        return () => {
            cancelled = true;
        };
    }, [isOpen, dateStr]);

    if (!isOpen || !dateStr) return null;

    const rawWell = dayWellness?.wellness || dayWellness || {};
    const sumWell = summary?.wellness || {};

    const mergedWellness = {
        mood: rawWell.mood ?? sumWell.mood ?? null,
        energyLevel: rawWell.energyLevel ?? sumWell.energyLevel ?? null,
        symptoms: normalizeSymptomsArray(
            rawWell.symptoms !== undefined ? rawWell.symptoms : sumWell.symptoms
        ),
        activityType: rawWell.activityType || sumWell.activityType || '',
        activityMinutes: rawWell.activityMinutes ?? sumWell.activityMinutes ?? null,
        notes: rawWell.notes || sumWell.notes || '',
    };

    const moodObj = mergedWellness.mood
        ? MOOD_OPTIONS.find(
        (m) =>
            String(m.id) === String(mergedWellness.mood) ||
            String(m.label).toLowerCase() === String(mergedWellness.mood).toLowerCase()
    ) || { id: mergedWellness.mood, emoji: '🙂', label: String(mergedWellness.mood) }
        : null;

    const symptomObjs = mergedWellness.symptoms.map((symVal) => {
        const found = SYMPTOM_OPTIONS.find(
            (s) =>
                String(s.id) === String(symVal) ||
                String(s.label).toLowerCase() === String(symVal).toLowerCase()
        );
        return found || { id: symVal, emoji: '•', label: String(symVal) };
    });

    const activityObj = mergedWellness.activityType
        ? ACTIVITY_OPTIONS.find(
            (a) =>
                String(a.id) === String(mergedWellness.activityType) ||
                String(a.label).toLowerCase() === String(mergedWellness.activityType).toLowerCase()
        )
        : null;

    const takenMeds = dayMeds.filter((m) => m.takenToday);
    const pendingMeds = dayMeds.filter((m) => !m.takenToday);

    const effectivePhaseKey =
        calendarDayMeta?.phaseKey ||
        dayOverview?.phaseKey ||
        summary?.cycle?.phaseKey ||
        'unknown';

    const effectivePhaseName =
        calendarDayMeta?.phaseName ||
        dayOverview?.phaseName ||
        summary?.cycle?.phaseName ||
        'Цикл не налаштовано';

    const effectiveBadgeColor =
        calendarDayMeta?.badgeColor ||
        dayOverview?.badgeColor ||
        summary?.cycle?.badgeColor ||
        '#c83768';

    const effectiveCycleDay = dayOverview?.cycleDay ?? summary?.cycle?.cycleDay ?? null;
    const effectiveCycleLength =
        dayOverview?.cycleStats?.avgCycleLength ??
        dayOverview?.cycleLength ??
        summary?.cycle?.cycleLength ??
        28;

    const nutrition = summary?.nutrition || {
        calories: 0,
        baseCalorieGoal: 2000,
        calorieGoal: 2000,
        proteins: 0,
        fats: 0,
        carbs: 0,
        entriesCount: 0,
        meals: [],
    };
    const dynamicCalories = summary?.dynamicCalories || null;
    const hydration = summary?.hydration || { waterMl: 0, waterGoal: 2000 };
    const weight = summary?.weight ?? null;

    const mealsList = Array.isArray(nutrition.meals) ? nutrition.meals : [];
    const groupedMeals = MEAL_GROUP_ORDER.map((grp) => {
        const items = mealsList.filter((m) => m.mealType === grp.key);
        const groupKcal = items.reduce((s, i) => s + i.calories, 0);
        return { ...grp, items, groupKcal };
    }).filter((g) => g.items.length > 0);

    const knownGroupKeys = new Set(MEAL_GROUP_ORDER.map((g) => g.key));
    const otherMeals = mealsList.filter((m) => !knownGroupKeys.has(m.mealType));
    if (otherMeals.length > 0) {
        groupedMeals.push({
            key: 'other',
            label: '🍽️ Інші прийоми їжі',
            items: otherMeals,
            groupKcal: otherMeals.reduce((s, i) => s + i.calories, 0),
        });
    }

    const recommendations = buildPersonalizedRecommendations({
        phaseKey: effectivePhaseKey,
        dynamicCalories,
        moodObj,
        rawMood: mergedWellness.mood,
        energyLevel: mergedWellness.energyLevel,
        symptomObjs,
        activityObj,
        activityType: mergedWellness.activityType,
        activityMinutes: mergedWellness.activityMinutes,
        takenMeds,
        pendingMeds,
        nutrition,
        hydration,
    });

    return (
        <div onClick={onClose} className={`day-summary-overlay ${theme}`}>
            <div onClick={(e) => e.stopPropagation()} className="dsm-modal">
                {/* ШАПКА МОДАЛКИ */}
                <div className="dsm-header">
                    <div>
                        <div className="dsm-eyebrow">📅 Сводка за день</div>
                        <h3 className="dsm-title">{formatReadableDate(dateStr)}</h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="dsm-close-btn"
                        title="Закрити"
                        aria-label="Закрити"
                    >
                        ✕
                    </button>
                </div>

                {loading ? (
                    <div className="dsm-loading">
                        Завантаження даних та формування рекомендацій...
                    </div>
                ) : (
                    <div className="dsm-body">
                        {/* 1. БЕЙДЖ ФАЗИ ЦИКЛУ */}
                        <div className="dsm-phase-bar">
                            <span
                                className="dsm-phase-pill"
                                style={{ backgroundColor: effectiveBadgeColor }}
                            >
                                🌸 {effectivePhaseName}
                            </span>

                            {effectiveCycleDay != null && (
                                <span className="dsm-cycle-day">
                                    День {effectiveCycleDay} із {effectiveCycleLength}
                                </span>
                            )}
                        </div>

                        {/* 2. КЛЮЧОВІ ПОКАЗНИКИ */}
                        <div className="dsm-metrics-grid">
                            <div className="dsm-metric-tile">
                                <div className="dsm-metric-label">
                                    🍽️ Калорії {dynamicCalories?.hasAdjustment ? '(адапт.)' : ''}
                                </div>
                                <div className="dsm-metric-value dsm-accent-berry">
                                    {nutrition.calories} / {nutrition.calorieGoal}
                                </div>
                                <div className="dsm-metric-sub">
                                    Б: {nutrition.proteins}г • Ж: {nutrition.fats}г • В: {nutrition.carbs}г
                                </div>
                                {dynamicCalories?.hasAdjustment && (
                                    <div className="dsm-dynamic-note">
                                        База {dynamicCalories.baseGoal}
                                        {dynamicCalories.activityBonus > 0 ? ` + ${dynamicCalories.activityBonus} спорт` : ''}
                                        {dynamicCalories.lutealBonus > 0 ? ` + ${dynamicCalories.lutealBonus} фаза` : ''}
                                    </div>
                                )}
                            </div>

                            <div className="dsm-metric-tile">
                                <div className="dsm-metric-label">💧 Вода</div>
                                <div className="dsm-metric-value dsm-accent-water">
                                    {hydration.waterMl} / {hydration.waterGoal} мл
                                </div>
                                <div className="dsm-metric-sub">
                                    {Math.round((hydration.waterMl / Math.max(1, hydration.waterGoal)) * 100)}% від норми
                                </div>
                            </div>

                            <div className="dsm-metric-tile">
                                <div className="dsm-metric-label">⚖️ Вага</div>
                                <div className="dsm-metric-value dsm-accent-olive">
                                    {weight != null ? `${weight} кг` : 'Не записано'}
                                </div>
                                <div className="dsm-metric-sub">
                                    {weight != null ? 'Зафіксовано за день' : 'Без зважування'}
                                </div>
                            </div>
                        </div>

                        {/* 3. ДЕТАЛІЗАЦІЯ ХАРЧУВАННЯ ТА ПРИЙОМІВ ЇЖІ ЗА ДЕНЬ */}
                        <div className="dsm-sub-card">
                            <div className="dsm-ration-header">
                                <span className="dsm-block-label">
                                    🥗 Раціон дня ({mealsList.length}{' '}
                                    {mealsList.length === 1
                                        ? 'запис'
                                        : mealsList.length >= 2 && mealsList.length <= 4
                                            ? 'записи'
                                            : 'записів'}
                                    )
                                </span>

                                {mealsList.length > 0 ? (
                                    <button
                                        type="button"
                                        onClick={() => setShowMealsDetail((prev) => !prev)}
                                        className="dsm-toggle-meals-btn"
                                    >
                                        {showMealsDetail ? '▲ Згорнути страви' : '▼ Показати страви та прийоми їжі'}
                                    </button>
                                ) : (
                                    <span className="dsm-muted-hint">Записів їжі немає</span>
                                )}
                            </div>

                            {showMealsDetail && groupedMeals.length > 0 && (
                                <div className="dsm-meals-expanded">
                                    {groupedMeals.map((group) => (
                                        <div key={group.key}>
                                            <div className="dsm-meal-group-head">
                                                <span>{group.label}</span>
                                                <span className="dsm-accent-berry">{group.groupKcal} ккал</span>
                                            </div>
                                            <div className="dsm-meal-items-list">
                                                {group.items.map((item) => (
                                                    <div key={item.id} className="dsm-meal-item-row">
                                                        <div>
                                                            <strong>{item.name}</strong>{' '}
                                                            <span className="dsm-item-grams">({item.grams} г)</span>
                                                            <div className="dsm-item-macros">
                                                                Б: {item.proteins}г • Ж: {item.fats}г • В: {item.carbs}г
                                                            </div>
                                                        </div>
                                                        <strong className="dsm-item-kcal">{item.calories} ккал</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 4. САМОПОЧУТТЯ, ЕНЕРГІЯ, АКТИВНІСТЬ ТА СИМПТОМИ */}
                        <div className="dsm-sub-card">
                            <div className="dsm-wellness-header">
                                <span className="dsm-block-label">
                                    🩺 Самопочуття, активність та симптоми
                                </span>
                                {mergedWellness.energyLevel != null && (
                                    <span className="dsm-energy-badge">
                                        ⚡ Енергія: {mergedWellness.energyLevel} / 5
                                    </span>
                                )}
                            </div>

                            <div className="dsm-chips-wrap">
                                {moodObj ? (
                                    <span className="dsm-chip dsm-chip--mood">
                                        {moodObj.emoji} {moodObj.label}
                                    </span>
                                ) : (
                                    <span className="dsm-muted-hint">Настрій не відмічено</span>
                                )}

                                {(activityObj || mergedWellness.activityType) && (
                                    <span className="dsm-chip dsm-chip--activity">
                                        {activityObj?.emoji || '🏃‍♀️'} {activityObj?.label || mergedWellness.activityType}
                                        {mergedWellness.activityMinutes ? ` (${mergedWellness.activityMinutes} хв)` : ''}
                                    </span>
                                )}

                                {symptomObjs.map((sym) => (
                                    <span key={sym.id} className="dsm-chip dsm-chip--symptom">
                                        {sym.emoji} {sym.label}
                                    </span>
                                ))}
                            </div>

                            {mergedWellness.notes && (
                                <div className="dsm-notes-quote">«{mergedWellness.notes}»</div>
                            )}
                        </div>

                        {/* 5. ПРЕПАРАТИ ЗА ДЕНЬ */}
                        {dayMeds.length > 0 && (
                            <div className="dsm-sub-card">
                                <div className="dsm-block-label dsm-block-label--mb">
                                    💊 Препарати ({takenMeds.length} з {dayMeds.length} прийнято)
                                </div>
                                <div className="dsm-chips-wrap">
                                    {takenMeds.map((m) => (
                                        <span key={m.id} className="dsm-med-pill dsm-med-pill--taken">
                                            ✓ {m.name}
                                        </span>
                                    ))}
                                    {pendingMeds.map((m) => (
                                        <span key={m.id} className="dsm-med-pill dsm-med-pill--pending">
                                            ⏳ {m.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 6. ПЕРСОНАЛІЗОВАНІ РЕКОМЕНДАЦІЇ */}
                        <div>
                            <div className="dsm-recs-heading">
                                💡 Персоналізовані рекомендації за цей день ({recommendations.length})
                            </div>

                            <div className="dsm-recs-list">
                                {recommendations.map((rec, idx) => (
                                    <div key={idx} className="dsm-rec-card">
                                        <div className="dsm-rec-title">
                                            {rec.icon} {rec.title}{' '}
                                            <span className="dsm-rec-category">— {rec.category}</span>
                                        </div>
                                        <div className="dsm-rec-text">{rec.text}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* КНОПКИ ДІЙ */}
                        <div className="dsm-footer-actions">
                            {onEditDay && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onEditDay(dateStr);
                                        onClose();
                                    }}
                                    className="dsm-btn-secondary"
                                >
                                    ✏️ Редагувати записи дня
                                </button>
                            )}
                            <button type="button" onClick={onClose} className="dsm-btn-primary">
                                Зрозуміло
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DaySummaryModal;