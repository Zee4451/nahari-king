// Inventory & Recipe/BOM Service Layer
// ================================================
// Manages inventory items, recipes (Bill of Materials), purchase records,
// and production execution with real-time Firestore sync.

import { db } from '../firebase';
import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    query,
    orderBy,
    writeBatch,
    serverTimestamp,
    where,
    Timestamp,
    setDoc,
    increment
} from 'firebase/firestore';

// Helper for local date keys
export const getLocalDateString = (d = new Date()) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// Collection references
const inventoryCollection = collection(db, 'inventory_items');
const recipesCollection = collection(db, 'recipes');
const purchaseRecordsCollection = collection(db, 'purchase_records');
const wasteEntriesCollection = collection(db, 'waste_entries');

// ================================================
// INVENTORY ITEMS
// ================================================

/**
 * Subscribe to real-time inventory updates
 * @param {Function} callback - Called with array of inventory items on each change
 * @returns {Function} Unsubscribe function
 */
export function subscribeToInventory(callback) {
    const q = query(inventoryCollection, orderBy('name'));
    return onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })).sort((a, b) => {
            // Sort by category first, then by name if categories are the same
            const categoryComparison = (a.category || '').localeCompare(b.category || '');
            if (categoryComparison !== 0) {
                return categoryComparison;
            }
            return (a.name || '').localeCompare(b.name || '');
        });
        callback(items);
    }, (error) => {
        console.error('Error subscribing to inventory:', error);
    });
}

/**
 * Add a new inventory item
 * @param {Object} data - { name, unit, currentStock, costPerUnit, reorderLevel, category }
 * @returns {string} New document ID
 */
