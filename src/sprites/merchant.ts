import type { Layer } from './characters';
import { arc, Grid, PAL, seg, star } from './pixel';

// Puul, the travelling merchant: darker tan skin (skinTanShade, shaded with skinDeep), short black
// hair with an ink-soft shine, a thin black mustache, a rose vest over a vellum shirt, a butter sash,
// bark trousers and a knobbed walking stick. Battle, base map, headshot and HUD face live here.

// ---------- Battle ----------
// Same 64 x 48 frame and pose fields as the butcher (feet on row 45, facing left), so he can use the
// butcher's swing frame for frame. On the heroes' side the battle draws him mirrored (allyPicture).
const W = 64;
const H = 48;
const GROUND = 45;

const HEAD = [
  '..KKKKKK..',
  '.KKPPKKKKK',
  'KKPKKKKKKK',
  'KNNNNNKKKK',
  'NKNNNNeKKK',
  'NNNNNNeKK.',
  'KKKNNNNe..',
  '.eNNNNe...',
  '..NNNN....',
];
const BODY = ['.RVVVVRRr', 'RRVVVVRrr', 'NRRVVRRrN', 'BBBBBbBBB', 'wwwwwwwwW', '.wwwwwwW.'];
const LEG = ['ww.', 'ww.', 'ww.', 'WWW'];
const LEG_CROUCH = ['ww.', 'ww.', 'WWW'];

// The stick: a bark shaft two pixels thick with a round knob at the end he strikes with. from / to
// are distances along the stick from the hand (negative is behind the hand).
function stick(g: Grid, hx: number, hy: number, dx: number, dy: number, from: number, to: number) {
  for (let t = from; t <= to; t += 0.5) {
    g.set(hx + dx * t, hy + dy * t, PAL.w);
    g.set(hx + dx * t - dy, hy + dy * t + dx, PAL.W);
  }
  const kx = hx + dx * (to + 1);
  const ky = hy + dy * (to + 1);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) g.set(kx + i, ky + j, i + j < 0 ? PAL.w : PAL.W);
  g.set(kx - 1, ky - 1, PAL.S);
}

