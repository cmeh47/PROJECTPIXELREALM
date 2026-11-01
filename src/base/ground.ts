import { colors } from '../theme';
import { DETAILS, HOUSE_BOX, MAP_H, MAP_W, PATH, POND, inPond, rng, type Detail } from './map';

// The base's ground as plain pixels, kept free of Skia so the recipe can be previewed and tested:
// the meadow, the cobbled path, the pond, and the grass and flowers that sway in the wind.
// art.ts records these lists into pictures. Coordinates are art pixels.

// One draw: a w x h block (1 x 1 when left out) of a palette color, optionally see-through.
export type Px = { x: number; y: number; w?: number; h?: number; c: string; a?: number };

const idx = (x: number, y: number) => y * MAP_W + x;
const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

// Runs of one color along a row, so a picture records a few hundred rects instead of every pixel.
function runs(cells: Map<number, string>, a?: number): Px[] {
  const out: Px[] = [];
  const keys = [...cells.keys()].sort((p, q) => p - q);
  for (const k of keys) {
    const x = k % MAP_W;
    const y = (k - x) / MAP_W;
    const c = cells.get(k)!;
    const last = out[out.length - 1];
    if (last && last.y === y && last.c === c && last.x + (last.w ?? 1) === x) last.w = (last.w ?? 1) + 1;
    else out.push({ x, y, w: 1, c, a });
  }
  return out;
}

// ---------- The path ----------

// The PATH rects joined into one shape with every corner rounded (radius 2): a closing fills the
// inside corners where two paths meet, then an opening rounds the outside ones.
const DISC: [number, number][] = [];
for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 4) DISC.push([x, y]);

const BOX = {
  x0: Math.max(0, Math.min(...PATH.map((r) => r.x)) - 4),
  y0: Math.max(0, Math.min(...PATH.map((r) => r.y)) - 4),
  x1: Math.min(MAP_W - 1, Math.max(...PATH.map((r) => r.x + r.w)) + 4),
  y1: Math.min(MAP_H - 1, Math.max(...PATH.map((r) => r.y + r.h)) + 4),
};

function morph(src: Uint8Array, every: boolean) {
  const out = new Uint8Array(src.length);
  for (let y = BOX.y0; y <= BOX.y1; y++) {
    for (let x = BOX.x0; x <= BOX.x1; x++) {
      let v = every ? 1 : 0;
      for (const [dx, dy] of DISC) {
        const on = inMap(x + dx, y + dy) && src[idx(x + dx, y + dy)] === 1;
        if (every && !on) {
          v = 0;
          break;
        }
        if (!every && on) {
          v = 1;
          break;
        }
      }
      out[idx(x, y)] = v;
    }
  }
  return out;
}

const PATH_MASK = (() => {
  const m = new Uint8Array(MAP_W * MAP_H);
  for (const r of PATH) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inMap(x, y)) m[idx(x, y)] = 1;
  const closed = morph(morph(m, false), true);
  return morph(morph(closed, true), false);
})();

const onCobbles = (x: number, y: number) => inMap(x, y) && PATH_MASK[idx(x, y)] === 1;
// A path pixel with path on all four sides; the rest of the path is its one-pixel rim.
const inner = (x: number, y: number) => onCobbles(x, y) && onCobbles(x + 1, y) && onCobbles(x - 1, y) && onCobbles(x, y + 1) && onCobbles(x, y - 1);

// Cobblestones sit in courses 4 pixels tall with a 1-pixel mortar line between them (mortar on
// rows where y = 1 mod 5; PATH edges sit on those rows too). Each course is split into whole
// stones that exactly fill the space between the rims, so no stone is ever cut off.
function cobbles() {
  const solid = new Map<number, string>();
  const shade = new Map<number, string>();
  const rand = rng(7);
  for (let y = BOX.y0; y <= BOX.y1; y++) for (let x = BOX.x0; x <= BOX.x1; x++) if (onCobbles(x, y)) solid.set(idx(x, y), colors.stoneDeep);
  for (let top = BOX.y0; top <= BOX.y1; top++) {
    if (top % 5 !== 2) continue;
    const fits = (x: number) => inner(x, top) && inner(x, top + 1) && inner(x, top + 2) && inner(x, top + 3);
    let x = BOX.x0;
    while (x <= BOX.x1) {
      if (!fits(x)) {
        x++;
        continue;
      }
      let end = x;
      while (end + 1 <= BOX.x1 && fits(end + 1)) end++;
      // Lay stones 4 to 6 wide across [x, end], making the last one fill whatever is left.
      let sx = x;
      while (sx <= end) {
        const left = end - sx + 1;
        let w = left <= 8 ? left : 4 + Math.floor(rand() * 3);
        if (left > 8 && left - (w + 1) < 4) w = left - 5;
        if (w >= 2) {
          for (let j = 0; j < 4; j++) {
            for (let i = 0; i < w; i++) {
              if ((i === 0 || i === w - 1) && (j === 0 || j === 3)) continue;
              const k = idx(sx + i, top + j);
              solid.set(k, j === 0 && i > 0 && i < w - 2 ? colors.vellum : colors.stone);
              if (j === 3 && i > 0) shade.set(k, colors.inkSoft);
            }
          }
        }
        sx += w + 1;
      }
      x = end + 1;
    }
  }
  // A soft line of deeper grass all around the path, so the stones settle into the meadow.
  const lip = new Map<number, string>();
  for (let y = BOX.y0; y <= BOX.y1; y++) {
    for (let x = BOX.x0; x <= BOX.x1; x++) {
      if (onCobbles(x, y)) continue;
      if (onCobbles(x + 1, y) || onCobbles(x - 1, y) || onCobbles(x, y + 1) || onCobbles(x, y - 1)) lip.set(idx(x, y), colors.questGreen);
    }
  }
  return [...runs(solid), ...runs(shade, 0.18), ...runs(lip, 0.3)];
}

