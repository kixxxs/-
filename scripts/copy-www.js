// Build script: copy assets to www/ for Capacitor
const fs = require('fs');
const path = require('path');

const WWW = path.join(__dirname, '..', 'www');
const ROOT = path.join(__dirname, '..');
const NODE = path.join(ROOT, 'node_modules');
const SRC = path.join(ROOT, 'src');

// Clean and recreate www
if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true });
}

// Create directories
const dirs = [
  'www',
  'www/lib/css',
  'www/lib/js',
  'www/lib/js/pdfjs',
  'www/lib/webfonts',
  'www/lib/fonts',
  'www/assets'
];
dirs.forEach(function(d) {
  fs.mkdirSync(path.join(ROOT, d), { recursive: true });
});

// Copy HTML
let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');

// Replace node_modules paths with www-relative paths
const pathReplacements = [
  ['../node_modules/@fortawesome/fontawesome-free/css/all.min.css', 'lib/css/all.min.css'],
  ['../node_modules/bootstrap/dist/css/bootstrap.min.css', 'lib/css/bootstrap.min.css'],
  ['../node_modules/bootstrap-icons/font/bootstrap-icons.css', 'lib/fonts/bootstrap-icons.css'],
  ['../node_modules/chart.js/dist/chart.umd.js', 'lib/js/chart.umd.js'],
  ['../node_modules/bootstrap/dist/js/bootstrap.bundle.min.js', 'lib/js/bootstrap.bundle.min.js'],
];

pathReplacements.forEach(function([from, to]) {
  html = html.split(from).join(to);
});

// Add Capacitor scripts before </head>
var headAdditions = [
  '<script src="lib/js/capacitor.js"></script>',
  '<script src="lib/js/sql-wasm.js"></script>',
  '<script src="lib/js/cap-db.js"></script>',
].join('\n');

html = html.replace('</head>', headAdditions + '\n</head>');

// Write processed HTML
fs.writeFileSync(path.join(WWW, 'index.html'), html, 'utf-8');
console.log('[copy-www] index.html processed');

// Copy CSS
copyFile(
  path.join(NODE, '@fortawesome/fontawesome-free/css/all.min.css'),
  path.join(WWW, 'lib/css/all.min.css')
);
copyFile(
  path.join(NODE, 'bootstrap/dist/css/bootstrap.min.css'),
  path.join(WWW, 'lib/css/bootstrap.min.css')
);
copyFile(
  path.join(NODE, 'bootstrap-icons/font/bootstrap-icons.css'),
  path.join(WWW, 'lib/fonts/bootstrap-icons.css')
);

// Copy JS
copyFile(
  path.join(NODE, 'chart.js/dist/chart.umd.js'),
  path.join(WWW, 'lib/js/chart.umd.js')
);
copyFile(
  path.join(NODE, 'bootstrap/dist/js/bootstrap.bundle.min.js'),
  path.join(WWW, 'lib/js/bootstrap.bundle.min.js')
);
copyFile(
  path.join(NODE, 'sql.js/dist/sql-wasm.js'),
  path.join(WWW, 'lib/js/sql-wasm.js')
);
copyFile(
  path.join(NODE, '@capacitor/core/dist/capacitor.js'),
  path.join(WWW, 'lib/js/capacitor.js')
);

// Copy cap-db.js
copyFile(
  path.join(SRC, 'cap-db.js'),
  path.join(WWW, 'lib/js/cap-db.js')
);

// Copy PDF.js (for Capacitor/APK PDF preview)
copyFile(
  path.join(SRC, 'lib/pdfjs/pdf.min.mjs'),
  path.join(WWW, 'lib/js/pdfjs/pdf.min.mjs')
);
copyFile(
  path.join(SRC, 'lib/pdfjs/pdf.worker.min.mjs'),
  path.join(WWW, 'lib/js/pdfjs/pdf.worker.min.mjs')
);

// Copy WASM
copyFile(
  path.join(NODE, 'sql.js/dist/sql-wasm.wasm'),
  path.join(WWW, 'assets/sql-wasm.wasm')
);

// Copy Font Awesome webfonts
copyDir(
  path.join(NODE, '@fortawesome/fontawesome-free/webfonts'),
  path.join(WWW, 'lib/webfonts')
);

// Copy Bootstrap Icons fonts
copyDir(
  path.join(NODE, 'bootstrap-icons/font/fonts'),
  path.join(WWW, 'lib/fonts')
);

console.log('[copy-www] All assets copied to www/');

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('[copy-www] WARNING: Source not found:', src);
    return;
  }
  fs.copyFileSync(src, dest);
  console.log('[copy-www] Copied:', path.basename(src));
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn('[copy-www] WARNING: Source dir not found:', src);
    return;
  }
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  var files = fs.readdirSync(src);
  files.forEach(function(file) {
    var srcFile = path.join(src, file);
    var destFile = path.join(dest, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, destFile);
    }
  });
  console.log('[copy-www] Copied dir:', path.basename(src), '(' + files.length + ' files)');
}
