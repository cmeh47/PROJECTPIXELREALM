import { colors } from '../theme';
import { FOE_LOOKS } from './characters';
import { stampBareHead, type HeroLook } from './hero';
import { Grid, PAL, seg, star } from './pixel';

// The town south of your base: five wooden buildings (pointed, thatched and flat roofs), street
// props, the critter store's owner and her three little Shroomie helpers. Same top-down DS style
// as overworld.ts: 1-pixel ink outline, palette tokens only, feet (or footings) on the bottom rows.

const C = colors;
const box = (g: Grid, x0: number, y0: number, w: number, h: number, col: string) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) g.set(x, y, col);
};

// ---------- Building parts ----------

// A stone footing like the butcher's shack, rows y0..y1.
function footing(g: Grid, x0: number, x1: number, y0: number, y1: number) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const joint = (x + (Math.floor((y - y0) / 2) % 2) * 3) % 6 === 0;
      g.set(x, y, y === y0 ? PAL.V : joint || y === y1 ? PAL.O : PAL.o);
    }
  }
}

// Vertical planks: a seam every 4 pixels and a knot here and there.
function planks(g: Grid, x0: number, x1: number, y0: number, y1: number, body: string, seam: string) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const s = (x - x0) % 4 === 3;
      const knot = (x * 7 + y * 13) % 41 === 0;
      g.set(x, y, s || knot ? seam : body);
    }
  }
}

// Clapboard: boards lying flat, 3 pixels tall, the bottom row of each in shade.
function clapboard(g: Grid, x0: number, x1: number, y0: number, y1: number, body: string, shade: string) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g.set(x, y, (y - y0) % 3 === 2 ? shade : body);
}

// A window: glass with a cross frame, a shine in the top-left pane, and a sill.
function windowAt(g: Grid, x0: number, y0: number, w: number, h: number, glass: string, frame: string, sill: string, shine = PAL.H) {
  box(g, x0, y0, w, h, glass);
  const mx = x0 + Math.floor(w / 2);
  const my = y0 + Math.floor(h / 2);
  for (let x = x0; x < x0 + w; x++) g.set(x, my, frame);
  for (let y = y0; y < y0 + h; y++) g.set(mx, y, frame);
  g.set(x0 + 1, y0 + 1, shine);
  g.set(x0 + 2, y0 + 1, shine);
  g.set(x0 + 1, y0 + 2, shine);
  for (let x = x0 - 1; x <= x0 + w; x++) g.set(x, y0 + h, sill);
}

// A gable roof seen from the front, rows top..bot: shingle courses every third row, the left
// edge lit, a few dark shingles scattered through.
function gable(g: Grid, cx: number, top: number, bot: number, halfTop: number, halfBot: number, body: string, deep: string, lit: string) {
  for (let y = top; y <= bot; y++) {
    const half = Math.round(halfTop + ((y - top) / (bot - top)) * (halfBot - halfTop));
    for (let x = cx - half; x <= cx + half; x++) {
      const course = (y - top) % 3 === 2;
      g.set(x, y, course ? deep : x < cx - half + 2 ? lit : (x * 3 + y * 5) % 11 === 0 ? deep : body);
    }
  }
}

// A thatched roof: a soft dome of straw in layers, strands streaking down, and a ragged fringe
// along the eaves. tip bends a cone's point sideways (the witch's hut); 0 keeps it round.
function thatch(g: Grid, cx: number, top: number, bot: number, half: number, cols: { body: string; deep: string; lit: string }, cone = 0, tip = 0) {
  for (let y = top; y <= bot; y++) {
    const u = (y - top) / (bot - top);
    const hw = cone ? Math.max(1, Math.round(1 + u * (half - 1))) : Math.round(half * (0.42 + 0.58 * Math.sqrt(u)));
    const off = Math.round(tip * (1 - u) * (1 - u));
    for (let x = cx - hw + off; x <= cx + hw + off; x++) {
      const layer = (y - top) % 6 === 5 && (x + Math.floor((y - top) / 6)) % 2 === 0;
      const strand = (x * 3 + (y >> 1)) % 5 === 0;
      const lit = x < cx - hw + off + 2 && !layer;
      g.set(x, y, layer || strand ? cols.deep : lit ? cols.lit : cols.body);
    }
  }
  // The fringe: straw ends hanging past the eaves, every other strand a pixel longer.
  const hw = half;
  for (let x = cx - hw; x <= cx + hw; x++) {
    g.set(x, bot + 1, cols.deep);
    if (x % 2 === 0) g.set(x, bot + 2, cols.deep);
  }
}

// A hanging sign: a board on two short chains under (x0, y0), w x h.
function signBoard(g: Grid, x0: number, y0: number, w: number, h: number) {
  g.set(x0 + 2, y0, PAL.P);
  g.set(x0 + w - 3, y0, PAL.P);
  for (let y = y0 + 1; y < y0 + 1 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const edge = y === y0 + 1 || x === x0 ? PAL.C : y === y0 + h || x === x0 + w - 1 ? PAL.w : PAL.V;
      g.set(x, y, edge);
    }
  }
}

// ---------- The buildings ----------

