# Owen & Alice's Adventure — project memory

This file is the single source of truth for a future session. It records the
brief, the cast, the tech rules, every tuning number, the level format, the
decisions made along the way, and the working rules. Read it fully before
changing anything.

## The game

A kids' educational 2D side-scrolling platformer for phones and tablets,
landscape only, ages 4 to 9. The hero runs automatically from left to right.
The only control is one touch: tap to jump, hold for a higher jump. Learning
(math and spelling) is part of how you play and the game NEVER pauses for a
quiz (the question stretch arrives in prompt 2). Nothing pressures a child:
no lives, no timers, no ads, no loot boxes.

### Cast

- **Owen (8)**: blue pilot jacket, aviator goggles. Sidekick **Jackson**, a tiny
  living blue race car that behaves like a puppy. Air ability: tap again in
  the air for a short forward dash that also pops enemies.
- **Alice (5)**: pink and purple princess dress, tiara, star wand. Sidekick
  **Aliceson**, a chubby baby unicorn. Air ability: keep holding in the air to
  float down slowly.
- **Villain**: a grumpy, funny raccoon baron (never scary). Not on screen yet.
  His minions are small sulky storm clouds, the common enemy.
- The player picks Owen or Alice freely. The hero not picked is not shown.
- Final art: soft hand-painted storybook style with cut-out puppet animation.
  For now everything is placeholder shapes drawn in code (`src/phaser/views`).
  Views expose a `sync(state)` style API so sprites can replace the drawing
  without touching game logic.

## Tech

- TypeScript, Vite 8, Phaser 4 (latest stable major), Vitest 5, ESLint 10.
- npm scripts: `dev`, `build`, `test`, `lint` (plus `preview`, `test:watch`,
  `check` = lint + test + build).
- Output is a static site in `dist/`. `netlify.toml` builds with
  `npm run build` and publishes `dist`.
- Landscape only. Logical view is at least 520 x 330 units, scaled to fit any
  phone or tablet (Phaser `FIT`); wider or taller screens see more world
  (`src/game/viewport.ts`). Ground line is 64 units above the bottom edge.
  The camera keeps the hero 28% from the left edge. In portrait, an HTML
  overlay says "Turn your device sideways" and the game is paused.
- Touch, mouse and keyboard (Space / Up arrow) all feed one jump input
  (`src/phaser/input/JumpInput.ts`). Presses over UI buttons do not jump.
- Game rules live in `src/game/**` as plain TypeScript with **no Phaser
  imports** (enforced by ESLint) so they run headlessly in Vitest:
  physics constants, tracks, heroes, level data, star generation, the
  simulation, scoring, viewport math.
- No analytics, no network calls, no third-party SDKs, no fonts fetched from
  the web. The only storage is `localStorage` for the child's hero, age and
  sound choice (device-local, never sent anywhere).
- Sound effects are synthesised with the Web Audio API (`src/audio/Sfx.ts`);
  no audio files yet.

## Architecture

```
src/
  main.ts                 Phaser boot, scale, portrait handling
  game/                   headless rules (no Phaser)
    config.ts             ALL tuning numbers live here
    tracks.ts             age tracks (run speed, gravity, jump, pit and cloud rules)
    heroes.ts             Owen and Alice definitions
    viewport.ts           logical view size, ground screen y, camera scroll
    scoring.ts            result stars
    levels.ts             imports level JSON files
    level/types.ts        level JSON format and parsed Level types
    level/loadLevel.ts    validation, tip lookup
    level/stars.ts        deterministic star layout from geometry
    level/geometry.ts     ground / gap / platform queries
    sim/heroSim.ts        fixed-step simulation: stepSim(world, state, input, dt) -> events
    sim/events.ts         event union the renderer and audio react to
  data/levels/w1l1.json   World 1 Level 1 "Sunny Meadows 1"
  audio/Sfx.ts            Web Audio synth
  phaser/
    scenes/TitleScene.ts  hero + age pick, Play
    scenes/GameScene.ts   reads input, steps the sim, mirrors state to views
    scenes/ResultScene.ts three stars, star count, Play again / Change hero or age
    views/*               placeholder art: Parallax, LevelView, StarView, ShardView,
                          CloudView, HeroView, SidekickView, Burst
    ui/*                  Button, Hud, TipStrip, text helpers
    input/JumpInput.ts    touch + mouse + keyboard -> one held flag
    session.ts            hero / track / sound choice (localStorage)
    sfx.ts                shared Sfx instance and sound toggle
tests/                    Vitest; tests/helpers/solver.ts is the headless level solver
```

