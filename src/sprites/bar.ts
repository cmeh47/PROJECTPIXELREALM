import { colors } from '../theme';
import { lookSwap, stampBareHead, type HeroLook } from './hero';
import { Grid, PAL, seg, star } from './pixel';

// Inside the bar: the room, its counter and tables, the fire, Barley the bartender, six regulars
// drinking in pairs and the hooded stranger in the corner. Out back: the log pile and chopping block
// for Barley's firewood job. Same DS style as the rest of the overworld: 1-pixel ink outlines,
// palette tokens only, feet on the bottom rows.

const C = colors;
const box = (g: Grid, x0: number, y0: number, w: number, h: number, col: string) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) g.set(x, y, col);
};
function mirrorGrid(g: Grid): Grid {
  const m = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) m.c[y * g.w + (g.w - 1 - x)] = g.c[y * g.w + x];
  return m;
}

// ---------- The room ----------
// 192 x 240 art pixels: the back wall (shelves of bottles, a painting, the fireplace), plank floor,
// a rose runner from the door to the counter, and a dim bottom-left corner for the stranger. The
// door is the gap in the bottom wall.
export const BAR_W = 192;
export const BAR_H = 240;
export const BACK_WALL = 56;
export const BAR_DOOR = { x0: 84, x1: 108 };
export const FIRE = { x: 158, y: 34 }; // the hearth's opening, top-left
export const DIM = { x: 0, y: 176, w: 58, h: 64 }; // the stranger's corner