export type BuildingKind = 'critters' | 'bar' | 'sheriff' | 'clinic' | 'witch';
export const BUILDING_SIZE: Record<BuildingKind, { w: number; h: number }> = {
  critters: { w: 66, h: 60 },
  bar: { w: 80, h: 70 },
  sheriff: { w: 62, h: 64 },
  clinic: { w: 66, h: 58 },
  witch: { w: 58, h: 72 },
};

// The critter store: a thatched cottage shop with a rose door, mint shutters, a round shop
// window with a little toadstool on show and a paw print on its sign.
function critterStore(): Grid {
  const { w, h } = BUILDING_SIZE.critters;
  const g = new Grid(w, h);
  footing(g, 3, w - 4, h - 7, h - 2);
  planks(g, 6, w - 7, 29, h - 8, PAL.w, PAL.W);
  for (const px of [5, w - 6]) for (let y = 27; y < h - 7; y++) g.set(px, y, PAL.W);
  // Door: rose, with a round window and a butter knob.
  box(g, 11, 36, 11, h - 8 - 36 + 1, PAL.R);
  for (let y = 36; y < h - 7; y++) {
    g.set(11, y, PAL.r);
    g.set(21, y, PAL.r);
  }
  for (let x = 12; x < 21; x++) g.set(x, 35, PAL.r);
  for (const [x, y] of [[15, 39], [16, 38], [17, 38], [18, 39], [15, 40], [18, 40], [16, 41], [17, 41]]) g.set(x, y, PAL.Y);
  g.set(16, 39, PAL.H);
  g.set(17, 39, PAL.Y);
  g.set(16, 40, PAL.Y);
  g.set(17, 40, PAL.Y);
  g.set(20, 45, PAL.b);
  // The shop window: wide, arched, a toadstool on a cushion in it.
  const wx = 30;
  const wy = 34;
  for (let y = wy; y < wy + 13; y++) {
    for (let x = wx; x < wx + 22; x++) {
      const arch = y === wy && (x < wx + 3 || x > wx + 18);
      const arch2 = y === wy + 1 && (x < wx + 1 || x > wx + 20);
      if (arch || arch2) continue;
      g.set(x, y, PAL.Y);
    }
  }
  g.set(wx + 3, wy + 2, PAL.H);
  g.set(wx + 4, wy + 2, PAL.H);
  g.set(wx + 3, wy + 3, PAL.H);
  // Cushion and toadstool.
  box(g, wx + 6, wy + 10, 10, 2, PAL.L);
  g.stamp(['..RRRR..', '.RHRRRR.', 'RRRRRHRR', 'rrrrrrrr', '..VVVV..', '..VKKV..', '..VVVV..'], wx + 7, wy + 3);
  for (let x = wx - 1; x <= wx + 22; x++) g.set(x, wy + 13, PAL.W);
  // Mint shutters either side of it.
  for (const sx of [wx - 4, wx + 23]) for (let y = wy + 1; y < wy + 13; y++) for (let x = sx; x < sx + 3; x++) g.set(x, y, y % 3 === 0 ? PAL.m : PAL.M);
  // A flower box under the window.
  box(g, wx, wy + 14, 22, 2, PAL.w);
  for (let x = wx + 1; x < wx + 21; x += 2) g.set(x, wy + 13, (x >> 1) % 3 === 0 ? PAL.B : (x >> 1) % 3 === 1 ? PAL.R : PAL.L);
  // The thatch.
  thatch(g, w >> 1, 3, 27, 32, { body: PAL.B, deep: PAL.b, lit: PAL.H });
  // A dormer peeking out of the thatch with a round window.
  for (let y = 8; y < 17; y++) for (let x = 28; x < 38; x++) if (!(y === 8 && (x === 28 || x === 37))) g.set(x, y, PAL.w);
  for (const [x, y] of [[31, 11], [32, 10], [33, 10], [34, 11], [31, 12], [34, 12], [32, 13], [33, 13]]) g.set(x, y, PAL.Y);
  g.set(32, 11, PAL.H);
  g.set(33, 11, PAL.Y);
  g.set(32, 12, PAL.Y);
  g.set(33, 12, PAL.Y);
  // The sign under the eaves: a rose paw print.
  signBoard(g, 23, 28, 12, 7);
  g.stamp(['.R.R.', 'R.R.R', '.RRR.', '.RRR.'], 26, 30);
  g.outline(PAL.K);
  return g;
}

