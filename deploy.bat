@echo off
REM Nalli Nihari POS Deployment Script for Windows

echo 🚀 Starting Nalli Nihari POS Deployment Process

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: package.json not found. Please run this script from the project root directory.
    exit /b 1
)

REM Install dependencies
echo 📦 Installing dependencies...
npm install

REM Check if gh-pages is installed
npm list gh-pages --depth=0 >nul 2>&1
if %errorlevel% neq 0 (
    echo 📦 Installing gh-pages...
    npm install --save-dev gh-pages
)

REM Build the application
echo 🏗️ Building the application...
npm run build

if %errorlevel% neq 0 (
    echo ❌ Build failed. Please check for errors.
    exit /b 1
)

echo ✅ Build successful!

REM Deploy to GitHub Pages
echo 🚀 Deploying to GitHub Pages...
npm run deploy

if %errorlevel% neq 0 (
    echo ❌ Deployment failed. Please check your GitHub configuration.
    exit /b 1
)

echo ✅ Deployment successful!
echo 🌐 Your application is now live at: https://your-username.github.io/nalli-nihari-pos/

echo.
echo 📝 Next steps:
echo 1. Update your Firebase configuration in the Firebase Console
echo 2. Add your deployment URL to authorized domains in Firebase
echo 3. Set up environment variables in your GitHub repository settings
echo 4. Test all functionality in the deployed application

pause