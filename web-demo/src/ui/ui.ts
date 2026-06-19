import type { ThemeDef } from '../data/types';
import type { Economy } from '../systems/Economy';
import type { RunResult } from '../world/World';

// DOM arcade UI (replaces the Phaser Menu/Hud/GameOver scenes). Overlaid on the
// 3D canvas; styled to the Orbitron/Rajdhani neon look. Single theme: NOVA LANCE.

const VERSION = 'v0.4.0';

export function injectStyles(theme: ThemeDef): void {
  if (document.getElementById('vl-style')) return;
  const p = theme.palette;
  const el = document.createElement('style');
  el.id = 'vl-style';
  el.textContent = `
  :root{--accent:${p.accent};--text:${p.text};--bg:${p.bg};--bg2:${p.bgAccent};--danger:${p.danger};
    --coin:#ffe27a;--ink:rgba(8,4,24,.72);}
  .vl-screen{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
    justify-content:center;gap:clamp(12px,2.2vh,20px);text-align:center;font-family:'Rajdhani',sans-serif;
    color:var(--text);padding:clamp(16px,4vh,32px);box-sizing:border-box;overflow-y:auto;
    background:radial-gradient(120% 80% at 50% 0%,rgba(0,0,0,0) 40%,rgba(0,0,0,.55) 100%);
    animation:vlfade .35s ease both;}
  @keyframes vlfade{from{opacity:0}to{opacity:1}}
  @keyframes vlrise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  .vl-rise{animation:vlrise .4s cubic-bezier(.2,.8,.2,1) both;}

  /* ---- title ---- */
  .vl-titlewrap{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;}
  .vl-title{font-family:'Orbitron',sans-serif;font-weight:900;
    font-size:clamp(40px,9vw,76px);letter-spacing:clamp(3px,1vw,8px);line-height:1;margin:0;color:#fff;
    text-shadow:0 0 8px var(--accent),0 0 28px var(--accent),0 0 60px var(--accent),0 4px 0 rgba(0,0,0,.4);
    animation:vltitle 3.6s ease-in-out infinite;}
  @keyframes vltitle{0%,100%{text-shadow:0 0 8px var(--accent),0 0 24px var(--accent),0 0 50px var(--accent),0 4px 0 rgba(0,0,0,.4)}
    50%{text-shadow:0 0 14px var(--accent),0 0 40px var(--accent),0 0 80px var(--accent),0 4px 0 rgba(0,0,0,.4)}}
  .vl-bar{width:min(320px,70vw);height:4px;border-radius:3px;
    background:linear-gradient(90deg,transparent,var(--accent) 18%,#fff 50%,var(--accent) 82%,transparent);
    box-shadow:0 0 16px var(--accent);background-size:200% 100%;animation:vlsweep 3s linear infinite;}
  @keyframes vlsweep{from{background-position:200% 0}to{background-position:-200% 0}}
  .vl-tag{font-weight:600;letter-spacing:3px;opacity:.8;text-transform:uppercase;font-size:clamp(12px,2.6vw,16px);}

  /* ---- panels / chips ---- */
  .vl-panel{background:linear-gradient(180deg,rgba(27,11,77,.5),var(--ink));
    border:2px solid var(--accent);border-radius:16px;padding:14px 20px;
    box-shadow:0 0 24px rgba(0,0,0,.5),0 0 18px rgba(255,255,255,.04),inset 0 0 24px rgba(255,255,255,.04);
    backdrop-filter:blur(2px);}
  .vl-chip{display:flex;gap:clamp(14px,4vw,28px);align-items:center;font-family:'Orbitron',sans-serif;
    font-weight:700;font-size:clamp(14px,2.6vw,17px);padding:10px 22px;}
  .vl-chip .lbl{font-family:'Rajdhani';font-weight:600;font-size:11px;letter-spacing:2px;opacity:.55;
    display:block;text-align:left;}
  .vl-coin{color:var(--coin);text-shadow:0 0 10px rgba(255,226,122,.5);}
  .vl-best{font-family:'Orbitron',sans-serif;font-weight:700;color:var(--accent);text-shadow:0 0 10px var(--accent);}

  .vl-hangar{min-width:min(360px,90vw);max-width:560px;width:min(80%,560px);}
  .vl-hangar h3{font-family:'Orbitron',sans-serif;font-size:13px;letter-spacing:3px;color:var(--accent);
    opacity:.9;margin:0 0 12px;text-align:left;display:flex;justify-content:space-between;}
  .vl-hangar h3 .sub{opacity:.4;font-weight:500;letter-spacing:1px;}
  .vl-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:9px 0;
    padding:6px 8px;border-radius:10px;transition:background .15s;}
  .vl-row:hover{background:rgba(255,255,255,.04);}
  .vl-row .name{font-weight:700;font-size:clamp(15px,3.4vw,19px);text-align:left;flex:1;}
  .vl-pips{display:flex;gap:3px;margin-right:8px;}
  .vl-pip{width:14px;height:8px;border:1px solid var(--accent);border-radius:2px;opacity:.5;transition:.2s;}
  .vl-pip.on{background:var(--accent);box-shadow:0 0 6px var(--accent);opacity:1;}

  /* ---- buttons ---- */
  .vl-btn{font-family:'Orbitron',sans-serif;font-weight:700;letter-spacing:2px;color:#fff;cursor:pointer;
    background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(0,0,0,.2));
    border:2px solid var(--accent);border-radius:12px;padding:10px 18px;font-size:clamp(15px,3.4vw,18px);
    text-shadow:0 0 8px var(--accent);transition:transform .08s,box-shadow .15s,background .15s;
    user-select:none;-webkit-user-select:none;}
  .vl-btn:hover{box-shadow:0 0 22px var(--accent);transform:translateY(-1px);background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(0,0,0,.15));}
  .vl-btn:active{transform:scale(.97);}
  .vl-btn.small{font-size:clamp(13px,3vw,15px);padding:8px 12px;min-width:78px;}
  .vl-btn.ghost{border-color:rgba(255,255,255,.3);text-shadow:none;color:var(--text);font-size:clamp(12px,2.8vw,14px);
    padding:8px 16px;letter-spacing:2px;}
  .vl-btn.ghost:hover{border-color:var(--accent);box-shadow:0 0 14px rgba(255,255,255,.15);}
  .vl-btn.maxed{opacity:.5;cursor:default;border-color:var(--text);text-shadow:none;}
  .vl-btn.maxed:hover{box-shadow:none;transform:none;background:linear-gradient(180deg,rgba(255,255,255,.12),rgba(0,0,0,.2));}
  .vl-btn.cant{opacity:.5;}
  .vl-launch{font-size:clamp(22px,5vw,30px);padding:14px clamp(28px,8vw,48px);
    animation:vlpulse 1.1s ease-in-out infinite alternate;}
  @keyframes vlpulse{from{transform:scale(1);box-shadow:0 0 14px var(--accent)}to{transform:scale(1.04);box-shadow:0 0 30px var(--accent)}}
  .vl-actions{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center;}
  .vl-hint{font-weight:500;letter-spacing:2px;opacity:.5;font-size:clamp(12px,2.6vw,15px);}
  .vl-footer{font-family:'Orbitron',sans-serif;font-size:11px;letter-spacing:2px;opacity:.35;}

  /* ---- how to play ---- */
  .vl-help{text-align:left;max-width:min(560px,92vw);width:100%;}
  .vl-help h3{font-family:'Orbitron',sans-serif;font-size:13px;letter-spacing:3px;color:var(--accent);
    opacity:.9;margin:14px 0 8px;}
  .vl-help h3:first-child{margin-top:0;}
  .vl-help p{margin:6px 0;font-size:clamp(13px,3vw,16px);line-height:1.5;opacity:.92;}
  .vl-key{display:inline-block;font-family:'Orbitron',sans-serif;font-weight:700;font-size:12px;
    padding:2px 8px;margin:0 2px;border:1px solid var(--accent);border-radius:6px;color:var(--accent);
    box-shadow:0 0 8px rgba(255,255,255,.06);}
  .vl-legend{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px 14px;margin-top:6px;}
  .vl-leg{display:flex;align-items:center;gap:8px;font-size:clamp(12px,2.8vw,14px);}
  .vl-dot{width:11px;height:11px;border-radius:50%;flex:0 0 auto;box-shadow:0 0 7px currentColor;}
  .vl-leg b{font-weight:700;}.vl-leg .d{opacity:.6;}

  /* ---- game over ---- */
  .vl-go-title{font-family:'Orbitron',sans-serif;font-weight:900;font-size:clamp(36px,8vw,56px);color:#fff;
    letter-spacing:clamp(2px,1vw,6px);text-shadow:0 0 12px var(--danger),0 0 36px var(--danger);
    animation:vlshake .5s ease both;}
  @keyframes vlshake{0%{transform:translateY(-18px) scale(1.1);opacity:0}60%{transform:none;opacity:1}
    70%{transform:translateX(-4px)}82%{transform:translateX(4px)}100%{transform:none}}
  .vl-newbest{font-family:'Orbitron',sans-serif;font-weight:700;font-size:clamp(15px,3.6vw,20px);
    color:var(--coin);text-shadow:0 0 14px var(--coin);letter-spacing:2px;animation:vlbest .8s ease-in-out infinite alternate;}
  @keyframes vlbest{from{transform:scale(1);filter:brightness(1)}to{transform:scale(1.06);filter:brightness(1.3)}}
  .vl-stat{display:flex;justify-content:space-between;gap:clamp(24px,8vw,56px);font-size:clamp(16px,4vw,22px);margin:10px 0;}
  .vl-stat .k{opacity:.65;font-weight:600;letter-spacing:1px;}
  .vl-stat .v{font-family:'Orbitron',sans-serif;font-weight:700;}
  .vl-stat .v.coin{color:var(--coin);text-shadow:0 0 10px rgba(255,226,122,.5);}

  /* ---- in-game HUD ---- */
  .vl-hud{position:absolute;inset:0;pointer-events:none;font-family:'Rajdhani',sans-serif;color:var(--text);}
  .vl-hud .bar{position:absolute;top:0;left:0;width:100%;height:64px;
    background:linear-gradient(180deg,rgba(2,1,8,.62),rgba(2,1,8,0));}
  .vl-hud .score{position:absolute;top:8px;left:16px;font-family:'Orbitron',sans-serif;font-weight:700;
    font-size:clamp(20px,5vw,26px);text-shadow:0 0 10px rgba(255,255,255,.15);}
  .vl-hud .score small{display:block;font-size:11px;letter-spacing:2px;opacity:.55;font-family:'Rajdhani';font-weight:600;}
  .vl-hud .coins{position:absolute;top:12px;right:16px;font-family:'Orbitron',sans-serif;font-weight:700;
    color:var(--coin);font-size:clamp(18px,4.5vw,22px);text-shadow:0 0 10px rgba(255,226,122,.4);text-align:right;}
  .vl-hud .coins small{display:block;font-size:11px;letter-spacing:2px;opacity:.5;font-family:'Rajdhani';font-weight:600;color:var(--text);}
  .vl-hud .center{position:absolute;top:8px;left:0;width:100%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:3px;}
  .vl-hud .level{font-weight:700;letter-spacing:3px;opacity:.85;font-size:clamp(14px,3.4vw,17px);text-transform:uppercase;}
  .vl-hud .combo{font-family:'Orbitron',sans-serif;font-weight:700;color:var(--accent);
    text-shadow:0 0 10px var(--accent);font-size:clamp(16px,4vw,21px);min-height:22px;}
  .vl-hud .combo.bump{animation:vlbump .18s ease;}
  @keyframes vlbump{0%{transform:scale(1)}40%{transform:scale(1.3)}100%{transform:scale(1)}}
  .vl-hud .weapon{font-family:'Orbitron',sans-serif;font-weight:700;color:var(--accent);
    font-size:clamp(13px,3vw,15px);min-height:16px;opacity:.92;letter-spacing:1px;}
  .vl-hud .lives{position:absolute;top:42px;right:16px;display:flex;gap:5px;}
  .vl-hud .life{width:16px;height:16px;border-radius:3px;background:var(--accent);box-shadow:0 0 8px var(--accent);transition:opacity .25s,box-shadow .25s;}
  .vl-hud .life.lost{opacity:.16;box-shadow:none;}
  /* level banner flourish */
  .vl-hud .banner{position:absolute;top:30%;left:0;width:100%;text-align:center;pointer-events:none;}
  .vl-hud .banner .txt{display:inline-block;font-family:'Orbitron',sans-serif;font-weight:900;
    font-size:clamp(22px,6vw,40px);letter-spacing:clamp(2px,1.2vw,8px);color:#fff;
    text-shadow:0 0 14px var(--accent),0 0 40px var(--accent);}
  .vl-hud .banner.show .txt{animation:vlbanner 2.2s cubic-bezier(.2,.8,.2,1) both;}
  @keyframes vlbanner{0%{opacity:0;transform:scale(.7) translateY(10px);letter-spacing:2px}
    18%{opacity:1;transform:scale(1) translateY(0)}78%{opacity:1}100%{opacity:0;transform:scale(1.05);letter-spacing:14px}}
  /* boss */
  .vl-hud .boss{position:absolute;top:104px;left:8%;width:84%;display:none;flex-direction:column;align-items:center;gap:5px;}
  .vl-hud .boss.intro{animation:vlbossin .6s cubic-bezier(.2,.8,.2,1) both;}
  @keyframes vlbossin{from{opacity:0;transform:translateY(-12px) scale(.9)}to{opacity:1;transform:none}}
  .vl-hud .boss .name{font-family:'Orbitron',sans-serif;font-weight:700;font-size:clamp(13px,3.2vw,16px);
    letter-spacing:3px;color:var(--danger);text-shadow:0 0 10px var(--danger);text-transform:uppercase;
    display:flex;align-items:center;gap:8px;}
  .vl-hud .boss .name::before,.vl-hud .boss .name::after{content:'';width:16px;height:1px;background:var(--danger);box-shadow:0 0 6px var(--danger);}
  .vl-hud .boss .track{width:100%;height:11px;background:rgba(255,255,255,.08);border:1px solid var(--danger);
    border-radius:6px;overflow:hidden;box-shadow:0 0 12px rgba(255,92,110,.35);}
  .vl-hud .boss .fill{height:100%;width:100%;background:linear-gradient(90deg,var(--danger),#ff9aa5);
    box-shadow:0 0 12px var(--danger);transition:width .12s linear;}
  `;
  document.head.appendChild(el);
}

