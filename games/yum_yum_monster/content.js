// Everything the monster can eat and say. Shared by the game and scripts/generate-monster-voice.mjs,
// which records every line in LINES to voice/<key>.<index>.mp3.

export const COLORS = {
  red: '#ff4d5e',
  orange: '#ff9330',
  yellow: '#ffd21f',
  green: '#4cc94c',
  blue: '#3f7dff',
  purple: '#9b5cf0',
  brown: '#a86b3c',
  white: '#ffffff',
};

export const SHAPES = {
  round: 'round',
  long: 'long',
  triangle: 'shaped like a triangle',
};

export const KINDS = {
  fruit: { a: 'a fruit', word: 'fruit', plural: 'fruits', icon: '🧺' },
  vegetable: { a: 'a vegetable', word: 'vegetable', plural: 'vegetables', icon: '🌱' },
  treat: { a: 'a sweet treat', word: 'treat', plural: 'sweet treats', icon: '🍬' },
};

// color / shape / kind are null when the emoji doesn't clearly have one.
export const FOODS = [
  { e: '🍎', id: 'apple', color: 'red', shape: 'round', kind: 'fruit', riddles: ['crunchy', 'tree'] },
  { e: '🍏', id: 'greenapple', color: 'green', shape: 'round', kind: 'fruit', riddles: ['crunchy', 'tree'] },
  { e: '🍓', id: 'strawberry', color: 'red', shape: null, kind: 'fruit', riddles: ['seedsoutside'] },
  { e: '🍒', id: 'cherries', color: 'red', shape: 'round', kind: 'fruit', riddles: ['pair'] },
  { e: '🍅', id: 'tomato', color: 'red', shape: 'round', kind: null, riddles: ['ketchup'] },
  { e: '🍌', id: 'banana', color: 'yellow', shape: 'long', kind: 'fruit', riddles: ['monkey', 'peel'] },
  { e: '🍋', id: 'lemon', color: 'yellow', shape: null, kind: 'fruit', riddles: ['sour'] },
  { e: '🍍', id: 'pineapple', color: 'yellow', shape: null, kind: 'fruit', riddles: ['spiky', 'hawaii'] },
  { e: '🌽', id: 'corn', color: 'yellow', shape: 'long', kind: 'vegetable', riddles: ['cob'] },
  { e: '🧀', id: 'cheese', color: 'yellow', shape: 'triangle', kind: null, riddles: ['mouse', 'holes'] },
  { e: '🥦', id: 'broccoli', color: 'green', shape: null, kind: 'vegetable', riddles: ['tinytree'] },
  { e: '🥒', id: 'cucumber', color: 'green', shape: 'long', kind: 'vegetable', riddles: ['crunchy'] },
  { e: '🍐', id: 'pear', color: 'green', shape: null, kind: 'fruit', riddles: ['tree'] },
  { e: '🥑', id: 'avocado', color: 'green', shape: null, kind: null, riddles: ['bigseed'] },
  { e: '🍇', id: 'grapes', color: 'purple', shape: null, kind: 'fruit', riddles: ['bunch'] },
  { e: '🍆', id: 'eggplant', color: 'purple', shape: 'long', kind: 'vegetable', riddles: [] },
  { e: '🥕', id: 'carrot', color: 'orange', shape: 'long', kind: 'vegetable', riddles: ['bunny', 'ground', 'crunchy'] },
  { e: '🍊', id: 'orange', color: 'orange', shape: 'round', kind: 'fruit', riddles: ['peel', 'juice'] },
  { e: '🍑', id: 'peach', color: 'orange', shape: 'round', kind: 'fruit', riddles: ['fuzzy', 'bigseed'] },
  { e: '🫐', id: 'blueberries', color: 'blue', shape: 'round', kind: 'fruit', riddles: ['pancakes'] },
  { e: '🥔', id: 'potato', color: 'brown', shape: null, kind: 'vegetable', riddles: ['ground', 'fries'] },
  { e: '🥥', id: 'coconut', color: 'brown', shape: 'round', kind: 'fruit', riddles: ['palmtree', 'hawaii'] },
  { e: '🍪', id: 'cookie', color: 'brown', shape: 'round', kind: 'treat', riddles: ['dunk'] },
  { e: '🍞', id: 'bread', color: 'brown', shape: null, kind: null, riddles: ['sandwich'] },
  { e: '🍦', id: 'icecream', color: 'white', shape: null, kind: 'treat', riddles: ['cold'] },
  { e: '🥚', id: 'egg', color: 'white', shape: null, kind: null, riddles: ['chicken'] },
  { e: '🥛', id: 'milk', color: 'white', shape: null, kind: null, riddles: ['cow'] },
  { e: '🍩', id: 'donut', color: null, shape: 'round', kind: 'treat', riddles: ['hole'] },
  { e: '🧁', id: 'cupcake', color: null, shape: null, kind: 'treat', riddles: ['birthday'] },
  { e: '🍿', id: 'popcorn', color: null, shape: null, kind: 'treat', riddles: ['pop'] },
  { e: '🍉', id: 'watermelon', color: null, shape: 'triangle', kind: 'fruit', riddles: ['redinside'] },
  { e: '🍕', id: 'pizza', color: null, shape: 'triangle', kind: null, riddles: ['cheesy'] },
  { e: '🥨', id: 'pretzel', color: 'brown', shape: null, kind: null, riddles: ['twisty'] },
];

