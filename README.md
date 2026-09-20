# Owen & Alice's Adventure

A kids' educational auto-running platformer for phones and tablets (landscape,
ages 4 to 9). One control: tap to jump, hold to jump higher. Built with
TypeScript, Vite and Phaser 4. No ads, no tracking, no network calls.

See `CLAUDE.md` for the full design brief, tuning numbers, level format and
working rules.

## Run

```bash
npm install
npm run dev        # http://localhost:5173, open on a phone via the LAN address Vite prints
```

## Build

```bash
npm run build      # type-checks, then writes a static site to dist/
npm run preview    # serves dist/ locally
```

## Test and lint

```bash
npm test           # Vitest: game rules, level data and the headless completability proof (~30 s)
npm run lint       # ESLint + TypeScript
npm run check      # lint, test and build in one go; run this before pushing
```

The game rules in `src/game` have no Phaser dependency, so all tests run
headlessly in Node.

## Deploy

The site is static. `netlify.toml` is included:

- build command: `npm run build`
- publish directory: `dist`

Connect the repository to Netlify (or any static host) and deploy `dist/`.

## Project layout

- `src/game/` — headless rules: config, tracks, heroes, level loading, star layout, simulation, scoring
- `src/data/levels/` — level JSON files
- `src/phaser/` — scenes, placeholder views, UI, input
- `src/audio/` — Web Audio sound synth
- `tests/` — Vitest suites
