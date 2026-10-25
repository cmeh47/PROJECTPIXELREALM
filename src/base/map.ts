// Your base: a meadow lot with your cottage, a path, a pond, choppable trees and four
// toadstools. All positions are art pixels; the map is 26 x 36 tiles of 16 px.

export const TILE = 16;
export const MAP_W = 26 * TILE;
export const MAP_H = 36 * TILE;

export type Pt = { x: number; y: number };
export type TreeSpot = Pt & { id: number; variant: number; border: boolean }; // x, y = trunk base

// The cottage frame's top-left. Its door is at (HOUSE.x + 28, HOUSE.y + 50).
export const HOUSE = { x: 180, y: 36 };
export const DOOR = { x: HOUSE.x + 28, y: HOUSE.y + 52 };
export const SPAWN = { x: DOOR.x, y: DOOR.y + 14 };

export const POND = { x: 328, y: 316, rx: 36, ry: 22 };

// Path: from the door down to a little plaza, then east toward the pond.
export const PATH: { x: number; y: number; w: number; h: number }[] = [
  { x: DOOR.x - 12, y: DOOR.y - 2, w: 24, h: 140 },
  { x: DOOR.x - 32, y: DOOR.y + 130, w: 64, h: 40 },
  { x: DOOR.x + 30, y: DOOR.y + 140, w: 70, h: 20 },
];

export const TOAD_SPAWNS: Pt[] = [
  { x: 134, y: 244 },
  { x: 290, y: 178 },
  { x: 108, y: 432 },
  { x: 300, y: 452 },
];

function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const inRect = (p: Pt, r: { x: number; y: number; w: number; h: number }, pad = 0) =>
  p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

export function inPond(p: Pt, pad = 0) {
  const dx = (p.x - POND.x) / (POND.rx + pad);
  const dy = (p.y - POND.y) / (POND.ry + pad);
  return dx * dx + dy * dy <= 1;
}

export function onPath(p: Pt, pad = 0) {
  return PATH.some((r) => inRect(p, r, pad));
}

export const HOUSE_BOX = { x: HOUSE.x + 6, y: HOUSE.y + 22, w: 44, h: 30 };

// Choppable trees scattered through the meadow, plus a ring of border trees that frame the lot.
export const TREES: TreeSpot[] = (() => {
  const rand = rng(11);
  const out: TreeSpot[] = [];
  let id = 0;
  // Border ring (not choppable): staggered so it reads as a woodland edge.
  for (let x = 4; x < MAP_W + 8; x += 22) {
    out.push({ id: id++, x, y: 22 + Math.floor(rand() * 6), variant: Math.floor(rand() * 3), border: true });
    out.push({ id: id++, x: x + 10, y: MAP_H + 4 - Math.floor(rand() * 6), variant: Math.floor(rand() * 3), border: true });
  }
  for (let y = 52; y < MAP_H; y += 26) {
    out.push({ id: id++, x: 4 + Math.floor(rand() * 6), y, variant: Math.floor(rand() * 3), border: true });
    out.push({ id: id++, x: MAP_W - 6 - Math.floor(rand() * 6), y: y + 12, variant: Math.floor(rand() * 3), border: true });
  }
  // Meadow trees on a jittered grid, kept off the house, path, pond, spawn and toadstool patches.
  for (let gy = 140; gy < MAP_H - 30; gy += 46) {
    for (let gx = 40; gx < MAP_W - 30; gx += 44) {
      const p = { x: gx + Math.floor(rand() * 22) - 11, y: gy + Math.floor(rand() * 20) - 10 };
      if (rand() < 0.32) continue;
      if (inRect(p, HOUSE_BOX, 26) || onPath(p, 20) || inPond(p, 22)) continue;
      if (Math.hypot(p.x - SPAWN.x, p.y - SPAWN.y) < 40) continue;
      if (TOAD_SPAWNS.some((t) => Math.hypot(p.x - t.x, p.y - t.y) < 40)) continue;
      out.push({ id: id++, ...p, variant: Math.floor(rand() * 3), border: false });
    }
  }
  return out;
})();

// Ground details, generated once: grass tufts, flowers and tall-grass patches.
export type Detail = { x: number; y: number; kind: 'tuft' | 'tuft2' | 'flower' | 'clover' | 'pebble'; color?: string };

export const DETAILS: Detail[] = (() => {
  const rand = rng(5);
  const out: Detail[] = [];
  for (let i = 0; i < 760; i++) {
    const p = { x: Math.floor(rand() * MAP_W), y: Math.floor(rand() * MAP_H) };
    if (inPond(p, 3) || inRect(p, HOUSE_BOX, 2)) continue;
    if (onPath(p, 1)) {
      if (rand() < 0.25) out.push({ ...p, kind: 'pebble' });
      continue;
    }
    const r = rand();
    out.push({ ...p, kind: r < 0.5 ? 'tuft' : r < 0.75 ? 'tuft2' : r < 0.93 ? 'clover' : 'flower', color: ['R', 'B', 'H', 'Y'][Math.floor(rand() * 4)] });
  }
  // Flower beds by the cottage.
  for (let k = 0; k < 18; k++) {
    const bed = { x: HOUSE.x + 2 + (k % 9) * 6, y: HOUSE.y + 56 + Math.floor(k / 9) * 5 + (k % 2) };
    if (onPath(bed, 2)) continue;
    out.push({ x: HOUSE.x + 2 + (k % 9) * 6, y: HOUSE.y + 56 + Math.floor(k / 9) * 5 + (k % 2), kind: 'flower', color: k % 3 === 0 ? 'B' : 'R' });
  }
  return out;
})();