export function roomGrid(): Grid {
  const g = new Grid(BAR_W, BAR_H);
  // Floor: boards 6 px wide with staggered joints.
  for (let y = BACK_WALL; y < BAR_H; y++) {
    const row = Math.floor((y - BACK_WALL) / 6);
    for (let x = 0; x < BAR_W; x++) {
      const seam = (y - BACK_WALL) % 6 === 5;
      const joint = (x + row * 13) % 36 === 0;
      g.set(x, y, seam || joint ? PAL.W : PAL.w);
    }
  }
  // The stranger's corner: darker boards in a pool round the bottom-left corner, dithered at its edge.
  for (let y = DIM.y; y < BAR_H; y++) {
    for (let x = 0; x < DIM.x + DIM.w; x++) {
      const d = Math.hypot(x / DIM.w, (BAR_H - y) / DIM.h);
      if (d > 1 || (d > 0.85 && (x + y) % 2 === 0)) continue;
      const seam = (y - BACK_WALL) % 6 === 5;
      g.set(x, y, seam ? C.barkDarkShade : C.barkDark);
    }
  }
  // The runner from the door to the counter.
  for (let y = 84; y < BAR_H - 4; y++) {
    for (let x = 85; x < 107; x++) {
      const edge = x === 85 || x === 106;
      const inner = x === 87 || x === 104;
      g.set(x, y, edge ? PAL.r : inner ? PAL.V : (x + y) % 8 === 0 ? PAL.r : PAL.R);
    }
  }
  for (let x = 85; x < 107; x += 2) g.set(x, 83, PAL.V);
  // Back wall: dark vertical boards over a wainscot.
  for (let y = 0; y < BACK_WALL; y++) {
    for (let x = 0; x < BAR_W; x++) {
      if (y >= 40) g.set(x, y, y === 40 ? PAL.C : y === BACK_WALL - 1 ? PAL.K : (x % 8 === 7 ? PAL.W : PAL.w));
      else g.set(x, y, x % 6 === 5 ? C.barkDarkShade : C.barkDark);
    }
  }
  // Shelves behind the counter, lined with bottles and mugs.
  const bottle = (x: number, y: number, col: string, deep: string) => {
    g.set(x + 1, y - 7, PAL.w);
    g.set(x + 1, y - 6, col);
    for (let j = -5; j < 0; j++) for (let i = 0; i < 3; i++) g.set(x + i, y + j, i === 2 ? deep : col);
    g.set(x, y - 4, PAL.H);
  };
  const mug = (x: number, y: number) => {
    box(g, x, y - 4, 3, 4, PAL.B);
    g.set(x + 3, y - 3, PAL.b);
    g.set(x, y - 4, PAL.V);
    g.set(x + 1, y - 4, PAL.V);
  };
  for (const sy of [18, 34]) {
    for (let x = 48; x < 144; x++) {
      g.set(x, sy, PAL.C);
      g.set(x, sy + 1, PAL.W);
    }
  }
  const cols: [string, string][] = [[PAL.G, PAL.Y], [PAL.m, PAL.F], [PAL.R, PAL.r], [PAL.L, PAL.D], [PAL.b, PAL.W]];
  for (let k = 0; k < 11; k++) {
    const x = 51 + k * 8;
    const [a, b] = cols[(k * 3) % cols.length];
    if (k === 4 || k === 8) mug(x, 18);
    else bottle(x, 18, a, b);
    const [c, d] = cols[(k * 2 + 1) % cols.length];
    if (k % 3 === 1) mug(x + 2, 34);
    else bottle(x + 1, 34, c, d);
  }
  // A painting of a boar on the hill, in a butter frame, top left.
  for (let y = 10; y < 32; y++) for (let x = 10; x < 38; x++) g.set(x, y, y === 10 || y === 31 || x === 10 || x === 37 ? PAL.b : y < 22 ? PAL.Y : PAL.m);
  for (let x = 11; x < 37; x++) g.set(x, 22 + Math.round(Math.sin(x / 4) * 1.5), PAL.f);
  g.stamp(['..ww...', '.wwwww.', 'wwwwwwK', '.W..W..'], 20, 22);
  // Fireplace on the right: stone, a mantel, a dark opening.
  for (let y = 4; y < BACK_WALL; y++) {
    for (let x = 150; x < 186; x++) {
      const joint = (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0 || y % 4 === 0;
      g.set(x, y, joint ? PAL.O : PAL.o);
    }
  }
  for (let x = 147; x < 189; x++) {
    g.set(x, 26, PAL.C);
    g.set(x, 27, PAL.w);
    g.set(x, 28, PAL.W);
  }
  for (let y = FIRE.y; y < BACK_WALL; y++) for (let x = FIRE.x; x < FIRE.x + 20; x++) {
    if (y === FIRE.y && (x === FIRE.x || x === FIRE.x + 19)) continue;
    g.set(x, y, y > BACK_WALL - 4 ? PAL.P : PAL.K);
  }
  // Two candlesticks on the mantel.
  for (const cx of [154, 181]) {
    g.set(cx, 25, PAL.V);
    g.set(cx, 24, PAL.V);
    g.set(cx, 23, PAL.B);
    g.set(cx, 22, PAL.H);
  }
  // Side walls and the front wall, with the door gap.
  for (let y = 0; y < BAR_H; y++) {
    for (const x of [0, 1, 2, BAR_W - 3, BAR_W - 2, BAR_W - 1]) g.set(x, y, x === 2 || x === BAR_W - 3 ? PAL.W : C.barkDarkShade);
  }
  for (let y = BAR_H - 4; y < BAR_H; y++) {
    for (let x = 0; x < BAR_W; x++) {
      if (x >= BAR_DOOR.x0 && x < BAR_DOOR.x1) g.set(x, y, y === BAR_H - 4 ? PAL.W : PAL.b);
      else g.set(x, y, y === BAR_H - 4 ? PAL.W : C.barkDarkShade);
    }
  }
  // A cobweb up in the stranger's... no: in the far top-left corner, where nobody dusts.
  seg(g, 3, 41, 12, 41, PAL.O);
  seg(g, 3, 41, 3, 50, PAL.O);
  seg(g, 3, 41, 10, 48, PAL.O);
  seg(g, 7, 41, 3, 45, PAL.H);
  return g;
}

// ---------- Furniture ----------

// The counter: a polished top with mugs and a tap, plank front with a brass foot rail. 100 x 24,
// placed with its top-left at COUNTER; the bartender stands behind it.
export const COUNTER = { x: 46, y: 52, w: 100, h: 24 };
export function counterGrid(): Grid {
  const { w, h } = COUNTER;
  const g = new Grid(w, h);
  for (let y = 4; y < 10; y++) for (let x = 1; x < w - 1; x++) g.set(x, y, y === 4 ? PAL.V : y === 9 ? PAL.W : x < 4 ? PAL.C : PAL.S);
  for (let y = 10; y < h - 1; y++) for (let x = 2; x < w - 2; x++) g.set(x, y, (x - 2) % 6 === 5 ? PAL.W : y === h - 2 ? PAL.W : PAL.w);
  for (let x = 4; x < w - 4; x++) g.set(x, h - 5, PAL.b);
  // The tap: a butter pipe with three handles.
  for (let x = 60; x < 72; x++) g.set(x, 3, PAL.b);
  for (const hx of [61, 65, 69]) {
    g.set(hx, 0, PAL.R);
    g.set(hx, 1, PAL.r);
    g.set(hx, 2, PAL.P);
  }
  // Mugs and a bowl of nuts on top.
  for (const mx of [14, 30, 82]) {
    box(g, mx, 1, 4, 4, PAL.B);
    g.set(mx + 4, 2, PAL.b);
    g.set(mx + 4, 3, PAL.b);
    g.set(mx, 1, PAL.V);
    g.set(mx + 1, 1, PAL.V);
    g.set(mx + 2, 1, PAL.V);
  }
  for (let x = 44; x < 52; x++) g.set(x, 3, x % 2 ? PAL.w : PAL.S);
  for (let x = 43; x < 53; x++) g.set(x, 4, PAL.Y);
  g.outline(PAL.K);
  return g;
}

export function stoolGrid(): Grid {
  const g = new Grid(10, 9);
  for (let x = 1; x < 9; x++) {
    g.set(x, 1, PAL.r);
    g.set(x, 2, PAL.R);
  }
  for (let y = 3; y < 8; y++) {
    g.set(2, y, PAL.W);
    g.set(7, y, PAL.W);
  }
  for (let x = 2; x < 8; x++) g.set(x, 5, PAL.w);
  g.outline(PAL.K);
  return g;
}

// A round table with two mugs and a candle, 30 x 20, its foot centred at (15, 18).
export function tableGrid(small = false): Grid {
  const w = small ? 20 : 30;
  const g = new Grid(w, 20);
  const cx = w / 2 - 0.5;
  const rx = small ? 8 : 13;
  for (let y = 3; y < 12; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - 7) / 4.2;
      if (dx * dx + dy * dy > 1) continue;
      g.set(x, y, y > 9 ? PAL.W : dx < -0.6 ? PAL.C : PAL.w);
    }
  }
  for (let y = 12; y < 18; y++) {
    g.set(Math.floor(cx), y, PAL.W);
    g.set(Math.floor(cx) + 1, y, PAL.w);
  }
  for (let x = Math.floor(cx) - 3; x < Math.floor(cx) + 5; x++) g.set(x, 18, PAL.W);
  // Candle.
  const kx = Math.floor(cx);
  g.set(kx, 6, PAL.V);
  g.set(kx, 5, PAL.V);
  g.set(kx, 4, PAL.B);
  g.set(kx, 3, PAL.H);
  if (!small) {
    for (const mx of [kx - 8, kx + 6]) {
      box(g, mx, 4, 3, 3, PAL.B);
      g.set(mx, 4, PAL.V);
      g.set(mx + 1, 4, PAL.V);
    }
  }
  g.outline(PAL.K);
  return g;
}

