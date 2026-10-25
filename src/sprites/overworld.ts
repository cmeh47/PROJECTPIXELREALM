import { HERO_LOOKS, FOE_LOOKS } from './characters';
import { Grid, PAL } from './pixel';

// Top-down sprites for the base map, DS style: chibi proportions, a 1-pixel ink outline,
// palette tokens only. Feet sit on the bottom row of each frame.

export type Dir = 'down' | 'up' | 'left' | 'right';

// Hero, 16 x 22 frame (14 x 20 body plus the outline). Legs are added per walk frame.
export const HERO_OW_W = 16;
export const HERO_OW_H = 22;

const HERO_DOWN = [
  '....LLLLLL....',
  '..LLHHLLLLLL..',
  '.LLHLLLLLLLLD.',
  '.LLLLLLLLLLLD.',
  '.LDRRRRRRRRDD.',
  '.DRSSSSSSSSRD.',
  '.DSSKSSSSKSSD.',
  '.DSSKSSSSKSSD.',
  '..SrSSSSSSrS..',
  '...SSSSSSSS...',
  '..YDDDbbDDDY..',
  '.YYDLLDDLLDYY.',
  '.YGDDDDDDDDGY.',
  '.YGSDbbbbDSGY.',
  '..GDDDDDDDDG..',
  '...DLDDDDLD...',
];

const HERO_UP = [
  '....LLLLLL....',
  '..LLHHLLLLLL..',
  '.LLHLLLLLLLLD.',
  '.LLLLLLLLLLLD.',
  '.LLLLLLLLLLLD.',
  '.DLLLLLLLLLDD.',
  '.DRRRRRRRRRRD.',
  '.DRRRRRRRRRRD.',
  '..RRRRRRRRRR..',
  '...RRRRRRRR...',
  '..YYYYYYYYYY..',
  '.YYHYYYYYYYYY.',
  '.SGYYYYYYYYGS.',
  '.YGYYYYYYYYGY.',
  '..GGYYYYYYGG..',
  '...GGGGGGGG...',
];

const HERO_RIGHT = [
  '....LLLLLL....',
  '...LLHHLLLLL..',
  '..LHLLLLLLLLD.',
  '..LLLLLLLLLLD.',
  '..RRRRRRLDDDD.',
  '..RRRSSSSSSDD.',
  '..RRSSSSSKSD..',
  '..RRSSSSSKSS..',
  '...RSSSSSSrS..',
  '....SSSSSSS...',
  '...YYDDDDb....',
  '..YYDDLLDD....',
  '..YGDDDDDSS...',
  '..YGDbbbbD....',
  '...GDDDDDD....',
  '....DLDDLD....',
];

function mirror(map: string[]) {
  return map.map((r) => r.split('').reverse().join(''));
}

// frame 0 = standing, 1 and 3 = passing (body bobs up), 2 = the other foot forward.
export function heroOverworld(dir: Dir, frame: number, look = 0): Grid {
  const g = new Grid(HERO_OW_W, HERO_OW_H);
  const sw = HERO_LOOKS[look] ?? {};
  const bob = frame % 2 === 1 ? -1 : 0;
  const top = 2 + bob;
  const legY = top + 16;
  const boot = (x: number, y: number, h: number) => {
    for (let j = 0; j < h; j++) {
      g.set(x, y + j, PAL.P);
      g.set(x + 1, y + j, PAL.P);
    }
  };
  // Legs: on a step, one foot is planted (2 rows) and the other is lifted (1 row).
  const a = frame === 2 ? 1 : 2;
  const b = frame === 0 || frame === 2 ? 2 : 1;
  if (dir === 'down' || dir === 'up') {
    boot(4, legY, frame === 0 ? 2 : a);
    boot(10, legY, frame === 0 ? 2 : b);
  } else {
    const fwd = dir === 'right' ? 1 : -1;
    const stride = frame === 0 ? 0 : frame === 2 ? 1 : 0;
    boot(dir === 'right' ? 5 - stride : 9 + stride, legY, 2);
    boot(dir === 'right' ? 8 + stride * fwd : 6 - stride, legY, frame === 2 ? 2 : 1 + (frame === 0 ? 1 : 0));
  }
  const map = dir === 'down' ? HERO_DOWN : dir === 'up' ? HERO_UP : dir === 'right' ? HERO_RIGHT : mirror(HERO_RIGHT);
  g.stamp(map, 1, top, sw);
  g.outline(PAL.K);
  return g;
}

// Wandering toadstool, 16 x 16 frame.
export const TOAD_OW_W = 16;
export const TOAD_OW_H = 16;

