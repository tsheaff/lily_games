import { SKIN_TONES, HAIR_COLORS, CLOTHES_COLORS, HAIR_STYLES, OUTFITS, HATS, KID_DEFAULTS, DEFAULT_SAILOR } from './sailor.js';
import { BOATS, BOAT_BY_ID, sailRowColors } from './boat.js';

const STORAGE_KEY = 'rainbowOcean.look';

export function loadLook() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.sailor && BOAT_BY_ID[saved.boat]) return { sailor: { ...DEFAULT_SAILOR, ...saved.sailor }, boat: saved.boat, saved: true };
  } catch {}
  return { sailor: { ...DEFAULT_SAILOR }, boat: BOATS[0].id, saved: false };
}

function saveLook(look) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sailor: look.sailor, boat: look.boat }));
  } catch {}
}

function boatIcon(style) {
  const rows = sailRowColors(style);
  const stops = rows
    .map((c, i) => `<stop offset="${i / rows.length}" stop-color="${c}"/><stop offset="${(i + 1) / rows.length}" stop-color="${c}"/>`)
    .join('');
  return `<svg viewBox="0 0 64 52"><defs><linearGradient id="s-${style.id}" x1="0" y1="1" x2="0" y2="0">${stops}</linearGradient></defs>
    <line x1="32" y1="4" x2="32" y2="40" stroke="#8b5a3c" stroke-width="2.5"/>
    <path d="M30 6 L30 38 L10 38 Z" fill="url(#s-${style.id})" stroke="#fff" stroke-width="1"/>
    <path d="M32 3 L32 9 L41 6 Z" fill="${style.flag}"/>
    <path d="M4 38 L60 38 L52 50 L12 50 Z" fill="${style.hull}" stroke="#fff" stroke-width="2"/>
    <rect x="36" y="31" width="13" height="7" rx="1.5" fill="${style.roof}"/></svg>`;
}

const SAILOR_TABS = [
  { id: 'me', icon: '🧒' },
  { id: 'hair', icon: '💇' },
  { id: 'clothes', icon: '👕' },
  { id: 'hat', icon: '🎩' },
];

/**
 * Two kid-friendly steps: dress up your sailor, then pick a boat.
 * Every tap previews live via `onChange`; `onDone` fires on "Let's Sail!".
 */
export class Picker {
  constructor({ onChange, onStep, onDone }) {
    this.root = document.getElementById('picker');
    this.title = document.getElementById('picker-title');
    this.tabs = document.getElementById('picker-tabs');
    this.body = document.getElementById('picker-body');
    this.back = document.getElementById('picker-back');
    this.next = document.getElementById('picker-next');
    this.onChange = onChange;
    this.onStep = onStep;
    this.onDone = onDone;
    this.tab = 'me';
    this.back.addEventListener('click', () => this.go('sailor'));
    this.next.addEventListener('click', () => {
      if (this.step === 'sailor') this.go('boat');
      else this.close();
    });
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  open(look) {
    this.look = { sailor: { ...look.sailor }, boat: look.boat };
    this.root.classList.remove('hidden');
    this.tab = 'me';
    this.go('sailor');
  }

  close() {
    saveLook(this.look);
    this.root.classList.add('hidden');
    this.onDone(this.look);
  }

  go(step) {
    this.step = step;
    this.title.textContent = step === 'sailor' ? 'Who is sailing today?' : 'Pick your boat!';
    this.back.classList.toggle('hidden', step === 'sailor');
    this.next.textContent = step === 'sailor' ? 'Next: Boat ➜' : "⛵ Let's Sail!";
    this.onStep(step);
    this.render();
  }

  update(patch) {
    Object.assign(this.look.sailor, patch);
    this.onChange(this.look);
    this.render();
  }

  render() {
    this.tabs.innerHTML = '';
    this.body.innerHTML = '';
    if (this.step === 'boat') {
      this.body.append(this.row(BOATS.map((b) => this.choice(b.name, null, this.look.boat === b.id, () => {
        this.look.boat = b.id;
        this.onChange(this.look);
        this.render();
      }, boatIcon(b)))));
      return;
    }

    for (const t of SAILOR_TABS) {
      const b = document.createElement('button');
      b.className = 'tab' + (this.tab === t.id ? ' on' : '');
      b.textContent = t.icon;
      b.addEventListener('click', () => {
        this.tab = t.id;
        this.render();
      });
      this.tabs.append(b);
    }

    const s = this.look.sailor;
    switch (this.tab) {
      case 'me':
        this.body.append(
          this.row([
            this.choice('Girl', '👧', s.kid === 'girl', () => this.update({ kid: 'girl', ...KID_DEFAULTS.girl })),
            this.choice('Boy', '👦', s.kid === 'boy', () => this.update({ kid: 'boy', ...KID_DEFAULTS.boy })),
          ]),
          this.swatches(SKIN_TONES, s.skin, (i) => this.update({ skin: i }))
        );
        break;
      case 'hair':
        this.body.append(
          this.row(HAIR_STYLES.map((h) => this.choice(h.name, null, s.hair === h.id, () => this.update({ hair: h.id })))),
          this.swatches(HAIR_COLORS, s.hairColor, (i) => this.update({ hairColor: i }))
        );
        break;
      case 'clothes':
        this.body.append(
          this.row(OUTFITS.map((o) => this.choice(o.name, o.emoji, s.outfit === o.id, () => this.update({ outfit: o.id })))),
          this.swatches(CLOTHES_COLORS, s.clothes, (i) => this.update({ clothes: i }))
        );
        break;
      case 'hat':
        this.body.append(this.row(HATS.map((h) => this.choice(h.name, h.emoji, s.hat === h.id, () => this.update({ hat: h.id })))));
        break;
    }
  }

  row(children) {
    const d = document.createElement('div');
    d.className = 'choices';
    d.append(...children);
    return d;
  }

  choice(label, emoji, on, onClick, iconHtml) {
    const b = document.createElement('button');
    b.className = 'choice' + (on ? ' on' : '');
    b.innerHTML = (iconHtml || (emoji ? `<span class="em">${emoji}</span>` : '')) + label;
    b.addEventListener('click', onClick);
    return b;
  }

  swatches(colors, selected, onPick) {
    return this.row(
      colors.map((c, i) => {
        const b = document.createElement('button');
        b.className = 'swatch' + (i === selected ? ' on' : '');
        b.style.background = c;
        b.addEventListener('click', () => onPick(i));
        return b;
      })
    );
  }
}
