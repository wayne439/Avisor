#!/usr/bin/env node
/* Build app-ready FAA data JSON from faa_master.xlsx + faa_data_dictionary.xlsx */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = process.cwd();
const MASTER_XLSX = path.join(ROOT, "faa_master.xlsx");
const DICT_XLSX = path.join(ROOT, "faa_data_dictionary.xlsx");
const FREQ_CSV = path.join(ROOT, "airport-frequencies.csv");
const OUT_DIR = path.join(ROOT, "public", "data");

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(MASTER_XLSX)) fail("Missing faa_master.xlsx at project root.");
if (!fs.existsSync(DICT_XLSX)) fail("Missing faa_data_dictionary.xlsx at project root.");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function readRows(file, sheet) {
  const wb = XLSX.readFile(file);
  if (!wb.SheetNames.includes(sheet)) fail(`Missing sheet "${sheet}" in ${path.basename(file)}.`);
  return XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: "", raw: false });
}

function up(v) {
  return String(v || "").trim().toUpperCase();
}

function num(v, d = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function firstNonEmpty(arr) {
  for (const x of arr) {
    if (x != null && String(x).trim() !== "") return x;
  }
  return "";
}

function runwayRefToHeading(ref) {
  const m = String(ref || "").toUpperCase().match(/^(\d{1,2})([LCR])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 1 || n > 36) return null;
  return (n * 10) % 360;
}

function addIdentIndex(map, ident, value) {
  const k = up(ident);
  if (!k) return;
  map[k] = value;
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const airportRows = readRows(MASTER_XLSX, "Airports");
const runwayRows = readRows(MASTER_XLSX, "Runways");
const remarkRows = readRows(MASTER_XLSX, "Airport Remarks");
const scheduleRows = readRows(MASTER_XLSX, "Airport Schedules");

const dictWb = XLSX.readFile(DICT_XLSX);
const dictSheets = ["Facilities", "Remarks", "Runways", "Schedules"];
const dataDictionary = {};
for (const name of dictSheets) {
  if (!dictWb.SheetNames.includes(name)) continue;
  const rows = XLSX.utils.sheet_to_json(dictWb.Sheets[name], { defval: "", raw: false });
  const out = {};
  for (const row of rows) {
    const field = String(row.Field || "").trim();
    if (!field) continue;
    out[field] = {
      number: String(row.Number || "").trim(),
      description: String(row.Description || "").trim(),
    };
  }
  dataDictionary[name.toLowerCase()] = out;
}

const siteToKeys = {};
const airportsDb = {};
const airportDetails = {};

for (const row of airportRows) {
  const siteId = up(row["Site Id"]);
  const locId = up(row["Loc Id"]);
  const icaoId = up(row["ICAO Id"]);
  const stateId = up(row["State Id"]);
  const name = String(row["Name"] || locId || icaoId).trim();
  const lat = num(row["ARP Latitude DD"]);
  const lon = num(row["ARP Longitude DD"]);
  const elev = Math.round(num(row["Elevation"], 0));
  if (!locId && !icaoId) continue;

  const keys = [];
  if (icaoId) keys.push(icaoId);
  if (locId) keys.push(locId);
  if (!icaoId && locId.length === 3 && /^[A-Z0-9]{3}$/.test(locId)) keys.push(`K${locId}`);

  const packed = [name, lat, lon, elev, stateId];
  const detail = {
    siteId,
    locId,
    icaoId,
    stateId,
    stateName: String(row["State Name"] || "").trim(),
    county: String(row["County"] || "").trim(),
    city: String(row["City"] || "").trim(),
    facilityType: String(row["Facility Type"] || "").trim(),
    use: String(row["Use"] || "").trim(),
    ownership: String(row["Ownership"] || "").trim(),
    fuelTypes: String(firstNonEmpty([row["Fuel Available"], row["Fuel Types"]])).trim(),
    beaconSchedule: String(row["Beacon Schedule"] || "").trim(),
    beaconColor: String(row["Beacon Color"] || "").trim(),
    manager: String(row["Manager"] || "").trim(),
    managerPhone: String(row["Manager Phone"] || "").trim(),
    owner: String(row["Owner"] || "").trim(),
    ownerPhone: String(row["Owner Phone"] || "").trim(),
    effectiveDate: String(row["Effective Date"] || "").trim(),
    lat,
    lon,
    elev,
  };

  for (const k of keys) {
    addIdentIndex(airportsDb, k, packed);
    addIdentIndex(airportDetails, k, detail);
  }
  if (siteId) siteToKeys[siteId] = Array.from(new Set(keys.map(up)));
}

const runwaysByIdent = {};
for (const row of runwayRows) {
  const siteId = up(row["Site Id"]);
  const locId = up(row["Loc Id"]);
  const keys = new Set(siteToKeys[siteId] || []);
  if (locId) {
    keys.add(locId);
    if (locId.length === 3 && /^[A-Z0-9]{3}$/.test(locId)) keys.add(`K${locId}`);
  }
  if (!keys.size) continue;

  const len = Math.max(1000, Math.round(num(row["Length"], 0)));
  const wid = Math.max(0, Math.round(num(row["Width"], 0)));
  const surf = String(row["Surface Type Condition"] || "").trim();
  const edge = String(row["Edge Light Intensity"] || "").trim();
  const rwyId = String(row["Runway Id"] || "").trim();

  const bId = up(row["Base End Id"]);
  const rId = up(row["Reciprocal End Id"]);
  const bH = num(row["Base True Heading"], runwayRefToHeading(bId));
  const rH = num(row["Reciprocal True Heading"], runwayRefToHeading(rId));
  const bPat = up(row["Base Right Hand Traffic Pattern"]) === "Y" ? "R" : "L";
  const rPat = up(row["Reciprocal Right Hand Traffic Pattern"]) === "Y" ? "R" : "L";

  const ends = [];
  if (bId) {
    ends.push({
      id: bId,
      hdg: Math.round((bH == null ? runwayRefToHeading(bId) || 0 : bH) % 360),
      len,
      wid,
      pat: bPat,
      surface: surf,
      edgeLights: edge,
      ilsType: String(row["Base ILS Type"] || "").trim(),
      pair: rId,
      runway: rwyId,
      src: "faa-master",
    });
  }
  if (rId) {
    ends.push({
      id: rId,
      hdg: Math.round((rH == null ? runwayRefToHeading(rId) || 0 : rH) % 360),
      len,
      wid,
      pat: rPat,
      surface: surf,
      edgeLights: edge,
      ilsType: String(row["Reciprocal ILS Type"] || "").trim(),
      pair: bId,
      runway: rwyId,
      src: "faa-master",
    });
  }

  for (const key of keys) {
    const k = up(key);
    if (!k) continue;
    if (!runwaysByIdent[k]) runwaysByIdent[k] = [];
    for (const rw of ends) runwaysByIdent[k].push(rw);
  }
}

for (const k of Object.keys(runwaysByIdent)) {
  const seen = {};
  runwaysByIdent[k] = runwaysByIdent[k].filter((rw) => {
    const kk = `${rw.id}@${rw.hdg}@${rw.len}`;
    if (seen[kk]) return false;
    seen[kk] = 1;
    return true;
  });
}

const remarksByIdent = {};
for (const row of remarkRows) {
  const locId = up(row["Loc Id"]);
  const icaoId = up(row["ICAO Id"]);
  const txt = String(row["Remark"] || "").trim();
  if (!txt) continue;
  const keys = [];
  if (icaoId) keys.push(icaoId);
  if (locId) keys.push(locId);
  if (!icaoId && locId.length === 3 && /^[A-Z0-9]{3}$/.test(locId)) keys.push(`K${locId}`);
  for (const key of keys) {
    const k = up(key);
    if (!k) continue;
    if (!remarksByIdent[k]) remarksByIdent[k] = [];
    remarksByIdent[k].push({
      element: String(row["Remark Element Name"] || "").trim(),
      text: txt,
    });
  }
}

const schedulesByIdent = {};
for (const row of scheduleRows) {
  const locId = up(row["Loc Id"]);
  const icaoId = up(row["ICAO Id"]);
  const schedule = String(row["Schedule"] || "").trim();
  if (!schedule) continue;
  const seq = num(row["Sequence"], 0);
  const keys = [];
  if (icaoId) keys.push(icaoId);
  if (locId) keys.push(locId);
  if (!icaoId && locId.length === 3 && /^[A-Z0-9]{3}$/.test(locId)) keys.push(`K${locId}`);
  for (const key of keys) {
    const k = up(key);
    if (!k) continue;
    if (!schedulesByIdent[k]) schedulesByIdent[k] = [];
    schedulesByIdent[k].push({ sequence: seq, text: schedule });
  }
}
for (const k of Object.keys(schedulesByIdent)) {
  schedulesByIdent[k].sort((a, b) => a.sequence - b.sequence);
}

const frequenciesByIdent = {};
if (fs.existsSync(FREQ_CSV)) {
  const txt = fs.readFileSync(FREQ_CSV, "utf8");
  const lines = txt.split(/\r?\n/).filter(Boolean);
  if (lines.length > 1) {
    const hdr = parseCsvLine(lines[0]);
    const idx = {};
    hdr.forEach((h, i) => (idx[String(h).trim()] = i));
    function putFreq(rec, t, f, d) {
      if (!f) return;
      const ty = up(t);
      const desc = String(d || "").toUpperCase();
      if (ty === "ATIS" || ty === "D-ATIS" || desc.includes("ATIS")) rec.atis = rec.atis || f;
      else if (ty === "CTAF") rec.ctaf = rec.ctaf || f;
      else if (ty === "GND" || ty === "GROUND") rec.gnd = rec.gnd || f;
      else if (ty === "TWR" || ty === "TOWER") rec.twr = rec.twr || f;
      else if (ty === "APP" || ty === "A/D" || ty === "APP/DEP" || desc.includes("APP")) rec.app = rec.app || f;
      else if (ty === "DEP" || desc.includes("DEP")) rec.dep = rec.dep || f;
      else if (ty === "UNIC" || ty === "UNICOM" || desc.includes("UNICOM")) rec.ctaf = rec.ctaf || f;
      else if (ty === "AWOS" || ty === "ASOS" || desc.includes("AWOS") || desc.includes("ASOS")) rec.awos = rec.awos || f;
      else if (ty === "CLR" || ty === "CLNC" || desc.includes("CLEARANCE")) rec.clr = rec.clr || f;
      else rec.misc = rec.misc ? `${rec.misc}, ${f}` : f;
    }
    for (let i = 1; i < lines.length; i++) {
      const c = parseCsvLine(lines[i]);
      const ident = up(c[idx.airport_ident]);
      if (!ident) continue;
      const freq = String(c[idx.frequency_mhz] || "").trim();
      if (!freq) continue;
      const type = c[idx.type] || "";
      const desc = c[idx.description] || "";
      const keys = [ident];
      if (ident.length === 3 && /^[A-Z0-9]{3}$/.test(ident)) keys.push(`K${ident}`);
      for (const key of keys) {
        if (!frequenciesByIdent[key]) frequenciesByIdent[key] = {};
        putFreq(frequenciesByIdent[key], type, freq, desc);
      }
    }
  }
}

const meta = {
  source: "faa_master.xlsx + faa_data_dictionary.xlsx",
  generatedAtUtc: new Date().toISOString(),
  counts: {
    airportsRows: airportRows.length,
    runwaysRows: runwayRows.length,
    remarksRows: remarkRows.length,
    schedulesRows: scheduleRows.length,
    frequenciesRows: fs.existsSync(FREQ_CSV) ? Math.max(0, fs.readFileSync(FREQ_CSV, "utf8").split(/\r?\n/).length - 1) : 0,
    airportKeys: Object.keys(airportsDb).length,
    runwaysKeys: Object.keys(runwaysByIdent).length,
    remarksKeys: Object.keys(remarksByIdent).length,
    schedulesKeys: Object.keys(schedulesByIdent).length,
    frequenciesKeys: Object.keys(frequenciesByIdent).length,
  },
};

function writeJson(name, obj) {
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(obj));
  console.log(`wrote public/data/${name}`);
}

writeJson("faa-airports-db.json", airportsDb);
writeJson("faa-airport-details.json", airportDetails);
writeJson("faa-runways-by-ident.json", runwaysByIdent);
writeJson("faa-remarks-by-ident.json", remarksByIdent);
writeJson("faa-schedules-by-ident.json", schedulesByIdent);
writeJson("faa-frequencies-by-ident.json", frequenciesByIdent);
writeJson("faa-data-dictionary.json", dataDictionary);
writeJson("faa-import-meta.json", meta);

console.log("FAA import complete:", JSON.stringify(meta.counts));
