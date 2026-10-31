import type { Layer } from './characters';
import { Grid, PAL, star } from './pixel';

// The Bristleback boar: a stocky brown boar with a dark mane, peach snout and white tusks.
// Battle frame: 64 x 48 art pixels like the Shroomie's, feet on row 45, facing left.
export const BOAR_W = 64;
export const BOAR_H = 48;
export const BOAR_GROUND = 45;

export type BoarPose = {
  x?: number;
  lift?: number; // whole body up (a hop or a bound)
  headDy?: number; // head lowered for a charge
  headDx?: number;
  legs?: 'stand' | 'paw' | 'run1' | 'run2' | 'brace';
  flash?: boolean;
  glint?: boolean;
  stars?: number;
  ko?: boolean; // knocked out, on its side
  dust?: number; // dust puffs kicked up behind, 1 to 3
  steam?: boolean; // a snort from the snout
};

// The boar is drawn as one silhouette, not a head stuck on a body, so the skull runs straight into
// the shoulder hump with no dip between them: a huge wedge of a head, a high bristled hump, and a
// back that falls away to a small rump. Points are (x, y) at full size, facing left.
const TOP: [number, number][] = [[0, 12], [1, 9], [3, 7], [6, 5], [9, 3], [12, 1], [15, 0], [19, 0], [22, 1], [25, 3], [28, 6], [31, 8], [33, 10], [34, 11]];
const BOTTOM: [number, number][] = [[0, 19], [3, 20], [7, 20], [11, 20], [15, 19], [19, 18], [23, 16], [27, 14], [31, 13], [34, 12]];
const HEAD_END = 14; // columns left of this belong to the head and move with headDy

function edge(pts: [number, number][], x: number) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / Math.max(1, x1 - x0);
  }
  return pts[pts.length - 1][1];
}

