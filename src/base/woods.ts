// The Boar Woods: a small wood past the gap in the base's east tree ring, where three boars roam.
// Same art-pixel units and tree sprites as the base (map.ts). You come in at the west gap, on the
// same row as the path you left by, and walk back out through it to go home.
import { colors } from '../theme';
import type { Px } from './ground';
import { groveVariant, rng, type Pt } from './map';

export const WOODS_W = 24 * 16;
export const WOODS_H = 26 * 16;

// The west gap, lined up with the base's east path (map.ts EAST_GAP).
export const WEST_GAP = { y0: 196, y1: 280, walkY0: 224, walkY1: 249 };
export const ENTRY: Pt = { x: 22, y: 237 };

// Where each boar roots around. They trot within ROAM of home.
export const BOAR_HOMES: Pt[] = [
  { x: 150, y: 140 },
  { x: 290, y: 230 },
  { x: 170, y: 330 },
];
export const ROAM = 46;

export type WoodsTree = Pt & { id: number; variant: number; border: boolean };

export const WOODS_TREES: WoodsTree[] = (() => {
  const rand = rng(23);
  const out: WoodsTree[] = [];
  for (let x = 4; x < WOODS_W + 8; x += 20) {
    out.push({ id: 0, x, y: 22 + Math.floor(rand() * 6), variant: Math.floor(rand() * 3), border: true });
    out.push({ id: 0, x: x + 10, y: WOODS_H + 4 - Math.floor(rand() * 6), variant: Math.floor(rand() * 3), border: true });
  }
  for (let y = 48; y < WOODS_H; y += 24) {
    const wy = y + 12;
    if (!(wy > WEST_GAP.y0 && wy < WEST_GAP.y1)) out.push({ id: 0, x: 4 + Math.floor(rand() * 6), y: wy, variant: Math.floor(rand() * 3), border: true });
    out.push({ id: 0, x: WOODS_W - 6 - Math.floor(rand() * 6), y, variant: Math.floor(rand() * 3), border: true });
  }
  // A denser wood than the meadow, kept off the entry trail and each boar's patch.
  for (let gy = 90; gy < WOODS_H - 20; gy += 38) {
    for (let gx = 40; gx < WOODS_W - 24; gx += 36) {
      const p = { x: gx + Math.floor(rand() * 20) - 10, y: gy + Math.floor(rand() * 18) - 9 };
      if (rand() < 0.3) continue;
      // A clear trail runs in from the gap, past the middle boar's patch.
      if (p.x < 300 && Math.abs(p.y - ENTRY.y) < 24) continue;
      if (BOAR_HOMES.some((h) => Math.hypot(p.x - h.x, p.y - h.y) < 40)) continue;
      out.push({ id: 0, ...p, variant: Math.floor(rand() * 3), border: false });
    }
  }
  return out.map((t, i) => ({ ...t, id: i, variant: groveVariant(t, 3, 0.55) }));
})();

// The woods floor: the meadow's mint, thick with grass tufts, ferns and fallen leaves.
export function woodsGround(): Px[] {
  const rand = rng(41);
  const out: Px[] = [{ x: 0, y: 0, w: WOODS_W, h: WOODS_H, c: colors.mint }];
  for (let i = 0; i < 900; i++) {
    const x = Math.floor(rand() * WOODS_W);
    const y = Math.floor(rand() * WOODS_H);
    const c = rand() < 0.5 ? colors.leafDeep : colors.leaf;
    out.push({ x, y, c }, { x: x + 2, y, c }, { x: x + 1, y: y - 1, c });
  }
  // Ferns: little fans of leafDeep fronds, kept off the boars' rooting patches.
  for (let i = 0; i < 60; i++) {
    const x = 10 + Math.floor(rand() * (WOODS_W - 20));
    const y = 40 + Math.floor(rand() * (WOODS_H - 50));
    if (BOAR_HOMES.some((h) => Math.hypot(x - h.x, y - h.y) < 24)) continue;
    for (let k = -3; k <= 3; k++) {
      const tx = x + k * 2;
      const ty = y - 4 + Math.abs(k);
      const n = Math.max(Math.abs(tx - x), Math.abs(ty - y));
      for (let t = 0; t <= n; t++) out.push({ x: Math.round(x + ((tx - x) * t) / n), y: Math.round(y + ((ty - y) * t) / n), c: colors.leafDeep });
    }
  }
  // Rooted earth where the boars dig: a few bark specks.
  for (const h of BOAR_HOMES) {
    for (let i = 0; i < 26; i++) {
      const a = rand() * Math.PI * 2;
      const r = rand() * 18;
      out.push({ x: Math.round(h.x + Math.cos(a) * r), y: Math.round(h.y + Math.sin(a) * r * 0.6), c: colors.bark, a: 0.5 });
    }
  }
  // Fallen leaves in the woods' palette.
  for (let i = 0; i < 120; i++) {
    out.push({ x: Math.floor(rand() * WOODS_W), y: Math.floor(rand() * WOODS_H), w: 2, h: 1, c: rand() < 0.5 ? colors.butter : colors.peach, a: 0.8 });
  }
  return out;
}
