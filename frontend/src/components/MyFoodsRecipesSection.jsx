// frontend/src/components/MyFoodsRecipesSection.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import './MyFoodsRecipesSection.css';

const MEAL_OPTIONS = [
    { id: 'BREAKFAST', label: 'Сніданок' },
    { id: 'LUNCH', label: 'Обід' },
    { id: 'DINNER', label: 'Вечеря' },
    { id: 'SNACK', label: 'Перекус' },
];

const MyFoodsRecipesSection = ({ theme = 'light', selectedDate, onAddedToDiary }) => {
    const [activeTab, setActiveTab] = useState('foods'); // 'foods' | 'recipes'
    const [searchQuery, setSearchQuery] = useState('');
    const [customFoods, setCustomFoods] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);

    // Стан форми нового власного продукту
    const [foodForm, setFoodForm] = useState({
        name: '',
        calories: '',
        proteins: '',
        fats: '',
        carbs: '',
    });

    // Стан форми нового рецепта
    const [recipeForm, setRecipeForm] = useState({
        title: '',
        prepTime: '',
        calories: '',
        proteins: '',
        fats: '',
        carbs: '',
        instructions: '',
    });

    // Стан швидкого додавання в щоденник по кожному елементу
    const [quickAddState, setQuickAddState] = useState({});

    const fetchLibrary = async () => {
        try {
            const [foodsRes, recipesRes] = await Promise.all([
                axios.get('/api/custom-foods', { params: searchQuery ? { query: searchQuery } : {} }),
                axios.get('/api/recipes', { params: searchQuery ? { query: searchQuery } : {} }),
            ]);
            setCustomFoods(foodsRes.data || []);
            setRecipes(recipesRes.data || []);
        } catch (err) {
            console.error('Помилка завантаження власних продуктів/рецептів:', err);
        }
    };

    useEffect(() => {
        fetchLibrary();
    }, [searchQuery]);

    const handleCreateFood = async (e) => {
        e.preventDefault();
        if (!foodForm.name.trim()) return;
        try {
            await axios.post('/api/custom-foods', foodForm);
            setFoodForm({ name: '', calories: '', proteins: '', fats: '', carbs: '' });
            setShowCreateForm(false);
            fetchLibrary();
        } catch (err) {
            alert('Помилка збереження продукту');
        }
    };

    const handleCreateRecipe = async (e) => {
        e.preventDefault();
        if (!recipeForm.title.trim()) return;
        try {
            await axios.post('/api/recipes', recipeForm);
            setRecipeForm({ title: '', prepTime: '', calories: '', proteins: '', fats: '', carbs: '', instructions: '' });
            setShowCreateForm(false);
            fetchLibrary();
        } catch (err) {
            alert('Помилка збереження рецепта');
        }
    };

    const handleDeleteItem = async (type, id) => {
        try {
            const endpoint = type === 'foods' ? `/api/custom-foods/${id}` : `/api/recipes/${id}`;
            await axios.delete(endpoint);
            fetchLibrary();
        } catch (err) {
            alert('Помилка видалення');
        }
    };

    const getQuickConfig = (key) => quickAddState[key] || { mealType: 'BREAKFAST', weight: 100 };

    const updateQuickConfig = (key, patch) => {
        setQuickAddState((prev) => ({
            ...prev,
            [key]: { ...getQuickConfig(key), ...patch },
        }));
    };

    const handleQuickAddToDiary = async (item, itemName, key) => {
        const cfg = getQuickConfig(key);
        const weight = Math.max(1, parseInt(cfg.weight, 10) || 100);
        const ratio = weight / 100;

        try {
            await axios.post('/api/meals/add-food', {
                type: cfg.mealType,
                name: itemName,
                weight,
                calories: Math.round((item.calories || 0) * ratio),
                proteins: Math.round((item.proteins || 0) * ratio * 10) / 10,
                fats: Math.round((item.fats || 0) * ratio * 10) / 10,
                carbs: Math.round((item.carbs || 0) * ratio * 10) / 10,
                date: selectedDate,
            });
            if (onAddedToDiary) onAddedToDiary();
        } catch (err) {
            alert('Помилка додавання у щоденник');
        }
    };

    return (
        <section className={`my-foods-recipes-section ${theme}`}>
            <div className="mfr-header">
                <h3 className="mfr-title">🥗 Мої продукти та рецепти</h3>

                <div className="mfr-tabs">
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('foods');
                            setShowCreateForm(false);
                        }}
                        className={`mfr-tab-btn mfr-tab-btn--foods ${activeTab === 'foods' ? 'active' : ''}`}
                    >
                        Продукти ({customFoods.length})
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('recipes');
                            setShowCreateForm(false);
                        }}
                        className={`mfr-tab-btn mfr-tab-btn--recipes ${activeTab === 'recipes' ? 'active' : ''}`}
                    >
                        Рецепти ({recipes.length})
                    </button>
                </div>
            </div>

            {/* Панель пошуку та кнопка створення */}
            <div className="mfr-toolbar">
                <input
                    type="text"
                    placeholder={activeTab === 'foods' ? '🔍 Пошук серед моїх продуктів...' : '🔍 Пошук серед моїх рецептів...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="mfr-input mfr-search-input"
                />

                <button
                    type="button"
                    onClick={() => setShowCreateForm((prev) => !prev)}
                    className={`mfr-create-toggle-btn ${
                        showCreateForm
                            ? 'is-open'
                            : activeTab === 'foods'
                                ? 'mfr-create-toggle-btn--foods'
                                : 'mfr-create-toggle-btn--recipes'
                    }`}
                >
                    {showCreateForm ? '✕ Закрити форму' : activeTab === 'foods' ? '+ Новий продукт' : '+ Новий рецепт'}
                </button>
            </div>

            {/* Форма створення власного продукту */}
            {showCreateForm && activeTab === 'foods' && (
                <form onSubmit={handleCreateFood} className="mfr-create-form">
                    <div className="mfr-form-row">
                        <input
                            type="text"
                            placeholder="Назва продукту (напр. Сирники домашні)"
                            value={foodForm.name}
                            onChange={(e) => setFoodForm({ ...foodForm, name: e.target.value })}
                            className="mfr-input"
                            required
                        />
                    </div>
                    <div className="mfr-grid-4 mfr-form-row">
                        <input
                            type="number"
                            placeholder="Ккал / 100г"
                            value={foodForm.calories}
                            onChange={(e) => setFoodForm({ ...foodForm, calories: e.target.value })}
                            className="mfr-input"
                            required
                        />
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Білки (г)"
                            value={foodForm.proteins}
                            onChange={(e) => setFoodForm({ ...foodForm, proteins: e.target.value })}
                            className="mfr-input"
                        />
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Жири (г)"
                            value={foodForm.fats}
                            onChange={(e) => setFoodForm({ ...foodForm, fats: e.target.value })}
                            className="mfr-input"
                        />
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Вуглеводи (г)"
                            value={foodForm.carbs}
                            onChange={(e) => setFoodForm({ ...foodForm, carbs: e.target.value })}
                            className="mfr-input"
                        />
                    </div>
                    <button type="submit" className="mfr-submit-btn mfr-submit-btn--foods">
                        Зберегти продукт у базу
                    </button>
                </form>
            )}

            {/* Форма створення рецепта */}
            {showCreateForm && activeTab === 'recipes' && (
                <form onSubmit={handleCreateRecipe} className="mfr-create-form">
                    <div className="mfr-grid-title-time mfr-form-row-sm">
                        <input
                            type="text"
                            placeholder="Назва страви / рецепта"
                            value={recipeForm.title}
                            onChange={(e) => setRecipeForm({ ...recipeForm, title: e.target.value })}
                            className="mfr-input"
                            required
                        />
                        <input
                            type="number"
                            placeholder="Час готування (хв)"
                            value={recipeForm.prepTime}
                            onChange={(e) => setRecipeForm({ ...recipeForm, prepTime: e.target.value })}
                            className="mfr-input"
                        />
                    </div>

                    <div className="mfr-grid-4 mfr-form-row-sm">
                        <input
                            type="number"
                            placeholder="Ккал / 100г"
                            value={recipeForm.calories}
                            onChange={(e) => setRecipeForm({ ...recipeForm, calories: e.target.value })}
                            className="mfr-input"
                            required
                        />
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Білки (г)"
                            value={recipeForm.proteins}
                            onChange={(e) => setRecipeForm({ ...recipeForm, proteins: e.target.value })}
                            className="mfr-input"
                        />
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Жири (г)"
                            value={recipeForm.fats}
                            onChange={(e) => setRecipeForm({ ...recipeForm, fats: e.target.value })}
                            className="mfr-input"
                        />
                        <input
                            type="number"
                            step="0.1"
                            placeholder="Вуглеводи (г)"
                            value={recipeForm.carbs}
                            onChange={(e) => setRecipeForm({ ...recipeForm, carbs: e.target.value })}
                            className="mfr-input"
                        />
                    </div>

                    <textarea
                        rows="2"
                        placeholder="Інгредієнти або короткий опис приготування..."
                        value={recipeForm.instructions}
                        onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })}
                        className="mfr-input mfr-textarea mfr-form-row"
                    />

                    <button type="submit" className="mfr-submit-btn mfr-submit-btn--recipes">
                        Зберегти рецепт
                    </button>
                </form>
            )}

            {/* Список власних продуктів */}
            {activeTab === 'foods' && (
                <div className="mfr-items-list">
                    {customFoods.length === 0 ? (
                        <p className="mfr-empty-text">
                            Власних продуктів поки немає. Натисніть «+ Новий продукт», щоб додати.
                        </p>
                    ) : (
                        customFoods.map((food) => {
                            const key = `food_${food.id}`;
                            const cfg = getQuickConfig(key);
                            return (
                                <div key={food.id} className="mfr-item-card">
                                    <div className="mfr-item-info">
                                        <div className="mfr-item-name">{food.name}</div>
                                        <div className="mfr-item-macros">
                                            {food.calories} ккал • Б: {food.proteins}г • Ж: {food.fats}г • В: {food.carbs}г (на 100г)
                                        </div>
                                    </div>

                                    <div className="mfr-quick-actions">
                                        <select
                                            value={cfg.mealType}
                                            onChange={(e) => updateQuickConfig(key, { mealType: e.target.value })}
                                            className="mfr-input mfr-select-compact"
                                        >
                                            {MEAL_OPTIONS.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min="1"
                                            value={cfg.weight}
                                            onChange={(e) => updateQuickConfig(key, { weight: e.target.value })}
                                            className="mfr-input mfr-weight-input"
                                            title="Вага в грамах"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleQuickAddToDiary(food, food.name, key)}
                                            className="mfr-quick-add-btn mfr-quick-add-btn--foods"
                                        >
                                            + У щоденник
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteItem('foods', food.id)}
                                            className="mfr-delete-btn"
                                            title="Видалити продукт"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* Список рецептів */}
            {activeTab === 'recipes' && (
                <div className="mfr-items-list">
                    {recipes.length === 0 ? (
                        <p className="mfr-empty-text">
                            Рецептів поки немає. Натисніть «+ Новий рецепт», щоб зберегти улюблену страву.
                        </p>
                    ) : (
                        recipes.map((recipe) => {
                            const key = `recipe_${recipe.id}`;
                            const cfg = getQuickConfig(key);
                            return (
                                <div key={recipe.id} className="mfr-item-card mfr-item-card--recipe">
                                    <div className="mfr-item-info mfr-item-info--recipe">
                                        <div className="mfr-item-name">
                                            {recipe.title}{' '}
                                            {recipe.prepTime ? (
                                                <span className="mfr-prep-time">(⏱️ {recipe.prepTime} хв)</span>
                                            ) : null}
                                        </div>
                                        <div className="mfr-item-macros mfr-item-macros--spaced">
                                            {recipe.calories} ккал • Б: {recipe.proteins}г • Ж: {recipe.fats}г • В: {recipe.carbs}г (на 100г)
                                        </div>
                                        {recipe.instructions && (
                                            <div className="mfr-recipe-instructions">{recipe.instructions}</div>
                                        )}
                                    </div>

                                    <div className="mfr-quick-actions">
                                        <select
                                            value={cfg.mealType}
                                            onChange={(e) => updateQuickConfig(key, { mealType: e.target.value })}
                                            className="mfr-input mfr-select-compact"
                                        >
                                            {MEAL_OPTIONS.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.label}
                                                </option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            min="1"
                                            value={cfg.weight}
                                            onChange={(e) => updateQuickConfig(key, { weight: e.target.value })}
                                            className="mfr-input mfr-weight-input"
                                            title="Вага в грамах"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleQuickAddToDiary(recipe, recipe.title, key)}
                                            className="mfr-quick-add-btn mfr-quick-add-btn--recipes"
                                        >
                                            + У щоденник
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteItem('recipes', recipe.id)}
                                            className="mfr-delete-btn"
                                            title="Видалити рецепт"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </section>
    );
};

export default MyFoodsRecipesSection;