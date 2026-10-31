import {
  SKIN_TONES, EYE_COLORS, HAIR_COLORS, CLOTH_COLORS, LIP_COLORS, BLUSH_COLORS, SHADOW_COLORS, NAIL_COLORS, METALS,
  PATTERNS, SOCK_PATTERNS, SHOE_PATTERNS, HAIR_STYLES, TOPS, BOTTOMS, DRESSES, SOCKS, SHOES,
  NECKLACES, EARRINGS, BRACELETS, HATS, GLASSES, LASHES, FACE_PAINT, KID_DEFAULTS, normalizeSailor, randomSailor,
} from './wardrobe.js';
import { patternSwatch } from './textures.js';
import { BOATS, BOAT_BY_ID, sailRowColors } from './boat.js';

const STORAGE_KEY = 'rainbowOcean.look';

export function loadLook() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.sailor && BOAT_BY_ID[saved.boat]) return { sailor: normalizeSailor(saved.sailor), boat: saved.boat, saved: true };
  } catch {}
  return { sailor: normalizeSailor(), boat: BOATS[0].id, saved: false };
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

/** Each tab also tells the dressing-room camera what to zoom in on. */
export const TABS = [
  { id: 'me', icon: '🧒', label: 'Me', focus: 'full' },
  { id: 'hair', icon: '💇', label: 'Hair', focus: 'face' },
  { id: 'makeup', icon: '💄', label: 'Makeup', focus: 'face' },
  { id: 'tops', icon: '👕', label: 'Tops', focus: 'upper' },
  { id: 'bottoms', icon: '👖', label: 'Bottoms', focus: 'lower' },
  { id: 'dresses', icon: '👗', label: 'Dresses', focus: 'full' },
  { id: 'socks', icon: '🧦', label: 'Socks', focus: 'feet' },
  { id: 'shoes', icon: '👠', label: 'Shoes', focus: 'feet' },
  { id: 'jewelry', icon: '💍', label: 'Jewelry', focus: 'upper' },
  { id: 'hats', icon: '👒', label: 'Hats', focus: 'face' },
];
const COLORED_HATS = ['cap', 'beanie', 'sunhat', 'headband', 'bow', 'ears'];
const TWIRLY = ['skirt', 'tutu', 'sundress', 'party', 'gown', 'mermaid'];
const byId = (list) => Object.fromEntries(list.map((o) => [o.id, o]));
const PATTERN_NAMES = Object.fromEntries(PATTERNS.map((p) => [p.id, p.name]));

/**
 * Two steps: dress up your sailor in the Captain's Closet, then pick a boat.
 * Every tap previews live via `onChange(look, reaction)`; `onDone` fires on "Let's Sail!".
 */