export async function addInventoryItem(data) {
    const docRef = await addDoc(inventoryCollection, {
        name: data.name.trim(),
        unit: data.unit,
        currentStock: Number(data.currentStock) || 0,
        costPerUnit: Number(data.costPerUnit) || 0,
        reorderLevel: Number(data.reorderLevel) || 0,
        category: data.category || 'other',
        lastUpdated: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Update an existing inventory item
 * @param {string} id - Document ID
 * @param {Object} data - Fields to update
 */
export async function updateInventoryItem(id, data) {
    const docRef = doc(db, 'inventory_items', id);
    await updateDoc(docRef, {
        ...data,
        lastUpdated: serverTimestamp()
    });
}

/**
 * Delete an inventory item
 * @param {string} id - Document ID
 */
export async function deleteInventoryItem(id) {
    const docRef = doc(db, 'inventory_items', id);
    await deleteDoc(docRef);
}

// ================================================
// PURCHASE RECORDS (Stock-In)
// ================================================

/**
 * Record a purchase — adds stock to an inventory item and logs the purchase
 * @param {Object} data - { inventoryItemId, itemName, quantity, unitCost }
 * @returns {string} Purchase record ID
 */
export async function addPurchaseRecord(data) {
    const batch = writeBatch(db);

    // 1. Create purchase record
    const purchaseRef = doc(purchaseRecordsCollection);
    batch.set(purchaseRef, {
        inventoryItemId: data.inventoryItemId,
        itemName: data.itemName,
        quantity: Number(data.quantity),
        unitCost: Number(data.unitCost),
        totalCost: Number(data.quantity) * Number(data.unitCost),
        purchaseDate: serverTimestamp()
    });

    // 2. Increment stock on the inventory item
    const itemRef = doc(db, 'inventory_items', data.inventoryItemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error('Inventory item not found');

    const currentStock = itemSnap.data().currentStock || 0;
    batch.update(itemRef, {
        currentStock: currentStock + Number(data.quantity),
        costPerUnit: Number(data.unitCost), // Update latest cost
        lastUpdated: serverTimestamp()
    });

    await batch.commit();
    return purchaseRef.id;
}

/**
 * Subscribe to purchase records for a specific item
 * @param {string} inventoryItemId
 * @param {Function} callback
 * @returns {Function} Unsubscribe
 */
export function subscribeToPurchaseRecords(inventoryItemId, callback) {
    const q = query(
        purchaseRecordsCollection,
        where('inventoryItemId', '==', inventoryItemId),
        orderBy('purchaseDate', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
        const records = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(records);
    });
}

// ================================================
// WASTE RECORDS (Stock-Out/Loss)
// ================================================

/**
 * Record waste — deducts stock from an inventory item and logs the waste
 * @param {Object} data - { inventoryItemId, itemName, quantity, reason, unitCost }
 * @returns {string} Waste record ID
 */
export async function addWasteEntry(data) {
    const batch = writeBatch(db);

    // 1. Create waste record
    const wasteRef = doc(wasteEntriesCollection);
    batch.set(wasteRef, {
        inventoryItemId: data.inventoryItemId,
        itemName: data.itemName,
        quantity: Number(data.quantity),
        reason: data.reason || 'Not specified',
        unitCost: Number(data.unitCost),
        totalCost: Number(data.quantity) * Number(data.unitCost),
        wasteDate: serverTimestamp()
    });

    // 2. Decrement stock on the inventory item
    const itemRef = doc(db, 'inventory_items', data.inventoryItemId);
    const itemSnap = await getDoc(itemRef);
    if (!itemSnap.exists()) throw new Error('Inventory item not found');

    const currentStock = itemSnap.data().currentStock || 0;
    const newStock = Math.max(0, currentStock - Number(data.quantity));

    batch.update(itemRef, {
        currentStock: newStock,
        lastUpdated: serverTimestamp()
    });

    // 3. Update daily_metrics for Wastage Loss (MVP Spark Client-Side)
    const dateStr = getLocalDateString();
    const totalWastageCost = Number(data.quantity) * Number(data.unitCost);
    batch.set(doc(db, 'daily_metrics', dateStr), {
        date: dateStr,
        totalWastageLoss: increment(totalWastageCost),
        lastUpdated: serverTimestamp()
    }, { merge: true });

    await batch.commit();
    return wasteRef.id;
}

// ================================================
// RECIPES (Bill of Materials)
// ================================================

/**
 * Subscribe to real-time recipe updates
 * @param {Function} callback - Called with array of recipes on each change
 * @returns {Function} Unsubscribe function
 */
export function subscribeToRecipes(callback) {
    const q = query(recipesCollection, orderBy('name'));
    return onSnapshot(q, (snapshot) => {
        const recipes = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(recipes);
    }, (error) => {
        console.error('Error subscribing to recipes:', error);
    });
}

/**
 * Add a new recipe
 * @param {Object} data - { name, outputQuantity, outputUnit, ingredients[], linkedMenuItemId? }
 *   ingredients: [{ inventoryItemId, name, quantity, unit }]
 * @returns {string} New document ID
 */
export async function addRecipe(data) {
    const docRef = await addDoc(recipesCollection, {
        name: data.name.trim(),
        outputQuantity: Number(data.outputQuantity),
        outputUnit: data.outputUnit,
        ingredients: data.ingredients.map(ing => ({
            inventoryItemId: ing.inventoryItemId,
            name: ing.name,
            quantity: Number(ing.quantity),
            unit: ing.unit
        })),
        linkedMenuItemId: data.linkedMenuItemId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Update an existing recipe
 * @param {string} id - Document ID
 * @param {Object} data - Fields to update
 */
export async function updateRecipe(id, data) {
    const docRef = doc(db, 'recipes', id);
    const updateData = { ...data, updatedAt: serverTimestamp() };
    if (data.ingredients) {
        updateData.ingredients = data.ingredients.map(ing => ({
            inventoryItemId: ing.inventoryItemId,
            name: ing.name,
            quantity: Number(ing.quantity),
            unit: ing.unit
        }));
    }
    await updateDoc(docRef, updateData);
}

/**
 * Delete a recipe
 * @param {string} id - Document ID
 */
export async function deleteRecipe(id) {
    const docRef = doc(db, 'recipes', id);
    await deleteDoc(docRef);
}

// ================================================
// BOM CALCULATOR (Pure Function)
// ================================================

/**
 * Calculate Bill of Materials for a target quantity
 * @param {Object} recipe - Recipe object with ingredients[]
 * @param {number} targetQuantity - Desired output quantity
 * @param {Array} inventoryItems - Current inventory items array
 * @returns {Object} { scaledIngredients[], totalCost, allInStock, multiplier }
 */
export function calculateBOM(recipe, targetQuantity, inventoryItems) {
    const multiplier = targetQuantity / recipe.outputQuantity;

    const scaledIngredients = recipe.ingredients.map(ingredient => {
        const requiredQty = ingredient.quantity * multiplier;
        const inventoryItem = inventoryItems.find(
            item => item.id === ingredient.inventoryItemId
        );

        const currentStock = inventoryItem ? inventoryItem.currentStock : 0;
        const costPerUnit = inventoryItem ? inventoryItem.costPerUnit : 0;
        const ingredientCost = requiredQty * costPerUnit;
        const sufficient = currentStock >= requiredQty;
        const deficit = sufficient ? 0 : requiredQty - currentStock;

        return {
            inventoryItemId: ingredient.inventoryItemId,
            name: ingredient.name,
            unit: ingredient.unit,
            requiredQty: Math.round(requiredQty * 1000) / 1000, // 3 decimal precision
            currentStock,
            costPerUnit,
            ingredientCost: Math.round(ingredientCost * 100) / 100,
            sufficient,
            deficit: Math.round(deficit * 1000) / 1000
        };
    });

    const totalCost = scaledIngredients.reduce(
        (sum, ing) => sum + ing.ingredientCost, 0
    );
    const allInStock = scaledIngredients.every(ing => ing.sufficient);

    return {
        recipeName: recipe.name,
        targetQuantity,
        outputUnit: recipe.outputUnit,
        multiplier: Math.round(multiplier * 100) / 100,
        scaledIngredients,
        totalCost: Math.round(totalCost * 100) / 100,
        allInStock
    };
}

// ================================================
// PRODUCTION EXECUTION
// ================================================

/**
 * Execute production — deduct ingredients from inventory stock
 * @param {Object} recipe - Recipe object
 * @param {number} targetQuantity - Quantity being produced
 * @param {Array} inventoryItems - Current inventory for validation
 * @returns {Object} Production result summary
 */
export async function executeProduction(recipe, targetQuantity, inventoryItems) {
    const bom = calculateBOM(recipe, targetQuantity, inventoryItems);

    if (!bom.allInStock) {
        const shortages = bom.scaledIngredients
            .filter(ing => !ing.sufficient)
            .map(ing => `${ing.name}: need ${ing.requiredQty} ${ing.unit}, have ${ing.currentStock}`)
            .join(', ');
        throw new Error(`Insufficient stock: ${shortages}`);
    }

    const batch = writeBatch(db);

    // 1. Deduct each ingredient from inventory
    for (const ingredient of bom.scaledIngredients) {
        const itemRef = doc(db, 'inventory_items', ingredient.inventoryItemId);
        const newStock = ingredient.currentStock - ingredient.requiredQty;
        batch.update(itemRef, {
            currentStock: Math.round(newStock * 1000) / 1000,
            lastUpdated: serverTimestamp()
        });
    }

    // 2. Log usage
    const usageRef = doc(collection(db, 'usage_logs'));
    batch.set(usageRef, {
        recipeId: recipe.id,
        recipeName: recipe.name,
        targetQuantity,
        outputUnit: recipe.outputUnit,
        multiplier: bom.multiplier,
        ingredients: bom.scaledIngredients.map(ing => ({
            inventoryItemId: ing.inventoryItemId,
            name: ing.name,
            quantityUsed: ing.requiredQty,
            unit: ing.unit
        })),
        totalCost: bom.totalCost,
        timestamp: serverTimestamp()
    });

    // 3. Update daily_metrics for COGS (MVP Spark Client-Side)
    const dateStr = getLocalDateString();
    batch.set(doc(db, 'daily_metrics', dateStr), {
        date: dateStr,
        totalCOGS: increment(bom.totalCost),
        lastUpdated: serverTimestamp()
    }, { merge: true });

    await batch.commit();

    return {
        success: true,
        recipeName: recipe.name,
        quantityProduced: targetQuantity,
        outputUnit: recipe.outputUnit,
        totalCost: bom.totalCost,
        ingredientsUsed: bom.scaledIngredients.length
    };
}

// ================================================
// ANALYTICS & REPORTING
// ================================================

/**
 * Fetch aggregated analytics data within a specific date range
 * @param {Date} startDate - Start of the reporting period
 * @param {Date} endDate - End of the reporting period
 * @returns {Object} Object containing arrays of purchases, usage logs, and waste entries
 */
export async function getAnalyticsData(startDate, endDate) {
    // Convert JS Dates to Firebase Timestamps
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    try {
        // 1. Fetch Purchase Records (Inflow)
        const purchasesQuery = query(
            purchaseRecordsCollection,
            where('purchaseDate', '>=', startTimestamp),
            where('purchaseDate', '<=', endTimestamp),
            orderBy('purchaseDate', 'desc')
        );
        const purchaseSnapshot = await getDocs(purchasesQuery);
        const purchases = purchaseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 2. Fetch Usage Logs (Utilization)
        const usageQuery = query(
            collection(db, 'usage_logs'),
            where('timestamp', '>=', startTimestamp),
            where('timestamp', '<=', endTimestamp),
            orderBy('timestamp', 'desc')
        );
        const usageSnapshot = await getDocs(usageQuery);
        const usages = usageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 3. Fetch Waste Entries (Loss)
        const wasteQuery = query(
            wasteEntriesCollection,
            where('wasteDate', '>=', startTimestamp),
            where('wasteDate', '<=', endTimestamp),
            orderBy('wasteDate', 'desc')
        );
        const wasteSnapshot = await getDocs(wasteQuery);
        const waste = wasteSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // 4. Fetch Daily Metrics (for Item Sales Aggregation)
        const startStr = getLocalDateString(startDate);
        const endStr = getLocalDateString(endDate);
        const metricsQuery = query(
            collection(db, 'daily_metrics'),
            where('date', '>=', startStr),
            where('date', '<=', endStr)
        );
        const metricsSnapshot = await getDocs(metricsQuery);
        const metricsDocs = metricsSnapshot.docs.map(doc => doc.data());

        return {
            purchases,
            usages,
            waste,
            metricsDocs

        };
    } catch (error) {
        console.error("Error fetching analytics data:", error);
        throw error;
    }
}
