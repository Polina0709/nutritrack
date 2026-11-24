// frontend/src/App.jsx
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import axios from 'axios';
import ProfileModal from './components/ProfileModal';
import HomeOverviewTab from './components/HomeOverviewTab';
import FoodWaterTab from './components/FoodWaterTab';
import CycleCalendarTab from './components/CycleCalendarTab';
import MyFoodsRecipesSection from './components/MyFoodsRecipesSection';
import DailyAlertsBar from './components/DailyAlertsBar';
import BrowserReminderManager from './components/BrowserReminderManager';
import { getTodayLocalStr, formatReadableDate } from './constants/wellnessOptions';
import './App.css';

const TABS = [
    { id: 'home', label: '📊 Головна' },
    { id: 'diary', label: '🍽️ Щоденник та вода' },
    { id: 'cycle', label: '🌸 Календар циклу' },
    { id: 'library', label: '🥗 Продукти та рецепти' },
];

const SPARKLES = [
    { id: 'tl-1', top: '6%', left: '16%', size: 42 },
    { id: 'tl-2', top: '13%', left: '22%', size: 24 },
    { id: 'tr-1', top: '19%', right: '8%', size: 36 },
    { id: 'tr-2', top: '24%', right: '13%', size: 22 },
    { id: 'ml-1', top: '49%', left: '15%', size: 26 },
    { id: 'br-1', bottom: '36%', right: '19%', size: 36 },
    { id: 'br-2', bottom: '41%', right: '12%', size: 24 },
    { id: 'bl-1', bottom: '25%', left: '5%', size: 24 },
    { id: 'bl-2', bottom: '13%', left: '16%', size: 36 },
    { id: 'bt-1', bottom: '3%', right: '5%', size: 34 },
    { id: 'bt-2', bottom: '0.5%', right: '18%', size: 22 },
];

const SparkleIcon = ({ size }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        <path
            d="M20 0C20.9 12.8 27.2 19.1 40 20C27.2 20.9 20.9 27.2 20 40C19.1 27.2 12.8 20.9 0 20C12.8 19.1 19.1 12.8 20 0Z"
            fill="currentColor"
        />
    </svg>
);

const SunIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <line x1="12" y1="2" x2="12" y2="4.5" />
        <line x1="12" y1="19.5" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="6.7" y2="6.7" />
        <line x1="17.3" y1="17.3" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="4.5" y2="12" />
        <line x1="19.5" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="6.7" y2="17.3" />
        <line x1="17.3" y1="6.7" x2="19.07" y2="4.93" />
    </svg>
);

const MoonIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

const LogoutIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

const MenuIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
        <line x1="3.5" y1="6.5" x2="20.5" y2="6.5" />
        <line x1="3.5" y1="12" x2="20.5" y2="12" />
        <line x1="3.5" y1="17.5" x2="20.5" y2="17.5" />
    </svg>
);

const CloseIcon = () => (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true">
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
);

const AuthLoadingScreen = () => (
    <div className="auth-loading-screen" aria-busy="true" aria-label="Завантаження NutriTrack">
        <span className="auth-loading-brand">NutriTrack</span>
    </div>
);

const AuthLandingScreen = () => (
    <div className="auth-landing">
        <div className="auth-stripes-panel" aria-hidden="true" />

        <div className="auth-content-panel">
            <div className="auth-sparkles-layer" aria-hidden="true">
                {SPARKLES.map((star) => (
                    <span
                        key={star.id}
                        className="auth-sparkle"
                        style={{
                            top: star.top,
                            bottom: star.bottom,
                            left: star.left,
                            right: star.right,
                        }}
                    >
                        <SparkleIcon size={star.size} />
                    </span>
                ))}
            </div>

            <div className="auth-hero-box">
                <h1 className="auth-brand-title">NutriTrack</h1>
                <p className="auth-subtitle">
                    Персональний щоденник харчування, водного балансу та жіночого здоров'я
                </p>
                <a href="/auth/google" className="auth-google-btn">
                    Увійти через Google
                </a>
            </div>
        </div>
    </div>
);

