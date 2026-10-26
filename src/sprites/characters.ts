import { arc, Grid, PAL, seg, star } from './pixel';

export type Layer = { grid: Grid; alpha: number };

// Lavender Knight. Frame: 56 x 40 art pixels, feet on row 37, facing right.
export const HERO_W = 56;
export const HERO_H = 40;
export const HERO_GROUND = 37;

export type HeroPose = {
  x?: number;
  y?: number;
  lean?: number;
  crouch?: boolean;
  legs?: 'stand' | 'stride' | 'lunge' | 'air';
  hx?: number;
  hy?: number;
  sw?: number;
  cape?: number;
  flash?: boolean;
  ghosts?: [number, number][];
  smear?: [number, number, number, number, number?];
  spark?: number;
  clang?: boolean;
  dust?: boolean;
  look?: number;
};

// Palette swaps so the four party members read apart at a glance. Index 0 is the Lavender Knight.
export const HERO_LOOKS: Record<string, string>[] = [
  {},
  { L: 'M', D: 'm' },
  { L: 'B', D: 'b', Y: 'R', G: 'r' },
  { L: 'Y', D: 'G', Y: 'L', G: 'D' },
];

const HEAD = ['..RR.....', '.RRLLLL..', '.LLLLLLL.', 'LHLLLLLLD', 'LLLDSSSS.', 'LLLDSSKS.', 'LLLDSSSR.', '.DDDSSS..', '..DD.....'];
const TORSO = ['.DLLLLL.', 'DLHLLLLD', 'DLLLLLLD', 'bbbbbbbb', 'LLLLLLLD', 'LLLLLLLD'];
const LEGF = ['DD.', 'DD.', 'DD.', 'PPP'];
const LEGFS = ['DD.', 'DD.', 'PPP'];
const LEGB = ['PP.', 'PP.', 'PP.', 'PPP'];
const LEGBS = ['PP.', 'PP.', 'PPP'];

type HeroBody = { g: Grid; tip: { x: number; y: number }; sh: { x: number; y: number }; hand: { x: number; y: number }; feet: { x: number; y: number } };