The GameScene owns no rules. Each frame: `held = input.read()`, then
`stepSim` in fixed 1/120 s steps (max 12 per frame), then views and sounds
react to the returned events. Coordinates: x grows to the right, **y is 0 at
the ground line and negative upward**; the hero's (x, y) is the feet.

## Age tracks (chosen by the player's age, NOT by the hero)

Units are logical units per second.

| Track | Label       | Run speed | Gravity | Jump velocity | Pits                          | Clouds                                 |
|-------|-------------|-----------|---------|---------------|-------------------------------|----------------------------------------|
| 0     | Age 4 to 5  | 125       | 1050    | -470          | bounce back up (y set just above pit floor, vy -720) | cannot hurt; touching pops it and bounces the hero |
| 1     | Age 6 to 7  | 150       | 1350    | -520          | return to last checkpoint     | bump returns to last checkpoint        |
| 2     | Age 8 to 9  | 172       | 1450    | -540          | return to last checkpoint     | bump returns to last checkpoint        |

Nothing collected is ever lost on a respawn.

## Jump feel (already play-tested, keep these)

- Variable height: releasing early clamps upward velocity to -220. The clamp
  applies only to the hero's own jump, never to stomp or pit bounces.
- Coyote time 0.08 s, jump buffer 0.12 s.
- Squash and stretch on takeoff and landing (HeroView.onJump / onLand).
- Owen dash: 0.32 s, 2.3x run speed, vertical velocity held at 0, one per
  jump, hero is safe from clouds and pops them while dashing.
- Alice float: while held and falling, fall speed capped at 70, for at most
  1.3 s per jump.
- Landing on a cloud from above pops it and bounces the hero at -400. Popped
  clouds burst into flowers for Alice and raindrops for Owen.
- Pickup radius 24 units (30 for Owen, as Jackson pulls stars in), measured
  from the hero's body centre (feet y minus 18).
- After a respawn the hero blinks and is safe for 1.2 s.

## Other tuning numbers (all in `src/game/config.ts`)

- Hero body 20 x 36. Sim step 1/120 s, max 12 steps per frame.
- Cloud hitbox 40 x 26; bobbing clouds move up and down by 24 units with a
  2.4 s period; a stomp counts if the feet were within 8 units of the cloud top.
- Pit depth 110 units below the ground line counts as "fell in".
- Star streak: pickups within 1.0 s of each other raise the pitch, max streak 8.
- Sidekick follows where the hero was 0.3 s ago, 34 units behind.
- Star layout: lines at y -30 every 46 units, kept 140 from gap edges, 150
  from clouds and 40 from platforms; gap arcs of 5 at heights
  -52/-84/-96/-84/-52 with 25 overhang; cloud arcs of 5, 32 apart, 22 above
  the cloud's highest point plus 0/16/22/16/0; platform rows of 3, 36 above.

## Level format

Levels are JSON data files in `src/data/levels/`, validated by
`loadLevel()`. Stars are generated from the geometry, not listed.

```jsonc
{
  "id": "w1l1", "name": "Sunny Meadows 1", "world": 1, "index": 1,
  "startX": 40, "endX": 7600, "questionStartX": 6990,
  "ground": [[x0, x1], ...],          // anything not covered is a pit
  "platforms": [[x0, x1, y], ...],    // one-way, y negative
  "checkpoints": [x, ...],            // must be on ground
  "shards": [[x, y], ...],            // hidden crystal shards
  "clouds": [[x, y, bobs], ...],      // storm clouds, bobs = true/false
  "tips": [{ "untilX": 640, "text": "..." }]  // "{airTip}" = hero air-ability tip
}
```

### World 1 Level 1 "Sunny Meadows 1"

