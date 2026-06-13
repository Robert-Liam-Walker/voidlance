import type { ThemeDef } from '../data/types';
import type { Economy } from '../systems/Economy';
import type { RunResult } from '../world/World';

// DOM arcade UI (replaces the Phaser Menu/Hud/GameOver scenes). Overlaid on the
// 3D canvas; styled to the Orbitron/Rajdhani neon look. Single theme: NOVA LANCE.

export function injectStyles(theme: ThemeDef): void {
  if (document.getElementById('vl-style')) return;
  const p = theme.palette;
  const el = document.createElement('style');
  el.id = 'vl-style';
  el.textContent = `
  :root{--accent:${p.accent};--text:${p.text};--bg:${p.bg};--danger:${p.danger};}
  .vl-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:18px;text-align:center;font-family:'Rajdhani',sans-serif;
    color:var(--text);padding:24px;box-sizing:border-box;}
  .vl-title{font-family:'Orbitron',sans-serif;font-weight:900;font-size:64px;letter-spacing:4px;
    color:#fff;text-shadow:0 0 24px var(--accent),0 4px 0 rgba(0,0,0,.4);margin:0;}
  .vl-bar{width:300px;height:5px;background:var(--accent);box-shadow:0 0 14px var(--accent);border-radius:3px;}
  .vl-tag{font-weight:600;letter-spacing:3px;opacity:.85;text-transform:uppercase;font-size:16px;}
  .vl-panel{background:rgba(8,4,24,.72);border:2px solid var(--accent);border-radius:16px;
    padding:16px 20px;box-shadow:0 0 24px rgba(0,0,0,.5),inset 0 0 24px rgba(255,255,255,.04);}
  .vl-chip{display:flex;gap:18px;align-items:center;font-family:'Orbitron',sans-serif;font-weight:700;}
  .vl-coin{color:#ffe27a;}
  .vl-hangar{min-width:360px;max-width:560px;width:80%;}
  .vl-hangar h3{font-family:'Orbitron',sans-serif;font-size:14px;letter-spacing:2px;color:var(--accent);
    opacity:.85;margin:0 0 10px;text-align:left;}
  .vl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 0;}
  .vl-row .name{font-weight:700;font-size:19px;text-align:left;flex:1;}
  .vl-pips{display:flex;gap:3px;margin-right:8px;}
  .vl-pip{width:14px;height:8px;border:1px solid var(--accent);border-radius:2px;}
  .vl-pip.on{background:var(--accent);box-shadow:0 0 6px var(--accent);}
  .vl-btn{font-family:'Orbitron',sans-serif;font-weight:700;letter-spacing:2px;color:#fff;cursor:pointer;
    background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(0,0,0,.2));
    border:2px solid var(--accent);border-radius:12px;padding:10px 18px;font-size:18px;
    text-shadow:0 0 8px var(--accent);transition:transform .08s,box-shadow .15s;user-select:none;}
  .vl-btn:hover{box-shadow:0 0 18px var(--accent);transform:translateY(-1px);}
  .vl-btn:active{transform:scale(.97);}
  .vl-btn.small{font-size:15px;padding:8px 12px;min-width:78px;}
  .vl-btn.maxed{opacity:.5;cursor:default;border-color:var(--text);text-shadow:none;}
  .vl-btn.cant{opacity:.55;}
  .vl-launch{font-size:30px;padding:16px 48px;animation:vlpulse 1s ease-in-out infinite alternate;}
  @keyframes vlpulse{from{transform:scale(1)}to{transform:scale(1.04)}}
  .vl-hint{font-weight:500;letter-spacing:2px;opacity:.55;font-size:15px;}
  .vl-go-title{font-family:'Orbitron',sans-serif;font-weight:900;font-size:52px;color:#fff;
    text-shadow:0 0 22px var(--danger);}
  .vl-stat{display:flex;justify-content:space-between;gap:40px;font-size:22px;margin:10px 0;}
  .vl-stat .k{opacity:.7;font-weight:600;}
  .vl-stat .v{font-family:'Orbitron',sans-serif;font-weight:700;}
  .vl-best{font-family:'Orbitron',sans-serif;font-weight:700;color:var(--accent);text-shadow:0 0 10px var(--accent);}

  /* in-game HUD */
  .vl-hud{position:absolute;inset:0;pointer-events:none;font-family:'Rajdhani',sans-serif;color:var(--text);}
  .vl-hud .bar{position:absolute;top:0;left:0;width:100%;height:60px;
    background:linear-gradient(180deg,rgba(2,1,8,.6),rgba(2,1,8,0));}
  .vl-hud .score{position:absolute;top:8px;left:16px;font-family:'Orbitron',sans-serif;font-weight:700;font-size:26px;}
  .vl-hud .score small{display:block;font-size:11px;letter-spacing:2px;opacity:.6;font-family:'Rajdhani';font-weight:600;}
  .vl-hud .coins{position:absolute;top:14px;right:16px;font-family:'Orbitron',sans-serif;font-weight:700;color:#ffe27a;font-size:22px;}
  .vl-hud .center{position:absolute;top:8px;left:0;width:100%;text-align:center;}
  .vl-hud .level{font-weight:600;letter-spacing:2px;opacity:.85;font-size:17px;}
  .vl-hud .combo{font-family:'Orbitron',sans-serif;font-weight:700;color:var(--accent);text-shadow:0 0 8px var(--accent);font-size:20px;min-height:22px;}
  .vl-hud .weapon{font-family:'Orbitron',sans-serif;font-weight:700;color:var(--accent);font-size:15px;min-height:16px;opacity:.92;}
  .vl-hud .lives{position:absolute;top:36px;right:16px;display:flex;gap:5px;}
  .vl-hud .life{width:16px;height:16px;border-radius:3px;background:var(--accent);box-shadow:0 0 8px var(--accent);}
  .vl-hud .life.lost{opacity:.16;box-shadow:none;}
  .vl-hud .boss{position:absolute;top:104px;left:8%;width:84%;display:none;flex-direction:column;align-items:center;gap:4px;}
  .vl-hud .boss .name{font-family:'Orbitron',sans-serif;font-weight:700;font-size:15px;letter-spacing:2px;color:var(--danger);text-shadow:0 0 8px var(--danger);}
  .vl-hud .boss .track{width:100%;height:10px;background:rgba(255,255,255,.08);border:1px solid var(--danger);border-radius:6px;overflow:hidden;}
  .vl-hud .boss .fill{height:100%;width:100%;background:var(--danger);box-shadow:0 0 12px var(--danger);transition:width .12s linear;}
  `;
  document.head.appendChild(el);
}

