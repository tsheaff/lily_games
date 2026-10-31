// Everything the sailor can wear. Colors are stored as palette indices, so saved looks stay small.

export const SKIN_TONES = ['#ffe5d4', '#f8d0b0', '#eab88e', '#d49a6a', '#b37a4c', '#8d5a36', '#6b4026', '#4a2c1a'];
export const EYE_COLORS = ['#6b3e1e', '#3a2312', '#8a6a2e', '#4f8a3c', '#3f7fd0', '#7d8a99', '#8b5cd6'];
// The first six match the original game so old saved looks keep their hair color.
export const HAIR_COLORS = ['#6b4226', '#24190f', '#f3cf6a', '#d2652c', '#ff8ac4', '#7ab8ff', '#3d2314', '#fff0b8', '#a8322a', '#b47cff', '#6ee0b8', 'rainbow'];
export const CLOTH_COLORS = [
  '#ff5fa2', '#ffb3d1', '#e63946', '#ff8a3d', '#ffd23f', '#5cd88a', '#2fb39a',
  '#4fb8ff', '#2b4a9b', '#b47cff', '#7b3fbf', '#ffffff', '#2a2a33', '#c49a6c',
];
export const LIP_COLORS = ['#d8324a', '#ff5fa2', '#ff7b6b', '#9c2a55', '#8b4fc9', '#ff9ccf'];
export const BLUSH_COLORS = ['#ff7fa8', '#ffad8a', '#ff7a6a', '#e86a9a'];
export const SHADOW_COLORS = ['#ff8ac4', '#b47cff', '#5aa8ff', '#f2c14e', '#5cd88a', '#c9c9d6'];
export const NAIL_COLORS = ['#ff5fa2', '#e63946', '#b47cff', '#4fb8ff', '#f2c14e', '#5cd88a', '#ffffff'];
export const METALS = [
  { id: 'gold', name: 'Gold', color: '#f2c14e' },
  { id: 'silver', name: 'Silver', color: '#dfe3ea' },
  { id: 'rose', name: 'Rose Gold', color: '#eea48c' },
];

export const PATTERNS = [
  { id: 'solid', name: 'Plain' },
  { id: 'stripes', name: 'Stripes' },
  { id: 'dots', name: 'Polka Dots' },
  { id: 'hearts', name: 'Hearts' },
  { id: 'stars', name: 'Stars' },
  { id: 'flowers', name: 'Flowers' },
  { id: 'gingham', name: 'Gingham' },
  { id: 'plaid', name: 'Plaid' },
  { id: 'rainbow', name: 'Rainbow' },
  { id: 'leopard', name: 'Leopard' },
  { id: 'sparkle', name: 'Sparkly' },
  { id: 'denim', name: 'Denim' },
];
export const SOCK_PATTERNS = ['solid', 'stripes', 'dots', 'hearts', 'stars', 'rainbow', 'sparkle'];
export const SHOE_PATTERNS = ['solid', 'sparkle', 'dots', 'stripes', 'hearts', 'stars', 'leopard', 'rainbow'];

export const HAIR_STYLES = [
  { id: 'short', name: 'Short' },
  { id: 'spiky', name: 'Spiky' },
  { id: 'curly', name: 'Curly' },
  { id: 'bob', name: 'Bob' },
  { id: 'long', name: 'Long' },
  { id: 'bangs', name: 'Bangs' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'pigtails', name: 'Pigtails' },
  { id: 'braids', name: 'Braids' },
  { id: 'bun', name: 'Bun' },
  { id: 'spacebuns', name: 'Space Buns' },
];

