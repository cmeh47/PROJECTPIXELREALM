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

// A tall leafy tree, 30 x 48 frame, trunk base centered at (15, 47). The canopy is stacked in
// tiers, lit from the top left: leaf body, leafDeep shade and tier lines, questGreen highlights.
export const TREE_W = 30;
export const TREE_H = 48;

export function treeGrid(variant: number): Grid {
  const g = new Grid(TREE_W, TREE_H);
  const v = variant % 3;
  // Trunk: bark with a shaded right side, a few marks and a root flare.
  for (let y = 26; y < 47; y++) {
    for (let x = 13; x < 17; x++) g.set(x, y, PAL.w);
    g.set(16, y, PAL.W);
  }
  [[13, 36], [14, 37], [15, 41], [14, 30]].forEach(([x, y]) => g.set(x, y, PAL.W));
  [[11, 46], [12, 46], [12, 45]].forEach(([x, y]) => g.set(x, y, PAL.w));
  [[17, 46], [18, 46], [17, 45]].forEach(([x, y]) => g.set(x, y, PAL.W));
  // Canopy tiers, top to bottom. The lowest tier ends a dozen pixels above the ground.
  const blobs: [number, number, number][] =
    v === 0
      ? [[15, 8, 7], [15, 18, 10], [7, 23, 5], [23, 23, 5], [15, 26, 8]]
      : v === 1
        ? [[15, 8, 6], [9, 15, 6], [21, 15, 6], [15, 18, 8], [15, 27, 9]]
        : [[15, 7, 6], [15, 15, 8], [15, 24, 11]];
  const inBlob = (x: number, y: number, b: [number, number, number]) => (x - b[0]) ** 2 + (y - b[1]) ** 2 <= b[2] * b[2] + b[2] * 0.6;
  const inside = (x: number, y: number) => blobs.some((b) => inBlob(x, y, b));
  for (let y = 0; y < 38; y++) {
    for (let x = 0; x < TREE_W; x++) {
      if (!inside(x, y)) continue;
      const lower = !inside(x + 1, y + 2) || !inside(x + 2, y + 1);
      const upper = !inside(x - 2, y - 2) || !inside(x - 1, y - 2);
      let col = PAL.f;
      if (lower) col = PAL.F;
      else if (upper) col = PAL.m;
      g.set(x, y, col);
    }
  }
  // Leaf texture: little "v" scallops on a staggered, jittered grid. Dark in the body, light up top-left.
  for (let row = 0, cy = 3; cy < 36; cy += 4, row++) {
    for (let cx = 2 + (row % 2) * 3; cx < TREE_W - 2; cx += 6) {
      const j = (cx * 7 + cy * 13 + v * 5) % 3;
      const x = cx + j - 1;
      const y = cy + ((cx + v) % 2);
      if (![[x, y], [x + 1, y + 1], [x + 2, y], [x + 1, y - 2], [x + 3, y + 2]].every(([a, b]) => inside(a, b)) || g.get(x, y) !== PAL.f) continue;
      const lit = x + y < 22 + v * 2;
      const c = lit ? PAL.m : PAL.F;
      g.set(x, y, c);
      g.set(x + 1, y + 1, c);
      g.set(x + 2, y, c);
    }
  }
  // Tier lines: the lower arc of each upper tier casts a dark scallop over the tier beneath it.
  for (let i = 0; i < blobs.length; i++) {
    const [bx, by, r] = blobs[i];
    for (let x = bx - r; x <= bx + r; x++) {
      const dy = Math.sqrt(Math.max(0, r * r + r * 0.6 - (x - bx) ** 2));
      const y = Math.floor(by + dy) + 1;
      if (!inside(x, y) || !inside(x, y + 1)) continue;
      if (blobs.some((b, j) => j !== i && b[1] < by && inBlob(x, y, b))) continue;
      if (blobs.slice(i + 1).some((b) => b[1] > by && inBlob(x, y, b))) {
        g.set(x, y, PAL.F);
        if (x < bx) g.set(x, y + 1, PAL.m);
      }
    }
  }
  // Leaf scallops and a glint on the lit side.
  const scallops: [number, number][] = v === 0 ? [[11, 5], [9, 14], [14, 13], [6, 21]] : v === 1 ? [[12, 5], [6, 12], [13, 16], [11, 24]] : [[12, 4], [10, 12], [9, 21]];
  for (const [x, y] of scallops) {
    g.set(x, y, PAL.m);
    g.set(x + 1, y - 1, PAL.m);
    g.set(x + 2, y - 1, PAL.M);
    g.set(x + 3, y, PAL.m);
  }
  g.set(blobs[0][0] - 3, blobs[0][1] - 4, PAL.M);
  g.set(blobs[0][0] - 2, blobs[0][1] - 4, PAL.M);
  // Two tiny blossoms so the trees read as friendly, not generic.
  const bl = v === 1 ? PAL.B : PAL.R;
  g.set(8 + v, 20, bl);
  g.set(20 - v, 11 + v, bl);
  g.outline(PAL.K);
  return g;
}

