const fs = require('fs');
const path = require('path');

const convertFile = (filePath, styleImportPath) => {
    let content = fs.readFileSync(filePath, 'utf-8');

    // Replace the import
    content = content.replace(
        new RegExp(`import\\s+['"]\\.?\\/?${styleImportPath.replace('.css', '')}\\.css['"];?`),
        `import styles from './${styleImportPath.replace('.css', '.module.css')}';`
    );

    // Sometimes it's ../ style
    content = content.replace(
        new RegExp(`import\\s+['"]\\.\\.\\/.*?${styleImportPath.replace('.css', '')}\\.css['"];?`),
        `import styles from '../${styleImportPath.replace('.css', '.module.css')}';`
    );

    // Simple naive regex to find className="foo bar". 
    // It captures the stuff inside the quotes.
    const regex = /className\s*=\s*["']([^"']+)["']/g;

    content = content.replace(regex, (match, classNamesStr) => {
        // Split by space
        const classes = classNamesStr.split(/\s+/).filter(Boolean);

        // If there's only one class, e.g., "settings-section"
        if (classes.length === 1) {
            return `className={styles['${classes[0]}'] || '${classes[0]}'}`;
        } else {
            // If multiple classes, we use template literal
            const mapped = classes.map(c => `\${styles['${c}'] || '${c}'}`).join(' ');
            return `className={\`${mapped}\`}`;
        }
    });

    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Converted ${filePath}`);
};

const settingsFiles = [
    'src/components/SettingsPage.jsx',
    'src/components/Settings/MenuManagement.jsx',
    'src/components/Settings/PosConfig.jsx'
];

const inventoryFiles = [
    'src/components/InventoryBOM.jsx',
    'src/components/InventoryAnalytics.jsx',
    'src/components/Analytics/ChronologicalLedger.jsx',
    'src/components/Analytics/MetricsCards.jsx',
    'src/components/RecipeManagement.jsx',
    'src/components/InventoryDashboard.jsx'
];

settingsFiles.forEach(f => {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
        convertFile(fullPath, 'SettingsPage.css');
    }
});

inventoryFiles.forEach(f => {
    const fullPath = path.join(__dirname, f);
    if (fs.existsSync(fullPath)) {
        convertFile(fullPath, 'InventoryBOM.css');
    }
});

console.log("Done");