export interface MenuHandle {
  destroy(): void;
}

// Short, presentational legend describing weapon power-ups (display-only copy).
const POWERUP_LEGEND: ReadonlyArray<{ tint: string; name: string; desc: string }> = [
  { tint: '#ff3df0', name: 'Overdrive', desc: 'rapid fire' },
  { tint: '#36e0ff', name: 'Spread', desc: 'wide shots' },
  { tint: '#ffe27a', name: 'Multishot', desc: 'extra lances' },
  { tint: '#7dff8a', name: 'Homing', desc: 'tracking rounds' },
  { tint: '#ff5c6e', name: 'Laser', desc: 'piercing beam' },
  { tint: '#9d7dff', name: 'Shield', desc: 'block one hit' },
  { tint: '#ff9a3d', name: 'Nuke', desc: 'clear screen' },
];

export function buildMenu(host: HTMLElement, theme: ThemeDef, economy: Economy, onLaunch: () => void): MenuHandle {
  const screen = document.createElement('div');
  screen.className = 'vl-screen';
  host.appendChild(screen);

  let view: 'menu' | 'help' = 'menu';

  const renderHelp = (): void => {
    screen.innerHTML = '';
    const help = h('div', 'vl-panel vl-help vl-rise');
    help.innerHTML = `
      <h3>FLIGHT CONTROLS</h3>
      <p><span class="vl-key">DRAG</span> or <span class="vl-key">W A S D</span> / <span class="vl-key">◀ ▲ ▼ ▶</span> to fly. Your lance <b>auto-fires</b> &mdash; focus on dodging.</p>
      <h3>BANKING</h3>
      <p>Steer hard and the hull <b>banks</b> into the turn, narrowing your profile. Lean through the swarm to slip incoming fire.</p>
      <h3>WEAPON PICKUPS</h3>`;
    const legend = h('div', 'vl-legend');
    for (const pu of POWERUP_LEGEND) {
      const row = h('div', 'vl-leg');
      const dot = h('span', 'vl-dot');
      dot.style.background = pu.tint;
      dot.style.color = pu.tint;
      row.append(dot, h('b', '', pu.name), h('span', 'd', `— ${pu.desc}`));
      legend.append(row);
    }
    help.append(legend);
    const tip = h('p', '');
    tip.innerHTML = 'Chain kills to build your <b>combo</b> for bonus score. Clear every wave to face the level boss.';
    help.append(tip);
    screen.append(h('h1', 'vl-title', 'HOW TO PLAY'), help);
    const back = h('div', 'vl-btn vl-rise', 'BACK');
    back.onclick = () => { view = 'menu'; render(); };
    screen.append(back);
  };

  const renderMenu = (): void => {
    screen.innerHTML = '';
    const titlewrap = h('div', 'vl-titlewrap vl-rise');
    titlewrap.append(h('h1', 'vl-title', 'VOIDLANCE'), h('div', 'vl-bar'), h('div', 'vl-tag', theme.tagline));
    screen.append(titlewrap);

    const chip = h('div', 'vl-panel vl-chip vl-rise');
    const coin = h('div', 'vl-coin');
    coin.append(h('span', 'lbl', 'COINS'), document.createTextNode(`◈ ${economy.coins(theme.id)}`));
    const best = h('div', 'vl-best');
    best.append(h('span', 'lbl', 'BEST'), document.createTextNode(`${economy.bestScore(theme.id)}`));
    chip.append(coin, best);
    screen.append(chip);

    const hangar = h('div', 'vl-panel vl-hangar vl-rise');
    const head = h('h3', '');
    head.append(h('span', '', 'HANGAR'), h('span', 'sub', 'UPGRADES'));
    hangar.append(head);
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
    screen.append(launch);

    const actions = h('div', 'vl-actions vl-rise');
    const help = h('div', 'vl-btn ghost', 'HOW TO PLAY');
    help.onclick = () => { view = 'help'; render(); };
    actions.append(help);
    screen.append(actions, h('div', 'vl-hint', 'DRAG TO MOVE  ·  AUTO-FIRE'), h('div', 'vl-footer', `NOVA LANCE  ·  ${VERSION}`));
  };

  const render = (): void => {
    if (view === 'help') renderHelp();
    else renderMenu();
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
  private bannerEl: HTMLElement;
  private bannerTxtEl: HTMLElement;
  private bossEl: HTMLElement;
  private bossNameEl: HTMLElement;
  private bossFillEl: HTMLElement;
  private lastMax = -1;
  private lastCombo = 0;
  private lastLevel = '';
  private bossShown = false;

  constructor(host: HTMLElement) {
    this.el = h('div', 'vl-hud');
    this.el.append(h('div', 'bar'));
    const score = h('div', 'score');
    score.append(h('small', '', 'SCORE'), document.createTextNode('000000'));
    this.scoreEl = score;
    this.coinsEl = h('div', 'coins');
    this.coinsEl.append(h('small', '', 'COINS'), document.createTextNode('◈ 0'));
    const center = h('div', 'center');
    this.levelEl = h('div', 'level', '');
    this.comboEl = h('div', 'combo', '');
    this.weaponEl = h('div', 'weapon', '');
    center.append(this.levelEl, this.comboEl, this.weaponEl);
    this.livesEl = h('div', 'lives');
    this.bannerEl = h('div', 'banner');
    this.bannerTxtEl = h('div', 'txt', '');
    this.bannerEl.append(this.bannerTxtEl);
    this.bossEl = h('div', 'boss');
    this.bossNameEl = h('div', 'name', '');
    this.bossFillEl = h('div', 'fill');
    const track = h('div', 'track');
    track.append(this.bossFillEl);
    this.bossEl.append(this.bossNameEl, track);
    this.el.append(score, this.coinsEl, center, this.livesEl, this.bannerEl, this.bossEl);
    host.appendChild(this.el);
  }

  update(s: HudState): void {
    this.scoreEl.lastChild!.textContent = `${s.score}`.padStart(6, '0');
    this.coinsEl.lastChild!.textContent = `◈ ${s.coins}`;
    this.levelEl.textContent = s.level;
    this.comboEl.textContent = s.combo > 1 ? `COMBO x${s.combo}` : '';
    if (s.combo > this.lastCombo && s.combo > 1) {
      this.comboEl.classList.remove('bump');
      void this.comboEl.offsetWidth; // restart animation
      this.comboEl.classList.add('bump');
    }
    this.lastCombo = s.combo;
    this.weaponEl.textContent = s.weapon;

    // level-name banner transition: fire the flourish when the level name changes
    if (s.level && s.level !== this.lastLevel) {
      this.lastLevel = s.level;
      this.bannerTxtEl.textContent = s.level;
      this.bannerEl.classList.remove('show');
      void this.bannerEl.offsetWidth;
      this.bannerEl.classList.add('show');
    }

    if (s.maxHp !== this.lastMax) {
      this.lastMax = s.maxHp;
      this.livesEl.innerHTML = '';
      for (let i = 0; i < s.maxHp; i++) this.livesEl.append(h('span', 'life'));
    }
    const lives = this.livesEl.children;
    for (let i = 0; i < lives.length; i++) (lives[i] as HTMLElement).className = `life${i < s.hp ? '' : ' lost'}`;

    if (s.bossHp >= 0) {
      if (!this.bossShown) {
        this.bossShown = true;
        this.bossEl.style.display = 'flex';
        this.bossEl.classList.remove('intro');
        void this.bossEl.offsetWidth;
        this.bossEl.classList.add('intro');
      }
      this.bossNameEl.textContent = s.bossName;
      this.bossFillEl.style.width = `${Math.max(0, s.bossHp) * 100}%`;
    } else if (this.bossShown) {
      this.bossShown = false;
      this.bossEl.style.display = 'none';
      this.bossEl.classList.remove('intro');
    }
  }

  destroy(): void {
    this.el.remove();
  }
}

export function buildGameOver(host: HTMLElement, theme: ThemeDef, r: RunResult, onRetry: () => void, onMenu: () => void): MenuHandle {
  const screen = h('div', 'vl-screen');
  screen.append(h('div', 'vl-go-title', 'RUN OVER'), h('div', 'vl-tag', theme.name));
  const panel = h('div', 'vl-panel vl-rise');
  panel.style.minWidth = 'min(320px,90vw)';
  panel.append(stat('SCORE', `${r.score}`));
  if (r.isBest) panel.append(h('div', 'vl-newbest', '★ NEW BEST ★'));
  else panel.append(stat('BEST', `${r.best}`));
  panel.append(stat('COINS EARNED', `+${r.coins}`, true));
  screen.append(panel);
  const actions = h('div', 'vl-actions vl-rise');
  const retry = h('div', 'vl-btn vl-launch', 'RETRY');
  retry.style.fontSize = 'clamp(20px,5vw,26px)';
  retry.onclick = onRetry;
  const menu = h('div', 'vl-btn ghost', 'HANGAR');
  menu.onclick = onMenu;
  actions.append(retry, menu);
  screen.append(actions);
  host.appendChild(screen);
  return { destroy: () => screen.remove() };
}

function stat(k: string, v: string, coin = false): HTMLElement {
  const row = h('div', 'vl-stat');
  row.append(h('span', 'k', k), h('span', `v${coin ? ' coin' : ''}`, v));
  return row;
}

function h(tag: string, cls = '', text = ''): HTMLElement {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
}
