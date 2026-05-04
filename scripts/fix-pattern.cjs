// fix-pattern.cjs
// Run: node scripts/fix-pattern.cjs
// Fixes two bugs in the traffic pattern drawing:
//   1. Pattern legs too small - scale up to realistic VFR sizes
//   2. 45-degree entry arrow bearing was wrong side for left traffic

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'public', 'avisor.html');
let html = fs.readFileSync(filePath, 'utf8');

// ── Fix 1: Pattern leg sizes ──────────────────────────────────────────────
// Old values were too small (sub-half-NM legs look tiny on sectional)
// Standard VFR rectangular pattern: ~1 NM downwind, ~0.5 NM other legs
const oldLegs = 'var legNm=0.38,crossNm=0.34,depNm=0.48,downNm=0.55,finalNm=0.28;';
const newLegs = 'var legNm=0.5,crossNm=0.5,depNm=0.9,downNm=1.0,finalNm=0.5;';

if (html.includes(oldLegs)) {
  html = html.replace(oldLegs, newLegs);
  console.log('  Fix 1 applied: pattern leg sizes scaled up to standard VFR.');
} else {
  console.warn('  Fix 1 SKIPPED: leg size string not found - may already be fixed.');
}

// ── Fix 2: Entry arrow bearing ────────────────────────────────────────────
// Old: (hdg+180+(isLeft?45:-45)) - this aimed entry at the departure end
//      from the wrong quadrant, placing arrow on the wrong side of runway
// New: ((hdg+(isLeft?-45:45)+360)%360) - correctly intercepts downwind
//      at 45 degrees to the landing threshold side (AIM standard entry)
const oldEntry = 'var ea=(hdg+180+(isLeft?45:-45))*Math.PI/180;';
const newEntry = 'var ea=((hdg+(isLeft?-45:45)+360)%360)*Math.PI/180;';

if (html.includes(oldEntry)) {
  html = html.replace(oldEntry, newEntry);
  console.log('  Fix 2 applied: entry arrow bearing corrected for AIM 45-deg downwind entry.');
} else {
  console.warn('  Fix 2 SKIPPED: entry bearing string not found - may already be fixed.');
}

fs.writeFileSync(filePath, html, 'utf8');
console.log('\nDone. Next steps:');
console.log('  git add public/avisor.html');
console.log('  git commit -m "fix(pattern): correct leg sizes and 45-deg entry bearing"');
console.log('  git push');
