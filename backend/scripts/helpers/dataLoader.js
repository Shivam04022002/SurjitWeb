// Loads the ESM data modules that live in the frontend project
// (frontend/src/data/migration/*.js) from these CommonJS migration scripts,
// using a dynamic import(). Those modules are pure data (no asset imports),
// so Node can evaluate them directly.
const path = require('path');
const { pathToFileURL } = require('url');

const DATA_DIR = path.resolve(__dirname, '../../../frontend/src/data/migration');

// name = 'company' | 'products' | 'settings' | 'career' | 'gallery'
const loadData = async (name) => {
    const fileUrl = pathToFileURL(path.join(DATA_DIR, `${name}.js`)).href;
    const mod = await import(fileUrl);
    return mod.default || mod;
};

module.exports = { loadData, DATA_DIR };
