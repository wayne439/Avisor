(function () {
  const $ = (id) => document.getElementById(id);

  function setText(id, txt) {
    const el = $(id);
    if (el) el.textContent = txt;
  }

  function normIcao(raw) {
    const s = String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.length === 3) return "K" + s;
    return s;
  }

  function headingFromLabel(lbl) {
    const m = String(lbl || "").match(/^(\d{1,2})/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!isFinite(n) || n < 1 || n > 36) return null;
    return (n * 10) % 360;
  }

  function windComponents(wdir, wspd, rwHdg) {
    if (wdir == null || !isFinite(wspd) || rwHdg == null) return { head: null, cross: null };
    const d = ((wdir - rwHdg + 540) % 360) - 180;
    const rad = (d * Math.PI) / 180;
    return {
      head: Math.round(Math.cos(rad) * wspd),
      cross: Math.round(Math.abs(Math.sin(rad) * wspd)),
    };
  }

  async function fetchJson(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${url} (${r.status})`);
    return r.json();
  }

  async function loadMeta() {
    try {
      const meta = await fetchJson("./build-meta.json");
      setText("build-meta", `Build: ${meta.version || "?"} ${meta.commit || "?"}${meta.dirty ? "-dirty" : ""}`);
    } catch {
      setText("build-meta", "Build: unavailable");
    }
  }

  function tableFromRows(headers, rows) {
    if (!rows.length) return '<div class="muted">No rows available.</div>';
    const th = headers.map((h) => `<th>${h}</th>`).join("");
    const tr = rows
      .map((r) => `<tr>${r.map((v) => `<td>${v == null ? "—" : String(v)}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
  }

  async function loadBrief() {
    const icao = normIcao(($("icao") || {}).value);
    if (!icao) {
      setText("status", "Enter an ICAO.");
      return;
    }
    setText("status", `Loading ${icao}…`);
    setText("airport-summary", "Loading…");
    setText("runway-pick", "Loading…");
    setText("runways", "Loading…");
    setText("freqs", "Loading…");
    setText("wx", "Loading…");

    try {
      const [apDb, rwByIdent, frByIdent, metarRows, tafRows] = await Promise.all([
        fetchJson("./data/faa-airports-db.json"),
        fetchJson("./data/faa-runways-by-ident.json"),
        fetchJson("./data/faa-frequencies-by-ident.json"),
        fetchJson(`https://aviationweather.gov/awc-api/data/metar?ids=${encodeURIComponent(icao)}&format=json`).catch(() => []),
        fetchJson(`https://aviationweather.gov/awc-api/data/taf?ids=${encodeURIComponent(icao)}&format=json`).catch(() => []),
      ]);

      const apt = apDb[icao];
      const runways = Array.isArray(rwByIdent[icao]) ? rwByIdent[icao] : [];
      const freqs = frByIdent[icao] || {};

      if (!apt) {
        setText("status", `${icao} not found in local FAA airport database.`);
        setText("airport-summary", "Not found.");
        return;
      }

      const [name, lat, lon, elev, state] = apt;
      setText("airport-summary", `${icao} · ${name} (${state || "—"}) · Elev ${Math.round(Number(elev) || 0)} ft · ${Number(lat).toFixed(4)}, ${Number(lon).toFixed(4)}`);

      const metar = Array.isArray(metarRows) ? metarRows[0] : null;
      const taf = Array.isArray(tafRows) ? tafRows[0] : null;
      const wdir = metar && metar.wdir !== "VRB" ? Number(metar.wdir) : null;
      const wspd = metar ? Number(metar.wspd) : null;

      if (runways.length) {
        const picked = runways
          .map((r) => {
            const hdg = isFinite(Number(r.hdg)) ? Number(r.hdg) : headingFromLabel(r.id);
            const c = windComponents(wdir, wspd, hdg);
            return { r, hdg, comp: c };
          })
          .sort((a, b) => {
            const ah = a.comp.head == null ? -999 : a.comp.head;
            const bh = b.comp.head == null ? -999 : b.comp.head;
            if (bh !== ah) return bh - ah;
            return (Number(b.r.len) || 0) - (Number(a.r.len) || 0);
          })[0];

        const rw = picked.r;
        const hw = picked.comp.head;
        const cw = picked.comp.cross;
        const rwTxt = `${rw.id || "?"} (${Math.round(Number(rw.hdg) || 0)}°)`;
        const wxTxt = wdir == null || !isFinite(wspd) ? "Wind unavailable" : `Wind ${wdir}° @ ${wspd} kt`;
        $("runway-pick").innerHTML =
          `<div><b class="ok">Recommended runway: ${rwTxt}</b></div>` +
          `<div class="muted">${wxTxt} · Headwind ${hw == null ? "—" : hw + " kt"} · Crosswind ${cw == null ? "—" : cw + " kt"}</div>`;

        $("runways").innerHTML = tableFromRows(
          ["Runway", "Heading", "Length(ft)", "Surface", "Lights"],
          runways.slice(0, 20).map((r) => [
            r.id || "—",
            isFinite(Number(r.hdg)) ? `${Math.round(Number(r.hdg))}°` : "—",
            Number(r.len || 0).toLocaleString(),
            r.surface || "—",
            r.edgeLights || "—",
          ]),
        );
      } else {
        setText("runway-pick", "No runway rows found in FAA local dataset.");
        setText("runways", "No runway rows found.");
      }

      const freqRows = Object.entries(freqs).filter(([, v]) => v != null && String(v).trim() !== "");
      $("freqs").innerHTML = tableFromRows(
        ["Type", "Value"],
        freqRows.length ? freqRows.map(([k, v]) => [k.toUpperCase(), v]) : [],
      );

      const metarRaw = metar ? metar.rawOb || JSON.stringify(metar) : "METAR unavailable";
      const tafRaw = taf ? taf.rawTAF || taf.rawTaf || JSON.stringify(taf) : "TAF unavailable";
      $("wx").innerHTML =
        `<div><b>METAR:</b> <span class="mono">${metarRaw}</span></div>` +
        `<div style="margin-top:8px"><b>TAF:</b> <span class="mono">${tafRaw}</span></div>`;

      setText("status", `Loaded ${icao}`);
    } catch (e) {
      setText("status", `Load failed: ${e && e.message ? e.message : e}`);
    }
  }

  $("load-btn")?.addEventListener("click", loadBrief);
  $("icao")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") loadBrief();
  });

  loadMeta();
  loadBrief();
})();