export function merchantLayers(p: { x?: number; crouch?: boolean; tilt?: number; capDy?: number; ca?: number; hx?: number; hy?: number; flash?: boolean; glint?: boolean; spark?: number; stars?: number; smear?: [number, number, number, number]; down?: boolean }): Layer[] {
  const g = new Grid(W, H);
  const bx = 36 + (p.x ?? 0);
  const gy = GROUND;
  const legH = p.crouch ? 3 : 4;
  const ty = gy - legH - 5;
  const leg = p.crouch ? LEG_CROUCH : LEG;
  g.stamp(leg, bx + 1, gy - legH);
  g.stamp(BODY, bx - 4, ty);
  g.stamp(leg, bx - 3, gy - legH);
  const cx0 = bx - 5 + (p.tilt ?? 0);
  const cy0 = ty - 8 + (p.capDy ?? 0);
  const shx = bx - 3;
  const shy = ty + 2;
  // At rest he leans on the stick, planted in front of his feet. In a swing it follows the
  // butcher's cleaver angles, with the knob as the striking end.
  const rest = p.ca == null;
  const hx = shx + (rest ? -3 : (p.hx ?? -2));
  const hy = shy + (rest ? 3 : (p.hy ?? 0) < 0 ? Math.round((p.hy ?? 0) * 1.5) : (p.hy ?? 0));
  const arm = new Grid(W, H);
  seg(arm, shx, shy, hx, hy, PAL.V, 2);
  const a = ((rest ? 96 : p.ca!) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  let tip: { x: number; y: number };
  if (rest) {
    // Knob up by his shoulder, foot of the stick on the ground.
    stick(arm, hx, hy, -dx, -dy, -Math.max(1, gy - hy - 1), 3);
    tip = { x: Math.round(hx - dx * 4), y: Math.round(hy - dy * 4) };
  } else {
    stick(arm, hx, hy, dx, dy, -2, 10);
    tip = { x: Math.round(hx + dx * 11), y: Math.round(hy + dy * 11) };
  }
  arm.set(hx, hy, PAL.N);
  arm.set(hx + 1, hy, PAL.N);
  arm.outline(PAL.K);
  const behind = !rest && dx > 0.2;
  if (!behind) g.stamp(HEAD, cx0, cy0);
  arm.c.forEach((col, i) => {
    if (col) g.c[i] = col;
  });
  if (behind) g.stamp(HEAD, cx0, cy0);
  if (p.flash) g.tint(PAL.H);
  g.outline(PAL.K);

  const layers: Layer[] = [];
  if (p.smear) {
    const [a0, a1, r0, r1] = p.smear;
    const f = new Grid(W, H);
    // The stick is a little longer than the cleaver, so its smear sits a touch wider.
    arc(f, shx, shy, Math.round(r0 * 0.7), Math.round(r1 * 0.8), a0, a1, [PAL.H, PAL.C, PAL.C, PAL.w, PAL.w, PAL.w]);
    layers.push({ grid: f, alpha: 1 });
  }
  layers.push({ grid: g, alpha: 1 });
  const fx = new Grid(W, H);
  if (p.glint) star(fx, tip.x, tip.y - 1, 3, PAL.B, PAL.H);
  if (p.spark) star(fx, tip.x, tip.y, p.spark, PAL.b, PAL.H);
  if (p.stars != null) {
    const pos: [number, number][] = [[-5, -2], [0, -4], [5, -3], [1, -1]];
    for (let i = 0; i < 3; i++) {
      const q = pos[(i + p.stars) % 4];
      star(fx, cx0 + 5 + q[0], cy0 + q[1], 1, PAL.B, PAL.b);
    }
  }
  layers.push({ grid: fx, alpha: 1 });
  return layers;
}

// His head and shoulders for the quest log and the battle caption, 20 x 20.
export function merchantBadge(): Grid {
  const g = new Grid(20, 20);
  g.stamp(BODY, 5, 13);
  g.stamp(HEAD, 5, 5);
  g.outline(PAL.K);
  return g;
}

// A small front face for the battle HUD, 16 x 13, like heroFace.
export function merchantFace(): Grid {
  const g = new Grid(16, 13);
  g.stamp(OW_DOWN.slice(0, 10), 1, 2);
  g.outline(PAL.K);
  return g;
}

// ---------- Base map ----------
// 18 x 24 frame, feet on row 21 (the outline takes row 22). Three rows of headroom keep his hair and
// the raised stick inside the frame when he bobs up a pixel. 14-wide maps stamped at x = 2,
// the stick beside him on the right when he faces you.
export const MERCHANT_OW_W = 18;
export const MERCHANT_OW_H = 24;
const OX = 2;

const OW_DOWN = [
  '....KKKKKK....',
  '..KKKKPPKKKK..',
  '.KKKPPKKKKKKK.',
  '.KKNNNNNNNNKK.',
  '.KNNNNNNNNNNK.',
  '.eNNKNNNNKNNe.',
  '.eNNKNNNNKNNe.',
  '..NrNKKKKNrN..',
  '..NKNNNNNNKN..',
  '...NNNNNNNN...',
  '..VRRVVVVRRV..',
  '.RRRRVVVVRRRR.',
  '.NRrRVVVVRrRN.',
  '.NRrRRVVRRrRN.',
  '..BBBBbBBBBB..',
  '..wwwwwwwwww..',
  '..wwww..wwww..',
];
const OW_UP = [
  '....KKKKKK....',
  '..KKKKKKKKKK..',
  '.KKKKKKPKKKKK.',
  '.KKKKPPKKKKKK.',
  '.KKKKKKKKKKKK.',
  '.eKKKKKKKKKKe.',
  '.eKKKKKKKKKKe.',
  '..KKKKKKKKKK..',
  '...NNNNNNNN...',
  '....NNNNNN....',
  '..RRRRRRRRRR..',
  '.RRRRRRRRRRRR.',
  '.NRrRRRRRRrRN.',
  '.NRrRRRRRRrRN.',
  '..BBBBBBBBBB..',
  '..wwwwwwwwww..',
  '..wwww..wwww..',
];
const OW_RIGHT = [
  '.....KKKKK....',
  '...KKKKPPKK...',
  '..KKKKKKKPKK..',
  '..KKKKKNNNNN..',
  '..KKKKNNNNNN..',
  '..KKKeNNNKNN..',
  '..KKKeNNNKNN..',
  '...KNNNNKKKK..',
  '...NNNNNNNKN..',
  '....NNNNNNN...',
  '....VRRRVV....',
  '...RRRRRVVR...',
  '...RRrRRVVNN..',
  '...RRrRRVV....',
  '...BBBBBbB....',
  '....wwwwww....',
  '....ww..ww....',
];

function mirror(g: Grid): Grid {
  const m = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) m.c[y * g.w + (g.w - 1 - x)] = g.c[y * g.w + x];
  return m;
}