const TOAD_CAP = ['....RRRRRR....', '..RRVVRRRRRR..', '.RRVVRRRRVVRR.', 'RRRRRRRRRVVRRr', 'RRRVVRRRRRRRrr', 'rrRRRRRRRRRrrr', '.rrrrrrrrrrrr.'];
const TOAD_STEM = ['...CVVVVVVC...', '...VVKVVKVV...', '...VVKVVKVV...', '...VSVVVVSV...', '...CVVVVVVC...'];

// hop 0 = standing, 1 = squashed before a hop, 2 = in the air.
export function toadOverworld(hop: number, look = 0, flip = false): Grid {
  const g = new Grid(TOAD_OW_W, TOAD_OW_H);
  const sw = FOE_LOOKS[look] ?? {};
  const lift = hop === 2 ? -1 : 0;
  const squash = hop === 1 ? 1 : 0;
  const base = 14 + lift;
  if (hop !== 2) {
    g.set(5, base, PAL.P);
    g.set(6, base, PAL.P);
    g.set(9, base, PAL.P);
    g.set(10, base, PAL.P);
  }
  const stem = squash ? [TOAD_STEM[0], TOAD_STEM[1], TOAD_STEM[3], TOAD_STEM[4]] : TOAD_STEM;
  g.stamp(stem, 1, base - stem.length, sw);
  g.stamp(TOAD_CAP, 1, base - stem.length - 6 + squash, sw);
  if (flip) {
    const c = g.c.slice();
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) g.c[y * g.w + x] = c[y * g.w + (g.w - 1 - x)];
  }
  g.outline(PAL.K);
  return g;
}

// Birch-like pastel tree, 28 x 34 frame, trunk base centered at (14, 33).
export const TREE_W = 28;
export const TREE_H = 34;

function disc(g: Grid, cx: number, cy: number, r: number, col: string) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) g.set(cx + x, cy + y, col);
}

export function treeGrid(variant: number): Grid {
  const g = new Grid(TREE_W, TREE_H);
  // Trunk: pale birch bark with plum marks and a peach shaded side.
  for (let y = 19; y < 33; y++) {
    for (let x = 12; x < 16; x++) g.set(x, y, PAL.C);
    g.set(15, y, PAL.S);
  }
  [[12, 22], [13, 22], [14, 26], [15, 26], [12, 29], [13, 29]].forEach(([x, y]) => g.set(x, y, PAL.P));
  g.set(11, 32, PAL.C);
  g.set(10, 32, PAL.C);
  g.set(16, 32, PAL.S);
  g.set(17, 32, PAL.S);
  // Canopy: a cloud of discs, lit from the top left. Lavender shade on the lower right rim,
  // mint leaf scallops on the lit side.
  const v = variant % 3;
  const blobs: [number, number, number][] =
    v === 0
      ? [[14, 12, 9], [7, 15, 5], [21, 15, 5], [14, 6, 6]]
      : v === 1
        ? [[14, 12, 8], [9, 8, 6], [19, 8, 6], [14, 18, 5], [6, 14, 4], [22, 14, 4]]
        : [[14, 11, 9], [8, 17, 5], [20, 17, 5]];
  const inside = (x: number, y: number) => blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 <= r * r + r * 0.6);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < TREE_W; x++) {
      if (!inside(x, y)) continue;
      const lower = !inside(x + 1, y + 2) || !inside(x + 2, y + 1);
      const upper = !inside(x - 2, y - 2);
      let col = PAL.m;
      if (lower) col = PAL.D;
      else if (upper) col = PAL.M;
      else if ((x * 3 + y * 5 + v) % 11 === 0 && y < 15) col = PAL.M;
      g.set(x, y, col);
    }
  }
  // Leaf scallops: little arcs of light on the canopy.
  const scallops: [number, number][] = v === 0 ? [[10, 9], [16, 7], [12, 14], [18, 12]] : v === 1 ? [[8, 7], [16, 6], [12, 12], [18, 13]] : [[10, 8], [16, 9], [12, 14]];
  for (const [x, y] of scallops) {
    g.set(x, y, PAL.M);
    g.set(x + 1, y - 1, PAL.M);
    g.set(x + 2, y - 1, PAL.M);
    g.set(x + 3, y, PAL.M);
  }
  g.set(blobs[0][0] - 4, blobs[0][1] - 5, PAL.H);
  g.set(blobs[0][0] - 3, blobs[0][1] - 5, PAL.H);
  // Two tiny blossoms so the trees read as friendly, not generic.
  const bl = v === 1 ? PAL.B : PAL.R;
  g.set(7 + v, 14, bl);
  g.set(19 - v, 9 + v, bl);
  g.outline(PAL.K);
  return g;
}

