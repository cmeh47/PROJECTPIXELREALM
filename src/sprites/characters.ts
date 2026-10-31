import { heroBattle, PARTY_LOOKS, type HeroLook } from './hero';
import { arc, Grid, PAL, seg, star } from './pixel';

export type Layer = { grid: Grid; alpha: number };

// The hero in battle (drawn in hero.ts). Frame: 56 x 40 art pixels, feet on row 37, facing right.
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
  // Mage casting: a dotted halo of light around the staff's orb (a palette key: G mana, Y frost,
  // B spark, M mend) and the one-tick flare that stands in for a smear when a spell is released.
  glow?: string;
  flare?: boolean;
  // A see-through wash of one palette color over the body (Mend's mint glow on the healed ally).
  wash?: string;
  look?: number;
  hero?: HeroLook;
};

type HeroBody = ReturnType<typeof heroBattle>;

// The hero's look: `hero` when given (the player's own), otherwise one of the demo party's.
function heroBody(p: HeroPose): HeroBody {
  return heroBattle(p.hero ?? PARTY_LOOKS[p.look ?? 0] ?? PARTY_LOOKS[0], p);
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
  if (p.wash) {
    const w = heroBody({ ...p, flash: false }).g;
    w.tint(PAL[p.wash] ?? PAL.M);
    layers.push({ grid: w, alpha: 0.55 });
  }
  const fx = new Grid(HERO_W, HERO_H);
  if (p.spark) star(fx, body.tip.x, body.tip.y, p.spark, PAL.b, PAL.H);
  if (p.clang) star(fx, body.hand.x + 3, body.hand.y - 6, 4, PAL.Y, PAL.H);
  if (p.glow) {
    // Every other dot of a ring 4 px out, so the orb reads as gathering light, not a solid ball.
    const col = PAL[p.glow] ?? PAL.G;
    for (let k = 0; k < 24; k += 2) {
      const a = (k / 24) * Math.PI * 2;
      fx.set(body.tip.x + Math.cos(a) * 4.5, body.tip.y + Math.sin(a) * 4.5, col);
    }
  }
  if (p.flare) star(fx, body.tip.x + 1, body.tip.y, 4, PAL.B, PAL.H);
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
  kind?: 'shroomie' | 'butcher';
};

// Cap colors for a mixed pack of toadstools.
export const FOE_LOOKS: Record<string, string>[] = [{}, { R: 'L', r: 'D' }, { R: 'B', r: 'b' }];

const CAP = ['.....RRRRRRRR.....', '...RRVVRRRRRRRR...', '..RRVVRRRRRVVRRR..', '.RRRRRRRRRRVVRRRR.', 'RRRRRVVRRRRRRRRRRr', 'RRRRRVVRRRRRRRRRrr', 'rrRRRRRRRRRRRRRrrr', '.rrrrrrrrrrrrrrrr.'];
const STEM = ['.CVVVVVVVVC.', 'CVVVVVVVVVVC', 'CVKVVVKVVVVC', 'CVKVVVKVVVVC', 'CSVVVVVSVVVC', 'CVVVKKVVVVVC', 'CVVVVVVVVVVC', '.CCVVVVVVCC.'];