// The bar: the biggest place in town. Two floors of plank under a sky-blue shingled gable, warm
// light in the windows, swinging butter doors and a mug on the sign.
function bar(): Grid {
  const { w, h } = BUILDING_SIZE.bar;
  const g = new Grid(w, h);
  const cx = w >> 1;
  // Chimney behind the roof.
  for (let y = 3; y < 16; y++) for (let x = 58; x < 64; x++) g.set(x, y, x === 63 || (x + y) % 4 === 0 ? PAL.O : PAL.o);
  for (let x = 57; x < 65; x++) g.set(x, 3, PAL.P);
  footing(g, 3, w - 4, h - 7, h - 2);
  clapboard(g, 6, w - 7, 30, h - 8, PAL.w, PAL.W);
  for (const px of [5, w - 6]) for (let y = 28; y < h - 7; y++) g.set(px, y, PAL.W);
  // Upstairs: three windows with warm light.
  for (const x0 of [11, cx - 5, w - 21]) windowAt(g, x0, 33, 10, 7, PAL.B, PAL.w, PAL.W, PAL.H);
  // The porch roof between the floors, on two posts.
  for (let y = 43; y < 47; y++) for (let x = 4; x < w - 4; x++) g.set(x, y, y === 43 ? PAL.C : y === 46 ? PAL.W : (x + y) % 5 === 0 ? PAL.W : PAL.w);
  for (const px of [8, w - 9]) for (let y = 47; y < h - 7; y++) {
    g.set(px, y, PAL.C);
    g.set(px + 1, y, PAL.w);
  }
  // Downstairs: two windows and the swinging doors, dark inside above and below them.
  windowAt(g, 13, 50, 12, 7, PAL.B, PAL.w, PAL.W, PAL.H);
  windowAt(g, w - 25, 50, 12, 7, PAL.B, PAL.w, PAL.W, PAL.H);
  box(g, cx - 7, 48, 14, h - 8 - 48 + 1, PAL.P);
  for (let y = 51; y < 59; y++) {
    for (let x = cx - 6; x < cx + 6; x++) {
      if (x === cx - 1 || x === cx) continue;
      g.set(x, y, (x - cx) % 3 === 0 ? PAL.b : PAL.B);
    }
  }
  // Lanterns either side of the door.
  for (const lx of [cx - 10, cx + 9]) {
    g.set(lx, 49, PAL.P);
    box(g, lx - 1, 50, 3, 3, PAL.B);
    g.set(lx, 51, PAL.H);
  }
  gable(g, cx, 8, 29, 7, 39, PAL.Y, PAL.G, PAL.H);
  // The sign in the gable: a foaming mug.
  for (let y = 16; y < 26; y++) for (let x = cx - 9; x < cx + 9; x++) g.set(x, y, y === 16 || x === cx - 9 ? PAL.C : y === 25 || x === cx + 8 ? PAL.w : PAL.V);
  g.stamp(['.VVVVV..', 'VHVVVVV.', 'BBBBBBWW', 'BbBBBbW.W', 'BbBBBbW.W', 'BbBBBbWW', 'bbbbbb..'], cx - 5, 17);
  g.outline(PAL.K);
  return g;
}

// The sheriff's office: a flat roof hidden behind a tall false front of pale clapboard, a butter
// star on the board, a barred window, a shady porch and a wanted poster by the door.
function sheriff(): Grid {
  const { w, h } = BUILDING_SIZE.sheriff;
  const g = new Grid(w, h);
  const cx = w >> 1;
  // The flat roof, seen past the shoulders of the false front.
  for (let y = 14; y < 22; y++) for (let x = 5; x < w - 5; x++) g.set(x, y, y === 14 ? PAL.O : (y - 14) % 3 === 0 ? C.barkDarkShade : C.barkDark);
  footing(g, 3, w - 4, h - 7, h - 2);
  // The false front: a stepped top, taller in the middle.
  for (let y = 4; y < h - 7; y++) {
    for (let x = 6; x < w - 6; x++) {
      const mid = x >= cx - 15 && x < cx + 15;
      const top = mid ? 4 : 16;
      if (y < top) continue;
      g.set(x, y, (y - top) % 3 === 2 ? C.barkPaleShade : C.barkPale);
    }
  }
  // Trim along the false front's edges.
  for (let x = cx - 16; x <= cx + 15; x++) g.set(x, 4, PAL.w);
  for (let x = 5; x < cx - 15; x++) g.set(x, 16, PAL.w);
  for (let x = cx + 15; x < w - 5; x++) g.set(x, 16, PAL.w);
  // The board, with a five-point star badge.
  for (let y = 7; y < 21; y++) for (let x = cx - 12; x < cx + 12; x++) g.set(x, y, y === 7 || x === cx - 12 ? PAL.C : y === 20 || x === cx + 11 ? PAL.w : PAL.V);
  g.stamp(['....B....', '....B....', '...BBb...', 'BBBBBBBbb', '.bBBHBbb.', '..BBBBb..', '..BBbBb..', '.BBb.bBb.', '.Bb...bb.'], cx - 5, 9);
  // The porch: a plank awning on posts.
  for (let y = 26; y < 30; y++) for (let x = 4; x < w - 4; x++) g.set(x, y, y === 26 ? PAL.C : y === 29 ? PAL.W : PAL.w);
  for (const px of [6, w - 8]) for (let y = 30; y < h - 7; y++) {
    g.set(px, y, PAL.w);
    g.set(px + 1, y, PAL.W);
  }
  // Shade under the awning.
  for (let x = 8; x < w - 8; x++) {
    g.set(x, 30, C.barkPaleShade);
    g.set(x, 31, C.barkPaleShade);
  }
  // Door with a little window.
  box(g, cx - 5, 37, 10, h - 8 - 37 + 1, PAL.W);
  for (let y = 37; y < h - 7; y++) g.set(cx - 5, y, PAL.w);
  box(g, cx - 3, 40, 6, 4, PAL.Y);
  g.set(cx - 2, 41, PAL.H);
  g.set(cx + 3, 47, PAL.b);
  // The barred window (the cell) on the left, a plain one on the right.
  box(g, 11, 37, 12, 9, PAL.P);
  for (let x = 12; x < 23; x += 3) for (let y = 37; y < 46; y++) g.set(x, y, PAL.o);
  for (let x = 10; x < 24; x++) {
    g.set(x, 36, PAL.O);
    g.set(x, 46, PAL.O);
  }
  windowAt(g, w - 23, 37, 12, 9, PAL.Y, PAL.w, PAL.W);
  // A wanted poster beside the door.
  box(g, cx + 7, 38, 5, 7, PAL.V);
  g.set(cx + 9, 39, PAL.K);
  g.set(cx + 8, 40, PAL.K);
  g.set(cx + 9, 40, PAL.K);
  g.set(cx + 10, 40, PAL.K);
  for (let x = cx + 8; x < cx + 11; x++) g.set(x, 43, PAL.O);
  g.outline(PAL.K);
  return g;
}