// Draws the body (no legs) with its top-left at (ox, oy). k scales it (1 in battle, 0.5 on the map);
// drop lowers the head, blending smoothly into the hump; ko shuts the eye into a cross.
function boarBody(g: Grid, ox: number, oy: number, k: number, drop: number, ko = false) {
  const W = Math.round(34 * k);
  const sx = (x: number) => x / k; // map pixel column back to full-size units
  const headShift = (fx: number) => (fx < HEAD_END ? (drop * (HEAD_END - fx)) / HEAD_END : 0);
  const top = (x: number) => Math.round((edge(TOP, sx(x)) + headShift(sx(x))) * k);
  const bot = (x: number) => Math.round((edge(BOTTOM, sx(x)) + headShift(sx(x))) * k);
  for (let x = 0; x <= W; x++) {
    const t = top(x);
    const b = bot(x);
    for (let y = t; y <= b; y++) {
      // Dark mane along the top of the hump, a shaded belly, a tan jowl under the head.
      const fx = sx(x);
      let c = PAL.w;
      if (y - t < (fx > 8 && fx < 30 ? 2 : 1) * Math.max(1, Math.round(k * 2)) - (k < 1 ? 1 : 0)) c = PAL.W;
      if (y === b) c = PAL.W;
      g.set(ox + x, oy + y, c);
    }
    // Bristles: spikes along the mane, longest over the hump.
    const fx = sx(x);
    if (fx > 9 && fx < 28 && x % 2 === 0) {
      g.set(ox + x, oy + top(x) - 1, PAL.W);
      if (k === 1 && fx > 12 && fx < 23) g.set(ox + x, oy + top(x) - 2, PAL.W);
    }
  }
  const s = (fx: number) => Math.round(headShift(fx) * k);
  const P = (fx: number, fy: number, c: string) => g.set(ox + Math.round(fx * k), oy + Math.round(fy * k) + s(fx), c);
  // Snout: a broad peach disc on the front of the wedge, two nostrils, a shaded underside.
  for (let fy = 11; fy <= 19; fy++) for (let fx = -2; fx <= 3; fx++) if (!(fx === 3 && (fy === 11 || fy === 19)) && !(fx === -2 && (fy <= 11 || fy >= 18))) P(fx, fy, fy >= 18 ? PAL.c : fx === -2 ? PAL.c : PAL.S);
  P(0, 13, PAL.K);
  P(0, 16, PAL.K);
  // Mouth line, then a big tusk curling up out of it.
  for (let fx = 3; fx <= 8; fx++) P(fx, 18, PAL.W);
  for (const [fx, fy] of [[6, 19], [6, 18], [6, 17], [5, 16], [5, 15], [4, 14]] as [number, number][]) P(fx, fy, PAL.H);
  if (k === 1) for (const [fx, fy] of [[7, 19], [7, 18], [6, 16]] as [number, number][]) P(fx, fy, PAL.H);
  // Warts: lumps on the cheek and over the snout, because it's an ugly brute.
  for (const [fx, fy] of [[4, 9], [10, 12], [11, 13], [8, 14]] as [number, number][]) P(fx, fy, PAL.W);
  // A small mean eye under a heavy brow.
  if (ko) {
    for (const [fx, fy] of [[7, 7], [9, 7], [8, 8], [7, 9], [9, 9]] as [number, number][]) P(fx, fy, PAL.K);
  } else {
    for (let fx = 6; fx <= 10; fx++) P(fx, 7, PAL.W);
    P(8, 8, PAL.K);
    P(9, 8, PAL.K);
    if (k === 1) P(8, 9, PAL.K);
  }
  // Ear: a ragged triangle laid back on top of the head, at the foot of the hump.
  for (const [fx, fy, c] of [[10, 2, PAL.W], [11, 1, PAL.W], [11, 0, PAL.W], [12, -1, PAL.W], [12, -2, PAL.W], [13, -3, PAL.W], [12, 0, PAL.S], [12, 1, PAL.S], [13, -1, PAL.W], [13, 0, PAL.W], [13, 1, PAL.W], [14, -2, PAL.W], [14, 0, PAL.W]] as [number, number, string][]) P(fx, fy, c);
  // Tail: a thin flick off the rump.
  g.set(ox + W + 1, oy + Math.round(9 * k), PAL.W);
  g.set(ox + W + 2, oy + Math.round(8 * k), PAL.W);
  if (k === 1) g.set(ox + W + 2, oy + 7, PAL.W);
}

// Legs: thick front legs under the chest, thin short back legs under the small rump.
function legs(g: Grid, ox: number, gy: number, kind: BoarPose['legs']) {
  const L = (x: number, top: number, bottom: number, w: number, dx = 0) => {
    for (let y = top; y <= bottom; y++) {
      const ofs = Math.round((dx * (y - top)) / Math.max(1, bottom - top));
      for (let i = 0; i < w; i++) g.set(x + i + ofs, y, y >= bottom - 1 ? PAL.K : PAL.W);
    }
  };
  const fTop = gy - 6; // under the chest
  const bTop = gy - 11; // the rump sits high on thin legs
  switch (kind) {
    case 'paw':
      L(ox + 8, fTop, gy - 2, 4, 3);
      L(ox + 14, fTop, gy, 4);
      L(ox + 26, bTop, gy, 3);
      L(ox + 30, bTop, gy, 3);
      break;
    case 'run1':
      L(ox + 10, fTop, gy - 1, 4, 2);
      L(ox + 15, fTop, gy - 1, 4, 1);
      L(ox + 25, bTop, gy - 1, 3, -1);
      L(ox + 28, bTop, gy - 1, 3, -2);
      break;
    case 'run2':
      L(ox + 7, fTop, gy - 1, 4, -4);
      L(ox + 12, fTop, gy - 1, 4, -3);
      L(ox + 28, bTop, gy - 1, 3, 3);
      L(ox + 31, bTop, gy - 1, 3, 4);
      break;
    case 'brace':
      L(ox + 8, fTop, gy, 4, -3);
      L(ox + 13, fTop, gy, 4, -2);
      L(ox + 26, bTop, gy, 3);
      L(ox + 30, bTop, gy, 3);
      break;
    default:
      L(ox + 8, fTop, gy, 4);
      L(ox + 14, fTop, gy, 4);
      L(ox + 26, bTop, gy, 3);
      L(ox + 30, bTop, gy, 3);
  }
}