const DashboardShell = ({ user, theme, onOpenProfile, refreshTrigger, bumpRefresh }) => {
    const [activeTab, setActiveTab] = useState('home');
    const [selectedDate, setSelectedDate] = useState(() => getTodayLocalStr());

    if (!user) {
        return <AuthLandingScreen />;
    }

    return (
        <div className="dashboard-shell">
            {/* ПАНЕЛЬ НАВІГАЦІЇ ПО 4 ВКЛАДКАХ */}
            <div className="dashboard-tabs">
                {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`dashboard-tab-btn ${isActive ? 'active' : ''}`}
                        >
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* МЕНЕДЖЕР БРАУЗЕРНИХ PUSH-СПОВІЩЕНЬ (КОК, ВІТАМІНИ ТА ВОДА) */}
            <BrowserReminderManager
                user={user}
                theme={theme}
                refreshTrigger={refreshTrigger}
            />

            {/* ПАНЕЛЬ ПОПЕРЕДЖЕНЬ (ПЕРЕВИЩЕННЯ НОРМИ ВОДИ ТА НАГАДУВАННЯ ПРО ПРЕПАРАТИ) */}
            <DailyAlertsBar
                theme={theme}
                selectedDate={selectedDate}
                waterGoal={user.waterGoal || 2000}
                refreshTrigger={refreshTrigger}
                onMedicationChanged={bumpRefresh}
            />

            {/* ВМІСТ АКТИВНОЇ ВКЛАДКИ */}
            {activeTab === 'home' && (
                <HomeOverviewTab
                    user={user}
                    theme={theme}
                    onOpenProfile={onOpenProfile}
                    onNavigateTab={setActiveTab}
                    refreshTrigger={refreshTrigger}
                    onDataChanged={bumpRefresh}
                />
            )}

            {activeTab === 'diary' && (
                <FoodWaterTab
                    user={user}
                    theme={theme}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onDataChanged={bumpRefresh}
                    refreshTrigger={refreshTrigger}
                />
            )}

            {activeTab === 'cycle' && (
                <CycleCalendarTab
                    theme={theme}
                    selectedDate={selectedDate}
                    onDateChange={setSelectedDate}
                    onCycleDataChanged={bumpRefresh}
                />
            )}

            {activeTab === 'library' && (
                <div className="library-tab-container">
                    <div className="library-tab-date-bar">
                        <span>
                            Швидке додавання у щоденник застосовується до дати:{' '}
                            <strong>{formatReadableDate(selectedDate)}</strong>
                        </span>
                    </div>
                    <MyFoodsRecipesSection
                        theme={theme}
                        selectedDate={selectedDate}
                        onAddedToDiary={bumpRefresh}
                    />
                </div>
            )}
        </div>
    );
};