// The medical center: a whitewashed plank house with a flat roof and mint trim, a sky door, and
// a mint cross and heart on the sign over it.
function clinic(): Grid {
  const { w, h } = BUILDING_SIZE.clinic;
  const g = new Grid(w, h);
  const cx = w >> 1;
  // The flat roof from above: pale boards with a lip along the front, a vent pipe on top.
  for (let y = 6; y < 18; y++) for (let x = 4; x < w - 4; x++) g.set(x, y, y === 6 ? PAL.O : (y - 6) % 4 === 3 ? PAL.O : PAL.o);
  for (let y = 2; y < 9; y++) for (let x = 12; x < 16; x++) g.set(x, y, x === 15 ? PAL.O : PAL.o);
  for (let x = 11; x < 17; x++) g.set(x, 2, PAL.P);
  for (let x = 3; x < w - 3; x++) {
    g.set(x, 18, PAL.m);
    g.set(x, 19, PAL.M);
  }
  footing(g, 3, w - 4, h - 7, h - 2);
  planks(g, 6, w - 7, 20, h - 8, PAL.V, PAL.C);
  for (const px of [5, w - 6]) for (let y = 20; y < h - 7; y++) g.set(px, y, PAL.M);
  // The sign: a mint cross with a little rose heart.
  for (let y = 22; y < 31; y++) for (let x = cx - 10; x < cx + 10; x++) g.set(x, y, y === 22 || x === cx - 10 ? PAL.H : y === 30 || x === cx + 9 ? PAL.C : PAL.V);
  g.stamp(['..mm..', '..mm..', 'mmmmmm', 'mmmmmm', '..mm..', '..mm..'], cx - 8, 23);
  g.stamp(['RR.RR', 'RRRRR', '.RRR.', '..R..'], cx + 2, 24);
  // Door.
  box(g, cx - 5, 33, 10, h - 8 - 33 + 1, PAL.Y);
  for (let y = 33; y < h - 7; y++) {
    g.set(cx - 5, y, PAL.G);
    g.set(cx + 4, y, PAL.G);
  }
  box(g, cx - 3, 35, 6, 4, PAL.V);
  g.set(cx - 2, 36, PAL.H);
  g.set(cx + 2, 43, PAL.b);
  // Windows with mint shutters.
  for (const wx of [11, w - 23]) {
    windowAt(g, wx, 34, 12, 8, PAL.Y, PAL.V, PAL.C);
    for (const sx of [wx - 3, wx + 12]) for (let y = 34; y < 42; y++) for (let x = sx; x < sx + 3; x++) g.set(x, y, y % 3 === 0 ? PAL.m : PAL.M);
  }
  g.outline(PAL.K);
  return g;
}

