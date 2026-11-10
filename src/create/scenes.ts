import type { HeroClass } from '../sprites/hero';
import { treeGrid, treeVariant, TREE_H, TREE_W } from '../sprites/overworld';
import { Grid } from '../sprites/pixel';
import { colors } from '../theme';

// The backdrops behind each class on the character creation screens, as plain pixels (no Skia):
// the warrior's sunrise meadow below a hill keep, and the mage's moonlit grove below a spire.
// A scene is drawn to any size in art pixels; `ground` is the row the hero's feet stand on.
//
// base: everything that never moves. drift: clouds or mist, drawn twice side by side and slid one
// art pixel at a time. fx(phase): the few pixels that do move (pennants, butterflies, stars,
// fireflies), eight phases a loop.

export const SCENE_PHASES = 8;

type Rand = () => number;
function rng(seed: number): Rand {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

function rect(g: Grid, x: number, y: number, w: number, h: number, c: string) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.set(x + i, y + j, c);
}

function disc(g: Grid, cx: number, cy: number, r: number, c: string | ((x: number, y: number) => string | null)) {
  for (let dy = -r; dy <= r; dy++) {
    const hw = Math.round(Math.sqrt(r * r + r * 0.6 - dy * dy));
    for (let dx = -hw; dx <= hw; dx++) {
      const col = typeof c === 'string' ? c : c(cx + dx, cy + dy);
      if (col) g.set(cx + dx, cy + dy, col);
    }
  }
}

// Sky bands from the top down to `bottom`, each [share of the height, color]. Where two bands
// meet, three rows are dithered so the sky steps in pixels instead of blending.
function sky(g: Grid, bottom: number, bands: [number, string][]) {
  let y0 = 0;
  bands.forEach(([share, col], i) => {
    const y1 = i === bands.length - 1 ? bottom : Math.round(y0 + share * bottom);
    rect(g, 0, y0, g.w, y1 - y0, col);
    const next = bands[i + 1]?.[1];
    if (next) {
      for (let x = 0; x < g.w; x++) {
        if ((x + y1) % 4 === 0) g.set(x, y1 - 3, next);
        if ((x + y1) % 2 === 0) g.set(x, y1 - 2, next);
        if ((x + y1) % 4 !== 2) g.set(x, y1 - 1, next);
      }
    }
    y0 = y1;
  });
}

// A rounded hill: its crest at (cx, top), `half` wide at the bottom row.
function hill(g: Grid, cx: number, top: number, half: number, bottom: number, col: string, rim?: string) {
  for (let x = cx - half; x <= cx + half; x++) {
    const u = (x - cx) / half;
    const y = Math.round(top + (bottom - top) * u * u);
    for (let yy = y; yy < bottom; yy++) g.set(x, yy, yy === y && rim ? rim : col);
  }
}

function blit(g: Grid, src: Grid, ox: number, oy: number) {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const c = src.c[y * src.w + x];
      if (c) g.set(ox + x, oy + y, c);
    }
  }
}

function stamp(g: Grid, map: string[], ox: number, oy: number, key: Record<string, string>) {
  map.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = key[row.charAt(i)];
      if (c) g.set(ox + i, oy + j, c);
    }
  });
}

// Grass, tufts and flowers from the ground line down.
function meadow(g: Grid, top: number, rand: Rand, c: { fill: string; edge: string; light: string; tuft: string; blooms: string[] }) {
  rect(g, 0, top, g.w, g.h - top, c.fill);
  for (let x = 0; x < g.w; x++) {
    g.set(x, top, c.edge);
    if (rand() < 0.3) g.set(x, top - 1, c.edge);
  }
  const n = Math.floor((g.w * (g.h - top)) / 26);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(rand() * g.w);
    const y = top + 3 + Math.floor(rand() * Math.max(1, g.h - top - 4));
    const k = rand();
    if (k < 0.45) {
      g.set(x, y, c.tuft);
      g.set(x + 1, y - 1, c.tuft);
      g.set(x + 2, y, c.tuft);
    } else if (k < 0.8) {
      g.set(x, y, c.light);
      g.set(x + 1, y, c.light);
    } else {
      g.set(x, y, c.blooms[Math.floor(rand() * c.blooms.length)]);
      g.set(x, y + 1, c.tuft);
    }
  }
}

