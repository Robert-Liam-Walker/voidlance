import { initData } from './data/loader';
import { SaveStore } from './systems/Save';
import { Economy } from './systems/Economy';
import { setServices } from './services';
import { Game } from './app/Game';

// VOIDLANCE — Phase 0 web prototype, 3D (Three.js). Single theme: NOVA LANCE.
// Validates canonical shared-data, then boots the sim/render game loop.
function boot(): void {
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

  const game = new Game(mount, data, theme, economy);
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
