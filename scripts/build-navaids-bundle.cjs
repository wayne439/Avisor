const fs = require("fs");
const path = require("path");

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        q = !q;
      }
    } else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const root = path.join(__dirname, "..");
const src = path.join(root, "public", "data", "ourairports-navaids.csv");
const dest = path.join(root, "public", "data", "navaids-us-vor.json");

if (!fs.existsSync(src)) {
  console.error("Missing source CSV:", src);
  process.exit(1);
}

const txt = fs.readFileSync(src, "utf8");
const lines = txt.split(/\r?\n/).filter(Boolean);
if (lines.length < 2) {
  console.error("CSV has no data:", src);
  process.exit(1);
}

const hdr = parseCsvLine(lines[0]);
const idx = {};
hdr.forEach((h, i) => {
  idx[String(h).trim()] = i;
});

const out = [];
const seen = new Set();
for (let i = 1; i < lines.length; i += 1) {
  const c = parseCsvLine(lines[i]);
  const iso = String(c[idx.iso_country] || "").toUpperCase();
  if (iso && iso !== "US") continue;
  const typ = String(c[idx.type] || "").toUpperCase();
  if (!(typ.includes("VOR") || typ.includes("TACAN"))) continue;
  const id = String(c[idx.ident] || "").toUpperCase();
  if (!id || seen.has(id)) continue;
  const lat = Number(c[idx.latitude_deg]);
  const lon = Number(c[idx.longitude_deg]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
  const fk = Number(c[idx.frequency_khz]);
  const freq = Number.isFinite(fk) && fk > 0 ? (fk / 1000).toFixed(2) : "";
  const name = String(c[idx.name] || id);
  out.push({ id, lat, lon, freq, desc: `${name} ${typ}` });
  seen.add(id);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log("Wrote", out.length, "navaids ->", dest);
