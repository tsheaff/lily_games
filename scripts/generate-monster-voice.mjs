// Records every Yum Yum Monster line with ElevenLabs into games/yum_yum_monster/voice/.
// Only lines whose text or voice changed (tracked in voice/manifest.json) are re-recorded.
// Usage: ELEVEN_API_KEY=... node scripts/generate-monster-voice.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { LINES } from '../games/yum_yum_monster/content.js';

const VOICE_ID = process.env.MONSTER_VOICE || 'TX3LPaxmHKxFdv7VOQHJ'; // ElevenLabs premade "Liam": warm, friendly, natural
const MODEL = 'eleven_multilingual_v2';
const SETTINGS = { stability: 0.55, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true };
const key = process.env.ELEVEN_API_KEY || process.env.ELEVEN_LABS_API_KEY;
if (!key) throw new Error('ELEVEN_API_KEY is not set');

const dir = resolve(import.meta.dirname, '../games/yum_yum_monster/voice');
mkdirSync(dir, { recursive: true });
const manifestPath = resolve(dir, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

const jobs = [];
const wanted = new Set();
for (const [k, texts] of Object.entries(LINES)) {
  texts.forEach((text, i) => {
    const file = `${k}.${i}.mp3`;
    wanted.add(file);
    const tag = `${VOICE_ID} ${MODEL} ${text}`;
    if (manifest[file] !== tag || !existsSync(resolve(dir, file))) jobs.push({ file, text, tag });
  });
}

for (const f of readdirSync(dir)) {
  if (f.endsWith('.mp3') && !wanted.has(f)) {
    unlinkSync(resolve(dir, f));
    delete manifest[f];
  }
}

async function record({ file, text, tag }) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
    });
    if (res.ok) {
      writeFileSync(resolve(dir, file), Buffer.from(await res.arrayBuffer()));
      manifest[file] = tag;
      return;
    }
    if (attempt >= 4) throw new Error(`${file}: ${res.status} ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

console.log(`${jobs.length} of ${wanted.size} lines to record`);
let done = 0;
const queue = [...jobs];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (queue.length) {
      await record(queue.shift());
      if (++done % 25 === 0) console.log(`${done}/${jobs.length}`);
    }
  }),
);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n');
console.log('done');