export function boarLayers(p: BoarPose): Layer[] {
  const g = new Grid(BOAR_W, BOAR_H);
  const fx = new Grid(BOAR_W, BOAR_H);
  const ox = 14 + (p.x ?? 0);
  const gy = BOAR_GROUND - (p.lift ?? 0);
  const drop = p.headDy ?? 0;
  // The body's chest bottom (row 20 of the silhouette) sits on the legs.
  const oy = gy - 5 - 20;
  // Head reference point for effects: the snout tip and the tusk.
  const snout = { x: ox, y: oy + 13 + drop };
  const tusk = { x: ox + 5, y: oy + 15 + Math.round(drop * 0.6) };

  if (p.ko) {
    // Knocked out: slumped flat on its belly, legs folded under, head dropped, eye crossed.
    boarBody(g, ox, BOAR_GROUND - 23, 1, 3, true);
    if (p.flash) g.tint(PAL.H);
    g.outline(PAL.K);
    if (p.stars != null) {
      const pos: [number, number][] = [[0, -3], [6, -6], [12, -4], [8, -1]];
      for (let i = 0; i < 3; i++) {
        const q = pos[(i + p.stars) % 4];
        star(fx, ox + 4 + q[0], BOAR_GROUND - 18 + q[1], 1, PAL.B, PAL.b);
      }
    }
    return [{ grid: g, alpha: 1 }, { grid: fx, alpha: 1 }];
  }

  legs(g, ox, gy, p.legs ?? 'stand');
  boarBody(g, ox + (p.headDx ?? 0) * 0, oy, 1, drop);
  if (p.flash) g.tint(PAL.H);
  g.outline(PAL.K);

  const layers: Layer[] = [];
  if (p.dust) {
    const d = new Grid(BOAR_W, BOAR_H);
    for (let i = 0; i < p.dust; i++) {
      const cx = ox + 36 + i * 7;
      const cy = BOAR_GROUND - 2 - i;
      const r = 2 + i;
      for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (j * j + k * k <= r * r) d.set(cx + k, cy + j, i === 0 ? PAL.C : PAL.o);
    }
    layers.push({ grid: d, alpha: 0.9 });
  }
  layers.push({ grid: g, alpha: 1 });
  if (p.glint) star(fx, tusk.x, tusk.y - 1, 3, PAL.B, PAL.H);
  if (p.steam) for (const [sx, sy] of [[-2, 0], [-4, -1], [-5, 1], [-6, -2]]) fx.set(snout.x + sx, snout.y + sy, PAL.o);
  if (p.stars != null) {
    const pos: [number, number][] = [[0, -3], [6, -6], [12, -4], [8, -1]];
    for (let i = 0; i < 3; i++) {
      const q = pos[(i + p.stars) % 4];
      star(fx, ox + 4 + q[0], oy + 2 + drop + q[1], 1, PAL.B, PAL.b);
    }
  }
  layers.push({ grid: fx, alpha: 1 });
  return layers;
}

// The boar's head for the battle log: the front of the silhouette, cropped.
export function boarPortrait(): Grid {
  const t = new Grid(40, 26);
  boarBody(t, 1, 3, 1, 0);
  const g = new Grid(20, 20);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 19; x++) {
    const c = t.get(x + 1, y + 2);
    if (c) g.set(x + 1, y, c);
  }
  g.outline(PAL.K);
  return g;
}

