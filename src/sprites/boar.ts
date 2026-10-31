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

// Body, 26 x 13, shoulders high at the front (left), a dark mane along the back.
const BODY = [
  '....W.W.W.W.W.W...........',
  '...WWWWWWWWWWWWWW.........',
  '..WWWWWWWWWWWWWWWWW.......',
  '..wwwwwwwwwwwwwwwwwWWW....',
  '.wwwwwwwwwwwwwwwwwwwwwWW..',
  '.wwwwwwwwwwwwwwwwwwwwwwwW.',
  '.wwwwwwwwwwwwwwwwwwwwwwwW.',
  '.wwwwwwwwwwwwwwwwwwwwwwwW.',
  '.wwwwwwwwwwwwwwwwwwwwwwwW.',
  '.Wwwwwwwwwwwwwwwwwwwwwwww.',
  '..WWwwwwwwwwwwwwwwwwwwWW..',
  '...WWWWWWwwwwwwwwwwWWW....',
  '.....WWWWWWWWWWWWWW.......',
];

// Head, 13 x 12, snout to the left, one tusk curling up.
const HEAD = [
  '........WW......',
  '.......WwW......',
  '......WwwwW.....',
  '....wwwwwwwwww..',
  '...wwwwwwwwwwww.',
  '..wwwKKwwwwwwww.',
  '.wwwwKHwwwwwwww.',
  'wwwwwwwwwwwwwww.',
  'SSSwwwwwwwwwwww.',
  'SKSSHwwwwwwwwwn.',
  'SSSSHHwwwwwwnn..',
  '.cccHHwwwwnnn...',
  '..cc..nnnnn.....',
];

// The same head with a shut, crossed eye for a knockout.
const HEAD_KO = HEAD.map((r, j) => (j === 4 ? '...wKwKwwwwwww.' : j === 5 ? '..wwwKwwwwwwww.' : j === 6 ? '.wwwKwKwwwwwww.' : r));

function legs(g: Grid, bx: number, by: number, kind: BoarPose['legs']) {
  // Four stubby legs, 3 px wide, with ink hooves. Front pair near bx + 2 and bx + 7, back pair near
  // bx + 16 and bx + 20. by is the ground row.
  const L = (x: number, top: number, bottom: number, dx = 0) => {
    for (let y = top; y <= bottom; y++) {
      const t = (y - top) / Math.max(1, bottom - top);
      const ox = Math.round(dx * t);
      for (let i = 0; i < 3; i++) g.set(x + i + ox, y, y >= bottom - 1 ? PAL.K : PAL.W);
    }
  };
  const top = by - 5;
  switch (kind) {
    case 'paw': // front hoof scraping back, the other three planted
      L(bx + 2, top, by - 2, 3);
      L(bx + 7, top, by);
      L(bx + 16, top, by);
      L(bx + 20, top, by);
      break;
    case 'run1': // gathered: legs tucked under
      L(bx + 4, top, by - 1, 2);
      L(bx + 8, top, by - 1, 1);
      L(bx + 14, top, by - 1, -1);
      L(bx + 18, top, by - 1, -2);
      break;
    case 'run2': // stretched: front legs reach, back legs push
      L(bx + 1, top, by - 1, -4);
      L(bx + 5, top, by - 1, -3);
      L(bx + 18, top, by - 1, 3);
      L(bx + 21, top, by - 1, 4);
      break;
    case 'brace': // skidding: front legs locked forward
      L(bx + 2, top, by, -3);
      L(bx + 6, top, by, -2);
      L(bx + 16, top, by);
      L(bx + 20, top, by);
      break;
    default:
      L(bx + 3, top, by);
      L(bx + 8, top, by);
      L(bx + 16, top, by);
      L(bx + 20, top, by);
  }
}

