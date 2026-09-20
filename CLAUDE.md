# Owen & Alice's Adventure — project memory

This file is the single source of truth for a future session. It records the
brief, the cast, the tech rules, every tuning number, the level format, the
decisions made along the way, and the working rules. Read it fully before
changing anything.

## The game

A kids' educational 2D side-scrolling platformer for phones and tablets,
landscape only, ages 4 to 9. The hero runs automatically from left to right.
The only control is one touch: tap to jump, hold for a higher jump. Learning
(math for now) is part of how you play and the game NEVER pauses for a quiz:
questions are answered by jumping into bubbles while running (see "Learning
system"). Nothing pressures a child: no lives, no timers, no ads, no loot
boxes.

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
  the web. No accounts. The only storage is `localStorage`, device-local and
  never sent anywhere: the player profiles (`src/game/profiles`, behind the
  `KeyValueStore` interface so the backing store can be swapped) and the
  device-wide sound and read-aloud choices (`src/phaser/session.ts`).
- Sound effects are synthesised with the Web Audio API (`src/audio/Sfx.ts`);
  no audio files yet.
- Text to speech: `speak(text)` in `src/phaser/speech.ts` reads each new
  question aloud with the browser's `speechSynthesis` when it exists (younger
  players cannot read yet). Symbols are spoken as words (`speechText()`).
  The HUD speech-bubble button turns it off; the choice is remembered.

## Architecture

