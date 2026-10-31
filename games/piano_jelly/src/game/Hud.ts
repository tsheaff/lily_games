import * as THREE from 'three';

const HEART_PATH =
  'M12 21.4 10.6 20C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5L12 21.4z';

function heartSvg(fill: number) {
  const id = `h${Math.random().toString(36).slice(2, 8)}`;
  return `<svg viewBox="0 0 24 24" width="30" height="30">
    <defs><clipPath id="${id}"><rect x="0" y="0" width="${24 * fill}" height="24"/></clipPath></defs>
    <path d="${HEART_PATH}" fill="rgba(40,10,20,0.45)" stroke="rgba(255,255,255,0.85)" stroke-width="1.4"/>
    <path d="${HEART_PATH}" fill="#ff3b5c" clip-path="url(#${id})"/>
  </svg>`;
}

function el(tag: string, id: string, parent: HTMLElement, html = '') {
  const e = document.createElement(tag);
  e.id = id;
  e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

export interface Indicated {
  position: THREE.Vector3;
  urgent: boolean;
}

/** All on-screen 2D UI for the combat layer. */
export class Hud {
  private hearts: HTMLElement;
  private rupees: HTMLElement;
  private banner: HTMLElement;
  private vignette: HTMLElement;
  private indicators: HTMLElement;
  private bossBar: HTMLElement;
  private bossFill: HTMLElement;
  private gameOver: HTMLElement;
  private arrows: HTMLElement[] = [];
  private lastHearts = '';
  private bannerTimer?: number;

  constructor() {
    const root = document.getElementById('hud')!;
    const status = el('div', 'status', root);
    this.hearts = el('div', 'hearts', status);
    this.rupees = el('div', 'rupees', status);
    this.banner = el('div', 'banner', root);
    this.vignette = el('div', 'vignette', root);
    this.indicators = el('div', 'indicators', root);
    this.bossBar = el('div', 'boss', root, '<span>King Octorok</span><div class="track"><div class="fill"></div></div>');
    this.bossFill = this.bossBar.querySelector('.fill')!;
    this.gameOver = el(
      'div',
      'gameover',
      root,
      '<h2>Game Over</h2><p class="stats"></p><p>press <kbd>Enter</kbd> to rise again</p>',
    );
  }

  setHealth(half: number, maxHalf: number) {
    const key = `${half}/${maxHalf}`;
    if (key === this.lastHearts) return;
    this.lastHearts = key;
    let html = '';
    for (let i = 0; i < maxHalf / 2; i++) {
      html += heartSvg(THREE.MathUtils.clamp((half - i * 2) / 2, 0, 1));
    }
    this.hearts.innerHTML = html;
    this.hearts.classList.toggle('low', half <= 2);
  }

  setRupees(n: number) {
    this.rupees.innerHTML = `<i></i>${String(n).padStart(3, '0')}`;
  }

  pulseRupees() {
    this.rupees.classList.remove('pulse');
    void this.rupees.offsetWidth;
    this.rupees.classList.add('pulse');
  }

  announce(title: string, subtitle = '', seconds = 2.4) {
    this.banner.innerHTML = `<h2>${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}`;
    this.banner.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('show'), seconds * 1000);
  }

  hurt() {
    this.vignette.classList.remove('flash');
    void this.vignette.offsetWidth;
    this.vignette.classList.add('flash');
  }

  setBoss(health: number | null, max = 1) {
    this.bossBar.classList.toggle('show', health !== null);
    if (health !== null) this.bossFill.style.width = `${Math.max(0, (health / max) * 100)}%`;
  }

  showGameOver(stats: string | null) {
    this.gameOver.classList.toggle('show', stats !== null);
    if (stats !== null) this.gameOver.querySelector('.stats')!.textContent = stats;
  }

  /** Arrows on the screen edge pointing at enemies you can't see. */
  updateIndicators(items: Indicated[], camera: THREE.Camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const view = new THREE.Vector3();
    let n = 0;
    for (const item of items) {
      view.copy(item.position).applyMatrix4(camera.matrixWorldInverse);
      const ndc = item.position.clone().project(camera);
      const onScreen = view.z < 0 && Math.abs(ndc.x) < 0.92 && Math.abs(ndc.y) < 0.9;
      if (onScreen) continue;

      const angle = Math.atan2(view.x, -view.z);
      const x = w / 2 + Math.sin(angle) * (w / 2 - 44);
      const y = h / 2 - Math.cos(angle) * (h / 2 - 44) * 0.85;
      const a = this.arrows[n] ?? this.makeArrow();
      a.style.display = 'block';
      a.style.transform = `translate(${x - 14}px, ${y - 14}px) rotate(${angle}rad)`;
      a.classList.toggle('urgent', item.urgent);
      n++;
    }
    for (let i = n; i < this.arrows.length; i++) this.arrows[i].style.display = 'none';
  }

  private makeArrow() {
    const a = document.createElement('div');
    a.className = 'arrow';
    this.indicators.appendChild(a);
    this.arrows.push(a);
    return a;
  }
}
