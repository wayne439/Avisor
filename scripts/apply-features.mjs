import { readFileSync, writeFileSync } from 'fs';
import vm from 'vm';

let h = readFileSync('src/avisor-planner.html', 'utf8').replace(/\r\n/g, '\n');

function insertBefore(marker, insertion) {
  const idx = h.indexOf(marker);
  if (idx === -1) throw new Error('Marker not found: ' + marker.slice(0, 60));
  h = h.slice(0, idx) + insertion + h.slice(idx);
}
function replace(old, neo) {
  if (!h.includes(old)) throw new Error('Text not found: ' + old.slice(0, 60));
  h = h.replace(old, neo);
}
function getScripts(src) {
  const s = []; let m;
  const re = /<script(?:[^>]*)>([\s\S]*?)<\/script>/gi;
  while ((m = re.exec(src)) !== null) s.push(m[1]);
  return s;
}

// 1. calcSunTimes
insertBefore('function renderBrief(p){',
`function calcSunTimes(lat,lon,dateObj){
  try{
    var D=dateObj||new Date();
    var JD=D.getTime()/86400000+2440587.5;
    var n=JD-2451545.0;
    var L=((280.46+0.9856474*n)%360+360)%360;
    var g=((357.528+0.9856003*n)%360+360)%360*Math.PI/180;
    var lam=(L+1.915*Math.sin(g)+0.02*Math.sin(2*g))*Math.PI/180;
    var dec=Math.asin(Math.sin(23.439*Math.PI/180)*Math.sin(lam));
    var latR=lat*Math.PI/180;
    var cosH=(Math.sin(-0.0145)-Math.sin(latR)*Math.sin(dec))/(Math.cos(latR)*Math.cos(dec));
    if(cosH<-1||cosH>1)return null;
    var H=Math.acos(cosH)*180/Math.PI;
    var B=2*Math.PI/365*(n+0.5);
    var E=(-7.655*Math.sin(B)+9.873*Math.sin(2*B+3.588)+0.439*Math.sin(4*B+0.07))/60;
    var noon=12-lon/15-E;
    var sunriseH=noon-H/15,sunsetH=noon+H/15;
    var cosHc=(Math.sin(-6*Math.PI/180)-Math.sin(latR)*Math.sin(dec))/(Math.cos(latR)*Math.cos(dec));
    var Hc=Math.acos(Math.max(-1,Math.min(1,cosHc)))*180/Math.PI;
    var ctH=noon+Hc/15;
    function toHHMM(h){h=((h%24)+24)%24;var hh=Math.floor(h);var mm=Math.round((h-hh)*60);if(mm>=60){hh++;mm=0;}return('0'+hh).slice(-2)+':'+('0'+mm).slice(-2);}
    return{sunrise:toHHMM(sunriseH),sunset:toHHMM(sunsetH),civilTwilight:toHHMM(ctH),sunsetDecH:sunsetH,civilTwilightDecH:ctH};
  }catch(e){return null;}
}
`);
console.log('1. calcSunTimes OK');

// 2. _sunHtml compute
replace(
  `    if(_oatB!=null){var _isaB=15-1.98*(_elevB/1000);var _daB=Math.round(_elevB+120*(_oatB-_isaB));_daStrB=_daB.toLocaleString()+' ft';}\n    // Arrival frequencies`,
  `    if(_oatB!=null){var _isaB=15-1.98*(_elevB/1000);var _daB=Math.round(_elevB+120*(_oatB-_isaB));_daStrB=_daB.toLocaleString()+' ft';}
    // Sunrise/sunset
    var _sunHtml='';
    if(p.arr&&p.arr.lat!=null&&p.arr.lon!=null){
      var _st=calcSunTimes(p.arr.lat,p.arr.lon,new Date());
      if(_st){
        var _nightWarn='';
        var _etaDecH=_depUtcH+((p.eteMin||60)/60);
        var _ctDec=_st.civilTwilightDecH;
        if(_etaDecH>_ctDec||(_etaDecH<6&&_ctDec>18)){_nightWarn='<span style="color:#ff9944"> &#9888; ETA after civil twilight</span>';}
        _sunHtml=dr('Sunrise / Sunset','<span style="color:var(--txt2)">'+_st.sunrise+'Z &nbsp;/&nbsp; '+_st.sunset+'Z</span>')+dr('End civil twilight','<span style="color:#ff9944">'+_st.civilTwilight+'Z</span>'+_nightWarn);
      }
    }
    // Arrival frequencies`
);
console.log('2. _sunHtml compute OK');