```
src/
  main.ts                 Phaser boot, scale, portrait handling
  game/                   headless rules (no Phaser)
    config.ts             ALL tuning numbers live here
    tracks.ts             age tracks (run speed, gravity, jump, pit and cloud rules)
    heroes.ts             Owen and Alice definitions
    viewport.ts           logical view size, ground screen y, camera scroll
    scoring.ts            result stars and the "For grown-ups" line
    levels.ts             imports level JSON files
    level/types.ts        level JSON format and parsed Level types
    level/loadLevel.ts    validation, tip lookup
    level/stars.ts        deterministic star layout from geometry
    level/geometry.ts     ground / gap / platform queries
    learning/questions.ts pure question generator (tracks, levels, choices, clues)
    profiles/types.ts     Profile, Progress, LearningEntry, PlayEntry, RunRecord
    profiles/store.ts     ProfileStore over a KeyValueStore (+ MemoryStore, parseProfilesData)
    profiles/summary.ts   last-7-days summary per profile and the suggested next skill
    profiles/gate.ts      the grown-ups gate question (6 to 9 times tables)
    sim/heroSim.ts        fixed-step simulation: stepSim(world, state, input, dt) -> events
    sim/learning.ts       the question stretch state machine, stepped by heroSim
    sim/events.ts         event union the renderer and audio react to
  data/levels/w1l1.json   World 1 Level 1 "Sunny Meadows 1"
  audio/Sfx.ts            Web Audio synth
  phaser/
    scenes/TitleScene.ts  who is playing (tap to switch), hero pick, Play, Grown-ups
    scenes/PlayersScene.ts up to 4 players on this device, New player
    scenes/NewPlayerScene.ts name (on-screen letters), age band, hero
    scenes/GrownUpsScene.ts number-pad gate, then summary / settings per player
    scenes/GameScene.ts   reads input, steps the sim, mirrors state to views, records to the profile
    scenes/ResultScene.ts three stars, star count, total + best line, grown-ups line, Play again / Change player or hero
    views/*               placeholder art: Parallax, LevelView, StarView, ShardView,
                          CloudView, HeroView, SidekickView, Burst (+ sparkle),
                          BubbleView (answer bubbles), GateView (star gate + crystal)
    ui/*                  Button, Hud, TipStrip, QuestionBanner, KeyPad (letters / digits), Panel, text helpers
    input/JumpInput.ts    touch + mouse + keyboard -> one held flag
    session.ts            device-wide sound / speech choice (localStorage)
    storage.ts            localStorage adapter for the profile store, getProfiles()
    sfx.ts                shared Sfx instance and sound toggle
    speech.ts             speak(text) via speechSynthesis, read-aloud toggle
tests/                    Vitest; tests/helpers/solver.ts is the headless level solver,
                          tests/helpers/learning.ts the scripted question player
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

## Learning system (the question stretch)

The game never stops for a question. All numbers live in `QUESTIONS` in
`src/game/config.ts`; the rules run inside the sim (`src/game/sim/learning.ts`)
so they are tested headlessly.

### How it plays

- When the hero reaches `questionStartX` (6990 in World 1 Level 1) the
  question stretch begins on flat ground. Run speed is 85% of the track's from
  there to the end of the level (`runSpeedAt()`).
- A slim one-line banner (`ui/QuestionBanner.ts`, 32 units tall) sits at the
  very top of the screen: three small lock icons and the question text
  (counting questions also show the row of stars). The star and shard counters
  hide while the banner is up; the sound / read-aloud / Menu buttons drop below
  it. On the smallest view (330 tall) the bubbles' tops are 152 units down, so
  even the two-line banner (66 with the clue) never covers them.
- Three answer bubbles (`views/BubbleView.ts`) float ahead in a row at
  y -92 (jump height): the first 3.0 s of running ahead of the hero, then one
  every 1.15 s of running. Exactly one is correct, order shuffled. The hero
  jumps to grab the right one (body centre within 30 units of the bubble) and
  runs under the wrong ones. A tap-height jump (release clamp) cannot reach a
  bubble; any real jump can, with roughly a one-second window.
- Right bubble: a lock opens with a sparkle and a rising chime (`lockOpen`),
  the other bubbles vanish, and 0.7 s later the next question starts.
- Wrong bubble, or running past all three (`questionMissed`): nothing is
  lost. The same question comes round again (same choices, first bubble 2.0 s
  of running ahead) and the banner adds a second slim line: "Jackson has a
  clue." / "Aliceson has a clue." followed by the clue. A soft two-note
  "hmm" plays, never a buzzer.
- After three locks: the banner hides, the star gate (`views/GateView.ts`) is
  placed 430 units ahead of the hero, its bars lift over 0.9 s, the star
  crystal sits 190 units past the gate, and reaching the crystal finishes the
  level (`endX` is ignored on levels with a question stretch).
- The seed for the questions is `SimWorld.seed` (random per run in the
  GameScene, fixed in tests).

### Questions (`src/game/learning/questions.ts`, pure functions)

Three answer choices; the answer appears exactly once; distractors are within
3 of the answer, never below 1, never duplicated; nearer values are more
likely. The displayed text uses the real multiplication sign (U+00D7).

Difficulty level runs 0 to 2 inside each track and starts at 0 each run.
Right on the first try: level +1. Two or more misses on a question: level -1
(`nextLevel(level, misses)`; one miss leaves it unchanged). The new level
applies to the next question.

| Track | Level 0 | Level 1 | Level 2 |
|-------|---------|---------|---------|
| 0 (age 4 to 5) | Counting 3 to 5 stars | Counting 5 to 8 | Counting 8 to 12 |
| 1 (age 6 to 7) | Addition within 10 | Addition within 20 (sum 11 to 20, addends up to 10) | Subtraction within 20 |
| 2 (age 8 to 9) | Multiplication, factors 2 to 5 | Two-step: a × b then subtract what you have | Division: total shared between 2 to 5 locks, 2 to 6 each |

Texts and clues:

- Counting: "Count the stars on the gate. How many are there?" with a row of k
  stars in the banner. Clue: the same stars with small numbers 1..k under them.
- Addition: "The gate needs 8 + 5 stars. How many is that?" Clue: two groups
  of dots.
- Subtraction: "The gate needs 15 stars. You already have 6. How many more do
  you need?" Clue: 15 dots with 6 faded.
- Multiplication: "The gate needs 3 × 4 stars. How many is that?" Clue: groups
  of dots.
- Two-step: "The gate needs 4 × 6 stars. You have 17. How many more do you
  need?" Clue text: "First: 4 × 6 = 24. Now work out 24 - 17."
- Division: "24 stars are shared equally between 4 locks. How many stars does
  each lock get?" Clue text: "Think: 4 × ? = 24".

Skill names (grown-ups line): Counting to 5 / 8 / 12; Adding within 10 /
Adding within 20 / Taking away within 20; Times tables 2 to 5 / Two-step
problems / Sharing equally.

### Result screen

- Third star: "Opened the gate without a clue" (all three locks opened and
  `cluesUsed` is 0).
- "For grown-ups" line (`grownUpsLine()` in `scoring.ts`): skills practised,
  right first time x of y, clues used (the number of times a question came
  round again), retries from a checkpoint (respawns).

## Player profiles and the grown-ups corner

Everything lives on the device (`localStorage` key
`owen-alice-adventure.profiles.v1`, one JSON document) behind
`ProfileStore` in `src/game/profiles/store.ts`, which only talks to a
three-method `KeyValueStore` (`get` / `set` / `remove`) so the backing store
can be swapped later. `src/phaser/storage.ts` provides the localStorage
adapter (memory fallback when storage is blocked) and the one shared store.
Numbers live in `PROFILES` and `PARENT_GATE` in `config.ts`.

### Profiles

- A profile is a nickname (letters only, up to 12, shown as "Miah"), an age
  band (the track) and a favourite hero. Up to 4 per device. Creating one
  makes it the active player; the active player is remembered.
- First launch (no profile) goes straight to the new-player screen: name on
  a big on-screen A to Z keyboard (the device keyboard never pops up; a
  physical keyboard also works), age band, hero, "Let's go!".
- Title screen: "Who is playing?" shows the active player and their band;
  tapping it opens the players list (2 x 2 grid, "New player" while there is
  room). Hero buttons change the profile's favourite hero. The age band is
  NOT on the title screen any more: it is set when a player is created and
  changed only in the grown-ups corner.
- The game scene reads hero and track from the active profile.

### What is saved per profile (`Progress`)

- `levels[levelId]`: best result stars (0 to 3), most stars collected in one
  run, and every shard id ever found on that level.
- `totalStars`: every star collected in every run, added up.
- `questions`: rolling log (last 500) of `{ skill, firstTry, clues, at }`, one
  entry per question answered right, written on the `lockOpen` event (which
  now carries `skill` and `attempt`). `clues` is the number of retries that
  question needed; `firstTry` is `clues === 0`. A question abandoned mid-level
  is not logged.
- `play`: rolling log (last 200) of `{ seconds, at }`. The game scene writes
  the sim time played when the level ends, when Menu is pressed and when the
  page goes to the background (`visibilitychange`).
- `recordRun` is called from `GameScene.finish()` before the result screen,
  so the result screen can show "Miah: 250 stars in total. Best on this
  level: 2 of 3."
- Loading is defensive (`parseProfilesData`): corrupt JSON, a wrong version
  or broken profiles become an empty document or are dropped; broken entries
  inside a profile are skipped; never more than 4 profiles load.

### Grown-ups corner (`GrownUpsScene`)

- Reached by the "Grown-ups" button next to Play. The gate is "What is
  a × b?" with both factors from 6 to 9 (children are only ever asked tables
  2 to 5), typed on a number pad (or a physical keyboard). A wrong answer
  shows "Not quite. Try this one." with a fresh question. The question is
  asked again every time the corner is opened.
- Inside, a tab per player and two sections:
  - **Last 7 days** (`summarise()` in `profiles/summary.ts`): headline
    (questions, % right first time, clues used, minutes played), a table per
    skill (questions, right first time x of y (%), clues), and a suggested
    next skill (`suggestNextSkill()`): nothing practised -> start with the
    band's first skill; no skill has 3 questions yet -> play more of the most
    practised; any skill with 3+ questions under 70% right first time ->
    practise the weakest again; otherwise the step above the highest skill
    going well, or at the top of the ladder "keep going" naming the next age
    band. Skills from another band are ignored when placing the child on the
    ladder.
  - **Settings**: age band (3 buttons), read-aloud voice on / off (device-wide,
    the same toggle as the HUD button), "Reset progress" (keeps name, band
    and hero; asks "Yes, reset / No") and "Remove player" (only while more
    than one player exists; asks first). The privacy note reads: no accounts,
    no network, everything saved only on this device and never leaves it.

## Level format

Levels are JSON data files in `src/data/levels/`, validated by
`loadLevel()`. Stars are generated from the geometry, not listed.

```jsonc
{
  "id": "w1l1", "name": "Sunny Meadows 1", "world": 1, "index": 1,
  "startX": 40, "endX": 7600,
  "questionStartX": 6990,             // optional; omit for a level without questions
  "ground": [[x0, x1], ...],          // anything not covered is a pit
  "platforms": [[x0, x1, y], ...],    // one-way, y negative
  "checkpoints": [x, ...],            // must be on ground
  "shards": [[x, y], ...],            // hidden crystal shards
  "clouds": [[x, y, bobs], ...],      // storm clouds, bobs = true/false
  "tips": [{ "untilX": 640, "text": "..." }]  // "{airTip}" = hero air-ability tip
}
```

`questionStartX` must lie between `startX` and `endX` on one ground segment
that reaches past `endX`, with no platforms or clouds at or after it (the
stretch is flat and safe). Levels with a question stretch end at the star
crystal, not at `endX`, and may run far past it after retries, so keep the
last ground segment very long (Sunny Meadows 1 uses 90000). Levels without
`questionStartX` end at `endX` with a plain finish line.

### World 1 Level 1 "Sunny Meadows 1"

- ground: [-200,900],[960,1700],[1775,2600],[2680,3500],[3580,3700],[3780,4700],[4790,5700],[5780,5900],[5980,6100],[6180,90000]
- platforms: [2000,2150,-70],[2220,2370,-125],[4000,4120,-70],[4180,4300,-125],[4360,4480,-70],[6330,6450,-70],[6500,6620,-125]
- checkpoints: 40, 2500, 3850, 5000, 6250
- shards: [2295,-158],[3740,-92],[6560,-158]
- clouds: [1400,-26,no],[3000,-48,yes],[3290,-48,yes],[4240,-26,no],[5200,-26,no],[5470,-50,yes],[6850,-26,no]
- stars: generated, currently 126 (25 line, 45 gap arc, 35 cloud arc, 21 platform row). Target 120 to 135, asserted by a test.
- question stretch begins at x 6990 on flat ground; the level ends at the star crystal (about x 8600 with no retries on track 0, later with retries).
- tips: before x 640 "Tap anywhere to jump."; to 1150 "Hold longer to jump higher."; to 1650 "Land on a grumpy cloud to pop it."; to 2500 the hero's air-ability tip.

## Screens

- **Title**: game title, "Who is playing?" with the active player's name and
  band (tap to switch), "Choose your hero" (Owen and Jackson / Alice and
  Aliceson), Play, and a smaller "Grown-ups" button. Sentence case
  everywhere, big buttons. Enter also plays.
- **Players**: "Who is playing?", up to four player buttons (name, band, star
  total), Back, New player (or "Up to 4 players fit on one device").
- **New player**: three steps: name on an on-screen keyboard, age band, hero.
- **Grown-ups**: the number-pad gate, then the per-player summary and settings
  (see "Player profiles and the grown-ups corner").
- **Game**: parallax hills and sky, ground, platforms, stars, shards, clouds,
  checkpoint flags (turn orange when reached), hero with run cycle, sidekick
  trail, HUD (star count, shards "0 / 3", sound toggle, read-aloud toggle,
  Menu), tip strip, question banner, answer bubbles, star gate and crystal.
- **Result**: three stars: finished the level / found all 3 shards / opened
  the gate without a clue, stars collected out of the total, the player's
  total and best on this level, the "For grown-ups" line, "Play again",
  "Change player or hero".

## Tests (`npm test`)

- `tests/sim.test.ts`: jump feel, coyote, buffer, dash, float, pits, clouds,
  platforms, pickups, streaks, respawn safety.
- `tests/level.test.ts`: level data, star count and layout, tips, validation.
- `tests/tracks.test.ts`, `tests/scoring.test.ts` (stars, grown-ups line).
- `tests/questions.test.ts`: the generator, 400 seeded samples per track and
  level: answer present exactly once, three unique choices within 3 of the
  answer and never below 1, ranges and texts per level, clue shapes, the
  difficulty rules, determinism per seed, speech text.
- `tests/learning.test.ts`: the question stretch inside the sim on a flat
  test level: 85% speed, bubble timing and height, all answers right (three
  locks, 0.7 s gaps, gate at +430, crystal at +190, third star), one wrong
  grab (retry at 2.0 s, nothing lost, level unchanged), two misses (level
  down), one question missed entirely (retry with a clue), a tap cannot reach
  a bubble. `tests/helpers/learning.ts` is the scripted player: given a list
  of 'right' / 'wrong' / 'miss' it jumps at the chosen bubble.
- `tests/profiles.test.ts`: the store over `MemoryStore`: create / limit of 4
  / active fallback / update / reset / remove, best stars and shards merging,
  star total, rolling logs, write-through and read-back, corrupt and foreign
  data, nickname cleaning.
- `tests/summary.test.ts`: the 7-day window, percentages, per-skill table,
  minutes, and every branch of the suggested next skill.
- `tests/gate.test.ts`: gate factors in range, exact-answer check.
- `tests/completable.test.ts`: headless proof that Sunny Meadows 1 can be
  finished with all 3 shards and no respawn on all three tracks with both
  heroes. `tests/helpers/solver.ts` searches the "hop graph" (from each
  grounded position: run a little, or jump with one of several hold lengths,
  with optional dash for Owen) up to the question stretch and replays the
  found input plan through the real sim; the scripted player then answers
  the questions (one wrong grab on purpose) to the crystal. Takes about 20 s
  in total; that is expected.

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
- Sound and the read-aloud voice are device-wide settings, not per profile
  (a shared tablet has one speaker). Hero and age band are per profile.
- Nicknames are letters only (A to Z on the on-screen keyboard), shown with
  the first letter capitalised, so a 5-year-old can type one without a device
  keyboard covering the landscape view.
- "Remove player" was added alongside "Reset progress" (not in the brief)
  because with a hard limit of 4 there would otherwise be no way to make room
  for a new cousin; the last remaining player can only be reset, not removed.
- The grown-ups gate uses the 6 to 9 tables because track 2 children practise
  factors 2 to 5 in the game itself.
- The learning log records only questions that were answered right (every
  question is eventually answered right or the level is quit), with the
  number of clue retries it took; per-question dates make the 7-day window
  possible.
- Play time is sim time (pauses in portrait do not count) and is saved in
  chunks so closing the app mid-level loses at most the time since the last
  save (level end, Menu, or the page going to the background).
- Levels with a question stretch end at the star crystal; `endX` there only
  marks where the pre-question level would have ended. Levels without
  `questionStartX` keep the plain finish line at `endX`.
- The 4:3 tablet view is 520 x 390; a 20:9 phone is about 733 x 330.
- The same question comes round with the same three choices in the same
  order, so a child can aim for a different bubble rather than re-read.
- A wrong grab replaces the remaining bubbles at once (new set 2.0 s ahead)
  rather than letting the hero pass the old ones first.
- "Clues used" counts every retry (each time the sidekick's clue line
  appears), so three misses on one question count as three.
- The difficulty level starts at 0 every run and is not stored.
- The retry clue line is also read aloud (the sidekick sentence, plus the
  clue text for the text clues); the dot and star clues are visual.

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

### Session 2 (learning system)

Built: the question generator (`game/learning/questions.ts`), the question
stretch inside the sim (`game/sim/learning.ts`, new events), 85% run speed,
the top banner with locks and clues, answer bubbles, star gate and crystal,
lock / wrong / gate sounds, `speak()` with a HUD toggle, the third result
star and the grown-ups line, generator and simulation tests, and the
completability proof extended through the questions. `questionStartX` became
optional so test levels can skip questions. Checked in Chromium at 640 x 300
and 1024 x 768: the banner never reaches the bubbles.

Play-test next: whether the 30-unit grab radius feels generous enough on a
phone; banner text size for the longest track 2 questions on a 520-wide
view (they shrink to fit); the wrong-answer sound; whether "Jackson has a
clue." should be spoken before or after the question; speech voices on iOS
(Safari needs a user gesture before the first utterance, which the Play tap
provides).

Open questions: should the difficulty level carry over between runs; spelling
questions for a later world; whether the crystal should also award a bonus of
stars.

### Session 3 (player profiles and the grown-ups corner)

Built: the profile store (`game/profiles/store.ts`) over a swappable
key-value interface with the localStorage adapter in `phaser/storage.ts`;
up to 4 profiles (nickname, age band, favourite hero) with best stars per
level, shards found, star total, a rolling learning log and a play-time log;
the new-player flow with an on-screen keyboard; the players list; the title
screen now shows who is playing; the grown-ups corner behind a 6-to-9 times
table gate with the 7-day summary, suggested next skill, age band, reset,
remove and voice controls, and the privacy note; the result screen shows the
running total; `lockOpen` events carry the skill and attempt; tests for the
store, summary and gate. Walked through every screen in Chromium at 640 x
300 and 1024 x 768 with a scripted browser session.

Play-test next: whether the on-screen keyboard keys (about 46 units) are big
enough for small fingers; whether children are drawn to the Grown-ups button
and how the gate feels; the summary table on a real 520-wide phone.

Open questions: a level select once more levels exist (best stars per level
are already stored); whether a profile should carry its difficulty level
between runs; a nickname edit in the grown-ups corner.