// The hearth's fire, 20 x 22, three flicker frames. low: embers and a little flame (the fire's
// running out of wood); otherwise roaring, once you've split Barley's firewood.
export const FIRE_FRAMES = 3;
export function fireGrid(frame: number, low: boolean): Grid {
  const g = new Grid(20, 22);
  // Logs on the grate.
  for (let x = 3; x < 17; x++) {
    g.set(x, 19, PAL.w);
    g.set(x, 20, PAL.W);
  }
  g.set(16, 19, PAL.S);
  g.set(16, 20, PAL.B);
  const h = low ? 5 : 14;
  for (let x = 4; x < 16; x++) {
    const wob = Math.round(Math.sin(x * 1.3 + frame * 2.1) * (low ? 1 : 2.5));
    const top = 19 - Math.max(1, Math.round(h * (1 - Math.abs(x - 9.5) / 7)) + wob);
    for (let y = top; y < 19; y++) {
      const u = (y - top) / Math.max(1, 19 - top);
      g.set(x, y, u < 0.25 ? PAL.B : u < 0.6 ? PAL.b : PAL.r);
    }
  }
  if (!low) {
    // Sparks.
    const sp = [[6, 3], [12, 1], [9, 5], [14, 4]] as const;
    sp.forEach(([x, y], i) => {
      if ((i + frame) % 3 !== 0) g.set(x, y + ((frame + i) % 2), PAL.B);
    });
  } else {
    for (let x = 5; x < 15; x += 3) g.set(x + (frame % 2), 18, PAL.r);
  }
  return g;
}