export const TOPS = [
  { id: 'tee', name: 'T-Shirt', emoji: '👕' },
  { id: 'tank', name: 'Tank Top', emoji: '🎽' },
  { id: 'long', name: 'Long Sleeve', emoji: '👚' },
  { id: 'hoodie', name: 'Hoodie', emoji: '🧥' },
  { id: 'sweater', name: 'Sweater', emoji: '🧶' },
  { id: 'sailor', name: 'Sailor Top', emoji: '⚓' },
  { id: 'ruffle', name: 'Ruffles', emoji: '🌸' },
];
export const BOTTOMS = [
  { id: 'shorts', name: 'Shorts', emoji: '🩳' },
  { id: 'pants', name: 'Pants', emoji: '👖' },
  { id: 'leggings', name: 'Leggings', emoji: '🧘' },
  { id: 'skirt', name: 'Skirt', emoji: '💃' },
  { id: 'tutu', name: 'Tutu', emoji: '🩰' },
  { id: 'overalls', name: 'Overalls', emoji: '🧑‍🌾' },
];
export const DRESSES = [
  { id: 'none', name: 'No Dress', emoji: '🚫' },
  { id: 'sundress', name: 'Sundress', emoji: '☀️' },
  { id: 'party', name: 'Party Dress', emoji: '🎉' },
  { id: 'gown', name: 'Ball Gown', emoji: '👑' },
  { id: 'mermaid', name: 'Mermaid', emoji: '🧜‍♀️' },
];
export const SOCKS = [
  { id: 'none', name: 'No Socks', emoji: '🚫' },
  { id: 'ankle', name: 'Ankle', emoji: '🧦' },
  { id: 'crew', name: 'Crew', emoji: '🧦' },
  { id: 'knee', name: 'Knee High', emoji: '🧦' },
  { id: 'tights', name: 'Tights', emoji: '🩰' },
];
export const SHOES = [
  { id: 'barefoot', name: 'Barefoot', emoji: '🦶' },
  { id: 'sneakers', name: 'Sneakers', emoji: '👟' },
  { id: 'lightups', name: 'Light-Ups', emoji: '💡' },
  { id: 'sandals', name: 'Sandals', emoji: '👡' },
  { id: 'flats', name: 'Ballet Flats', emoji: '🥿' },
  { id: 'maryjanes', name: 'Mary Janes', emoji: '👞' },
  { id: 'heels', name: 'High Heels', emoji: '👠' },
  { id: 'rainboots', name: 'Rain Boots', emoji: '☔' },
  { id: 'cowboy', name: 'Cowgirl Boots', emoji: '🤠' },
  { id: 'fuzzy', name: 'Fuzzy Boots', emoji: '☁️' },
];

export const NECKLACES = [
  { id: 'none', name: 'None', emoji: '🚫' },
  { id: 'pearls', name: 'Pearls', emoji: '🦪' },
  { id: 'heart', name: 'Heart Locket', emoji: '💖' },
  { id: 'beads', name: 'Rainbow Beads', emoji: '📿' },
  { id: 'diamond', name: 'Diamond', emoji: '💎' },
  { id: 'starfish', name: 'Starfish', emoji: '⭐' },
];
export const EARRINGS = [
  { id: 'none', name: 'None', emoji: '🚫' },
  { id: 'studs', name: 'Sparkle Studs', emoji: '✨' },
  { id: 'hoops', name: 'Hoops', emoji: '⭕' },
  { id: 'pearls', name: 'Pearl Drops', emoji: '⚪' },
  { id: 'hearts', name: 'Hearts', emoji: '💗' },
  { id: 'stars', name: 'Stars', emoji: '🌟' },
];
export const BRACELETS = [
  { id: 'none', name: 'None', emoji: '🚫' },
  { id: 'bangles', name: 'Bangles', emoji: '💫' },
  { id: 'beads', name: 'Beads', emoji: '🌈' },
  { id: 'charms', name: 'Charms', emoji: '💝' },
  { id: 'watch', name: 'Watch', emoji: '⌚' },
];
export const HATS = [
  { id: 'none', name: 'No Hat', emoji: '🙂' },
  { id: 'captain', name: 'Captain', emoji: '⚓' },
  { id: 'pirate', name: 'Pirate', emoji: '🏴‍☠️' },
  { id: 'sunhat', name: 'Sun Hat', emoji: '👒' },
  { id: 'cap', name: 'Cap', emoji: '🧢' },
  { id: 'beanie', name: 'Beanie', emoji: '🧶' },
  { id: 'crown', name: 'Crown', emoji: '👑' },
  { id: 'tiara', name: 'Tiara', emoji: '💎' },
  { id: 'flowers', name: 'Flower Crown', emoji: '🌼' },
  { id: 'headband', name: 'Headband', emoji: '〰️' },
  { id: 'bow', name: 'Bow', emoji: '🎀' },
  { id: 'ears', name: 'Kitty Ears', emoji: '🐱' },
];
export const GLASSES = [
  { id: 'none', name: 'None', emoji: '🚫' },
  { id: 'sunglasses', name: 'Sunglasses', emoji: '🕶️' },
  { id: 'hearts', name: 'Hearts', emoji: '😍' },
  { id: 'stars', name: 'Stars', emoji: '🤩' },
  { id: 'round', name: 'Round', emoji: '👓' },
];
export const LASHES = [
  { id: 'natural', name: 'Natural', emoji: '👁️' },
  { id: 'long', name: 'Long', emoji: '✨' },
  { id: 'glam', name: 'Super Glam', emoji: '🦋' },
];
export const FACE_PAINT = [
  { id: 'none', name: 'None', emoji: '🚫' },
  { id: 'heart', name: 'Heart', emoji: '❤️' },
  { id: 'star', name: 'Star', emoji: '⭐' },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈' },
  { id: 'butterfly', name: 'Butterfly', emoji: '🦋' },
  { id: 'flower', name: 'Flower', emoji: '🌸' },
  { id: 'freckles', name: 'Freckles', emoji: '🟤' },
];

