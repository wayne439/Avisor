/**
 * Copy AVISOR single-file build into public/avisor.html for Vite serving.
 * Override source: set AVISOR_SRC to full path of your .html file.
 */
const fs = require("fs");
const path = require("path");

const defaultSrc = path.join(
  process.env.USERPROFILE || "",
  "Desktop",
  "avisor_v5.html",
);
const src = process.env.AVISOR_SRC || defaultSrc;
const dest = path.join(__dirname, "..", "public", "avisor.html");

if (!fs.existsSync(src)) {
  console.error("Source not found:", src);
  console.error("Set AVISOR_SRC to your avisor HTML path, or place avisor_v5.html on Desktop.");
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log("Copied", src, "->", dest);

const { spawnSync } = require("child_process");
const inject = path.join(__dirname, "inject-gps-proximity.cjs");
if (fs.existsSync(inject)) {
  const r = spawnSync(process.execPath, [inject], {
    stdio: "inherit",
    cwd: path.join(__dirname, ".."),
  });
  if (r.status) process.exit(r.status ?? 1);
}
