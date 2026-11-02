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
| Sign-in | Guest first (Supabase anonymous sign-in, no screen), decided 2026-10-31. Email, Apple or Google can be linked to the same account later to keep a save across devices. |
| Character creation | First launch opens one screen with a big live preview of the hero (tap or arrows to turn them; they hop and step in place after each change), the class's starting stats as bars, and every choice below it: class (Warrior or Mage), body (male or female), 4 hairstyles (Crop, Spiky, Long, Braid), 4 skin tones, 5 hair colors, a name of up to 12 characters and a shuffle button. Decided 2026-10-31. The server stores the hero (`create_hero`, one per player). If the server can't be reached the player can play offline, with the hero kept on the device. |
| Classes | Warrior: plain steel half-helm, leather vest over a padded sky tunic, iron sword; leads in HP, STR and DEF (8 / 7 / 7 / 2 / 4 of 10 for HP, STR, DEF, MAG, SPD). Mage: patched floppy wizard hat, lavender robe with a butter sash, wooden staff with a glowing orb; leads in MAG and SPD (5 / 3 / 3 / 8 / 6). Starter gear is modest but tidy. The warrior fights with sword moves and strike runes; the mage casts spells with glyph chains (see Mage spells). |
| Saving | The server stores each base. Players can read only their own row and change it only through server functions (`chop`, `shroomie_battle`, `reset_base`, `butcher_step`), which check the rules. The butcher's rebuild runs on the server's clock. The app changes its own state at once, then applies the server's copy when its calls are answered, so a refused change rolls back. Battle results are still trusted from the app for now. |

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
| Stats in battle | Decided 2026-10-31. HP sets max health (60 + 5 per point: warrior 100, mage 85). STR scales sword moves, counters and finishers, MAG scales spells and healing (both x(0.6 + 0.08 per point)). DEF softens enemy hits (x(1.2 - 0.05 per point): warrior takes 85%, mage 105%). SPD sets the order heroes act in a group round: allies quicker than you act before your move, ties go to you. |
| Mage spells | Decided 2026-10-31 from storyboard sheet 3. The mage casts from where it stands instead of dashing in. Spells use glyph chains: every glyph of the spell appears at once with its place written inside it as a Roman numeral (I, II, III, IV), not a number floating above. Only the next glyph has a ring closing on it; each is graded like a strike rune on the UI thread, and a tapped glyph turns butter with a dotted thread to the next. Then the spell is cast once, and its damage or healing is the sum of the glyphs' grades, scaled by MAG. Every Perfect still earns 1 AP. |
| The mage's spells | Ember Bolt (basic, 1 glyph, earns 1 AP), Frost Lance (2 AP, 3 glyphs in a line; three Perfects shatter the frost for bonus damage and Break), Arc Chain (3 AP, 4 glyphs zigzagging across two foes, the bolt jumps between them; alone, all four hit one) and Mend (2 AP, 2 slow glyphs over the most hurt party member, you on a tie; heals, no damage). Mage Echoes cast Frost Lance with rolled glyphs. The practice arena (button archived 2026-11-02) has a WARRIOR / MAGE chip to try both classes with your look. |
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
| The butcher | A bald old man by his knocked-down hut in the bottom-right corner. Tap him and you walk over and talk. He's hostile at first ("Whoa! Get back! Who are you?", two replies, then a battle with no taming). In battle he's drawn at the hero's proportions, holding his cleaver low until he winds up. Beat him and he calms down, introduces himself as a butcher and asks you to rebuild his hut. No: "Oh... okay. Maybe later." and he asks again next time. Yes: the quest starts. |
| Quests | The quest log is a little parchment scroll under the base panel, with wooden rollers; tap its header to roll it up to one band. It's only on screen while you have a quest. First quest: rebuild the butcher's hut with 10 wood (wood carried out of 10, with the butcher's face). Handing in the wood completes it and the log goes away. |
| The butcher's shack | After the hand-in he rebuilds for 10 real minutes, hammering beside it, with a bar and a time-left label over the site. The site steps through eight stages: posts and a log pile, walls rising, rafters, shingles, then the finished shack (rose roof, striped awning over a shop counter, sausages in the window, a ham on the sign). He then says he'll buy any meat you bring and give you half the profit from selling it in town; buying meat and the town trips come later. The timer isn't saved yet: it lives in memory until the base is stored in Supabase. |

## Boar hunting (decided 2026-10-31)

| Topic | Decision |
|---|---|
| Where | The Boar Woods, a separate wood reached through a gap in the base's east tree ring (a sign with a boar head marks it). A leaf wipe plays between the two. Walk back out the west gap to go home. |
| Boars | Three roam the woods. Big, ugly and front-heavy: a huge head straight into a high hump, short back legs, side-by-side nostrils and tusks that run forward from the snout with an upturned tip. |
| Tusk Charge | A boar that spots you (64 px) pops a "!" and charges in a straight line. Contact starts a battle. Step aside and it skids past into a dizzy spell; touching a dizzy boar starts the battle with it already Broken. |
| Boar battle | 80 HP, no taming. A win drops 1 boar meat, or 2 if the finishing hit was Perfect. Beaten boars come back after 2 minutes. |
| Meat | Drops on the ground in the woods. Tap it to walk over and pick it up. |
| Inventory | One inventory for everything you carry, opened from the bag button under the base panel: 20 slots, each a stack of up to 99 of one item. Wood lives here too. When it's full, chopping and pickups stop with a "FULL" pop. |
| Selling | Once his shack is open, the butcher buys all your boar meat at 5 coins each. Coins show in the base panel. |
| Server | `boar_hunt`, `pick_up_meat` and `sell_meat` server functions enforce the respawn, the ground meat, the inventory limits and the price. |

## Puul the merchant (decided 2026-11-01)

| Topic | Decision |
|---|---|
| Where | A clearing in the far northeast of the Boar Woods, the hardest place to reach, so you explore and fight a few boars on the way. The woods grew east to 40 tiles wide; the three roaming boars stand along the route. The clearing is walled by trees with one way in, on its south side. |
| Puul | A travelling merchant with darker tan skin, short black hair and a thin black mustache, in a rose vest over a vellum shirt with a butter sash, leaning on a knobbed walking stick. His name shows as "???" until he tells you it. |
| The rescue | Three boars trot in circles round him while he throws his arms up. From close by he shouts "HELP!" every few seconds. Walking into the clearing pops a "!" over him and his plea: "Gyahhh! Oh, hey, HEY! Please, you there, please help me!" The battle starts on its own. |
| The battle | You and Puul against three boars. Puul is NPC controlled: he steps in and swings his walking stick with the butcher's swing, frame for frame, once a round after you (he's slower). Boars can go for him; he blocks, dodges or takes the hit. Losing sends you to the edge of the woods; fleeing backs you out of the clearing, and he pleads again when you come back. |
| After | He thanks you and says he's a merchant named Puul. You tell him you have a base; he says "Wow, you have a place? That's great! I'll move into your base and handle your trade." |
| Escort | He follows the path you walk, all the way out the west gap. Boars you meet on the way fight both of you. Reaching the base completes the escort. |
| The stand | On the base he asks for 20 wood to build a merchant stand (Yes or Not yet; he asks again later). He waits at a staked-out plot on the left side of the base, by the west tree ring (moved there 2026-11-02). Handing in the wood builds the stand at once: a plank counter under a butter-and-rose striped awning. Trading at it comes later. |
| Server | `merchant_step` moves the story forward one step at a time (`rescued`, `home`, `accept`, `handin`) and checks the 20 wood. The rescue battle's result is still trusted from the app. |

## Base HUD (decided 2026-11-02)

Nothing on the HUD may block the player's view of where they walk.

| Piece | Decision |
|---|---|
| Quest log | Top-right corner on the base and in the woods. It never unrolls by itself: it stays a single "QUESTS" band, and a bobbing NEW tag shows when a quest is added or ready to hand in. Tapping the band unrolls it and clears the tag; tapping again rolls it up. |
| Visitors | The VISITORS chip sits under the YOUR BASE panel, right of the inventory bag. |
| Arena | The ARENA button is archived (taken off the base HUD). The practice battle itself still exists in `BattleScreen` (no `encounter`) and can come back as a dev or menu option. |
