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

  root.innerHTML = `
    <header class="top">
      <span class="brand">PilotAvisor dev server</span>
      <span id="net-dot" class="dot"></span>
      <span id="net-label"></span>
    </header>

    <section class="card hero">
      <h1>Test the full planner</h1>
      <p class="lead">Weather, NOTAMs, and map layers need <b>http://localhost</b> — not a double‑clicked <code>file://</code> file.</p>
      <a class="big-btn" href="${avisorUrl}">Open PilotAvisor planner →</a>
      <p class="hint">Planner file: <code>public/avisor.html</code> · Re-copy from Desktop after edits: <code>npm run sync:avisor</code></p>
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