export function stumpGrid(): Grid {
  const g = new Grid(16, 11);
  g.stamp(['...SSSSSS...', '..SBBBBBBS..', '..SBSSSSBS..', '..SBBBBBBS..', '...SSSSSS...', '..wwwwWwwW..', '..wWwwwwwW..', '.wwwwwwWwWW.', 'ww.wwwwwW.WW'], 2, 1);
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
  g.stamp(['m.', 'fm', '.F'], 1, 0);
  return g;
}

// A log for the wood counter, 14 x 9.
export function logGrid(): Grid {
  const g = new Grid(14, 9);
  g.stamp(['.SSSSSSSSSBB', 'SSSSSSSSSBSSB', 'SPSSSSPSSBSBB', 'SSSSSSSSSBSSB', '.SSSSSSSSSBB'], 1, 2);
  g.outline(PAL.K);
  return g;
}

// The old butcher, 16 x 22 frame, facing you: bald with white tufts over his ears, a walrus
// mustache, a sky shirt and an apron. frame 1 bobs him down a pixel, for a slow breathing idle.
const OLD_MAN = [
  '....SSSSSS....',
  '..SSHHSSSSSS..',
  '.SSHSSSSSSSSR.',
  'oSSSSSSSSSSSRo',
  'ooSooSSSSooSoo',
  'ooSKSSSSSSKSoO',
  '.SSKSSRRSSKSS.',
  '.SoooooooooOS.',
  '..OooSSSSooO..',
  '...SSSSSSSS...',
  '..YVVVVVVVVY..',
  '.YYVVVVVVVVYG.',
  '.YGVVVVRVVVGG.',
  '.SGVVVVVVVVGS.',
  '..WWWWWWWWWW..',
  '...VVVVVVVC...',
];

export function oldManOverworld(frame: number): Grid {
  const g = new Grid(HERO_OW_W, HERO_OW_H);
  const top = 2 + (frame % 2);
  for (const x of [4, 10]) for (let y = 18; y < 20; y++) {
    g.set(x, y, PAL.P);
    g.set(x + 1, y, PAL.P);
  }
  g.stamp(OLD_MAN, 1, top);
  g.outline(PAL.K);
  return g;
}

// The butcher's hut, knocked down: a stone footing, the ragged stumps of its plank walls, one
// corner post still standing, the rose roof fallen in a slab across the front, and loose planks.
export const HUT_W = 46;
export const HUT_H = 36;