// 3. _sunHtml in innerHTML
replace('+dr(\'Density alt\',_daStrB)+_freqHtml+', '+dr(\'Density alt\',_daStrB)+_sunHtml+_freqHtml+');
console.log('3. _sunHtml in arrival body OK');

// 4. AIRMETs checkbox
replace(
  `<input type="checkbox" id="map-show-circle" checked onchange="renderMap()"> VOR rings</label>\n          <button type="button" onclick="mapFitRoute()"`,
  `<input type="checkbox" id="map-show-circle" checked onchange="renderMap()"> VOR rings</label>
          <label style="font-family:monospace;font-size:9px;color:#ff9944;cursor:pointer"><input type="checkbox" id="map-show-sigmet" onchange="renderMap()"> AIRMETs</label>
          <button type="button" onclick="mapFitRoute()"`
);
console.log('4. AIRMETs checkbox OK');

// 5. fetchSigmetData
insertBefore('function renderMap(){',
`var _sigmetData=null,_sigmetLoadTime=0;
async function fetchSigmetData(){
  var now=Date.now();
  if(_sigmetData&&now-_sigmetLoadTime<300000)return _sigmetData;
  try{
    var base=location.protocol==='file:'?'https://aviationweather.gov':'';
    var r=await fetchJSONTimeout(base+'/awc-api/data/airsigmet?format=json',null,10000);
    if(!r||!r.ok)return null;
    var d=await r.json();_sigmetData=d;_sigmetLoadTime=Date.now();return d;
  }catch(e){return null;}
}
`);
console.log('5. fetchSigmetData OK');

// 6. SIGMET rendering in renderMap
replace(
  `  // Label\n  var named=`,
  `  // AirMETs/SIGMETs overlay
  var _showSigmet=document.getElementById('map-show-sigmet')&&document.getElementById('map-show-sigmet').checked;
  if(_showSigmet){
    var _sigLayers=_mapLayers;
    fetchSigmetData().then(function(data){
      if(!data)return;
      var _hazColors={CONVECTIVE:'#ff3333',TURB:'#ff8c00',TURBULENCE:'#ff8c00',ICE:'#44ddff',ICING:'#44ddff',IFR:'#8888ff',LLWS:'#ff44ff',MTN_OBSCN:'#aaaaaa'};
      var _feats=Array.isArray(data)?data:(data.features||data.data||[]);
      _feats.forEach(function(feat){
        var props=feat.properties||feat;
        var area=props.area||feat.area;
        var pts=area&&(area.points||area);
        if(!pts||!Array.isArray(pts)||pts.length<3)return;
        var latLons=pts.map(function(pt){return[parseFloat(pt.lat||pt[0]),parseFloat(pt.lon||pt[1])];}).filter(function(c){return isFinite(c[0])&&isFinite(c[1]);});
        if(latLons.length<3)return;
        var haz=String(props.hazard||props.hazardType||props.type||'TURB').toUpperCase().split(/[\\s,_]/)[0];
        var col=_hazColors[haz]||'#ff8c00';
        var tip=(props.alphaChar||'')+(props.hazard?' '+props.hazard:'')+(props.severity?' '+props.severity:'');
        var lyr=L.polygon(latLons,{color:col,weight:1.5,fillColor:col,fillOpacity:0.1,opacity:0.75,dashArray:'6 4'});
        if(tip.trim())lyr.bindTooltip(tip.trim(),{sticky:true,className:'avisor-popup'});
        lyr.addTo(_map);_sigLayers.push(lyr);
      });
    }).catch(function(){});
  }
  // Label
  var named=`
);
console.log('6. SIGMET rendering OK');

