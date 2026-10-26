# Decisions

Decided on 2026-10-25.

| Topic | Decision |
|---|---|
| Combat | Reactive turn-based, inspired by Clair Obscur: Expedition 33. Strike runes, dodge, parry, counters, attack chains. |
| Engine | Expo + React Native Skia |
| Backend | Supabase |
| Co-op | Live sessions: friends share the hub and play the same dungeon at the same moment |
| Base | Each player has their own base. They can invite friends in to help, up to 4 players at a time. (Replaces the earlier shared base lot.) |
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

## Player base (decided while building the first base slice)

| Topic | Decision |
|---|---|
| Ownership | Every player owns a base: a meadow lot with their cottage. Visitors come by invite, 4 players on a base at most (the owner plus three). |
| Starting lot | Green grass, choppable trees for wood, a pond and 4 wild Shroomies to clear. |
| Trees | Tap a tree to walk over and chop it: 3 swings, 1 wood each. It leaves a stump that regrows after a minute. The ring of trees on the edge can't be chopped. |
| Shroomies | The mushroom monsters (once called toadstools). Touching one pops a "!" bubble over its head, then a swirl transition starts the battle. Win: it's gone and drops 3 wood. Tame: it becomes a critter by the cottage. Flee: you step back and get a moment of grace. Lose: you wake up at your door. |
| Controls | Touch to walk: hold anywhere and the hero walks toward your finger; a quick tap walks to the spot. Pending Cameron's pick between touch, a joystick, or a D-pad. |
| Critters | Tamed monsters are called critters (not pets). Tap one on your base to chat: an RPG text box with its portrait, name and voice. A Shroomie says "...WeeeeeiiiieWeWeWeeeiiiiii...". |
| Dialogue | Classic RPG text box with a profile-picture headshot (40 x 40 art px, the face fills the frame). Lines type out on the clock; replies stack above the box as framed choices. A Shroomie squeaks once per line; the butcher only grunts, on a loop while his text types. "..." beats are silent and type slowly. |
| The butcher | A bald old man by his knocked-down hut in the bottom-right corner. Tap him and you walk over and talk. He's hostile at first ("Whoa! Get back! Who are you?", two replies, then a battle with no taming). Beat him and he calms down, introduces himself as a butcher and asks you to rebuild his hut. No: "Oh... okay. Maybe later." and he asks again next time. Yes: the quest starts. |
| Quests | First quest: rebuild the butcher's hut with 10 wood. A tracker under the base panel shows wood carried out of 10. Handing it in and the rebuild are still to be designed. |
