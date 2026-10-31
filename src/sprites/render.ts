import { AlphaType, ColorType, createPicture, FilterMode, MipmapMode, Skia, type SkImage, type SkPicture } from '@shopify/react-native-skia';

import { colors } from '../theme';
import { foeLayers, heroLayers, type FoePose, type HeroPose, type Layer } from './characters';
import type { Grid } from './pixel';

// '#RRGGBB' to bytes, remembered per colour.
const rgbCache = new Map<string, [number, number, number]>();
function rgb(c: string): [number, number, number] {
  let v = rgbCache.get(c);
  if (!v) {
    if (/^#[0-9a-f]{6}$/i.test(c)) v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    else {
      const f = Skia.Color(c);
      v = [Math.round(f[0] * 255), Math.round(f[1] * 255), Math.round(f[2] * 255)];
    }
    rgbCache.set(c, v);
  }
  return v;
}

// A grid as a tiny image, one pixel per art pixel.
function gridImage(grid: Grid): SkImage | null {
  const bytes = new Uint8Array(grid.w * grid.h * 4);
  for (let i = 0; i < grid.c.length; i++) {
    const c = grid.c[i];
    if (!c) continue;
    const [r, g, b] = rgb(c);
    bytes[i * 4] = r;
    bytes[i * 4 + 1] = g;
    bytes[i * 4 + 2] = b;
    bytes[i * 4 + 3] = 255;
  }
  return Skia.Image.MakeImage(
    { width: grid.w, height: grid.h, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul },
    Skia.Data.fromBytes(bytes),
    grid.w * 4,
  );
}

// Each layer is baked into a tiny image and drawn s times larger without smoothing, so sprites stay
// crisp at whole-number scales and cost one draw each instead of one square per pixel.
function drawLayers(layers: Layer[], s: number) {
  const w = layers[0].grid.w;
  const h = layers[0].grid.h;
  return createPicture(
    (canvas) => {
      const paint = Skia.Paint();
      for (const { grid, alpha } of layers) {
        if (!grid.c.some(Boolean)) continue;
        const img = gridImage(grid);
        if (!img) continue;
        paint.setAlphaf(alpha);
        canvas.drawImageRectOptions(img, Skia.XYWHRect(0, 0, grid.w, grid.h), Skia.XYWHRect(0, 0, grid.w * s, grid.h * s), FilterMode.Nearest, MipmapMode.None, paint);
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

// Pass a builder rather than a grid where the grid is costly to make: it only runs on a cache miss,
// so a screen can ask for its sprites on every render.
export function gridPicture(key: string, grid: Grid | (() => Grid), s: number) {
  return cached(`g${key}${s}`, () => drawLayers([{ grid: typeof grid === 'function' ? grid() : grid, alpha: 1 }], s));
}

// For one-off effect frames (a lance or a bolt drawn between two live points): not cached.
export function fxPicture(grid: Grid, s: number) {
  return drawLayers([{ grid, alpha: 1 }], s);
}

// Foggy Forest backdrop, drawn to any field size: misty tree lines above the horizon,
// a scroll-colored clearing below it, grass tufts scattered through the depth.
function rng(seed: number) {
  let x = seed;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

export function backdropPicture(w: number, h: number, horizon: number, s: number) {
  return cached(`bg${w}x${h}@${s}`, () =>
    createPicture(
      (canvas) => {
        const paint = Skia.Paint();
        const rect = (x: number, y: number, rw: number, rh: number, c: string, a = 1) => {
          paint.setColor(Skia.Color(c));
          paint.setAlphaf(a);
          canvas.drawRect(Skia.XYWHRect(x * s, y * s, rw * s, rh * s), paint);
        };
        const tree = (cx: number, cy: number, r: number, a: number) => {
          rect(cx - 1, cy, 3, horizon - cy, colors.lavenderDeep, a);
          for (let dy = -r; dy <= r; dy++) {
            const hw = Math.round(Math.sqrt(r * r - dy * dy));
            rect(cx - hw, cy + dy, 2 * hw + 1, 1, colors.lavenderDeep, a);
          }
        };
        const rand = rng(7);
        rect(0, 0, w, h, colors.vellum);
        // Far line, then mid line, with fog between them.
        for (let x = 4; x < w + 8; x += 14 + Math.floor(rand() * 8)) tree(x, horizon - 20 - Math.floor(rand() * 8), 5 + Math.floor(rand() * 3), 0.09);
        rect(0, horizon - 18, w, 3, colors.vellum, 0.7);
        for (let x = 10; x < w + 8; x += 22 + Math.floor(rand() * 12)) tree(x, horizon - 30 - Math.floor(rand() * 10), 8 + Math.floor(rand() * 3), 0.14);
        rect(0, horizon - 10, w, 2, colors.vellum, 0.7);
        rect(0, horizon - 5, w, 4, colors.vellum, 0.45);
        // The clearing.
        rect(0, horizon, w, h - horizon, colors.scroll);
        for (let x = 0; x < w; x += 6) rect(x + Math.floor(rand() * 3), horizon, 3, 1, colors.vellum, 0.5);
        for (let i = 0; i < Math.floor((w * (h - horizon)) / 70); i++) {
          const gx = Math.floor(rand() * w);
          const gy = horizon + 3 + Math.floor(rand() * (h - horizon - 4));
          if (rand() < 0.6) {
            rect(gx, gy, 2, 1, colors.mint);
            rect(gx + 1, gy - 1, 1, 1, colors.mint);
          } else {
            rect(gx, gy, 1, 1, colors.inkSoft, 0.18);
          }
        }
        // Foreground trunks at the edges frame the shot.
        tree(-2, horizon - 26, 7, 0.22);
        tree(w + 1, horizon - 22, 6, 0.22);
      },
      { width: w * s, height: h * s },
    ),
  );
}