// 7. AVIATION_KB - build as a string with no curly quote issues
const kbEntries = [
  {
    tags: "['pattern','enter','entry','join','downwind','45','gp45','midfield','upwind','circuit','traffic pattern']",
    body: `var arr=p?p.arrIcao:'destination';var ac=p&&p.ac?p.ac.name:'your aircraft';
    var rwy=p&&p.favRwy?('RWY '+p.favRwy.id+', '+(p.favRwy.pat==='R'?'right':'left')+' traffic'):'check ATIS';
    return '**Pattern Entry - '+arr+'**\\n\\n**Favored runway:** '+rwy+'\\n\\n**Standard VFR entry (AC 90-66C):** Arrive at pattern altitude on the 45 entry side. Fly the 45 to midfield downwind then fly the standard rectangular pattern.\\n\\n**GP45 entry:** Cross midfield at/above pattern altitude, exit upwind, descend to pattern altitude, turn inbound on the 45 to downwind - entry point ~**0.8 nm** from the runway threshold.\\n\\n**Pattern altitude:** 1,000 ft AGL for piston singles ('+ac+'), 1,500 ft AGL for twins. Check Chart Supplement for published altitudes.\\n\\n**CTAF call:** "[Airport] Traffic, N12345, entering 45 downwind runway XX, [airport]." State airport name first and last.';`
  },
  {
    tags: "['crosswind','xwind','wind limit','max wind','cross wind','crosswind component']",
    body: `var am=p&&p.am;var rwy=p&&p.favRwy;var arr=p?p.arrIcao:'destination';
    var windInfo='';
    if(am&&am.wdir&&am.wdir!=='VRB'&&am.wspd){var wdir=parseInt(am.wdir),wspd=parseInt(am.wspd);if(rwy){var ang=((wdir-(rwy.hdg||0)+360)%360)*Math.PI/180;var xw=Math.round(Math.abs(wspd*Math.sin(ang)));var hw=Math.round(wspd*Math.cos(ang));windInfo='\\n\\n**'+arr+' current:** Wind '+wdir+'@ '+wspd+'kt - **'+xw+'kt crosswind**, **'+(hw>=0?hw+'kt headwind':Math.abs(hw)+'kt tailwind')+'** on RWY '+rwy.id+'.';}else windInfo='\\n\\n**'+arr+':** Wind '+wdir+'@ '+wspd+'kt.';}else if(am&&am.wdir==='VRB'){windInfo='\\n\\n**'+arr+':** Variable winds - treat as crosswind from any direction.';}
    return '**Crosswind Calculation**'+windInfo+'\\n\\n**Formula:** XW = Speed x |sin(wind angle to runway)| HW = Speed x cos(wind angle)\\n\\n**Demonstrated crosswind limits:**\\n- C172SP: **15 kt** | PA-28: **17 kt** | SR22T: **21 kt** | Bonanza: **17 kt**\\n\\n"Demonstrated" means a test pilot flew it - not an approved maximum. Add half the gust spread in gusty conditions. Personal minimums matter most.';`
  },
  {
    tags: "['density altitude','density alt','hot','high da','performance','takeoff distance','landing distance','pressure altitude']",
    body: `var am=p&&p.am;var arr=p?p.arrIcao:'destination';var daInfo='';
    if(am&&am.temp!=null&&p&&p.arr){var elev=p.arr.elev||0;var oat=Number(am.temp);var isa=15-1.98*(elev/1000);var da=Math.round(elev+120*(oat-isa));daInfo='\\n\\n**'+arr+'** ('+elev.toLocaleString()+' ft): OAT '+oat+'C = **DA '+da.toLocaleString()+' ft**. See Performance section in Brief tab.';}
    return '**Density Altitude**'+daInfo+'\\n\\n**Formula:** DA = Elev + 120 x (OAT - ISA) | ISA = 15C - 2C per 1,000 ft\\n\\n**Performance penalties:**\\n- +10% takeoff ground roll per 1,000 ft DA\\n- +12% takeoff over 50 ft per 1,000 ft DA\\n- +5% landing distance per 1,000 ft DA\\n\\n**High-elevation airports:** KPRC 5,045 ft, KGCN 6,609 ft, KDEN 5,431 ft. A hot summer day adds 3,000-5,000 ft effective DA.\\n\\nIf DA > 5,000 ft: use full runway, rotate at book Vr, do not rush the liftoff.';`
  },
  {
    tags: "['vfr minimums','vfr min','visibility minimum','ceiling requirement','class b','class c','class d','class e','class g','airspace','flight category','mvfr','ifr','lifr']",
    body: `return '**VFR Weather Minimums (FAR 91.155)**\\n\\n| Airspace | Visibility | Cloud Clearance |\\n|---|---|---|\\n| Class B | 3 sm | Clear of clouds |\\n| Class C | 3 sm | 500 below, 1,000 above, 2,000 horiz |\\n| Class D | 3 sm | 500 below, 1,000 above, 2,000 horiz |\\n| Class E >=10,000 MSL | 5 sm | 1,000 below, 1,000 above, 1 sm horiz |\\n| Class E <10,000 MSL | 3 sm | 500 below, 1,000 above, 2,000 horiz |\\n| Class G day <1,200 AGL | 1 sm | Clear of clouds |\\n| Class G night <1,200 AGL | 3 sm | 500 below, 1,000 above, 2,000 horiz |\\n\\n**Flight categories:**\\n- VFR: ceiling >1,000 ft AND vis >3 sm\\n- MVFR: ceiling 500-1,000 ft OR vis 1-3 sm\\n- IFR: ceiling 200-500 ft OR vis 1/2-1 sm\\n- LIFR: ceiling <200 ft OR vis <1/2 sm';`
  },
  {
    tags: "['ctaf','radio call','announce','uncontrolled airport','advisory frequency','multicom','position report','traffic call']",
    body: `var arr=p?p.arrIcao:'[Airport]';var rwy=p&&p.favRwy?p.favRwy.id:'XX';
    return '**CTAF Calls - '+arr+'**\\n\\n1. **10 miles out:** "'+arr+' Traffic, N12345, 10 miles northwest, inbound runway '+rwy+', '+arr+'."\\n2. **45 entry/downwind:** "...entering 45 downwind runway '+rwy+', '+arr+'."\\n3. **Turning base:** "...turning base runway '+rwy+', '+arr+'."\\n4. **Final:** "...final runway '+rwy+', '+arr+'."\\n5. **Clear of runway:** "...clear runway '+rwy+', taxi parking, '+arr+'."\\n\\n**Key rules:** Listen before transmitting. State airport name first and last. CTAF is advisory only. Keep landing light and strobes on even in daylight.';`
  },
  {
    tags: "['fuel','reserve','fuel required','endurance','far 91.151','how much fuel','fuel planning']",
    body: `var tf=p?p.tripFuel:null;var rf=p?p.resFuel:null;var tot=p?p.totalFuel:null;
    var planInfo=tf?'\\n\\nYour plan: **'+tf+' gal trip** + **'+rf+' gal reserve** = **'+tot+' gal total**.':'';
    return '**Fuel Requirements (FAR 91.151)**'+planInfo+'\\n\\n- **Day VFR:** Fuel to destination + **30 min reserve** at cruise\\n- **Night VFR:** Fuel to destination + **45 min reserve** at cruise\\n- **IFR:** Destination + alternate + **45 min reserve**\\n\\nFAR 91.151 is a legal floor - most CFIs recommend a personal 1-hour reserve. Avgas weighs **6 lbs/gal**. Fuel burn increases ~5% per 1,000 ft below optimal altitude.';`
  },
  {
    tags: "['emergency','engine fail','engine out','forced landing','mayday','engine failure','restart engine','pan pan']",
    body: `var ac=p&&p.ac?p.ac.name:'your aircraft';
    return '**Engine Failure - '+ac+'**\\n\\n**Immediate actions (memory items):**\\n1. **Pitch for best glide** - ~65-75 KIAS most GA singles (check POH)\\n2. **Pick a landing area** - ~1.5 nm glide range per 1,000 ft AGL\\n3. **Attempt restart:** Fuel selector BOTH, mixture RICH, carb heat ON, cycle ignition\\n4. **Declare:** Squawk 7700 | MAYDAY MAYDAY MAYDAY, [callsign], engine failure, [position], [altitude], [souls on board], [intentions]\\n\\n**Forced landing:** Land into wind on flat terrain. Fuel off, mixture ICO, mags off, master off just before touchdown. Flaps full on short final. Unlatch door before touchdown.\\n\\nAlways use your specific POH emergency checklist.';`
  },
  {
    tags: "['weight','balance','wb','cg','center of gravity','loading','max gross','gross weight','aft cg']",
    body: `var ac=p&&p.ac?p.ac.name:'your aircraft';
    return '**Weight and Balance - '+ac+'**\\n\\n**Why it matters:**\\n- Aft CG: reduced pitch stability, higher stall speed, can be unrecoverable\\n- Forward CG: harder to flare, limited by elevator authority at low speed\\n- Over max gross: higher stall speeds, longer takeoff roll, degraded climb\\n\\n**Formula:** CG = Sum(Arm x Weight) / Total Weight\\n\\n**Common traps:** Forgetting fuel weight (avgas = 6 lb/gal), underestimating passenger weight, full fuel + full pax often over gross.\\n\\nUse the W and B tab to compute CG and see the envelope diagram.';`
  },
  {
    tags: "['metar','decode weather','taf','forecast','read metar','altimeter','altim','rawob','raw metar']",
    body: `var dm=p&&p.dm;var am=p&&p.am;var info='';
    if(dm&&p)info+='\\n\\n**Departure ('+p.depIcao+'):** '+(p.depWind||'no wind data');
    if(am&&p)info+='\\n**Arrival ('+p.arrIcao+'):** '+(p.arrWind||'no wind data');
    return '**Weather / METAR Decode**'+info+'\\n\\n**METAR order:** Station | Time | Auto | Wind | Vis | Weather | Sky | Temp/Dew | Altimeter | Remarks\\n\\n- **Wind:** 27015G22KT = from 270 at 15 kt, gusting 22 kt\\n- **Visibility:** 10SM = 10 statute miles\\n- **Sky:** FEW/SCT/BKN/OVC = 1-2/3-4/5-7/8 oktas cover. Height in hundreds of ft AGL\\n- **Temp/Dew:** 22/14 = 22C temp, 14C dew point. Close spread = fog/precip risk\\n- **Altimeter:** A2992 = 29.92 inHg\\n\\nFull METAR + TAF raw text is in the WEATHER tab.';`
  },
  {
    tags: "['altitude','cruise altitude','hemispheric','odd thousand','even thousand','vfr altitude','91.159','cruise level']",
    body: `var alt=p?p.alt:null;var crs=p?p.crs:null;var planInfo='';
    if(alt&&crs!=null){var rule=crs>=0&&crs<180?'odd thousands + 500 ft (eastbound, 0-179)':'even thousands + 500 ft (westbound, 180-359)';planInfo='\\n\\nYour plan: **'+alt.toLocaleString()+' ft** on course **'+Math.round(crs)+'** - '+rule+'.';}
    return '**VFR Cruise Altitudes (FAR 91.159)**'+planInfo+'\\n\\n- **Eastbound (0-179):** 3,500 / 5,500 / 7,500 / 9,500 / 11,500 ft\\n- **Westbound (180-359):** 4,500 / 6,500 / 8,500 / 10,500 ft\\n\\nApplies above 3,000 ft AGL. Higher = better TAS, lower fuel burn, fewer traffic conflicts.';`
  },
  {
    tags: "['night','sunset','sunrise','civil twilight','night currency','legal night','night vfr','fly at night']",
    body: `return '**Night VFR**\\n\\n**Legal night (FAR 1.1):** Evening civil twilight to morning civil twilight. Civil twilight ends ~30 minutes after official sunset.\\n\\n**Night currency (FAR 61.57b):** 3 takeoffs + 3 full-stop landings at night within the past 90 days to carry passengers.\\n\\n**Equipment:** Position lights, anti-collision light (strobe/beacon). Landing light required if for hire.\\n\\nThe Brief tab shows sunrise, sunset, and end of civil twilight for your arrival airport, with a warning if your ETA is after civil twilight.';`
  },
  {
    tags: "['stall','spin','slow flight','maneuvering speed','va ','turbulence','rough air','structural']",
    body: `var ac=p&&p.ac?p.ac.name:'your aircraft';
    return '**Stalls and Maneuvering Speed**\\n\\n**Stall recovery:** Reduce AOA (forward pressure), level wings, add full power, minimize altitude loss.\\n\\n**Maneuvering Speed (Va):** Maximum speed for full control deflection in turbulence. Decreases with lighter weight. In turbulence, slow to Va and avoid abrupt or combined full inputs.\\n\\n**'+ac+' Va:** Check your POH at your actual weight - typically 95-110 KIAS for GA singles.\\n\\n**Spins:** Most GA aircraft require utility category certification for intentional spins. Recovery: full opposite rudder, brisk forward stick, recover from the resulting dive.';`
  },
  {
    tags: "['squawk','transponder','mode c','ads-b','1200','7700','7600','7500']",
    body: `return '**Transponder and ADS-B**\\n\\n**VFR codes:** 1200 (VFR default) | 7700 (emergency) | 7600 (lost comms) | 7500 (hijack - do not dial accidentally)\\n\\n**ADS-B Out required (FAR 91.225):** Class A/B/C airspace, Class E above 10,000 ft MSL, within 30 nm of Class B airports (Mode C veil).\\n\\n**ADS-B In (traffic/weather):** Optional but strongly recommended. Receive TIS-B traffic and FIS-B weather (METARs, TAFs, PIREPs, AirMETs, SIGMETs) in-cockpit for free via a portable receiver.';`
  },
  {
    tags: "['foreflight','fpl','export','download flight plan','fpl file','garmin pilot']",
    body: `var wpts=typeof STATE!=='undefined'&&STATE&&STATE.waypoints?STATE.waypoints.length:'all';
    return '**Export to ForeFlight / Garmin Pilot**\\n\\n1. Tap the **FPL FILE** tab\\n2. Click **Download .fpl**\\n3. AirDrop the file to your iPad then tap to open in ForeFlight\\n4. All '+wpts+' waypoints appear on the ForeFlight map\\n\\nAlternately, email the .fpl to yourself and tap the attachment on your iPad. The same .fpl format also imports into Garmin Pilot.';`
  },
  {
    tags: "['pirep','pilot report','turbulence report','icing report','rides','ride report']",
    body: `return '**PIREPs (Pilot Reports)**\\n\\n**Reading a PIREP:** UA /OV DEN /TM 1530 /FL 095 /TP C172 /SK SCT045 /TB LGT\\n- OV=over DEN | TM=1530Z | FL=9,500 ft | TP=C172 | SK=scattered 4,500 | TB=light turbulence\\n\\n**Turbulence:** Smooth - Light - Moderate - Severe - Extreme\\n**Icing:** Trace - Light - Moderate - Severe\\n\\n**Where to find:** aviationweather.gov PIREPs, or the ForeFlight map layer.\\n\\nFile a PIREP if you experience notable conditions - the absence of PIREPs is not the same as the absence of hazards.';`
  },
  {
    tags: "['atc','clearance','readback','approach control','tower frequency','ground control','departure frequency','flight following']",
    body: `var arr=p?p.arrIcao:'[Arr]';
    return '**ATC Phraseology**\\n\\n**Required readbacks:** Altitude assignments, altimeter settings, runway assignments, taxi instructions across active runways, hold-short instructions, frequency changes.\\n\\n**Requesting flight following:** "[Facility], [N-number], [type], [position], [altitude], VFR to [destination], request flight following."\\n\\n**ATIS:** Get '+arr+' ATIS before entering the terminal area. Note active runway, ceiling, vis, wind, altimeter. Use the code on first call: "with information Bravo."\\n\\n**Declaring emergency:** No authorization needed. MAYDAY MAYDAY MAYDAY on current frequency.\\n\\nATC LIVE tab: Transcribe radio calls in-cockpit using your device microphone.';`
  }
];

