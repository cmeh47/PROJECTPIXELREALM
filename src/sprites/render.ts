import { createPicture, Skia, type SkPicture } from '@shopify/react-native-skia';

import { colors } from '../theme';
import { foeLayers, heroLayers, type FoePose, type HeroPose, type Layer } from './characters';
import type { Grid } from './pixel';

// Every art pixel becomes an s x s square, so sprites stay crisp at whole-number scales.
function drawLayers(layers: Layer[], s: number) {
  const w = layers[0].grid.w;
  const h = layers[0].grid.h;
  return createPicture(
    (canvas) => {
      const paint = Skia.Paint();
      for (const { grid, alpha } of layers) {
        for (let y = 0; y < grid.h; y++) {
          for (let x = 0; x < grid.w; x++) {
            const c = grid.c[y * grid.w + x];
            if (!c) continue;
            paint.setColor(Skia.Color(c));
            paint.setAlphaf(alpha);
            canvas.drawRect(Skia.XYWHRect(x * s, y * s, s, s), paint);
          }
        }
      }
    },
    { width: w * s, height: h * s },
  );
}

const cache = new Map<string, SkPicture>();

function cached(key: string, build: () => SkPicture) {
  let pic = cache.get(key);
  if (!pic) {
    pic = build();
    cache.set(key, pic);
  }
  return pic;
}

export function heroPicture(pose: HeroPose, s: number) {
  return cached(`h${s}${JSON.stringify(pose)}`, () => drawLayers(heroLayers(pose), s));
}

export function foePicture(pose: FoePose, s: number) {
  return cached(`f${s}${JSON.stringify(pose)}`, () => drawLayers(foeLayers(pose), s));
}

export function gridPicture(key: string, grid: Grid, s: number) {
  return cached(`g${key}${s}`, () => drawLayers([{ grid, alpha: 1 }], s));
}

// Foggy Forest backdrop: pale lollipop trees, fog bands, a scroll-colored path.
export const SCENE_W = 116;
export const SCENE_H = 72;
export const SCENE_GROUND = 62;

const TREES: [number, number, number, number][] = [
  [8, 32, 8, 0.14], [30, 28, 6, 0.14], [54, 34, 9, 0.14], [104, 30, 8, 0.14],
  [84, 24, 6, 0.1], [16, 46, 5, 0.24], [110, 48, 5, 0.24],
];

export function backdropPicture(s: number) {
  return cached(`bg${s}`, () =>
    createPicture(
      (canvas) => {
        const paint = Skia.Paint();
        const rect = (x: number, y: number, w: number, h: number, c: string, a = 1) => {
          paint.setColor(Skia.Color(c));
          paint.setAlphaf(a);
          canvas.drawRect(Skia.XYWHRect(x * s, y * s, w * s, h * s), paint);
        };
        rect(0, 0, SCENE_W, SCENE_H, colors.vellum);
        for (const [cx, cy, r, a] of TREES) {
          rect(cx - 1, cy, 3, SCENE_GROUND - cy, colors.lavenderDeep, a);
          for (let dy = -r; dy <= r; dy++) {
            const w = Math.round(Math.sqrt(r * r - dy * dy));
            rect(cx - w, cy + dy, 2 * w + 1, 1, colors.lavenderDeep, a);
          }
        }
        rect(0, 50, SCENE_W, 3, colors.vellum, 0.7);
        rect(0, 38, SCENE_W, 2, colors.vellum, 0.7);
        rect(0, 55, SCENE_W, 4, colors.vellum, 0.45);
        rect(0, SCENE_GROUND, SCENE_W, SCENE_H - SCENE_GROUND, colors.scroll);
        for (let x = 4; x < SCENE_W; x += 11) {
          rect(x, SCENE_GROUND - 1, 2, 1, colors.mint);
          rect(x + 1, SCENE_GROUND - 2, 1, 1, colors.mint);
        }
      },
      { width: SCENE_W * s, height: SCENE_H * s },
    ),
  );
}
