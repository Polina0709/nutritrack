// frontend/src/components/WellnessTrendsSection.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    ReferenceLine,
} from 'recharts';
import { SYMPTOM_OPTIONS, formatReadableDate } from '../constants/wellnessOptions';
import './WellnessTrendsSection.css';

const RANGE_OPTIONS = [
    { days: 7, label: '7 днів' },
    { days: 30, label: '30 днів' },
];

const WellnessTrendsSection = ({ theme = 'light', refreshTrigger = 0 }) => {
    const [days, setDays] = useState(30);
    const [activeView, setActiveView] = useState('charts'); // 'charts' | 'phases'
    const [trends, setTrends] = useState(null);
    const [loading, setLoading] = useState(false);

    const isDark = theme === 'dark';
    const chartPalette = {
        gridStroke: isDark ? '#3d3147' : '#f4c6d7',
        axisTick: isDark ? '#bfa6b4' : '#7c5667',
        tooltipBg: isDark ? '#141118' : '#ffffff',
        tooltipText: isDark ? '#f8eef3' : '#2b2328',
        tooltipBorder: isDark ? '#3d3147' : '#f4c6d7',
        berry: isDark ? '#f472b6' : '#c83768',
        purple: isDark ? '#c084fc' : '#7e22ce',
        water: isDark ? '#38bdf8' : '#0284c7',
        olive: isDark ? '#8ab85c' : '#4a6b2c',
    };

    useEffect(() => {
        let cancelled = false;
        const fetchTrends = async () => {
            setLoading(true);
            try {
                const res = await axios.get('/api/analytics/trends', { params: { days } });
                if (!cancelled) setTrends(res.data);
            } catch (err) {
                console.error('Помилка завантаження трендів:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchTrends();
        return () => {
            cancelled = true;
        };
    }, [days, refreshTrigger]);

    const resolveSymptom = (symId) =>
        SYMPTOM_OPTIONS.find((s) => String(s.id) === String(symId)) || {
            id: symId,
            emoji: '•',
            label: String(symId),
        };

    const topSymptoms = (trends?.topSymptoms || []).slice(0, 6);
    const maxSymptomCount = topSymptoms[0]?.count || 1;

    return (
        <section className={`wellness-trends-section ${theme}`}>
            {/* ШАПКА ТА ПЕРЕМИКАЧІ ПЕРІОДУ / РЕЖИМУ */}
            <div className="wts-header">
                <div>
                    <h3 className="wts-title">📈 Довгострокові тренди та аналітика циклу</h3>
                    <div className="wts-subtitle">
                        Динаміка калорій з урахуванням активності, водного балансу та повторюваності симптомів
                    </div>
                </div>

                <div className="wts-controls">
                    <div className="wts-seg-group">
                        {RANGE_OPTIONS.map((opt) => (
                            <button
                                key={opt.days}
                                type="button"
                                onClick={() => setDays(opt.days)}
                                className={`wts-seg-btn ${days === opt.days ? 'active-berry' : ''}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="wts-seg-group">
                        <button
                            type="button"
                            onClick={() => setActiveView('charts')}
                            className={`wts-seg-btn ${activeView === 'charts' ? 'active-purple' : ''}`}
                        >
                            Графіки та симптоми
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveView('phases')}
                            className={`wts-seg-btn ${activeView === 'phases' ? 'active-purple' : ''}`}
                        >
                            🌸 По фазах циклу
                        </button>
                    </div>
                </div>
            </div>

            {loading && !trends ? (
                <div className="wts-loading">Формування аналітики...</div>
            ) : (
                trends && (
                    <>
                        {/* ЗВЕДЕНІ КАРТКИ СЕРЕДНІХ ПОКАЗНИКІВ */}
                        <div className="wts-summary-grid">
                            <div className="wts-summary-tile">
                                <div className="wts-tile-label">Середня калорійність ({days} дн.)</div>
                                <div className="wts-tile-value wts-berry-text">
                                    {trends.avgCalories} ккал / день
                                </div>
                                <div className="wts-tile-sub">
                                    Базова норма: {trends.baseCalorieGoal} ккал ({trends.loggedCalorieDaysCount} дн. із записами)
                                </div>
                            </div>

                            <div className="wts-summary-tile">
                                <div className="wts-tile-label">Середній водний баланс</div>
                                <div className="wts-tile-value wts-water-text">
                                    {trends.avgWaterMl} мл / день
                                </div>
                                <div className="wts-tile-sub">
                                    Ціль: {trends.waterGoal} мл ({trends.loggedWaterDaysCount} дн. із записами)
                                </div>
                            </div>

                            <div className="wts-summary-tile">
                                <div className="wts-tile-label">Найчастіший симптом</div>
                                <div className="wts-tile-value wts-tile-value--symptom wts-purple-text">
                                    {topSymptoms[0]
                                        ? `${resolveSymptom(topSymptoms[0].id).emoji} ${resolveSymptom(topSymptoms[0].id).label}`
                                        : 'Не зафіксовано'}
                                </div>
                                <div className="wts-tile-sub">
                                    {topSymptoms[0]
                                        ? `Відмічено ${topSymptoms[0].count} раз(ів) за ${days} дн.`
                                        : 'Без скарг за обраний період'}
                                </div>
                            </div>
                        </div>

                        {activeView === 'charts' ? (
                            <div className="wts-charts-stack">
                                {/* 1. ГРАФІК КАЛОРІЙ ТА АДАПТИВНОЇ НОРМИ */}
                                <div className="wts-sub-card">
                                    <div className="wts-chart-header">
                                        <span className="wts-card-heading">
                                            🍽️ Спожиті калорії та адаптована норма (ккал)
                                        </span>
                                        <span className="wts-chart-legend">
                                            Ягідна лінія — факт • Фіолетова пунктирна — норма з урахуванням спорту та фази
                                        </span>
                                    </div>
                                    <div className="wts-chart-wrap-lg">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart
                                                data={trends.dailySeries}
                                                margin={{ top: 10, right: 14, left: -12, bottom: 0 }}
                                            >
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
                                                />
                                                <Tooltip
                                                    labelFormatter={(label, payload) =>
                                                        payload?.[0]?.payload?.date
                                                            ? `${formatReadableDate(payload[0].payload.date)} (${payload[0].payload.phaseName})`
                                                            : label
                                                    }
                                                    formatter={(val, name) => [
                                                        `${val} ккал`,
                                                        name === 'calories' ? 'Факт' : 'Адаптивна норма',
                                                    ]}
                                                    contentStyle={{
                                                        background: chartPalette.tooltipBg,
                                                        color: chartPalette.tooltipText,
                                                        borderRadius: '14px',
                                                        border: `1px solid ${chartPalette.tooltipBorder}`,
                                                        fontSize: '12px',
                                                    }}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="targetCalories"
                                                    stroke={chartPalette.purple}
                                                    strokeWidth={1.8}
                                                    strokeDasharray="4 4"
                                                    dot={false}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="calories"
                                                    stroke={chartPalette.berry}
                                                    strokeWidth={2.5}
                                                    dot={{ r: 3, fill: chartPalette.berry }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* 2. ГРАФІК ВОДИ ТА ЧАСТОТА СИМПТОМІВ */}
                                <div className="wts-two-col-grid">
                                    <div className="wts-sub-card">
                                        <div className="wts-card-heading wts-card-heading--mb">
                                            💧 Водний баланс (мл / день)
                                        </div>
                                        <div className="wts-chart-wrap-md">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart
                                                    data={trends.dailySeries}
                                                    margin={{ top: 10, right: 10, left: -12, bottom: 0 }}
                                                >
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
                                                    />
                                                    <Tooltip
                                                        formatter={(val) => [`${val} мл`, 'Вода']}
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
                                                        y={trends.waterGoal}
                                                        stroke={chartPalette.olive}
                                                        strokeDasharray="4 4"
                                                    />
                                                    <Bar
                                                        dataKey="waterMl"
                                                        fill={chartPalette.water}
                                                        radius={[6, 6, 0, 0]}
                                                    />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    <div className="wts-sub-card">
                                        <div className="wts-card-heading wts-card-heading--mb-lg">
                                            🩺 Частота симптомів за {days} днів
                                        </div>

                                        {topSymptoms.length === 0 ? (
                                            <div className="wts-empty-symptoms">
                                                За обраний період симптоми ще не відмічалися.
                                            </div>
                                        ) : (
                                            <div className="wts-symptoms-list">
                                                {topSymptoms.map((item) => {
                                                    const sym = resolveSymptom(item.id);
                                                    const pct = Math.round((item.count / maxSymptomCount) * 100);
                                                    return (
                                                        <div key={item.id}>
                                                            <div className="wts-symptom-row">
                                                                <span>
                                                                    {sym.emoji} <strong>{sym.label}</strong>
                                                                </span>
                                                                <span className="wts-symptom-count">
                                                                    {item.count} дн.
                                                                </span>
                                                            </div>
                                                            <div className="wts-symptom-track">
                                                                <div
                                                                    className="wts-symptom-fill"
                                                                    style={{ width: `${pct}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* АНАЛІТИКА ПО ФАЗАХ ЦИКЛУ */
                            <div className="wts-phases-grid">
                                {(trends.byPhase || []).map((p) => {
                                    const topSym = p.topSymptomId ? resolveSymptom(p.topSymptomId) : null;
                                    return (
                                        <div
                                            key={p.phaseKey}
                                            className="wts-phase-card"
                                            style={{ borderTopColor: p.color }}
                                        >
                                            <div
                                                className="wts-phase-title"
                                                style={{ color: p.color }}
                                            >
                                                {p.phaseName}
                                            </div>

                                            <div className="wts-phase-stat-row">
                                                <span className="wts-phase-stat-label">Середні калорії:</span>
                                                <strong>
                                                    {p.avgCalories != null ? `${p.avgCalories} ккал` : '—'}
                                                </strong>
                                            </div>

                                            <div className="wts-phase-stat-row">
                                                <span className="wts-phase-stat-label">Середня вода:</span>
                                                <strong>
                                                    {p.avgWaterMl != null ? `${p.avgWaterMl} мл` : '—'}
                                                </strong>
                                            </div>

                                            <div className="wts-phase-stat-row">
                                                <span className="wts-phase-stat-label">Рівень енергії:</span>
                                                <strong>
                                                    {p.avgEnergy != null ? `${p.avgEnergy} / 5 ⚡` : '—'}
                                                </strong>
                                            </div>

                                            <div className="wts-phase-footer">
                                                Частий симптом:{' '}
                                                <strong className="wts-phase-sym-val">
                                                    {topSym
                                                        ? `${topSym.emoji} ${topSym.label} (${p.topSymptomCount})`
                                                        : 'немає'}
                                                </strong>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )
            )}
        </section>
    );
};

export default WellnessTrendsSection;