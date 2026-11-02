import { Skia, type SkImage } from '@shopify/react-native-skia';

import { bubbleGrid, heartGrid, houseGrid, hammerGrid, hutRuinsGrid, leafGrid, logGrid, oldManOverworld, shackGrid, stumpGrid, toadOverworld, treeGrid, type Dir, type TreeKind } from '../sprites/overworld';
import { bagGrid, boarOverworld, coinGrid, meatGrid, signGrid } from '../sprites/boar';
import { Grid, PAL, star } from '../sprites/pixel';
import { heroOw, type HeroLook } from '../sprites/hero';
import { merchantOverworld, standGrid } from '../sprites/merchant';
import { buildingGrid, helperOverworld, ownerOverworld, propGrid, smokeGrid, townSignGrid, type BuildingKind, type PropKind } from '../sprites/town';
import { gridPicture } from '../sprites/render';
import { staticGround, windFrames, type Px } from './ground';
import { MAP_H, MAP_W } from './map';

// Skia pictures for the base map's sprites, cached per scale, and baked images for its ground.

export const heroOwPicture = (dir: Dir, frame: number, look: HeroLook, s: number) =>
  gridPicture(`ow-hero-${dir}-${frame}-${look.cls}-${look.sex}-${look.skin}-${look.hair}-${look.hairColor}`, () => heroOw(look, dir, frame), s);
export const toadOwPicture = (hop: number, look: number, flip: boolean, s: number) =>
  gridPicture(`ow-toad-${hop}-${look}-${flip ? 1 : 0}`, () => toadOverworld(hop, look, flip), s);
export const treePicture = (variant: number, flash: boolean, s: number) =>
  gridPicture(`ow-tree-${variant}-${flash ? 1 : 0}`, () => (flash ? flashed(treeGrid(variant)) : treeGrid(variant)), s);
export const stumpPicture = (s: number) => gridPicture('ow-stump', () => stumpGrid(), s);
export const housePicture = (s: number) => gridPicture('ow-house', () => houseGrid(0), s);
export const oldManPicture = (frame: number, s: number) => gridPicture(`ow-oldman-${frame}`, () => oldManOverworld(frame), s);
export const hutPicture = (s: number) => gridPicture('ow-hut-ruins', () => hutRuinsGrid(), s);
// The shack in eight build steps (progress is rounded down to the step), plus the finished shack at 1.
export const shackPicture = (progress: number, s: number) => {
  const step = progress >= 1 ? 8 : Math.floor(Math.max(0, progress) * 8);
  return gridPicture(`ow-shack-${step}`, () => shackGrid(step / 8), s);
};
export const hammerPicture = (frame: number, s: number) => gridPicture(`ow-hammer-${frame}`, () => hammerGrid(frame), s);
export const bubblePicture = (s: number) => gridPicture('ow-bubble', () => bubbleGrid(), s);
export const heartPicture = (s: number) => gridPicture('ow-heart', () => heartGrid(), s);
export const leafPicture = (s: number, kind: TreeKind = 'green') => gridPicture(`ow-leaf-${kind}`, () => leafGrid(kind), s);
export const logPicture = (s: number) => gridPicture('ow-log', () => logGrid(), s);
export const boarOwPicture = (frame: number, flip: boolean, s: number) => gridPicture(`ow-boar-${frame}-${flip ? 1 : 0}`, () => boarOverworld(frame, flip), s);
export const meatPicture = (s: number) => gridPicture('ow-meat', () => meatGrid(), s);
export const bagPicture = (open: boolean, s: number) => gridPicture(`ow-bag-${open ? 1 : 0}`, () => bagGrid(open), s);
export const coinPicture = (s: number) => gridPicture('ow-coin', () => coinGrid(), s);
export const merchantOwPicture = (dir: Dir, frame: number, scared: boolean, s: number) =>
  gridPicture(`ow-merchant-${dir}-${frame}-${scared ? 1 : 0}`, () => merchantOverworld(dir, frame, scared), s);
export const standPicture = (done: boolean, s: number) => gridPicture(`ow-stand-${done ? 1 : 0}`, () => standGrid(done), s);
export const signPicture = (s: number) => gridPicture('ow-sign', () => signGrid(), s);
// The town (sprites/town.ts).
export const townSignPicture = (s: number) => gridPicture('ow-town-sign', () => townSignGrid(), s);
export const buildingPicture = (kind: BuildingKind, s: number) => gridPicture(`ow-building-${kind}`, () => buildingGrid(kind), s);
export const propPicture = (kind: PropKind, s: number) => gridPicture(`ow-prop-${kind}`, () => propGrid(kind), s);
export const ownerOwPicture = (dir: Dir, frame: number, s: number) => gridPicture(`ow-owner-${dir}-${frame}`, () => ownerOverworld(dir, frame), s);
export const helperOwPicture = (hop: number, look: number, flip: boolean, s: number) =>
  gridPicture(`ow-helper-${hop}-${look}-${flip ? 1 : 0}`, () => helperOverworld(hop, look, flip), s);
