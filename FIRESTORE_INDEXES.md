# Required Firestore Composite Indexes

This document lists all the composite indexes required for the Nalli Nihari POS application to function properly, particularly for inventory reporting features.

## Index for Inventory Turnover Reports

**Error Location:** `getItemUsageRecordsByDateRange` function in `firebaseService.js` (line 1095-1101)

**Query Structure:**
- Collection: `usage_logs`
- Filters: 
  - `itemId` == [some_value]
  - `timestamp` >= [start_timestamp]
  - `timestamp` <= [end_timestamp]
- Order By: `timestamp` descending

**Required Index Configuration:**

```json
{
  "collectionGroup": "usage_logs",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "itemId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "timestamp",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "timestamp",
      "order": "DESCENDING"
    }
  ]
}
```

**Alternative Index Configuration (if the above doesn't work):**

```json
{
  "collectionGroup": "usage_logs",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "itemId",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "timestamp",
      "order": "DESCENDING"
    }
  ]
}
```

## How to Create the Index

### Method 1: Through Firebase Console (Recommended)

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `nahari-king`
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Configure the index with the settings above
6. Click **Create**

### Method 2: Using Firebase CLI

If you have the Firebase CLI installed:

```bash
firebase firestore:indexes > firestore.indexes.json
```

Then add the index configuration to your `firestore.indexes.json` file and deploy:

```bash
firebase deploy --only firestore:indexes
```

## Other Required Indexes

### For Purchase Records Query
Similar index needed for `getItemPurchaseRecordsByDateRange` function:

**Collection:** `purchase_records`
**Filters:** `itemId` == [value], `timestamp` >= [start], `timestamp` <= [end]
**Order By:** `timestamp` descending

### For Waste Entries Query  
Similar index needed for `getItemWasteRecordsByDateRange` function:

**Collection:** `waste_entries`
**Filters:** `itemId` == [value], `timestamp` >= [start], `timestamp` <= [end]
**Order By:** `timestamp` descending

## Troubleshooting

If you continue to see index errors:

1. **Check the exact error message** - Firebase usually provides a direct link to create the required index
2. **Wait for index creation** - Indexes can take a few minutes to build
3. **Verify field names** - Make sure `itemId` and `timestamp` match exactly in your data
4. **Check query structure** - Ensure your queries match the indexed fields exactly

## Testing

After creating the indexes, test the inventory turnover report functionality:

1. Navigate to Settings → Inventory & Expenses → Reports
2. Select "Inventory Turnover" report type
3. Set a date range and generate the report
4. Verify no FirebaseError occurs

The reports should now generate successfully without index errors.