// Riddle clues: an icon for the thought bubble plus two ways to say it.
// `also` lists foods that could arguably fit, so they are never offered as the wrong answer.
export const RIDDLE_ALSO = {
  tree: ['peach', 'orange', 'cherries', 'lemon', 'coconut', 'avocado'],
  peel: ['lemon', 'avocado', 'egg', 'potato', 'cucumber', 'pineapple'],
  holes: ['donut', 'pretzel'],
  hole: ['pretzel', 'cheese'],
  cold: ['milk'],
  bigseed: ['cherries', 'coconut'],
  pop: ['corn'],
  hawaii: ['banana'],
  sandwich: ['cheese', 'egg', 'tomato'],
  cheesy: ['cheese'],
  dunk: ['donut', 'bread'],
  pancakes: ['banana', 'strawberry'],
  juice: ['apple', 'greenapple', 'lemon', 'pineapple', 'grapes', 'tomato'],
  birthday: ['icecream', 'donut', 'cookie'],
  bunch: ['banana', 'cherries'],
  fuzzy: ['coconut'],
  sour: ['greenapple'],
  crunchy: ['pretzel', 'cookie', 'popcorn', 'pear', 'corn', 'potato', 'broccoli'],
  seedsoutside: ['cherries'],
};

export const RIDDLES = {
  monkey: { icon: '🐒', say: ['Ooh ooh, ah ah! Monkeys love this one!', 'What do monkeys love to eat?'] },
  bunny: { icon: '🐰', say: ['Hop hop! Bunnies love to munch this!', 'What does a bunny like to eat?'] },
  mouse: { icon: '🐭', say: ['Squeak squeak! Mice love this!', 'What do little mice like to nibble?'] },
  cow: { icon: '🐄', say: ['Moooo! A cow makes this!', 'Cows make this yummy drink!'] },
  chicken: { icon: '🐔', say: ['Cluck cluck! A chicken makes this!', 'It comes from a chicken!'] },
  tinytree: { icon: '🌳', say: ['It looks like a tiny little tree!', 'Something that looks like a little green tree!'] },
  tree: { icon: '🌳', say: ['It grows on a tree!', 'You can pick it from a tree!'] },
  palmtree: { icon: '🌴', say: ['It falls from a palm tree!', 'It grows way up high on a palm tree!'] },
  hawaii: { icon: '🌺', say: ["It grows in Hawaii, just like you!", 'Aloha! Something from Hawaii!'] },
  hole: { icon: '⭕', say: ['It has a hole in the middle!', 'Round, with a hole in the middle!'] },
  holes: { icon: '🕳️', say: ['It has lots of little holes!', 'Something with holes in it!'] },
  peel: { icon: '✋', say: ['You have to peel it first!', 'Something you peel!'] },
  sour: { icon: '😖', say: ["It's super sour! It makes me pucker!", 'Something sour!'] },
  cold: { icon: '❄️', say: ['Brrr! Something cold and sweet!', "It's cold, and it melts!"] },
  pop: { icon: '💥', say: ['Pop! Pop! Pop! It goes pop!', 'Something you eat at the movies!'] },
  ground: { icon: '🪱', say: ['It grows under the ground!', 'You dig it out of the dirt!'] },
  spiky: { icon: '👑', say: ["It's spiky, with a crown on top!", 'Something spiky on the outside!'] },
  bigseed: { icon: '🌰', say: ['It has a big seed in the middle!', 'Something with a big pit inside!'] },
  bunch: { icon: '🌿', say: ['It comes in a bunch!', 'Lots of little ones on a stem!'] },
  pair: { icon: '👯', say: ['They come in twos, holding hands!', 'Two little ones on a stem!'] },
  redinside: { icon: '🔴', say: ["It's green outside and red inside!", 'Something with lots of black seeds!'] },
  sandwich: { icon: '🥪', say: ['You make sandwiches with it!', 'Toast is made from this!'] },
  birthday: { icon: '🎈', say: ['You eat it at a birthday party!', 'It has frosting on top!'] },
  crunchy: { icon: '🦷', say: ['Something crunchy! Crunch crunch!', 'I want something that goes crunch!'] },
  fuzzy: { icon: '🧸', say: ["It's soft and fuzzy!", 'Something fuzzy, like a teddy bear!'] },
  cheesy: { icon: '🧀', say: ["It's cheesy, and comes in slices!", 'Something cheesy and hot!'] },
  cob: { icon: '🌾', say: ['It grows on a cob!', 'Lots of little yellow kernels!'] },
  pancakes: { icon: '🥞', say: ['Tiny ones that go in pancakes!', 'Something tiny for my pancakes!'] },
  seedsoutside: { icon: '❤️', say: ['It has little seeds on the outside!', "It's shaped like a heart!"] },
  ketchup: { icon: '🍟', say: ['Ketchup is made from this!', 'It goes in spaghetti sauce!'] },
  juice: { icon: '🧃', say: ['You can squeeze it into juice!', 'Squeeze it, and you get juice!'] },
  fries: { icon: '🍟', say: ['French fries are made from this!', 'You can mash it up!'] },
  dunk: { icon: '🥛', say: ['You dunk it in milk!', 'Dip it in milk! Yum!'] },
  twisty: { icon: '🌀', say: ["It's all twisty and salty!", 'Something twisted into a knot!'] },
};