- ground: [-200,900],[960,1700],[1775,2600],[2680,3500],[3580,3700],[3780,4700],[4790,5700],[5780,5900],[5980,6100],[6180,90000]
- platforms: [2000,2150,-70],[2220,2370,-125],[4000,4120,-70],[4180,4300,-125],[4360,4480,-70],[6330,6450,-70],[6500,6620,-125]
- checkpoints: 40, 2500, 3850, 5000, 6250
- shards: [2295,-158],[3740,-92],[6560,-158]
- clouds: [1400,-26,no],[3000,-48,yes],[3290,-48,yes],[4240,-26,no],[5200,-26,no],[5470,-50,yes],[6850,-26,no]
- stars: generated, currently 126 (25 line, 45 gap arc, 35 cloud arc, 21 platform row). Target 120 to 135, asserted by a test.
- question stretch begins at x 6990 (prompt 2); flat ground until the level ends at x 7600.
- tips: before x 640 "Tap anywhere to jump."; to 1150 "Hold longer to jump higher."; to 1650 "Land on a grumpy cloud to pop it."; to 2500 the hero's air-ability tip.

## Screens

- **Title**: game title, "Choose your hero" (Owen and Jackson / Alice and
  Aliceson), "How old is the player?" (Age 4 to 5 / Age 6 to 7 / Age 8 to 9),
  Play. Sentence case everywhere, buttons at least 52 units tall. Enter also plays.
- **Game**: parallax hills and sky, ground, platforms, stars, shards, clouds,
  checkpoint flags (turn orange when reached), hero with run cycle, sidekick
  trail, HUD (star count, shards "0 / 3", sound toggle, Menu), tip strip.
- **Result**: three stars: finished the level / found all 3 shards / third
  reserved for prompt 2 ("Coming soon"), stars collected out of the total,
  "Play again", "Change hero or age".

## Tests (`npm test`)

- `tests/sim.test.ts`: jump feel, coyote, buffer, dash, float, pits, clouds,
  platforms, pickups, streaks, respawn safety.
- `tests/level.test.ts`: level data, star count and layout, tips, validation.
- `tests/tracks.test.ts`, `tests/scoring.test.ts`.
- `tests/completable.test.ts`: headless proof that Sunny Meadows 1 can be
  finished with all 3 shards and no respawn on all three tracks with both
  heroes. `tests/helpers/solver.ts` searches the "hop graph" (from each
  grounded position: run a little, or jump with one of several hold lengths,
  with optional dash for Owen) and replays the found input plan through the
  real sim. Takes about 25 s in total; that is expected.

## Decisions made (ambiguities resolved toward "simpler for a 5-year-old")

- Owen's tap in the air always dashes (it does not also buffer a jump); a
  dash clears the jump buffer so landing right after a dash does not jump.
- On tracks 1 and 2 a cloud that bumps the hero stays where it is; the hero
  returns to the checkpoint. Popped clouds stay popped after a respawn.
- Track 0 cloud touch behaves exactly like a stomp (pop + -400 bounce).
- Checkpoints activate as soon as the hero's x passes them, airborne or not.
- Falling 110 units below the ground line is "in the pit"; while in a pit the
  hero cannot run into the pit wall (x is clamped) so track 0 bounces land
  cleanly on the far side.
- Respawn has no camera flash (gentler on young eyes); the hero just blinks
  and the sidekick teleports beside them.
- The hero, age and sound choices are remembered in localStorage only.
- Level end is a plain finish line at x 7600; the third result star is a
  grey placeholder labelled "Coming soon" until prompt 2.
- The 4:3 tablet view is 520 x 390; a 20:9 phone is about 733 x 330.

## Working rules

- Run lint, tests and a production build before you push (`npm run check`).
  Do not push a red build.
- Small, readable modules. Tuning numbers live in `src/game/config.ts`
  (track numbers in `tracks.ts`, hero numbers in `heroes.ts`).
- Never add pressure mechanics, ads, tracking or external network calls.
- When something in a brief is ambiguous, choose the option that is simpler
  for a 5-year-old and note the decision in this file.
- Keep `src/game` free of Phaser and browser globals so it stays testable.
- End each session with a short summary: what was built, what to play-test,
  and any open questions.

## Session log

### Session 1 (scaffold)

Built: docs, scaffold, lint and test setup, title screen, playable Sunny
Meadows 1 with placeholder art, HUD, synthesised sounds, result screen, unit
tests including the headless completability proof.

Play-test next: jump feel on real phones (tap latency, hold-to-float
readability), whether the 4-to-5 pit bounce feels friendly or confusing, star
arc heights over bobbing clouds, HUD sizes on small phones, sound volume.

Open questions: where the raccoon baron first appears; whether the question
stretch (prompt 2) should reuse the tip strip; final art pipeline (sprite
atlases replacing `views/*` drawings).
