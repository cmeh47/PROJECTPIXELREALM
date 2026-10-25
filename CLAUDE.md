# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project

Project Pixel Realm (working name): a 4-player co-op 2D pixel RPG for iOS and Android. Players share a base, gather resources, take NPC quests and clear dungeons with reactive turn-based combat. See `README.md` and `docs/decisions.md`.

No app code exists yet. Milestone 1 is the combat-feel prototype, built after the animation storyboards are approved.

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

_To be added when the Expo project is created._