// ---------- Everything that stays still ----------

export function staticGround(): Px[] {
  const out: Px[] = [];
  // Meadow with a soft two-tone tile pattern, like DS grass.
  out.push({ x: 0, y: 0, w: MAP_W, h: MAP_H, c: colors.mint });
  for (let ty = 0; ty < MAP_H; ty += 16) {
    for (let tx = 0; tx < MAP_W; tx += 16) {
      if (((tx + ty) / 16) % 2 === 0) {
        out.push({ x: tx + 6, y: ty + 7, c: colors.white, a: 0.35 }, { x: tx + 13, y: ty + 2, c: colors.white, a: 0.35 });
        continue;
      }
      out.push({ x: tx + 3, y: ty + 4, c: colors.questGreen, a: 0.35 }, { x: tx + 11, y: ty + 10, c: colors.questGreen, a: 0.35 }, { x: tx + 12, y: ty + 9, c: colors.questGreen, a: 0.35 });
    }
  }
  out.push(...cobbles());
  // Pond: ink rim, mana-blue shore, sky water, lily pads and sparkles.
  const pond = new Map<number, string>();
  for (let y = POND.y - POND.ry - 3; y <= POND.y + POND.ry + 3; y++) {
    for (let x = POND.x - POND.rx - 3; x <= POND.x + POND.rx + 3; x++) {
      const p = { x, y };
      if (inPond(p)) pond.set(idx(x, y), inPond(p, -3) ? colors.sky : colors.manaBlue);
      else if (inPond(p, 1)) pond.set(idx(x, y), colors.ink);
    }
  }
  out.push(...runs(pond));
  for (const [lx, ly] of [[POND.x - 14, POND.y - 4], [POND.x + 12, POND.y + 8]]) {
    out.push({ x: lx, y: ly, w: 5, h: 3, c: colors.questGreen }, { x: lx + 1, y: ly - 1, w: 3, c: colors.questGreen }, { x: lx + 2, y: ly, h: 2, c: colors.mint });
  }
  for (const [sx, sy] of [[POND.x - 22, POND.y - 10], [POND.x + 4, POND.y - 12], [POND.x + 20, POND.y - 2], [POND.x - 4, POND.y + 12]]) {
    out.push({ x: sx, y: sy, w: 3, c: colors.white });
  }
  // Clover lies flat, so it stays out of the wind.
  for (const d of DETAILS) {
    if (d.kind !== 'clover') continue;
    out.push({ x: d.x, y: d.y, w: 2, h: 2, c: colors.questGreen, a: 0.55 }, { x: d.x + 2, y: d.y + 1, w: 2, h: 2, c: colors.questGreen, a: 0.55 });
  }
  // A soft ink shadow where the cottage meets the grass.
  out.push({ x: HOUSE_BOX.x + 2, y: HOUSE_BOX.y + HOUSE_BOX.h, w: HOUSE_BOX.w - 2, h: 2, c: colors.ink, a: 0.1 });
  return out;
}

// ---------- Wind ----------

// Grass and flowers lean with the wind a pixel at a time: lean 1 bends them downwind, 2 is a
// strong gust, 0 stands them up and -1 is the spring back past upright. Each row of a sprig takes
// a share of the lean, so tips travel further than stems and roots never move.
export type Lean = -1 | 0 | 1 | 2;
export const LEANS: Lean[] = [-1, 0, 1, 2];
type Part = { dx: number; dy: number; c: string; a?: number; k: number };
type Sprig = { x: number; y: number; parts: Part[] };

// Pixel art for one sprig, top row first; the last row is the root and sits at (x, y).
function art(rows: string[], ks: number[], tone: Record<string, [string, number?]>): Part[] {
  const parts: Part[] = [];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const t = tone[row[i]];
      if (t) parts.push({ dx: i, dy: j - (rows.length - 1), c: t[0], a: t[1], k: ks[j] });
    }
  });
  return parts;
}

