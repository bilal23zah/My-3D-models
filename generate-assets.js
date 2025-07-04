// --- START OF FILE generate-assets.js ---

const fs = require('fs');
const path = require('path');

// Folder jahan humare 3D models hain
const modelsDirectory = path.join(process.cwd(), 'assets', 'models');
// Jahan hum assets.json file save karna chahte hain
const outputFile = path.join(process.cwd(), 'assets.json');
// Base URL jahan se models serve honge (front-end ke liye)
const baseUrl = './assets/models/';

console.log('Starting asset generation...');
console.log(`Scanning directory: ${modelsDirectory}`);

// Check karo ke models folder mojood hai ya nahi
if (!fs.existsSync(modelsDirectory)) {
    console.log(`Models directory not found. Creating an empty assets.json.`);
    fs.writeFileSync(outputFile, '[]', 'utf8');
    process.exit(0);
}

// 1. Models folder ko parho
const files = fs.readdirSync(modelsDirectory);

const assetList = [];

// 2. Har file ko process karo
files.forEach(file => {
    if (path.extname(file).toLowerCase() === '.glb') {
        const fileName = path.basename(file, '.glb');
        
        const modelName = fileName
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .trim();

        console.log(`Found model: ${file}`);

        const assetData = {
            id: fileName.toLowerCase().replace(/ /g, '_'),
            name: modelName,
            path: `${baseUrl}${file}`,
            thumbnail: `https://placehold.co/150x150/555/fff?text=${encodeURIComponent(modelName.substring(0, 10))}`,
            category: "Uncategorized"
        };

        assetList.push(assetData);
    }
});

// 3. assets.json file mein data likho
const outputData = JSON.stringify(assetList, null, 2); 

fs.writeFileSync(outputFile, outputData, 'utf8');

console.log(`\nSuccess! ${assetList.length} assets have been written to ${outputFile}`);

// --- END OF FILE generate-assets.js ---