// The witch's hut, tucked in the corner: dark crooked planks under a tall, mossy thatch cone
// that bends like a witch's hat, a lopsided chimney and windows glowing lavender.
function witchHut(): Grid {
  const { w, h } = BUILDING_SIZE.witch;
  const g = new Grid(w, h);
  const cx = w >> 1;
  // The chimney, leaning out of the cone's left side.
  for (let y = 18; y < 34; y++) {
    const lean = Math.round((34 - y) / 6);
    for (let x = 9 - lean; x < 14 - lean; x++) g.set(x, y, x === 13 - lean || (x + y) % 4 === 0 ? PAL.O : PAL.o);
  }
  for (let x = 5; x < 12; x++) g.set(x, 18, PAL.P);
  footing(g, 5, w - 6, h - 7, h - 2);
  // Walls lean a little: wider at the bottom.
  for (let y = 42; y < h - 7; y++) {
    const inset = Math.max(0, Math.round((h - 8 - y) / 8));
    for (let x = 8 + inset; x < w - 8 - inset + 1; x++) g.set(x, y, (x - 8) % 4 === 3 || (x * 5 + y * 3) % 37 === 0 ? C.barkDarkShade : C.barkDark);
  }
  // A round-topped door with a crescent cut in it.
  for (let y = 48; y < h - 7; y++) {
    for (let x = 13; x < 22; x++) {
      if (y === 48 && (x < 15 || x > 19)) continue;
      if (y === 49 && (x < 14 || x > 20)) continue;
      g.set(x, y, (x - 13) % 3 === 2 ? PAL.K : PAL.P);
    }
  }
  g.stamp(['.BB', 'B..', 'B..', '.BB'], 16, 51);
  g.set(20, 56, PAL.b);
  // Windows glowing lavender, panes uneven.
  windowAt(g, w - 22, 47, 10, 8, PAL.L, PAL.K, C.barkDarkShade, PAL.H);
  g.set(w - 15, 52, PAL.D);
  g.set(w - 14, 53, PAL.D);
  // Hanging bottles under the eaves.
  for (const [bx, col] of [[25, PAL.m], [29, PAL.R], [33, PAL.G]] as const) {
    g.set(bx, 43, PAL.P);
    g.set(bx, 44, col);
    g.set(bx - 1, 45, col);
    g.set(bx, 45, col);
    g.set(bx + 1, 45, col);
    g.set(bx, 46, col);
    g.set(bx - 1, 44, PAL.H);
  }
  // The cone, straw gone dark gold and furred with moss, its tip bent to the right.
  thatch(g, cx, 2, 41, 27, { body: C.leafGold, deep: C.leafGoldDeep, lit: PAL.B }, 1, 9);
  for (const [mx, my, r] of [[18, 34, 4], [37, 37, 3], [27, 26, 3], [32, 18, 2], [16, 40, 2]] as const) {
    for (let y = my - r; y <= my + r; y++) for (let x = mx - r - 1; x <= mx + r + 1; x++) {
      if ((x - mx) ** 2 / 1.6 + (y - my) ** 2 > r * r || !g.get(x, y)) continue;
      g.set(x, y, (x + y) % 3 === 0 ? PAL.F : PAL.f);
    }
  }
  // A tiny star hung off the hat's tip.
  star(g, cx + 10, 9, 1, PAL.B, PAL.H);
  g.set(cx + 10, 5, PAL.P);
  g.set(cx + 10, 6, PAL.P);
  g.set(cx + 10, 7, PAL.P);
  g.outline(PAL.K);
  return g;
}

export function buildingGrid(kind: BuildingKind): Grid {
  switch (kind) {
    case 'critters':
      return critterStore();
    case 'bar':
      return bar();
    case 'sheriff':
      return sheriff();
    case 'clinic':
      return clinic();
    case 'witch':
      return witchHut();
  }
}

// ---------- Street props ----------

export type PropKind = 'barrel' | 'crate' | 'lamp' | 'well' | 'cauldron' | 'fence' | 'post' | 'planter' | 'rail';
export const PROP_SIZE: Record<PropKind, { w: number; h: number }> = {
  barrel: { w: 12, h: 14 },
  crate: { w: 12, h: 12 },
  lamp: { w: 9, h: 28 },
  well: { w: 28, h: 30 },
  cauldron: { w: 16, h: 14 },
  fence: { w: 16, h: 10 },
  post: { w: 4, h: 10 },
  planter: { w: 14, h: 10 },
  rail: { w: 26, h: 10 },
};

