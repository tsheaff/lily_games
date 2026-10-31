// Generates the homepage illustrations with google/nano-banana on Replicate.
// Usage: REPLICATE_API_TOKEN=... node scripts/generate-art.mjs [name ...]
import { writeFile, mkdir } from 'node:fs/promises';

const STYLE =
  'Soft pastel watercolor illustration in a gentle, minimal children\'s storybook style. ' +
  'Light, airy and tasteful, delicate paper texture, lots of calm empty space, pale cream, peach, blush pink, ' +
  'mint and baby blue palette, soft edges, no harsh outlines. Absolutely no text, letters or words.';

const ART = {
  hero: {
    aspect_ratio: '21:9',
    prompt:
      'A wide dreamy seascape: a faint double rainbow (one big rainbow with a smaller rainbow beneath it) arching over a calm ' +
      'turquoise ocean, two tiny tropical islands with palm trees on the horizon, a few fluffy clouds, the upper half mostly ' +
      'empty pale sky. ' + STYLE,
  },
  adventure_rainbows: {
    aspect_ratio: '4:3',
    prompt:
      'A tiny cute sailboat with a rainbow-striped sail gliding over gentle waves toward a small round green island with a ' +
      'palm tree and a little glowing treasure chest, a double rainbow in the sky, a few sparkles and a pink heart floating. ' + STYLE,
  },
  piano_jelly: {
    aspect_ratio: '4:3',
    prompt:
      'A colorful beach ball bobbing on sparkling Hawaiian ocean waves, a lush green volcanic island behind, a friendly little ' +
      'octopus peeking out of the water, a small sailboat nearby, soft sunshine. ' + STYLE,
  },
  about: {
    aspect_ratio: '1:1',
    prompt:
      'A small vignette of things a little girl loves: a rainbow, a few floating music notes, gentle ocean waves, pink plumeria ' +
      'and hibiscus flowers, a pair of tiny ballet slippers, arranged loosely with lots of white space. No people. ' + STYLE,
  },
};

const token = process.env.REPLICATE_API_TOKEN;
if (!token) throw new Error('REPLICATE_API_TOKEN is not set');

async function generate(name) {
  const { prompt, aspect_ratio } = ART[name];
  const res = await fetch('https://api.replicate.com/v1/models/google/nano-banana/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({ input: { prompt, aspect_ratio, output_format: 'jpg' } }),
  });
  let pred = await res.json();
  while (pred.status && !['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    await new Promise((r) => setTimeout(r, 2000));
    pred = await (await fetch(pred.urls.get, { headers: { Authorization: `Bearer ${token}` } })).json();
  }
  if (pred.status !== 'succeeded') throw new Error(`${name}: ${pred.status} ${JSON.stringify(pred.error ?? pred)}`);
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  await mkdir('site/images', { recursive: true });
  await writeFile(`site/images/${name}.jpg`, img);
  console.log(`${name}: ${(img.length / 1024).toFixed(0)} KB`);
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ART);
await Promise.all(names.map(generate));
