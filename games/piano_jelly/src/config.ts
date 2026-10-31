/**
 * Every tunable knob for the scene lives here. Angles are in degrees,
 * distances in meters, time in seconds.
 */
export const config = {
  render: {
    exposure: 0.42,
    maxPixelRatio: 2,
    bloom: { strength: 0.22, radius: 0.4, threshold: 3.5 },
    fov: 58,
  },

  sun: {
    /** Degrees above the horizon. Lower = more golden. */
    elevation: 13,
    /** Degrees clockwise from the camera's starting forward direction. */
    azimuth: 46,
    color: [1.0, 0.86, 0.68] as [number, number, number],
    intensity: 3.2,
  },

  sky: {
    turbidity: 2.4,
    rayleigh: 2.3,
    mieCoefficient: 0.0022,
    mieDirectionalG: 0.88,
  },

  clouds: {
    coverage: 0.5,
    brightness: 1.35,
    speed: 0.0035,
  },

  fog: {
    /** Exponential fog density applied to land masses. */
    density: 0.00017,
  },

  ocean: {
    gravity: 9.81,
    /**
     * Gerstner swell components. `steepness` is 0..1 (sharpness of crests);
     * keep the total modest for calm water.
     */
    waves: [
      { direction: 12, wavelength: 42, amplitude: 0.3, steepness: 0.35 },
      { direction: -18, wavelength: 23, amplitude: 0.16, steepness: 0.4 },
      { direction: 40, wavelength: 13.5, amplitude: 0.085, steepness: 0.45 },
      { direction: -55, wavelength: 7.6, amplitude: 0.045, steepness: 0.5 },
      { direction: 75, wavelength: 4.3, amplitude: 0.022, steepness: 0.5 },
      { direction: -5, wavelength: 2.7, amplitude: 0.012, steepness: 0.5 },
    ],
    deepColor: [0.004, 0.075, 0.16] as [number, number, number],
    scatterColor: [0.02, 0.55, 0.5] as [number, number, number],
    detailStrength: 0.55,
    meshRadius: 8000,
  },

  ripples: {
    /** Texels per side of the simulation grid. */
    resolution: 512,
    /** World-space width of the simulated square, centered on the camera. */
    size: 136,
    /** Surface wave propagation speed (m/s). */
    waveSpeed: 2.3,
    damping: 0.9965,
    foamDecay: 0.988,
  },

  camera: {
    height: 3.4,
    pitch: -6,
    /** How much the camera rides the swell (0 = locked, 1 = fully floating). */
    float: 0.55,
  },

  player: {
    /** Health in half-hearts. */
    maxHealth: 6,
    acceleration: 7,
    maxSpeed: 10,
    /** Degrees per second. */
    turnRate: 95,
    invulnerableTime: 1.2,
  },

  sword: {
    reach: 4.2,
    /** Half-angle of the slash cone, degrees. */
    arc: 70,
    spinRadius: 7,
    spinChargeTime: 0.75,
    /** Rocks within this distance in front of you can be parried. */
    parryReach: 4.5,
  },

  enemies: {
    octorokHealth: 2,
    bossHealth: 14,
    /** Every Nth wave is a boss wave. */
    bossEvery: 4,
    rockSpeed: 22,
    rockDamage: 1,
  },

  throw: {
    minDistance: 5,
    maxDistance: 62,
    chargeTime: 1.5,
    launchAngle: 34,
    maxBalls: 24,
  },

  ball: {
    radius: 0.28,
    /** kg/m^3 — water is 1000, a beach ball is very light. */
    density: 220,
  },
};

export type Config = typeof config;
