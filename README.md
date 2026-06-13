# VOIDLANCE

A modern, Galaga-style vertical arcade shooter for mobile — **two switchable themed games in
one**: **NOVA LANCE** (neon synthwave) and **VOID HORNET** (insectoid swarm), sharing one engine.

Free-to-play. Unity is the store build of record; this repo currently contains the **Phase 0
web prototype** (Phaser 3 + TypeScript) that proves the core loop and the theme swap.

## Quick start (web prototype)

```bash
cd web-demo
npm install
npm run dev        # http://localhost:5173
```

Drag to move (thumb / mouse), auto-fire. Switch themes on the menu. Clear waves, dive-bomb
formations, earn coins, upgrade your ship.

## Layout

| Path | What |
|------|------|
| `shared-data/` | Canonical game data (JSON + JSON Schema) — the single source of truth |
| `web-demo/` | Phaser 3 + TypeScript prototype (Vite) |
| `unity/` | Unity store build (Phase 1, not yet created) |
| `CLAUDE.md` | Operating guide + rules + roadmap |

See `CLAUDE.md` and the design spec for the phase plan and hard rules.
