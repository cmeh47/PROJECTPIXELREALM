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
- Art: Aseprite. Sources in `art/`, exports in `assets/sprites/`. Sounds: generators in `art/sounds/` (Python + numpy), exports in `assets/sounds/`, played with `expo-audio`

## Conventions

- Developed on Windows with no Mac. Keep scripts cross-platform. iOS builds go through EAS in the cloud.
- Testing: Expo Go and a web link until push notifications need a development build (milestone 6).
- Every shared change (spending resources, building, boss damage) goes through a Supabase server function, never a direct client write.
- Combat input timing is judged on the UI thread, not in JavaScript.
- Keep secrets out of the repo. Use a git-ignored `.env` and document required variables here.
  - `EXPO_PUBLIC_SUPABASE_URL`: the project's API URL (`https://<ref>.supabase.co`).
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`: the publishable (anon) key. It ships inside the app by design. Never put the service role key in the app or the repo.
  - Copy `.env.example` to `.env`. Without these the game runs offline and nothing is saved.

## Commands

```bash
npm install                    # also copies Skia's canvaskit.wasm into public/ for the web build
npx expo start                 # dev server: scan the QR code with Expo Go, or press w for web
npm run typecheck              # tsc --noEmit
npm run export:web             # static web build in dist/
npx expo install <package>     # add packages (picks SDK-compatible versions)
supabase db push               # apply supabase/migrations (or paste a migration into the SQL editor)
```

If `npx expo install` fails behind a proxy, prefix it with `EXPO_OFFLINE=1`.

## Code map

- `App.tsx` loads fonts and gesture/safe-area roots, then shows character creation on first launch (no hero yet) or the base. `src/boot/index.web.ts` loads CanvasKit before mounting on web; `src/boot/index.ts` is the phone entry.
- `src/sprites/`: pixel grid, character layers (Mossback Toadstool, the butcher), `boar.ts` (the boar in battle and on the map, meat, bag, coin and woods sign) and Skia picture rendering. `hero.ts` draws the player's hero from a `HeroLook` (class, sex, skin, hairstyle, hair color): base-map sprite, posable battle sprite, HUD face, plus class stats and the demo party's looks.
- `src/create/CharacterCreation.tsx`: the first-launch screen (live preview, stat bars, choices, name).
- `src/combat/`: `rules.ts` (numbers), `anims.ts` (12 fps frame tables), `useCombatInput.ts` (UI-thread timing), `BattleScene.tsx` (Skia canvas), `BattleScreen.tsx` (the battle and menus).
- `src/net/`: `supabase.ts` (client, guest sign-in), `useHero.ts` (loads or creates the hero, keeps a copy on the device for offline play), `useBaseSave.ts` (loads the base, sends each change to a server function in order, applies the server's copy). Server side: `supabase/migrations/` (the `bases` and `heroes` tables, read-only to players, and the functions that change them).
- `src/ui/pixel.tsx`: framed panels, pixel buttons, bars, chips and icons.
- `src/sprites/merchant.ts`: Puul the merchant (battle sprite with his walking stick, base-map sprite, headshot with moods, HUD face) and his stand.
- `src/sprites/town.ts`: the town's five buildings (thatched critter store, gabled bar, false-front sheriff's office, flat-roofed medical center, the witch's hut), street props, chimney smoke, Mira the critter store owner (map sprite and headshot) and her three little Shroomie helpers.
- `src/sprites/overworld.ts`: small top-down sprites for the base (hopping toadstool, trees, stump, cottage, "!" bubble, the old butcher, his hut ruins, shack build stages and hammer).
- `src/base/`: `map.ts` (layout, trees, grass and flower spots), `ground.ts` (ground recipe as plain pixels: cobbled path, pond, wind frames and gust timing, no Skia), `art.ts` (Skia pictures), `WindLayer.tsx` (swaying grass), `Conversation.tsx` (scripted RPG text box: headshot, typed lines, voice, choices, end tags), `npcs.ts` (speakers and scripts: critters, the old butcher), `QuestLog.tsx` (top-right scroll quest log; only the player unrolls it, a NEW tag flags news), `pieces.tsx` (shared map pieces and the swirl, flash and leaf-wipe transitions), `Inventory.tsx` (20-slot inventory, pack button, coins), `woods.ts` and `WoodsScreen.tsx` (the Boar Woods: layout, boar AI, meat pickup, Puul's clearing and rescue), `follow.ts` (an NPC walking behind you along your trail), `town.ts` and `TownScreen.tsx` (the town south of the base: streets, buildings, Mira and her helpers, tap a building to walk to its door), `BaseScreen.tsx` (game loop, touch-to-walk, chopping, encounters, NPC talk, quests, the butcher's shack rebuild timer, swirl into `BattleScreen`).
