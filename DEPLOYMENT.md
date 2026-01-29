# Nalli Nihari POS System Deployment Guide

## Table of Contents
1. [GitHub Pages Deployment](#github-pages-deployment)
2. [Netlify Deployment](#netlify-deployment)
3. [Firebase Configuration](#firebase-configuration)
4. [Environment Variables](#environment-variables)
5. [Post-Deployment Verification](#post-deployment-verification)

## GitHub Pages Deployment

### Step 1: Configure Vite for GitHub Pages
Create or update `vite.config.js` with GitHub Pages base path:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/nalli-nihari-pos/', // Replace with your repository name
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth']
        }
      }
    }
  }
})
```

### Step 2: Update package.json scripts
Add deployment scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && gh-pages -d dist"
  },
  "devDependencies": {
    "gh-pages": "^6.1.1"
  }
}
```

### Step 3: Install gh-pages
```bash
npm install --save-dev gh-pages
```

### Step 4: Create GitHub Repository
1. Create a new repository on GitHub named `nalli-nihari-pos`
2. Initialize local repository:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/nalli-nihari-pos.git
git push -u origin main
```

### Step 5: Deploy to GitHub Pages
```bash
npm run deploy
```

### Step 6: Configure GitHub Pages
1. Go to your repository settings on GitHub
2. Navigate to "Pages" section
3. Select "GitHub Actions" as source
4. Your site will be available at: `https://your-username.github.io/nalli-nihari-pos/`

## Netlify Deployment

### Step 1: Create Netlify Account
1. Sign up at [netlify.com](https://netlify.com)
2. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

### Step 2: Configure for Netlify
Create `netlify.toml` in project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"
  base = "/"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[functions]
  directory = "netlify/functions"

[dev]
  command = "npm run dev"
  port = 5173
  targetPort = 5173
```

### Step 3: Deploy via Netlify CLI
```bash
# Login to Netlify
netlify login

# Initialize and deploy
netlify init
netlify deploy --prod
```

### Step 4: Alternative: Deploy via Git
1. Push your code to GitHub
2. Connect GitHub repository to Netlify
3. Netlify will automatically build and deploy on each push

## Firebase Configuration

### Step 1: Update Firebase Configuration
Ensure your `src/firebase.js` is properly configured:

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
```

### Step 2: Configure Firebase for Production
In Firebase Console:
1. Add your deployment URLs to authorized domains:
   - GitHub Pages: `your-username.github.io`
   - Netlify: `your-app-name.netlify.app`

2. Enable required Firebase services:
   - Firestore Database
   - Authentication (Email/Password)
   - Storage (if needed)

### Step 3: Create Required Firestore Indexes
Deploy the composite indexes from `firestore.indexes.json`:

```bash
firebase deploy --only firestore:indexes
```

## Environment Variables

### Create .env files
Create `.env.production` for production builds:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### For GitHub Pages
Add environment variables in GitHub repository settings:
1. Go to Settings → Secrets and variables → Actions
2. Add each environment variable as a repository secret

### For Netlify
Add environment variables in Netlify dashboard:
1. Go to Site settings → Environment variables
2. Add each environment variable

## Post-Deployment Verification

### Test All Functionality
1. **Authentication**: Test login/logout functionality
2. **Real-time Sync**: Make changes on one device, verify they appear on another
3. **Table Management**: Create, edit, and delete tables
4. **Order Processing**: Add items, modify quantities, clear orders
5. **Menu Management**: Add, edit, delete, and reorder menu items
6. **History**: Verify order history is recorded and displayed
7. **Inventory Management**: Test all inventory sections if enabled
8. **Responsive Design**: Test on mobile, tablet, and desktop

### Performance Testing
1. Verify load times are acceptable
2. Test offline functionality
3. Check real-time updates work smoothly
4. Verify all Firebase operations complete within SLA targets

### Troubleshooting Common Issues
1. **404 Errors**: Check base path configuration
2. **Firebase Connection**: Verify environment variables are set
3. **Authentication Issues**: Check authorized domains in Firebase Console
4. **Real-time Sync**: Ensure Firestore rules allow read/write operations

## Maintenance

### Updates
1. Make changes locally
2. Test thoroughly
3. Commit and push to deploy
4. Monitor deployment status

### Monitoring
1. Set up Firebase Performance Monitoring
2. Configure error reporting
3. Monitor usage analytics
4. Set up alerts for critical issues

## Security Considerations

1. Never commit sensitive credentials to version control
2. Use environment variables for all secrets
3. Regularly rotate API keys
4. Monitor Firebase usage and set budget alerts
5. Keep dependencies updated
6. Implement proper Firestore security rules

## Backup Strategy

1. Regular database exports
2. Version control for all code changes
3. Document configuration changes
4. Maintain deployment scripts and documentation