const kbCode = `// ===== OFFLINE AVIATION KNOWLEDGE BASE =====
var AVIATION_KB=[
` + kbEntries.map(e =>
  `  {tags:${e.tags},fn:function(p){\n    ${e.body}\n  }}`
).join(',\n') + `
];
function matchAviationKB(query,plan){
  var lo=query.toLowerCase();var best=null,bestScore=0;
  for(var i=0;i<AVIATION_KB.length;i++){var e=AVIATION_KB[i];var sc=0;for(var j=0;j<e.tags.length;j++){if(lo.includes(e.tags[j]))sc++;}if(sc>bestScore){bestScore=sc;best=e;}}
  if(best&&bestScore>0){try{return best.fn(plan);}catch(er){return null;}}
  return null;
}
`;

replace(
  `  m.appendChild(d);m.scrollTop=m.scrollHeight;\n}\nasync function sendChat(){`,
  `  m.appendChild(d);m.scrollTop=m.scrollHeight;\n}\n` + kbCode + `async function sendChat(){`
);
console.log('7. AVIATION_KB + matchAviationKB OK');

// 8. Replace if(!key) block
const MARKER_START = "  if(!key){\n    const lo=msg.toLowerCase();const p=STATE.plan;let r='';"
const MARKER_END = "    STATE.hist.push({role:'assistant',content:r});addChatMsg('ai',r);document.getElementById('chat-send').disabled=false;return;\n  }";

