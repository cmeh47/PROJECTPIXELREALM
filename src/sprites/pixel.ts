import { colors } from '../theme';

// Sprite palette: one character per DESIGN.md token, used in the string maps below.
export const PAL: Record<string, string> = {
  K: colors.ink,
  P: colors.inkSoft,
  L: colors.lavender,
  D: colors.lavenderDeep,
  H: colors.white,
  S: colors.peach,
  R: colors.rose,
  r: colors.hpRose,
  B: colors.butter,
  b: colors.xpGold,
  V: colors.vellum,
  C: colors.scroll,
  Y: colors.sky,
  G: colors.manaBlue,
  M: colors.mint,
  m: colors.questGreen,
  f: colors.leaf,
  F: colors.leafDeep,
  w: colors.bark,
  W: colors.barkDeep,
  o: colors.stone,
  O: colors.stoneDeep,
  a: colors.skinFair,
  A: colors.skinFairShade,
  c: colors.skinPeachShade,
  n: colors.skinTan,
  N: colors.skinTanShade,
  e: colors.skinDeep,
  E: colors.skinDeepShade,
};

// A grid of art pixels. Sprites are drawn as fills, then outlined in ink.
export class Grid {
  readonly w: number;
  readonly h: number;
  readonly c: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.c = new Array(w * h).fill(null);
  }

  set(x: number, y: number, col: string) {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    this.c[iy * this.w + ix] = col;
  }

  get(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.c[y * this.w + x];
  }

  stamp(map: string[], ox: number, oy: number, swap?: Record<string, string>) {
    for (let j = 0; j < map.length; j++) {
      const row = map[j];
      for (let i = 0; i < row.length; i++) {
        let ch = row.charAt(i);
        if (ch === '.') continue;
        if (swap && swap[ch]) ch = swap[ch];
        this.set(ox + i, oy + j, PAL[ch]);
      }
    }
  }

  outline(col: string = PAL.K) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x + 1, y) || this.get(x - 1, y) || this.get(x, y + 1) || this.get(x, y - 1)) add.push(x, y);
      }
    }
    for (let k = 0; k < add.length; k += 2) this.set(add[k], add[k + 1], col);
  }

  tint(col: string) {
    for (let i = 0; i < this.c.length; i++) if (this.c[i]) this.c[i] = col;
  }
}

export function seg(g: Grid, x0: number, y0: number, x1: number, y1: number, col: string, th = 1) {
  const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1));
  for (let t = 0; t <= n; t++) {
    const x = x0 + ((x1 - x0) * t) / n;
    const y = y0 + ((y1 - y0) * t) / n;
    g.set(x, y, col);
    if (th > 1) g.set(x, y + 1, col);
    if (th > 2) g.set(x + 1, y, col);
  }
}

// A smear: a crescent between two angles, thickest in the middle of the swing.
export function arc(g: Grid, cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, cols: string[]) {
  const lo = Math.min(a0, a1);
  const hi = Math.max(a0, a1);
  const span = Math.max(1, hi - lo);
  for (let a = lo; a <= hi; a += 1.5) {
    const u = (a - lo) / span;
    const th = Math.max(1, Math.round((r1 - r0) * Math.sin(Math.PI * Math.min(1, 0.08 + u * 0.92))));
    const rad = (a * Math.PI) / 180;
    for (let r = r1 - th; r <= r1; r++) {
      g.set(cx + Math.cos(rad) * r, cy + Math.sin(rad) * r, cols[Math.min(cols.length - 1, r1 - r)]);
    }
  }
}

export function star(g: Grid, x: number, y: number, len: number, arm: string, core: string) {
  g.set(x, y, core);
  for (let i = 1; i <= len; i++) {
    const c = i < len ? arm : core;
    g.set(x + i, y, c);
    g.set(x - i, y, c);
    g.set(x, y + i, c);
    g.set(x, y - i, c);
  }
  if (len >= 3) {
    g.set(x + 1, y + 1, arm);
    g.set(x - 1, y - 1, arm);
    g.set(x + 1, y - 1, arm);
    g.set(x - 1, y + 1, arm);
  }
}
