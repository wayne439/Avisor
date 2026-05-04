// fix-app-for-release.cjs
// Run from repo root: node scripts/fix-app-for-release.cjs
// Prepares public/avisor.html for production testing:
//   1. Adds showToast() helper (replaces blocking alert())
//   2. Replaces all alert() calls with showToast()
//   3. Strips console.log() debug statements

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'avisor.html');
let html = fs.readFileSync(filePath, 'utf8');
const linesBefore = html.split('\n').length;

// ── 1. Inject showToast helper after the SW <script> block ──────────────────
const toastScript = `<script>
/* showToast: non-blocking replacement for alert() - added for release */
function showToast(msg, type) {
    type = type || 'warn';
  var colours = { info: '#1a3a5c', warn: '#6b3900', error: '#6b1a1a', ok: '#1a4a2a' };
  var el = document.createElement('div');
  el.style.cssText = [
        'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
        'background:' + (colours[type] || colours.warn), 'color:#fff',
        'padding:10px 22px', 'border-radius:8px', 'font-size:14px', 'font-weight:500',
        'box-shadow:0 4px 16px rgba(0,0,0,.45)', 'z-index:99999',
        'max-width:88vw', 'text-align:center', 'pointer-events:none', 'transition:opacity .4s'
      ].join(';');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(function () {
    el.style.opacity = '0';
    setTimeout(function () { el.remove(); }, 400);
  }, 3400);
}
<\/script>`;

const swScriptEnd = '<script src="./vendor/pdf.min.js"><\/script>';
if (html.includes(swScriptEnd)) {
    html = html.replace(swScriptEnd, toastScript + '\n' + swScriptEnd);
  console.log('  showToast helper injected.');
} else {
  console.warn('  WARNING: SW script anchor not found - showToast not injected. Check manually.');
}

// ── 2. Strip console.log() debug calls ──────────────────────────────────────
const logsBefore = (html.match(/console\.log/g) || []).length;
html = html.replace(/[ \t]*console\.log\([^\n]+\n/g, '\n');
const logsAfter = (html.match(/console\.log/g) || []).length;
console.log('  console.log removed: ' + (logsBefore - logsAfter) + ' (remaining: ' + logsAfter + ')');

// ── 3. Replace alert() with showToast() ─────────────────────────────────────
const alertsBefore = (html.match(/\balert\(/g) || []).length;
// Single-quoted string alerts
html = html.replace(/\balert\(('(?:[^'\\]|\\.)*')\)/g, 'showToast($1)');
// Double-quoted string alerts
html = html.replace(/\balert\(("(?:[^"\\]|\\.)*")\)/g, 'showToast($1)');
// Concatenated string alerts e.g. alert('x: ' + val)
html = html.replace(/\balert\(('(?:[^'\\]|\\.)*'\s*\+[^)]{0,80})\)/g, 'showToast($1)');
// Variable/expression alerts e.g. alert(errMsg)
html = html.replace(/\balert\(([A-Za-z_$][^)]{0,60})\)/g, 'showToast($1)');
const alertsAfter = (html.match(/\balert\(/g) || []).length;
console.log('  alert() replaced: ' + (alertsBefore - alertsAfter) + ' (remaining: ' + alertsAfter + ')');

const toastCount = (html.match(/showToast\(/g) || []).length;
console.log('  showToast() calls total: ' + toastCount);

// ── 4. Write output ──────────────────────────────────────────────────────────
fs.writeFileSync(filePath, html, 'utf8');
const linesAfter = html.split('\n').length;
console.log('\nDone! Lines: ' + linesBefore + ' -> ' + linesAfter);
console.log('File written to: ' + filePath);
console.log('\nNext steps:');
console.log('  git add public/avisor.html');
console.log('  git commit -m "fix(app): replace alert() with showToast(), strip console.log"');
console.log('  git push');