export function propGrid(kind: PropKind): Grid {
  const { w, h } = PROP_SIZE[kind];
  const g = new Grid(w, h);
  if (kind === 'barrel') {
    for (let y = 2; y < 13; y++) {
      const bulge = y > 4 && y < 11 ? 1 : 0;
      for (let x = 2 - bulge; x < 10 + bulge; x++) g.set(x, y, y === 4 || y === 10 ? PAL.P : x < 3 ? PAL.S : (x - 1) % 3 === 0 ? PAL.W : PAL.w);
    }
    for (let x = 2; x < 10; x++) g.set(x, 1, PAL.W);
    for (let x = 3; x < 9; x++) g.set(x, 2, PAL.w);
  } else if (kind === 'crate') {
    for (let y = 1; y < 11; y++) for (let x = 1; x < 11; x++) g.set(x, y, y === 1 || y === 10 || x === 1 || x === 10 ? PAL.W : PAL.w);
    seg(g, 2, 2, 9, 9, PAL.W);
    for (let y = 2; y < 10; y++) g.set(2, y, PAL.S);
  } else if (kind === 'lamp') {
    for (let y = 9; y < 27; y++) {
      g.set(4, y, PAL.P);
      g.set(3, y, y > 24 ? PAL.P : PAL.O);
    }
    for (let x = 2; x < 7; x++) g.set(x, 26, PAL.P);
    g.set(2, 2, PAL.P);
    for (let x = 2; x < 7; x++) {
      g.set(x, 1, PAL.P);
      g.set(x, 8, PAL.P);
    }
    for (let y = 2; y < 8; y++) {
      g.set(1, y, PAL.P);
      g.set(7, y, PAL.P);
      for (let x = 2; x < 7; x++) g.set(x, y, y < 4 ? PAL.H : PAL.B);
    }
    g.set(4, 5, PAL.b);
  } else if (kind === 'well') {
    // A stone ring with a little shingled roof on two posts and a bucket on a rope.
    for (let y = 17; y < 28; y++) {
      for (let x = 2; x < 26; x++) {
        const top = y < 20;
        if (top && (x < 4 || x > 23) && y === 17) continue;
        const joint = (x + (Math.floor(y / 2) % 2) * 3) % 5 === 0 || y % 2 === 0;
        g.set(x, y, top ? (x > 5 && x < 22 && y > 17 ? PAL.G : PAL.o) : joint ? PAL.O : PAL.o);
      }
    }
    for (let x = 7; x < 21; x++) g.set(x, 18, PAL.Y);
    for (const px of [4, 22]) for (let y = 6; y < 20; y++) {
      g.set(px, y, PAL.w);
      g.set(px + 1, y, PAL.W);
    }
    for (let x = 5; x < 22; x++) g.set(x, 8, PAL.W);
    gable(g, 14, 1, 6, 2, 13, PAL.R, PAL.r, PAL.H);
    for (let y = 9; y < 13; y++) g.set(14, y, PAL.C);
    box(g, 12, 13, 5, 3, PAL.O);
    g.set(12, 13, PAL.o);
  } else if (kind === 'cauldron') {
    for (let y = 3; y < 12; y++) {
      const hw = y < 5 ? 6 : y < 10 ? 7 : 5;
      for (let x = 8 - hw; x < 8 + hw; x++) g.set(x, y, y === 3 ? PAL.m : y === 4 ? (x % 3 ? PAL.M : PAL.m) : x < 4 ? PAL.P : PAL.K);
    }
    for (let x = 3; x < 13; x++) g.set(x, 5, PAL.P);
    g.set(4, 12, PAL.K);
    g.set(11, 12, PAL.K);
    g.set(6, 1, PAL.M);
    g.set(10, 2, PAL.M);
    g.set(9, 0, PAL.m);
    // Embers under it.
    g.set(7, 12, PAL.r);
    g.set(8, 12, PAL.B);
    g.set(6, 13, PAL.b);
    g.set(9, 13, PAL.r);
  } else if (kind === 'fence') {
    for (const px of [1, 8]) for (let y = 1; y < 9; y++) {
      g.set(px, y, y === 1 ? PAL.C : PAL.w);
      g.set(px + 1, y, PAL.W);
    }
    for (let x = 0; x < 16; x++) {
      g.set(x, 3, PAL.w);
      g.set(x, 6, PAL.w);
      g.set(x, 4, PAL.W);
    }
  } else if (kind === 'post') {
    for (let y = 1; y < 9; y++) {
      g.set(1, y, y === 1 ? PAL.C : PAL.w);
      g.set(2, y, PAL.W);
    }
  } else if (kind === 'planter') {
    for (let y = 5; y < 9; y++) for (let x = 1; x < 13; x++) g.set(x, y, y === 5 ? PAL.C : y === 8 ? PAL.W : PAL.w);
    for (let x = 2; x < 12; x++) g.set(x, 4, PAL.F);
    for (let x = 2; x < 12; x += 2) {
      g.set(x, 3, PAL.f);
      g.set(x + 1, 2, x % 4 === 0 ? PAL.R : PAL.B);
    }
  } else if (kind === 'rail') {
    for (const px of [1, 23]) for (let y = 2; y < 9; y++) {
      g.set(px, y, PAL.w);
      g.set(px + 1, y, PAL.W);
    }
    for (let x = 1; x < 25; x++) {
      g.set(x, 2, PAL.C);
      g.set(x, 3, PAL.w);
    }
  }
  g.outline(PAL.K);
  return g;
}

// Puffs from the witch's chimney, in four frames: lavender wisps rising and swelling as they
// drift up and to the right. 14 x 18, the chimney mouth under (3, 17).
export const SMOKE_FRAMES = 4;
export function smokeGrid(frame: number): Grid {
  const g = new Grid(14, 18);
  for (let i = 0; i < 3; i++) {
    const rise = (i * 6 + frame * 1.5) % 18; // 0 at the chimney, 17 at the top
    const r = rise < 5 ? 1 : rise < 11 ? 2 : 2;
    const x = 3 + Math.round(rise * 0.4 + Math.sin(rise * 0.7));
    const y = 16 - Math.round(rise);
    const col = rise < 9 ? PAL.D : PAL.L;
    for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) if (j * j + k * k <= r * r + (r > 1 ? 1 : 0)) g.set(x + k, y + j, col);
    if (r > 1) g.set(x - 1, y - 1, PAL.H);
  }
  return g;
}

// The town sign on your base by the south gap: a post with a little house painted on its board.
// 18 x 22, the post's foot at (9, 21).
export function townSignGrid(): Grid {
  const g = new Grid(18, 22);
  for (let y = 9; y < 21; y++) {
    g.set(8, y, PAL.w);
    g.set(9, y, PAL.W);
  }
  for (let y = 2; y < 11; y++) for (let x = 1; x < 17; x++) g.set(x, y, y === 2 || x === 1 ? PAL.C : y === 10 || x === 16 ? PAL.w : PAL.V);
  // A roof and a door: a house means a town.
  g.stamp(['...rr...', '..rRRr..', '.rRRRRr.', 'rRRRRRRr', '.wwPPww.', '.wwPPww.'], 5, 3);
  // Pointing down: an arrow at the board's corner.
  g.set(13, 7, PAL.P);
  g.set(12, 8, PAL.P);
  g.set(13, 8, PAL.P);
  g.set(14, 8, PAL.P);
  g.set(13, 9, PAL.P);
  g.outline(PAL.K);
  return g;
}