// ---------- People ----------
// Everyone in here shares the heroes' heads (stampBareHead) with their own clothes.

export const NPC_W = 18;
export const NPC_H = 24;

// Barley the bartender, behind the counter: chestnut hair and a big beard, sleeves rolled up, a
// barkDeep waistcoat, a towel over his shoulder. frame 0/1: polishing a mug.
const BARLEY_LOOK: HeroLook = { cls: 'warrior', sex: 'male', skin: 1, hair: 0, hairColor: 0 };
export function bartenderGrid(frame: number): Grid {
  const g = new Grid(NPC_W, NPC_H);
  const ox = 2;
  const top = 2;
  const sw = lookSwap(BARLEY_LOOK);
  g.stamp(['..VVVVVVVV..', '.VVWWVVWWVV.', 'SVVWWVVWWVVS', 'SVVWWVVWWVVS', '.VVWWWWWWVV.', '..CCCCCCCC..', '..CCCCCCCC..'], ox + 1, top + 10, sw);
  stampBareHead(g, BARLEY_LOOK, 'down', ox, top);
  // The beard: a mustache under the nose, then a big chestnut bush down over his collar.
  g.stamp(['w...wwww...w', 'ww.wwwwww.ww', '.wwwwwwwwww.', '..wwwwwwww..', '...wwWWww...'], ox + 1, top + 8);
  // The mug in his hands and the cloth going round it.
  const mx = ox + 5 + (frame ? 1 : 0);
  const my = top + 13;
  box(g, mx, my, 4, 4, PAL.B);
  g.set(mx + 4, my + 1, PAL.b);
  g.set(mx + 4, my + 2, PAL.b);
  g.set(mx + (frame ? 0 : 3), my + 2, PAL.H);
  g.set(mx + (frame ? 1 : 2), my + 3, PAL.H);
  g.outline(PAL.K);
  return g;
}

// The regulars. look: head and hair; coat: tunic and its shade. They sit on stools facing their
// friend across the table; frame 1 lifts the mug for a sip.
export type Patron = { name: string; look: HeroLook; coat: [string, string]; voice: 'low' | 'high' | 'old' };
export const PATRONS: Patron[] = [
  { name: 'Hob', look: { cls: 'warrior', sex: 'male', skin: 1, hair: 0, hairColor: 0 }, coat: ['Y', 'G'], voice: 'low' },
  { name: 'Marigold', look: { cls: 'warrior', sex: 'female', skin: 3, hair: 3, hairColor: 1 }, coat: ['R', 'r'], voice: 'high' },
  { name: 'Bram', look: { cls: 'warrior', sex: 'male', skin: 2, hair: 1, hairColor: 2 }, coat: ['M', 'm'], voice: 'low' },
  { name: 'Old Wendel', look: { cls: 'warrior', sex: 'male', skin: 0, hair: 0, hairColor: 3 }, coat: ['L', 'D'], voice: 'old' },
  { name: 'Tilly', look: { cls: 'warrior', sex: 'female', skin: 0, hair: 2, hairColor: 0 }, coat: ['B', 'b'], voice: 'high' },
  { name: 'Fen', look: { cls: 'warrior', sex: 'male', skin: 3, hair: 0, hairColor: 2 }, coat: ['o', 'O'], voice: 'low' },
];

