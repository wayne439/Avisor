# ✈️ Avisor — AI Pilot Planning Tool

> **⚠️ SAFETY DISCLAIMER:** Avisor is a **planning aid only**. It is NOT approved for sole-source navigation, ATC communications, or any safety-of-flight decision. Always verify all information against official FAA charts, NOTAMs, and ATC. The pilot in command is solely responsible for all flight decisions.

---

## What is Avisor?

Avisor is an AI-powered flight planning assistant for general aviation pilots. It runs as a Progressive Web App (PWA) and can be installed on iOS, Android, or desktop. It works **offline** — critical for cockpit use where connectivity is unreliable.

**Core features:**
- AI-assisted flight planning and preflight briefing
- Local FAA navaid, airport, and frequency database
- Offline-capable via Service Worker caching
- IndexedDB flight state persistence
- Multi-platform: web, iOS (Capacitor), Android (Capacitor), desktop (Tauri)

---

## Quick Start (Web)

```bash
npm install
npm run build:navaids && npm run build:faa
npm run sync:avisor
npm run dev
# Open http://localhost:5173
```

---

## Platform Commands

| Command | Description |
|---|---|
| `npm run dev` | Local web dev server |
| `npm run dev:lan` | LAN access for phone testing |
| `npm run build` | Production build |
| `npm run tunnel` | Tunnelmole public URL |
| `npm run cap:sync` | Capacitor mobile sync |
| `npm run desktop:dev` | Tauri desktop window |

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys. **Never commit `.env` to git.**

| Variable | Description |
|---|---|
| `VITE_OPENAI_API_KEY` | OpenAI API key for AI features |
| `VITE_WEATHER_API_KEY` | Weather API key |

---

## Project Structure

```
avisor/
├── src/            # TypeScript source
├── public/         # avisor.html + assets
├── scripts/        # FAA data build scripts
├── android/        # Capacitor Android
├── ios/            # Capacitor iOS
├── src-tauri/      # Tauri desktop
└── .github/        # CI workflows
```

---

## Data Sources

- **FAA data** — Downloaded at build time via `npm run fetch:faa`
- **Airport Frequencies** — OurAirports open data CSV
- **NOTAMs / Weather** — Live API (requires connectivity)

---

## Contributing

1. Fork and create a feature branch
2. Commit incrementally with clear messages
3. Ensure `npm run build` passes with no TypeScript errors
4. Open a Pull Request — CI runs automatically

---

## License

MIT

---

> **Avisor is a planning aid only. Not for sole-source navigation. Always fly with official charts and current ATC briefings.**