// dir: which way he faces. frame: 0 standing, 1 and 3 passing (body bobs up), 2 the other foot.
// scared: arms up and a sweat drop, for while the boars circle him.
export function merchantOverworld(dir: 'down' | 'up' | 'left' | 'right', frame = 0, scared = false): Grid {
  const g = new Grid(MERCHANT_OW_W, MERCHANT_OW_H);
  const d = dir === 'left' ? 'right' : dir;
  const bob = frame % 2 === 1 ? -1 : 0;
  const top = 3 + bob;
  const legY = top + 17;
  const boot = (x: number, h: number) => {
    for (let j = 0; j < h; j++) {
      g.set(x, legY + j, PAL.W);
      g.set(x + 1, legY + j, PAL.W);
    }
  };
  const a = frame === 2 ? 1 : 2;
  const b = frame === 0 || frame === 2 ? 2 : 1;
  if (d === 'right') {
    const stride = frame === 2 ? 1 : 0;
    boot(OX + 4 - stride, 2);
    boot(OX + 7 + stride, frame === 2 || frame === 0 ? 2 : 1);
  } else {
    boot(OX + 3, frame === 0 ? 2 : a);
    boot(OX + 9, frame === 0 ? 2 : b);
  }
  // The stick: a bark shaft from just over his hand to the ground, knob on top.
  const shaft = (x: number, y0: number) => {
    for (let y = y0 + 2; y <= legY + 1; y++) g.set(x, y, y % 3 === 0 ? PAL.W : PAL.w);
    g.set(x, y0, PAL.w);
    g.set(x + 1, y0, PAL.W);
    g.set(x, y0 + 1, PAL.W);
    g.set(x + 1, y0 + 1, PAL.W);
  };
  if (d === 'up' && !scared) shaft(OX - 1, top + 9);
  const map = d === 'down' ? OW_DOWN : d === 'up' ? OW_UP : OW_RIGHT;
  g.stamp(map, OX, top);
  if (scared) {
    // Hands thrown up by his face, the stick clutched in one.
    const hands = d === 'right' ? [[OX + 11, top + 7]] : [[OX, top + 8], [OX + 13, top + 8]];
    for (const [x, y] of hands) {
      g.set(x, y, PAL.N);
      g.set(x, y + 1, PAL.N);
      g.set(x, y + 2, PAL.R);
    }
    for (let y = top - 1; y < top + 8; y++) g.set(OX + 14, y, y % 3 === 0 ? PAL.W : PAL.w);
    g.set(OX + 1, top + 1, PAL.Y);
    g.set(OX + 1, top + 2, PAL.Y);
    g.set(OX, top + 2, PAL.H);
  } else if (d === 'down') shaft(OX + 14, top + 9);
  else if (d === 'right') shaft(OX + 11, top + 8);
  g.outline(PAL.K);
  return dir === 'left' ? mirror(g) : g;
}

// ---------- Headshot ----------
// 40 x 40, profile-picture style like the butcher's. mood: 'scared' (brows up, small pupils, mouth
// open, a sweat drop), 'calm' (a small smile) or 'happy' (eyes closed in a grin).
export type MerchantMood = 'scared' | 'calm' | 'happy';

