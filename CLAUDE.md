# VOIDLANCE — operating guide

> Working title. A modern **Galaga-style vertical shooter** for **mobile, F2P, built for
> revenue**. One app, **two switchable themed games** over shared runtime systems:
> **NOVA LANCE** (neon synthwave) ⇄ **VOID HORNET** (insectoid swarm).
>
> **Full product spec + phase plan:** `~/.claude/plans/create-a-game-in-floating-mochi.md`
> (the canonical design doc — read it before large changes).

## Status

- **Phase 0 (web prototype) — BUILT.** Phaser 3 + TypeScript in `web-demo/`, loading the
  canonical `shared-data/`. Proves the core loop + the theme swap. **Not part of the shippable app.**
- **Phase 1 (Unity money/save seam) — NOT STARTED.** Needs Robert to install Unity (see plan).
- Engine of record for the store build is **Unity**; the web build is the funnel + the slice
  Claude can verify in-CLI.

## HARD RULES (from Robert's plan reviews — do not violate)

1. **`shared-data/` is the single source of truth.** Themes, enemies, waves, power-ups, levels,
   economy live there as JSON validated by `shared-data/schema/*.schema.json`. **Any gameplay
   number hardcoded in code is a bug** unless explicitly marked prototype-only. Phaser loads it;
   Unity will import the same JSON. Schema-first: add/adjust schema + data, validate, *then* code.
2. **Brutal MVP only.** Build exactly the MVP list in the plan, nothing more. Prototype MVP =
   Phase 0; Store MVP = Phases 1–2; no expansion until the Store MVP ships with retention data.
3. **No speculative scaffolding.** A post-MVP feature is a **TODO in this file**, never an empty
   class / fake manager / placeholder architecture. (See the backlog below.)
4. **Gates block.** Don't start a phase until the previous gate passes and is committed.
5. **Monetization is a hypothesis** until retention is proven; analytics is not optional (Phase 1+).
6. **Both themes free by default** — never gate the core hook behind IAP.

## Repo layout

```
shared-data/     CANONICAL JSON + schema (single source of truth)
web-demo/        Phase 0 Phaser/TS prototype (Vite). Imports a generated mirror of shared-data.
unity/           (Phase 1) Unity store build — not yet created
CLAUDE.md        this file        plan: ~/.claude/plans/create-a-game-in-floating-mochi.md
```

## web-demo commands (Node 24 already installed)

```
cd web-demo
npm install
npm run validate:data   # headless schema + referential validation of shared-data/ (fail-hard)
npm run dev             # http://localhost:5173  (predev syncs shared-data)
npm run build           # tsc --noEmit + vite build -> dist/
npm run preview         # serve dist/ on 4173
```
`scripts/sync-data.mjs` mirrors `shared-data/` into `web-demo/src/shared-data.generated/`
(gitignored build output — never hand-edit). Verification harness: `.verify/screenshot.mjs`
(Playwright) writes shots to `web-demo/shots/`.

## Architecture (shared runtime systems + theme content packages)

- **Gameplay core:** `core/Player`, `core/Bullets` (pooled), `core/EnemyManager` (formation
  entrance + dive AI from wave data), `core/Enemy`, `core/Juice`, `core/Starfield`, `core/textures`.
- **Save / economy:** `systems/Save` (localStorage, versioned, `account.*` vs `theme.<id>.*`),
  `systems/Economy` (coins + upgrades; stats derived from theme + upgrades), `systems/ThemeManager`.
- **Data:** `data/loader` (validates canonical data, fail-hard), `data/types`.
- **Scenes:** `Boot` (textures + data init), `Menu` (title, theme portals, hangar, launch),
  `Game`, `Hud`, `GameOver`. Active theme drives palette/UI/enemies/background.

## TODO — post-MVP backlog (represent future work HERE, not as code)

Phase 1 (Unity): port the 4 layers; **LevelPlay** rewarded+interstitial (TEST ids); **Unity IAP**
test Remove-Ads; analytics (GameAnalytics) event taxonomy; the tiny JSON→ScriptableObject importer
(editor-time, fail hard, NO general pipeline); local save persistence across restart.

Phase 2 (Store MVP content): 10 levels, 1 boss, 1 ship, 3 upgrades, Void Hornet skin in Unity,
production interstitial logic (test ids).

Phase 3+ (retention-gated): Void Hornet full content (own enemies/bosses), more bosses/ships,
drone wingmen (Galaga dual-fighter), Endless mode, daily rewards, leaderboards, audio/music,
online backend (cloud save/live-ops), enemy object-pooling, code-splitting Phaser, custom art
(Kenney CC0 → bespoke), store/compliance (privacy + Data Safety, consent/UMP, ATT), real ad ids.
