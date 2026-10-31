import { Engine } from './engine/Engine';
import { Environment } from './world/Environment';
import { Ocean } from './world/ocean/Ocean';
import { Islands } from './world/Islands';
import { BuoyancyWorld } from './physics/BuoyancyWorld';
import { Particles } from './fx/Particles';
import { Ambience } from './audio/Ambience';
import { Sfx } from './audio/Sfx';
import { Player } from './game/Player';
import { Sword } from './game/Sword';
import { BallToss } from './game/BallToss';
import { Hud } from './game/Hud';
import { Arena } from './game/combat/Arena';

const engine = new Engine(document.getElementById('app')!);
const { scene, renderer, camera, input } = engine;
scene.add(camera);

// World
const env = engine.add(new Environment(scene, renderer, camera));
env.capture([], true);
const islands = engine.add(new Islands());
scene.add(islands.group);

const ocean = engine.add(new Ocean(renderer, camera, env));
scene.add(ocean.mesh);
env.capture([ocean.mesh]);

// Simulation & effects
const physics = engine.add(new BuoyancyWorld(ocean));
const particles = engine.add(new Particles(ocean, env));
scene.add(particles.points);
const ambience = new Ambience();
const sfx = new Sfx(ambience);
input.onFirstGesture(() => ambience.start());

// Game
const player = engine.add(new Player(camera, input, ocean, islands));
const sword = engine.add(new Sword(camera, input, player));
const toss = engine.add(new BallToss(scene, camera, player, input, ocean, physics, particles, ambience));
const hud = new Hud();
const arena = engine.add(new Arena({ engine, ocean, islands, particles, ambience, sfx, player, sword, toss, hud }));

engine.start();

if (import.meta.env.DEV) {
  Object.assign(window, { kai: { engine, env, ocean, physics, particles, player, sword, toss, arena } });
}
if (import.meta.hot) import.meta.hot.dispose(() => engine.dispose());