export interface MenuHandle {
  destroy(): void;
}

export function buildMenu(host: HTMLElement, theme: ThemeDef, economy: Economy, onLaunch: () => void): MenuHandle {
  const screen = document.createElement('div');
  screen.className = 'vl-screen';
  host.appendChild(screen);

  const render = (): void => {
    screen.innerHTML = '';
    screen.append(
      h('h1', 'vl-title', 'VOIDLANCE'),
      h('div', 'vl-bar'),
      h('div', 'vl-tag', theme.tagline),
    );

    const chip = h('div', 'vl-panel vl-chip');
    chip.append(h('span', 'vl-coin', `◈ ${economy.coins(theme.id)}`), h('span', '', `BEST ${economy.bestScore(theme.id)}`));
    screen.append(chip);

    const hangar = h('div', 'vl-panel vl-hangar');
    hangar.append(h('h3', '', 'HANGAR'));
    for (const upg of economy.upgrades()) {
      const lvl = economy.level(theme.id, upg.id);
      const maxed = economy.isMaxed(theme.id, upg);
      const row = h('div', 'vl-row');
      row.append(h('span', 'name', upg.name));
      const pips = h('div', 'vl-pips');
      for (let i = 0; i < upg.maxLevel; i++) pips.append(h('span', `vl-pip${i < lvl ? ' on' : ''}`));
      row.append(pips);
      const btn = h('div', `vl-btn small${maxed ? ' maxed' : economy.canBuy(theme.id, upg) ? '' : ' cant'}`, maxed ? 'MAX' : `◈ ${economy.cost(theme.id, upg)}`);
      if (!maxed) btn.onclick = () => { if (economy.buy(theme.id, upg)) render(); };
      row.append(btn);
      hangar.append(row);
    }
    screen.append(hangar);

    const launch = h('div', 'vl-btn vl-launch', 'LAUNCH');
    launch.onclick = onLaunch;
    screen.append(launch, h('div', 'vl-hint', 'DRAG TO MOVE  ·  AUTO-FIRE'));
  };
  render();

  return { destroy: () => screen.remove() };
}

