const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const outPath = path.join(root, "public", "build-meta.json");
const pkgPath = path.join(root, "package.json");

function git(cmd, fallback = "") {
  try {
    return execSync(`git ${cmd}`, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return fallback;
  }
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const commit = git("rev-parse --short HEAD", "nogit");
const branch = git("rev-parse --abbrev-ref HEAD", "unknown");
const dirty = git("status --porcelain", "") !== "";

const meta = {
  app: "PilotAvisor",
  version: pkg.version || "0.0.0",
  commit,
  branch,
  dirty,
  generatedAtUtc: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
console.log("[stamp:version] wrote", outPath);
console.log("[stamp:version]", `${meta.version} ${meta.commit}${meta.dirty ? "-dirty" : ""}`);
