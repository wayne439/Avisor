/**
 * Re-injects native-shell GPS → Approach tab UI + logic into public/avisor.html
 * after `copy-avisor.cjs` overwrites it from Desktop avisor_v5.html.
 */
const fs = require("fs");
const path = require("path");

const dest = path.join(__dirname, "..", "public", "avisor.html");

const MARKER_HTML = 'id="opt-prox-approach"';
const MARKER_CSS = "/*SHELL-GPS-INJECT*/";

const GPS_HTML = `
    <div class="tog-row"><span class="tog-lbl" title="When enabled, switches to the Approach tab once GPS shows you inside the chosen distance of the destination airport (after you have been farther out first).">Open Approach tab near destination <span style="color:var(--txt3)">(GPS)</span></span><label class="tog"><input type="checkbox" id="opt-prox-approach" onchange="onProxApproachToggle()"><div class="tog-tr"></div><div class="tog-th"></div></label></div>
    <div class="field" style="margin-top:2px"><label>Within (NM) of destination</label>
      <input type="number" id="opt-prox-nm" value="25" min="5" max="80" step="1" style="max-width:88px" title="Requires Location permission; tab must stay in foreground on many devices" onchange="proximityApproachResetPhase()">
    </div>
    <div id="gps-prox-help" style="font-size:8px;color:var(--txt2);line-height:1.45;margin:4px 0 2px">1) Build a flight plan. 2) Turn this on. 3) Set NM. 4) Allow Location in the browser. Uses GPS; waits until you are <b>outside</b> NM+15 from the airport, then opens <b>Approach</b> once when you enter the ring.</div>`;

const GPS_JS = `
// ══ Proximity → Approach tab (browser Geolocation; opt-in) ═══════════════════
var _proxWatchId=null;
function stopProximityApproachWatch(){
  if(_proxWatchId!=null&&typeof navigator!=='undefined'&&navigator.geolocation){
    try{navigator.geolocation.clearWatch(_proxWatchId);}catch(_e){}
  }
  _proxWatchId=null;
}
function proximityApproachResetPhase(){
  if(typeof STATE!=='undefined'){STATE._proxPhase=0;}
}
function onProxApproachToggle(){
  if(document.getElementById('opt-prox-approach')&&document.getElementById('opt-prox-approach').checked) syncProximityApproachWatch();
  else{stopProximityApproachWatch();proximityApproachResetPhase();}
}
function syncProximityApproachWatch(){
  stopProximityApproachWatch();
  var cb=document.getElementById('opt-prox-approach');
  if(!cb||!cb.checked||typeof STATE==='undefined'||!STATE.plan)return;
  var arr=STATE.plan.arr;
  if(!arr||arr.lat==null||arr.lon==null)return;
  if(typeof navigator==='undefined'||!navigator.geolocation){
    if(typeof toast==='function')toast('Location not available in this browser');
    return;
  }
  if(typeof isSecureContext!=='undefined'&&!isSecureContext){
    if(typeof toast==='function')toast('Location needs HTTPS or localhost');
    return;
  }
  STATE._proxPhase=0;
  _proxWatchId=navigator.geolocation.watchPosition(proximityApproachOnPosition,function(err){
    console.warn('Geolocation',err&&err.code,err&&err.message);
    if(err&&err.code===1&&typeof toast==='function')toast('Location blocked — allow for proximity Approach');
  },{enableHighAccuracy:false,maximumAge:30000,timeout:25000});
}
function proximityApproachOnPosition(pos){
  if(!STATE.plan||!STATE.plan.arr)return;
  var cb=document.getElementById('opt-prox-approach');
  if(!cb||!cb.checked)return;
  if(STATE._proxPhase>=2)return;
  var nmEl=document.getElementById('opt-prox-nm');
  var maxNm=Math.min(80,Math.max(5,parseInt(nmEl&&nmEl.value,10)||25));
  var hysteresis=15;
  var farNeed=maxNm+hysteresis;
  var here={lat:pos.coords.latitude,lon:pos.coords.longitude};
  var apt={lat:STATE.plan.arr.lat,lon:STATE.plan.arr.lon};
  var d=gc(here,apt);
  if(STATE._proxPhase===0){
    if(d>farNeed)STATE._proxPhase=1;
    return;
  }
  if(STATE._proxPhase===1&&d<=maxNm){
    STATE._proxPhase=2;
    try{tab('approach');}catch(_e){}
    if(typeof toast==='function')toast('~'+Math.round(d)+' NM to '+STATE.plan.arrIcao+' — opened Approach');
  }
}
`;

