# Firebase Setup for Nalli Nihari POS System

## Prerequisites
- Firebase account (free)
- Firebase project created in Firebase Console

## Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or "Create a project"
3. Enter project name (e.g., "nalli-nihari-pos")
4. Follow the setup process (analytics is optional)
5. Wait for project creation to complete

## Step 2: Enable Firebase Authentication
1. In Firebase Console, click on your project
2. Navigate to **"Authentication"** in the left sidebar
3. Click **"Get Started"** or **"Enable"**
4. Click on the **"Email/Password"** sign-in method
5. Toggle it to **Enabled**
6. Click **"Save"**

## Step 3: Configure Firestore Database
1. In Firebase Console, click on your project
2. Navigate to "Firestore Database" in the left sidebar
3. Click "Create Database"
4. Choose "Start in test mode" (for development) or "Start in production mode"
5. Select your preferred location
6. Click "Enable"

## Step 4: Get Firebase Configuration
1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click on the </> (web) icon to add a web app
4. Enter app nickname (e.g., "nalli-nihari-web")
5. Copy the Firebase configuration object that appears

## Step 5: Update Firebase Configuration
1. Open `src/firebase.js` in your project
2. Replace the placeholder values with your actual Firebase configuration:
```javascript
const firebaseConfig = {
  apiKey: "your_api_key_here",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your_sender_id",
  appId: "your_app_id"
};
```

## Step 6: Create Required Composite Indexes
Firebase requires composite indexes for certain queries to work efficiently. Follow these steps:

### For Inventory Turnover Reports:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `nahari-king`
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Configure with these settings:
   - **Collection ID:** `usage_logs`
   - **Query Scope:** Collection
   - **Fields Indexed:**
     - `itemId` Ascending
     - `timestamp` Descending
6. Click **Create**

### For Purchase Records Queries:
Repeat the above process for the `purchase_records` collection with the same field structure.

### For Waste Entries Queries:
Repeat the above process for the `waste_entries` collection with the same field structure.

Alternatively, you can use the Firebase CLI:
```bash
firebase firestore:indexes > firestore.indexes.json
```
Then deploy the indexes:
```bash
firebase deploy --only firestore:indexes
```

## Step 7: Run the Application
1. Make sure you have installed the dependencies: `npm install`
2. Start the development server: `npm run dev`
3. The application will now use Firebase for authentication and real-time data synchronization

## Troubleshooting
If you encounter the deprecation warning "Firestore (11.10.0): enableIndexedDbPersistence() will be deprecated in the future", the code has been updated to use the new `FirestoreSettings.cache` method instead. The `firebase.js` file already uses `initializeFirestore` with `cacheSizeBytes: CACHE_SIZE_UNLIMITED` for offline persistence.

## Collection Structure
The application uses these Firestore collections:
- `tables`: Stores table data (orders, totals, etc.)
- `history`: Stores order history (cleared orders)
- `users`: Stores user authentication data and permissions
- `inventory_items`: Stores inventory item data
- `purchase_records`: Stores purchase transaction records
- `usage_logs`: Stores inventory usage records
- `waste_entries`: Stores waste/discard records

## Real-time Features
- Changes made on one device will appear immediately on all other devices
- Order history is synchronized across all devices
- Table data is updated in real-time
- Inventory data is synchronized in real-time

## Offline Support
- The application uses Firestore's offline persistence
- Data will be available offline and sync when connection is restored
- Uses IndexedDB for local caching

## Security Rules (Optional but Recommended)
For production, update Firestore security rules:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tables/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
    match /history/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
    match /users/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
    match /inventory_items/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
    match /purchase_records/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
    match /usage_logs/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
    match /waste_entries/{document} {
      allow read, write: if true; // Adjust based on your security needs
    }
  }
}
```

## Common Authentication Issues
1. **"auth/configuration-not-found"**: Authentication service not enabled in Firebase Console
2. **"auth/invalid-api-key"**: Incorrect API key in firebase.js configuration
3. **"auth/network-request-failed"**: Network connectivity issues
4. **"auth/unauthorized-domain"**: Domain not whitelisted in Firebase Console (for production)

Make sure to enable Authentication in Firebase Console as described in Step 2 above.

## Common Index Issues
1. **"The query requires an index"**: Create the required composite indexes as described in Step 6
2. **Index build delays**: Newly created indexes may take a few minutes to become active
3. **Multiple index errors**: Check that all required indexes (usage_logs, purchase_records, waste_entries) are created