export function patronGrid(p: Patron, faceRight: boolean, frame: number): Grid {
  const g = new Grid(NPC_W, NPC_H);
  const ox = 2;
  const top = 4;
  const sw: Record<string, string> = { ...lookSwap(p.look), T: p.coat[0], t: p.coat[1] };
  // The stool under them.
  for (let x = ox + 3; x < ox + 10; x++) g.set(x, top + 16, PAL.r);
  for (let y = top + 17; y < top + 20; y++) {
    g.set(ox + 4, y, PAL.W);
    g.set(ox + 9, y, PAL.W);
  }
  // Seated, side on: knees out toward the table, boots hanging down.
  g.stamp(['....TTTTT.....', '...TTTTTTT....', '...TTTTTTT....', '...tTTTTtT....', '...tTTTTT.....', '...WWWWWWWW...', '.........WW...', '.........ww...'], ox, top + 10, sw);
  stampBareHead(g, p.look, 'right', ox, top);
  // The arm and the mug: resting by the knee, or raised to the lips.
  const skin = PAL[sw.S];
  if (frame) {
    g.set(ox + 9, top + 12, PAL[p.coat[0]]);
    g.set(ox + 10, top + 11, skin);
    box(g, ox + 11, top + 6, 3, 4, PAL.B);
    g.set(ox + 11, top + 6, PAL.V);
  } else {
    g.set(ox + 10, top + 12, skin);
    g.set(ox + 11, top + 12, skin);
    box(g, ox + 12, top + 10, 3, 4, PAL.B);
    g.set(ox + 12, top + 10, PAL.V);
    g.set(ox + 13, top + 10, PAL.V);
    g.set(ox + 15, top + 11, PAL.b);
  }
  g.outline(PAL.K);
  return faceRight ? g : mirrorGrid(g);
}

// The stranger: a hooded cloak the colour of a bruised plum, nothing under the hood but a pair of
// pale eyes. Sits facing the room. frame 1: the eyes narrow.
export function strangerGrid(frame: number): Grid {
  const g = new Grid(NPC_W, NPC_H);
  const ox = 2;
  const top = 3;
  for (let y = top; y < top + 20; y++) {
    const u = (y - top) / 20;
    const hw = y < top + 9 ? Math.round(3 + Math.sqrt((y - top) / 9) * 3.5) : Math.round(6 + u * 2);
    for (let x = ox + 7 - hw; x <= ox + 6 + hw; x++) {
      const fold = (x - ox) % 4 === 1 && y > top + 10;
      g.set(x, y, fold ? C.leafPlumDeep : x > ox + 6 + hw - 2 ? C.leafPlumDeep : PAL.D);
    }
  }
  // The hood's tip, slumped forward.
  g.set(ox + 6, top - 1, PAL.D);
  g.set(ox + 7, top - 1, PAL.D);
  // The dark under the hood, and the eyes.
  for (let y = top + 3; y < top + 9; y++) for (let x = ox + 4; x < ox + 10; x++) if (!(y === top + 3 && (x === ox + 4 || x === ox + 9))) g.set(x, y, PAL.K);
  if (frame) {
    g.set(ox + 5, top + 6, PAL.Y);
    g.set(ox + 8, top + 6, PAL.Y);
  } else {
    g.set(ox + 5, top + 5, PAL.Y);
    g.set(ox + 5, top + 6, PAL.H);
    g.set(ox + 8, top + 5, PAL.Y);
    g.set(ox + 8, top + 6, PAL.H);
  }
  // Hands folded on the table edge, pale as the eyes.
  g.set(ox + 5, top + 15, PAL.o);
  g.set(ox + 6, top + 15, PAL.o);
  g.set(ox + 7, top + 15, PAL.o);
  g.set(ox + 8, top + 15, PAL.o);
  g.outline(PAL.K);
  return g;
}

// ---------- Headshots, 40 x 40 ----------