export function hutRuinsGrid(): Grid {
  const g = new Grid(HUT_W, HUT_H);
  // Stone footing, coursed like the cottage path.
  for (let y = 27; y < 33; y++) {
    for (let x = 2; x < 44; x++) {
      const joint = (x + (Math.floor((y - 27) / 2) % 2) * 3) % 6 === 0;
      g.set(x, y, y === 27 ? PAL.V : joint || y === 32 ? PAL.O : PAL.o);
    }
  }
  // What's left of the back wall: planks snapped off at ragged heights.
  const heights = [11, 14, 8, 5, 9, 3, 6, 2, 4, 7, 12];
  heights.forEach((h, i) => {
    const x0 = 5 + i * 3;
    for (let y = 27 - h; y < 27; y++) for (let x = x0; x < x0 + 3; x++) g.set(x, y, x === x0 + 2 || y === 26 ? PAL.W : PAL.w);
    g.set(x0 + (i % 2 ? 2 : 0), 26 - h, PAL.w);
  });
  // The corner post that's still standing, with a crossbeam stub.
  for (let y = 4; y < 27; y++) for (let x = 38; x < 41; x++) g.set(x, y, x === 40 ? PAL.W : PAL.w);
  for (let x = 32; x < 38; x++) for (let y = 7; y < 9; y++) g.set(x, y, y === 8 ? PAL.W : PAL.w);
  // The roof, fallen in one slab and resting tilted on the footing.
  for (let j = 0; j < 9; j++) {
    for (let i = 0; i < 22; i++) {
      const x = 3 + i + Math.floor(j / 2);
      const y = 17 + j + Math.floor(i / 5);
      g.set(x, y, j === 0 ? PAL.H : j % 3 === 0 ? PAL.r : PAL.R);
    }
  }
  // Loose planks in the grass at the front right.
  for (let i = 0; i < 10; i++) {
    g.set(28 + i, 31 + Math.floor(i / 4), PAL.w);
    g.set(28 + i, 32 + Math.floor(i / 4), PAL.W);
  }
  for (let i = 0; i < 7; i++) {
    g.set(36 + i, 34 - Math.floor(i / 3), PAL.w);
    g.set(36 + i, 35 - Math.floor(i / 3), PAL.W);
  }
  g.outline(PAL.K);
  return g;
}

// The butcher's shack, 46 x 44 frame, and the stages of building it. Its stone footing sits 8 rows
// lower in the frame than the ruins' (draw it 8 px higher to line them up). progress runs 0 to 1:
// corner posts and a log pile, then plank walls rising, roof rafters, shingles filling in from the
// eaves, and at 1 the finishing touches: a striped awning over the shop counter, sausages hanging
// in the window, a ham on the sign and smoke-stained chimney.
export const SHACK_W = 46;
export const SHACK_H = 44;