// The prize he gets each level, drawn on him from then on.
export const PRIZES = [
  { e: '🎀', key: 'prize.bow' },
  { e: '👑', key: 'prize.crown' },
  { e: '🌺', key: 'prize.flower' },
  { e: '🦋', key: 'prize.butterfly' },
  { e: '🎈', key: 'prize.balloon' },
  { e: '⭐', key: 'prize.star' },
];

const an = (w) => (/^[aeiou]/.test(w) ? `an ${w}` : `a ${w}`);
const capFirst = (s) => s[0].toUpperCase() + s.slice(1);

export function colorShapeCombos() {
  const out = [];
  for (const c of Object.keys(COLORS)) {
    for (const s of Object.keys(SHAPES)) {
      if (FOODS.some((f) => f.color === c && f.shape === s)) out.push([c, s]);
    }
  }
  return out;
}

export function colorKindCombos() {
  const out = [];
  for (const c of Object.keys(COLORS)) {
    for (const k of Object.keys(KINDS)) {
      if (FOODS.some((f) => f.color === c && f.kind === k)) out.push([c, k]);
    }
  }
  return out;
}

function buildLines() {
  const L = {};
  for (const c of Object.keys(COLORS)) {
    L[`ask.color.${c}`] = [
      `I want something ${c}!`,
      `Something ${c}, please!`,
      `Ooh, I'm hungry for something ${c}!`,
      `Can I have something ${c}?`,
      `My tummy wants something ${c}!`,
      `Feed me something ${c}, please!`,
    ];
    L[`two.color.${c}`] = [`I'm extra hungry! Two ${c} things, please!`, `Can I have two ${c} things?`];
  }
  for (const [s, words] of Object.entries(SHAPES)) {
    L[`ask.shape.${s}`] = [
      `I want something ${words}!`,
      `Something ${words}, please!`,
      `Ooh, something ${words}!`,
      `Can I have something ${words}?`,
      `I'm hungry for something ${words}!`,
    ];
    L[`two.shape.${s}`] = [`I'm extra hungry! Two things that are ${words}!`, `Can I have two things that are ${words}?`];
  }
  for (const [k, kind] of Object.entries(KINDS)) {
    L[`ask.kind.${k}`] = [
      `I want ${kind.a}!`,
      `Can I have ${kind.a}, please?`,
      `Ooh, I'm in the mood for ${kind.a}!`,
      `My tummy says... ${kind.a}!`,
      `${capFirst(kind.a)}! I want ${kind.a}!`,
    ];
    L[`two.kind.${k}`] = [`I'm extra hungry! Two ${kind.plural}, please!`, `Can I have two ${kind.plural}?`];
  }
  for (const [c, s] of colorShapeCombos()) {
    const w = SHAPES[s];
    L[`ask.cs.${c}.${s}`] = [
      `Something ${c}, and ${w}!`,
      `I want something ${c} and ${w}, please!`,
      `Ooh! Something ${c}... and ${w}!`,
    ];
  }
  for (const [c, k] of colorKindCombos()) {
    const w = `${c} ${KINDS[k].word}`;
    L[`ask.ck.${c}.${k}`] = [`I want ${an(w)}!`, `Can I have ${an(w)}?`, `Ooh, ${an(w)}, please!`];
  }
  for (const [id, r] of Object.entries(RIDDLES)) L[`riddle.${id}`] = r.say;

  L['onemore'] = ['One more, please!', 'Yum! And one more!', 'Another one!', "I'm still hungry! One more!", 'Ooh, one more like that!', 'And now the other one!'];
  L['yum'] = [
    'Yum!', 'Mmm, yummy yummy!', 'Delicious!', "That's exactly what I wanted!", "You're a great monster feeder!",
    'Nom nom nom!', 'Oh, that hit the spot!', 'My tummy says thank you!', 'Wow, so tasty!', 'That was scrumptious!',
    'Mmm, my favorite!', 'Yay! You got it!', 'Hooray! Yummy in my tummy!', 'Ooh, that tickled my taste buds!', 'Crunchy munchy!',
    "You're so smart!", 'Again! Again!', 'That was perfect!', 'My rainbow tail is wagging!', 'Woo hoo! Delicious!',
    'Lip smacking good!', 'Mmm-mm! So good!', 'Yummy yummy yummy!', 'You know just what I like!', "Ahh, that's the one!",
    'Best snack ever!', 'Thank you, friend!', 'Super duper yummy!', 'Oh wow, that was tasty!', 'Chomp chomp! Yum!',
    'Delightful!', 'That made me so happy!', 'I love it!', 'Tasty tasty!', 'Mmm, so good!',
    'Fantastic!', 'You did it!', 'Yes! Yum!', 'Perfect!', 'Oh boy, oh boy, yummy!',
  ];
  L['no'] = [
    'Hmm, not that one!', 'No thank you!', 'Oops! Try again!', 'Not quite!', "Hmm, that's not it!",
    'Nope! Try another one!', "Silly! That's not what I want!", 'Ooh, close! Try again!', 'Uh-uh! Not that one!', 'Hee hee, nope!',
    'Hmm... something else!', 'No, no, no!', "That's not it, try again!", 'Not that one, silly goose!', "Hmm, I don't think so!",
    'Maybe a different one?', 'Nuh-uh!', 'Try again, you can do it!', 'Hmm, not that one today!', 'Oopsie! Not that one!',
    "That's not what my tummy wants!", 'Nope, nope!', 'Almost! Try another!', "Hmm, let's try a different one!", 'Not that one, but thank you!',
  ];
  L['tickle'] = [
    '[giggles] That tickles!', 'Hee hee hee!', '[laughs] Stop, stop! That tickles!', 'Ha ha ha! Tickle tickle!', "Ooh, I'm so ticklish!",
    '[giggles] Not my tummy!', 'Hee hee! Again!', 'Ha ha! You found my tickle spot!', 'Tee hee!', '[laughs] Okay, okay!',
    'Wheee! [giggles]', '[laughs] Ha ha ha ha!', "That's so silly!", 'Ooh, giggle giggle!', 'Tickly, tickly!',
  ];
  L['tail'] = [
    'Wheee! My rainbow tail!', 'Wiggle wiggle wiggle!', 'Do you like my rainbow tail?', 'Wag wag wag!', 'Boing, boing!',
    'Ooh, my tail is so wiggly!', 'My tail is doing a happy dance!', 'Swish swish!', "Hee hee, that's my tail!", 'Look at my tail go!',
  ];
  L['burp'] = [
    'Oh! Excuse me!', 'Oopsie! Excuse me! [giggles]', 'Pardon me! [laughs]', 'Whoa! That was a big one!', 'Excuse me! My tummy is so full!',
    'Oh my! Pardon me!', 'Hee hee, excuse me!', 'Oops! That was a rainbow burp!',
  ];
  L['present'] = [
    'My tummy is full! Look, a present! Tap it!', 'Yay! A present for me? Tap it, tap it!', 'Ooh, a surprise present! Can you open it?',
    'Look! A present! Tap it to open it!', 'A present! I wonder what is inside? Tap it!', 'Wow, a present! Will you open it for me?',
  ];
  L['prize.bow'] = ['A bow! I love my pretty new bow!', 'Ooh, a rainbow bow! How do I look?'];
  L['prize.crown'] = ["A crown! I'm the king of the monsters!", 'Ooh, a shiny crown! I feel so fancy!'];
  L['prize.flower'] = ['A flower! It smells so pretty!', 'Ooh, a hibiscus flower, just like Hawaii!'];
  L['prize.butterfly'] = ['A butterfly friend! Hello, little butterfly!', 'Look! A butterfly wants to play with me!'];
  L['prize.balloon'] = ['A balloon! Wheee, I might float away!', 'Ooh, a balloon! My favorite!'];
  L['prize.star'] = ['A magic star! Twinkle twinkle!', "A sparkly star! I'm a superstar!"];
  L['prize.more'] = ['Wow, another present! You are the best!', 'More sparkles! I feel so happy!', 'Another prize! Thank you, thank you!'];
  L['level.2'] = ['Now I have new clues! Listen carefully!', 'Ooh, now it gets trickier! Ready?'];
  L['level.3'] = ['Now I want two things at once! Listen close!', "Level three! It's getting tricky!"];
  L['level.4'] = ["Now I'll tell you riddles! Can you guess?", 'Riddle time! Are you ready?'];
  L['level.5'] = ['Wow, you are so good at this! Here come the hardest clues!', 'Super monster level! Here we go!'];
  L['wake'] = [
    '[yawns] Good morning! I am so hungry!', "Hi! I'm the Yum Yum Monster! Will you feed me?", '[yawns] Is it snack time?',
    'Hello, friend! My tummy is rumbling!', "Oh! Hi there! I'm super duper hungry!", '[yawns] Mmm, I dreamed about snacks!',
  ];
  L['hint'] = [
    'Psst! Look at the wiggly one!', 'Hmm, maybe the sparkly one?', 'I see it! Do you see it?', 'Look for the wiggly one!',
    "Hint! It's wiggling!", 'Ooh, that one is wiggling! Hee hee!',
  ];
  L['waiting'] = [
    'My tummy is rumbling!', "I'm sooo hungry!", 'Grumble, grumble goes my tummy!', "Hurry, hurry! I'm hungry!", 'Feed me, please!',
    'Hmm, which one could it be?', "I'm waiting... yum yum!", 'Take your time, friend!',
  ];
  return L;
}

export const LINES = buildLines();
