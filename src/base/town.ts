// The town, south of your base: dirt streets lined with five wooden buildings, a well in the
// square and the witch's hut tucked in the bottom-left corner. Same art-pixel units and tree
// sprites as the base (map.ts). You come in through the gap in the north tree ring, at the end of
// the base's south path, and walk back out through it to go home.
import { BUILDING_SIZE, PROP_SIZE, type BuildingKind, type PropKind } from '../sprites/town';
import { treeVariant } from '../sprites/overworld';
import { colors } from '../theme';
import type { Px } from './ground';
import { rng, type Pt } from './map';

export const TOWN_W = 26 * 16;
export const TOWN_H = 35 * 16;

// The north gap, lined up with the base's south path (map.ts SOUTH_GAP).
export const NORTH_GAP = { x0: 186, x1: 230, walkX0: 194, walkX1: 222 };
export const TOWN_ENTRY: Pt = { x: 208, y: 44 };

type Rect = { x: number; y: number; w: number; h: number };
const inRect = (p: Pt, r: Rect, pad = 0) => p.x >= r.x - pad && p.x < r.x + r.w + pad && p.y >= r.y - pad && p.y < r.y + r.h + pad;

// Packed-earth streets: the main street running south from the gap, a street in front of each row
// of buildings, the square round the well, and a narrow trail down to the witch's door.
export const STREETS: Rect[] = [
  { x: 188, y: 0, w: 40, h: 470 },
  { x: 40, y: 152, w: 336, h: 24 },
  { x: 156, y: 224, w: 104, h: 76 },
  { x: 40, y: 372, w: 336, h: 24 },
  { x: 86, y: 396, w: 15, h: 110 },
  { x: 24, y: 492, w: 77, h: 14 },
];
export const onStreet = (p: Pt, pad = 0) => STREETS.some((r) => inRect(p, r, pad));

export type Building = {
  kind: BuildingKind;
  name: string;
  x: number; // frame top-left
  y: number;
  door: Pt; // where you stand to knock
  box: Rect; // what you can't walk through: the whole lot, so you never vanish behind a roof
};

const building = (kind: BuildingKind, name: string, x: number, y: number, doorX: number): Building => {
  const { w, h } = BUILDING_SIZE[kind];
  const feet = y + h - 2;
  return { kind, name, x, y, door: { x: x + doorX, y: feet + 7 }, box: { x: x + 3, y: y + 6, w: w - 6, h: h - 6 } };
};

export const BUILDINGS: Building[] = [
  building('critters', 'Critter Store', 98, 92, 16),
  building('bar', 'The Bar', 250, 82, 40),
  building('sheriff', "Sheriff's Office", 94, 308, 31),
  building('clinic', 'Medical Center', 256, 314, 33),
  building('witch', "Witch's Hut", 18, 420, 17),
];
// The witch's chimney mouth, where her smoke rises.
export const WITCH_SMOKE: Pt = { x: BUILDINGS[4].x + 5, y: BUILDINGS[4].y + 17 };

// The critter store's owner stands by her door; her three helpers hop round the shop front.
const STORE = BUILDINGS[0];
export const OWNER_POST: Pt = { x: STORE.x + 50, y: STORE.y + 72 };
export const HELPER_HOMES: Pt[] = [
  { x: STORE.x - 14, y: STORE.y + 70 },
  { x: STORE.x + 30, y: STORE.y + 80 },
  { x: STORE.x + 70, y: STORE.y + 82 },
];