function App() {
    const [theme, setTheme] = useState(() => localStorage.getItem('app-theme') || 'light');
    const [user, setUser] = useState(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchUser = () => {
        axios
            .get('/api/user')
            .then((res) => setUser(res.data.user))
            .catch(() => setUser(null))
            .finally(() => setIsAuthLoading(false));
    };

    const bumpRefresh = () => {
        setRefreshTrigger((prev) => prev + 1);
        fetchUser();
    };

    useEffect(() => {
        fetchUser();
    }, []);

    useEffect(() => {
        document.body.className = theme;
        localStorage.setItem('app-theme', theme);
    }, [theme]);

    useEffect(() => {
        if (!isMobileMenuOpen) return;

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsMobileMenuOpen(false);
            }
        };

        const handleResize = () => {
            if (window.innerWidth > 900) {
                setIsMobileMenuOpen(false);
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleResize);

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleResize);
        };
    }, [isMobileMenuOpen]);

    const handleProfileUpdateSuccess = (updatedUser) => {
        setUser(updatedUser);
        setIsProfileOpen(false);
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleOpenProfileFromDrawer = () => {
        setIsMobileMenuOpen(false);
        setIsProfileOpen(true);
    };

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const isDark = theme === 'dark';

    return (
        <Router>
            <div className={`app-container ${theme} ${!isAuthLoading && !user ? 'app-container--guest' : ''}`}>
                {isAuthLoading ? (
                    <AuthLoadingScreen />
                ) : (
                    <>
                        {user && (
                            <>
                                <header className="app-header-wrapper">
                                    <nav className="app-navbar" aria-label="Головна навігація">
                                        {/* КЛІКАБЕЛЬНИЙ ЛОГОТИП (ЗЛІВА НА ДЕСКТОПІ, ПО ЦЕНТРУ НА МОБІЛЬНИХ) */}
                                        <a href="/" className="app-brand" title="На головну сторінку">
                                            <h1 className="app-brand-title">NutriTrack</h1>
                                            <span className="app-brand-sparkles" aria-hidden="true">
                                                <span className="app-brand-sparkle-sm">
                                                    <SparkleIcon size={14} />
                                                </span>
                                                <span className="app-brand-sparkle-lg">
                                                    <SparkleIcon size={22} />
                                                </span>
                                            </span>
                                        </a>

                                        {/* ЦЕНТРАЛЬНА ПАНЕЛЬ НАВІГАЦІЇ ПО СТОРІНКАХ (ДЕСКТОП) */}
                                        <div className="header-center-nav">
                                            <a href="/about.html" className="header-center-link">
                                                Про проєкт
                                            </a>

                                            <a href="/catalog" className="header-center-link">
                                                Каталог
                                            </a>

                                            {user.role === 'ADMIN' && (
                                                <a href="/admin" className="header-center-link header-center-link--admin">
                                                    Адмін-панель
                                                </a>
                                            )}
                                        </div>

                                        {/* ПРАВА ЧАСТИНА: ТЕМА, ПРОФІЛЬ, ВИХІД (ДЕСКТОП) */}
                                        <div className="nav-links">
                                            <button
                                                type="button"
                                                onClick={toggleTheme}
                                                className="header-circle-btn"
                                                title={isDark ? 'Увімкнути світлу тему' : 'Увімкнути темну тему'}
                                                aria-label="Перемкнути тему"
                                            >
                                                {theme === 'light' ? <SunIcon /> : <MoonIcon />}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setIsProfileOpen(true)}
                                                className="profile-trigger-btn"
                                            >
                                                Налаштування профілю
                                            </button>

                                            <a
                                                href="/auth/logout"
                                                className="header-circle-btn logout-circle-btn"
                                                title="Вийти з акаунту"
                                                aria-label="Вийти з акаунту"
                                            >
                                                <LogoutIcon />
                                            </a>
                                        </div>

                                        {/* КНОПКА БОКОВОГО МЕНЮ (ТРИ ПОЛОСИ СПРАВА НА МОБІЛЬНИХ) */}
                                        <button
                                            type="button"
                                            onClick={() => setIsMobileMenuOpen(true)}
                                            className="header-circle-btn mobile-menu-toggle-btn"
                                            aria-label="Відкрити меню"
                                            aria-expanded={isMobileMenuOpen}
                                            aria-controls="mobile-nav-drawer"
                                        >
                                            <MenuIcon />
                                        </button>
                                    </nav>
                                </header>

                                {/* МОБІЛЬНЕ БОКОВЕ МЕНЮ (DRAWER) */}
                                <div
                                    className={`mobile-drawer-backdrop ${isMobileMenuOpen ? 'open' : ''}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    aria-hidden="true"
                                />

                                <aside
                                    id="mobile-nav-drawer"
                                    className={`mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}
                                    aria-label="Мобільне меню"
                                    aria-hidden={!isMobileMenuOpen}
                                >
                                    <div className="mobile-drawer-header">
                                        <span className="mobile-drawer-brand">NutriTrack</span>
                                        <button
                                            type="button"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="header-circle-btn"
                                            aria-label="Закрити меню"
                                        >
                                            <CloseIcon />
                                        </button>
                                    </div>

                                    <div className="mobile-drawer-body">
                                        <div className="mobile-drawer-group">
                                            <span className="mobile-drawer-label">Навігація</span>
                                            <a
                                                href="/about.html"
                                                className="mobile-drawer-link"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                Про проєкт
                                            </a>
                                            <a
                                                href="/catalog"
                                                className="mobile-drawer-link"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                Каталог
                                            </a>
                                            {user.role === 'ADMIN' && (
                                                <a
                                                    href="/admin"
                                                    className="mobile-drawer-link mobile-drawer-link--admin"
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    Адмін-панель
                                                </a>
                                            )}
                                        </div>

                                        <div className="mobile-drawer-divider" />

                                        <div className="mobile-drawer-group">
                                            <span className="mobile-drawer-label">Керування</span>
                                            <button
                                                type="button"
                                                onClick={handleOpenProfileFromDrawer}
                                                className="mobile-drawer-profile-btn"
                                            >
                                                Налаштування профілю
                                            </button>

                                            <button
                                                type="button"
                                                onClick={toggleTheme}
                                                className="mobile-drawer-action-btn"
                                            >
                                                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
                                                <span>{isDark ? 'Світла тема' : 'Темна тема'}</span>
                                            </button>

                                            <a
                                                href="/auth/logout"
                                                className="mobile-drawer-action-btn mobile-drawer-logout-btn"
                                            >
                                                <LogoutIcon />
                                                <span>Вийти з акаунту</span>
                                            </a>
                                        </div>
                                    </div>
                                </aside>
                            </>
                        )}

                        <main className="app-main">
                            <Routes>
                                <Route
                                    path="/"
                                    element={
                                        <DashboardShell
                                            user={user}
                                            theme={theme}
                                            onOpenProfile={() => setIsProfileOpen(true)}
                                            refreshTrigger={refreshTrigger}
                                            bumpRefresh={bumpRefresh}
                                        />
                                    }
                                />
                                <Route
                                    path="*"
                                    element={
                                        <DashboardShell
                                            user={user}
                                            theme={theme}
                                            onOpenProfile={() => setIsProfileOpen(true)}
                                            refreshTrigger={refreshTrigger}
                                            bumpRefresh={bumpRefresh}
                                        />
                                    }
                                />
                            </Routes>
                        </main>
                    </>
                )}

                {isProfileOpen && (
                    <ProfileModal
                        isOpen={isProfileOpen}
                        onClose={() => setIsProfileOpen(false)}
                        user={user}
                        theme={theme}
                        onUpdateSuccess={handleProfileUpdateSuccess}
                    />
                )}
            </div>
        </Router>
    );
}

export default App;