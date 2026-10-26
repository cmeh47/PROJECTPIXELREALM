# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

Project Pixel Realm (working name): a 4-player co-op 2D pixel RPG for iOS and Android. Players share a base, gather resources, take NPC quests and clear dungeons with reactive turn-based combat. See `README.md` and `docs/decisions.md`.

Milestone 1 is the combat-feel prototype: one battle in `src/combat/`. The player base (`src/base/`) is the app's home screen and starts battles.

## How we work

- Work feature by feature. Check in with Cameron before every major feature or decision, offering three options with a recommendation.
- User experience comes first. Avoid generic "AI slop" visuals: every screen follows `DESIGN.md`.
- Animation quality is a hard requirement. Follow `DESIGN.md` sections 11 and 12 for every action.

## Stack

- Expo + React Native, React Native Skia (game scenes), Reanimated (animation, UI-thread timing), Gesture Handler (inputs)
- Supabase: sign-in, Postgres, Realtime presence and broadcast, server functions for every shared change
- Art: Aseprite. Sources in `art/`, exports in `assets/sprites/`

## Conventions

- Developed on Windows with no Mac. Keep scripts cross-platform. iOS builds go through EAS in the cloud.
- Testing: Expo Go and a web link until push notifications need a development build (milestone 6).
- Every shared change (spending resources, building, boss damage) goes through a Supabase server function, never a direct client write.
- Combat input timing is judged on the UI thread, not in JavaScript.
- Keep secrets out of the repo. Use a git-ignored `.env` and document required variables here.

## Commands

```bash
npm install                    # also copies Skia's canvaskit.wasm into public/ for the web build
npx expo start                 # dev server: scan the QR code with Expo Go, or press w for web
npm run typecheck              # tsc --noEmit
npm run export:web             # static web build in dist/
npx expo install <package>     # add packages (picks SDK-compatible versions)
```

If `npx expo install` fails behind a proxy, prefix it with `EXPO_OFFLINE=1`.

## Code map

- `App.tsx` loads fonts and gesture/safe-area roots. `src/boot/index.web.ts` loads CanvasKit before mounting on web; `src/boot/index.ts` is the phone entry.
- `src/sprites/`: pixel grid, character layers (hero, Mossback Toadstool) and Skia picture rendering.
- `src/combat/`: `rules.ts` (numbers), `anims.ts` (12 fps frame tables), `useCombatInput.ts` (UI-thread timing), `BattleScene.tsx` (Skia canvas), `BattleScreen.tsx` (the battle and menus).
- `src/ui/pixel.tsx`: framed panels, pixel buttons, bars, chips and icons.
- `src/sprites/overworld.ts`: small top-down sprites for the base (hero walk cycle, hopping toadstool, trees, stump, cottage, "!" bubble).
- `src/base/`: `map.ts` (layout, trees, grass and flower spots), `ground.ts` (ground recipe as plain pixels: cobbled path, pond, wind frames and gust timing, no Skia), `art.ts` (Skia pictures), `WindLayer.tsx` (swaying grass), `BaseScreen.tsx` (game loop, touch-to-walk, chopping, encounters, swirl into `BattleScreen`).
