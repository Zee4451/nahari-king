#!/bin/bash

# Nalli Nihari POS Deployment Script

echo "🚀 Starting Nalli Nihari POS Deployment Process"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if gh-pages is installed
if ! npm list gh-pages --depth=0 > /dev/null 2>&1; then
    echo "📦 Installing gh-pages..."
    npm install --save-dev gh-pages
fi

# Build the application
echo "🏗️ Building the application..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check for errors."
    exit 1
fi

echo "✅ Build successful!"

# Deploy to GitHub Pages
echo "🚀 Deploying to GitHub Pages..."
npm run deploy

if [ $? -ne 0 ]; then
    echo "❌ Deployment failed. Please check your GitHub configuration."
    exit 1
fi

echo "✅ Deployment successful!"
echo "🌐 Your application is now live at: https://your-username.github.io/nalli-nihari-pos/"

echo ""
echo "📝 Next steps:"
echo "1. Update your Firebase configuration in the Firebase Console"
echo "2. Add your deployment URL to authorized domains in Firebase"
echo "3. Set up environment variables in your GitHub repository settings"
echo "4. Test all functionality in the deployed application"