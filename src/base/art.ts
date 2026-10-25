import { createPicture, Skia, type SkPicture } from '@shopify/react-native-skia';

import { bubbleGrid, heartGrid, heroOverworld, houseGrid, leafGrid, logGrid, stumpGrid, toadOverworld, treeGrid, type Dir } from '../sprites/overworld';
import { Grid, PAL } from '../sprites/pixel';
import { gridPicture } from '../sprites/render';
import { colors } from '../theme';
import { DETAILS, HOUSE_BOX, MAP_H, MAP_W, PATH, POND, inPond, onPath } from './map';

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

export const heroOwPicture = (dir: Dir, frame: number, look: number, s: number) =>
  gridPicture(`ow-hero-${dir}-${frame}-${look}`, heroOverworld(dir, frame, look), s);
export const toadOwPicture = (hop: number, look: number, flip: boolean, s: number) =>
  gridPicture(`ow-toad-${hop}-${look}-${flip ? 1 : 0}`, toadOverworld(hop, look, flip), s);
export const treePicture = (variant: number, flash: boolean, s: number) =>
  gridPicture(`ow-tree-${variant}-${flash ? 1 : 0}`, flash ? flashed(treeGrid(variant)) : treeGrid(variant), s);
export const stumpPicture = (s: number) => gridPicture('ow-stump', stumpGrid(), s);
export const housePicture = (s: number) => gridPicture('ow-house', houseGrid(0), s);
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

// The ground: meadow, path, pond and scattered details, as one picture.
export function groundPicture(s: number) {
  return cached(`ow-ground-${s}`, () =>
    createPicture(
      (canvas) => {
        const paint = Skia.Paint();
        const px = (x: number, y: number, w: number, h: number, c: string, a = 1) => {
          paint.setColor(Skia.Color(c));
          paint.setAlphaf(a);
          canvas.drawRect(Skia.XYWHRect(x * s, y * s, w * s, h * s), paint);
        };
        // Meadow with a soft two-tone tile pattern, like DS grass.
        px(0, 0, MAP_W, MAP_H, colors.mint);
        for (let ty = 0; ty < MAP_H; ty += 16) {
          for (let tx = 0; tx < MAP_W; tx += 16) {
            if (((tx + ty) / 16) % 2 === 0) {
              px(tx + 6, ty + 7, 1, 1, colors.white, 0.35);
              px(tx + 13, ty + 2, 1, 1, colors.white, 0.35);
              continue;
            }
            px(tx + 3, ty + 4, 1, 1, colors.questGreen, 0.35);
            px(tx + 11, ty + 10, 1, 1, colors.questGreen, 0.35);
            px(tx + 12, ty + 9, 1, 1, colors.questGreen, 0.35);
          }
        }
        // Path: scroll-colored dirt with a peach rim and rounded corners.
        for (const r of PATH) px(r.x, r.y, r.w, r.h, colors.scroll);
        for (let y = 0; y < MAP_H; y++) {
          for (let x = 0; x < MAP_W; x++) {
            const on = onPath({ x, y });
            if (!on) continue;
            const edge = !onPath({ x: x + 1, y }) || !onPath({ x: x - 1, y }) || !onPath({ x, y: y + 1 }) || !onPath({ x, y: y - 1 });
            if (edge) px(x, y, 1, 1, colors.peach);
          }
        }
        // Pond: ink rim, mana-blue shore, sky water, lily pads and sparkles.
        for (let y = POND.y - POND.ry - 3; y <= POND.y + POND.ry + 3; y++) {
          for (let x = POND.x - POND.rx - 3; x <= POND.x + POND.rx + 3; x++) {
            const p = { x, y };
            if (inPond(p)) px(x, y, 1, 1, inPond(p, -3) ? colors.sky : colors.manaBlue);
            else if (inPond(p, 1)) px(x, y, 1, 1, colors.ink);
          }
        }
        for (const [lx, ly] of [[POND.x - 14, POND.y - 4], [POND.x + 12, POND.y + 8]]) {
          px(lx, ly, 5, 3, colors.questGreen);
          px(lx + 1, ly - 1, 3, 1, colors.questGreen);
          px(lx + 2, ly, 1, 2, colors.mint);
        }
        for (const [sx, sy] of [[POND.x - 22, POND.y - 10], [POND.x + 4, POND.y - 12], [POND.x + 20, POND.y - 2], [POND.x - 4, POND.y + 12]]) {
          px(sx, sy, 3, 1, colors.white);
        }
        // Details.
        const tone: Record<string, string> = { R: colors.rose, B: colors.butter, H: colors.white, Y: colors.sky };
        for (const d of DETAILS) {
          if (d.kind === 'tuft') {
            px(d.x, d.y, 1, 2, colors.questGreen);
            px(d.x + 2, d.y, 1, 2, colors.questGreen);
            px(d.x + 1, d.y + 1, 1, 1, colors.questGreen);
          } else if (d.kind === 'tuft2') {
            px(d.x, d.y + 1, 1, 1, colors.questGreen);
            px(d.x + 1, d.y, 1, 2, colors.questGreen);
            px(d.x + 2, d.y + 1, 1, 1, colors.questGreen);
            px(d.x + 1, d.y - 1, 1, 1, colors.white, 0.6);
          } else if (d.kind === 'clover') {
            px(d.x, d.y, 2, 2, colors.questGreen, 0.55);
            px(d.x + 2, d.y + 1, 2, 2, colors.questGreen, 0.55);
          } else if (d.kind === 'pebble') {
            px(d.x, d.y, 2, 1, colors.peach);
            px(d.x, d.y + 1, 2, 1, colors.inkSoft, 0.35);
          } else {
            const c = tone[d.color ?? 'R'];
            px(d.x + 1, d.y, 1, 1, c);
            px(d.x, d.y + 1, 1, 1, c);
            px(d.x + 2, d.y + 1, 1, 1, c);
            px(d.x + 1, d.y + 2, 1, 1, c);
            px(d.x + 1, d.y + 1, 1, 1, colors.butter);
            px(d.x + 1, d.y + 3, 1, 1, colors.questGreen);
          }
        }
        // A soft ink shadow where the cottage meets the grass.
        px(HOUSE_BOX.x + 2, HOUSE_BOX.y + HOUSE_BOX.h, HOUSE_BOX.w - 2, 2, colors.ink, 0.1);
      },
      { width: MAP_W * s, height: MAP_H * s },
    ),
  );
}
