import { Grid, PAL, seg, star } from './pixel';

// Mage spell art (storyboard sheet 3): glyphs and the effects each spell throws.
// Effects are grids placed at an art-pixel origin in the battle field.

export type GlyphState = 'next' | 'live' | 'lit' | 'missed';

// The glyph's place in the chain, written inside it in pixel strokes. 5 rows tall.
const NUMERALS: Record<number, string[]> = {
  1: ['X', 'X', 'X', 'X', 'X'],
  2: ['X.X', 'X.X', 'X.X', 'X.X', 'X.X'],
  3: ['X.X.X', 'X.X.X', 'X.X.X', 'X.X.X', 'X.X.X'],
  4: ['X.X.X', 'X.X.X', 'X.X.X', 'X..X.', 'X..X.'],
};

export const GLYPH_SIZE = 15;
export const GLYPH_C = 7;

// A round rune 11 px across: sky while live, butter once tapped, pale while it waits or after a miss.
export function glyphGrid(n: number, state: GlyphState): Grid {
  const g = new Grid(GLYPH_SIZE, GLYPH_SIZE);
  const x = GLYPH_C;
  const y = GLYPH_C;
  const body = state === 'lit' ? PAL.B : state === 'live' ? PAL.Y : state === 'missed' ? PAL.C : PAL.H;
  const rim = state === 'next' || state === 'missed' ? PAL.L : PAL.K;
  const r = 4;
  for (let j = -r - 1; j <= r + 1; j++)
    for (let i = -r - 1; i <= r + 1; i++) {
      const d = i * i + j * j;
      if (d <= r * r + 1) g.set(x + i, y + j, body);
      else if (d <= (r + 1) * (r + 1) + 1) g.set(x + i, y + j, rim);
    }
  const ink = state === 'next' ? PAL.D : state === 'missed' ? PAL.L : state === 'lit' ? PAL.W : PAL.K;
  const map = NUMERALS[n] ?? NUMERALS[1];
  const w = map[0].length;
  map.forEach((row, j) => [...row].forEach((ch, i) => ch === 'X' && g.set(x - Math.floor(w / 2) + i, y - 2 + j, ink)));
  if (state === 'lit') {
    g.set(x - 7, y, PAL.H);
    g.set(x + 7, y, PAL.H);
    g.set(x, y - 7, PAL.H);
    g.set(x, y + 7, PAL.H);
  }
  return g;
}

export type Pt = { x: number; y: number };
export type FxGrid = { grid: Grid; x: number; y: number };

function disc(g: Grid, x: number, y: number, r: number, col: string) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r + r * 0.6) g.set(x + i, y + j, col);
}

// A grid that covers two points with some margin, so lines between them fit.
function spanGrid(a: Pt, b: Pt, pad = 6) {
  const x0 = Math.floor(Math.min(a.x, b.x)) - pad;
  const y0 = Math.floor(Math.min(a.y, b.y)) - pad;
  const w = Math.ceil(Math.abs(a.x - b.x)) + pad * 2 + 1;
  const h = Math.ceil(Math.abs(a.y - b.y)) + pad * 2 + 1;
  return { g: new Grid(w, h), x0, y0 };
}

// Ember Bolt in flight: a butter core in a rose shell with a flickering trail. Centered at (11, 4).
export const EMBER_C = { x: 11, y: 4 };
export function emberGrid(): Grid {
  const g = new Grid(16, 9);
  const { x, y } = EMBER_C;
  for (let i = 1; i <= 5; i++) {
    g.set(x - i * 2, y + (i % 2 ? 1 : -1) * (i > 2 ? 1 : 0), i < 3 ? PAL.R : PAL.r);
    if (i < 3) g.set(x - i * 2 - 1, y, PAL.B);
  }
  disc(g, x, y, 3, PAL.r);
  disc(g, x, y, 2, PAL.B);
  g.set(x, y, PAL.H);
  g.set(x + 1, y - 1, PAL.H);
  return g;
}

