# DESIGN.md: Project Pixel Realm, Pastel Pixel Fantasy

Design system for Project Pixel Realm (working name), a 4-player co-op pixel RPG for iOS and Android
(Expo / React Native + React Native Skia). Sections 1 to 9 come from Quest Log and cover the UI.
Sections 10 to 12 cover the game world, combat and animation.
AI agents: follow this file for every screen and component. Where it disagrees with a
general design skill (such as Taste Skill), **this file wins** on color, type, shape,
and mood. Use the skills for layout quality, polish, and code structure.

---

## 1. Visual theme and atmosphere

A cozy, whimsical high-fantasy world drawn in soft 2D pixel art. Picture a storybook
kingdom at golden hour: candy-colored castles, mossy forests, glowing potions,
friendly slimes. The UI feels like a hand-crafted handheld RPG menu, not a
productivity tool.

- **Mood words:** whimsical, gentle, magical, cozy, playful, hopeful.
- **Not:** dark/grim fantasy, neon cyberpunk, harsh 8-bit primary colors, glossy
  gradients, glassmorphism, or flat corporate minimalism.
- **Pixel rule:** every decorative edge, icon, and illustration sits on a pixel grid.
  Text stays readable first; pixel flavor comes from frames, icons, and display type.
- **Base pixel unit:** `P = 4` (one "art pixel" = 4 density-independent points).
  Borders, offsets, and corner steps are multiples of `P`.

## 2. Color palette and roles

Pastels carry the mood; a deep plum "ink" replaces black for outlines and text, as in
classic pixel art.

### Core

| Token | Hex | Role |
|---|---|---|
| `ink` | `#3B2A4A` | Outlines, primary text, pixel borders |
| `inkSoft` | `#6B5A7B` | Secondary text, inactive icons |
| `parchment` | `#FFF6E9` | App background |
| `vellum` | `#FFFDF8` | Cards, panels, sheets |
| `scroll` | `#F3E6D2` | Insets, input fields, pressed surfaces |

### Pastel accents

| Token | Hex | Use |
|---|---|---|
| `lavender` | `#C9B6F2` | Primary brand, main buttons, selected tabs |
| `lavenderDeep` | `#9C84D9` | Primary button shadow / pressed edge |
| `mint` | `#B8E8D2` | Success, completed quests, nature |
| `peach` | `#FFC9B0` | Warm highlights, rewards, streaks |
| `sky` | `#B5D8F7` | Info, mana, water, calm states |
| `butter` | `#FFE8A3` | XP, gold, coins, stars |
| `rose` | `#F7B5CA` | Hearts, health, favorites, gentle warnings |

### Game semantics (stronger tones for bars and badges)

| Token | Hex | Use |
|---|---|---|
| `xpGold` | `#F2C14E` | XP bar fill, level-up |
| `hpRose` | `#E8798F` | HP bar, destructive actions, errors |
| `manaBlue` | `#7FA8E8` | Energy / mana bars |
| `questGreen` | `#5FB894` | Quest complete check, positive deltas |
| `epicPurple` | `#A77BE0` | Rare/epic rewards |

### Night mode ("Moonlit Forest")

| Token | Hex |
|---|---|
| `parchment` → | `#241C38` |
| `vellum` → | `#33284D` |
| `scroll` → | `#2B2242` |
| `ink` (text) → | `#F5EEFF` |
| `inkSoft` → | `#BFB3D6` |
| Outline color → | `#140E22` |

Pastel accents stay the same in night mode; they glow against the dark background.

**Contrast:** text on pastel fills is always `ink`, never white. Body text must meet
WCAG AA (4.5:1). Never put `inkSoft` text on a pastel fill.

## 3. Typography

| Role | Font | Size / line height | Notes |
|---|---|---|---|
| Display (titles, level-up) | **Pixelify Sans** Bold | 28 / 36 | Sparingly, 1 per screen |
| Heading | **Pixelify Sans** SemiBold | 20 / 28 | Screen and section titles |
| Button / tab label | **Pixelify Sans** Medium | 16 / 20 | Sentence case |
| Tiny label / stat | **Silkscreen** Regular | 11 / 14 | ALL CAPS: "LV 12", "+50 XP" |
| Body | **Nunito** Regular / SemiBold | 16 / 24 | Quest descriptions, settings, long text |
| Caption | **Nunito** SemiBold | 13 / 18 | Timestamps, helper text |

- Load via `@expo-google-fonts/pixelify-sans`, `@expo-google-fonts/silkscreen`,
  `@expo-google-fonts/nunito`.