export function shackGrid(progress: number): Grid {
  const g = new Grid(SHACK_W, SHACK_H);
  const p = Math.max(0, Math.min(1, progress));
  const done = p >= 1;
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  const wallFrac = clamp((p - 0.12) / 0.4);
  const roofFrac = clamp((p - 0.6) / 0.38);
  // Stone footing.
  for (let y = 35; y < 41; y++) {
    for (let x = 2; x < 44; x++) {
      const joint = (x + (Math.floor((y - 35) / 2) % 2) * 3) % 6 === 0;
      g.set(x, y, y === 35 ? PAL.V : joint || y === 40 ? PAL.O : PAL.o);
    }
  }
  // Roof: a gable with shingle courses, filling in from the eaves upward.
  const roofTop = 6;
  const roofBot = 21;
  const roofRow = (y: number) => {
    const half = 3 + Math.round(((y - roofTop) / (roofBot - roofTop)) * 19.5);
    return { x0: 23 - half, x1: 22 + half };
  };
  if (p >= 0.5) {
    // Rafters: the gable's frame, showing until the shingles cover it.
    for (let y = roofTop; y <= roofBot; y++) {
      const { x0, x1 } = roofRow(y);
      g.set(x0, y, PAL.W);
      g.set(x1, y, PAL.W);
      if ((y - roofTop) % 5 === 4) for (let x = x0; x <= x1; x++) g.set(x, y, PAL.w);
    }
  }
  // Chimney, behind the roof on the right.
  if (roofFrac > 0.5) {
    for (let y = 2; y < 12; y++) for (let x = 33; x < 37; x++) g.set(x, y, x === 36 || (y + x) % 4 === 0 ? PAL.O : PAL.o);
    if (done) for (let x = 33; x < 37; x++) g.set(x, 2, PAL.P);
  }
  if (roofFrac > 0) {
    const fromY = Math.round(roofBot - (roofBot - roofTop) * roofFrac);
    for (let y = fromY; y <= roofBot; y++) {
      const { x0, x1 } = roofRow(y);
      for (let x = x0; x <= x1; x++) {
        const course = (y - roofTop) % 3 === 2;
        g.set(x, y, course ? PAL.r : x < x0 + 2 ? PAL.H : (x + y) % 7 === 0 ? PAL.r : PAL.R);
      }
    }
  }
  // Walls: vertical planks rising from the footing.
  const wallTop = 21;
  const wallBot = 34;
  const wallFrom = Math.round(wallBot - (wallBot - wallTop) * wallFrac);
  for (let y = wallFrom; y <= wallBot; y++) {
    for (let x = 5; x < 41; x++) g.set(x, y, (x - 5) % 4 === 3 ? PAL.W : y === wallTop ? PAL.W : PAL.w);
  }
  // Corner posts stand from the start.
  for (const px of [4, 40]) for (let y = 19; y <= wallBot; y++) g.set(px, y, PAL.W);
  if (wallFrac >= 1) {
    // Door, left of center.
    for (let y = 25; y <= wallBot; y++) for (let x = 9; x < 16; x++) g.set(x, y, x === 9 || y === 25 ? PAL.P : PAL.W);
    g.set(14, 30, PAL.b);
  }
  if (done) {
    // Shop window with a counter, and sausages strung across the top.
    for (let y = 25; y < 31; y++) for (let x = 22; x < 37; x++) g.set(x, y, PAL.P);
    for (let x = 22; x < 37; x++) {
      g.set(x, 25, PAL.W);
      if (x % 3 !== 0) g.set(x, 26, x % 3 === 1 ? PAL.R : PAL.r);
      g.set(x, 31, PAL.C);
      g.set(x, 32, PAL.W);
    }
    for (let x = 23; x < 36; x += 4) g.set(x, 31, PAL.H);
    // Striped awning with a scalloped edge.
    for (let y = 21; y < 24; y++) {
      for (let x = 20; x < 39; x++) {
        if (y === 23 && x % 2 === 1) continue;
        g.set(x, y, Math.floor((x - 20) / 2) % 2 ? PAL.H : PAL.R);
      }
    }
    // A sign in the gable with a ham on it.
    for (let y = 12; y < 18; y++) for (let x = 17; x < 29; x++) g.set(x, y, y === 12 || y === 17 || x === 17 || x === 28 ? PAL.W : PAL.C);
    g.stamp(['.RRR..', 'RRRrr.', 'RRRrrV', '.rrr.V'], 20, 13);
  }
  // A pile of logs by the right corner while there's still building to do. It shrinks as he works.
  if (!done && p < 0.75) {
    const spots: [number, number][] = [[37, 41], [42, 41], [39, 39]];
    const n = p < 0.25 ? 3 : p < 0.5 ? 2 : 1;
    for (const [lx, ly] of spots.slice(0, n)) {
      for (let x = lx; x < lx + 5; x++) {
        g.set(x, ly, PAL.w);
        g.set(x, ly + 1, PAL.W);
      }
      g.set(lx + 4, ly, PAL.S);
      g.set(lx + 4, ly + 1, PAL.B);
    }
  }
  g.outline(PAL.K);
  return g;
}

// The butcher's hammer while he rebuilds: frame 0 raised, frame 1 striking. 7 x 8, drawn by his
// right hand.
export function hammerGrid(frame: number): Grid {
  const g = new Grid(7, 8);
  g.stamp(frame % 2 ? ['HPP...', 'PPPWWW', 'PPP...'] : ['HPP', 'PPP', 'PPP', '.W.', '.W.', '.W.'], frame % 2 ? 0 : 2, frame % 2 ? 4 : 0);
  g.outline(PAL.K);
  return g;
}
