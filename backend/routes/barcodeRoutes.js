// backend/routes/barcodeRoutes.js
const express = require('express');
const router = express.Router();

function parseNumber(val) {
    const num = Number(val);
    return Number.isFinite(num) && num >= 0 ? num : 0;
}

// GET /api/barcode/:code
router.get('/:code', async (req, res) => {
    const cleanCode = String(req.params.code || '').replace(/\D/g, '');

    if (!cleanCode || cleanCode.length < 6 || cleanCode.length > 14) {
        return res.status(400).json({ error: 'Некоректний формат штрихкоду' });
    }

    try {
        const offUrl = `https://world.openfoodfacts.org/api/v2/product/${cleanCode}.json`;
        const response = await fetch(offUrl, {
            headers: {
                'User-Agent': 'NutriTrackApp/1.0 (https://nutritrack-cu8u.onrender.com)',
            },
        });

        if (!response.ok) {
            return res.status(404).json({ error: 'Продукт за цим штрихкодом не знайдено' });
        }

        const data = await response.json();

        if (data.status !== 1 || !data.product) {
            return res.status(404).json({ error: 'Продукт за цим штрихкодом не знайдено' });
        }

        const p = data.product;
        const n = p.nutriments || {};

        let kcal100 = parseNumber(n['energy-kcal_100g']);
        if (!kcal100 && n['energy_100g']) {
            // Переведення з кДж у ккал, якщо в базі вказані лише кілоджоулі
            kcal100 = Math.round(parseNumber(n['energy_100g']) / 4.184);
        }

        const productName =
            p.product_name_uk ||
            p.product_name ||
            p.generic_name_uk ||
            p.generic_name ||
            `Товар (${cleanCode})`;

        return res.json({
            id: `off-${cleanCode}`,
            barcode: cleanCode,
            product_name: productName.trim(),
            brand: p.brands ? String(p.brands).split(',')[0].trim() : 'Open Food Facts',
            image_url: p.image_front_small_url || p.image_url || 'https://via.placeholder.com/100?text=Barcode',
            description: p.quantity ? `Упаковка: ${p.quantity}` : `Штрихкод: ${cleanCode}`,
            nutriments: {
                'energy-kcal_100g': Math.round(kcal100),
                'proteins_100g': Number(parseNumber(n['proteins_100g']).toFixed(1)),
                'fat_100g': Number(parseNumber(n['fat_100g']).toFixed(1)),
                'carbohydrates_100g': Number(parseNumber(n['carbohydrates_100g']).toFixed(1)),
            },
        });
    } catch (err) {
        console.error('Помилка запиту до Open Food Facts:', err);
        return res.status(502).json({ error: 'Не вдалося перевірити штрихкод у базі' });
    }
});

module.exports = router;