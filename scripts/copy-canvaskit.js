// Copies Skia's WebAssembly file to public/ so the web build can load it. Runs after npm install.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'node_modules', 'canvaskit-wasm', 'bin', 'full', 'canvaskit.wasm');
const dest = path.join(__dirname, '..', 'public', 'canvaskit.wasm');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
