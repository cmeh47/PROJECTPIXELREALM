# Decisions

Decided on 2026-10-25.

| Topic | Decision |
|---|---|
| Combat | Reactive turn-based, inspired by Clair Obscur: Expedition 33. Strike runes, dodge, parry, counters, attack chains. |
| Engine | Expo + React Native Skia |
| Backend | Supabase |
| Co-op | Live sessions: friends share the hub and play the same dungeon at the same moment |
| Base | One main building (Storehouse, Forge, Quest Board as rooms), plus a personal home for each player on the base lot |
| Echoes | Kept. A solo player can bring AI-controlled copies of friends' heroes. Those friends earn a reduced share of XP and rewards. |
| Parties | Invite-code friends only for now |
| Art | Aseprite, drawn by Cameron and Claude |
| Battle menu | Each turn: ATTACK (opens the move list), TAME, FLEE. In a live party, fleeing needs a vote. |
| Taming | Classic chance roll. Lower HP, a Broken enemy and offered treats raise the chance. A failed roll gives the monster its turn. |
| Pets | Tamed monsters live on the base and take jobs there (for example a forager for bonus wood). A core feature. |
| Prototype approach | Animation storyboards first, approved before code |
| Title | Not decided yet |

## Milestones

1. Decisions and combat storyboards, then a combat-feel prototype in Expo Go
2. Skeleton and parties: project setup, Quest Log theme and components, Supabase sign-in, invite codes
3. Shared base and player homes
4. Gathering
5. NPC quests
6. Group incentives, presence and push notifications (development build)
7. Dungeon and combat
8. Boss raid and a one-week playtest with four friends