const C = (hex) => CLOTH_COLORS.indexOf(hex);

export const KID_DEFAULTS = {
  girl: {
    hair: 'pigtails',
    lashes: 'long',
    top: { type: 'tee', color: C('#ffffff'), pattern: 'solid' },
    bottom: { type: 'skirt', color: C('#ff5fa2'), pattern: 'solid' },
    dress: { type: 'party', color: C('#ff5fa2'), pattern: 'solid' },
    socks: { type: 'ankle', color: C('#ffffff'), pattern: 'solid' },
    shoes: { type: 'maryjanes', color: C('#e63946'), pattern: 'solid' },
  },
  boy: {
    hair: 'short',
    lashes: 'natural',
    top: { type: 'tee', color: C('#4fb8ff'), pattern: 'solid' },
    bottom: { type: 'shorts', color: C('#2b4a9b'), pattern: 'solid' },
    dress: { type: 'none', color: C('#ff5fa2'), pattern: 'solid' },
    socks: { type: 'crew', color: C('#ffffff'), pattern: 'solid' },
    shoes: { type: 'sneakers', color: C('#e63946'), pattern: 'solid' },
  },
};

export const DEFAULT_SAILOR = {
  kid: 'girl',
  skin: 1,
  eyes: 0,
  hair: 'pigtails',
  hairColor: 0,
  lips: -1,
  blush: -1,
  shadow: -1,
  nails: -1,
  lashes: 'long',
  paint: 'none',
  ...KID_DEFAULTS.girl,
  necklace: 'none',
  earrings: 'none',
  bracelet: 'none',
  metal: 0,
  hat: 'none',
  hatColor: 0,
  glasses: 'none',
};

const ids = (list) => list.map((o) => o.id);
const PICK_LISTS = {
  hair: ids(HAIR_STYLES),
  lashes: ids(LASHES),
  paint: ids(FACE_PAINT),
  necklace: ids(NECKLACES),
  earrings: ids(EARRINGS),
  bracelet: ids(BRACELETS),
  hat: ids(HATS),
  glasses: ids(GLASSES),
};
const INDEX_LISTS = { skin: SKIN_TONES, eyes: EYE_COLORS, hairColor: HAIR_COLORS, metal: METALS, hatColor: CLOTH_COLORS };
const OPTIONAL_INDEX = { lips: LIP_COLORS, blush: BLUSH_COLORS, shadow: SHADOW_COLORS, nails: NAIL_COLORS };
export const GARMENTS = {
  top: { types: ids(TOPS), patterns: ids(PATTERNS) },
  bottom: { types: ids(BOTTOMS), patterns: ids(PATTERNS) },
  dress: { types: ids(DRESSES), patterns: ids(PATTERNS) },
  socks: { types: ids(SOCKS), patterns: SOCK_PATTERNS },
  shoes: { types: ids(SHOES), patterns: SHOE_PATTERNS },
};

// The first version of the game had one `outfit` plus a 6-color `clothes` palette.
const OLD_CLOTHES = ['#ff5fa2', '#4fb8ff', '#ffd23f', '#5cd88a', '#b47cff', '#ff8a3d'].map(C);