export type Prop = { kind: PropKind; x: number; y: number; id: number }; // x, y = foot centre
export const PROPS: Prop[] = (
  [
  // Lamps down the main street, alternating sides.
  ...[60, 196, 326, 444].map((y, i) => ({ kind: 'lamp' as const, x: i % 2 ? 236 : 180, y })),
  ...[128, 262].map((y, i) => ({ kind: 'lamp' as const, x: i % 2 ? 180 : 236, y })),
  { kind: 'well', x: 208, y: 268 },
  // Barrels and crates by the bar and the store.
  { kind: 'barrel', x: 340, y: 150 },
  { kind: 'barrel', x: 352, y: 146 },
  { kind: 'crate', x: 346, y: 160 },
  { kind: 'crate', x: 86, y: 148 },
  { kind: 'barrel', x: 74, y: 146 },
  // The hitching rail outside the sheriff's, planters by the clinic door.
  { kind: 'rail', x: 70, y: 384 },
  { kind: 'planter', x: 274, y: 380 },
  { kind: 'planter', x: 306, y: 380 },
  // Fences either side of the way in.
  { kind: 'fence', x: 160, y: 46 },
  { kind: 'fence', x: 176, y: 46 },
  { kind: 'fence', x: 240, y: 46 },
  { kind: 'fence', x: 256, y: 46 },
  // The witch's cauldron, bubbling in her yard.
  { kind: 'cauldron', x: 120, y: 490 },
] as Omit<Prop, 'id'>[]
).map((p, id) => ({ ...p, id }));
export const propBox = (p: Prop): Rect => {
  const { w } = PROP_SIZE[p.kind];
  const half = p.kind === 'well' ? 12 : p.kind === 'lamp' ? 2 : Math.floor(w / 2) - 1;
  const depth = p.kind === 'well' ? 12 : p.kind === 'lamp' ? 2 : 5;
  return { x: p.x - half, y: p.y - depth, w: half * 2, h: depth + 2 };
};

export type TownTree = Pt & { id: number; variant: number };

// A tree ring round the town (open at the north gap), a few trees between the lots, an orchard in
// the south-east, and a purple grove round the witch's corner.
export const TOWN_TREES: TownTree[] = (() => {
  const rand = rng(31);
  const out: Omit<TownTree, 'id'>[] = [];
  for (let x = 4; x < TOWN_W + 8; x += 22) {
    if (!(x > NORTH_GAP.x0 - 12 && x < NORTH_GAP.x1 + 4)) out.push({ x, y: 22 + Math.floor(rand() * 6), variant: Math.floor(rand() * 3) });
    out.push({ x: x + 10, y: TOWN_H + 4 - Math.floor(rand() * 6), variant: Math.floor(rand() * 3) });
  }
  for (let y = 52; y < TOWN_H; y += 26) {
    const wl = y > 400 ? treeVariant('purple', Math.floor(rand() * 2)) : Math.floor(rand() * 3);
    out.push({ x: 4 + Math.floor(rand() * 6), y, variant: wl });
    out.push({ x: TOWN_W - 6 - Math.floor(rand() * 6), y: y + 12, variant: Math.floor(rand() * 3) });
  }
  const green: [number, number][] = [
    [36, 76], [62, 104], [32, 132], [380, 72], [362, 112],
    [42, 214], [76, 244], [34, 290], [118, 222], [124, 290],
    [298, 220], [342, 250], [384, 212], [320, 296], [374, 300],
    [260, 446], [302, 474], [348, 434], [384, 488], [322, 524], [252, 516], [196, 500],
  ];
  green.forEach(([x, y], i) => out.push({ x, y, variant: i % 7 === 3 ? treeVariant('gold', i) : Math.floor(rand() * 3) }));
  const purple: [number, number][] = [[130, 440], [150, 522], [62, 410], [104, 540], [166, 470]];
  purple.forEach(([x, y], i) => out.push({ x, y, variant: treeVariant('purple', i) }));
  return out.filter((t) => !onStreet(t, 5)).map((t, i) => ({ ...t, id: i }));
})();

// ---------- The ground ----------

// The street mask: every street rect, with the outside corners rounded off.
function streetMask() {
  const m = new Uint8Array(TOWN_W * TOWN_H);
  for (const r of STREETS) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (x >= 0 && y >= 0 && x < TOWN_W && y < TOWN_H) m[y * TOWN_W + x] = 1;
  }
  const corner: [number, number][] = [[0, 0], [1, 0], [0, 1]];
  for (const r of STREETS) {
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const cx = sx > 0 ? r.x : r.x + r.w - 1;
      const cy = sy > 0 ? r.y : r.y + r.h - 1;
      for (const [dx, dy] of corner) {
        const p = { x: cx + dx * sx, y: cy + dy * sy };
        if (STREETS.some((o) => o !== r && inRect(p, o, 1))) continue;
        if (p.y <= 0) continue;
        m[p.y * TOWN_W + p.x] = 0;
      }
    }
  }
  return m;
}