// Overworld boar on the map, 22 x 15 frame, the same silhouette at half size, facing left unless
// flipped. frame: 0 standing, 1 and 2 trotting, 3 head down (about to charge).
export const BOAR_OW_W = 22;
export const BOAR_OW_H = 15;

export function boarOverworld(frame: number, flip = false): Grid {
  const g = new Grid(BOAR_OW_W, BOAR_OW_H);
  const base = 13;
  const bob = frame === 2 ? -1 : 0;
  const leg = (x: number, w: number, dx: number, top: number) => {
    for (let i = 0; i < w; i++) {
      for (let y = top; y < base; y++) g.set(x + i, y + bob, PAL.W);
      g.set(x + i + dx, base, PAL.K);
    }
  };
  const xs = frame === 1 ? [4, 7, 14, 16] : frame === 2 ? [3, 8, 13, 17] : [4, 7, 14, 16];
  const dx = frame === 1 ? [-1, 1, -1, 1] : frame === 2 ? [1, -1, 1, -1] : [0, 0, 0, 0];
  xs.forEach((x, i) => leg(x, i < 2 ? 2 : 1, dx[i], i < 2 ? base - 2 : base - 5));
  boarBody(g, 1, base - 11 + bob, 0.5, frame === 3 ? 4 : 0);
  if (flip) {
    const c = g.c.slice();
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.c[y * g.w + x] = c[y * g.w + (g.w - 1 - x)];
  }
  g.outline(PAL.K);
  return g;
}

// Boar meat: a rose ham steak with a marbled fat rim and a vellum bone, 12 x 10.
const MEAT = [
  '..........HH',
  '.........HVV',
  '...rrrr.HVV.',
  '.rrRRRRrVV..',
  'rRRRSRRRr...',
  'rRRSRRRRr...',
  'rRRRRRSRr...',
  '.rRRRRRRr...',
  '..rrrrrr....',
  '............',
];

export function meatGrid(): Grid {
  const g = new Grid(14, 12);
  g.stamp(MEAT, 1, 1);
  g.outline(PAL.K);
  return g;
}

// The bag: a bark leather satchel with a flap and a butter buckle. open shows the mouth.
const BAG = [
  '....WW..WW....',
  '.....WwwW.....',
  '......ww......',
  '....BBBBBB....',
  '....WwwwwW....',
  '...WwwwwwwW...',
  '..WwwwwwwwwW..',
  '.WwwwwwwwwwwW.',
  'WwwwwwwwwwwwwW',
  'WwwwwwwwwwwwwW',
  'WwwwwwwwwwwwwW',
  'WwwwwwwwwwwwWW',
  '.WwwwwwwwwwWW.',
  '..WWWWWWWWWW..',
];
const BAG_OPEN = [
  '..............',
  '..............',
  '..WWWWWWWWWW..',
  '..WKKKKKKKKW..',
  '...WwwwwwwW...',
  '....BBBBBB....',
  '..WwwwwwwwwW..',
  '.WwwwwwwwwwwW.',
  'WwwwwwwwwwwwwW',
  'WwwwwwwwwwwwwW',
  'WwwwwwwwwwwwwW',
  'WwwwwwwwwwwwWW',
  '.WwwwwwwwwwWW.',
  '..WWWWWWWWWW..',
];

export function bagGrid(open = false): Grid {
  const g = new Grid(16, 16);
  g.stamp(open ? BAG_OPEN : BAG, 1, 1);
  g.outline(PAL.K);
  return g;
}

// A coin, 7 x 7: gold with a butter shine.
const COIN = ['.bbbbb.', 'bBBbbbb', 'bBbbbbb', 'bbbbbbb', 'bbbbbbb', 'bbbbbbb', '.bbbbb.'];
export function coinGrid(): Grid {
  const g = new Grid(9, 9);
  g.stamp(COIN, 1, 1);
  g.outline(PAL.K);
  return g;
}
