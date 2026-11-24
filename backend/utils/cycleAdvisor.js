// backend/utils/cycleAdvisor.js

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTCDate(dateInput) {
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, d] = dateInput.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d));
    }
    const d = new Date(dateInput);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatUTCKey(dateObj) {
    const y = dateObj.getUTCFullYear();
    const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDaysUTC(dateObj, days) {
    return new Date(dateObj.getTime() + days * MS_PER_DAY);
}

const PHASE_CONTENT = {
    MENSTRUAL: {
        code: 'MENSTRUAL',
        name: 'Менструальна фаза',
        badgeColor: '#e11d48',
        summary: 'Організм оновлюється. Рівень естрогену та прогестерону мінімальний, тому важлива підтримка енергії та заліза.',
        nutrition: 'Додайте продукти, багаті на залізо (гречка, яловичина, печінка, сочевиця, шпинат) разом із вітаміном C для кращого засвоєння. Віддавайте перевагу теплій, легкій їжі.',
        hydration: 'Пийте теплу воду, ромашковий або імбирний чай — це зменшує спазми та втому.',
        activity: 'Оптимальні легка розтяжка, йога для зняття напруги в тазу, неспішна ходьба або повноцінний відпочинок.',
        supplements: 'Зверніть увагу на залізо (якщо призначено лікарем), магній та омега-3 для зменшення дискомфорту.',
    },
    FOLLICULAR: {
        code: 'FOLLICULAR',
        name: 'Фолікулярна фаза',
        badgeColor: '#059669',
        summary: 'Рівень естрогену поступово зростає — повертаються бадьорість, концентрація та гарний настрій.',
        nutrition: 'Чудовий час для складних вуглеводів (кіноа, овес, цільнозернові), якісного білка та ферментованих продуктів (йогурт, кефір, квашена капуста).',
        hydration: 'Дотримуйтесь базової денної норми чистої води для підтримки метаболізму.',
        activity: 'Енергія зростає: сміливо плануйте силові тренування, біг, танці або освоєння нових вправ.',
        supplements: 'Підтримуйте регулярний прийом вітамінів групи B, вітаміну D3 та цинку.',
    },
    OVULATION: {
        code: 'OVULATION',
        name: 'Овуляторна фаза',
        badgeColor: '#d97706',
        summary: 'Пік естрогену та лютеїнізуючого гормону. Максимальна витривалість, соціальна активність та життєвий тонус.',
        nutrition: 'Зробіть акцент на клітковині (броколі, рукола, ягоди, насіння льону) та антиоксидантах — вони допомагають печінці утилізувати надлишок естрогенів.',
        hydration: 'Збільште споживання води на 250–300 мл, особливо у дні інтенсивних тренувань.',
        activity: 'Пік фізичної сили та витривалості: ідеально підходять HIIT, інтенсивне кардіо та робота з робочими вагами.',
        supplements: 'Антиоксиданти (вітамін E, C), клітковина та звичний графік прийому вітамінів.',
    },
    LUTEAL: {
        code: 'LUTEAL',
        name: 'Лютеїнова фаза',
        badgeColor: '#7c3aed',
        summary: 'Домінує прогестерон. Метаболізм трохи прискорюється, але можливі чутливість грудей, набряки або тяга до солодкого.',
        nutrition: 'Включіть магній і вітамін B6 (гарбузове насіння, авокадо, банан, темний шоколад 75%+, риба). Їжте регулярно, щоб уникати стрибків цукру та нападів голоду.',
        hydration: 'Не зменшуйте кількість води: достатня гідратація, навпаки, допомагає зменшити затримку рідини. Обмежте надлишок солі.',
        activity: 'У першій половині фази — помірні силові чи плавання; ближче до кінця циклу переходьте на пілатес, барре та прогулянки.',
        supplements: 'Магній гліцинат або цитрат увечері та вітамін B6 допомагають згладити прояви ПМС і покращують сон.',
    },
};

const SYMPTOM_TIPS = {
    CRAMPS: 'При спазмах у животі допоможе теплий компрес, магній, відмова від надлишку кофеїну та легка розтяжка попереку.',
    HEADACHE: 'При головному болю перевірте водний баланс, не пропускайте прийоми їжі та зменште екранне навантаження.',
    BLOATING: 'При набряках і здутті додайте продукти з калієм (авокадо, шпинат, печена картопля) та пийте достатньо чистої води.',
    FATIGUE: 'При втомі зробіть акцент на білку, складних вуглеводах і залізовмісних продуктах; замініть важке тренування на прогулянку.',
    CRAVINGS: 'Тяга до солодкого — сигнал нестачі магнію або великих перерв між їжею. Спробуйте темний шоколад із горіхами або ягодами.',
    MOOD_SWINGS: 'При перепадах настрою важливі стабільний рівень глюкози (білок + клітковина в кожному прийомі їжі) та 7–8 годин сну.',
    ACNE: 'При висипаннях тимчасово зменште швидкі цукри та додайте продукти з цинком і омега-3 (лосось, волоські горіхи).',
};

function calculateCycleInsights({ lastPeriodStart, cycleLength = 28, periodLength = 5, targetDateStr, symptoms = [] }) {
    const targetDate = targetDateStr ? toUTCDate(targetDateStr) : toUTCDate(new Date());
    const safeCycleLen = Math.min(45, Math.max(20, Number(cycleLength) || 28));
    const safePeriodLen = Math.min(10, Math.max(2, Number(periodLength) || 5));

    if (!lastPeriodStart) {
        return {
            configured: false,
            targetDate: formatUTCKey(targetDate),
            cycleDay: null,
            cycleLength: safeCycleLen,
            periodLength: safePeriodLen,
            phase: {
                code: 'UNKNOWN',
                name: 'Цикл ще не налаштовано',
                badgeColor: '#64748b',
                summary: 'Вкажіть дату початку останньої менструації в календарі циклу, щоб бачити поточну фазу, прогноз та персональні поради.',
                nutrition: 'Дотримуйтесь збалансованого раціону з акцентом на цільні продукти, білок та овочі.',
                hydration: 'Підтримуйте вашу денну норму води рівномірно протягом дня.',
                activity: 'Чергуйте силові чи кардіо тренування з днями відновлення.',
                supplements: 'Відмічайте щоденний прийом вітамінів або препаратів у вкладці «Календар циклу».',
            },
            predictions: null,
            symptomAdvice: symptoms.map((s) => SYMPTOM_TIPS[s]).filter(Boolean),
        };
    }

    const startUTC = toUTCDate(lastPeriodStart);
    const diffDays = Math.floor((targetDate.getTime() - startUTC.getTime()) / MS_PER_DAY);

    // Якщо обрана дата в поточному або наступному циклі — рахуємо циклічний день, але зберігаємо фактичний день поточного циклу
    const rawCycleDay = diffDays >= 0 ? diffDays + 1 : 1;
    const normalizedDay = diffDays >= 0 ? (diffDays % safeCycleLen) + 1 : 1;
    const isDelayed = rawCycleDay > safeCycleLen && rawCycleDay <= safeCycleLen + 14;

    const ovulationDay = Math.max(safePeriodLen + 2, safeCycleLen - 14);
    const fertileStartDay = Math.max(safePeriodLen + 1, ovulationDay - 4);
    const fertileEndDay = Math.min(safeCycleLen, ovulationDay + 1);

    let phaseKey = 'FOLLICULAR';
    if (isDelayed) {
        phaseKey = 'LUTEAL';
    } else if (normalizedDay <= safePeriodLen) {
        phaseKey = 'MENSTRUAL';
    } else if (normalizedDay < ovulationDay - 1) {
        phaseKey = 'FOLLICULAR';
    } else if (normalizedDay <= ovulationDay + 1) {
        phaseKey = 'OVULATION';
    } else {
        phaseKey = 'LUTEAL';
    }

    const cycleOffsetIndex = diffDays >= 0 ? Math.floor(diffDays / safeCycleLen) : 0;
    const currentCycleStart = isDelayed ? startUTC : addDaysUTC(startUTC, cycleOffsetIndex * safeCycleLen);
    const nextPeriodStart = addDaysUTC(currentCycleStart, safeCycleLen);
    const nextPeriodEnd = addDaysUTC(nextPeriodStart, safePeriodLen - 1);
    const ovulationDate = addDaysUTC(currentCycleStart, ovulationDay - 1);
    const fertileStart = addDaysUTC(currentCycleStart, fertileStartDay - 1);
    const fertileEnd = addDaysUTC(currentCycleStart, fertileEndDay - 1);

    const daysUntilNextPeriod = Math.ceil((nextPeriodStart.getTime() - targetDate.getTime()) / MS_PER_DAY);
    const symptomAdvice = (Array.isArray(symptoms) ? symptoms : [])
        .map((code) => SYMPTOM_TIPS[code])
        .filter(Boolean);

    return {
        configured: true,
        targetDate: formatUTCKey(targetDate),
        cycleDay: isDelayed ? rawCycleDay : normalizedDay,
        isDelayed,
        cycleLength: safeCycleLen,
        periodLength: safePeriodLen,
        phase: PHASE_CONTENT[phaseKey],
        predictions: {
            nextPeriodStart: formatUTCKey(nextPeriodStart),
            nextPeriodEnd: formatUTCKey(nextPeriodEnd),
            ovulationDate: formatUTCKey(ovulationDate),
            fertileWindowStart: formatUTCKey(fertileStart),
            fertileWindowEnd: formatUTCKey(fertileEnd),
            daysUntilNextPeriod,
        },
        symptomAdvice,
    };
}

function calculateCocStatus(medication, targetDateStr) {
    if (!medication || medication.category !== 'COC' || !medication.packStart) {
        return null;
    }

    const targetDate = targetDateStr ? toUTCDate(targetDateStr) : toUTCDate(new Date());
    const packStart = toUTCDate(medication.packStart);
    const diffDays = Math.floor((targetDate.getTime() - packStart.getTime()) / MS_PER_DAY);

    const scheme = medication.cocScheme || '21/7';
    const totalPackDays = scheme === '24/4' ? 28 : scheme === '28' ? 28 : 28;
    const activePills = scheme === '24/4' ? 24 : scheme === '28' ? 28 : 21;

    if (diffDays < 0) {
        return { pillNumber: 1, totalPackDays, activePills, isBreakDay: false, scheme };
    }

    const pillNumber = (diffDays % totalPackDays) + 1;
    const isBreakDay = pillNumber > activePills;

    return {
        pillNumber,
        totalPackDays,
        activePills,
        isBreakDay,
        scheme,
        statusLabel: isBreakDay
            ? `Перерва / плацебо (день ${pillNumber - activePills} із ${totalPackDays - activePills})`
            : `Активна таблетка ${pillNumber} із ${activePills}`,
    };
}

function calculateCycleAverages(periods = [], defaultCycleLength = 28, defaultPeriodLength = 5) {
    const validList = (Array.isArray(periods) ? periods : [])
        .filter((p) => p && p.startDate)
        .map((p) => {
            const start = toUTCDate(p.startDate);
            const end = p.endDate
                ? toUTCDate(p.endDate)
                : addDaysUTC(start, Math.max(0, (defaultPeriodLength || 5) - 1));
            return { start, end: end >= start ? end : start };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime());

    // 1. Об'єднуємо відрізки з розривом ≤ 3 днів
    const episodes = [];
    for (const item of validList) {
        const last = episodes[episodes.length - 1];
        if (last) {
            const gapDays = Math.round((item.start.getTime() - last.end.getTime()) / MS_PER_DAY);
            if (gapDays <= 3) {
                const addedDays = Math.round((item.end.getTime() - item.start.getTime()) / MS_PER_DAY) + 1;
                last.end = item.end > last.end ? item.end : last.end;
                last.bleedingDays += addedDays;
                continue;
            }
        }
        const days = Math.round((item.end.getTime() - item.start.getTime()) / MS_PER_DAY) + 1;
        episodes.push({ start: item.start, end: item.end, bleedingDays: days });
    }

    // 2. Середня тривалість менструації (1–14 днів)
    const periodDurations = episodes
        .map((ep) => ep.bleedingDays)
        .filter((d) => d >= 1 && d <= 14);

    const isPeriodAuto = periodDurations.length > 0;
    const avgPeriodLength = isPeriodAuto
        ? Math.round(periodDurations.reduce((sum, d) => sum + d, 0) / periodDurations.length)
        : defaultPeriodLength || 5;

    // 3. Середня тривалість циклу (18–60 днів)
    const cycleIntervals = [];
    for (let i = 1; i < episodes.length; i++) {
        const diffDays = Math.round(
            (episodes[i].start.getTime() - episodes[i - 1].start.getTime()) / MS_PER_DAY
        );
        if (diffDays >= 18 && diffDays <= 60) {
            cycleIntervals.push(diffDays);
        }
    }

    const isCycleAuto = cycleIntervals.length > 0;
    const avgCycleLength = isCycleAuto
        ? Math.round(cycleIntervals.reduce((sum, d) => sum + d, 0) / cycleIntervals.length)
        : defaultCycleLength || 28;

    // 4. Перевірка відхилень останнього циклу та менструації
    const deviations = [];

    if (cycleIntervals.length > 0) {
        const latestCycle = cycleIntervals[cycleIntervals.length - 1];
        const baselineCycle =
            cycleIntervals.length >= 2
                ? Math.round(
                    cycleIntervals.slice(0, -1).reduce((s, d) => s + d, 0) /
                    (cycleIntervals.length - 1)
                )
                : defaultCycleLength || 28;

        const diff = latestCycle - baselineCycle;
        if (Math.abs(diff) >= 5) {
            deviations.push({
                type: 'cycle_shift',
                title: diff > 0 ? 'Подовження останнього циклу' : 'Скорочення останнього циклу',
                message: `Останній цикл тривав ${latestCycle} дн. (на ${Math.abs(diff)} дн. ${
                    diff > 0 ? 'довше' : 'коротше'
                } за ваш звичний показник у ${baselineCycle} дн.). Це може бути пов’язано зі стресом, зміною режиму сну чи навантажень.`,
            });
        } else if (latestCycle < 21 || latestCycle > 35) {
            deviations.push({
                type: 'cycle_range',
                title: 'Нетипова тривалість циклу',
                message: `Останній цикл становив ${latestCycle} дн. (звичайний діапазон — 21–35 днів). Якщо це повторюється кілька циклів поспіль, варто проконсультуватися з лікарем.`,
            });
        }
    }

    if (periodDurations.length > 0) {
        const latestPeriod = periodDurations[periodDurations.length - 1];
        const baselinePeriod =
            periodDurations.length >= 2
                ? Math.round(
                    periodDurations.slice(0, -1).reduce((s, d) => s + d, 0) /
                    (periodDurations.length - 1)
                )
                : defaultPeriodLength || 5;

        const periodDiff = latestPeriod - baselinePeriod;
        if (latestPeriod >= 8) {
            deviations.push({
                type: 'period_long',
                title: 'Тривала менструація',
                message: `Остання менструація триває ${latestPeriod} дн. (зазвичай 3–7 днів). Слідкуйте за рівнем енергії та самопочуттям.`,
            });
        } else if (Math.abs(periodDiff) >= 3 && periodDurations.length >= 2) {
            deviations.push({
                type: 'period_shift',
                title: 'Зміна тривалості менструації',
                message: `Остання менструація тривала ${latestPeriod} дн. замість звичних ${baselinePeriod} дн.`,
            });
        }
    }

    return {
        avgCycleLength,
        avgPeriodLength,
        cyclesSampleCount: cycleIntervals.length,
        periodsSampleCount: periodDurations.length,
        isCycleAuto,
        isPeriodAuto,
        deviations,
    };
}

module.exports = {
    toUTCDate,
    formatUTCKey,
    addDaysUTC,
    calculateCycleInsights,
    calculateCocStatus,
    calculateCycleAverages,
};