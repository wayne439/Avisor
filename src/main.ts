import "./styles.css";

/**
 * Dev home: open full PilotAvisor planner (served from /avisor.html) over http://localhost
 * so weather, NOTAMs, and map tiles work. Persistence demo stays below.
 */
import { appendFlightEvent, loadFlightSnapshot, loadRecentEvents, saveFlightSnapshot } from "./lib/persist";
import { isOnline, onNetworkChange } from "./lib/network";

const SNAPSHOT_KEY = "flight/current";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  const base = import.meta.env.BASE_URL || "/";
  const url = `${base}sw.js`.replace(/\/+/g, "/");
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(url, { scope: base })
      .then((reg) => console.log("[shell] SW registered", reg.scope))
      .catch((e) => console.warn("[shell] SW", e));
  });
}

type FormFields = { dep: string; arr: string; runway: string; atis: string; note: string };
type BuildMeta = {
  version?: string;
  commit?: string;
  generatedAtUtc?: string;
  dirty?: boolean;
};

async function readBuildMeta(): Promise<BuildMeta | null> {
  try {
    const base = import.meta.env.BASE_URL || "/";
    const url = `${base}build-meta.json`.replace(/\/+/g, "/");
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as BuildMeta;
  } catch {
    return null;
  }
}

function readForm(): FormFields {
  return {
    dep: (document.getElementById("f-dep") as HTMLInputElement).value.trim().toUpperCase(),
    arr: (document.getElementById("f-arr") as HTMLInputElement).value.trim().toUpperCase(),
    runway: (document.getElementById("f-rwy") as HTMLInputElement).value.trim(),
    atis: (document.getElementById("f-atis") as HTMLInputElement).value.trim(),
    note: (document.getElementById("f-note") as HTMLTextAreaElement).value.trim(),
  };
}

function writeForm(data: FormFields): void {
  (document.getElementById("f-dep") as HTMLInputElement).value = data.dep;
  (document.getElementById("f-arr") as HTMLInputElement).value = data.arr;
  (document.getElementById("f-rwy") as HTMLInputElement).value = data.runway;
  (document.getElementById("f-atis") as HTMLInputElement).value = data.atis;
  (document.getElementById("f-note") as HTMLTextAreaElement).value = data.note;
}

function setStatus(online: boolean, lastSaved: string | null): void {
  const dot = document.getElementById("net-dot");
  const lab = document.getElementById("net-label");
  const sav = document.getElementById("last-saved");
  if (dot) dot.className = "dot " + (online ? "on" : "off");
  if (lab) lab.textContent = online ? "Online" : "Offline";
  if (sav) sav.textContent = lastSaved ? `Last device save: ${lastSaved}` : "No snapshot on this device yet";
}

async function refreshEventLog(): Promise<void> {
  const el = document.getElementById("event-log");
  if (!el) return;
  const rows = await loadRecentEvents(25);
  if (!rows.length) {
    el.textContent = "No events.";
    return;
  }
  el.innerHTML = rows.map((r) => `<div class="ev">${esc(JSON.stringify(r))}</div>`).join("");
}

async function boot(): Promise<void> {
  registerServiceWorker();
  const root = document.getElementById("app");
  if (!root) return;

  const avisorUrl = `${import.meta.env.BASE_URL || "/"}avisor.html`.replace(/\/+/g, "/");
  const airportBriefUrl = `${import.meta.env.BASE_URL || "/"}airport-brief.html`.replace(/\/+/g, "/");
  const meta = await readBuildMeta();
  const ver = meta ? `${meta.version || "0.0.0"} · ${meta.commit || "unknown"}${meta.dirty ? "-dirty" : ""}` : "build meta unavailable";

  root.innerHTML = `
    <header class="top">
      <span class="brand">PilotAvisor</span>
      <span id="net-dot" class="dot"></span>
      <span id="net-label"></span>
      <span class="build-stamp">Build ${esc(ver)}</span>
    </header>

    <section class="card hero">
      <h1>A cockpit planning copilot built for real GA workload</h1>
      <p class="lead">Plan, brief, route, export, and re-brief in one workflow. PilotAvisor is safety-first, source-backed, and designed to keep workload down when it matters.</p>
      <div class="row">
        <a class="big-btn" href="${avisorUrl}">Open Flight Planner →</a>
        <a class="big-btn secondary-link" href="${airportBriefUrl}">Open Airport Brief →</a>
      </div>
      <ul class="proof-list">
        <li>ForeFlight-ready route export and in-flight replan loop</li>
        <li>Offline-aware app shell with local FAA and airport datasets</li>
        <li>Build stamp + deploy verify hooks for trustable releases</li>
      </ul>
      <p class="hint">Planner file: <code>public/avisor.html</code> · Re-copy and stamp version: <code>npm run sync:avisor</code></p>
    </section>

    <section class="card">
      <h2>Why PilotAvisor</h2>
      <p class="lead">Aviation tools should feel like a briefing assistant, not a generic chatbot. PilotAvisor focuses on briefing readiness, route clarity, and fast cockpit decisions.</p>
      <div class="grid">
        <div class="mini">
          <b>Brief-ready outputs</b>
          <span>Weather, NOTAM, runway, frequencies, and route context in one flow.</span>
        </div>
        <div class="mini">
          <b>Pilot workflow fit</b>
          <span>Optimized for iPad/phone cockpit use and quick updates under load.</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Offline persistence demo</h2>
      <p id="last-saved" class="muted"></p>
      <div class="grid">
        <label>From <input id="f-dep" maxlength="4" value="KSDL" /></label>
        <label>To <input id="f-arr" maxlength="4" value="KASE" /></label>
      </div>
      <label>Runway <input id="f-rwy" /></label>
      <label>ATIS <input id="f-atis" /></label>
      <label>Notes <textarea id="f-note" rows="2"></textarea></label>
      <div class="row">
        <button type="button" id="btn-save">Save to device</button>
        <button type="button" id="btn-load" class="secondary">Load</button>
        <button type="button" id="btn-log" class="secondary">Log event</button>
      </div>
      <div id="event-log" class="log"></div>
    </section>

    <p class="steps"><b>Production build:</b> <code>npm run build</code> then <code>npm run preview</code> — service worker + static <code>avisor.html</code> in <code>dist/</code>.</p>
  `;

  let lastSaved: string | null = null;
  const snap = await loadFlightSnapshot<FormFields>(SNAPSHOT_KEY);
  if (snap?.data) {
    writeForm({
      dep: snap.data.dep || "",
      arr: snap.data.arr || "",
      runway: snap.data.runway || "",
      atis: snap.data.atis || "",
      note: snap.data.note || "",
    });
    lastSaved = snap.savedAt;
  }
  setStatus(isOnline(), lastSaved);
  onNetworkChange((on) => setStatus(on, lastSaved));

  document.getElementById("btn-save")?.addEventListener("click", async () => {
    await saveFlightSnapshot(SNAPSHOT_KEY, readForm());
    lastSaved = new Date().toISOString();
    setStatus(isOnline(), lastSaved);
  });
  document.getElementById("btn-load")?.addEventListener("click", async () => {
    const got = await loadFlightSnapshot<FormFields>(SNAPSHOT_KEY);
    if (!got?.data) {
      alert("No snapshot.");
      return;
    }
    writeForm(got.data);
    lastSaved = got.savedAt;
    setStatus(isOnline(), lastSaved);
  });
  document.getElementById("btn-log")?.addEventListener("click", async () => {
    await appendFlightEvent({ type: "note", ...readForm() });
    await refreshEventLog();
  });
  await refreshEventLog();
}

boot().catch(console.error);