export function foeLayers(p: FoePose): Layer[] {
  if (p.kind === 'butcher') return butcherLayers(p);
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
export function foePortrait(kind: FoePose['kind'] = 'shroomie'): Grid {
  const g = new Grid(20, 20);
  if (kind === 'butcher') {
    g.stamp(BUTCHER_BODY, 5, 13);
    g.stamp(BUTCHER_HEAD, 5, 5);
  } else {
    g.stamp(CAP, 1, 2);
    g.stamp(STEM, 4, 8);
  }
  g.outline(PAL.K);
  return g;
}

// Dialogue headshots, 40 x 40, profile-picture style: the face fills the frame and the edges crop
// the cap and shoulders. Drawn with more shading than the battle sprites. talking opens the mouth.
export const HEADSHOT = 40;

export function shroomiePortrait(look = 0, talking = false): Grid {
  const g = new Grid(HEADSHOT, HEADSHOT);
  const swap = FOE_LOOKS[look % FOE_LOOKS.length];
  const cap = PAL[swap.R ?? 'R'];
  const capDeep = PAL[swap.r ?? 'r'];
  // Face: wide and soft, running off the bottom of the frame, shaded on the right.
  for (let y = 18; y < 40; y++) {
    for (let x = 3; x < 37; x++) {
      if (y > 36 && (x < 5 || x > 34)) continue;
      g.set(x, y, x > 32 ? PAL.C : PAL.V);
    }
  }
  // Cap: a big dome, cropped by the top and the sides.
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 40; x++) {
      const dx = (x - 19.5) / 25;
      const dy = (y - 17) / 21;
      if (dx * dx + dy * dy > 1 || y > 19 + Math.round(Math.abs(dx) * 3)) continue;
      const rim = y > 17 || (dx * dx + dy * dy > 0.8 && dx > 0);
      g.set(x, y, rim ? capDeep : cap);
    }
  }
  for (let x = 0; x < 40; x++) g.set(x, 20 + Math.round(Math.abs(x - 19.5) / 6.5), x % 4 === 1 ? PAL.S : PAL.C);
  const spot = (sx: number, sy: number, r: number) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.5) g.set(sx + x, sy + y, x + y > r - 1 ? PAL.C : PAL.V);
  };
  spot(7, 9, 4);
  spot(23, 4, 3);
  spot(33, 12, 3);
  spot(16, 14, 2);
  [[3, 4], [4, 3], [5, 2], [2, 6]].forEach(([x, y]) => g.set(x, y, PAL.H));
  // Big shining eyes.
  for (const ex of [11, 24]) {
    for (let y = 25; y < 32; y++) for (let x = ex; x < ex + 4; x++) if (!((y === 25 || y === 31) && (x === ex || x === ex + 3))) g.set(x, y, PAL.K);
    g.set(ex + 1, 26, PAL.H);
    g.set(ex + 2, 26, PAL.H);
    g.set(ex + 1, 27, PAL.H);
    g.set(ex + 2, 30, PAL.P);
  }
  for (const bx of [7, 29]) for (let x = bx; x < bx + 4; x++) g.set(x, 33, PAL.R);
  if (talking) {
    [[18, 32], [19, 32], [20, 32], [21, 32], [17, 33], [22, 33], [17, 34], [22, 34], [18, 35], [19, 35], [20, 35], [21, 35]].forEach(([x, y]) => g.set(x, y, PAL.K));
    [[18, 33], [19, 33], [20, 33], [21, 33], [18, 34], [21, 34]].forEach(([x, y]) => g.set(x, y, PAL.r));
    [[19, 34], [20, 34]].forEach(([x, y]) => g.set(x, y, PAL.R));
  } else {
    [[17, 33], [18, 34], [19, 34], [20, 34], [21, 34], [22, 33]].forEach(([x, y]) => g.set(x, y, PAL.K));
  }
  g.outline(PAL.K);
  return g;
}

// The old butcher on the base. mood: 'angry' (furrowed brows, gritted teeth), 'calm' (soft brows,
// a small smile) or 'quiet' (eyes down, for his "..." lines).
export type ButcherMood = 'angry' | 'calm' | 'quiet';