export interface HudState {
  score: number;
  coins: number;
  hp: number;
  maxHp: number;
  combo: number;
  weapon: string;
  level: string;
  bossHp: number; // 0..1, or <0 when no boss
  bossName: string;
}

export class Hud {
  private el: HTMLElement;
  private scoreEl: HTMLElement;
  private coinsEl: HTMLElement;
  private levelEl: HTMLElement;
  private comboEl: HTMLElement;
  private weaponEl: HTMLElement;
  private livesEl: HTMLElement;
  private bossEl: HTMLElement;
  private bossNameEl: HTMLElement;
  private bossFillEl: HTMLElement;
  private lastMax = -1;

  constructor(host: HTMLElement) {
    this.el = h('div', 'vl-hud');
    this.el.append(h('div', 'bar'));
    const score = h('div', 'score');
    score.append(h('small', '', 'SCORE'), document.createTextNode('000000'));
    this.scoreEl = score;
    this.coinsEl = h('div', 'coins', '◈ 0');
    const center = h('div', 'center');
    this.levelEl = h('div', 'level', '');
    this.comboEl = h('div', 'combo', '');
    this.weaponEl = h('div', 'weapon', '');
    center.append(this.levelEl, this.comboEl, this.weaponEl);
    this.livesEl = h('div', 'lives');
    this.bossEl = h('div', 'boss');
    this.bossNameEl = h('div', 'name', '');
    this.bossFillEl = h('div', 'fill');
    const track = h('div', 'track');
    track.append(this.bossFillEl);
    this.bossEl.append(this.bossNameEl, track);
    this.el.append(score, this.coinsEl, center, this.livesEl, this.bossEl);
    host.appendChild(this.el);
  }

  update(s: HudState): void {
    this.scoreEl.lastChild!.textContent = `${s.score}`.padStart(6, '0');
    this.coinsEl.textContent = `◈ ${s.coins}`;
    this.levelEl.textContent = s.level;
    this.comboEl.textContent = s.combo > 1 ? `COMBO x${s.combo}` : '';
    this.weaponEl.textContent = s.weapon;
    if (s.maxHp !== this.lastMax) {
      this.lastMax = s.maxHp;
      this.livesEl.innerHTML = '';
      for (let i = 0; i < s.maxHp; i++) this.livesEl.append(h('span', 'life'));
    }
    const lives = this.livesEl.children;
    for (let i = 0; i < lives.length; i++) (lives[i] as HTMLElement).className = `life${i < s.hp ? '' : ' lost'}`;
    if (s.bossHp >= 0) {
      this.bossEl.style.display = 'flex';
      this.bossNameEl.textContent = s.bossName;
      this.bossFillEl.style.width = `${Math.max(0, s.bossHp) * 100}%`;
    } else {
      this.bossEl.style.display = 'none';
    }
  }

  destroy(): void {
    this.el.remove();
  }
}

export function buildGameOver(host: HTMLElement, theme: ThemeDef, r: RunResult, onRetry: () => void, onMenu: () => void): MenuHandle {
  const screen = h('div', 'vl-screen');
  screen.append(h('div', 'vl-go-title', 'RUN OVER'), h('div', 'vl-tag', theme.name));
  const panel = h('div', 'vl-panel');
  panel.style.minWidth = '320px';
  panel.append(stat('SCORE', `${r.score}`));
  if (r.isBest) panel.append(h('div', 'vl-best', '★ NEW BEST ★'));
  else panel.append(stat('BEST', `${r.best}`));
  panel.append(stat('COINS', `+${r.coins}`));
  screen.append(panel);
  const retry = h('div', 'vl-btn vl-launch', 'RETRY');
  retry.style.fontSize = '26px';
  retry.onclick = onRetry;
  const menu = h('div', 'vl-btn', 'HANGAR');
  menu.onclick = onMenu;
  screen.append(retry, menu);
  host.appendChild(screen);
  return { destroy: () => screen.remove() };
}

function stat(k: string, v: string): HTMLElement {
  const row = h('div', 'vl-stat');
  row.append(h('span', 'k', k), h('span', 'v', v));
  return row;
}

function h(tag: string, cls = '', text = ''): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}
