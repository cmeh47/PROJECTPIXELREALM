// Your base: a meadow lot with your cottage, a path, a pond, choppable trees, four Shroomies
// and the old butcher's ruined hut. All positions are art pixels; the map is 26 x 36 tiles of 16 px.

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

// Path: from the door down to a little plaza, then east toward the pond. It starts under the
// cottage wall, and every top and bottom edge sits on a cobblestone course line (y = 1 mod 5),
// so no row of stones is cut in half.
export const PATH: { x: number; y: number; w: number; h: number }[] = [
  { x: DOOR.x - 12, y: DOOR.y - 7, w: 24, h: 140 },
  { x: DOOR.x - 32, y: DOOR.y + 128, w: 64, h: 41 },
  // On east past the pond and out through the gap in the tree ring, to the Boar Woods.
  { x: DOOR.x + 30, y: DOOR.y + 138, w: MAP_W - DOOR.x - 30, h: 21 },
];

// The gap in the east tree ring where the path leaves for the Boar Woods: no border trees grow
// with their trunks between y0 and y1, and walking past x into it takes you to the woods.
export const EAST_GAP = { x: MAP_W - 10, y0: 206, y1: 290, walkY0: DOOR.y + 136, walkY1: DOOR.y + 161 };
// The sign by the gap, with a boar head on its board. x, y = the foot of its post.
export const SIGN = { x: MAP_W - 30, y: DOOR.y + 128 };

export const TOAD_SPAWNS: Pt[] = [
  { x: 134, y: 244 },
  { x: 290, y: 178 },
  { x: 108, y: 432 },
  { x: 236, y: 470 },
];

// The old butcher's corner, bottom right: his knocked-down hut (a 46 x 36 frame, top-left here),
// with him standing in front of it. HUT_BOX is the footing you can't walk through.
export const HUT = { x: 322, y: 448 };
export const HUT_BOX = { x: HUT.x + 3, y: HUT.y + 20, w: 40, h: 13 };
export const BUTCHER = { x: HUT.x + 12, y: HUT.y + 50 };

// A small seeded generator, so the lot looks the same every time it loads.
export function rng(seed: number) {
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
      if (inRect(p, HOUSE_BOX, 26) || onPath(p, 20) || inPond(p, 22) || inRect(p, HUT_BOX, 26)) continue;
      if (Math.hypot(p.x - BUTCHER.x, p.y - BUTCHER.y) < 34) continue;
      if (Math.hypot(p.x - SPAWN.x, p.y - SPAWN.y) < 40) continue;
      if (TOAD_SPAWNS.some((t) => Math.hypot(p.x - t.x, p.y - t.y) < 40)) continue;
      out.push({ id: id++, ...p, variant: Math.floor(rand() * 3), border: false });
    }
  }
  // Clear the gap, then number the trees by their place in the list (the base indexes them by id).
  return out
    .filter((t) => !(t.border && t.x > MAP_W - 30 && t.y > EAST_GAP.y0 && t.y < EAST_GAP.y1))
    .filter((t) => t.border || Math.hypot(t.x - SIGN.x, t.y - SIGN.y) > 18)
    .map((t, i) => ({ ...t, id: i }));
})();

// Ground details, generated once: grass tufts, taller grass clumps, flowers and clover. Grass and
// flowers sway in the wind (see ground.ts); clover stays flat.
export type Detail = { x: number; y: number; kind: 'tuft' | 'tuft2' | 'tall' | 'flower' | 'clover'; color?: string; variant?: number };

export const DETAILS: Detail[] = (() => {
  const rand = rng(5);
  const out: Detail[] = [];
  for (let i = 0; i < 760; i++) {
    const p = { x: Math.floor(rand() * MAP_W), y: Math.floor(rand() * MAP_H) };
    // Grass keeps a little clear of the path: the edge tufts in ground.ts dress that rim.
    if (inPond(p, 3) || inRect(p, HOUSE_BOX, 2) || onPath(p, 4) || inRect(p, HUT_BOX, 2)) continue;
    const r = rand();
    out.push({ ...p, kind: r < 0.5 ? 'tuft' : r < 0.75 ? 'tuft2' : r < 0.93 ? 'clover' : 'flower', color: ['R', 'B', 'H', 'Y'][Math.floor(rand() * 4)] });
  }
  // Flower beds by the cottage.
  for (let k = 0; k < 18; k++) {
    const bed = { x: HOUSE.x + 2 + (k % 9) * 6, y: HOUSE.y + 56 + Math.floor(k / 9) * 5 + (k % 2) };
    if (onPath(bed, 2)) continue;
    out.push({ x: HOUSE.x + 2 + (k % 9) * 6, y: HOUSE.y + 56 + Math.floor(k / 9) * 5 + (k % 2), kind: 'flower', color: k % 3 === 0 ? 'B' : 'R' });
  }
  // Taller grass in small patches: at the foot of meadow trees and out in the open. Its own seed,
  // so the tufts and flowers above keep their places.
  const tall = rng(9);
  const centers: Pt[] = TREES.filter((t) => !t.border && tall() < 0.55).map((t) => ({ x: t.x + (tall() < 0.5 ? -11 : 8), y: t.y + 2 }));
  for (let k = 0; k < 14; k++) centers.push({ x: 24 + Math.floor(tall() * (MAP_W - 48)), y: 60 + Math.floor(tall() * (MAP_H - 80)) });
  for (const c of centers) {
    const n = 2 + Math.floor(tall() * 3);
    for (let j = 0; j < n; j++) {
      const p = { x: c.x + Math.floor(tall() * 14) - 7, y: c.y + Math.floor(tall() * 8) - 4 };
      if (inPond(p, 6) || inRect(p, HOUSE_BOX, 6) || onPath(p, 6) || inRect(p, HUT_BOX, 6) || Math.hypot(p.x - SPAWN.x, p.y - SPAWN.y) < 14) continue;
      out.push({ ...p, kind: 'tall', variant: Math.floor(tall() * 2) });
    }
  }
  return out;
})();
