// A tiny self-contained mute toggle, mounted bottom-left, above all game layers
// (top corners are taken by the HUD score/coins readouts).
// Lives in the audio module so it never touches src/ui/. Clicking it also
// satisfies the autoplay gesture (Audio.resume is wired separately in main.ts,
// but this guarantees a path even if the user clicks the speaker first).

import type { Audio } from './Audio';

export function mountMuteButton(host: HTMLElement, audio: Audio): void {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Toggle sound');
  Object.assign(btn.style, {
    position: 'absolute',
    bottom: '12px',
    left: '12px',
    zIndex: '50',
    width: '40px',
    height: '40px',
    padding: '0',
    cursor: 'pointer',
    borderRadius: '10px',
    border: '2px solid rgba(255,255,255,.35)',
    background: 'rgba(8,4,24,.55)',
    color: '#fff',
    font: '18px/40px sans-serif',
    textAlign: 'center',
    userSelect: 'none',
    pointerEvents: 'auto',
  } as Partial<CSSStyleDeclaration>);

  const paint = (): void => {
    btn.textContent = audio.muted ? '🔇' : '🔊';
    btn.style.opacity = audio.muted ? '0.55' : '1';
  };
  paint();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.resume();
    audio.toggleMute();
    paint();
  });

  host.appendChild(btn);
}
