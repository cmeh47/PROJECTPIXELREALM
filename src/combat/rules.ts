// Combat numbers for the prototype. Everything here is a first guess to tune by feel.

import { CLASS_STATS, type HeroClass, type StatKey } from '../sprites/hero';

export type Grade = 'perfect' | 'good' | 'miss' | 'early';
export type Defense = 'parry' | 'dodge' | 'early' | 'hit';

export const WINDOWS = {
  perfect: 80,
  good: 150,
  parry: 70,
  dodge: 130,
  assist: 1.6,
};

// x / y (and drift, decoy) are art pixels inside the target enemy's 64 x 48 frame.
export type RuneSpec = {
  delay: number;
  x: number;
  y: number;
  drift?: [number, number];
  dart?: boolean;
  decoy?: [number, number];
};

export type Move = {
  id: string;
  name: string;
  kind: string;
  cost: number;
  damage: number;
  brk: number;
  runes: RuneSpec[];
  desc: string;
  finisher?: boolean;
};

export const MOVES: Move[] = [
  {
    id: 'moonlit',
    name: 'Moonlit Slash',
    kind: 'SLASH',
    cost: 2,
    damage: 9,
    brk: 12,
    finisher: true,
    desc: 'An overhead crescent. Three runes with uneven timing. Three Perfects unlock a rising-cut finisher.',
    runes: [
      { delay: 720, x: 24, y: 11, drift: [5, -3] },
      { delay: 980, x: 46, y: 27, dart: true },
      { delay: 640, x: 18, y: 3, decoy: [44, 1] },
    ],
  },
  {
    id: 'starfall',
    name: 'Starfall Thrust',
    kind: 'PIERCE',
    cost: 3,
    damage: 7,
    brk: 8,
    desc: 'Four quick jabs. The last rune darts to the far side of the enemy.',
    runes: [
      { delay: 520, x: 28, y: 17 },
      { delay: 430, x: 40, y: 9, dart: true },
      { delay: 600, x: 22, y: 25, dart: true },
      { delay: 380, x: 52, y: 19, dart: true },
    ],
  },
  {
    id: 'bash',
    name: 'Shield Bash',
    kind: 'BREAK',
    cost: 1,
    damage: 5,
    brk: 34,
    desc: 'A shove that fills the Break bar fast. Good for setting up a Tame.',
    runes: [{ delay: 620, x: 30, y: 21 }],
  },
  {
    id: 'quick',
    name: 'Quick Strike',
    kind: 'BASIC',
    cost: -1,
    damage: 7,
    brk: 6,
    desc: 'A fast basic hit that earns 1 AP instead of spending it.',
    runes: [{ delay: 560, x: 28, y: 15 }],
  },
];

// ---------- Mage spells: glyph chains ----------
// Every glyph of a spell appears at once, marked I, II, III, IV inside. Only the next one has a ring
// closing on it; each is graded like a strike rune, on the UI thread. When the chain is done the
// spell is cast once: its damage (or healing) is the sum of each glyph's grade, scaled by MAG.
// x / y are art pixels inside the target's frame (a foe's 64 x 48, or an ally's 56 x 40).
// next: the glyph sits on the next foe over (Arc Chain jumping); in a solo fight it stays on the same one.
// solo: where a `next` glyph goes when there is no second foe, so it doesn't sit on top of another.
export type GlyphSpec = { delay: number; x: number; y: number; next?: boolean; solo?: [number, number] };
export type SpellFx = 'ember' | 'frost' | 'arc' | 'mend';

export type Spell = {
  id: string;
  name: string;
  kind: string;
  cost: number;
  damage: number; // per glyph (healing per glyph for Mend)
  brk: number; // per glyph
  glyphs: GlyphSpec[];
  desc: string;
  fx: SpellFx;
  heal?: boolean;
  shatter?: boolean;
  windTicks: number;
};

