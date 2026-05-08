const fs = require("fs");
const path = require("path");

const expectedPath = path.join(__dirname, "..", "public", "build-meta.json");
const target = process.env.DEPLOY_URL || "https://avisor.netlify.app";
const metaUrl = `${target.replace(/\/$/, "")}/build-meta.json`;

async function main() {
  if (!fs.existsSync(expectedPath)) {
    throw new Error("Missing public/build-meta.json. Run npm run stamp:version first.");
  }

  const expected = JSON.parse(fs.readFileSync(expectedPath, "utf8"));
  const res = await fetch(metaUrl, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${metaUrl} (${res.status})`);
  }
  const actual = await res.json();

  console.log("[verify:deploy] expected", `${expected.version} ${expected.commit}`);
  console.log("[verify:deploy] actual  ", `${actual.version || "?"} ${actual.commit || "?"}`);

  if (actual.commit !== expected.commit) {
    throw new Error("Deploy mismatch: remote commit does not match local build-meta.");
  }

  console.log("[verify:deploy] OK");
}

main().catch((err) => {
  console.error("[verify:deploy] FAIL:", err.message);
  process.exit(1);
});