// The hero's shadow on the grass: a stepped oval under the middle of the scene.
function shadow(g: Grid, ground: number, col: string) {
  const cx = Math.round(g.w / 2);
  rect(g, cx - 6, ground - 1, 12, 1, col);
  rect(g, cx - 8, ground, 16, 1, col);
  rect(g, cx - 6, ground + 1, 12, 1, col);
}

const KEEP = [
  '.....r..........',
  '.....rr.........',
  '.....K......r...',
  '....RRR.....rr..',
  '...RRRRR....K...',
  '..RRRRRRR..RRR..',
  '...oooooo.RRRRR.',
  '...oKooOo..ooO..',
  '...ooooOooooooO.',
  'o.o.ooooOo.o.oOo',
  'oooooooooooooooO',
  'ooKoooooKKooooOO',
  'ooooooooKKoooKOO',
  'ooooooooKKooooOO',
];

const SPIRE = [
  '....D....',
  '...DDD...',
  '...DDD...',
  '..DDDDD..',
  '..DDDDD..',
  '.DDDDDDD.',
  '.DDDDDDD.',
  'DDDDDDDDD',
  '..PPPPP..',
  '..PBBPP..',
  '..PBBPP..',
  '..PPPPP..',
  '..PPPPP..',
  '.PPPPPPP.',
  '..PPPPP..',
  '..PPPBP..',
  '..PPPPP..',
  '..PPPPP..',
  '..PPPPP..',
  '.PPPPPPP.',
  '.PPPPPPP.',
];

const SHROOM = ['.RR.', 'RHRR', '.VV.'];

type Twinkle = { x: number; y: number; at: number };

export type Scene = { base: Grid; drift: Grid; fx: (phase: number) => Grid };

const scenes = new Map<string, Scene>();

export function classScene(cls: HeroClass, w: number, h: number, ground: number): Scene {
  const key = `${cls}-${w}x${h}@${ground}`;
  let scene = scenes.get(key);
  if (!scene) {
    scene = cls === 'warrior' ? meadowScene(w, h, ground) : groveScene(w, h, ground);
    scenes.set(key, scene);
  }
  return scene;
}

