// frontend/src/components/ProfileCompletionCard.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import './ProfileCompletionCard.css';

const buildChecklistItems = (user) => {
    const items = [
        {
            id: 'weight',
            label: 'Поточна вага (кг)',
            done: Boolean(user?.weight && Number(user.weight) > 0),
        },
        {
            id: 'targetWeight',
            label: 'Цільова вага (кг)',
            done: Boolean(user?.targetWeight && Number(user.targetWeight) > 0),
        },
        {
            id: 'height',
            label: 'Зріст (см)',
            done: Boolean(user?.height && Number(user.height) > 0),
        },
        {
            id: 'age',
            label: 'Вік',
            done: Boolean(user?.age && Number(user.age) > 0),
        },
        {
            id: 'genderAndGoal',
            label: 'Стать, рівень активності та ціль',
            done: Boolean(user?.gender && user?.activityLevel && user?.goal),
        },
    ];

    if (user?.gender !== 'male') {
        items.push({
            id: 'lastPeriodStart',
            label: 'Дата початку останньої менструації',
            done: Boolean(user?.lastPeriodStart),
        });
    }

    return items;
};

/**
 * Модальна пропозиція заповнити профіль для нового користувача при першому вході
 */
export const FirstLoginProfilePrompt = ({ user, theme = 'light', onOpenProfile }) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (!user?.id) return;

        const storageKey = `nutritrack_onboarding_seen_${user.id}`;
        const alreadySeen = localStorage.getItem(storageKey) === '1';
        const isBrandNewProfile = !user.weight && !user.height && !user.age;

        if (!alreadySeen && isBrandNewProfile) {
            setIsOpen(true);
        }
    }, [user]);

    if (!isOpen || !user) return null;

    const handleDismiss = () => {
        localStorage.setItem(`nutritrack_onboarding_seen_${user.id}`, '1');
        setIsOpen(false);
    };

    const handleStartSetup = () => {
        localStorage.setItem(`nutritrack_onboarding_seen_${user.id}`, '1');
        setIsOpen(false);
        onOpenProfile();
    };

    const firstName = user.name ? user.name.split(' ')[0] : '';

    return (
        <div className={`pcc-onboarding-overlay ${theme}`} onClick={handleDismiss}>
            <div
                className="pcc-onboarding-modal"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="onboarding-modal-title"
            >
                <div className="pcc-onboarding-badge">✨ Перший вхід</div>
                <h3 id="onboarding-modal-title" className="pcc-onboarding-title">
                    {firstName ? `Вітаємо в NutriTrack, ${firstName}!` : 'Вітаємо в NutriTrack!'}
                </h3>
                <p className="pcc-onboarding-text">
                    Щоб система могла точно розрахувати вашу індивідуальну норму калорій, КБЖВ,
                    водний баланс та календар циклу, заповніть початкові параметри у профілі.
                </p>

                <div className="pcc-onboarding-actions">
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="pcc-btn-secondary"
                    >
                        Пізніше
                    </button>
                    <button
                        type="button"
                        onClick={handleStartSetup}
                        className="pcc-btn-primary"
                    >
                        Заповнити профіль
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Круговий прогрес заповнення профілю + список з анімованим закресленням і зникненням
 */
const ProfileCompletionCard = ({ user, theme = 'light', onOpenProfile }) => {
    const items = useMemo(() => buildChecklistItems(user), [user]);

    const prevDoneIdsRef = useRef(null);
    const timersRef = useRef({});

    const [animatingIds, setAnimatingIds] = useState([]);
    const [hiddenIds, setHiddenIds] = useState(() =>
        items.filter((item) => item.done).map((item) => item.id)
    );

    useEffect(() => {
        const currentDoneIds = items.filter((item) => item.done).map((item) => item.id);
        const currentDoneSet = new Set(currentDoneIds);

        if (prevDoneIdsRef.current === null) {
            prevDoneIdsRef.current = currentDoneSet;
            setHiddenIds(currentDoneIds);
            return;
        }

        const prevDoneSet = prevDoneIdsRef.current;
        const newlyCompleted = currentDoneIds.filter((id) => !prevDoneSet.has(id));
        const reverted = [...prevDoneSet].filter((id) => !currentDoneSet.has(id));

        if (reverted.length > 0) {
            reverted.forEach((id) => {
                if (timersRef.current[id]) {
                    clearTimeout(timersRef.current[id]);
                    delete timersRef.current[id];
                }
            });
            setAnimatingIds((prev) => prev.filter((id) => !reverted.includes(id)));
            setHiddenIds((prev) => prev.filter((id) => !reverted.includes(id)));
        }

        if (newlyCompleted.length > 0) {
            setHiddenIds((prev) => prev.filter((id) => !newlyCompleted.includes(id)));
            setAnimatingIds((prev) => [...new Set([...prev, ...newlyCompleted])]);

            newlyCompleted.forEach((id) => {
                if (timersRef.current[id]) {
                    clearTimeout(timersRef.current[id]);
                }
                timersRef.current[id] = setTimeout(() => {
                    setAnimatingIds((prev) => prev.filter((itemId) => itemId !== id));
                    setHiddenIds((prev) => [...new Set([...prev, id])]);
                    delete timersRef.current[id];
                }, 1450);
            });
        }

        prevDoneIdsRef.current = currentDoneSet;
    }, [items]);

    useEffect(() => {
        const activeTimers = timersRef.current;
        return () => {
            Object.values(activeTimers).forEach((timerId) => clearTimeout(timerId));
        };
    }, []);

    if (!user) return null;

    const totalCount = items.length;
    const completedCount = items.filter((item) => item.done).length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;
    const isAllCompleted = completedCount === totalCount;

    if (isAllCompleted && animatingIds.length === 0) {
        return null;
    }

    const visibleItems = items.filter((item) => !hiddenIds.includes(item.id));

    const size = 88;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <section
            className={`pcc-card ${theme} ${isAllCompleted ? 'pcc-card--finishing' : ''}`}
            aria-label="Прогрес заповнення профілю"
        >
            <div className="pcc-header">
                <h4 className="pcc-title">Заповнення профілю</h4>
                <span className="pcc-counter">
                    {completedCount} з {totalCount}
                </span>
            </div>

            {/* КРУГОВИЙ ІНДИКАТОР ЗАПОВНЕННЯ */}
            <div className="pcc-ring-wrapper">
                <svg
                    className="pcc-ring-svg"
                    width={size}
                    height={size}
                    viewBox={`0 0 ${size} ${size}`}
                >
                    <circle
                        className="pcc-ring-track"
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                    />
                    <circle
                        className={`pcc-ring-progress ${isAllCompleted ? 'complete' : ''}`}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        strokeWidth={strokeWidth}
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                    />
                </svg>

                <div className="pcc-ring-center">
                    <span className="pcc-ring-percent">{percentage}%</span>
                    <span className="pcc-ring-sub">готово</span>
                </div>
            </div>

            {/* СПИСОК ПУНКТІВ ДЛЯ ЗАПОВНЕННЯ */}
            {visibleItems.length > 0 && (
                <ul className="pcc-checklist">
                    {visibleItems.map((item) => {
                        const isCompleting = animatingIds.includes(item.id);
                        return (
                            <li
                                key={item.id}
                                onClick={!isCompleting ? onOpenProfile : undefined}
                                className={`pcc-item ${isCompleting ? 'pcc-item--completing' : ''}`}
                            >
                                <span className="pcc-item-check" aria-hidden="true">
                                    {isCompleting ? '✓' : ''}
                                </span>
                                <span className="pcc-item-text">{item.label}</span>
                            </li>
                        );
                    })}
                </ul>
            )}

            {!isAllCompleted && (
                <button
                    type="button"
                    onClick={onOpenProfile}
                    className="pcc-open-profile-btn"
                >
                    Заповнити дані профілю
                </button>
            )}
        </section>
    );
};

export default ProfileCompletionCard;