export function stumpGrid(): Grid {
  const g = new Grid(16, 11);
  g.stamp(['...BBBBBB...', '..BSSSSSSB..', '..BSBBBBSB..', '..BSSSSSSB..', '...BBBBBB...', '..CCCCPCCS..', '..CPCCCCCS..', '.CCCCCCPCSS.', 'CC.CCCCCS.SS'], 2, 1);
  g.outline(PAL.K);
  return g;
}

// Your home: a little cottage, 56 x 52 frame. The door is centered at the bottom.
export const HOUSE_W = 56;
export const HOUSE_H = 52;

export function houseGrid(look = 0): Grid {
  const g = new Grid(HOUSE_W, HOUSE_H);
  const roof = look === 1 ? PAL.M : look === 2 ? PAL.B : look === 3 ? PAL.Y : PAL.L;
  const roofDeep = look === 1 ? PAL.m : look === 2 ? PAL.b : look === 3 ? PAL.G : PAL.D;
  // Walls
  for (let y = 24; y < 50; y++) for (let x = 6; x < 50; x++) g.set(x, y, PAL.V);
  for (let x = 6; x < 50; x++) {
    g.set(x, 24, PAL.C);
    g.set(x, 49, PAL.C);
  }
  for (let y = 24; y < 50; y++) {
    g.set(6, y, PAL.C);
    g.set(49, y, PAL.C);
    g.set(27, y, PAL.C);
    g.set(28, y, PAL.C);
  }
  // Roof
  for (let j = 0; j < 22; j++) {
    const half = 8 + j;
    for (let x = 28 - half; x < 28 + half; x++) g.set(x, 4 + j, j % 4 === 3 ? roofDeep : roof);
  }
  for (let j = 0; j < 22; j += 2) g.set(28 - 8 - j + 2, 4 + j, PAL.H);
  // Chimney
  for (let y = 2; y < 12; y++) for (let x = 38; x < 43; x++) g.set(x, y, PAL.C);
  for (let x = 38; x < 43; x++) g.set(x, 2, PAL.P);
  // Windows
  const win = (x0: number) => {
    for (let y = 31; y < 39; y++) for (let x = x0; x < x0 + 8; x++) g.set(x, y, PAL.Y);
    for (let x = x0; x < x0 + 8; x++) g.set(x, 35, PAL.V);
    for (let y = 31; y < 39; y++) g.set(x0 + 4, y, PAL.V);
    g.set(x0 + 1, 32, PAL.H);
    g.set(x0 + 2, 32, PAL.H);
    for (let x = x0 - 1; x < x0 + 9; x++) g.set(x, 39, PAL.R);
  };
  win(11);
  win(37);
  // Door
  for (let y = 36; y < 50; y++) for (let x = 24; x < 32; x++) g.set(x, y, PAL.P);
  for (let x = 25; x < 31; x++) g.set(x, 35, PAL.P);
  g.set(30, 43, PAL.b);
  // Flower boxes under the windows
  [12, 14, 16, 38, 40, 42].forEach((x, i) => g.set(x, 40, i % 2 ? PAL.B : PAL.R));
  g.outline(PAL.K);
  return g;
}

// The "!" alert bubble, 11 x 14.
export function bubbleGrid(): Grid {
  const g = new Grid(11, 14);
  g.stamp(['.HHHHHHH.', 'HHHHKHHHH', 'HHHHKHHHH', 'HHHHKHHHH', 'HHHHKHHHH', 'HHHHHHHHH', 'HHHHKHHHH', '.HHHHHHH.', '...HHH...', '....H....'], 1, 1);
  g.outline(PAL.K);
  return g;
}

// A heart floating over a tamed pet, 9 x 8.
export function heartGrid(): Grid {
  const g = new Grid(9, 8);
  g.stamp(['.RR.RR.', 'RHRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], 1, 1);
  g.outline(PAL.K);
  return g;
}

// A falling leaf and a wood chip, for chopping.
export function leafGrid(): Grid {
  const g = new Grid(4, 4);
  g.stamp(['M.', 'mM', '.m'], 1, 0);
  return g;
}

// A log for the wood counter, 14 x 9.
export function logGrid(): Grid {
  const g = new Grid(14, 9);
  g.stamp(['.SSSSSSSSSBB', 'SSSSSSSSSBSSB', 'SPSSSSPSSBSBB', 'SSSSSSSSSBSSB', '.SSSSSSSSSBB'], 1, 2);
  g.outline(PAL.K);
  return g;
}
