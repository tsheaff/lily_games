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
  holes: { icon: '⚪', say: ['It has lots of little holes!', 'Something with holes in it!'] },
  peel: { icon: '✋', say: ['You have to peel it first!', 'Something you peel!'] },
  sour: { icon: '😖', say: ["It's super sour! It makes my face go squish!", 'Something sour!'] },
  cold: { icon: '❄️', say: ['Brrr! Something cold and sweet!', "It's cold, and it melts!"] },
  pop: { icon: '💥', say: ['Pop! Pop! Pop! It goes pop!', 'Something you eat at the movies!'] },
  ground: { icon: '🌱', say: ['It grows under the ground!', 'Farmers dig it up from the garden!'] },
  spiky: { icon: '👑', say: ["It's spiky, with a crown on top!", 'Something spiky on the outside!'] },
  bigseed: { icon: '🌰', say: ['It has a big seed in the middle!', 'Something with a big pit inside!'] },
  bunch: { icon: '🌿', say: ['It comes in a bunch!', 'Lots of little ones on a stem!'] },
  pair: { icon: '👯', say: ['They come in pairs, on one little stem!', 'Two little red ones, side by side!'] },
  redinside: { icon: '🔴', say: ["It's green outside and red inside!", 'Something with lots of black seeds!'] },
  sandwich: { icon: '🥪', say: ['You make sandwiches with it!', 'Toast is made from this!'] },
  birthday: { icon: '🎈', say: ['You eat it at a birthday party!', 'It has frosting on top!'] },
  crunchy: { icon: '😋', say: ['Something crunchy! Crunch crunch!', 'I want something that goes crunch!'] },
  fuzzy: { icon: '🧸', say: ["It's soft and fuzzy!", 'Something fuzzy, like a teddy bear!'] },
  cheesy: { icon: '🧀', say: ["It's cheesy, and comes in slices!", 'Something cheesy and yummy!'] },
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
      `I'd love something ${c}!`,
      `Something ${c}, please!`,
      `Ooh, can you find something ${c}?`,
      `Can I have something ${c}?`,
      `My favorite color today is ${c}! Something ${c}, please!`,
      `I'm thinking of something ${c}!`,
    ];
    L[`two.color.${c}`] = [`I'm extra hungry today! Two ${c} things, please!`, `Can I have two ${c} things?`];
  }
  for (const [s, words] of Object.entries(SHAPES)) {
    L[`ask.shape.${s}`] = [
      `I'd love something ${words}!`,
      `Something ${words}, please!`,
      `Can you find something ${words}?`,
      `Can I have something ${words}?`,
      `I'm thinking of something ${words}!`,
    ];
    L[`two.shape.${s}`] = [`I'm extra hungry today! Two things that are ${words}, please!`, `Can I have two things that are ${words}?`];
  }
  for (const [k, kind] of Object.entries(KINDS)) {
    L[`ask.kind.${k}`] = [
      `I'd love ${kind.a}!`,
      `Can I have ${kind.a}, please?`,
      `Ooh, can you find ${kind.a}?`,
      `I'm thinking of ${kind.a}!`,
      `Hmm, I feel like ${kind.a} today!`,
    ];
    L[`two.kind.${k}`] = [`I'm extra hungry today! Two ${kind.plural}, please!`, `Can I have two ${kind.plural}?`];
  }
  for (const [c, s] of colorShapeCombos()) {
    const w = SHAPES[s];
    L[`ask.cs.${c}.${s}`] = [
      `Something ${c}, and ${w}!`,
      `I'd love something ${c} and ${w}, please!`,
      `Can you find something ${c}, that's also ${w}?`,
    ];
  }
  for (const [c, k] of colorKindCombos()) {
    const w = `${c} ${KINDS[k].word}`;
    L[`ask.ck.${c}.${k}`] = [`I'd love ${an(w)}!`, `Can I have ${an(w)}, please?`, `Can you find ${an(w)}?`];
  }
  for (const [id, r] of Object.entries(RIDDLES)) L[`riddle.${id}`] = r.say;

  L['onemore'] = ['One more, please!', 'Yummy! And one more!', 'Can I have another one?', "I'm still a little hungry! One more, please!", 'Now one more like that!', 'And now the other one!'];
  L['yum'] = [
    'Yum!', 'Yummy yummy!', 'Delicious!', "That's just what I wanted!", "You're a great helper!",
    'Nom nom nom!', 'Thank you so much!', 'Wow, so tasty!', 'That was scrumptious!', 'My favorite!',
    'Yay! You got it!', 'Hooray! Yummy in my tummy!', 'You did it!', 'Crunchy munchy!', "You're so smart!",
    'That was perfect!', 'My rainbow tail is wagging!', 'Woo hoo! Delicious!', 'So good!', 'Yummy yummy yummy!',
    'You know just what I like!', 'Yes! That one!', 'Best snack ever!', 'Thank you, friend!', 'Super duper yummy!',
    'Oh wow, that was tasty!', 'Chomp chomp! Yum!', 'That made me so happy!', 'I love it!', 'Tasty tasty!',
    'Fantastic!', 'Great job!', 'Perfect!', 'Oh boy, yummy!', 'You found it!',
    'High five! That was yummy!', 'Way to go!', 'Hooray!', 'That was so good, thank you!', 'Amazing!',
  ];
  L['no'] = [
    'Hmm, not that one!', 'No thank you!', 'Oops! Try again!', 'Not quite!', "Hmm, that's not it!",
    'Try another one!', 'Ooh, close! Try again!', 'Not that one!', 'Hmm, something else!', "That's not it, try again!",
    "Good try! Let's try another!", 'Maybe a different one?', 'Try again, you can do it!', 'Oopsie! Not that one!', 'Almost! Try another!',
    "Hmm, let's try a different one!", 'Not that one, but thank you!', 'Nice try! Try again!', "That's okay! Try another one!", 'Ooh, not that one!',
    "Hmm, that's not what I'm thinking of!", 'Good guess! Try again!', "Let's try a different one!", 'Not this time! Try again!', 'So close! Try another!',
  ];
  L['tickle'] = [
    'Hee hee! That tickles!', 'Hee hee hee!', 'Ha ha! Tickle tickle!', "Hee hee, I'm so ticklish!", 'Ha ha! That was fun!',
    'Hee hee! You make me laugh!', 'Tee hee!', 'Ha ha ha!', "That's so silly!", 'Hee hee, giggle giggle!',
    'Tickly, tickly!', 'Ha ha! I love to laugh!', 'Hee hee, that was a good tickle!', 'Ha ha, you are so funny!', 'Hee hee! Wiggle wiggle!',
  ];
  L['tail'] = [
    'Wheee! My rainbow tail!', 'Wiggle wiggle wiggle!', 'Do you like my rainbow tail?', 'Wag wag wag!', 'Boing, boing!',
    'My tail is so wiggly!', 'My tail is doing a happy dance!', 'Swish swish!', "Hee hee, that's my tail!", 'Look at my tail go!',
  ];
  L['burp'] = [
    'Oh! Excuse me!', 'Oopsie! Excuse me!', 'Pardon me!', 'Whoa! That was a big one! Excuse me!', 'Excuse me! My tummy is so full!',
    'Oh my! Pardon me!', 'Hee hee, excuse me!', 'Oops! That was a rainbow burp!',
  ];
  L['present'] = [
    'My tummy is full! Look, a present! Tap it!', 'Yay! A present! Tap it to open it!', 'Ooh, a surprise present! Can you open it?',
    'Look! A present! Tap it to see inside!', "A present! I wonder what's inside? Tap it!", 'Wow, a present! Will you open it for me?',
  ];
  L['prize.bow'] = ['A bow! I love my pretty new bow!', 'Ooh, a pretty bow! How do I look?'];
  L['prize.crown'] = ["A crown! I'm a royal rainbow monster!", 'Ooh, a shiny crown! I feel so fancy!'];
  L['prize.flower'] = ['A flower! It smells so pretty!', 'Ooh, a hibiscus flower, just like in Hawaii!'];
  L['prize.butterfly'] = ['A butterfly friend! Hello, little butterfly!', 'Look! A butterfly wants to play with me!'];
  L['prize.balloon'] = ['A balloon! I love balloons!', 'Ooh, a balloon! My favorite!'];
  L['prize.star'] = ['A shiny star! Twinkle twinkle!', "A sparkly star! You're a superstar!"];
  L['prize.more'] = ['Wow, another present! You are the best!', 'More sparkles! I feel so happy!', 'Another prize! Thank you, thank you!'];
  L['level.2'] = ['Now I have new clues! Listen carefully!', "Now it's a little trickier! Ready?"];
  L['level.3'] = ["Now I'll give you two clues at once! Listen carefully!", "Level three! It's getting tricky!"];
  L['level.4'] = ["Now I'll tell you riddles! Can you guess?", 'Riddle time! Are you ready?'];
  L['level.5'] = ['Wow, you are so good at this! Here come the trickiest clues!', 'Super level! Here we go!'];
  L['wake'] = [
    'Good morning! I am so hungry!', "Hi! I'm the Yum Yum Monster! Will you help me find a snack?", 'Is it snack time? Yay!',
    'Hello, friend! My tummy is rumbling!', "Oh! Hi there! I'm super duper hungry!", 'Good morning! I dreamed about snacks!',
  ];
  L['hint'] = [
    'Look at the wiggly one!', 'Hmm, maybe the sparkly one?', 'I see it! Do you see it?', 'Look for the wiggly one!',
    "Here's a hint! It's wiggling!", 'Ooh, that one is wiggling!',
  ];
  L['waiting'] = [
    'My tummy is rumbling!', "I'm so hungry!", 'Hmm, which one could it be?', 'Take your time, friend!', 'You can do it!',
    "Let's look together!", 'Which one do you think?', "I'll wait right here!",
  ];
  return L;
}

export const LINES = buildLines();
