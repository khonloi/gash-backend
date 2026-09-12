const fs = require('fs');
const path = require('path');

const directoriesToSearch = [
  'controllers',
  'services',
  'models',
  'routes',
  'middleware',
  'utils',
  'sockets'
];

const filesToSearch = ['app.js', 'server.js'];

const replacements = [
  { search: /newProductVariant/g, replace: 'ProductVariant' },
  { search: /newProductVariants/g, replace: 'ProductVariants' },
  { search: /newProductImage/g, replace: 'ProductImage' },
  { search: /newProductImages/g, replace: 'ProductImages' },
  { search: /newProduct/g, replace: 'Product' },
  { search: /newProducts/g, replace: 'Products' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  for (const { search, replace } of replacements) {
    content = content.replace(search, replace);
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      processFile(fullPath);
    }
  }
}

// Process directories
directoriesToSearch.forEach(dir => walkDir(path.join(__dirname, dir)));

// Process single files
filesToSearch.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    processFile(fullPath);
  }
});

console.log('Renaming complete.');
