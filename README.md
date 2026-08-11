# VOIDLANCE

A free-to-play, Galaga-style arcade shooter that runs in the browser. Real 3D
rendering with Three.js, top-down 2D gameplay, and a custom physics and wave engine
built from scratch.

Single theme: **NOVA LANCE**, neon synthwave.

## Playing it

```bash
cd web-demo
npm install
npm run dev        # http://localhost:5173
```

Drag to move (mouse or thumb), auto-fire. Clear waves, survive dive-bomb formations,
earn coins, and upgrade the ship between levels.

## What is in the build

| | |
|---|---|
| Levels | 5, each with its own wave script |
| Enemy archetypes | 9 (fighter, interceptor, razer, phantom, smasher, emitter, builder, demolisher, transport) |
| Bosses | 2 multi-part bosses: **NOVA WARDEN** and **NOVA LEVIATHAN**, with destructible parts and phase changes |
| Weapons and powerups | 8 (spreadshot, laser, homing, bot launcher, nuke, overdrive, shield, weapon up) |

Bosses are built from separate destructible parts rather than a single hitbox, so
knocking out a limb changes what the boss can do before it dies.

## Layout

```
.
├── shared-data/       Canonical game data as JSON plus JSON Schema
│   ├── levels/        wave scripts, one file per level
│   ├── enemies/       per-archetype behaviour and stats
│   ├── bosses/        multi-part boss definitions
│   ├── powerups/      weapon and pickup definitions
│   └── themes/        nova-lance.json
└── web-demo/          Three.js + TypeScript client (Vite)
    └── src/
        ├── app/       game loop and scene wiring
        ├── render/    Three.js rendering layer
        ├── audio/     sound and music
        └── data/      loaders for shared-data
```

`shared-data/` is the single source of truth. It is plain JSON with schemas, so
balance changes are data edits rather than code edits, and the client generates typed
loaders from it into `shared-data.generated/`.

## Tech

Three.js for rendering, TypeScript throughout, Vite for the build. The gameplay
simulation is custom: movement, collision, wave sequencing, and boss phases are all
hand-written rather than taken from a game framework. Ship models are CC0 assets from
the Kenney Space Kit.

## Status

Playable prototype. Five levels, two bosses, and the full weapon set are in and
working. Balance and feel are still being tuned.