function meadowScene(w: number, h: number, ground: number): Scene {
  const g = new Grid(w, h);
  const rand = rng(11);
  const top = ground - 3; // the grass starts a little above the hero's feet
  sky(g, top, [
    [0.5, colors.sky],
    [0.28, colors.butter],
    [0.22, colors.peach],
  ]);

  // The sun coming up behind the hills, with a dotted halo.
  const sx = Math.round(w * 0.66);
  const sy = top - 12;
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2;
    if (k % 2 === 0) g.set(sx + Math.cos(a) * 14.5, sy + Math.sin(a) * 14.5, colors.vellum);
  }
  disc(g, sx, sy, 11, colors.vellum);
  disc(g, sx, sy, 8, colors.white);

  // Far peaks, then the keep on its hill, then the near rise.
  hill(g, Math.round(w * 0.2), top - 26, 20, top, colors.lavender, colors.vellum);
  hill(g, Math.round(w * 0.9), top - 20, 17, top, colors.lavender, colors.vellum);
  const kx = Math.round(w * 0.24);
  hill(g, kx, top - 13, 26, top, colors.mint, colors.questGreen);
  stamp(g, KEEP, kx - 8, top - 13 - KEEP.length + 2, {
    o: colors.stone,
    O: colors.stoneDeep,
    K: colors.inkSoft,
    R: colors.rose,
    r: colors.hpRose,
  });
  hill(g, Math.round(w * 0.8), top - 7, 30, top, colors.mint, colors.questGreen);

  meadow(g, top, rand, { fill: colors.mint, edge: colors.questGreen, light: colors.vellum, tuft: colors.questGreen, blooms: [colors.rose, colors.butter, colors.white] });
  shadow(g, ground, colors.questGreen);
  // A worn cobble or two where the hero stands.
  [[-13, 4], [-6, 6], [9, 5], [15, 7]].forEach(([dx, dy]) => {
    const x = Math.round(w / 2) + dx;
    rect(g, x, ground + dy - 3, 3, 2, colors.stone);
    g.set(x + 2, ground + dy - 2, colors.stoneDeep);
  });

  // Trees from the base frame the shot, mostly off the edges.
  blit(g, treeGrid(treeVariant('green', 0)), -TREE_W + 11, ground + 6 - TREE_H);
  blit(g, treeGrid(treeVariant('gold', 1)), w - 10, ground + 10 - TREE_H);

  const drift = new Grid(w, h);
  const cloud = (x: number, y: number, len: number) => {
    rect(drift, x + 2, y, len - 4, 1, colors.white);
    rect(drift, x, y + 1, len, 2, colors.white);
    rect(drift, x + 1, y + 3, len - 3, 1, colors.vellum);
    rect(drift, x + 3, y - 1, Math.max(2, Math.floor(len / 3)), 1, colors.white);
  };
  cloud(Math.round(w * 0.08), Math.round(top * 0.14), 15);
  cloud(Math.round(w * 0.58), Math.round(top * 0.3), 11);
  cloud(Math.round(w * 0.3), Math.round(top * 0.47), 8);

  // Two butterflies looping over the grass, and the keep's pennants flicking.
  const fx = (phase: number) => {
    const f = new Grid(w, h);
    const fly = (cx: number, cy: number, r: number, col: string, off: number) => {
      const a = ((phase + off) / SCENE_PHASES) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a * 2) * 2);
      f.set(x, y, colors.ink);
      if ((phase + off) % 2 === 0) {
        f.set(x - 1, y - 1, col);
        f.set(x + 1, y - 1, col);
      } else {
        f.set(x - 1, y, col);
        f.set(x + 1, y, col);
      }
    };
    fly(Math.round(w * 0.22), ground - 9, 4, colors.white, 0);
    fly(Math.round(w * 0.8), ground + 2, 3, colors.butter, 3);
    if (phase % 4 >= 2) {
      const py = top - 13 - KEEP.length + 2;
      f.set(kx - 8 + 6, py + 1, colors.sky);
      f.set(kx - 8 + 6, py + 2, colors.hpRose);
      f.set(kx - 8 + 13, py + 3, colors.vellum);
      f.set(kx - 8 + 13, py + 4, colors.hpRose);
    }
    return f;
  };
  return { base: g, drift, fx };
}