const GRASS: Record<string, [string, number?]> = { g: [colors.questGreen], d: [colors.leaf], w: [colors.white, 0.6] };
const TUFT = art(['g.g', 'ggg'], [0.6, 0], GRASS);
const TUFT2 = art(['.w.', '.g.', 'ggg'], [0.6, 0.6, 0], GRASS);
// Blades are straight strokes, so a bent blade never breaks apart: neighbouring rows differ by at
// most one pixel of lean.
const TALL = [
  art(['.g...', '.g.g.', 'gg.g.', 'dgdgd'], [1, 0.6, 0.3, 0], GRASS),
  art(['...g..', '.g.g..', '.g.g.g', 'dgdgdg'], [1, 0.6, 0.3, 0], GRASS),
];
// Grass that grows over the rim of the path, rooted on the rim, so the edge never runs ruler
// straight. Picked at random, one every 16 pixels or more.
const RIM = [art(['.g.', 'gg.', 'ggg'], [1, 0.6, 0], GRASS), art(['..g.', '.gg.', 'gggg'], [1, 0.6, 0], GRASS)];

const FLOWER_TONE: Record<string, string> = { R: colors.rose, B: colors.butter, H: colors.white, Y: colors.sky };

function sprig(d: Detail): Sprig | null {
  if (d.kind === 'tuft') return { x: d.x, y: d.y + 1, parts: TUFT };
  if (d.kind === 'tuft2') return { x: d.x, y: d.y + 1, parts: TUFT2 };
  if (d.kind === 'tall') return { x: d.x - 2, y: d.y, parts: TALL[(d.variant ?? 0) % TALL.length] };
  if (d.kind === 'flower') {
    const tone = { c: [FLOWER_TONE[d.color ?? 'R']], y: [colors.butter], g: [colors.questGreen] } as Record<string, [string, number?]>;
    return { x: d.x, y: d.y + 3, parts: art(['.c.', 'cyc', '.c.', '.g.'], [0.6, 0.6, 0.6, 0], tone) };
  }
  return null;
}

function rimSprigs(): Sprig[] {
  const rand = rng(23);
  const out: Sprig[] = [];
  const taken: { x: number; y: number }[] = [];
  for (let y = BOX.y0; y <= BOX.y1; y++) {
    for (let x = BOX.x0; x <= BOX.x1; x++) {
      if (!onCobbles(x, y) || inner(x, y)) continue;
      // Under the cottage wall the rim is hidden; leave it. Along a top edge the grass is behind
      // the path, so nothing grows over it there.
      const topEdge = !onCobbles(x, y - 1) && onCobbles(x, y + 1);
      if (y < HOUSE_BOX.y + HOUSE_BOX.h + 2 || topEdge) continue;
      if (rand() > 0.07) continue;
      if (taken.some((t) => Math.abs(t.x - x) < 16 && Math.abs(t.y - y) < 16)) continue;
      taken.push({ x, y });
      out.push({ x: x - 1, y, parts: RIM[Math.floor(rand() * RIM.length)] });
    }
  }
  return out;
}

// Gusts roll across the meadow as diagonal bands, heading east-southeast.
export const WIND_TICK = 1000 / 12; // the 12 fps sprite tick from DESIGN.md
const BAND = 16; // art px per band
const BAND_DELAY = 80; // ms for a gust front to cross one band (about 200 art px per second)
const GUST_EVERY = 2400; // ms between gusts, plus up to a second of jitter
const GUST: Lean[] = [1, 1, 1, 0, -1, 0]; // per tick after the front arrives
const STRONG_GUST: Lean[] = [1, 2, 2, 2, 1, 0, -1, 0];

const bandOf = (x: number, y: number) => Math.floor((x + y * 0.5 + (((x * 7 + y * 13) % 7) - 3)) / BAND);
export const WIND_BANDS = bandOf(MAP_W + 3, MAP_H + 3) + 1;

const hash = (k: number) => Math.imul(k, 2654435761) >>> 0;

export function windLean(band: number, now: number): Lean {
  const local = now - band * BAND_DELAY;
  const i = Math.floor(local / GUST_EVERY);
  for (const k of [i, i - 1]) {
    const dt = local - (k * GUST_EVERY + (hash(k) % 1000));
    if (dt < 0) continue;
    const shape = hash(k + 101) % 3 === 0 ? STRONG_GUST : GUST;
    const tick = Math.floor(dt / WIND_TICK);
    return tick < shape.length ? shape[tick] : 0;
  }
  return 0;
}

// Every swaying sprig, drawn once per lean and grouped by band: frames[band][LEANS.indexOf(lean)].
export function windFrames(): Px[][][] {
  const sprigs = [...DETAILS.map(sprig).filter((d): d is Sprig => d !== null), ...rimSprigs()];
  const frames: Px[][][] = Array.from({ length: WIND_BANDS }, () => LEANS.map(() => []));
  for (const sp of sprigs) {
    const band = Math.max(0, Math.min(WIND_BANDS - 1, bandOf(sp.x, sp.y)));
    LEANS.forEach((lean, f) => {
      for (const p of sp.parts) {
        const v = lean * p.k;
        frames[band][f].push({ x: sp.x + p.dx + Math.sign(v) * Math.round(Math.abs(v)), y: sp.y + p.dy, c: p.c, a: p.a });
      }
    });
  }
  return frames;
}
