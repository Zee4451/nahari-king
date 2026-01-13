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

## Step 2: Configure Firestore Database
1. In Firebase Console, click on your project
2. Navigate to "Firestore Database" in the left sidebar
3. Click "Create Database"
4. Choose "Start in test mode" (for development) or "Start in production mode"
5. Select your preferred location
6. Click "Enable"

## Step 3: Get Firebase Configuration
1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click on the </> (web) icon to add a web app
4. Enter app nickname (e.g., "nalli-nihari-web")
5. Copy the Firebase configuration object that appears

## Step 4: Update Firebase Configuration
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

## Step 5: Run the Application
1. Make sure you have installed the dependencies: `npm install`
2. Start the development server: `npm run dev`
3. The application will now use Firebase for real-time data synchronization

## Troubleshooting
If you encounter the deprecation warning "Firestore (11.10.0): enableIndexedDbPersistence() will be deprecated in the future", the code has been updated to use the new `FirestoreSettings.cache` method instead. The `firebase.js` file already uses `initializeFirestore` with `cacheSizeBytes: CACHE_SIZE_UNLIMITED` for offline persistence.

## Collection Structure
The application uses two Firestore collections:
- `tables`: Stores table data (orders, totals, etc.)
- `history`: Stores order history (cleared orders)

## Real-time Features
- Changes made on one device will appear immediately on all other devices
- Order history is synchronized across all devices
- Table data is updated in real-time

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
  }
}
```