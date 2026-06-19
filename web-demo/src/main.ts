import { initData } from './data/loader';
import { SaveStore } from './systems/Save';
import { Economy } from './systems/Economy';
import { setServices } from './services';
import { Game } from './app/Game';
import { preloadModels } from './render/models';
import { preloadTextures } from './render/textures';
import { Audio, mountMuteButton } from './audio';

// VOIDLANCE — Phase 0 web prototype, 3D (Three.js). Single theme: NOVA LANCE.
// Validates canonical shared-data, preloads the Kenney glTF ships, then boots
// the sim/render game loop. Model-load failure falls back to primitives.
async function boot(): Promise<void> {
  const mount = document.getElementById('game');
  if (!mount) return;

  let data;
  try {
    data = initData();
  } catch (err) {
    showError(mount, err);
    return;
  }

  const theme = data.themes[0]; // NOVA LANCE — the only theme
  const save = new SaveStore(theme.id);
  const economy = new Economy(data, save);
  setServices({ data, save, economy });

  try {
    await preloadModels();
  } catch (err) {
    console.warn('[models] glTF preload failed — using primitives', err);
  }

  try {
    await preloadTextures();
  } catch (err) {
    console.warn('[textures] laser sprite preload failed — using capsules', err);
  }

  // Procedural Web Audio system. Browsers start the context suspended until a
  // user gesture, so resume on the first pointer/key event (capture-phase, once).
  const audio = new Audio();
  const wake = (): void => {
    audio.resume();
    audio.startMusic();
  };
  const opts: AddEventListenerOptions = { once: true, capture: true };
  window.addEventListener('pointerdown', wake, opts);
  window.addEventListener('keydown', wake, opts);
  mountMuteButton(mount, audio);

  const game = new Game(mount, data, theme, economy, audio);
  (window as unknown as { __VL?: Game }).__VL = game;
  game.start();
}

function showError(mount: HTMLElement, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err);
  const el = document.createElement('pre');
  Object.assign(el.style, {
    position: 'absolute',
    inset: '0',
    margin: '0',
    padding: '40px',
    color: '#ff5c6e',
    background: '#140004',
    font: '16px monospace',
    whiteSpace: 'pre-wrap',
  } as Partial<CSSStyleDeclaration>);
  el.textContent = `DATA VALIDATION FAILED\n\n${msg}`;
  mount.appendChild(el);
  console.error(err);
}

boot();