export function merchantPortrait(mood: MerchantMood = 'calm', talking = false): Grid {
  const g = new Grid(40, 40);
  // Shoulders: the vellum shirt collar between the rose vest's lapels, running off the bottom.
  for (let y = 33; y < 40; y++) {
    for (let x = 1; x < 39; x++) {
      if (Math.abs(x - 19.5) >= 12 + (y - 33) * 2.5) continue;
      const mid = Math.abs(x - 19.5) < 4 + (y - 33) * 0.3;
      g.set(x, y, mid ? PAL.V : x > 30 || x < 9 ? PAL.r : PAL.R);
    }
  }
  // The face: an oval, lit from the top left, shaded down the right.
  for (let y = 5; y < 37; y++) {
    for (let x = 5; x < 35; x++) {
      const dx = (x - 19.5) / 13;
      const dy = (y - 20.5) / 15.5;
      const r = dx * dx + dy * dy;
      if (r > 1) continue;
      g.set(x, y, r > 0.7 && dx > 0.25 ? PAL.e : PAL.N);
    }
  }
  // Ears.
  for (const [ex, dir] of [[6, -1], [33, 1]] as const) {
    for (let y = 19; y < 25; y++) {
      g.set(ex + dir, y, PAL.N);
      g.set(ex + dir * 2, y, y > 19 && y < 24 ? PAL.e : PAL.N);
    }
  }
  // Short black hair: a full crown with a ragged fringe and sideburns, shine on the left.
  for (let y = 0; y < 19; y++) {
    for (let x = 3; x < 37; x++) {
      const dx = (x - 19.5) / 15.5;
      const dy = (y - 17) / 17;
      if (dx * dx + dy * dy > 1) continue;
      const fringe = 11 + ((x * 7) % 5 < 2 ? 1 : 0) + (x < 10 || x > 29 ? 3 : 0);
      const side = (x < 8 || x > 31) && y < 19;
      if (y > fringe && !side) continue;
      g.set(x, y, PAL.K);
    }
  }
  [[10, 4], [11, 3], [12, 3], [13, 2], [9, 5], [9, 6], [15, 2], [16, 2]].forEach(([x, y]) => g.set(x, y, PAL.P));
  [[22, 4], [23, 4], [24, 5]].forEach(([x, y]) => g.set(x, y, PAL.P));
  // Brows: up and worried when scared, level otherwise.
  const brow = (x0: number, inner: boolean) => {
    for (let i = 0; i < 6; i++) {
      const toIn = inner ? i : 5 - i;
      const lift = mood === 'scared' ? -Math.round((toIn * 2) / 5) : mood === 'happy' ? -1 : 0;
      g.set(x0 + i, 15 + lift, PAL.K);
    }
  };
  brow(10, true);
  brow(24, false);
  // Eyes.
  for (const ex of [12, 25]) {
    if (mood === 'happy') {
      g.set(ex, 21, PAL.K);
      g.set(ex + 1, 20, PAL.K);
      g.set(ex + 2, 21, PAL.K);
    } else if (mood === 'scared') {
      for (let y = 18; y < 23; y++) for (let x = ex; x < ex + 3; x++) if (!((y === 18 || y === 22) && x !== ex + 1)) g.set(x, y, PAL.H);
      g.set(ex + 1, 20, PAL.K);
      g.set(ex - 1, 20, PAL.K);
      g.set(ex + 3, 20, PAL.K);
      g.set(ex + 1, 17, PAL.K);
      g.set(ex + 1, 23, PAL.K);
    } else {
      for (let y = 19; y < 23; y++) for (let x = ex; x < ex + 3; x++) if (!((y === 19 || y === 22) && x !== ex + 1)) g.set(x, y, PAL.K);
      g.set(ex + 1, 20, PAL.H);
    }
  }
  // Nose, cheeks.
  for (let y = 21; y < 27; y++) for (let x = 18; x < 22; x++) if (!(y === 21 && (x === 18 || x === 21))) g.set(x, y, x === 21 || y === 26 ? PAL.e : PAL.N);
  for (const cx of [8, 28]) for (let x = cx; x < cx + 4; x++) g.set(x, 25, PAL.r);
  // A thin black mustache with turned-down ends.
  for (let x = 13; x < 27; x++) g.set(x, 28, PAL.K);
  for (let x = 15; x < 25; x++) g.set(x, 27, PAL.K);
  g.set(12, 29, PAL.K);
  g.set(27, 29, PAL.K);
  // Mouth.
  const open = talking || mood === 'scared';
  if (open) {
    const w = mood === 'scared' ? 3 : 2;
    for (let x = 20 - w; x < 20 + w; x++) {
      g.set(x, 30, PAL.K);
      g.set(x, 31, mood === 'scared' ? PAL.r : PAL.r);
      g.set(x, 32, PAL.K);
    }
    g.set(19 - w, 31, PAL.K);
    g.set(20 + w, 31, PAL.K);
  } else if (mood === 'happy') {
    [[16, 30], [17, 31], [18, 31], [19, 31], [20, 31], [21, 31], [22, 31], [23, 30]].forEach(([x, y]) => g.set(x, y, PAL.K));
    for (let x = 18; x < 22; x++) g.set(x, 30, PAL.H);
  } else {
    [[17, 30], [18, 31], [19, 31], [20, 31], [21, 31], [22, 30]].forEach(([x, y]) => g.set(x, y, PAL.K));
  }
  // A bead of sweat at the temple when scared.
  if (mood === 'scared') {
    [[33, 8], [33, 9], [32, 10], [33, 10], [34, 10], [32, 11], [33, 11], [34, 11]].forEach(([x, y]) => g.set(x, y, PAL.Y));
    g.set(32, 10, PAL.H);
  }
  g.outline(PAL.K);
  return g;
}

// ---------- His stand on the base ----------
// 44 x 38 frame, feet line on row 36. progress 0: the plot marked out with four stakes, a string
// between them and a sign; 1: the finished stand, a plank counter under a butter-and-rose striped
// awning, crates of goods and a coin on the board.
export const STAND_W = 44;
export const STAND_H = 38;