// Frost Lance: an ice shaft from the orb to the target with a white edge and a sharp tip.
export function lanceFx(from: Pt, to: Pt): FxGrid {
  const { g, x0, y0 } = spanGrid(from, to);
  const a = { x: from.x - x0, y: from.y - y0 };
  const b = { x: to.x - x0, y: to.y - y0 };
  seg(g, a.x, a.y, b.x, b.y, PAL.Y, 2);
  seg(g, a.x + 2, a.y - 1, b.x - 2, b.y - 1, PAL.H, 1);
  const n = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  const ux = (b.x - a.x) / n;
  const uy = (b.y - a.y) / n;
  for (let i = 0; i < 4; i++) {
    g.set(b.x + ux * i, b.y + uy * i, PAL.H);
    g.set(b.x + ux * i, b.y + uy * i + 1, PAL.G);
  }
  return { grid: g, x: x0, y: y0 };
}

// Arc Chain: a jagged bolt, butter with a white core.
export function boltFx(from: Pt, to: Pt, seed = 1): FxGrid {
  const { g, x0, y0 } = spanGrid(from, to, 8);
  let s = seed * 9301 + 17;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280) - 0.5;
  let px = from.x - x0;
  let py = from.y - y0;
  const steps = 6;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps;
    const x = k === steps ? to.x - x0 : from.x - x0 + (to.x - from.x) * t + r() * 6;
    const y = k === steps ? to.y - y0 : from.y - y0 + (to.y - from.y) * t + r() * 8;
    seg(g, px, py, x, y, PAL.B, 2);
    seg(g, px, py, x, y, PAL.H, 1);
    px = x;
    py = y;
  }
  return { grid: g, x: x0, y: y0 };
}

// Impact bursts, centered on a point.
export function burstFx(kind: 'ember' | 'frost' | 'arc' | 'shatter', at: Pt): FxGrid {
  const g = new Grid(31, 31);
  const c = 15;
  if (kind === 'ember') {
    star(g, c, c, 5, PAL.r, PAL.B);
    star(g, c - 5, c - 5, 2, PAL.B, PAL.H);
    star(g, c + 6, c - 8, 2, PAL.r, PAL.B);
  } else if (kind === 'arc') {
    star(g, c, c, 4, PAL.B, PAL.H);
    g.set(c - 7, c + 3, PAL.B);
    g.set(c + 7, c - 4, PAL.B);
  } else {
    const pts = [[-6, -4], [5, -6], [7, 3], [-4, 6], [0, -9], [-8, 2]];
    for (const [i, j] of pts) {
      g.set(c + i, c + j, PAL.H);
      g.set(c + i + 1, c + j, PAL.Y);
      g.set(c + i - 1, c + j, PAL.Y);
      g.set(c + i, c + j + 1, PAL.Y);
      g.set(c + i, c + j - 1, PAL.Y);
    }
    if (kind === 'shatter') {
      star(g, c, c, 5, PAL.H, PAL.H);
      star(g, c - 8, c - 8, 3, PAL.Y, PAL.H);
      star(g, c + 7, c + 6, 3, PAL.Y, PAL.H);
    } else star(g, c - 2, c, 4, PAL.Y, PAL.H);
  }
  return { grid: g, x: Math.round(at.x) - c, y: Math.round(at.y) - c };
}

// Mend: mint plus-shaped motes around a point; they rise as the grid is moved up.
export function motesFx(at: Pt): FxGrid {
  const g = new Grid(25, 29);
  const cx = 12;
  const cy = 18;
  const pts = [[-7, 4], [6, 0], [-2, -6], [8, -10], [-9, -8], [2, 6]];
  pts.forEach(([i, j], k) => {
    const x = cx + i;
    const y = cy + j - (k % 2) * 2;
    const col = k % 2 ? PAL.M : PAL.m;
    g.set(x, y, col);
    g.set(x - 1, y, col);
    g.set(x + 1, y, col);
    g.set(x, y - 1, col);
    g.set(x, y + 1, col);
    g.set(x, y, PAL.H);
  });
  return { grid: g, x: Math.round(at.x) - cx, y: Math.round(at.y) - cy };
}
