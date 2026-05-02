/**
 * One-time (or CI) download of map/PDF libs into public/vendor/
 * so avisor works offline after SW cache / without CDN.
 */
const fs = require("fs");
const path = require("path");
const https = require("https");

const root = path.join(__dirname, "..", "public", "vendor");
const imagesDir = path.join(root, "leaflet", "images");

const files = [
  {
    url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    dest: path.join(root, "pdf.min.js"),
  },
  {
    url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    dest: path.join(root, "pdf.worker.min.js"),
  },
  {
    url: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
    dest: path.join(root, "leaflet", "leaflet.min.css"),
  },
  {
    url: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js",
    dest: path.join(root, "leaflet", "leaflet.min.js"),
  },
  {
    url: "https://unpkg.com/esri-leaflet@3.0.10/dist/esri-leaflet.js",
    dest: path.join(root, "esri-leaflet.js"),
  },
];

const leafletImages = [
  "layers.png",
  "layers-2x.png",
  "marker-icon.png",
  "marker-icon-2x.png",
  "marker-shadow.png",
];

function get(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode >= 301 && res.statusCode <= 308 && res.headers.location) {
          return get(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`${url} -> ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function main() {
  fs.mkdirSync(imagesDir, { recursive: true });
  for (const { url, dest } of files) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    process.stdout.write(`fetch ${url}\n`);
    const buf = await get(url);
    fs.writeFileSync(dest, buf);
  }
  for (const img of leafletImages) {
    const url = `https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/${img}`;
    const dest = path.join(imagesDir, img);
    process.stdout.write(`fetch ${url}\n`);
    const buf = await get(url);
    fs.writeFileSync(dest, buf);
  }
  process.stdout.write(`done → ${root}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