export class Picker {
  constructor({ onChange, onStep, onTab, onDone }) {
    this.root = document.getElementById('picker');
    this.panel = this.root.querySelector('.panel');
    this.title = document.getElementById('picker-title');
    this.tabs = document.getElementById('picker-tabs');
    this.body = document.getElementById('picker-body');
    this.back = document.getElementById('picker-back');
    this.random = document.getElementById('picker-random');
    this.next = document.getElementById('picker-next');
    Object.assign(this, { onChange, onStep, onTab, onDone });
    this.tab = 'me';
    this.back.addEventListener('click', () => this.go('sailor'));
    this.random.addEventListener('click', () => {
      this.look.sailor = randomSailor(this.look.sailor);
      this.onChange(this.look, 'surprise');
      this.render();
    });
    this.next.addEventListener('click', () => {
      if (this.step === 'sailor') this.go('boat');
      else this.close();
    });
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  open(look) {
    this.look = { sailor: normalizeSailor(look.sailor), boat: look.boat };
    this.root.classList.remove('hidden');
    this.setTab('me');
    this.go('sailor');
  }

  close() {
    saveLook(this.look);
    this.root.classList.add('hidden');
    this.onDone(this.look);
  }

  go(step) {
    this.step = step;
    this.root.dataset.step = step;
    this.title.textContent = step === 'sailor' ? "👗 Captain's Closet" : '⛵ Pick your boat!';
    this.back.classList.toggle('hidden', step === 'sailor');
    this.random.classList.toggle('hidden', step !== 'sailor');
    this.next.textContent = step === 'sailor' ? 'Next: Boat ➜' : "⛵ Let's Sail!";
    this.onStep(step);
    this.render(true);
  }

  setTab(id) {
    this.tab = id;
    this.onTab(TABS.find((t) => t.id === id).focus);
  }

  update(patch, reaction = 'hop') {
    Object.assign(this.look.sailor, patch);
    this.onChange(this.look, reaction);
    this.render();
  }

  /** Change one garment. Picking a top or bottom takes off a dress, and the other way round. */
  wear(slot, patch) {
    const s = this.look.sailor;
    const next = { [slot]: { ...s[slot], ...patch } };
    if ((slot === 'top' || slot === 'bottom') && s.dress.type !== 'none') next.dress = { ...s.dress, type: 'none' };
    const type = next[slot].type;
    this.update(next, patch.type && TWIRLY.includes(type) ? 'twirl' : 'hop');
  }

  render(resetScroll = false) {
    const scroll = resetScroll ? 0 : this.body.scrollTop;
    this.tabs.innerHTML = '';
    this.body.innerHTML = '';
    if (this.step === 'boat') {
      this.body.append(
        this.row(
          BOATS.map((b) =>
            this.choice(b.name, null, this.look.boat === b.id, () => {
              this.look.boat = b.id;
              this.onChange(this.look, 'boat');
              this.render();
            }, boatIcon(b))
          )
        )
      );
      return;
    }

    for (const t of TABS) {
      const b = document.createElement('button');
      b.className = 'tab' + (this.tab === t.id ? ' on' : '');
      b.innerHTML = `<span class="ti">${t.icon}</span><span class="tl">${t.label}</span>`;
      b.addEventListener('click', () => {
        this.setTab(t.id);
        this.render(true);
      });
      this.tabs.append(b);
    }

    const s = this.look.sailor;
    const sections = this[`tab_${this.tab}`](s);
    this.body.append(...sections);
    this.body.scrollTop = scroll;
  }

  // ---------- tabs ----------
  tab_me(s) {
    return [
      this.section('Who is sailing?', this.row([
        this.choice('Girl', '👧', s.kid === 'girl', () => this.update({ kid: 'girl', ...KID_DEFAULTS.girl }, 'wave')),
        this.choice('Boy', '👦', s.kid === 'boy', () => this.update({ kid: 'boy', ...KID_DEFAULTS.boy }, 'wave')),
      ])),
      this.section('Skin', this.swatches(SKIN_TONES, s.skin, (i) => this.update({ skin: i }))),
      this.section('Eyes', this.swatches(EYE_COLORS, s.eyes, (i) => this.update({ eyes: i }))),
    ];
  }

  tab_hair(s) {
    return [
      this.section('Hairstyle', this.options(HAIR_STYLES, s.hair, (id) => this.update({ hair: id }))),
      this.section('Hair Color', this.swatches(HAIR_COLORS, s.hairColor, (i) => this.update({ hairColor: i }))),
    ];
  }

  tab_makeup(s) {
    return [
      this.section('Lipstick', this.swatches(LIP_COLORS, s.lips, (i) => this.update({ lips: i }), { none: true, last: 'glitter' })),
      this.section('Blush', this.swatches(BLUSH_COLORS, s.blush, (i) => this.update({ blush: i }), { none: true })),
      this.section('Eye Shadow', this.swatches(SHADOW_COLORS, s.shadow, (i) => this.update({ shadow: i }), { none: true, shimmer: true })),
      this.section('Eyelashes', this.options(LASHES, s.lashes, (id) => this.update({ lashes: id }))),
      this.section('Face Paint', this.options(FACE_PAINT, s.paint, (id) => this.update({ paint: id }))),
      this.section('Nail Polish', this.swatches(NAIL_COLORS, s.nails, (i) => this.update({ nails: i }), { none: true })),
    ];
  }

  garmentTab(slot, title, types, patterns, s, note) {
    const g = s[slot];
    const out = [];
    if (note) out.push(note);
    out.push(this.section(title, this.options(types, g.type, (id) => this.wear(slot, { type: id }))));
    const visible = !['none', 'barefoot'].includes(g.type);
    if (visible) {
      out.push(this.section('Color', this.swatches(CLOTH_COLORS, g.color, (i) => this.wear(slot, { color: i }))));
      out.push(this.section('Pattern', this.patterns(patterns, g.pattern, CLOTH_COLORS[g.color], (id) => this.wear(slot, { pattern: id }))));
    }
    return out;
  }

  dressNote(s) {
    if (s.dress.type === 'none') return null;
    const d = document.createElement('div');
    d.className = 'note';
    d.textContent = `You're wearing a ${byId(DRESSES)[s.dress.type].name}. Pick one here to switch!`;
    return d;
  }

  tab_tops(s) {
    return this.garmentTab('top', 'Tops', TOPS, PATTERNS.map((p) => p.id), s, this.dressNote(s));
  }

  tab_bottoms(s) {
    return this.garmentTab('bottom', 'Shorts, Pants & Skirts', BOTTOMS, PATTERNS.map((p) => p.id), s, this.dressNote(s));
  }

  tab_dresses(s) {
    return this.garmentTab('dress', 'Dresses', DRESSES, PATTERNS.map((p) => p.id), s);
  }

  tab_socks(s) {
    return this.garmentTab('socks', 'Socks', SOCKS, SOCK_PATTERNS, s);
  }

  tab_shoes(s) {
    return this.garmentTab('shoes', 'Shoes', SHOES, SHOE_PATTERNS, s);
  }

  tab_jewelry(s) {
    return [
      this.section('Metal', this.swatches(METALS.map((m) => m.color), s.metal, (i) => this.update({ metal: i }), { shimmer: true })),
      this.section('Necklace', this.options(NECKLACES, s.necklace, (id) => this.update({ necklace: id }))),
      this.section('Earrings', this.options(EARRINGS, s.earrings, (id) => this.update({ earrings: id }))),
      this.section('Bracelet', this.options(BRACELETS, s.bracelet, (id) => this.update({ bracelet: id }))),
    ];
  }

  tab_hats(s) {
    const out = [this.section('Hats', this.options(HATS, s.hat, (id) => this.update({ hat: id })))];
    if (COLORED_HATS.includes(s.hat)) out.push(this.section('Hat Color', this.swatches(CLOTH_COLORS, s.hatColor, (i) => this.update({ hatColor: i }))));
    out.push(this.section('Glasses', this.options(GLASSES, s.glasses, (id) => this.update({ glasses: id }))));
    return out;
  }

  // ---------- widgets ----------
  section(label, content) {
    const d = document.createElement('div');
    d.className = 'section';
    const h = document.createElement('div');
    h.className = 'label';
    h.textContent = label;
    d.append(h, content);
    return d;
  }

  row(children) {
    const d = document.createElement('div');
    d.className = 'choices';
    d.append(...children);
    return d;
  }

  options(list, selected, onPick) {
    return this.row(list.map((o) => this.choice(o.name, o.emoji, o.id === selected, () => onPick(o.id))));
  }

  choice(label, emoji, on, onClick, iconHtml) {
    const b = document.createElement('button');
    b.className = 'choice' + (on ? ' on' : '');
    b.innerHTML = (iconHtml || (emoji ? `<span class="em">${emoji}</span>` : '')) + `<span>${label}</span>`;
    b.addEventListener('click', onClick);
    return b;
  }

  swatches(colors, selected, onPick, { none = false, last, shimmer = false } = {}) {
    const items = colors.map((c, i) => {
      const b = this.swatch(i === selected, () => onPick(i));
      if (c === 'rainbow') b.classList.add('rainbow');
      else b.style.background = c;
      if (shimmer || (last && i === colors.length - 1)) b.classList.add('shimmer');
      return b;
    });
    if (none) {
      const b = this.swatch(selected < 0, () => onPick(-1));
      b.classList.add('none');
      b.title = 'None';
      items.unshift(b);
    }
    return this.row(items);
  }

  patterns(ids, selected, color, onPick) {
    return this.row(
      ids.map((id) => {
        const b = this.swatch(id === selected, () => onPick(id));
        b.classList.add('pattern');
        b.style.backgroundImage = `url(${patternSwatch(id, color)})`;
        b.title = PATTERN_NAMES[id];
        if (id === 'sparkle') b.classList.add('shimmer');
        return b;
      })
    );
  }

  swatch(on, onClick) {
    const b = document.createElement('button');
    b.className = 'swatch' + (on ? ' on' : '');
    b.addEventListener('click', onClick);
    return b;
  }
}
