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

## Combat rules (decided while building the prototype)

| Topic | Decision |
|---|---|
| AP | Every Perfect strike and every parry earns 1 AP, on top of Quick Strike. |
| Group turns | Simultaneous: every player picks a move and a target at once, then heroes act in order, then each enemy attacks one hero. Only the targeted player parries. |
| Taming in group fights | The player picks which monster to tame. A success ends the battle and the rest of the pack flees. Only one tame per battle, except in a live co-op battle, where every player who picks TAME in the same round gets their own roll, so several can be tamed. |
| Battle screen | The scene fills the screen edge to edge; the command menu is docked to the bottom. A full party zooms the camera out so all heroes and enemies are on the field. |