export const SPELLS: Spell[] = [
  {
    id: 'frost',
    name: 'Frost Lance',
    kind: 'PIERCE',
    cost: 2,
    damage: 8,
    brk: 10,
    fx: 'frost',
    shatter: true,
    windTicks: 3,
    desc: 'Three glyphs in a line, uneven timing. Three Perfects shatter the frost for bonus Break.',
    glyphs: [
      { delay: 700, x: 20, y: 17 },
      { delay: 520, x: 32, y: 25 },
      { delay: 860, x: 44, y: 33 },
    ],
  },
  {
    id: 'arc',
    name: 'Arc Chain',
    kind: 'SHOCK',
    cost: 3,
    damage: 6,
    brk: 7,
    fx: 'arc',
    windTicks: 3,
    desc: 'Four quick glyphs zigzag across two foes, and the bolt jumps between them. Alone, all four hit one.',
    glyphs: [
      { delay: 620, x: 22, y: 14 },
      { delay: 420, x: 34, y: 28 },
      { delay: 560, x: 30, y: 14, next: true, solo: [42, 10] },
      { delay: 460, x: 42, y: 28, next: true, solo: [50, 24] },
    ],
  },
  {
    id: 'mend',
    name: 'Mend',
    kind: 'HEAL',
    cost: 2,
    damage: 6,
    brk: 0,
    fx: 'mend',
    heal: true,
    windTicks: 3,
    desc: 'Two slow glyphs over the most hurt ally (or you). Perfects heal more. Does no damage.',
    glyphs: [
      { delay: 760, x: 16, y: 20 },
      { delay: 760, x: 28, y: 30 },
    ],
  },
  {
    id: 'ember',
    name: 'Ember Bolt',
    kind: 'BASIC',
    cost: -1,
    damage: 7,
    brk: 6,
    fx: 'ember',
    windTicks: 2,
    desc: 'A fast fire bolt from one glyph. Earns 1 AP instead of spending it.',
    glyphs: [{ delay: 560, x: 32, y: 27 }],
  },
];
export const SHATTER_DAMAGE = 12;
export const SHATTER_BREAK = 45;

export const GRADE_MULT: Record<Grade, number> = { perfect: 1.6, good: 1, miss: 0.6, early: 0.6 };
export const GRADE_BREAK: Record<Grade, number> = { perfect: 1.5, good: 1, miss: 0.3, early: 0.3 };

// ---------- Class stats in battle (out of 10, from character creation) ----------
// HP sets max health, STR scales weapon moves, MAG scales spells and healing, DEF softens enemy
// hits and SPD decides who acts first in a group round. Warrior 100 HP, Mage 85.
export type Stats = Record<StatKey, number>;
export const statsOf = (cls: HeroClass): Stats => CLASS_STATS[cls];
export const maxHpOf = (st: Stats) => 60 + 5 * st.hp;
// STR 7 hits x1.16, STR 3 x0.84; MAG 8 casts x1.24.
export const powerMult = (stat: number) => 0.6 + 0.08 * stat;
// DEF 7 takes x0.85 of a hit, DEF 3 x1.05.
export const guardMult = (def: number) => 1.2 - 0.05 * def;
export const hitOn = (base: number, st: Stats) => Math.max(1, Math.round(base * guardMult(st.def)));

export const HERO_MAX_HP = 100;
export const FOE_MAX_HP = 120;
export const BREAK_MAX = 100;
export const AP_MAX = 5;
export const AP_START = 2;
// AP comes back from skill, not only from Quick Strike: every Perfect strike and every parry.
export const AP_PERFECT = 1;
export const AP_PARRY = 1;
export const ENEMY_HIT = 12;
export const COUNTER_DAMAGE = 18;
export const COUNTER_BREAK = 30;
export const FINISHER_DAMAGE = 16;
export const FINISHER_BREAK = 40;
export const FLEE_CHANCE = 0.85;

export type EnemyPattern = { feint: boolean; hits: number };
export const PATTERNS: EnemyPattern[] = [
  { feint: false, hits: 1 },
  { feint: true, hits: 1 },
  { feint: false, hits: 2 },
  { feint: true, hits: 2 },
];

// Lower HP, a Broken enemy and a treat all raise the chance. Capped so it is never certain.
export function tameChance(hp: number, broken: boolean, treat: boolean) {
  const missing = 1 - hp / FOE_MAX_HP;
  const c = 0.08 + missing * 0.55 + (broken ? 0.2 : 0) + (treat ? 0.15 : 0);
  return Math.max(0.05, Math.min(0.95, c));
}

export const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// Party allies. In live co-op each ally is a real player running their own runes on their phone;
// in this prototype they are Echoes whose timing is rolled.
export const ECHO_STRIKE = { damage: 7, brk: 9, hits: 2 };
// A mage Echo casts from where it stands: two glyphs' worth of Frost Lance, rolled.
export const ECHO_SPELL = { damage: 7, brk: 8, glyphs: 2 };
export function echoGrade(): Grade {
  const r = Math.random();
  return r < 0.45 ? 'perfect' : r < 0.85 ? 'good' : 'miss';
}
export const ECHO_DEFENSE = { parry: 0.4, dodge: 0.15 };