// Barley: a broad, friendly face over a huge chestnut beard, a towel on his shoulder.
export type BartenderMood = 'calm' | 'happy';
export function bartenderPortrait(mood: BartenderMood = 'calm', talking = false): Grid {
  const g = new Grid(40, 40);
  const skin = PAL.S;
  const shade = PAL.c;
  // Shoulders: vellum shirt, barkDeep waistcoat, the towel.
  for (let y = 31; y < 40; y++) for (let x = 1; x < 39; x++) {
    const d = Math.abs(x - 19.5);
    if (d > 13 + (y - 31) * 1.5) continue;
    g.set(x, y, d < 5 ? PAL.V : d < 10 ? PAL.W : PAL.V);
  }
  for (let y = 30; y < 40; y++) for (let x = 3; x < 10; x++) if ((x + y) % 5 !== 0 && x - 3 < (y - 30) + 3) g.set(x, y, (x + y) % 3 === 0 ? PAL.Y : PAL.H);
  // Head.
  for (let y = 4; y < 31; y++) for (let x = 6; x < 34; x++) {
    const dx = (x - 19.5) / 13;
    const dy = (y - 17) / 13.5;
    if (dx * dx + dy * dy > 1) continue;
    g.set(x, y, dx > 0.7 ? shade : skin);
  }
  // Ears.
  for (let y = 15; y < 21; y++) {
    g.set(5, y, skin);
    g.set(34, y, shade);
  }
  // Hair: swept back, chestnut with a shine.
  for (let y = 2; y < 12; y++) for (let x = 6; x < 34; x++) {
    const dx = (x - 19.5) / 14;
    const dy = (y - 12) / 10;
    if (dx * dx + dy * dy > 1 || y > 9 + (Math.abs(x - 19.5) > 11 ? 4 : 0)) continue;
    g.set(x, y, (x * 3 + y) % 7 === 0 ? PAL.W : PAL.w);
  }
  [[12, 4], [13, 3], [14, 3], [15, 3]].forEach(([x, y]) => g.set(x, y, PAL.S));
  // Bushy brows and kind eyes.
  for (const ex of [12, 24]) {
    for (let x = ex - 1; x < ex + 5; x++) g.set(x, 13 + (mood === 'happy' ? -1 : 0), PAL.W);
    g.set(ex - 1, 14, PAL.W);
    g.set(ex + 4, 14, PAL.W);
    if (mood === 'happy') {
      g.set(ex, 17, PAL.K);
      g.set(ex + 1, 16, PAL.K);
      g.set(ex + 2, 16, PAL.K);
      g.set(ex + 3, 17, PAL.K);
    } else {
      box(g, ex + 1, 15, 2, 3, PAL.K);
      g.set(ex + 1, 15, PAL.H);
    }
  }
  // A round red nose.
  box(g, 18, 18, 4, 3, PAL.r);
  g.set(18, 18, PAL.R);
  // The beard: from the sideburns down past the chin, curly at the edges, the mouth inside it.
  for (let y = 18; y < 38; y++) for (let x = 5; x < 35; x++) {
    const d = Math.abs(x - 19.5);
    const limit = y < 22 ? (d > 11 ? 1 : 0) : 13.5 - Math.max(0, y - 30) * 1.2;
    if (y < 22 && d < 11) continue;
    if (!limit || d > limit) continue;
    if (d > limit - 1 && (x + y) % 2 === 0) continue;
    g.set(x, y, (x * 5 + y * 3) % 9 === 0 ? PAL.W : PAL.w);
  }
  for (let x = 12; x < 28; x++) for (let y = 21; y < 24; y++) if (Math.abs(x - 19.5) < 8 - (y - 21)) g.set(x, y, PAL.w);
  // Mouth.
  if (talking) {
    g.stamp(['KKKK', 'KrrK', '.KK.'], 18, 25);
  } else if (mood === 'happy') {
    g.stamp(['K....K', '.KHHK.'], 17, 25);
  } else {
    for (let x = 17; x < 23; x++) g.set(x, 25, PAL.K);
  }
  g.outline(PAL.K);
  return g;
}

// A regular's headshot: their map head and shoulders, drawn twice as big.
export function patronPortrait(p: Patron, talking = false): Grid {
  const small = new Grid(20, 20);
  const sw: Record<string, string> = { ...lookSwap(p.look), T: p.coat[0], t: p.coat[1] };
  small.stamp(['...TTTTTTTTTT...', '..TTTTTTTTTTTT..', '.TTTTTTTTTTTTTT.', '.ttTTTTTTTTTTtt.'], 2, 16, sw);
  stampBareHead(small, p.look, 'down', 3, 6);
  if (talking) {
    small.set(9, 14, PAL.K);
    small.set(10, 14, PAL.K);
  }
  small.outline(PAL.K);
  const g = new Grid(40, 40);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 20; x++) {
    const c = small.c[y * 20 + x];
    if (!c) continue;
    g.set(x * 2, y * 2, c);
    g.set(x * 2 + 1, y * 2, c);
    g.set(x * 2, y * 2 + 1, c);
    g.set(x * 2 + 1, y * 2 + 1, c);
  }
  return g;
}

