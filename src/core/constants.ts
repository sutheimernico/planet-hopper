// src/core/constants.ts
// Every gameplay tunable lives here. Units: world units (wu), seconds, wu/s.

// Simulation
export const DT = 1 / 120 // fixed timestep (s)
export const MAX_STEPS_PER_FRAME = 8 // spiral-of-death guard

// Gravity
export const GRAVITY = 280
export const K_NEAREST = 3

// Planets / orbit
export const ORBIT_FACTOR = 1.8 // orbit radius = planet.radius * this
export const ORBIT_SPEED = 1.2 // rad/s
export const CAPTURE_FACTOR = 2.2 // capture radius = planet.radius * this
export const FLYBY_FACTOR = 4.5 // flyby band outer = planet.radius * this

// Launch / fuel
export const POWER_MIN = 18 // wu/s at power01 = 0
export const POWER_MAX = 55 // wu/s at power01 = 1
export const FUEL_MAX = 100
export const LAUNCH_COST_BASE = 8
export const LAUNCH_COST_SCALE = 22 // cost = BASE + power01 * SCALE
export const CRYSTAL_REFILL = 18

// Pickup / hazards
export const CRYSTAL_PICKUP_RADIUS = 3.5
export const VOID_DISTANCE = 130 // distance to nearest planet that starts the void countdown
export const VOID_GRACE = 2.5 // s of countdown before the run ends
export const STRANDED_GRACE = 1.5 // s after orbiting without launch fuel

// Trajectory preview
export const PREVIEW_SECONDS = 3
export const PREVIEW_SAMPLE_EVERY = 4 // keep every 4th point for rendering

// World generation
export const SPACING_MIN = 55
export const SPACING_MAX = 110
export const RAMP_DISTANCE = 2000 // x-distance over which difficulty reaches max
export const CORRIDOR_HALF_WIDTH = 40
export const PLANET_RADIUS_MIN = 3
export const PLANET_RADIUS_MAX = 7
export const PLANET_MASS_FACTOR = 1 // mass = radius^2 * this
export const SUN_RADIUS = 6
export const SUN_MASS = 80
export const SUN_PROBABILITY_MAX = 0.35
export const GENTLE_PLANETS = 10 // hand-tuned easy start
export const GENTLE_SPACING_SCALE = 0.7
export const CRYSTALS_PER_GAP_START = 3
export const CRYSTALS_PER_GAP_END = 1
export const GENERATE_AHEAD = 400 // wu generated ahead of the ship
export const PRUNE_BEHIND = 200 // wu kept behind the ship

// Scoring
export const DIST_POINTS_PER_WU = 1
export const CRYSTAL_POINTS = 250
export const FLYBY_POINTS = 400
export const MULT_STEP = 0.5
export const MULT_MAX = 5
export const MULT_DECAY_SECONDS = 8
