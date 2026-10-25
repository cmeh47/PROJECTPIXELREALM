// Battle field geometry. The field is sized to the screen in art pixels, so the scene
// always fills its space edge to edge at a whole-number pixel scale.

export type Slot = { x: number; y: number }; // body center x and feet y, in art pixels

export type Field = {
  s: number;
  w: number;
  h: number;
  horizon: number;
  ground: number;
  heroes: Slot[];
  foes: Slot[];
};

// How many art pixels wide the camera shows. A full party zooms out to fit everyone.
const VIEW_SOLO = 76;
const VIEW_FULL = 128;

export const horizonOf = (h: number) => Math.round(h * 0.5);

// Hero and enemy formations as [x fraction of width, feet offset from the ground line].
// Index 0 is always you and your target, standing on the same lane so dashes stay level.
const HERO_SOLO: [number, number][] = [[0.2, 0]];
const FOE_SOLO: [number, number][] = [[0.74, 0]];
const HERO_FULL: [number, number][] = [[0.32, 0], [0.26, -20], [0.15, 12], [0.1, -8]];
const FOE_FULL: [number, number][] = [[0.7, 0], [0.78, -20], [0.88, 10]];

export function fieldLayout(boxW: number, boxH: number, full: boolean): Field {
  const s = Math.max(2, Math.floor(boxW / (full ? VIEW_FULL : VIEW_SOLO)));
  const w = Math.ceil(boxW / s);
  const h = Math.ceil(boxH / s);
  const horizon = horizonOf(h);
  const ground = Math.round(horizon + (h - horizon) * 0.42);
  const place = ([fx, dy]: [number, number]) => ({ x: Math.round(w * fx), y: ground + dy });
  return {
    s,
    w,
    h,
    horizon,
    ground,
    heroes: (full ? HERO_FULL : HERO_SOLO).map(place),
    foes: (full ? FOE_FULL : FOE_SOLO).map(place),
  };
}
