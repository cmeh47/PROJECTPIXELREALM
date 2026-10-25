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

// The toadstool's head for portraits and the tamed-pet card.
export function foePortrait(): Grid {
  const g = new Grid(20, 20);
  g.stamp(CAP, 1, 2);
  g.stamp(STEM, 4, 8);
  g.outline(PAL.K);
  return g;
}

export function heroPortrait(swap?: Record<string, string>): Grid {
  const g = new Grid(12, 12);
  g.stamp(HEAD, 1, 1, swap);
  g.outline(PAL.K);
  return g;
}
