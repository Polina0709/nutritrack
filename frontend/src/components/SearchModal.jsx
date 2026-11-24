// frontend/src/components/SearchModal.jsx
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BarcodeScannerModal from './BarcodeScannerModal';
import './SearchModal.css';

const ScanBarcodeIcon = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M4 8V6a2 2 0 0 1 2-2h2" />
        <path d="M16 4h2a2 2 0 0 1 2 2v2" />
        <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
        <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
        <line x1="8" y1="8" x2="8" y2="16" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="16" y1="8" x2="16" y2="16" />
        <line x1="6" y1="12" x2="18" y2="12" strokeWidth="1.6" />
    </svg>
);

const SearchModal = ({ isOpen, onClose, mealType, mealLabel, onAddSuccess, theme = 'light' }) => {
    const [activeTab, setActiveTab] = useState('GLOBAL'); // 'GLOBAL', 'CUSTOM', 'RECIPE'

    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Сканер штрихкодів
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerTargetMode, setScannerTargetMode] = useState('MEAL'); // 'MEAL' | 'INGREDIENT'
    const [barcodeLoading, setBarcodeLoading] = useState(false);
    const [unfoundBarcode, setUnfoundBarcode] = useState('');

    const [customFoods, setCustomFoods] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);

    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    const [newFood, setNewFood] = useState({ name: '', calories: '', proteins: '', fats: '', carbs: '' });

    // Конструктор рецептів
    const [recipeStep, setRecipeStep] = useState('LIST');
    const [rTitle, setRTitle] = useState('');
    const [rTime, setRTime] = useState('');
    const [rInstructions, setRInstructions] = useState('');
    const [rIngredients, setRIngredients] = useState([]);

    const [ingTab, setIngTab] = useState('GLOBAL');
    const [selectedIng, setSelectedIng] = useState(null);
    const [ingWeight, setIngWeight] = useState('100');

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [weight, setWeight] = useState('100');

    const debounceRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        if (activeTab === 'CUSTOM' || ingTab === 'CUSTOM') fetchCustomFoods();
        if (activeTab === 'RECIPE') fetchRecipes();
    }, [isOpen, activeTab, ingTab]);

    // Автопошук та автодоповнення при зміні запиту
    useEffect(() => {
        if (!isOpen) return;

        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        const trimmed = query.trim();
        const isSearchingIngredient = activeTab === 'RECIPE' && recipeStep === 'SEARCH_ING';
        const currentSource = isSearchingIngredient ? ingTab : activeTab;

        if (trimmed.length < 2) {
            setSuggestions([]);
            setShowSuggestions(false);
            setErrorMsg('');
            setUnfoundBarcode('');
            if (currentSource === 'CUSTOM') fetchCustomFoods('');
            if (currentSource === 'RECIPE' && recipeStep === 'LIST') fetchRecipes('');
            return;
        }

        debounceRef.current = setTimeout(async () => {
            if (currentSource === 'GLOBAL') {
                setSuggestLoading(true);
                setErrorMsg('');
                setUnfoundBarcode('');
                try {
                    const res = await axios.get(
                        `/api/fatsecret/search?query=${encodeURIComponent(trimmed)}&maxResults=8`
                    );
                    const list = Array.isArray(res.data) ? res.data : [];
                    setSuggestions(list);
                    setResults(list);
                    setShowSuggestions(true);
                } catch (err) {
                    setErrorMsg(err.response?.data?.error || 'Не вдалося виконати автопошук');
                    setSuggestions([]);
                } finally {
                    setSuggestLoading(false);
                }
            } else if (currentSource === 'CUSTOM') {
                await fetchCustomFoods(trimmed);
                const filtered = customFoods.filter((f) =>
                    (f.name || '').toLowerCase().includes(trimmed.toLowerCase())
                );
                setSuggestions(filtered.slice(0, 6));
                setShowSuggestions(true);
            } else if (currentSource === 'RECIPE' && recipeStep === 'LIST') {
                await fetchRecipes(trimmed);
                setShowSuggestions(true);
            }
        }, 350);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query, activeTab, recipeStep, ingTab, isOpen]);

    if (!isOpen) return null;

    // --- API ЗАПИТИ ---
    const executeGlobalSearch = async (searchText) => {
        const trimmed = (searchText ?? query).trim();
        if (!trimmed) return;
        setLoading(true);
        setErrorMsg('');
        setUnfoundBarcode('');
        setShowSuggestions(false);
        try {
            const response = await axios.get(
                `/api/fatsecret/search?query=${encodeURIComponent(trimmed)}&maxResults=15`
            );
            const list = Array.isArray(response.data) ? response.data : [];
            setResults(list);
        } catch (err) {
            setErrorMsg(err.response?.data?.error || 'Помилка запиту до FatSecret');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalSearch = async (e) => {
        e.preventDefault();
        await executeGlobalSearch(query);
    };

    const handleBarcodeDetected = async (barcodeDigits) => {
        setIsScannerOpen(false);
        setBarcodeLoading(true);
        setErrorMsg('');
        setUnfoundBarcode('');
        setShowSuggestions(false);

        try {
            const res = await axios.get(`/api/barcode/${encodeURIComponent(barcodeDigits)}`);
            if (scannerTargetMode === 'INGREDIENT') {
                handlePickIngredient(res.data);
            } else {
                setSelectedProduct(res.data);
            }
        } catch (err) {
            if (err.response?.status === 404) {
                setUnfoundBarcode(barcodeDigits);
                setErrorMsg(`Товар зі штрихкодом ${barcodeDigits} не знайдено в базі.`);
            } else {
                setErrorMsg(err.response?.data?.error || 'Не вдалося розпізнати штрихкод');
            }
        } finally {
            setBarcodeLoading(false);
        }
    };

    const fetchCustomFoods = async (searchQuery = '') => {
        try {
            const res = await axios.get(`/api/custom-foods?query=${encodeURIComponent(searchQuery)}`);
            setCustomFoods(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRecipes = async (searchQuery = '') => {
        try {
            const res = await axios.get(`/api/recipes?query=${encodeURIComponent(searchQuery)}`);
            setRecipes(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateCustomFood = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/custom-foods', newFood);
            setIsCreatingCustom(false);
            setNewFood({ name: '', calories: '', proteins: '', fats: '', carbs: '' });
            fetchCustomFoods();
        } catch {
            alert('Помилка при створенні продукту');
        }
    };

    // --- ВИДАЛЕННЯ ВЛАСНОГО ПРОДУКТУ ТА РЕЦЕПТУ ---
    const handleDeleteCustomFood = async (e, foodId) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Видалити цей власний продукт?')) return;

        try {
            await axios.delete(`/api/custom-foods/${foodId}`);
            setCustomFoods((prev) => prev.filter((item) => item.id !== foodId));
            if (selectedProduct && selectedProduct.id === foodId) {
                setSelectedProduct(null);
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Помилка при видаленні продукту');
        }
    };

    const handleDeleteRecipe = async (e, recipeId) => {
        if (e) e.stopPropagation();
        if (!window.confirm('Видалити цей рецепт?')) return;

        try {
            await axios.delete(`/api/recipes/${recipeId}`);
            setRecipes((prev) => prev.filter((item) => item.id !== recipeId));
            if (selectedProduct && selectedProduct.id === `recipe-${recipeId}`) {
                setSelectedProduct(null);
            }
        } catch (err) {
            alert(err.response?.data?.error || 'Помилка при видаленні рецепту');
        }
    };

    // --- ЛОГІКА РЕЦЕПТІВ ---
    const handlePickIngredient = (item) => {
        setSelectedIng(item);
        setIngWeight('100');
        setShowSuggestions(false);
        setRecipeStep('WEIGHT_ING');
    };

    const confirmAddIngredient = () => {
        const grams = parseInt(ingWeight, 10);
        if (!grams || grams <= 0) {
            alert('Введіть вагу');
            return;
        }

        const nutriments = selectedIng.nutriments || {};
        const factor = grams / 100;

        const kcal = Math.round((nutriments['energy-kcal_100g'] || 0) * factor);
        const p = parseFloat(((nutriments['proteins_100g'] || 0) * factor).toFixed(1));
        const f = parseFloat(((nutriments['fat_100g'] || 0) * factor).toFixed(1));
        const c = parseFloat(((nutriments['carbohydrates_100g'] || 0) * factor).toFixed(1));

        setRIngredients([
            ...rIngredients,
            {
                id: Date.now(),
                name: selectedIng.product_name || selectedIng.name,
                weight: grams,
                kcal,
                p,
                f,
                c,
            },
        ]);
        setRecipeStep('FORM');
        setSelectedIng(null);
        setQuery('');
        setResults([]);
        setSuggestions([]);
        setIngWeight('100');
    };

    const removeIngredient = (idToRemove) =>
        setRIngredients(rIngredients.filter((i) => i.id !== idToRemove));

    const rTotalWeight = rIngredients.reduce((sum, i) => sum + i.weight, 0) || 1;
    const rTotalKcal = rIngredients.reduce((sum, i) => sum + i.kcal, 0);
    const rTotalP = rIngredients.reduce((sum, i) => sum + i.p, 0);
    const rTotalF = rIngredients.reduce((sum, i) => sum + i.f, 0);
    const rTotalC = rIngredients.reduce((sum, i) => sum + i.c, 0);

    const rKcal100 = rIngredients.length > 0 ? Math.round((rTotalKcal / rTotalWeight) * 100) : 0;
    const rP100 = rIngredients.length > 0 ? ((rTotalP / rTotalWeight) * 100).toFixed(1) : 0;
    const rF100 = rIngredients.length > 0 ? ((rTotalF / rTotalWeight) * 100).toFixed(1) : 0;
    const rC100 = rIngredients.length > 0 ? ((rTotalC / rTotalWeight) * 100).toFixed(1) : 0;

    const handleSaveRecipe = async (e) => {
        e.preventDefault();
        if (rIngredients.length === 0) return alert('Додайте інгредінти!');
        if (!rTitle.trim()) return alert('Введіть назву');

        const formattedInstructions = `🛒 Інгредінти:\n${rIngredients
            .map((i) => `- ${i.name} (${i.weight}г)`)
            .join('\n')}\n\n👩‍🍳 Приготування:\n${rInstructions}`;

        try {
            await axios.post('/api/recipes', {
                title: rTitle,
                instructions: formattedInstructions,
                prepTime: rTime,
                calories: rKcal100,
                proteins: parseFloat(rP100),
                fats: parseFloat(rF100),
                carbs: parseFloat(rC100),
            });
            setRecipeStep('LIST');
            setRTitle('');
            setRTime('');
            setRInstructions('');
            setRIngredients([]);
            setQuery('');
            fetchRecipes();
        } catch {
            alert('Помилка збереження рецепта');
        }
    };

    const formatCustomForSelect = (food) => ({
        id: food.id,
        product_name: food.name || food.product_name,
        isCustom: true,
        image_url: 'https://via.placeholder.com/100?text=Food',
        nutriments: {
            'energy-kcal_100g': food.calories ?? food.nutriments?.['energy-kcal_100g'] ?? 0,
            'proteins_100g': food.proteins ?? food.nutriments?.['proteins_100g'] ?? 0,
            'fat_100g': food.fats ?? food.nutriments?.['fat_100g'] ?? 0,
            'carbohydrates_100g': food.carbs ?? food.nutriments?.['carbohydrates_100g'] ?? 0,
        },
    });

    const selectRecipe = (recipe) =>
        setSelectedProduct({
            id: `recipe-${recipe.id}`,
            rawRecipeId: recipe.id,
            product_name: recipe.title,
            isCustom: true,
            isRecipe: true,
            instructions: recipe.instructions,
            prepTime: recipe.prepTime,
            image_url: 'https://via.placeholder.com/100?text=Recipe',
            nutriments: {
                'energy-kcal_100g': recipe.calories,
                'proteins_100g': recipe.proteins,
                'fat_100g': recipe.fats,
                'carbohydrates_100g': recipe.carbs,
            },
        });

    const handleConfirmAdd = async () => {
        if (!selectedProduct) return;
        const grams = parseInt(weight, 10);
        if (!grams || grams <= 0) {
            alert('Введіть вагу');
            return;
        }

        const nutriments = selectedProduct.nutriments || {};
        const factor = grams / 100;

        const calories = Math.round((nutriments['energy-kcal_100g'] || 0) * factor);
        const proteins = parseFloat(((nutriments['proteins_100g'] || 0) * factor).toFixed(1));
        const fats = parseFloat(((nutriments['fat_100g'] || 0) * factor).toFixed(1));
        const carbs = parseFloat(((nutriments['carbohydrates_100g'] || 0) * factor).toFixed(1));

        try {
            await axios.post('/api/meals/add-food', {
                type: mealType,
                name: selectedProduct.product_name,
                weight: grams,
                calories,
                proteins,
                fats,
                carbs,
            });
            setQuery('');
            setResults([]);
            setSuggestions([]);
            setSelectedProduct(null);
            setWeight('100');
            onAddSuccess();
        } catch {
            alert('Помилка збереження');
        }
    };

    // --- ОЦІНЮВАННЯ ТА АНАЛІЗ (0-10) ---
    const calculateHealthRating = (product) => {
        if (product.isRecipe) return { rating: '8.0', level: 'high' };

        let score = 7.0;
        const p = product.nutriments?.['proteins_100g'] || 0;
        const c = product.nutriments?.['carbohydrates_100g'] || 0;
        const f = product.nutriments?.['fat_100g'] || 0;

        if (p > 15) score = 9.0;
        else if (c > 50 && f > 20) score = 3.0;
        else if (c > 60) score = 5.0;
        else if (f > 40) score = 4.5;

        const finalRating = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
        let level = 'low';
        if (finalRating >= 7.5) level = 'high';
        else if (finalRating >= 4.0) level = 'mid';

        return { rating: finalRating, level };
    };

    const getHealthInsights = (product) => {
        if (product.isRecipe) {
            return ['🥘 Домашній збалансований рецепт.', '✅ Ви контролюєте кожний інгредієнт.'];
        }
        if (product.id && product.id.toString().startsWith('off-')) {
            return [
                `🏢 ${product.brand || 'Open Food Facts'}`,
                '📷 Знайдено за штрихкодом',
                product.description ? `ℹ️ ${product.description}` : '',
            ].filter(Boolean);
        }
        if (product.id && product.id.toString().startsWith('fs-')) {
            return [
                `🏢 ${product.brand || 'Загальна база'}`,
                '✅ Знайдено через FatSecret',
                product.description ? `ℹ️ Ориг. порція: ${product.description}` : '',
            ].filter(Boolean);
        }
        return ['🧑‍🍳 Власний продукт користувача.', '✅ Склад введено вручну.'];
    };

    const filteredRecipes = recipes.filter((r) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
            (r.title || '').toLowerCase().includes(q) ||
            (r.instructions || '').toLowerCase().includes(q)
        );
    });

    const renderAutocompleteDropdown = (isForIngredient = false) => {
        if (!showSuggestions || query.trim().length < 2) return null;

        const currentMode = isForIngredient ? ingTab : activeTab;

        if (currentMode === 'RECIPE') {
            const recipeMatches = filteredRecipes.slice(0, 6);
            return (
                <div className="sm-autocomplete">
                    {recipeMatches.length === 0 ? (
                        <div className="sm-autocomplete-status">Рецептів за запитом не знайдено.</div>
                    ) : (
                        recipeMatches.map((recipe) => (
                            <div
                                key={recipe.id}
                                onMouseDown={() => {
                                    setShowSuggestions(false);
                                    selectRecipe(recipe);
                                }}
                                className="sm-autocomplete-item"
                            >
                                <div>
                                    <strong>📖 {recipe.title}</strong>
                                    {recipe.prepTime && (
                                        <span className="sm-autocomplete-meta">({recipe.prepTime} хв)</span>
                                    )}
                                </div>
                                <span className="sm-autocomplete-kcal sm-autocomplete-kcal--amber">
                                    {recipe.calories} ккал / 100г
                                </span>
                            </div>
                        ))
                    )}
                </div>
            );
        }

        const items =
            currentMode === 'GLOBAL'
                ? suggestions
                : customFoods
                    .filter((f) => (f.name || '').toLowerCase().includes(query.trim().toLowerCase()))
                    .slice(0, 6)
                    .map(formatCustomForSelect);

        return (
            <div className="sm-autocomplete">
                {suggestLoading && (
                    <div className="sm-autocomplete-status">Автопідбір варіантів...</div>
                )}
                {!suggestLoading && items.length === 0 && (
                    <div className="sm-autocomplete-status">
                        Підказок не знайдено — натисніть «Знайти» для повного пошуку.
                    </div>
                )}
                {items.map((item) => (
                    <div
                        key={item.id}
                        onMouseDown={() => {
                            setShowSuggestions(false);
                            if (isForIngredient) {
                                handlePickIngredient(item);
                            } else {
                                setSelectedProduct(item);
                            }
                        }}
                        className="sm-autocomplete-item"
                    >
                        <div>
                            <strong>{item.product_name || item.name}</strong>
                            {item.brand && (
                                <span className="sm-autocomplete-meta">({item.brand})</span>
                            )}
                        </div>
                        <span className="sm-autocomplete-kcal">
                            {Math.round(item.nutriments?.['energy-kcal_100g'] || 0)} ккал
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    const renderProductList = (items, isForIngredient = false, onDeleteItem = null) => (
        <div className="sm-products-grid">
            {items.map((product) => {
                const { rating, level } = calculateHealthRating(product);
                return (
                    <div
                        key={product.id || product.code}
                        className="sm-product-card"
                        onClick={() => (isForIngredient ? handlePickIngredient(product) : setSelectedProduct(product))}
                    >
                        {onDeleteItem && (
                            <button
                                type="button"
                                onClick={(e) => onDeleteItem(e, product.id)}
                                title="Видалити"
                                className="sm-card-delete-btn"
                            >
                                🗑️
                            </button>
                        )}
                        <span className={`sm-rating-badge sm-rating--${level}`}>
                            {rating}★
                        </span>
                        <img
                            src={product.image_url || 'https://via.placeholder.com/100'}
                            alt={product.product_name || product.name || 'product'}
                            className="sm-product-img"
                        />
                        <h5 className="sm-product-title">
                            {product.product_name || product.name}
                        </h5>
                        <p className="sm-product-kcal">
                            {Math.round(product.nutriments?.['energy-kcal_100g'] || product.calories || 0)} ккал
                        </p>
                    </div>
                );
            })}
        </div>
    );

    const isUserCustomFood =
        selectedProduct &&
        selectedProduct.isCustom &&
        !selectedProduct.isRecipe &&
        !String(selectedProduct.id).startsWith('fs-') &&
        !String(selectedProduct.id).startsWith('off-');

    const isUserRecipe = selectedProduct && selectedProduct.isRecipe;

    return (
        <div
            onClick={() => setShowSuggestions(false)}
            className={`search-modal-overlay ${theme}`}
        >
            <div onClick={(e) => e.stopPropagation()} className="sm-modal">
                <button
                    type="button"
                    onClick={onClose}
                    className="sm-close-btn"
                    title="Закрити"
                    aria-label="Закрити"
                >
                    ✕
                </button>

                {/* ДЕТАЛЬНИЙ ПЕРЕГЛЯД */}
                {selectedProduct ? (
                    <div className="sm-flex-col-full">
                        {(() => {
                            const { rating, level } = calculateHealthRating(selectedProduct);
                            const insights = getHealthInsights(selectedProduct);
                            const nutriments = selectedProduct.nutriments || {};
                            const factor = (parseInt(weight, 10) || 0) / 100;
                            const currentKcal = Math.round((nutriments['energy-kcal_100g'] || 0) * factor);
                            const currentP = ((nutriments['proteins_100g'] || 0) * factor).toFixed(1);
                            const currentF = ((nutriments['fat_100g'] || 0) * factor).toFixed(1);
                            const currentC = ((nutriments['carbohydrates_100g'] || 0) * factor).toFixed(1);

                            return (
                                <>
                                    <div className="sm-detail-header">
                                        <div className="sm-detail-icon">
                                            {selectedProduct.isRecipe ? '📖' : '🍽️'}
                                        </div>
                                        <div className="sm-detail-info">
                                            <h4 className="sm-detail-title">{selectedProduct.product_name}</h4>
                                            <p className="sm-detail-sub">
                                                {selectedProduct.brand || (selectedProduct.isRecipe ? 'Ваш рецепт' : 'Моя база')}
                                            </p>
                                        </div>
                                        <div className={`sm-detail-score sm-rating--${level}`}>
                                            <div className="sm-detail-score-val">{rating}</div>
                                            <div className="sm-detail-score-cap">З 10</div>
                                        </div>
                                    </div>

                                    <div className="sm-scroll-body">
                                        <div className="sm-weight-box">
                                            <label className="sm-weight-label">З'їдено (г):</label>
                                            <div className="sm-weight-controls">
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="1000"
                                                    value={weight}
                                                    onChange={(e) => setWeight(e.target.value)}
                                                    className="sm-range-input"
                                                />
                                                <input
                                                    type="number"
                                                    value={weight}
                                                    onChange={(e) => setWeight(e.target.value)}
                                                    className="sm-weight-number"
                                                />
                                            </div>
                                        </div>

                                        <div className="sm-macro-grid">
                                            <div>
                                                <strong className="sm-macro-val">{currentKcal}</strong>
                                                <span className="sm-macro-cap">Ккал</span>
                                            </div>
                                            <div>
                                                <strong className="sm-macro-val">{currentP}г</strong>
                                                <span className="sm-macro-cap">Білки</span>
                                            </div>
                                            <div>
                                                <strong className="sm-macro-val">{currentF}г</strong>
                                                <span className="sm-macro-cap">Жири</span>
                                            </div>
                                            <div>
                                                <strong className="sm-macro-val">{currentC}г</strong>
                                                <span className="sm-macro-cap">Вуглеводи</span>
                                            </div>
                                        </div>

                                        <div className="sm-insights-box">
                                            <h5 className="sm-insights-title">📋 Аналіз:</h5>
                                            <ul className="sm-insights-list">
                                                {insights.map((insight, idx) => (
                                                    <li key={idx}>{insight}</li>
                                                ))}
                                            </ul>
                                        </div>

                                        {selectedProduct.isRecipe && selectedProduct.instructions && (
                                            <div className="sm-recipe-instructions">
                                                {selectedProduct.instructions}
                                            </div>
                                        )}
                                    </div>

                                    <div className="sm-footer-actions">
                                        <button
                                            type="button"
                                            onClick={() => setSelectedProduct(null)}
                                            className="sm-btn-secondary"
                                        >
                                            Назад
                                        </button>

                                        {(isUserCustomFood || isUserRecipe) && (
                                            <button
                                                type="button"
                                                onClick={(e) =>
                                                    isUserRecipe
                                                        ? handleDeleteRecipe(e, selectedProduct.rawRecipeId)
                                                        : handleDeleteCustomFood(e, selectedProduct.id)
                                                }
                                                className="sm-btn-danger-icon"
                                                title="Видалити з бази"
                                            >
                                                🗑️
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={handleConfirmAdd}
                                            className="sm-btn-olive"
                                        >
                                            Додати {weight}г
                                        </button>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                ) : activeTab === 'RECIPE' && recipeStep !== 'LIST' ? (
                    // КОНСТРУКТОР РЕЦЕПТІВ
                    <div className="sm-flex-col-full">
                        <h3 className="sm-builder-title">
                            {recipeStep === 'FORM' ? '👨‍🍳 Створення рецепту' : '🔍 Вибір інгредієнта'}
                        </h3>

                        {recipeStep === 'FORM' && (
                            <div className="sm-scroll-body">
                                <input
                                    type="text"
                                    value={rTitle}
                                    onChange={(e) => setRTitle(e.target.value)}
                                    placeholder="Назва страви"
                                    className="sm-input sm-input--bold sm-mb-14"
                                />

                                <div className="sm-ing-box">
                                    <h4 className="sm-ing-header">
                                        <span>🛒 Інгредієнти ({rIngredients.length})</span>
                                        <span className="sm-amber-text">Вага: {rTotalWeight}г</span>
                                    </h4>
                                    {rIngredients.map((ing) => (
                                        <div key={ing.id} className="sm-ing-row">
                                            <span>
                                                {ing.name} <strong>({ing.weight}г)</strong>
                                            </span>
                                            <div className="sm-ing-row-right">
                                                <span className="sm-ing-kcal">{ing.kcal} ккал</span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeIngredient(ing.id)}
                                                    className="sm-ing-remove-btn"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setQuery('');
                                            setResults([]);
                                            setSuggestions([]);
                                            setRecipeStep('SEARCH_ING');
                                        }}
                                        className="sm-dashed-btn sm-dashed-btn--amber sm-mt-10"
                                    >
                                        + Додати інгредієнт
                                    </button>
                                </div>

                                <div className="sm-recipe-macro-grid">
                                    <div className="sm-recipe-macro-head">
                                        📊 На 100г готової страви:
                                    </div>
                                    <div>
                                        <strong className="sm-recipe-macro-val">{rKcal100}</strong>
                                        <span className="sm-macro-cap">Ккал</span>
                                    </div>
                                    <div>
                                        <strong className="sm-recipe-macro-val">{rP100}г</strong>
                                        <span className="sm-macro-cap">Білки</span>
                                    </div>
                                    <div>
                                        <strong className="sm-recipe-macro-val">{rF100}г</strong>
                                        <span className="sm-macro-cap">Жири</span>
                                    </div>
                                    <div>
                                        <strong className="sm-recipe-macro-val">{rC100}г</strong>
                                        <span className="sm-macro-cap">Вуглеводи</span>
                                    </div>
                                </div>

                                <input
                                    type="number"
                                    value={rTime}
                                    onChange={(e) => setRTime(e.target.value)}
                                    placeholder="Час (хв)"
                                    className="sm-input sm-mb-10"
                                />
                                <textarea
                                    value={rInstructions}
                                    onChange={(e) => setRInstructions(e.target.value)}
                                    placeholder="Як готувати?"
                                    rows="3"
                                    className="sm-textarea"
                                />
                            </div>
                        )}

                        {recipeStep === 'SEARCH_ING' && (
                            <div className="sm-flex-col-full">
                                <div className="sm-seg-switch">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIngTab('GLOBAL');
                                            setSuggestions([]);
                                        }}
                                        className={`sm-seg-btn ${ingTab === 'GLOBAL' ? 'active' : ''}`}
                                    >
                                        FatSecret
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIngTab('CUSTOM');
                                            setSuggestions([]);
                                        }}
                                        className={`sm-seg-btn ${ingTab === 'CUSTOM' ? 'active' : ''}`}
                                    >
                                        Мої
                                    </button>
                                </div>

                                <div className="sm-search-rel">
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            if (ingTab === 'GLOBAL') executeGlobalSearch(query);
                                            else fetchCustomFoods(query);
                                        }}
                                        className="sm-search-form"
                                    >
                                        <input
                                            type="text"
                                            value={query}
                                            onFocus={() => query.trim().length >= 2 && setShowSuggestions(true)}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Інгредієнт або штрихкод..."
                                            className="sm-search-input"
                                        />
                                        {ingTab === 'GLOBAL' && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setScannerTargetMode('INGREDIENT');
                                                    setIsScannerOpen(true);
                                                }}
                                                title="Сканувати штрихкод камерою"
                                                aria-label="Сканувати штрихкод камерою"
                                                className="sm-scan-btn sm-scan-btn--amber"
                                            >
                                                <ScanBarcodeIcon />
                                            </button>
                                        )}
                                        <button
                                            type="submit"
                                            className="sm-search-submit sm-search-submit--amber"
                                        >
                                            🔍
                                        </button>
                                    </form>
                                    {renderAutocompleteDropdown(true)}
                                </div>

                                {barcodeLoading && (
                                    <div className="sm-status-banner">Пошук товару за штрихкодом...</div>
                                )}
                                {errorMsg && <div className="sm-error-msg">{errorMsg}</div>}

                                {ingTab === 'GLOBAL'
                                    ? renderProductList(results, true)
                                    : renderProductList(customFoods.map(formatCustomForSelect), true)}
                            </div>
                        )}

                        {recipeStep === 'WEIGHT_ING' && selectedIng && (
                            <div className="sm-flex-1">
                                <h4 className="sm-weight-ing-title">
                                    Скільки ваги для "{selectedIng.product_name || selectedIng.name}"?
                                </h4>
                                <div className="sm-weight-controls sm-mb-18">
                                    <input
                                        type="range"
                                        min="1"
                                        max="1000"
                                        value={ingWeight}
                                        onChange={(e) => setIngWeight(e.target.value)}
                                        className="sm-range-input"
                                    />
                                    <input
                                        type="number"
                                        value={ingWeight}
                                        onChange={(e) => setIngWeight(e.target.value)}
                                        className="sm-weight-number"
                                    />
                                    <span className="sm-unit-label">г</span>
                                </div>
                                <div className="sm-footer-actions sm-footer-actions--plain">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRecipeStep('SEARCH_ING');
                                            setSelectedIng(null);
                                        }}
                                        className="sm-btn-secondary"
                                    >
                                        Назад
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmAddIngredient}
                                        className="sm-btn-amber"
                                    >
                                        Додати
                                    </button>
                                </div>
                            </div>
                        )}

                        {recipeStep === 'FORM' && (
                            <div className="sm-footer-actions">
                                <button
                                    type="button"
                                    onClick={() => setRecipeStep('LIST')}
                                    className="sm-btn-secondary"
                                >
                                    Скасувати
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveRecipe}
                                    className="sm-btn-olive"
                                >
                                    Зберегти рецепт
                                </button>
                            </div>
                        )}

                        {recipeStep === 'SEARCH_ING' && (
                            <button
                                type="button"
                                onClick={() => setRecipeStep('FORM')}
                                className="sm-btn-secondary sm-btn-full sm-mt-10"
                            >
                                Назад до рецепту
                            </button>
                        )}
                    </div>
                ) : (
                    // ГОЛОВНЕ МЕНЮ ПОШУКУ
                    <>
                        <h3 className="sm-modal-title">Додати в "{mealLabel}"</h3>

                        <div className="sm-tabs">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('GLOBAL');
                                    setIsCreatingCustom(false);
                                    setShowSuggestions(false);
                                    setUnfoundBarcode('');
                                }}
                                className={`sm-tab-btn ${activeTab === 'GLOBAL' ? 'active' : ''}`}
                            >
                                🌍 База / Код
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('CUSTOM');
                                    setShowSuggestions(false);
                                    setUnfoundBarcode('');
                                }}
                                className={`sm-tab-btn ${activeTab === 'CUSTOM' ? 'active' : ''}`}
                            >
                                🧑‍🍳 Мої продукти
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('RECIPE');
                                    setIsCreatingCustom(false);
                                    setQuery('');
                                    setSuggestions([]);
                                    setShowSuggestions(false);
                                    setUnfoundBarcode('');
                                    setRecipeStep('LIST');
                                }}
                                className={`sm-tab-btn ${activeTab === 'RECIPE' ? 'active' : ''}`}
                            >
                                📖 Рецепти
                            </button>
                        </div>

                        {activeTab === 'GLOBAL' && (
                            <>
                                <div className="sm-search-rel">
                                    <form onSubmit={handleGlobalSearch} className="sm-search-form">
                                        <input
                                            type="text"
                                            value={query}
                                            onFocus={() => query.trim().length >= 2 && setShowSuggestions(true)}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Назва продукту або штрихкод..."
                                            className="sm-search-input"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScannerTargetMode('MEAL');
                                                setIsScannerOpen(true);
                                            }}
                                            title="Сканувати штрихкод камерою"
                                            aria-label="Сканувати штрихкод камерою"
                                            className="sm-scan-btn"
                                        >
                                            <ScanBarcodeIcon />
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="sm-search-submit"
                                        >
                                            {loading ? '...' : 'Знайти'}
                                        </button>
                                    </form>
                                    {renderAutocompleteDropdown(false)}
                                </div>

                                {barcodeLoading && (
                                    <div className="sm-status-banner">Пошук товару за штрихкодом...</div>
                                )}

                                {errorMsg && <div className="sm-error-msg">{errorMsg}</div>}

                                {unfoundBarcode && (
                                    <div className="sm-unfound-box">
                                        <span>Хочете додати цей товар за етикеткою?</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUnfoundBarcode('');
                                                setErrorMsg('');
                                                setActiveTab('CUSTOM');
                                                setIsCreatingCustom(true);
                                            }}
                                            className="sm-unfound-create-btn"
                                        >
                                            ➕ Створити продукт
                                        </button>
                                    </div>
                                )}

                                {renderProductList(results)}
                            </>
                        )}

                        {activeTab === 'CUSTOM' && (
                            <>
                                {!isCreatingCustom ? (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => setIsCreatingCustom(true)}
                                            className="sm-dashed-btn sm-mb-12"
                                        >
                                            + Створити продукт
                                        </button>

                                        <div className="sm-search-rel">
                                            <input
                                                type="text"
                                                value={query}
                                                onFocus={() => query.trim().length >= 2 && setShowSuggestions(true)}
                                                onChange={(e) => setQuery(e.target.value)}
                                                placeholder="Автопошук у моїх продуктах..."
                                                className="sm-search-input sm-search-input--full"
                                            />
                                            {renderAutocompleteDropdown(false)}
                                        </div>

                                        {renderProductList(
                                            customFoods
                                                .filter((f) =>
                                                    !query.trim()
                                                        ? true
                                                        : (f.name || '').toLowerCase().includes(query.trim().toLowerCase())
                                                )
                                                .map(formatCustomForSelect),
                                            false,
                                            handleDeleteCustomFood
                                        )}
                                    </>
                                ) : (
                                    <form onSubmit={handleCreateCustomFood} className="sm-scroll-body">
                                        <h4 className="sm-create-title">Новий продукт (на 100г)</h4>
                                        <input
                                            type="text"
                                            value={newFood.name}
                                            onChange={(e) => setNewFood({ ...newFood, name: e.target.value })}
                                            placeholder="Назва"
                                            className="sm-input sm-mb-12"
                                            required
                                        />
                                        <input
                                            type="number"
                                            value={newFood.calories}
                                            onChange={(e) => setNewFood({ ...newFood, calories: e.target.value })}
                                            placeholder="Ккал"
                                            className="sm-input sm-mb-12"
                                            required
                                        />
                                        <div className="sm-grid-3-macros">
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={newFood.proteins}
                                                onChange={(e) => setNewFood({ ...newFood, proteins: e.target.value })}
                                                placeholder="Білки"
                                                className="sm-input"
                                                required
                                            />
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={newFood.fats}
                                                onChange={(e) => setNewFood({ ...newFood, fats: e.target.value })}
                                                placeholder="Жири"
                                                className="sm-input"
                                                required
                                            />
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={newFood.carbs}
                                                onChange={(e) => setNewFood({ ...newFood, carbs: e.target.value })}
                                                placeholder="Вуглеводи"
                                                className="sm-input"
                                                required
                                            />
                                        </div>
                                        <div className="sm-footer-actions sm-footer-actions--plain">
                                            <button
                                                type="button"
                                                onClick={() => setIsCreatingCustom(false)}
                                                className="sm-btn-secondary"
                                            >
                                                Скасувати
                                            </button>
                                            <button type="submit" className="sm-btn-primary">
                                                Зберегти
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </>
                        )}

                        {activeTab === 'RECIPE' && recipeStep === 'LIST' && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuery('');
                                        setShowSuggestions(false);
                                        setRecipeStep('FORM');
                                    }}
                                    className="sm-dashed-btn sm-dashed-btn--amber sm-mb-12"
                                >
                                    + Створити рецепт
                                </button>

                                <div className="sm-search-rel">
                                    <div className="sm-clear-input-wrap">
                                        <input
                                            type="text"
                                            value={query}
                                            onFocus={() => query.trim().length >= 2 && setShowSuggestions(true)}
                                            onChange={(e) => setQuery(e.target.value)}
                                            placeholder="Пошук по рецептах (назва або інгредієнт)..."
                                            className="sm-search-input sm-search-input--clearable"
                                        />
                                        {query && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setQuery('');
                                                    setShowSuggestions(false);
                                                    fetchRecipes('');
                                                }}
                                                title="Очистити пошук"
                                                className="sm-clear-btn"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    {renderAutocompleteDropdown(false)}
                                </div>

                                <div className="sm-products-grid">
                                    {filteredRecipes.map((recipe) => {
                                        const rProduct = { ...recipe, isRecipe: true };
                                        const { rating, level } = calculateHealthRating(rProduct);
                                        return (
                                            <div
                                                key={recipe.id}
                                                className="sm-product-card sm-product-card--recipe"
                                                onClick={() => selectRecipe(recipe)}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={(e) => handleDeleteRecipe(e, recipe.id)}
                                                    title="Видалити рецепт"
                                                    className="sm-card-delete-btn"
                                                >
                                                    🗑️
                                                </button>
                                                <span className={`sm-rating-badge sm-rating--${level}`}>
                                                    {rating}★
                                                </span>
                                                <div className="sm-recipe-emoji">📖</div>
                                                <h5 className="sm-product-title sm-product-title--recipe">
                                                    {recipe.title}
                                                </h5>
                                                <p className="sm-product-kcal sm-product-kcal--amber">
                                                    {recipe.calories} ккал
                                                </p>
                                            </div>
                                        );
                                    })}
                                    {filteredRecipes.length === 0 && (
                                        <p className="sm-empty-msg">
                                            {query.trim()
                                                ? 'За вашим запитом рецептів не знайдено.'
                                                : 'Немає збережених рецептів.'}
                                        </p>
                                    )}
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>

            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onDetected={handleBarcodeDetected}
                theme={theme}
            />
        </div>
    );
};

export default SearchModal;