export function standGrid(done: boolean): Grid {
  const g = new Grid(STAND_W, STAND_H);
  if (!done) {
    const stakes: [number, number][] = [[5, 34], [38, 34], [8, 26], [35, 26]];
    for (const [x, y] of stakes) for (let k = 0; k < 5; k++) g.set(x, y - k, k === 4 ? PAL.C : PAL.w);
    // The string, sagging a pixel between stakes.
    seg(g, 5, 31, 38, 31, PAL.V);
    seg(g, 8, 23, 35, 23, PAL.V);
    seg(g, 5, 31, 8, 23, PAL.V);
    seg(g, 38, 31, 35, 23, PAL.V);
    // A little sign on a post with a coin painted on it.
    for (let y = 14; y < 34; y++) g.set(21, y, y % 3 ? PAL.w : PAL.W);
    for (let y = 8; y < 16; y++) for (let x = 15; x < 28; x++) g.set(x, y, y === 8 || x === 15 ? PAL.C : y === 15 || x === 27 ? PAL.w : PAL.V);
    for (let y = 10; y < 14; y++) for (let x = 19; x < 24; x++) if (!((y === 10 || y === 13) && (x === 19 || x === 23))) g.set(x, y, x === 23 || y === 13 ? PAL.b : PAL.B);
    g.outline(PAL.K);
    return g;
  }
  // Back posts and the awning.
  for (let y = 6; y < 30; y++) {
    g.set(4, y, PAL.w);
    g.set(5, y, PAL.W);
    g.set(38, y, PAL.w);
    g.set(39, y, PAL.W);
  }
  for (let y = 2; y < 11; y++) {
    const inset = Math.max(0, 3 - y);
    for (let x = 1 + inset; x < 43 - inset; x++) {
      const stripe = Math.floor((x - 1) / 5) % 2 === 0;
      g.set(x, y, y === 10 ? (stripe ? PAL.b : PAL.r) : stripe ? PAL.B : PAL.R);
    }
  }
  // A scalloped edge under the awning.
  for (let x = 2; x < 42; x++) if (x % 5 !== 0) g.set(x, 11, Math.floor((x - 1) / 5) % 2 === 0 ? PAL.b : PAL.r);
  // Goods on the back shelf: a jar, a bolt of cloth, a pot, a sack.
  for (let y = 16; y < 21; y++) for (let x = 8; x < 12; x++) g.set(x, y, x === 11 ? PAL.G : PAL.Y);
  for (let x = 8; x < 12; x++) g.set(x, 15, PAL.w);
  for (let y = 15; y < 21; y++) for (let x = 14; x < 21; x++) g.set(x, y, (x + y) % 3 === 0 ? PAL.D : PAL.L);
  for (let y = 17; y < 21; y++) for (let x = 23; x < 29; x++) g.set(x, y, y === 17 ? PAL.o : x === 28 ? PAL.O : PAL.o);
  for (let y = 14; y < 21; y++) for (let x = 31; x < 36; x++) if (!(y === 14 && (x === 31 || x === 35))) g.set(x, y, x === 35 ? PAL.W : PAL.C);
  for (let x = 31; x < 36; x++) g.set(x, 15, PAL.w);
  for (let y = 12; y < 22; y++) for (let x = 6; x < 38; x++) if (!g.get(x, y)) g.set(x, y, PAL.W);
  // The counter: planks with a lighter top edge.
  for (let y = 21; y < 33; y++) {
    for (let x = 3; x < 41; x++) {
      const joint = (x - 3) % 8 === 7;
      g.set(x, y, y === 21 ? PAL.C : y === 22 ? PAL.w : joint || y === 32 ? PAL.W : PAL.w);
    }
  }
  // The coin board on the front of the counter.
  for (let y = 24; y < 31; y++) for (let x = 16; x < 28; x++) g.set(x, y, y === 24 || x === 16 ? PAL.C : y === 30 || x === 27 ? PAL.w : PAL.V);
  for (let y = 25; y < 30; y++) for (let x = 19; x < 25; x++) if (!((y === 25 || y === 29) && (x === 19 || x === 24))) g.set(x, y, x === 24 || y === 29 ? PAL.b : PAL.B);
  g.set(20, 26, PAL.H);
  // A crate of apples beside the counter.
  for (let y = 29; y < 36; y++) for (let x = 34; x < 43; x++) g.set(x, y, y === 29 || (x + y) % 4 === 0 ? PAL.W : PAL.w);
  for (const [x, y] of [[35, 28], [37, 27], [39, 28], [41, 27], [36, 26]]) {
    g.set(x, y, PAL.r);
    g.set(x + 1, y, PAL.r);
    g.set(x, y - 1, PAL.R);
  }
  g.outline(PAL.K);
  return g;
}