function heroBody(p: HeroPose): HeroBody {
  const g = new Grid(HERO_W, HERO_H);
  const sw = HERO_LOOKS[p.look ?? 0] ?? {};
  const bx = 22 + (p.x ?? 0);
  const gy = HERO_GROUND + (p.y ?? 0);
  const lg = p.legs ?? 'stand';
  const lean = p.lean ?? 0;
  const legH = p.crouch || lg === 'air' ? 3 : 4;
  const ty = gy - legH - 5;
  const tx = bx - 4 + Math.round(lean / 2);
  let bl: number;
  let fl: number;
  let by = gy - legH;
  let fy = gy - legH;
  if (lg === 'stride') {
    bl = bx - 4;
    fl = bx + 1;
  } else if (lg === 'lunge') {
    bl = bx - 6;
    fl = bx + 2;
  } else if (lg === 'air') {
    bl = bx - 4;
    fl = bx + 1;
    by -= 1;
    fy -= 2;
  } else {
    bl = bx - 3;
    fl = bx;
  }
  g.stamp(legH === 3 ? LEGBS : LEGB, bl, by, sw);

  const sway = p.cape ?? 0;
  for (let j = 0; j < 7; j++) {
    const cw = 2 + Math.floor(j / 2);
    const cx = tx + 1 - cw - (j > 2 ? sway : 0);
    for (let i = 0; i < cw + 1; i++) {
      const ch = j === 6 || i === 0 ? 'G' : 'Y';
      g.set(cx + i, ty + j, PAL[sw[ch] ?? ch]);
    }
  }
  g.stamp(TORSO, tx, ty, sw);
  g.stamp(HEAD, bx - 4 + lean, ty - 8, sw);
  g.stamp(legH === 3 ? LEGFS : LEGF, fl, fy, sw);

  const sx = tx + 5;
  const sy = ty + 2;
  const hx = sx + (p.hx ?? 3);
  const hy = sy + (p.hy ?? 4);
  const a = ((p.sw ?? -55) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const wide = Math.abs(dx) > Math.abs(dy);
  for (let t = 2; t <= 12; t++) {
    const bxp = hx + dx * t;
    const byp = hy + dy * t;
    if (t < 12) {
      if (wide) g.set(bxp, byp + 1, PAL.G);
      else g.set(bxp + 1, byp, PAL.G);
    }
    g.set(bxp, byp, PAL.V);
  }
  g.set(hx - dx * 2, hy - dy * 2, PAL.b);
  for (let q = -2; q <= 2; q++) g.set(hx + dx * 2 + px * q * 0.8, hy + dy * 2 + py * q * 0.8, PAL.b);
  seg(g, sx, sy, hx, hy, PAL[sw.D ?? 'D'], 2);
  g.set(hx, hy, PAL.V);
  g.set(hx + 1, hy, PAL.V);
  g.set(hx, hy + 1, PAL.V);
  g.set(hx + 1, hy + 1, PAL.V);
  if (p.flash) g.tint(PAL.H);
  g.outline(PAL.K);
  return { g, tip: { x: hx + dx * 12, y: hy + dy * 12 }, sh: { x: sx, y: sy }, hand: { x: hx, y: hy }, feet: { x: bx, y: gy } };
}

export function heroLayers(p: HeroPose): Layer[] {
  const layers: Layer[] = [];
  const body = heroBody(p);
  (p.ghosts ?? []).forEach(([gx, gy], i) => {
    const ghost = heroBody({ ...p, x: gx, y: gy, flash: false }).g;
    ghost.tint(PAL.L);
    layers.push({ grid: ghost, alpha: 0.22 + 0.18 * i });
  });
  if (p.smear) {
    const [a0, a1, r0, r1, alpha] = p.smear;
    const f = new Grid(HERO_W, HERO_H);
    arc(f, body.sh.x, body.sh.y, r0, r1, a0, a1, [PAL.V, PAL.B, PAL.B, PAL.S, PAL.S, PAL.S, PAL.R]);
    layers.push({ grid: f, alpha: alpha ?? 1 });
  }
  layers.push({ grid: body.g, alpha: 1 });
  const fx = new Grid(HERO_W, HERO_H);
  if (p.spark) star(fx, body.tip.x, body.tip.y, p.spark, PAL.b, PAL.H);
  if (p.clang) star(fx, body.hand.x + 3, body.hand.y - 6, 4, PAL.Y, PAL.H);
  if (p.dust) {
    const { x, y } = body.feet;
    fx.set(x - 6, y - 1, PAL.C);
    fx.set(x - 7, y - 2, PAL.C);
    fx.set(x + 5, y - 1, PAL.C);
    fx.set(x + 6, y - 2, PAL.C);
    fx.set(x - 8, y - 1, PAL.P);
  }
  layers.push({ grid: fx, alpha: 1 });
  return layers;
}

// Mossback Toadstool. Frame: 64 x 48 art pixels, feet on row 45, facing left.
export const FOE_W = 64;
export const FOE_H = 48;
export const FOE_GROUND = 45;

export type FoePose = {
  x?: number;
  crouch?: boolean;
  tilt?: number;
  capDy?: number;
  ca?: number;
  hx?: number;
  hy?: number;
  flash?: boolean;
  glint?: boolean;
  spark?: number;
  stars?: number;
  smear?: [number, number, number, number];
  look?: number;
};

// Cap colors for a mixed pack of toadstools.
export const FOE_LOOKS: Record<string, string>[] = [{}, { R: 'L', r: 'D' }, { R: 'B', r: 'b' }];

const CAP = ['.....RRRRRRRR.....', '...RRVVRRRRRRRR...', '..RRVVRRRRRVVRRR..', '.RRRRRRRRRRVVRRRR.', 'RRRRRVVRRRRRRRRRRr', 'RRRRRVVRRRRRRRRRrr', 'rrRRRRRRRRRRRRRrrr', '.rrrrrrrrrrrrrrrr.'];
const STEM = ['.CVVVVVVVVC.', 'CVVVVVVVVVVC', 'CVKVVVKVVVVC', 'CVKVVVKVVVVC', 'CSVVVVVSVVVC', 'CVVVKKVVVVVC', 'CVVVVVVVVVVC', '.CCVVVVVVCC.'];

export function foeLayers(p: FoePose): Layer[] {
  const g = new Grid(FOE_W, FOE_H);
  const bx = 36 + (p.x ?? 0);
  const gy = FOE_GROUND;
  const cr = p.crouch ? 1 : 0;
  const sy0 = gy - 10 + cr;
  const sx0 = bx - 6;
  g.stamp(['PP', 'PP'], bx - 4, gy - 2);
  g.stamp(['PP', 'PP'], bx + 2, gy - 2);
  g.stamp(STEM, sx0, sy0);
  const shx = sx0 + 2;
  const shy = sy0 + 4;
  const hx = shx + (p.hx ?? -2);
  const hy = shy + (p.hy ?? 0);
  const a = ((p.ca ?? -120) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  seg(g, hx - dx * 2, hy - dy * 2, hx + dx * 12, hy + dy * 12, PAL.P, 3);
  const tx = Math.round(hx + dx * 13);
  const ty = Math.round(hy + dy * 13);
  for (let i = -2; i <= 1; i++) for (let j = -2; j <= 1; j++) g.set(tx + i, ty + j, PAL.P);
  g.set(tx - 1, ty - 2, PAL.M);
  g.set(tx, ty - 2, PAL.M);
  g.set(tx + 1, ty - 2, PAL.m);
  g.set(tx - 2, ty - 1, PAL.M);
  const cx0 = sx0 - 3 + (p.tilt ?? 0);
  const cy0 = sy0 - 6 + (p.capDy ?? 0);
  g.stamp(CAP, cx0, cy0, FOE_LOOKS[p.look ?? 0]);
  g.set(hx, hy, PAL.V);
  g.set(hx + 1, hy, PAL.V);
  g.set(hx, hy + 1, PAL.V);
  g.set(hx + 1, hy + 1, PAL.V);
  if (p.flash) g.tint(PAL.H);
  g.outline(PAL.K);

  const layers: Layer[] = [];
  if (p.smear) {
    const [a0, a1, r0, r1] = p.smear;
    const f = new Grid(FOE_W, FOE_H);
    arc(f, shx, shy, r0, r1, a0, a1, [PAL.V, PAL.R, PAL.R, PAL.r, PAL.r, PAL.r]);
    layers.push({ grid: f, alpha: 1 });
  }
  layers.push({ grid: g, alpha: 1 });
  const fx = new Grid(FOE_W, FOE_H);
  if (p.glint) star(fx, tx, ty - 1, 3, PAL.B, PAL.H);
  if (p.spark) star(fx, tx, ty, p.spark, PAL.b, PAL.H);
  if (p.stars != null) {
    const pos: [number, number][] = [[-9, -2], [-2, -5], [6, -3], [0, -1]];
    for (let i = 0; i < 3; i++) {
      const q = pos[(i + p.stars) % 4];
      star(fx, cx0 + 9 + q[0], cy0 + q[1], 1, PAL.B, PAL.b);
    }
  }
  layers.push({ grid: fx, alpha: 1 });
  return layers;
}

// The Shroomie's head for the battle log and the new-critter card.
export function foePortrait(): Grid {
  const g = new Grid(20, 20);
  g.stamp(CAP, 1, 2);
  g.stamp(STEM, 4, 8);
  g.outline(PAL.K);
  return g;
}

// A Shroomie's dialogue portrait, 40 x 40, drawn larger and with more shading than the battle
// sprite: a dome cap lit from the top left with vellum spots, peach gills, a round face with
// shining eyes and rosy cheeks. talking opens the mouth for the "weee" frames.
export const SHROOMIE_PORTRAIT = 40;

export function shroomiePortrait(look = 0, talking = false): Grid {
  const g = new Grid(SHROOMIE_PORTRAIT, SHROOMIE_PORTRAIT);
  const swap = FOE_LOOKS[look % FOE_LOOKS.length];
  const cap = PAL[swap.R ?? 'R'];
  const capDeep = PAL[swap.r ?? 'r'];
  // Face and stem: a soft rounded block, shaded on the right.
  for (let y = 19; y < 38; y++) {
    for (let x = 9; x < 31; x++) {
      const corner = (y > 34 && (x < 11 || x > 28)) || (y === 37 && (x < 12 || x > 27));
      if (corner) continue;
      g.set(x, y, x > 26 || y > 35 ? PAL.C : PAL.V);
    }
  }
  // Cap: a dome over the face with a curled rim.
  const cx = 20;
  const cy = 18;
  for (let y = 1; y < 24; y++) {
    for (let x = 0; x < 40; x++) {
      const dx = (x - cx + 0.5) / 19.5;
      const dy = (y - cy) / 16.5;
      if (dx * dx + dy * dy > 1 || y > 21 + Math.round(Math.abs(dx) * 2)) continue;
      const rimShade = dx * dx + dy * dy > 0.78 && (dx > 0.1 || dy > 0.1);
      g.set(x, y, y > 18 || rimShade ? capDeep : cap);
    }
  }
  // Gills peeking under the rim.
  for (let x = 6; x < 34; x++) g.set(x, 22 + Math.round(Math.abs(x - 19.5) / 9), x % 3 === 0 ? PAL.S : PAL.C);
  // Spots, each with a shaded lower-right edge, and a glint on the dome.
  const spot = (sx: number, sy: number, r: number) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.5) g.set(sx + x, sy + y, x + y > r - 1 ? PAL.C : PAL.V);
  };
  spot(11, 10, 3);
  spot(24, 6, 2);
  spot(29, 14, 3);
  spot(18, 15, 1);
  [[8, 6], [9, 5], [10, 4], [7, 8]].forEach(([x, y]) => g.set(x, y, PAL.H));
  // Eyes: tall ovals with two shines each.
  for (const ex of [14, 24]) {
    for (let y = 25; y < 30; y++) for (let x = ex; x < ex + 3; x++) if (!((y === 25 || y === 29) && x !== ex + 1)) g.set(x, y, PAL.K);
    g.set(ex + 1, 26, PAL.H);
    g.set(ex + 2, 26, PAL.H);
    g.set(ex, 28, PAL.P);
  }
  // Rosy cheeks stay rose whatever the cap color.
  for (const bx of [11, 27]) for (let x = bx; x < bx + 3; x++) g.set(x, 31, PAL.R);
  // Mouth: a little smile, or an open "o" mid-"weee".
  if (talking) {
    [[19, 31], [20, 31], [18, 32], [21, 32], [18, 33], [21, 33], [19, 34], [20, 34]].forEach(([x, y]) => g.set(x, y, PAL.K));
    [[19, 32], [20, 32], [19, 33], [20, 33]].forEach(([x, y]) => g.set(x, y, PAL.r));
  } else {
    [[18, 31], [19, 32], [20, 32], [21, 31]].forEach(([x, y]) => g.set(x, y, PAL.K));
  }
  g.outline(PAL.K);
  return g;
}

export function heroPortrait(swap?: Record<string, string>): Grid {
  const g = new Grid(12, 12);
  g.stamp(HEAD, 1, 1, swap);
  g.outline(PAL.K);
  return g;
}
