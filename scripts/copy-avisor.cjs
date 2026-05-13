/**
 * Copy AVISOR single-file build into public/avisor.html for Vite serving.
 * Applies post-processing patches after every copy:
 *   1. showToast() helper  2. alert()->showToast()  3. console.log removal
 *   4. Pattern leg sizes   5. Entry bearing fix
 */
const fs = require('fs');
const path = require('path');
const repoRoot = path.join(__dirname, '..');
const plannerSrc = path.join(repoRoot, 'src', 'avisor-planner.html');
const desktopSrc = path.join(process.env.USERPROFILE || '', 'Desktop', 'avisor_v5.html');
function firstExisting(paths) {
  for (let i = 0; i < paths.length; i++) {
    const p = paths[i];
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}
/** AVISOR_SRC if set; else src/avisor-planner.html; else Desktop avisor_v5.html */
const src = firstExisting([process.env.AVISOR_SRC, plannerSrc, desktopSrc]);
const dest = path.join(repoRoot, 'public', 'avisor.html');
if (!src) {
  console.error('No AVISOR HTML source found. Set AVISOR_SRC, or add src/avisor-planner.html, or put avisor_v5.html on Desktop.');
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied', src, '->', dest);
let html = fs.readFileSync(dest, 'utf8');
let p = 0;
if (!html.includes('function showToast')) {
  const t = '<script>function showToast(msg,type){type=type||"warn";var el=document.createElement("div");var bg={info:"#1a3a5c",warn:"#6b3900",error:"#6b1a1a"};el.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:"+(bg[type]||bg.warn)+";color:#fff;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:500;box-shadow:0 4px 16px rgba(0,0,0,.45);z-index:99999;max-width:88vw;text-align:center;pointer-events:none;transition:opacity .4s";el.textContent=msg;document.body.appendChild(el);setTimeout(function(){el.style.opacity="0";setTimeout(function(){el.remove();},400);},3400);}</script>';
  html = html.replace('</head>', t + '\n</head>'); p++; console.log('  showToast injected');
}
const ab=(html.match(/\balert\(/g)||[]).length;
html=html.replace(/\balert\(('(?:[^'\\]|\\.)*')\)/g,'showToast($1)');
html=html.replace(/\balert\(("(?:[^"\\]|\\.)*")\)/g,'showToast($1)');
html=html.replace(/\balert\(('(?:[^'\\]|\\.)*'\s*\+[^)]{0,80})\)/g,'showToast($1)');
html=html.replace(/\balert\(([A-Za-z_$][^)]{0,60})\)/g,'showToast($1)');
const aa=(html.match(/\balert\(/g)||[]).length;
if(ab>aa){p++;console.log('  alert() replaced:',ab-aa);}

// Safe console.log removal: only remove whole log lines (never adjacent code)
const lb=(html.match(/console\.log/g)||[]).length;
html=html.replace(/^[ \t]*console\.log\(.*\);\s*$/gm,'');
const la=(html.match(/console\.log/g)||[]).length;
if(lb>la){p++;console.log('  console.log removed:',lb-la);}

const oL='var legNm=0.38,crossNm=0.34,depNm=0.48,downNm=0.55,finalNm=0.28;';
const nL='var legNm=0.5,crossNm=0.5,depNm=0.9,downNm=1.0,finalNm=0.5;';
if(html.includes(oL)){html=html.replace(oL,nL);p++;console.log('  Pattern legs fixed');}
else if(!html.includes(nL)){console.log('  [warn] Pattern leg string not found');}
const oE='var ea=(hdg+180+(isLeft?45:-45))*Math.PI/180;';
const nE='var ea=((hdg+(isLeft?-45:45)+360)%360)*Math.PI/180;';
if(html.includes(oE)){html=html.replace(oE,nE);p++;console.log('  Entry bearing fixed');}
else if(!html.includes(nE)){console.log('  [warn] Entry bearing string not found');}
fs.writeFileSync(dest, html, 'utf8');
console.log('Done.', p, 'patches applied.');
const {spawnSync}=require('child_process');
const inj=path.join(__dirname,'inject-gps-proximity.cjs');
if(fs.existsSync(inj)){const r=spawnSync(process.execPath,[inj],{stdio:'inherit',cwd:path.join(__dirname,'..')});if(r.status)process.exit(r.status??1);}
