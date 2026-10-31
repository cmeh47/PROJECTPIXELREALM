import { createPicture, Skia, type SkPicture } from '@shopify/react-native-skia';

import { bubbleGrid, heartGrid, houseGrid, hammerGrid, hutRuinsGrid, leafGrid, logGrid, oldManOverworld, shackGrid, stumpGrid, toadOverworld, treeGrid, type Dir } from '../sprites/overworld';
import { Grid, PAL } from '../sprites/pixel';
import { heroOw, type HeroLook } from '../sprites/hero';
import { gridPicture } from '../sprites/render';
import { staticGround, windFrames, type Px } from './ground';
import { MAP_H, MAP_W } from './map';

// Skia pictures for the base map, cached per scale.

const cache = new Map<string, SkPicture>();
function cached(key: string, build: () => SkPicture) {
  let pic = cache.get(key);
  if (!pic) {
    pic = build();
    cache.set(key, pic);
  }
  return pic;
}

export const heroOwPicture = (dir: Dir, frame: number, look: HeroLook, s: number) =>
  gridPicture(`ow-hero-${dir}-${frame}-${look.cls}-${look.sex}-${look.skin}-${look.hair}-${look.hairColor}`, heroOw(look, dir, frame), s);
export const toadOwPicture = (hop: number, look: number, flip: boolean, s: number) =>
  gridPicture(`ow-toad-${hop}-${look}-${flip ? 1 : 0}`, toadOverworld(hop, look, flip), s);
export const treePicture = (variant: number, flash: boolean, s: number) =>
  gridPicture(`ow-tree-${variant}-${flash ? 1 : 0}`, flash ? flashed(treeGrid(variant)) : treeGrid(variant), s);
export const stumpPicture = (s: number) => gridPicture('ow-stump', stumpGrid(), s);
export const housePicture = (s: number) => gridPicture('ow-house', houseGrid(0), s);
export const oldManPicture = (frame: number, s: number) => gridPicture(`ow-oldman-${frame}`, oldManOverworld(frame), s);
export const hutPicture = (s: number) => gridPicture('ow-hut-ruins', hutRuinsGrid(), s);
// The shack in eight build steps (progress is rounded down to the step), plus the finished shack at 1.
export const shackPicture = (progress: number, s: number) => {
  const step = progress >= 1 ? 8 : Math.floor(Math.max(0, progress) * 8);
  return gridPicture(`ow-shack-${step}`, shackGrid(step / 8), s);
};
export const hammerPicture = (frame: number, s: number) => gridPicture(`ow-hammer-${frame}`, hammerGrid(frame), s);
export const bubblePicture = (s: number) => gridPicture('ow-bubble', bubbleGrid(), s);
export const heartPicture = (s: number) => gridPicture('ow-heart', heartGrid(), s);
export const leafPicture = (s: number) => gridPicture('ow-leaf', leafGrid(), s);
export const logPicture = (s: number) => gridPicture('ow-log', logGrid(), s);

function flashed(g: Grid) {
  for (let i = 0; i < g.c.length; i++) if (g.c[i] && g.c[i] !== PAL.K) g.c[i] = PAL.H;
  return g;
}

// A short swipe of the hero's sword, drawn beside them while chopping. 12 x 12.
export function swipePicture(flip: boolean, s: number) {
  const g = new Grid(12, 12);
  const pts: [number, number][] = [[2, 2], [4, 1], [6, 1], [8, 2], [9, 4], [10, 6], [10, 8], [9, 10]];
  pts.forEach(([x, y], i) => {
    const fx = flip ? 11 - x : x;
    g.set(fx, y, i < 2 || i > 5 ? PAL.B : PAL.H);
    g.set(flip ? fx + 1 : fx - 1, y + 1, PAL.Y);
  });
  g.outline(PAL.K);
  return gridPicture(`ow-swipe-${flip ? 1 : 0}`, g, s);
}

// Records a list of ground pixels (see ground.ts) at scale s.
function record(list: Px[], s: number) {
  return createPicture(
    (canvas) => {
      const paint = Skia.Paint();
      for (const p of list) {
        paint.setColor(Skia.Color(p.c));
        paint.setAlphaf(p.a ?? 1);
        canvas.drawRect(Skia.XYWHRect(p.x * s, p.y * s, (p.w ?? 1) * s, (p.h ?? 1) * s), paint);
      }
    },
    { width: MAP_W * s, height: MAP_H * s },
  );
}

// The ground that never moves: meadow, cobbled path, pond and clover.
export function groundPicture(s: number) {
  return cached(`ow-ground-${s}`, () => record(staticGround(), s));
}

// The grass and flowers, one picture per wind band and lean: wind[band][LEANS.indexOf(lean)].
const windCache = new Map<number, SkPicture[][]>();
export function windPictures(s: number) {
  let pics = windCache.get(s);
  if (!pics) {
    pics = windFrames().map((band) => band.map((list) => record(list, s)));
    windCache.set(s, pics);
  }
  return pics;
}
