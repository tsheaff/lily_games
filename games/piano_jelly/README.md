# Kai

A real-time Hawaiian ocean built in code with Three.js: a Gerstner-wave swell, GPU ripple simulation, buoyancy physics and a physically-inspired water shader. No textures, models or audio files; everything is procedural.

```sh
npm install
npm run dev      # http://localhost:5173
```

**Controls:** hold <kbd>Space</kbd> to wind up and release to throw (the ring shows where the ball will land) · drag to look · <kbd>M</kbd> toggles sound.

## Layout

```
src/
  config.ts              every tunable knob: sun, sky, waves, ripples, camera, throw
  engine/
    Engine.ts            renderer, bloom post-processing, fixed 60 Hz step + per-frame update
    Input.ts             polled keyboard/pointer (isDown / wasPressed / wasReleased / drag)
  world/
    Environment.ts       sky, sun, lights, fog matched to the horizon, reflection cubemap
    Clouds.ts            procedural cloud dome
    Islands.ts           procedural volcanic islands, a motu with swaying palms
    ocean/
      Waves.ts           Gerstner waves, shared by the GPU shader and CPU heightAt()
      RippleSim.ts       GPU wave-equation heightfield (ripples + foam)
      Ocean.ts           water mesh + shader; heightAt() and disturb() API
  physics/
    BuoyancyWorld.ts     floating spheres: buoyancy, added mass, drag, collisions
  fx/Splashes.ts         spray particles
  audio/Ambience.ts      procedural surf, splash and whoosh sounds
  game/
    FloatingCamera.ts    camera that rides the swell
    BallToss.ts          the throwing game
  main.ts                wires everything together
```

## Making a new game

Everything is a `System` (`fixedUpdate` for simulation, `update` for per-frame work) registered with `engine.add(...)`. The world layer (`Environment`, `Ocean`, `Islands`) is game-agnostic. To build something new, write a system in `src/game/` and swap it in `main.ts`. Useful hooks:

- `ocean.heightAt(x, z)` gives the water surface height, for placing or floating anything.
- `ocean.disturb({ x, z, radius, strength, foam })` makes ripples and foam anywhere.
- `physics.add(new SphereBody(radius, density))` adds anything that floats.
- `splashes.emit(position, speed, radius)` throws spray.

In dev builds, `window.kai` exposes the engine and systems for poking at from the console.