// The stranger's headshot: the hood, the dark, two eyes. They never change.
export function strangerPortrait(): Grid {
  const g = new Grid(40, 40);
  for (let y = 2; y < 40; y++) for (let x = 2; x < 38; x++) {
    const dx = (x - 19.5) / 15;
    const dy = (y - 20) / 18;
    const hood = dx * dx + dy * dy <= 1 || (y > 26 && Math.abs(x - 19.5) < 17);
    if (!hood) continue;
    g.set(x, y, Math.abs(x - 19.5) > 12 || y < 8 ? C.leafPlumDeep : PAL.D);
  }
  for (let y = 9; y < 32; y++) for (let x = 9; x < 31; x++) {
    const dx = (x - 19.5) / 10;
    const dy = (y - 21) / 12;
    if (dx * dx + dy * dy <= 1) g.set(x, y, PAL.K);
  }
  for (const ex of [14, 23]) {
    box(g, ex, 19, 3, 2, PAL.Y);
    g.set(ex, 19, PAL.H);
  }
  g.outline(PAL.K);
  return g;
}

// ---------- Out back: the woodpile ----------
// The chopping block (12 x 12): bare, with a log stood on it, or the log just split in two.
export function blockGrid(state: 'empty' | 'log' | 'split'): Grid {
  const g = new Grid(16, 18);
  for (let y = 11; y < 17; y++) for (let x = 3; x < 13; x++) g.set(x, y, y === 11 ? PAL.S : x === 12 || (x + y) % 4 === 0 ? PAL.W : PAL.w);
  for (let x = 4; x < 12; x++) g.set(x, 11, (x % 3 === 0 ? PAL.B : PAL.S));
  if (state === 'log') {
    for (let y = 3; y < 11; y++) for (let x = 5; x < 11; x++) g.set(x, y, y === 3 ? PAL.S : x === 10 ? PAL.W : PAL.w);
    g.set(7, 3, PAL.B);
    g.set(8, 3, PAL.B);
  } else if (state === 'split') {
    for (let y = 5; y < 11; y++) {
      g.set(2 + Math.floor((y - 5) / 3), y, PAL.w);
      g.set(3 + Math.floor((y - 5) / 3), y, PAL.S);
      g.set(13 - Math.floor((y - 5) / 3), y, PAL.w);
      g.set(12 - Math.floor((y - 5) / 3), y, PAL.S);
    }
    star(g, 8, 4, 2, PAL.B, PAL.H);
  }
  g.outline(PAL.K);
  return g;
}

// The log pile: n logs stacked (up to 5), ends out. 30 x 16.
export function logPileGrid(n: number): Grid {
  const g = new Grid(30, 16);
  const spots: [number, number][] = [[2, 9], [10, 9], [18, 9], [6, 4], [14, 4]];
  for (let k = 0; k < Math.min(n, 5); k++) {
    const [x, y] = spots[k];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) {
      if ((j === 0 || j === 4) && (i === 0 || i === 7)) continue;
      g.set(x + i, y + j, i > 4 ? PAL.S : j === 4 ? PAL.W : PAL.w);
    }
    g.set(x + 6, y + 2, PAL.B);
  }
  // A couple of stakes holding the pile.
  for (let y = 2; y < 15; y++) {
    g.set(0, y, PAL.W);
    g.set(27, y, PAL.W);
  }
  g.outline(PAL.K);
  return g;
}

// Split firewood, stacked as it's chopped: n pieces (0 to 5), pale split faces out. 22 x 14.
export function firewoodGrid(n: number): Grid {
  const g = new Grid(22, 14);
  const spots: [number, number][] = [[1, 8], [8, 8], [15, 8], [4, 3], [11, 3]];
  for (let k = 0; k < Math.min(n, 5); k++) {
    const [x, y] = spots[k];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) {
      if (j === 0 && i === 0) continue;
      g.set(x + i, y + j, i < 2 ? C.barkPale : j === 3 ? PAL.W : PAL.w);
    }
  }
  if (n > 0) g.outline(PAL.K);
  return g;
}

// A bundle of firewood for the quest log, 14 x 9.
export function firewoodIcon(): Grid {
  const g = new Grid(14, 9);
  for (const [x, y] of [[1, 4], [7, 4], [4, 1]] as const) {
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) g.set(x + i, y + j, i < 2 ? C.barkPale : PAL.w);
  }
  g.outline(PAL.K);
  return g;
}

// Barley's face for the quest log, 20 x 20.
export function bartenderBadge(): Grid {
  const g = new Grid(20, 20);
  const big = bartenderGrid(0);
  for (let y = 0; y < 20; y++) for (let x = 0; x < 18; x++) {
    const c = big.c[(y + 2) * big.w + x];
    if (c) g.set(x + 1, y, c);
  }
  return g;
}
