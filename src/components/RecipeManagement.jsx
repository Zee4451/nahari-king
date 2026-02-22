import React, { useState, useEffect, useMemo } from 'react';
import NavigationBar from './NavigationBar';
import { ErrorBanner, SuccessBanner } from './Reusable/LoadingComponents';
import {
    subscribeToInventory,
    subscribeToRecipes,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    calculateBOM,
    executeProduction
} from '../services/inventoryService';
import styles from './InventoryBOM.module.css';

const UNITS = ['kg', 'g', 'liters', 'ml', 'pieces', 'packets', 'dozen'];

const emptyRecipe = {
    name: '',
    outputQuantity: '',
    outputUnit: 'kg',
    ingredients: [],
    linkedMenuItemId: ''
};

const RecipeManagement = () => {
    const [recipes, setRecipes] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingRecipe, setEditingRecipe] = useState(null);
    const [formData, setFormData] = useState(emptyRecipe);
    const [formLoading, setFormLoading] = useState(false);

    // BOM Calculator state
    const [selectedRecipeId, setSelectedRecipeId] = useState('');
    const [targetQuantity, setTargetQuantity] = useState('');
    const [bomResult, setBomResult] = useState(null);
    const [producing, setProducing] = useState(false);

    // Subscribe to real-time data
    useEffect(() => {
        let loadedCount = 0;
        const checkLoaded = () => {
            loadedCount++;
            if (loadedCount >= 2) setLoading(false);
        };

        const unsubRecipes = subscribeToRecipes((data) => {
            setRecipes(data);
            checkLoaded();
        });
        const unsubInventory = subscribeToInventory((data) => {
            setInventory(data);
            checkLoaded();
        });

        return () => {
            unsubRecipes();
            unsubInventory();
        };
    }, []);

    // Auto-recalculate BOM when inventory changes
    useEffect(() => {
        if (bomResult && selectedRecipeId && targetQuantity) {
            const recipe = recipes.find(r => r.id === selectedRecipeId);
            if (recipe) {
                setBomResult(calculateBOM(recipe, Number(targetQuantity), inventory));
            }
        }
    }, [inventory]);

    // Recipe form handlers
    const openAddModal = () => {
        setEditingRecipe(null);
        setFormData({ ...emptyRecipe, ingredients: [{ inventoryItemId: '', name: '', quantity: '', unit: 'kg' }] });
        setShowModal(true);
    };

    const openEditModal = (recipe) => {
        setEditingRecipe(recipe);
        setFormData({
            name: recipe.name,
            outputQuantity: recipe.outputQuantity,
            outputUnit: recipe.outputUnit,
            ingredients: recipe.ingredients.map(ing => ({ ...ing })),
            linkedMenuItemId: recipe.linkedMenuItemId || ''
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingRecipe(null);
        setFormData(emptyRecipe);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // Ingredient row handlers
    const addIngredientRow = () => {
        setFormData(prev => ({
            ...prev,
            ingredients: [...prev.ingredients, { inventoryItemId: '', name: '', quantity: '', unit: 'kg' }]
        }));
    };

    const removeIngredientRow = (index) => {
        setFormData(prev => ({
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== index)
        }));
    };

    const updateIngredient = (index, field, value) => {
        setFormData(prev => {
            const ingredients = [...prev.ingredients];
            ingredients[index] = { ...ingredients[index], [field]: value };

            // When selecting an inventory item, auto-fill name and unit
            if (field === 'inventoryItemId') {
                const item = inventory.find(i => i.id === value);
                if (item) {
                    ingredients[index].name = item.name;
                    ingredients[index].unit = item.unit;
                }
            }
            return { ...prev, ingredients };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Recipe name is required');
            return;
        }
        if (!formData.outputQuantity || Number(formData.outputQuantity) <= 0) {
            setError('Output quantity must be greater than 0');
            return;
        }
        const validIngredients = formData.ingredients.filter(
            ing => ing.inventoryItemId && Number(ing.quantity) > 0
        );
        if (validIngredients.length === 0) {
            setError('Add at least one ingredient with a valid quantity');
            return;
        }

        setFormLoading(true);
        try {
            const data = {
                name: formData.name.trim(),
                outputQuantity: Number(formData.outputQuantity),
                outputUnit: formData.outputUnit,
                ingredients: validIngredients,
                linkedMenuItemId: formData.linkedMenuItemId
            };

            if (editingRecipe) {
                await updateRecipe(editingRecipe.id, data);
                setSuccess(`"${data.name}" updated`);
            } else {
                await addRecipe(data);
                setSuccess(`"${data.name}" recipe created`);
            }
            closeModal();
        } catch (err) {
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (recipe) => {
        if (!window.confirm(`Delete recipe "${recipe.name}"?`)) return;
        try {
            await deleteRecipe(recipe.id);
            setSuccess(`"${recipe.name}" deleted`);
            if (selectedRecipeId === recipe.id) {
                setSelectedRecipeId('');
                setBomResult(null);
            }
        } catch (err) {
            setError(err.message);
        }
    };

    // BOM Calculator
    const handleCalculateBOM = () => {
        if (!selectedRecipeId) {
            setError('Select a recipe first');
            return;
        }
        if (!targetQuantity || Number(targetQuantity) <= 0) {
            setError('Enter a target quantity greater than 0');
            return;
        }
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe) {
            setError('Recipe not found');
            return;
        }
        const result = calculateBOM(recipe, Number(targetQuantity), inventory);
        setBomResult(result);
    };

    // Production execution
    const handleProduce = async () => {
        if (!bomResult) return;
        const recipe = recipes.find(r => r.id === selectedRecipeId);
        if (!recipe) return;

        if (!window.confirm(
            `Produce ${targetQuantity} ${recipe.outputUnit} of "${recipe.name}"?\n\nThis will deduct ingredients from inventory stock.`
        )) return;

        setProducing(true);
        try {
            const result = await executeProduction(recipe, Number(targetQuantity), inventory);
            setSuccess(
                `Produced ${result.quantityProduced} ${result.outputUnit} of "${result.recipeName}" — ₹${result.totalCost.toFixed(2)} total cost`
            );
            // Recalculate BOM with updated stock
            setBomResult(null);
        } catch (err) {
            setError(err.message);
        } finally {
            setProducing(false);
        }
    };

    // Quick-calculate from recipe card
    const quickCalculate = (recipe) => {
        setSelectedRecipeId(recipe.id);
        setTargetQuantity(recipe.outputQuantity);
        const result = calculateBOM(recipe, recipe.outputQuantity, inventory);
        setBomResult(result);
        // Scroll to calculator
        document.querySelector('.bom-calculator')?.scrollIntoView({ behavior: 'smooth' });
    };

    if (loading) {
        return (
            <div className={styles['recipes-page'] || 'recipes-page'}>
                <NavigationBar currentPage="recipes" />
                <div className={styles['recipes-content'] || 'recipes-content'}>
                    <div className={styles['loading'] || 'loading'}>Loading recipes...</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles['recipes-page'] || 'recipes-page'}>
            <NavigationBar currentPage="recipes" />
            <div className={styles['recipes-content'] || 'recipes-content'}>
                {error && <ErrorBanner message={error} onClose={() => setError('')} />}
                {success && <SuccessBanner message={success} onClose={() => setSuccess('')} autoDismiss={3000} />}

                <div className={styles['recipes-header'] || 'recipes-header'}>
                    <h1>🧾 Recipes & Bill of Materials</h1>
                    <div className={styles['header-actions'] || 'header-actions'}>
                        <button className={styles['btn-primary'] || 'btn-primary'} onClick={openAddModal}>+ New Recipe</button>
                    </div>
                </div>

                {/* Recipe Cards */}
                {recipes.length === 0 ? (
                    <div className={styles['empty-state'] || 'empty-state'}>
                        <p>No recipes yet. Create your first recipe to start using the BOM calculator.</p>
                        <button className={styles['btn-primary'] || 'btn-primary'} onClick={openAddModal}>Create Recipe</button>
                    </div>
                ) : (
                    <div className={styles['recipes-grid'] || 'recipes-grid'}>
                        {recipes.map(recipe => (
                            <div key={recipe.id} className={styles['recipe-card'] || 'recipe-card'}>
                                <div className={styles['recipe-card-header'] || 'recipe-card-header'}>
                                    <h3>{recipe.name}</h3>
                                    <span className={styles['recipe-output'] || 'recipe-output'}>
                                        {recipe.outputQuantity} {recipe.outputUnit}
                                    </span>
                                </div>
                                <div className={styles['recipe-ingredients-preview'] || 'recipe-ingredients-preview'}>
                                    {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                                    {' • '}
                                    {recipe.ingredients.map(i => i.name).join(', ')}
                                </div>
                                <div className={styles['recipe-card-actions'] || 'recipe-card-actions'}>
                                    <button className={`${styles['btn-primary'] || 'btn-primary'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={() => quickCalculate(recipe)}>
                                        Calculate BOM
                                    </button>
                                    <button className={`${styles['btn-secondary'] || 'btn-secondary'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={() => openEditModal(recipe)}>Edit</button>
                                    <button className={`${styles['btn-danger'] || 'btn-danger'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={() => handleDelete(recipe)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* BOM Calculator */}
                <div className={styles['bom-calculator'] || 'bom-calculator'}>
                    <h2>📊 BOM Calculator</h2>
                    <div className={styles['bom-controls'] || 'bom-controls'}>
                        <div className={`${styles['form-group'] || 'form-group'} ${styles['recipe-select'] || 'recipe-select'}`}>
                            <label>Recipe</label>
                            <select
                                value={selectedRecipeId}
                                onChange={(e) => { setSelectedRecipeId(e.target.value); setBomResult(null); }}
                            >
                                <option value="">— Select a recipe —</option>
                                {recipes.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.outputQuantity} {r.outputUnit})</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles['form-group'] || 'form-group'}>
                            <label>Target Quantity</label>
                            <input
                                type="number"
                                value={targetQuantity}
                                onChange={(e) => { setTargetQuantity(e.target.value); setBomResult(null); }}
                                placeholder="e.g. 10"
                                min="0.1"
                                step="0.1"
                            />
                        </div>
                        <div className={styles['form-group'] || 'form-group'}>
                            <label>&nbsp;</label>
                            <button className={styles['btn-primary'] || 'btn-primary'} onClick={handleCalculateBOM}>
                                Calculate
                            </button>
                        </div>
                    </div>

                    {/* BOM Results */}
                    {bomResult && (
                        <div className={styles['bom-results'] || 'bom-results'}>
                            <div className={styles['bom-summary'] || 'bom-summary'}>
                                <div className={styles['bom-stat'] || 'bom-stat'}>
                                    <span className={styles['bom-stat-label'] || 'bom-stat-label'}>Recipe</span>
                                    <span className={styles['bom-stat-value'] || 'bom-stat-value'}>{bomResult.recipeName}</span>
                                </div>
                                <div className={styles['bom-stat'] || 'bom-stat'}>
                                    <span className={styles['bom-stat-label'] || 'bom-stat-label'}>Target</span>
                                    <span className={styles['bom-stat-value'] || 'bom-stat-value'}>{bomResult.targetQuantity} {bomResult.outputUnit}</span>
                                </div>
                                <div className={styles['bom-stat'] || 'bom-stat'}>
                                    <span className={styles['bom-stat-label'] || 'bom-stat-label'}>Scale Factor</span>
                                    <span className={styles['bom-stat-value'] || 'bom-stat-value'}>{bomResult.multiplier}x</span>
                                </div>
                                <div className={styles['bom-stat'] || 'bom-stat'}>
                                    <span className={styles['bom-stat-label'] || 'bom-stat-label'}>Total Cost</span>
                                    <span className={`${styles['bom-stat-value'] || 'bom-stat-value'} ${styles['cost'] || 'cost'}`}>₹{bomResult.totalCost.toFixed(2)}</span>
                                </div>
                                <div className={styles['bom-stat'] || 'bom-stat'}>
                                    <span className={styles['bom-stat-label'] || 'bom-stat-label'}>Stock Status</span>
                                    <span className={`bom-stat-value ${bomResult.allInStock ? 'in-stock' : 'short'}`}>
                                        {bomResult.allInStock ? '✅ All Available' : '❌ Shortage'}
                                    </span>
                                </div>
                            </div>

                            <table className={styles['bom-table'] || 'bom-table'}>
                                <thead>
                                    <tr>
                                        <th>Ingredient</th>
                                        <th>Required</th>
                                        <th>In Stock</th>
                                        <th>Cost/Unit</th>
                                        <th>Line Cost</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {bomResult.scaledIngredients.map((ing, i) => (
                                        <tr key={i} className={!ing.sufficient ? 'insufficient' : ''}>
                                            <td><strong>{ing.name}</strong></td>
                                            <td>{ing.requiredQty} {ing.unit}</td>
                                            <td>{ing.currentStock} {ing.unit}</td>
                                            <td>₹{ing.costPerUnit.toFixed(2)}</td>
                                            <td>₹{ing.ingredientCost.toFixed(2)}</td>
                                            <td>
                                                {ing.sufficient ? (
                                                    <span className={styles['status-icon'] || 'status-icon'} title="Sufficient">✅</span>
                                                ) : (
                                                    <span className={styles['status-icon'] || 'status-icon'} title={`Short by ${ing.deficit} ${ing.unit}`}>
                                                        ❌ -{ing.deficit}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className={styles['bom-produce-bar'] || 'bom-produce-bar'}>
                                <button
                                    className={styles['btn-success'] || 'btn-success'}
                                    onClick={handleProduce}
                                    disabled={!bomResult.allInStock || producing}
                                    title={!bomResult.allInStock ? 'Cannot produce — insufficient stock' : 'Deduct ingredients from stock'}
                                >
                                    {producing ? 'Producing...' : `🏭 Produce ${bomResult.targetQuantity} ${bomResult.outputUnit}`}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Add/Edit Recipe Modal */}
                {showModal && (
                    <div className={styles['modal-overlay'] || 'modal-overlay'} onClick={closeModal}>
                        <div className={styles['modal-content'] || 'modal-content'} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
                            <h2>{editingRecipe ? 'Edit Recipe' : 'New Recipe'}</h2>
                            <form onSubmit={handleSubmit}>
                                <div className={styles['form-group'] || 'form-group'}>
                                    <label>Recipe Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleFormChange('name', e.target.value)}
                                        placeholder="e.g. Nalli Nihari"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className={styles['form-row'] || 'form-row'}>
                                    <div className={styles['form-group'] || 'form-group'}>
                                        <label>Output Quantity *</label>
                                        <input
                                            type="number"
                                            value={formData.outputQuantity}
                                            onChange={(e) => handleFormChange('outputQuantity', e.target.value)}
                                            placeholder="e.g. 10"
                                            min="0.1"
                                            step="0.1"
                                            required
                                        />
                                    </div>
                                    <div className={styles['form-group'] || 'form-group'}>
                                        <label>Output Unit</label>
                                        <select
                                            value={formData.outputUnit}
                                            onChange={(e) => handleFormChange('outputUnit', e.target.value)}
                                        >
                                            {UNITS.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Ingredients */}
                                <div className={styles['ingredients-section'] || 'ingredients-section'}>
                                    <h3>Ingredients</h3>
                                    {formData.ingredients.map((ing, index) => (
                                        <div key={index} className={styles['ingredient-row'] || 'ingredient-row'}>
                                            <select
                                                value={ing.inventoryItemId}
                                                onChange={(e) => updateIngredient(index, 'inventoryItemId', e.target.value)}
                                            >
                                                <option value="">— Select item —</option>
                                                {inventory.map(item => (
                                                    <option key={item.id} value={item.id}>
                                                        {item.name} ({item.currentStock} {item.unit})
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                value={ing.quantity}
                                                onChange={(e) => updateIngredient(index, 'quantity', e.target.value)}
                                                placeholder="Qty"
                                                min="0.001"
                                                step="0.001"
                                            />
                                            <span style={{ fontSize: '0.85rem', color: '#888', alignSelf: 'center' }}>
                                                {ing.unit || 'unit'}
                                            </span>
                                            <button
                                                type="button"
                                                className={styles['remove-ingredient-btn'] || 'remove-ingredient-btn'}
                                                onClick={() => removeIngredientRow(index)}
                                                title="Remove ingredient"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                    <button type="button" className={styles['add-ingredient-btn'] || 'add-ingredient-btn'} onClick={addIngredientRow}>
                                        + Add Ingredient
                                    </button>
                                </div>

                                <div className={styles['form-actions'] || 'form-actions'}>
                                    <button type="button" className={styles['btn-secondary'] || 'btn-secondary'} onClick={closeModal} disabled={formLoading}>
                                        Cancel
                                    </button>
                                    <button type="submit" className={styles['btn-primary'] || 'btn-primary'} disabled={formLoading}>
                                        {formLoading ? 'Saving...' : (editingRecipe ? 'Update Recipe' : 'Create Recipe')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecipeManagement;
