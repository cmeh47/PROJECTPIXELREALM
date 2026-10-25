// Combat numbers for the prototype. Everything here is a first guess to tune by feel.

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

export const GRADE_MULT: Record<Grade, number> = { perfect: 1.6, good: 1, miss: 0.6, early: 0.6 };
export const GRADE_BREAK: Record<Grade, number> = { perfect: 1.5, good: 1, miss: 0.3, early: 0.3 };

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
