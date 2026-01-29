# Firestore Composite Indexes Setup Guide

This document explains how to create the necessary composite indexes in Firebase Firestore to support the inventory management reporting queries that are currently failing.

## Required Composite Indexes

Based on the functions in `firebaseService.js`, you need to create the following composite indexes in your Firebase Console:

### 1. Index for `usage_logs` collection
- **Collection ID**: `usage_logs`
- **Fields**:
  - `itemId` (Ascending)
  - `timestamp` (Descending)
- **Purpose**: Supports `getItemUsageRecordsByDateRange` function

### 2. Index for `purchase_records` collection
- **Collection ID**: `purchase_records`
- **Fields**:
  - `itemId` (Ascending)
  - `timestamp` (Descending)
- **Purpose**: Supports `getItemPurchaseRecordsByDateRange` function

### 3. Index for `waste_entries` collection
- **Collection ID**: `waste_entries`
- **Fields**:
  - `itemId` (Ascending)
  - `timestamp` (Descending)
- **Purpose**: Supports `getItemWasteRecordsByDateRange` function

## Step-by-Step Instructions to Create Composite Indexes

### Step 1: Access Firebase Console
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click on "Firestore Database" in the left sidebar
4. Click on the "Indexes" tab (next to "Data")

### Step 2: Create Each Index
For each index, follow these steps:

#### Index 1: usage_logs
1. Click "Create Index"
2. Select "Composite Index"
3. Enter Collection ID: `usage_logs`
4. Add Field:
   - Field: `itemId`
   - Mode: Ascending
5. Add Field:
   - Field: `timestamp`
   - Mode: Descending
6. Click "Create Index"

#### Index 2: purchase_records
1. Click "Create Index"
2. Select "Composite Index"
3. Enter Collection ID: `purchase_records`
4. Add Field:
   - Field: `itemId`
   - Mode: Ascending
5. Add Field:
   - Field: `timestamp`
   - Mode: Descending
6. Click "Create Index"

#### Index 3: waste_entries
1. Click "Create Index"
2. Select "Composite Index"
3. Enter Collection ID: `waste_entries`
4. Add Field:
   - Field: `itemId`
   - Mode: Ascending
5. Add Field:
   - Field: `timestamp`
   - Mode: Descending
6. Click "Create Index"

## Important Notes

1. **Index Creation Time**: Firestore indexes can take a few minutes to build after creation. During this time, queries that rely on these indexes may still fail.

2. **Index Building Status**: You can monitor the index building progress in the Firebase Console. The status will change from "Building" to "Ready" when complete.

3. **Query Structure**: These indexes are specifically designed to support queries that:
   - Filter by `itemId` (equality)
   - Filter by `timestamp` (range comparison with >= and <=)
   - Order by `timestamp` (descending)

4. **Related Functions**: These indexes will fix the following functions:
   - `getItemUsageRecordsByDateRange`
   - `getItemPurchaseRecordsByDateRange`
   - `getItemWasteRecordsByDateRange`
   - All functions that depend on these (e.g., reports)

## Verification

After the indexes are built (showing "Ready" status), you can verify they're working by:

1. Testing the monthly report generation feature
2. Checking that date-range queries for specific items work properly
3. Confirming that all inventory reports generate without errors

## Troubleshooting

If you still encounter errors after creating the indexes:

1. Wait for all indexes to show "Ready" status in the Firebase Console
2. Make sure your queries match the index structure exactly
3. Check that the field names in your queries match the indexed fields exactly
4. Ensure your security rules allow the queries

## Impact

Creating these indexes will enable:
- Proper functioning of all inventory reports
- Accurate monthly inventory and expense reports
- Efficient date-range queries for specific inventory items
- Better performance for usage, purchase, and waste tracking