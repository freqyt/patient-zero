// Stamps every local script URL in index.html with ?v=<timestamp> so phones and
// browsers fetch fresh code after each deploy instead of mixing cached files.
// Run before committing a deploy:  node tools/bump-version.js
const fs = require('fs'), path = require('path');
const file = path.join(__dirname, '..', 'index.html');
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 14);   // yyyymmddhhmmss, so two deploys in one minute still differ
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/(<script src="src\/[^"?]+\.js)(\?v=\w+)?"/g, `$1?v=${v}"`);
fs.writeFileSync(file, html);
console.log('version', v);