// ---------- The critter store's owner ----------
// Mira: a young woman with long rose hair, a little toadstool clip in it, a mint dress and a
// vellum shop apron. 18 x 24 frame like Puul's, feet on row 21. Her head is drawn the same way as
// a hero's (fair skin, the long hairstyle in rose), so she sits right beside the party.
export const OWNER_OW_W = 18;
export const OWNER_OW_H = 24;
const OWNER_LOOK: HeroLook = { cls: 'mage', sex: 'female', skin: 0, hair: 2, hairColor: 4 };
const OWNER_BODY: Record<'down' | 'up' | 'right', string[]> = {
  down: ['...MMVVVVMM...', '..MMMVVVVMMM..', '..aMMVVVVMMa..', '...MVVRRVVM...', '..MMVVVVVVMM..', '.MMMVVVVVVMMM.', '.mMmMmMmMmMmm.'],
  up: ['...MMMMMMMM...', '..MMMMMMMMMM..', '..aMMMVVMMMa..', '...MMVVVVMM...', '..MMMMVVMMMM..', '.MMMMMMMMMMMM.', '.mMmMmMmMmMmm.'],
  right: ['....MMVVM.....', '...MMMVVVM....', '...MMMVVVVaa..', '....MVVRVV....', '...MMMVVVVM...', '..MMMMMVVVMM..', '..mMmMmMmMmm..'],
};

function mirrorGrid(g: Grid): Grid {
  const m = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) m.c[y * g.w + (g.w - 1 - x)] = g.c[y * g.w + x];
  return m;
}

// dir: which way she faces. frame 0 standing, 1 a breath (body bobs up a pixel).
export function ownerOverworld(dir: 'down' | 'up' | 'left' | 'right', frame = 0): Grid {
  const g = new Grid(OWNER_OW_W, OWNER_OW_H);
  const d = dir === 'left' ? 'right' : dir;
  const top = 2 + (frame % 2 === 1 ? -1 : 0);
  const ox = 2;
  // Rose shoes peeking under the hem.
  const legY = top + 17;
  const shoes = d === 'right' ? [ox + 4, ox + 7] : [ox + 3, ox + 9];
  for (const x of shoes) {
    g.set(x, legY, PAL.r);
    g.set(x + 1, legY, PAL.r);
    g.set(x, legY + 1, PAL.r);
    g.set(x + 1, legY + 1, PAL.r);
  }
  // Long hair behind the dress when she faces away.
  g.stamp(OWNER_BODY[d], ox, top + 10);
  stampBareHead(g, OWNER_LOOK, d, ox, top);
  // The toadstool clip over her right ear (screen left when she faces you).
  const clipX = d === 'down' ? ox + 1 : d === 'up' ? ox + 10 : ox + 3;
  g.stamp(['.rr.', 'rHrr', 'rrrr', '.VV.'], clipX, top + 1);
  g.outline(PAL.K);
  return dir === 'left' ? mirrorGrid(g) : g;
}