- Pixel fonts only at their intended sizes (Silkscreen at 8/11/16/22; Pixelify Sans
  at 16 and up). Never use pixel fonts for paragraphs.
- Support Dynamic Type / font scaling for body text; cap display text with
  `maxFontSizeMultiplier={1.3}`.

## 4. Component styling

### Pixel frame (the signature element)

Every card, button, and panel has a **2P (8pt) chunky ink border with stepped
corners** instead of smooth rounded corners, plus a **hard drop shadow** (no blur).

- Corners: notch each corner by one `P` (cut-out square), so frames look like pixel
  art. Implement with a reusable `<PixelFrame>` (absolutely positioned edge views, or
  a 9-slice PNG via `ImageBackground` with `capInsets`). Do **not** use
  `borderRadius` on framed elements.
- Shadow: a solid `ink` (or accent-deep) block offset `x: P, y: P` behind the frame.
  Render it as a sibling `View`, not with `shadowRadius`/`elevation`, so it looks
  identical on iOS and Android.

### Buttons

- **Primary:** `lavender` fill, `ink` border, `lavenderDeep` hard shadow. Min height
  52, horizontal padding 20.
- **Secondary:** `vellum` fill, `ink` border, `ink` shadow.
- **Danger:** `hpRose` fill, `ink` text.
- **Pressed:** move the button down/right by `P` and hide the shadow (the "pressed
  into the page" effect). Use `Pressable` with a 60ms transition and light haptics
  (`expo-haptics` `ImpactFeedbackStyle.Light`).
- **Disabled:** `scroll` fill, `inkSoft` text, no shadow.

### Quest card

`vellum` pixel frame, 16 padding. Left: 40×40 pixel-art icon (quest type). Middle:
title (Heading), one-line description (Body, `inkSoft`). Right: reward chip (`butter`
fill, coin sprite, Silkscreen "+20"). Completed: `mint` fill, ink checkmark sprite,
title gets a pixel strikethrough.

### Stat bars (HP / XP / Mana)

Segmented bars: 10–20 discrete blocks with 2pt gaps, inside an ink frame. Fill
animates block by block (not a smooth slide). Label in Silkscreen above: "XP 340/500".

### Tab bar

`vellum` panel with top ink border. Pixel-art icons (24×24 art at 1x, shown at 2x =
48pt). Selected tab: `lavender` tile behind the icon plus a bouncing 1-frame-up
animation. Labels in Pixelify Sans 12.

### Inputs

`scroll` inset field with ink border and an inner 1P highlight on the top/left edge
(engraved look). Placeholder in `inkSoft`. Focus: border becomes `lavenderDeep`, and a
blinking pixel caret sprite is optional.

### Dialogs and toasts

Dialogs look like RPG text boxes: `vellum` frame, a speaker portrait sprite on the
left, text that types out (30 chars/sec, tap to skip). Toasts drop from the top as a
small scroll banner.

### Icons and illustrations

- All pixel art drawn at 1x on a 16×16 or 32×32 grid, exported pre-scaled at
  @2x/@3x with **nearest-neighbor** scaling so they stay crisp. Never let the OS
  smooth-scale pixel art.
- Show sprites only at whole-number multiples of their art size.
- Palette for sprites: the tokens above, plus a highlight (`#FFFFFF` at 60%) and the
  `ink` outline. No anti-aliased edges.

## 5. Layout principles

- Spacing scale (multiples of `P`): 4, 8, 12, 16, 24, 32, 48.
- Screen padding: 16 horizontal. Gap between cards: 12.
- Respect safe areas (`react-native-safe-area-context`) on every screen.
- One clear primary action per screen, placed in thumb reach (bottom area).
- Lists use `FlatList`/`FlashList`, never a long `ScrollView` of mapped items.
- Decorative scenery (clouds, hills, sparkles) lives in a background layer behind
  content, never behind text without a solid panel.

## 6. Depth and elevation

Depth comes from **hard pixel shadows and layering**, never blur.

| Level | Treatment | Use |
|---|---|---|
| 0 | No frame, sits on parchment | Background scenery |
| 1 | Frame + `P` offset shadow | Cards, list items |
| 2 | Frame + `2P` offset shadow | Buttons, floating action |
| 3 | Frame + `2P` shadow + `ink` 40% dim behind | Dialogs, sheets |

Motion: steppy and bouncy. Use `react-native-reanimated` with short spring or
`steps()`-like timing; sprite animations at 8–12 fps. Respect Reduce Motion
(`useReducedMotion`) by turning off bounces and parallax.

## 7. Do's and don'ts

**Do**
- Use `ink` outlines on everything framed.
- Celebrate progress: sparkles, coin bursts, level-up banners.
- Keep copy playful and in-world ("Quest complete!", "Your party rests...").
- Keep tap targets at least 48×48.

**Don't**
- Use `borderRadius`, soft drop shadows, gradients, or blur on UI chrome.
- Use pure black (`#000`) or pure white text on pastels.
- Mix in non-pixel icon sets (no Material/SF icons in the main UI).
- Scale pixel art by fractional amounts or let it blur.
- Put more than 3 accent colors on a single card.

## 8. Platform behavior (iOS and Android)

- Identical pixel look on both platforms: draw shadows and frames with views, not
  native elevation.
- Respect platform conventions for navigation: iOS swipe-back, Android hardware back.
- Haptics: light on button press, success notification on quest complete.
- Small phones (width < 360): reduce screen padding to 12, keep sprite scale at 2x.
- Tablets: center content in a max-width 600 column with scenery filling the sides.
- Night mode follows the system setting (`useColorScheme`), with an in-app override.

## 9. Agent prompt guide

When building a new screen, follow this checklist:

1. Start from `parchment` background with optional scenery layer.
2. Wrap content blocks in `<PixelFrame>` with the right elevation level.
3. Use theme tokens from a single `theme.ts`; never hardcode hex values in screens.
4. Pixelify Sans for headings/buttons, Silkscreen for stat labels, Nunito for body.
5. Add one moment of delight (sprite animation, sparkle, typed dialog).
6. Check: no `borderRadius` on frames, no blurred shadows, text contrast AA, tap
   targets 48+, safe areas respected, works in night mode.

Example prompt: *"Build the Quest Board screen following DESIGN.md: a Heading 'Quest
Board', a segmented XP bar under the header, and a FlatList of quest cards with
reward chips. Primary button 'Accept quest' pinned at the bottom."*

---

## 10. Game world art

- **Tool:** Aseprite. Source files (`.aseprite`) live in `art/`, exported sheets in `assets/sprites/`.
- **Tile grid:** 16 × 16 art pixels. Characters fit a 56 × 40 frame (heroes) or 64 × 48 (standard enemies).
- **Outline:** every character and prop has a 1-pixel `ink` (`#3B2A4A`) outline, never black.
- **Palette:** only the tokens in section 2, plus white highlights. No colors picked outside the palette.
- **Scale:** the camera scales by whole numbers only (2×, 3×, 4×), with nearest-neighbor filtering.
- **Facing:** heroes face right in combat, enemies face left.

## 11. Combat feedback

Combat is reactive turn-based (see the plan). The screen must always tell the player what their timing earned.

| Moment | Feedback |
|---|---|
| Strike rune appears | Butter diamond rune with `ink` outline, a `lavenderDeep` ring closing on it. Touch target 56 pt. |
| Perfect hit | 80 ms hit-stop, 1-pixel shake, butter spark, "PERFECT" pop in Silkscreen |
| Decoy rune | Pale `lavender` rune with no ring, blinks once |
| Enemy tell | Wind-up pose held 2 to 4 ticks, a glint on the weapon, a sound cue |
| Parry | `sky` clang star, metallic ping, both sprites recoil 1 pixel, "PARRY" pop |
| Dodge | 2 to 3 lavender afterimages fading out |
| Counter | Camera punch-in to 115%, 120 ms slow-down, rising cut |
| Break | Enemy flashes white, dizzy stars, "BREAK!" pop in `rose` |

Timing windows (starting guesses, tuned on device): Perfect about ±80 ms, parry about ±60 ms, dodge about ±120 ms. Windows are adjustable in settings.

## 12. Animation rules

- Sprite bodies animate at **12 fps** (one tick = 83 ms). Movement, camera and effects run at 60 fps, snapped to the art-pixel grid.
- Every action has three beats: **wind-up** (2 to 3 ticks), **strike** (1 tick, with a smear frame instead of the weapon), **recovery** (2 to 3 ticks).
- Strike frames are never longer than one tick. Enemy tells are never shorter than two.
- Enemies vary their timing (feints, delayed swings, combos of different lengths) so fights never run on a steady beat.
- Hit flash: one frame of the sprite tinted white.
- One timing sheet (`docs/timing.md`) lists frame counts and ticks for every action of every character.
- Reduce Motion tones down shake, flashes and slow-downs.
- Reference: the combat animation storyboards (Sheet 1: action frames, Sheet 2: combat beats).