function migrate(s) {
  if (!s.outfit) return s;
  const color = OLD_CLOTHES[s.clothes] ?? 0;
  const out = { ...s };
  if (s.outfit === 'dress') out.dress = { type: 'party', color, pattern: 'solid' };
  else {
    out.dress = { type: 'none', color, pattern: 'solid' };
    out.top = { type: 'tee', color: s.outfit === 'overalls' ? C('#ffffff') : color, pattern: s.outfit === 'stripes' ? 'stripes' : 'solid' };
    out.bottom = s.outfit === 'overalls' ? { type: 'overalls', color, pattern: 'denim' } : { type: 'shorts', color: C('#2b4a9b'), pattern: 'solid' };
  }
  out.hatColor = color;
  delete out.outfit;
  delete out.clothes;
  return out;
}

/** Fill in anything missing or out of range so a saved look from any version can be worn. */
export function normalizeSailor(saved = {}) {
  const s = migrate(saved);
  const out = { ...DEFAULT_SAILOR, kid: s.kid === 'boy' ? 'boy' : 'girl' };
  for (const [key, list] of Object.entries(PICK_LISTS)) if (list.includes(s[key])) out[key] = s[key];
  for (const [key, list] of Object.entries(INDEX_LISTS)) if (Number.isInteger(s[key]) && s[key] >= 0 && s[key] < list.length) out[key] = s[key];
  for (const [key, list] of Object.entries(OPTIONAL_INDEX)) if (Number.isInteger(s[key]) && s[key] >= -1 && s[key] < list.length) out[key] = s[key];
  for (const [key, g] of Object.entries(GARMENTS)) {
    const v = s[key] || {};
    const d = DEFAULT_SAILOR[key];
    out[key] = {
      type: g.types.includes(v.type) ? v.type : d.type,
      color: Number.isInteger(v.color) && v.color >= 0 && v.color < CLOTH_COLORS.length ? v.color : d.color,
      pattern: g.patterns.includes(v.pattern) ? v.pattern : d.pattern,
    };
  }
  return out;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const maybe = (p, yes, no) => (Math.random() < p ? yes() : no);
const randIndex = (list) => Math.floor(Math.random() * list.length);
const garment = (types, patterns, plainOdds = 0.55) => ({
  type: pick(types),
  color: randIndex(CLOTH_COLORS),
  pattern: Math.random() < plainOdds ? 'solid' : pick(patterns),
});

/** A surprise outfit. Keeps who you are (kid, skin, eyes), changes everything you wear. */
export function randomSailor(base) {
  const P = ids(PATTERNS);
  return normalizeSailor({
    ...base,
    hair: pick(PICK_LISTS.hair),
    hairColor: maybe(0.75, () => randIndex(HAIR_COLORS.slice(0, 9)), randIndex(HAIR_COLORS)),
    lips: maybe(0.5, () => randIndex(LIP_COLORS), -1),
    blush: maybe(0.5, () => randIndex(BLUSH_COLORS), -1),
    shadow: maybe(0.4, () => randIndex(SHADOW_COLORS), -1),
    nails: maybe(0.5, () => randIndex(NAIL_COLORS), -1),
    lashes: pick(PICK_LISTS.lashes),
    paint: maybe(0.3, () => pick(PICK_LISTS.paint), 'none'),
    top: garment(ids(TOPS), P),
    bottom: garment(ids(BOTTOMS), P),
    dress: maybe(0.4, () => garment(ids(DRESSES).slice(1), P), { ...base.dress, type: 'none' }),
    socks: maybe(0.7, () => garment(ids(SOCKS).slice(1), SOCK_PATTERNS, 0.4), { ...base.socks, type: 'none' }),
    shoes: garment(ids(SHOES).slice(1), SHOE_PATTERNS, 0.6),
    necklace: maybe(0.5, () => pick(PICK_LISTS.necklace), 'none'),
    earrings: maybe(0.5, () => pick(PICK_LISTS.earrings), 'none'),
    bracelet: maybe(0.4, () => pick(PICK_LISTS.bracelet), 'none'),
    metal: randIndex(METALS),
    hat: maybe(0.6, () => pick(PICK_LISTS.hat), 'none'),
    hatColor: randIndex(CLOTH_COLORS),
    glasses: maybe(0.25, () => pick(PICK_LISTS.glasses), 'none'),
  });
}