export function butcherPortrait(mood: ButcherMood = 'calm', talking = false): Grid {
  const g = new Grid(HEADSHOT, HEADSHOT);
  // Shoulders: shirt and apron straps running off the bottom.
  for (let y = 33; y < 40; y++) for (let x = 1; x < 39; x++) if (Math.abs(x - 19.5) < 12 + (y - 33) * 2.5) g.set(x, y, x > 30 ? PAL.C : PAL.V);
  for (let y = 34; y < 40; y++) {
    g.set(12, y, PAL.w);
    g.set(27, y, PAL.w);
  }
  // A big bald head, lit from the top left, with a shine.
  for (let y = 2; y < 36; y++) {
    for (let x = 4; x < 36; x++) {
      const dx = (x - 19.5) / 14;
      const dy = (y - 19) / 16.5;
      if (dx * dx + dy * dy > 1) continue;
      g.set(x, y, dx * dx + dy * dy > 0.72 && dx > 0.2 ? PAL.R : PAL.S);
    }
  }
  [[11, 6], [12, 5], [13, 5], [10, 7], [10, 8], [14, 4], [15, 4]].forEach(([x, y]) => g.set(x, y, PAL.H));
  // Ears and the white tufts of hair over them.
  for (const [ex, dir] of [[5, -1], [34, 1]] as const) {
    for (let y = 18; y < 24; y++) g.set(ex + dir, y, PAL.S);
    for (let y = 12; y < 21; y++) {
      for (let k = -1; k < 3; k++) {
        if ((y === 12 || y === 20) && k !== 0) continue;
        g.set(ex + dir * k, y, (y + k) % 4 === 0 ? PAL.O : k === 2 ? PAL.O : PAL.o);
      }
    }
  }
  // Forehead wrinkles, deeper when he scowls.
  for (const [wy, w0, w1] of [[10, 14, 25], [12, 13, 26]] as const) for (let x = w0; x < w1; x++) if (mood === 'angry' || x % 5 !== 0) g.set(x, wy, PAL.R);
  // Brows.
  const brow = (x0: number, inner: number) => {
    for (let i = 0; i < 6; i++) {
      const x = x0 + i;
      const tilt = mood === 'angry' ? Math.round(((inner > x0 ? i : 5 - i) * 2) / 5) : mood === 'quiet' ? 0 : -Math.round(((inner > x0 ? i : 5 - i) * 1) / 5);
      g.set(x, 16 + tilt, PAL.o);
      g.set(x, 17 + tilt, i % 3 === 2 ? PAL.O : PAL.o);
    }
  };
  brow(10, 16);
  brow(24, 24);
  // Eyes.
  for (const ex of [12, 25]) {
    if (mood === 'quiet') {
      g.set(ex, 21, PAL.K);
      g.set(ex + 1, 21, PAL.K);
      g.set(ex + 2, 21, PAL.K);
    } else {
      for (let y = 19; y < 23; y++) for (let x = ex; x < ex + 3; x++) if (!((y === 19 || y === 22) && x !== ex + 1)) g.set(x, y, PAL.K);
      g.set(ex + 1, 20, PAL.H);
    }
  }
  // Nose and cheeks.
  for (let y = 21; y < 26; y++) for (let x = 18; x < 22; x++) if (!(y === 21 && (x === 18 || x === 21))) g.set(x, y, x === 21 || y === 25 ? PAL.R : PAL.S);
  for (const bx of [9, 27]) for (let x = bx; x < bx + 4; x++) g.set(x, 25, PAL.R);
  // A big walrus mustache in silver, outlined so it reads against his face, with the mouth under it.
  const stache = (x: number, y: number) => {
    const dx = Math.abs(x - 19.5);
    return y >= 26 && y <= 30 && dx <= 10 - (y - 26) && y - 26 <= 4 - dx / 3;
  };
  for (let y = 25; y < 32; y++) {
    for (let x = 8; x < 32; x++) {
      if (stache(x, y)) g.set(x, y, y === 30 || x > 25 || (x + y) % 5 === 0 ? PAL.O : PAL.o);
      else if (stache(x + 1, y) || stache(x - 1, y) || stache(x, y - 1)) g.set(x, y, PAL.P);
    }
  }
  for (const x of [14, 15, 16]) g.set(x, 27, PAL.H);
  if (talking) {
    for (let x = 17; x < 23; x++) {
      g.set(x, 31, PAL.K);
      g.set(x, 33, PAL.K);
    }
    g.set(16, 32, PAL.K);
    g.set(23, 32, PAL.K);
    for (let x = 17; x < 23; x++) g.set(x, 32, mood === 'angry' ? PAL.V : PAL.r);
  } else if (mood === 'angry') {
    for (let x = 16; x < 24; x++) g.set(x, 32, x % 2 ? PAL.V : PAL.K);
    g.set(15, 32, PAL.K);
    g.set(24, 32, PAL.K);
  } else {
    [[16, 31], [17, 32], [18, 32], [19, 32], [20, 32], [21, 32], [22, 32], [23, 31]].forEach(([x, y]) => g.set(x, y, PAL.K));
  }
  g.outline(PAL.K);
  return g;
}