// Her headshot, 40 x 40: rose hair falling past her shoulders, side-swept bangs, the toadstool
// clip, big lashed eyes and a warm blush. mood: 'happy' (eyes closed in a smile) or 'calm'.
export type OwnerMood = 'calm' | 'happy';
export function ownerPortrait(mood: OwnerMood = 'calm', talking = false): Grid {
  const g = new Grid(40, 40);
  const skin = PAL.a;
  const shade = PAL.A;
  const cx = 19.5;
  // Hair behind: a long fall down both sides to the bottom of the frame, with a few darker strands.
  for (let y = 3; y < 40; y++) {
    for (let x = 2; x < 38; x++) {
      const dx = (x - cx) / 16;
      const dy = (y - 16) / 13.5;
      const head = dx * dx + dy * dy <= 1;
      const fall = y >= 16 && Math.abs(x - cx) <= 16 - Math.max(0, y - 28) * 0.35;
      if (!head && !fall) continue;
      const strand = y > 18 && Math.abs(x - cx) === 13.5;
      g.set(x, y, strand ? PAL.r : PAL.R);
    }
  }
  // Shoulders: the mint dress with the apron's vellum straps.
  for (let y = 33; y < 40; y++) {
    for (let x = 3; x < 37; x++) {
      const d = Math.abs(x - cx);
      if (d >= 8 + (y - 33) * 2) continue;
      const strap = Math.abs(d - 5.5) < 1;
      const collar = d < 3.5 && y < 35;
      g.set(x, y, collar ? skin : strap ? PAL.V : d > 6 + (y - 33) * 2 ? PAL.m : PAL.M);
    }
  }
  // Neck, shaded under the chin.
  for (let y = 29; y < 34; y++) for (let x = 17; x < 23; x++) g.set(x, y, y < 31 ? shade : skin);
  // Face: a soft oval narrowing to a small chin, a sliver of shade down the right cheek.
  for (let y = 9; y < 32; y++) {
    for (let x = 8; x < 32; x++) {
      const dx = (x - cx) / (10.5 - Math.max(0, y - 24) * 0.55);
      const dy = (y - 19) / 12.5;
      if (dx * dx + dy * dy > 1 || Math.abs(dx) > 1) continue;
      const rim = (x + 1 - cx) / (10.5 - Math.max(0, y - 24) * 0.55);
      g.set(x, y, rim > 1 ? shade : skin);
    }
  }
  // Bangs: swept from screen right to left, ending in soft points across the brow.
  for (let y = 3; y < 18; y++) {
    for (let x = 7; x < 33; x++) {
      const dx = (x - cx) / 13.5;
      const dy = (y - 15) / 12;
      if (dx * dx + dy * dy > 1) continue;
      const point = (x + 1) % 4;
      const edge = 12 + Math.round((x - 8) * 0.2) + (point === 0 ? 2 : point === 1 || point === 3 ? 1 : 0);
      if (y > edge && x > 9 && x < 30) continue;
      g.set(x, y, (x - 4) % 6 === 0 && y > 9 && y > edge - 4 ? PAL.r : PAL.R);
    }
  }
  // Side locks framing the face, down past the jaw.
  for (let y = 14; y < 31; y++) {
    const wl = y < 26 ? 2 : 3;
    for (let k = 0; k < wl; k++) {
      g.set(9 + k - (y > 26 ? 1 : 0), y, k === wl - 1 ? PAL.r : PAL.R);
      g.set(30 - k + (y > 26 ? 1 : 0), y, k === wl - 1 ? PAL.r : PAL.R);
    }
  }
  // Shine on the hair.
  [[12, 7], [13, 6], [14, 6], [15, 5], [16, 5], [24, 5], [25, 5], [26, 6]].forEach(([x, y]) => g.set(x, y, PAL.H));
  // The toadstool clip, top left.
  g.stamp(['..rrrr..', '.rHHrrr.', 'rrrrrHrr', 'rrrrrrrr', '..VVVV..', '..VVVV..'], 4, 3);
  // Eyes: lavender irises with a shine, a lid line that flicks out into a lash.
  const eyes: [number, number][] = [[12, -1], [24, 1]];
  for (const [ex, out] of eyes) {
    if (mood === 'happy') {
      g.set(ex, 22, PAL.K);
      g.set(ex + 1, 21, PAL.K);
      g.set(ex + 2, 21, PAL.K);
      g.set(ex + 3, 22, PAL.K);
    } else {
      g.stamp(['KKKK', 'KHDK', 'KDDK', 'KDLK', '.KK.'], ex, 19);
      g.set(ex + (out < 0 ? 2 : 1), 20, PAL.D);
      g.set(ex + (out < 0 ? 1 : 2), 20, PAL.H);
      g.set(ex + (out < 0 ? 1 : 2), 21, PAL.D);
    }
    const lx = out < 0 ? ex - 1 : ex + 4;
    g.set(lx, 19, PAL.K);
    g.set(lx + out, 18, PAL.K);
    for (let x = ex; x < ex + 4; x++) g.set(x, 16, PAL.r);
  }
  // Blush and a small nose.
  for (const bx of [10, 26]) {
    g.set(bx, 25, PAL.R);
    g.set(bx + 1, 25, PAL.R);
    g.set(bx + 2, 25, PAL.R);
  }
  g.set(20, 24, shade);
  // Mouth.
  if (talking) {
    g.stamp(['.KK.', 'KrrK', '.KK.'], 18, 27);
  } else if (mood === 'happy') {
    g.stamp(['K....K', '.KHHK.', '..KK..'], 17, 27);
  } else {
    [[18, 27], [19, 28], [20, 28], [21, 27]].forEach(([x, y]) => g.set(x, y, PAL.K));
  }
  g.outline(PAL.K);
  return g;
}

// ---------- Her three little helpers ----------
// Little Shroomies, smaller than the wild ones, each in a mint shop apron to match her dress.
// 12 x 13 frame, feet on row 11. look: 0 red, 1 lilac, 2 gold. hop: 0 stand, 1 squash, 2 air.
export const HELPER_OW_W = 12;
export const HELPER_OW_H = 13;
const MINI_CAP = ['...RRRR...', '.RRVVRRRR.', 'RRVVRRRVVR', 'RRRRRRRRRr', '.rrrrrrrr.'];
const MINI_STEM = ['..VKVVKV..', '..VSVVSV..', '..MMMMMM..', '..MmMMmM..'];

export function helperOverworld(hop: number, look = 0, flip = false): Grid {
  const g = new Grid(HELPER_OW_W, HELPER_OW_H);
  const sw = FOE_LOOKS[look] ?? {};
  const lift = hop === 2 ? -1 : 0;
  const squash = hop === 1 ? 1 : 0;
  const base = 11 + lift;
  if (hop !== 2) {
    g.set(4, base, PAL.P);
    g.set(7, base, PAL.P);
  }
  const stem = squash ? [MINI_STEM[0], MINI_STEM[2], MINI_STEM[3]] : MINI_STEM;
  g.stamp(stem, 1, base - stem.length);
  g.stamp(MINI_CAP, 1, base - stem.length - MINI_CAP.length + squash, sw);
  const out = flip ? mirrorGrid(g) : g;
  out.outline(PAL.K);
  return out;
}