export const smokePicture = (frame: number, s: number) => gridPicture(`ow-smoke-${frame}`, () => smokeGrid(frame), s);
// Dizzy stars circling a boar's head after it charges past you, 14 x 6, in three turns.
export const dizzyPicture = (frame: number, s: number) =>
  gridPicture(
    `ow-dizzy-${frame}`,
    () => {
      const g = new Grid(16, 7);
      const pos: [number, number][] = [[2, 3], [7, 1], [12, 3], [7, 5]];
      for (let i = 0; i < 3; i++) {
        const [x, y] = pos[(i + frame) % 4];
        star(g, x, y, 1, PAL.B, PAL.b);
      }
      return g;
    },
    s,
  );
// A tap marker: a dotted lavender ring on the ground under what you tapped, 20 x 10.
export const tapRingPicture = (s: number) =>
  gridPicture(
    'ow-tap-ring',
    () => {
      const g = new Grid(20, 10);
      for (let a = 0; a < 360; a += 20) g.set(10 + Math.cos((a * Math.PI) / 180) * 9, 5 + Math.sin((a * Math.PI) / 180) * 4, PAL.D);
      return g;
    },
    s,
  );

function flashed(g: Grid) {
  for (let i = 0; i < g.c.length; i++) if (g.c[i] && g.c[i] !== PAL.K) g.c[i] = PAL.H;
  return g;
}

// A short swipe of the hero's sword, drawn beside them while chopping. 12 x 12.
export function swipePicture(flip: boolean, s: number) {
  return gridPicture(
    `ow-swipe-${flip ? 1 : 0}`,
    () => {
      const g = new Grid(12, 12);
      const pts: [number, number][] = [[2, 2], [4, 1], [6, 1], [8, 2], [9, 4], [10, 6], [10, 8], [9, 10]];
      pts.forEach(([x, y], i) => {
        const fx = flip ? 11 - x : x;
        g.set(fx, y, i < 2 || i > 5 ? PAL.B : PAL.H);
        g.set(flip ? fx + 1 : fx - 1, y + 1, PAL.Y);
      });
      g.outline(PAL.K);
      return g;
    },
    s,
  );
}

// Bakes a list of ground pixels (see ground.ts) into an image at one pixel per art pixel, cropped to
// what the list covers. The map draws these scaled up with nearest-neighbour sampling: one textured
// quad per layer instead of replaying thousands of squares every frame.
export type Baked = { image: SkImage; x: number; y: number; w: number; h: number };
export function bake(list: Px[], mapW = MAP_W, mapH = MAP_H): Baked | null {
  if (!list.length) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of list) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + (p.w ?? 1));
    y1 = Math.max(y1, p.y + (p.h ?? 1));
  }
  x0 = Math.max(0, Math.floor(x0));
  y0 = Math.max(0, Math.floor(y0));
  x1 = Math.min(mapW, Math.ceil(x1));
  y1 = Math.min(mapH, Math.ceil(y1));
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return null;
  // A CPU surface, so the image isn't tied to one thread's GPU context.
  const surface = Skia.Surface.Make(w, h);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  const paint = Skia.Paint();
  for (const p of list) {
    paint.setColor(Skia.Color(p.c));
    paint.setAlphaf(p.a ?? 1);
    canvas.drawRect(Skia.XYWHRect(p.x - x0, p.y - y0, p.w ?? 1, p.h ?? 1), paint);
  }
  surface.flush();
  const image = surface.makeImageSnapshot();
  return { image, x: x0, y: y0, w, h };
}

// The ground that never moves: meadow, cobbled path, pond and clover.
let groundBaked: Baked | null | undefined;
export function groundImage() {
  if (groundBaked === undefined) groundBaked = bake(staticGround());
  return groundBaked;
}

// The grass and flowers, one image per wind band and lean: wind[band][LEANS.indexOf(lean)].
let windBaked: (Baked | null)[][] | undefined;
export function windImages() {
  if (!windBaked) windBaked = windFrames().map((band) => band.map((list) => bake(list)));
  return windBaked;
}