const LAYOUT_CSS = `
/*SHELL-GPS-INJECT*/
.app{min-height:0}
.body{display:flex;flex:1;overflow:hidden;min-height:0}
.left{min-height:0}
.tog-row{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:7px}
.tog-lbl{font-family:var(--mono);font-size:9px;color:var(--txt2);flex:1;min-width:0;line-height:1.3;white-space:normal;padding-right:2px}
`;

const OLD_FREQ_BLOCK =
  /if\(apFreqEl&&typeof buildFreqHTML==='function'\)\{\s*apFreqEl\.innerHTML=buildFreqHTML\(p\.arrIcao,APTS\[p\.arrIcao\]\);\s*\}/;

const NEW_FREQ_BLOCK = `if(apFreqEl&&typeof buildFreqHTML==='function'){
    apFreqEl.innerHTML='<div style="color:var(--txt3);font-size:9px;font-family:var(--mono)">Loading comm frequencies…</div>';
    ensureOurAirportsEnrichment().then(function(){
      var el=document.getElementById('ap-freqs'),pl=STATE.plan;
      if(el&&pl&&pl.arrIcao) el.innerHTML=buildFreqHTML(pl.arrIcao,APTS[pl.arrIcao]);
    }).catch(function(){
      var el=document.getElementById('ap-freqs'),pl=STATE.plan;
      if(el&&pl&&pl.arrIcao) el.innerHTML=buildFreqHTML(pl.arrIcao,APTS[pl.arrIcao]);
    });
  }`;

function main() {
  if (!fs.existsSync(dest)) {
    console.error("inject-gps-proximity: missing", dest);
    process.exit(1);
  }
  let html = fs.readFileSync(dest, "utf8");
  if (html.includes(MARKER_HTML)) {
    console.log("inject-gps-proximity: already present, skip");
    return;
  }

  const rowRe =
    /(<div class="tog-row"><span class="tog-lbl">GPS direct[^<]*<\/span><label class="tog"><input[^>]*id="opt-direct"[^>]*>[\s\S]*?<\/label><\/div>)(\s*<div class="row2">)/;
  const m = html.match(rowRe);
  if (!m) {
    console.error(
      "inject-gps-proximity: could not find GPS direct / opt-direct row — merge Options HTML manually or align avisor_v5.html labels.",
    );
    process.exit(1);
  }
  html = html.replace(rowRe, `$1${GPS_HTML}\n$2`);

  const courseRe = /(function gc\(a,b\)\{[^\r\n]+\r?\n)/;
  if (!courseRe.test(html)) {
    console.error("inject-gps-proximity: could not find function gc() line");
    process.exit(1);
  }
  if (!html.includes("function syncProximityApproachWatch")) {
    html = html.replace(courseRe, `$1${GPS_JS}\n`);
  }

  if (!html.includes("stopProximityApproachWatch();")) {
    const bp = html.replace(
      /async function buildPlan\(\)\{\s*const btns=document\.querySelectorAll\('#go-btn'\)/,
      `async function buildPlan(){
  stopProximityApproachWatch();
  proximityApproachResetPhase();
  const btns=document.querySelectorAll('#go-btn')`,
    );
    if (bp === html) {
      console.warn(
        "inject-gps-proximity: could not patch buildPlan start — add stopProximityApproachWatch + proximityApproachResetPhase after async function buildPlan(){ manually.",
      );
    } else {
      html = bp;
    }
  }

  const finallyNeedle = "}catch(e){console.error(e);alert('Error: '+e.message);}\n  finally{btns.forEach";
  const fp = html.indexOf(finallyNeedle);
  if (fp !== -1) {
    const planMsg = "addChatMsg('ai',`Plan built:";
    const start = html.lastIndexOf(planMsg, fp);
    if (start !== -1) {
      const chunk = html.slice(start, fp);
      if (!chunk.includes("syncProximityApproachWatch();")) {
        html = html.slice(0, fp) + "\n    syncProximityApproachWatch();\n  " + html.slice(fp);
      }
    }
  }

  if (!html.includes("ensureOurAirportsEnrichment().catch")) {
    const en = html.replace(
      /(STATE\.plan\s*=\s*plan;\s*STATE\.routes\s*=\s*\{[^}]+\};\s*STATE\.updates\s*=\s*\[\];)/,
      "$1\n    ensureOurAirportsEnrichment().catch(function(){});",
    );
    if (en !== html) html = en;
  }

  if (OLD_FREQ_BLOCK.test(html) && !html.includes("Loading comm frequencies")) {
    html = html.replace(OLD_FREQ_BLOCK, NEW_FREQ_BLOCK);
  }

  if (!html.includes(MARKER_CSS)) {
    html = html.replace("</style>", `${LAYOUT_CSS}\n</style>`);
  }

  fs.writeFileSync(dest, html, "utf8");
  console.log("inject-gps-proximity: merged GPS UI + logic + layout CSS into", dest);
}

main();