export function townGround(): Px[] {
  const rand = rng(53);
  const out: Px[] = [{ x: 0, y: 0, w: TOWN_W, h: TOWN_H, c: colors.mint }];
  const m = streetMask();
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < TOWN_W && y < TOWN_H && m[y * TOWN_W + x] === 1;
  // Dirt in runs along each row, a pale rim where it meets the grass.
  for (let y = 0; y < TOWN_H; y++) {
    let x = 0;
    while (x < TOWN_W) {
      if (!on(x, y)) {
        x++;
        continue;
      }
      const start = x;
      while (x < TOWN_W && on(x, y)) x++;
      out.push({ x: start, y, w: x - start, h: 1, c: colors.scroll });
    }
  }
  for (let y = 0; y < TOWN_H; y++) {
    for (let x = 0; x < TOWN_W; x++) {
      if (!on(x, y)) continue;
      if (!on(x + 1, y) || !on(x - 1, y) || !on(x, y + 1) || (!on(x, y - 1) && y > 0)) out.push({ x, y, c: colors.barkPale });
    }
  }
  // Wheel ruts down the main street, and pebbles everywhere.
  for (let y = 2; y < 466; y++) {
    if (y % 9 < 6) {
      out.push({ x: 199, y, c: colors.barkPale });
      out.push({ x: 217, y, c: colors.barkPale });
    }
  }
  for (let i = 0; i < 700; i++) {
    const x = Math.floor(rand() * TOWN_W);
    const y = Math.floor(rand() * TOWN_H);
    if (!on(x, y) || !on(x + 2, y + 1) || !on(x - 1, y)) continue;
    const r = rand();
    if (r < 0.45) out.push({ x, y, c: colors.barkPaleShade, a: 0.7 });
    else if (r < 0.8) out.push({ x, y, w: 2, h: 1, c: colors.stoneDeep });
    else out.push({ x, y, w: 2, h: 1, c: colors.stone }, { x, y: y + 1, w: 2, h: 1, c: colors.stoneDeep });
  }
  // Grass tufts and flowers on the green, kept off the streets and out from under the buildings.
  const under = (x: number, y: number) => BUILDINGS.some((b) => inRect({ x, y }, b.box, 2));
  for (let i = 0; i < 620; i++) {
    const x = Math.floor(rand() * TOWN_W);
    const y = Math.floor(rand() * TOWN_H);
    const r = rand();
    const col = ['R', 'B', 'H', 'Y'][Math.floor(rand() * 4)];
    if (onStreet({ x, y }, 3) || under(x, y)) continue;
    if (r < 0.62) {
      const c = r < 0.31 ? colors.leafDeep : colors.leaf;
      out.push({ x, y, c }, { x: x + 2, y, c }, { x: x + 1, y: y - 1, c });
    } else if (r < 0.85) {
      out.push({ x, y, c: colors.questGreen }, { x: x + 1, y: y + 1, c: colors.questGreen }, { x: x - 1, y: y + 1, c: colors.questGreen });
    } else {
      const fc = col === 'R' ? colors.rose : col === 'B' ? colors.butter : col === 'H' ? colors.white : colors.sky;
      out.push({ x, y: y + 1, c: colors.leafDeep }, { x: x - 1, y, c: fc }, { x: x + 1, y, c: fc }, { x, y: y - 1, c: fc }, { x, y, c: colors.xpGold });
    }
  }
  // The witch's yard: trampled earth with a ring of little purple toadstools.
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2;
    const x = Math.round(120 + Math.cos(a) * 17);
    const y = Math.round(490 + Math.sin(a) * 9);
    if (onStreet({ x, y }, 1)) continue;
    out.push({ x: x - 1, y: y - 1, w: 3, h: 1, c: colors.epicPurple }, { x, y, c: colors.vellum });
  }
  return out;
}