if (!h.includes(MARKER_START)) throw new Error('MARKER_START not found');
if (!h.includes(MARKER_END)) throw new Error('MARKER_END not found');

const blockStart = h.indexOf(MARKER_START);
const blockEnd = h.indexOf(MARKER_END) + MARKER_END.length;
const oldBlock = h.slice(blockStart, blockEnd);

const newBlock = `  if(!key){
    var _kbPlan=STATE.plan;var _kbR=matchAviationKB(msg,_kbPlan);
    if(!_kbR){
      if(_kbPlan)_kbR='**'+_kbPlan.primary+'** | Alt: **'+_kbPlan.alt.toLocaleString()+' ft** | **'+_kbPlan.eteMin+' min** | **'+_kbPlan.totalFuel+' gal** | **'+STATE.waypoints.length+' waypoints**\\n\\nAsk me: pattern entry, crosswind, density altitude, VFR minimums, CTAF calls, fuel planning, emergencies, W&B, METAR decoding. Add an Anthropic API key for full AI responses.';
      else _kbR='Build a flight plan first, then ask about pattern entry, crosswind, density altitude, VFR minimums, fuel, CTAF calls, emergencies, weight and balance, or METAR decoding.';
    }
    STATE.hist.push({role:'assistant',content:_kbR});addChatMsg('ai',_kbR);document.getElementById('chat-send').disabled=false;return;
  }`;

h = h.slice(0, blockStart) + newBlock + h.slice(blockEnd);
console.log('8. if(!key) block replaced OK');

// ─── Verify ───────────────────────────────────────────────────────
const blocks = getScripts(h);
let errors = 0;
blocks.forEach((b, i) => {
  try { new vm.Script(b); }
  catch(e) { console.log(`Block ${i} PARSE ERROR: ${e.message}\n${e.stack.slice(0, 200)}`); errors++; }
});

if (errors === 0) {
  writeFileSync('src/avisor-planner.html', h, 'utf8');
  console.log('All ' + blocks.length + ' script blocks parse OK. File saved.');
} else {
  console.log('ERRORS FOUND - file NOT saved.');
  process.exit(1);
}