// The butcher in battle, facing left: a stocky bald old man in an apron, swinging a cleaver. Built
// on the hero's proportions (a 10 x 9 head over a short torso and legs) so the two read as a pair.
// Uses the same pose fields as the Shroomie: ca/hx/hy aim the cleaver, tilt/capDy move the head.
const BUTCHER_HEAD = [
  '..SSSSS...',
  '.SSHHSSSS.',
  'SSHSSSSSSR',
  'SooSSSSoRR',
  'SKSSSSooOR',
  'RSSSSSoOR.',
  'ooooSSSR..',
  'OooOSSR...',
  '.O..SS....',
];
const BUTCHER_BODY = ['.YVVVVVYG', 'YYVVVVVGG', 'SYVVRVVGS', 'WWWWWWWWW', 'VVVVVVVVC', '.VVVVVVC.'];
const BUTCHER_LEG = ['PP.', 'PP.', 'PP.', 'WWW'];
const BUTCHER_LEG_CROUCH = ['PP.', 'PP.', 'WWW'];

function butcherLayers(p: FoePose): Layer[] {
  const g = new Grid(FOE_W, FOE_H);
  const bx = 36 + (p.x ?? 0);
  const gy = FOE_GROUND;
  const legH = p.crouch ? 3 : 4;
  const ty = gy - legH - 5;
  const leg = p.crouch ? BUTCHER_LEG_CROUCH : BUTCHER_LEG;
  g.stamp(leg, bx + 1, gy - legH);
  g.stamp(BUTCHER_BODY, bx - 4, ty);
  g.stamp(leg, bx - 3, gy - legH);
  const cx0 = bx - 5 + (p.tilt ?? 0);
  const cy0 = ty - 8 + (p.capDy ?? 0);
  const shx = bx - 3;
  const shy = ty + 2;
  // At rest (no aim in the pose) he holds the cleaver low in front, like the hero's sword. A raised
  // hand lifts half again as far, so the blade clears the top of his head.
  const rest = p.ca == null;
  const hx = shx + (rest ? -2 : (p.hx ?? -2));
  const hy = shy + (rest ? 3 : (p.hy ?? 0) < 0 ? Math.round((p.hy ?? 0) * 1.5) : (p.hy ?? 0));
  // Arm and cleaver go on their own outlined grid: a short handle and a broad steel blade. Reared
  // back over his shoulder it sits behind his head; anywhere else it's in front of him.
  const arm = new Grid(FOE_W, FOE_H);
  seg(arm, shx, shy, hx, hy, PAL.Y, 2);
  const a = ((rest ? -165 : p.ca!) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  seg(arm, hx, hy, hx + dx * 3, hy + dy * 3, PAL.W, 1);
  const tx = Math.round(hx + dx * 7);
  const ty2 = Math.round(hy + dy * 7);
  // The blade: spine in blue, body in sky, the cutting edge in white.
  for (let t = 3.5; t <= 9; t += 0.5) {
    for (let n = -1; n <= 2.5; n += 0.5) {
      const col = n < -0.5 ? PAL.G : n > 1.5 ? PAL.H : PAL.Y;
      arm.set(hx + dx * t - dy * n, hy + dy * t + dx * n, col);
    }
  }
  arm.set(hx, hy, PAL.S);
  arm.set(hx + 1, hy, PAL.S);
  arm.outline(PAL.K);
  const behind = dx > 0.2;
  if (!behind) g.stamp(BUTCHER_HEAD, cx0, cy0);
  arm.c.forEach((col, i) => {
    if (col) g.c[i] = col;
  });
  if (behind) g.stamp(BUTCHER_HEAD, cx0, cy0);
  if (p.flash) g.tint(PAL.H);
  g.outline(PAL.K);

  const layers: Layer[] = [];
  if (p.smear) {
    const [a0, a1, r0, r1] = p.smear;
    const f = new Grid(FOE_W, FOE_H);
    // The cleaver is shorter than a Shroomie's club, so its smear sweeps a tighter arc.
    arc(f, shx, shy, Math.round(r0 * 0.6), Math.round(r1 * 0.65), a0, a1, [PAL.H, PAL.Y, PAL.Y, PAL.G, PAL.G, PAL.G]);
    layers.push({ grid: f, alpha: 1 });
  }
  layers.push({ grid: g, alpha: 1 });
  const fx = new Grid(FOE_W, FOE_H);
  if (p.glint) star(fx, tx, ty2 - 1, 3, PAL.B, PAL.H);
  if (p.spark) star(fx, tx, ty2, p.spark, PAL.b, PAL.H);
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