export function boarLayers(p: BoarPose): Layer[] {
  const g = new Grid(BOAR_W, BOAR_H);
  const fx = new Grid(BOAR_W, BOAR_H);
  const ox = 26 + (p.x ?? 0);
  const gy = BOAR_GROUND - (p.lift ?? 0);

  if (p.ko) {
    // On its side: body rolled so the belly faces us, legs sticking out, head down on the ground.
    const by = BOAR_GROUND - 11;
    const rolled = [...BODY].reverse();
    g.stamp(rolled, ox, by);
    for (const lx of [ox + 6, ox + 11, ox + 17, ox + 21]) for (let k = 0; k < 4; k++) {
      g.set(lx + k, by - 1 - k, k >= 3 ? PAL.K : PAL.W);
      g.set(lx + k + 1, by - 1 - k, k >= 3 ? PAL.K : PAL.W);
    }
    g.stamp(HEAD_KO, ox - 13, BOAR_GROUND - 12);
    g.outline(PAL.K);
    if (p.stars != null) {
      const pos: [number, number][] = [[-4, -3], [3, -6], [10, -4], [5, -1]];
      for (let i = 0; i < 3; i++) {
        const q = pos[(i + p.stars) % 4];
        star(fx, ox - 4 + q[0], BOAR_GROUND - 16 + q[1], 1, PAL.B, PAL.b);
      }
    }
    return [{ grid: g, alpha: 1 }, { grid: fx, alpha: 1 }];
  }

  const by = gy - 5 - BODY.length + 1; // body top, so its belly sits on top of the legs
  legs(g, ox, gy, p.legs ?? 'stand');
  g.stamp(BODY, ox, by);
  // Tail: a little curl off the rump.
  g.set(ox + 26, by + 4, PAL.W);
  g.set(ox + 27, by + 3, PAL.W);
  g.set(ox + 27, by + 2, PAL.W);
  const hx = ox - 12 + (p.headDx ?? 0);
  const hy = by + 1 + (p.headDy ?? 0);
  g.stamp(HEAD, hx, hy);
  if (p.flash) g.tint(PAL.H);
  g.outline(PAL.K);

  const layers: Layer[] = [];
  if (p.dust) {
    const d = new Grid(BOAR_W, BOAR_H);
    for (let i = 0; i < p.dust; i++) {
      const cx = ox + 26 + i * 7;
      const cy = BOAR_GROUND - 2 - i;
      const r = 2 + i;
      for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (j * j + k * k <= r * r) d.set(cx + k, cy + j, i === 0 ? PAL.C : PAL.o);
    }
    layers.push({ grid: d, alpha: 0.9 });
  }
  layers.push({ grid: g, alpha: 1 });
  if (p.glint) star(fx, hx + 4, hy + 9, 3, PAL.B, PAL.H);
  if (p.steam) {
    for (const [sx, sy] of [[-2, 7], [-4, 6], [-5, 8], [-6, 5]]) fx.set(hx + sx, hy + sy, PAL.o);
  }
  if (p.stars != null) {
    const pos: [number, number][] = [[-2, -3], [4, -6], [10, -4], [6, -1]];
    for (let i = 0; i < 3; i++) {
      const q = pos[(i + p.stars) % 4];
      star(fx, hx + q[0], hy + q[1], 1, PAL.B, PAL.b);
    }
  }
  layers.push({ grid: fx, alpha: 1 });
  return layers;
}

// The boar's head for the battle log.
export function boarPortrait(): Grid {
  const g = new Grid(20, 20);
  g.stamp(HEAD, 2, 4);
  g.outline(PAL.K);
  return g;
}

// Overworld boar on the map, 20 x 14 frame, side view like the Shroomies, facing left unless flipped.
// frame: 0 standing, 1 and 2 trotting, 3 head down (about to charge).
export const BOAR_OW_W = 20;
export const BOAR_OW_H = 14;

const OW_BODY = ['...W.W.W.W......', '..WWWWWWWWWW....', '.WwwwwwwwwwwWW..', 'wwwwwwwwwwwwwwW.', 'wwwwwwwwwwwwwwwW', 'nwwwwwwwwwwwwwWW', '.nnnnnnwwwwwWWW.'];
const OW_HEAD = ['..WW..', '.wwwww', 'wKwwww', 'SSwwww', 'SKSHww', '.ccH..'];

export function boarOverworld(frame: number, flip = false): Grid {
  const g = new Grid(BOAR_OW_W, BOAR_OW_H);
  const base = 12;
  const bob = frame === 2 ? -1 : 0;
  const leg = (x: number, dx: number) => {
    g.set(x, base - 1, PAL.W);
    g.set(x + dx, base, PAL.K);
    g.set(x + 1 + dx, base, PAL.K);
    g.set(x + 1, base - 1, PAL.W);
  };
  if (frame === 1) [5, 8, 14, 17].forEach((x, i) => leg(x, i % 2 ? 1 : -1));
  else if (frame === 2) [4, 9, 13, 18].forEach((x, i) => leg(x, i % 2 ? -1 : 1));
  else [5, 8, 14, 17].forEach((x) => leg(x, 0));
  g.stamp(OW_BODY, 4, base - 1 - OW_BODY.length + bob);
  g.stamp(OW_HEAD, 0, base - 9 + bob + (frame === 3 ? 2 : 0));
  g.set(19, 4, PAL.W);
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