function groveScene(w: number, h: number, ground: number): Scene {
  const g = new Grid(w, h);
  const rand = rng(23);
  const top = ground - 3;
  sky(g, top, [
    [0.4, colors.leafPlumDeep],
    [0.26, colors.lavenderDeep],
    [0.2, colors.lavender],
    [0.14, colors.rose],
  ]);

  // Stars: steady ones in the base, and a few that twinkle.
  const twinkles: Twinkle[] = [];
  for (let i = 0; i < Math.floor((w * top) / 55); i++) {
    const x = 1 + Math.floor(rand() * (w - 2));
    const y = 1 + Math.floor(rand() * top * 0.5);
    if (rand() < 0.4) twinkles.push({ x, y, at: Math.floor(rand() * SCENE_PHASES) });
    else g.set(x, y, rand() < 0.5 ? colors.lavender : colors.butter);
  }

  // A crescent moon: a pale disc with a bite of sky taken out of it.
  const mx = Math.round(w * 0.27);
  const my = Math.round(top * 0.2);
  const night = new Grid(w, h);
  night.c.splice(0, night.c.length, ...g.c);
  disc(g, mx, my, 7, colors.vellum);
  disc(g, mx - 1, my - 1, 4, colors.white);
  disc(g, mx + 4, my - 3, 6, (x, y) => night.get(x, y));

  // The far ridge and the spire with one lit window.
  hill(g, Math.round(w * 0.15), top - 12, 24, top, colors.lavenderDeep);
  hill(g, Math.round(w * 0.74), top - 17, 28, top, colors.lavenderDeep);
  const tx = Math.round(w * 0.72);
  stamp(g, SPIRE, tx - 4, top - 17 - SPIRE.length + 4, { D: colors.leafPlumDeep, P: colors.inkSoft, B: colors.butter });
  hill(g, Math.round(w * 0.2), top - 6, 30, top, colors.leafPlumDeep);

  meadow(g, top, rand, { fill: colors.leaf, edge: colors.leafDeep, light: colors.questGreen, tuft: colors.leafDeep, blooms: [colors.lavender, colors.rose, colors.butter] });
  shadow(g, ground, colors.leafDeep);
  [[-17, 5], [13, 8], [19, 3]].forEach(([dx, dy]) => stamp(g, SHROOM, Math.round(w / 2) + dx, ground + dy - 3, { R: colors.rose, H: colors.white, V: colors.vellum }));

  blit(g, treeGrid(treeVariant('purple', 0)), -TREE_W + 12, ground + 8 - TREE_H);
  blit(g, treeGrid(treeVariant('purple', 1)), w - 9, ground + 5 - TREE_H);

  // Thin mist low in the sky.
  const drift = new Grid(w, h);
  const wisp = (x: number, y: number, len: number) => {
    rect(drift, x, y, len, 1, colors.lavender);
    rect(drift, x + 3, y + 1, len - 5, 1, colors.rose);
  };
  wisp(Math.round(w * 0.1), top - 22, 14);
  wisp(Math.round(w * 0.6), top - 30, 10);

  // The casting circle around the hero's feet: dots chasing each other round an oval.
  const cx = Math.round(w / 2);
  const ring: [number, number][] = [];
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    ring.push([Math.round(cx + Math.cos(a) * 13), Math.round(ground + 1 + Math.sin(a) * 3)]);
  }
  const fireflies = [
    { x: w * 0.2, y: ground - 14, r: 3, off: 0 },
    { x: w * 0.82, y: ground - 9, r: 4, off: 3 },
    { x: w * 0.64, y: ground - 24, r: 2, off: 5 },
    { x: w * 0.3, y: ground + 5, r: 3, off: 6 },
  ];
  const fx = (phase: number) => {
    const f = new Grid(w, h);
    for (const t of twinkles) {
      const d = (phase - t.at + SCENE_PHASES) % SCENE_PHASES;
      if (d === 0) {
        f.set(t.x, t.y, colors.white);
        f.set(t.x - 1, t.y, colors.butter);
        f.set(t.x + 1, t.y, colors.butter);
        f.set(t.x, t.y - 1, colors.butter);
        f.set(t.x, t.y + 1, colors.butter);
      } else if (d < 5) f.set(t.x, t.y, d === 1 || d === 4 ? colors.white : colors.butter);
    }
    ring.forEach(([x, y], k) => {
      const d = (k + phase) % 4;
      if (d === 0) f.set(x, y, colors.white);
      else if (d === 1) f.set(x, y, colors.lavender);
    });
    for (const m of fireflies) {
      const a = ((phase + m.off) / SCENE_PHASES) * Math.PI * 2;
      const x = Math.round(m.x + Math.cos(a) * m.r);
      const y = Math.round(m.y + Math.sin(a) * m.r * 0.6);
      f.set(x, y, (phase + m.off) % 4 === 0 ? colors.white : colors.butter);
    }
    // The spire's window flickers.
    if (phase % 4 === 1) rect(f, tx - 4 + 3, top - 17 - SPIRE.length + 4 + 9, 2, 2, colors.xpGold);
    return f;
  };
  return { base: g, drift, fx };
}
