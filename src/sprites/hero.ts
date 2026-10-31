import { Grid, PAL, seg } from './pixel';

// The player's hero as they made them on the character creation screen. Every hero sprite (the
// base, battle, portraits, the creator's preview) is drawn from one of these.
export type HeroClass = 'warrior' | 'mage';
export type HeroSex = 'male' | 'female';
export type HeroLook = { cls: HeroClass; sex: HeroSex; skin: number; hair: number; hairColor: number };

export const DEFAULT_LOOK: HeroLook = { cls: 'warrior', sex: 'male', skin: 1, hair: 0, hairColor: 0 };

// Art maps draw skin with S (shade s, cheek k) and hair with h (shade z, shine u); a look swaps
// them for palette keys. Cheeks are rose on light skin and hpRose on darker skin so they still show.
export const SKIN_TONES: { name: string; swap: Record<string, string> }[] = [
  { name: 'Fair', swap: { S: 'a', s: 'A', k: 'R' } },
  { name: 'Peach', swap: { S: 'S', s: 'c', k: 'R' } },
  { name: 'Tan', swap: { S: 'n', s: 'N', k: 'r' } },
  { name: 'Deep', swap: { S: 'e', s: 'E', k: 'r' } },
];

export const HAIR_COLORS: { name: string; swap: Record<string, string> }[] = [
  { name: 'Chestnut', swap: { h: 'w', z: 'W', u: 'S' } },
  { name: 'Wheat', swap: { h: 'B', z: 'b', u: 'H' } },
  { name: 'Ink', swap: { h: 'P', z: 'K', u: 'O' } },
  { name: 'Lilac', swap: { h: 'L', z: 'D', u: 'H' } },
  { name: 'Rose', swap: { h: 'R', z: 'r', u: 'H' } },
];

export const HAIR_STYLES = ['Crop', 'Spiky', 'Long', 'Braid'] as const;

export function lookSwap(look: HeroLook): Record<string, string> {
  return { ...SKIN_TONES[look.skin]?.swap, ...HAIR_COLORS[look.hairColor]?.swap };
}

// ---------------------------------------------------------------------------------------------
// Overworld (base map). 18 x 30 frame: 14-wide body maps stamped at x = 2, head top on row 10 so a
// wizard hat has room above it. Feet end on row 27, like the old 16 x 22 frame's last two rows.

export const HERO_OW_W = 18;
export const HERO_OW_H = 30;
const BX = 2;
const TOP = 10;

type OwDir = 'down' | 'up' | 'right';
type Part = { map: string[]; dx?: number; dy?: number };

const SKIN: Record<OwDir, string[]> = {
  down: [
    '....SSSSSS....',
    '..SSSSSSSSSS..',
    '.SSSSSSSSSSSS.',
    '.SSSSSSSSSSSS.',
    '.SSSSSSSSSSSS.',
    '.SSSSSSSSSSSS.',
    '.sSSSSSSSSSSs.',
    '.sSSSSSSSSSSs.',
    '..SSSSSSSSSS..',
    '...SSSSSSSS...',
  ],
  up: [
    '....SSSSSS....',
    '..SSSSSSSSSS..',
    '.SSSSSSSSSSSS.',
    '.SSSSSSSSSSSS.',
    '.SSSSSSSSSSSS.',
    '.SSSSSSSSSSSS.',
    '.sSSSSSSSSSSs.',
    '.sSSSSSSSSSSs.',
    '..SSSSSSSSSS..',
    '...ssssssss...',
  ],
  right: [
    '....SSSSSS....',
    '...SSSSSSSS...',
    '..SSSSSSSSSS..',
    '..SSSSSSSSSS..',
    '..SSSSSSSSSSS.',
    '..SSSSSSSSSSS.',
    '..SSSssSSSSS..',
    '..SSSssSSSSS..',
    '...SSSSSSSSS..',
    '....sSSSSSS...',
  ],
};

// Faces from row 5: two-by-two eyes with a white shine (so they read on every skin tone) and
// rosy cheeks. Female faces add a lash flicking out from each eye and wider blush.
const FACES: Record<HeroSex, Record<OwDir, string[] | null>> = {
  male: {
    down: ['..............', '...HK....HK...', '...KK....KK...', '..k........k..'],
    up: null,
    right: ['..............', '.........HK...', '.........KK...', '..........k...'],
  },
  female: {
    down: ['..K........K..', '...HK....HK...', '...KK....KK...', '..kk......kk..'],
    up: null,
    right: ['...........K..', '.........HK...', '.........KK...', '.........kk...'],
  },
};

// Hair, per style and direction. dy shifts the map up for spikes above the head.
const HAIR: Record<OwDir, Part[]> = {
  down: [
    {
      map: [
        '....hhhhhh....',
        '..hhuuhhhhhh..',
        '.hhuhhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        '.hhhhzhhhhzhh.',
        '.hh.z.....zhh.',
        '.h..........h.',
        '.z..........z.',
      ],
    },
    {
      dy: -2,
      map: [
        '..h...h..h....',
        '..hh.hh.hh.h..',
        '...hhhhhhhhhh.',
        '..hhuuhhhhhhhh',
        'hhhuhhhhhhhhhh',
        '.hhhhhhhhhhhh.',
        'hhzhhhzhhzhhzh',
        '.hh.hz..zh.hh.',
        'hz..........zh',
        '.h..........h.',
      ],
    },
    {
      map: [
        '....hhhhhh....',
        '..hhuuhhhhhh..',
        '.hhuhhhhhhhhh.',
        'hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh',
        'hhz........zhh',
        'hh..........hh',
        'hh..........hh',
        'hz..........zh',
        'hz..........zh',
        'hh..........hh',
        'zh..........hz',
        '.z..........z.',
      ],
    },
    {
      map: [
        '....hhhhhh....',
        '..hhhhhuuhhh..',
        '.hhhhhhhhuhhh.',
        '.hhhhhhhhhhhh.',
        '.hhhhhhhzhhhh.',
        '.hhhz.....hhh.',
        '.h.........hhh',
        '.z.........zhh',
        '...........hz.',
        '...........zh.',
        '...........hz.',
        '...........zh.',
        '...........uu.',
        '...........hh.',
      ],
    },
  ],
  up: [
    {
      map: [
        '....hhhhhh....',
        '..hhhhhhhhhh..',
        '.hhhuuhhhhhhh.',
        '.hhuhhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        '.zhhhhhhhhhhz.',
        '..zzhhhhhhzz..',
      ],
    },
    {
      dy: -2,
      map: [
        '....h..h...h..',
        '..h.hh.hh.hh..',
        '.hhhhhhhhhhh..',
        'hhhhhhhuuhhhhh',
        'hhhhhhhhhuhhhh',
        '.hhhhhhhhhhhh.',
        'hhhhhhhhhhhhhh',
        '.hhhhhhhhhhhh.',
        'hzhhhhhhhhhhzh',
        '.hzhhzhhzhhzh.',
        '..z.z.zz.z.z..',
      ],
    },
    {
      map: [
        '....hhhhhh....',
        '..hhhhhhhhhh..',
        '.hhhuuhhhhhhh.',
        'hhhuhhhhhhhhhh',
        'hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh',
        'hhhhhhhhhhhhhh',
        'hhzhhhhhhhhzhh',
        'zhhhhhzhhhhhhz',
        '.zhzhz..zhzhz.',
      ],
    },
    {
      map: [
        '....hhhhhh....',
        '..hhhuuhhhhh..',
        '.hhhuhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        'hhhhhhhhhhhhh.',
        'hhzhhhhhhhhhz.',
        '.hzzzhhhhhzz..',
        '.zh...........',
        '.hz...........',
        '.zh...........',
        '.uu...........',
        '.hh...........',
      ],
    },
  ],
  right: [
    {
      map: [
        '....hhhhhh....',
        '...hhuuhhhhh..',
        '..hhuhhhhhhhh.',
        '..hhhhhhhhhhh.',
        '..hhhhhhhhzhh.',
        '..hhhhh..z....',
        '..hhhh........',
        '..zhz.........',
        '...z..........',
      ],
    },
    {
      dy: -2,
      map: [
        '..h...h.......',
        '.hh..hh..h....',
        '.hhhhhhhhhh...',
        'hhhhhuuhhhhh..',
        '.hhhuhhhhhhhh.',
        'hhhhhhhhhhhhh.',
        '.hhhhhhhhhzhhh',
        'hhhhhhh..z.z..',
        '.hhhhh........',
        'hzhzh.........',
        '.z............',
      ],
    },
    {
      map: [
        '....hhhhhh....',
        '...hhuuhhhhh..',
        '..hhuhhhhhhhh.',
        '.hhhhhhhhhhhh.',
        '.hhhhhhhhhhhhh',
        '.hhhhhh...zz..',
        '.hhhhh........',
        '.hhhhh........',
        '.hhhhz........',
        '.hhhz.........',
        '.hhhz.........',
        '.zhz..........',
        '..z...........',
      ],
    },
    {
      map: [
        '....hhhhhh....',
        '...hhuuhhhhh..',
        '..hhuhhhhhhhh.',
        '..hhhhhhhhhhh.',
        '..hhhhhhhhzhh.',
        '..hhhhhh.z....',
        '.hhhhh........',
        '.hzhz.........',
        'hz............',
        'zh............',
        'hz............',
        'uu............',
        'hh............',
      ],
    },
  ],
};

// Class gear for the head: a plain steel half-helm (warrior) or a floppy patched wizard hat (mage).
const HEADGEAR: Record<HeroClass, Record<OwDir, Part>> = {
  warrior: {
    down: {
      dy: -1,
      map: [
        '....oooooo....',
        '..ooHHoooooo..',
        '.ooHooooooooO.',
        '.oHoooooooooO.',
        'OOWOOOOOOOOWOO',
      ],
    },
    up: {
      dy: -1,
      map: [
        '....oooooo....',
        '..oooooHHooo..',
        '.ooooooooHooO.',
        '.ooooooooooOO.',
        'OOWOOOOOOOOWOO',
      ],
    },
    right: {
      dy: -1,
      map: [
        '....oooooo....',
        '...ooHHooooo..',
        '..ooHoooooooO.',
        '..oooooooooooO',
        '.OWOOOOOOOOWOO',
      ],
    },
  },
  mage: {
    down: {
      dx: -1,
      dy: -8,
      map: [
        '...........DD...',
        '.........DDLD...',
        '........DLLD....',
        '.......DLLLD....',
        '......DLHLLD....',
        '.....DLHLLLLD...',
        '.....DLLLCCLD...',
        '....DLLLLCCLLD..',
        '....BBBBBBBBbb..',
        '..DDLLLLLLLLLLD.',
        '.DLLLLLLLLLLLLLD',
        '..DDDDDDDDDDDDD.',
      ],
    },
    up: {
      dx: -1,
      dy: -8,
      map: [
        '...DD...........',
        '...DLDD.........',
        '....DLLD........',
        '....DLLLD.......',
        '....DLLLLD......',
        '...DLLLLLHD.....',
        '...DLLLLLLD.....',
        '..DLLLLLLLLD....',
        '..bbBBBBBBBB....',
        '.DLLLLLLLLLLDD..',
        'DLLLLLLLLLLLLLD.',
        '.DDDDDDDDDDDDD..',
      ],
    },
    right: {
      dx: -1,
      dy: -8,
      map: [
        '................',
        '................',
        '..DD............',
        '..DLDD..........',
        '...DLLDD........',
        '....DLLLLD......',
        '....DLLHLLD.....',
        '...DLLCCLLLD....',
        '...bBBBBBBBBB...',
        '..DLLLLLLLLLLLD.',
        '.DLLLLLLLLLLLLLD',
        '..DDDDDDDDDDDDD.',
      ],
    },
  },
};

// Bodies from row 10, per class, sex and direction. The warrior wears a padded sky gambeson under
// a leather chest piece; the mage a lavender robe with a butter sash that reaches the boots.
const BODY: Record<HeroClass, Record<HeroSex, Record<OwDir, string[]>>> = {
  warrior: {
    male: {
      down: ['...wwYYYYww...', '..YwwwYYwwwY..', '..YGwwGYwwGY..', '..SGWWbbWWGS..', '...GYGYYGYG...', '...PP....PP...'],
      up: ['...YYYYYYYY...', '..YYYwwwwYYY..', '..YGYwwwwYGY..', '..SGWWWWWWGS..', '...GYYYYYYG...', '...PP....PP...'],
      right: ['....wwYYw.....', '...YwwYYwY....', '...YGwwYwwSS..', '...YGWWbWW....', '....GYGYYG....', '....PP..PP....'],
    },
    female: {
      down: ['...wwYYYYww...', '..YwwwYYwwwY..', '..YG.wGYw.GY..', '..SGWWbbWWGS..', '..GYGYYYYGYG..', '..GGYGYYGYGG..'],
      up: ['...YYYYYYYY...', '..YYYwwwwYYY..', '..YG.wwww.GY..', '..SGWWWWWWGS..', '..GYYYYYYYYG..', '..GGYGYYGYGG..'],
      right: ['....wwYYw.....', '...YwwYYwY....', '...YGwwYwwSS..', '....GWbWW.....', '...GYGYYYG....', '...GGYGYGG....'],
    },
  },
  mage: {
    male: {
      down: ['...LLDDDDLL...', '..LLLLDDLLLL..', '.LLDLLLLLLDLL.', '.SLDBBbbBBDLS.', '...LLLLLLLL...', '...LLLLLLLL...', '..DLLLLLLLLD..'],
      up: ['...LLLLLLLL...', '..LLLLLLLLLL..', '.LLDLLLLLLDLL.', '.SLDBBBBBBDLS.', '...LLLLLLLL...', '...LLLLLLLL...', '..DLLLLLLLLD..'],
      right: ['....LLDDL.....', '...LLLLDLL....', '...LLLLLLLSS..', '...LBBBbBL....', '....LLLLLL....', '....LLLLLL....', '...DLLLLLLD...'],
    },
    female: {
      down: ['...LLDDDDLL...', '..LLLLDDLLLL..', '.LLD.LLLL.DLL.', '.SLDBBbbBBDLS.', '...LLLLLLLL...', '..LLLLLLLLLL..', '..DLDLLLLDLD..'],
      up: ['...LLLLLLLL...', '..LLLLLLLLLL..', '.LLD.LLLL.DLL.', '.SLDBBBBBBDLS.', '...LLLLLLLL...', '..LLLLLLLLLL..', '..DLDLLLLDLD..'],
      right: ['....LLDDL.....', '...LLLLDLL....', '...LLLLLLLSS..', '....BBbBL.....', '....LLLLLL....', '...LLLLLLLL...', '...DLDLLDLD...'],
    },
  },
};

function mirror(g: Grid): Grid {
  const m = new Grid(g.w, g.h);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) m.c[y * g.w + (g.w - 1 - x)] = g.c[y * g.w + x];
  return m;
}

// Weapons as seen from each side. The warrior holds a plain iron sword upright; the mage leans on
// a knotted staff topped with a glowing sky orb.
function weapon(g: Grid, cls: HeroClass, dir: OwDir, top: number, skin: string) {
  if (cls === 'warrior') {
    // Held upright at the side: grip in the fist, a stone crossguard, then a plain iron blade.
    const hx = dir === 'down' ? BX : BX + 13;
    const hy = top + (dir === 'right' ? 12 : 13);
    g.set(hx, hy + 1, PAL.W);
    g.set(hx, hy, PAL.W);
    // Two pixels wide (a bright edge and a stone flat) so it reads as a blade, not a stick.
    const out = dir === 'down' ? -1 : 1;
    for (let i = -1; i <= 2; i++) g.set(hx + (out < 0 ? 1 - i : i - 1), hy - 1, PAL.O);
    for (let t = 2; t <= 8; t++) {
      g.set(hx, hy - t, PAL.V);
      if (t < 8) g.set(hx + out, hy - t, PAL.o);
    }
    g.set(hx + (dir === 'down' ? 1 : -1), hy, skin);
  } else {
    const x = dir === 'down' ? BX : dir === 'up' ? BX + 13 : BX + 12;
    const yTop = top - 2;
    for (let y = yTop + 2; y <= top + 17; y++) g.set(x, y, y % 3 === 0 ? PAL.W : PAL.w);
    // Orb: three by three, a white shine top-left, a deeper blue underneath.
    const orb = ['YHY', 'YYY', 'GYG'];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.set(x - 1 + i, yTop - 2 + j, PAL[orb[j][i]]);
    g.set(x - 1, yTop + 1, PAL.W);
    g.set(x + 1, yTop + 1, PAL.W);
  }
}

// Skin, face, hair and headgear, with the head's top-left at (ox, top). Hair that would sit above
// the helm or hat brim is tucked under it.
function stampHead(g: Grid, look: HeroLook, d: OwDir, ox: number, top: number) {
  const sw = lookSwap(look);
  g.stamp(SKIN[d], ox, top, sw);
  const face = FACES[look.sex][d];
  if (face) g.stamp(face, ox, top + 5, sw);
  const hair = HAIR[d][look.hair] ?? HAIR[d][0];
  const hy = top + (hair.dy ?? 0);
  const cut = Math.max(0, top + 1 - hy);
  g.stamp(hair.map.slice(cut), ox + (hair.dx ?? 0), hy + cut, sw);
  const gear = HEADGEAR[look.cls][d];
  g.stamp(gear.map, ox + (gear.dx ?? 0), top + (gear.dy ?? 0), sw);
}

// frame 0 = standing, 1 and 3 = passing (body bobs up), 2 = the other foot forward.
export function heroOw(look: HeroLook, dir: 'down' | 'up' | 'left' | 'right', frame = 0): Grid {
  const d: OwDir = dir === 'left' ? 'right' : dir;
  const g = new Grid(HERO_OW_W, HERO_OW_H);
  const sw = lookSwap(look);
  const bob = frame % 2 === 1 ? -1 : 0;
  const top = TOP + bob;
  const legY = top + 16;
  const boot = (x: number, y: number, h: number) => {
    for (let j = 0; j < h; j++) {
      g.set(x, y + j, PAL.W);
      g.set(x + 1, y + j, PAL.W);
    }
  };
  const a = frame === 2 ? 1 : 2;
  const b = frame === 0 || frame === 2 ? 2 : 1;
  if (d === 'down' || d === 'up') {
    boot(BX + 3, legY, frame === 0 ? 2 : a);
    boot(BX + 9, legY, frame === 0 ? 2 : b);
  } else {
    const stride = frame === 2 ? 1 : 0;
    boot(BX + 4 - stride, legY, 2);
    boot(BX + 7 + stride, legY, frame === 2 || frame === 0 ? 2 : 1);
  }
  const mage = look.cls === 'mage';
  const skin = PAL[sw.S];
  // The staff stands behind the body when walking away.
  if (mage && d === 'up') weapon(g, look.cls, d, top, skin);
  g.stamp(BODY[look.cls][look.sex][d], BX, top + 10, sw);
  stampHead(g, look, d, BX, top);
  if (!(mage && d === 'up')) weapon(g, look.cls, d, top, skin);
  g.outline(PAL.K);
  return dir === 'left' ? mirror(g) : g;
}

// ---------------------------------------------------------------------------------------------
// Battle. The same side-on hero as the base map's, posed for combat in the 56 x 40 hero frame
// (feet on row 37): legs per stance, the head leaning with the swing, and the weapon arm drawn
// from the shoulder to the hand at any angle, so every combat animation works for both classes.

export type BattlePose = {
  x?: number;
  y?: number;
  lean?: number;
  crouch?: boolean;
  legs?: 'stand' | 'stride' | 'lunge' | 'air';
  hx?: number;
  hy?: number;
  sw?: number;
  flash?: boolean;
};

const BATTLE_W = 56;
const BATTLE_H = 40;
const BATTLE_GROUND = 37;

// The side-on body without the resting hand (the arm is posed separately) or bare trouser legs.
function battleBody(cls: HeroClass, sex: HeroSex) {
  return BODY[cls][sex].right
    .map((row) => row.replace(/S/g, '.'))
    .filter((row) => !/^[.P]+$/.test(row));
}

export function heroBattle(look: HeroLook, p: BattlePose) {
  const g = new Grid(BATTLE_W, BATTLE_H);
  const sw = lookSwap(look);
  const bx = 22 + (p.x ?? 0);
  const gy = BATTLE_GROUND + (p.y ?? 0);
  const lg = p.legs ?? 'stand';
  const lean = p.lean ?? 0;
  const legH = p.crouch || lg === 'air' ? 3 : 4;
  const ty = gy - legH - 5;
  const ox = bx - 7 + Math.round(lean / 2);

  // Legs: trousers down to a boot. Mage robes and the warrior's skirt hang over the top of them.
  let bl = bx - 3;
  let fl = bx + 1;
  let by = gy;
  let fy = gy;
  if (lg === 'stride') {
    bl = bx - 4;
    fl = bx + 2;
  } else if (lg === 'lunge') {
    bl = bx - 6;
    fl = bx + 3;
  } else if (lg === 'air') {
    bl = bx - 4;
    fl = bx + 2;
    by -= 1;
    fy -= 2;
  }
  const leg = (x: number, foot: number) => {
    for (let y = ty + 4; y < foot - 1; y++) {
      g.set(x, y, PAL.P);
      g.set(x + 1, y, PAL.P);
    }
    for (let i = 0; i < 3; i++) g.set(x + i, foot - 1, PAL.W);
  };
  leg(bl, by);
  leg(fl, fy);

  g.stamp(battleBody(look.cls, look.sex), ox, ty, sw);

  const sx = ox + 8;
  const sy = ty + 1;
  const hx = sx + (p.hx ?? 3);
  const hy = sy + (p.hy ?? 4);
  const a = ((p.sw ?? -55) * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const px = -dy;
  const py = dx;
  const at = (t: number, q = 0) => [hx + dx * t + px * q, hy + dy * t + py * q] as const;
  const mage = look.cls === 'mage';
  // Reared back, the weapon passes behind the head instead of across the face.
  const behind = dx < -0.2;
  if (!behind) stampHead(g, look, 'right', bx - 7 + lean, ty - 10);
  let tip: readonly [number, number];
  if (mage) {
    // Staff: a bark shaft through the fist, knotted every few pixels, the orb held in two prongs.
    for (let t = -4; t <= 10; t += 0.5) g.set(...at(t), Math.round(t) % 4 === 0 ? PAL.W : PAL.w);
    g.set(...at(10, -1.2), PAL.W);
    g.set(...at(10, 1.2), PAL.W);
    const [ox2, oy2] = at(12);
    const orb = ['YHY', 'YYY', 'GYG'];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) g.set(Math.round(ox2) - 1 + i, Math.round(oy2) - 1 + j, PAL[orb[j][i]]);
    tip = at(12);
  } else {
    // Sword: a bark grip and pommel, a stone crossguard, a plain iron blade with a darker flat.
    g.set(...at(-2), PAL.W);
    g.set(...at(-1), PAL.W);
    for (let q = -2; q <= 2; q++) g.set(...at(2, q * 0.8), PAL.O);
    const wide = Math.abs(dx) > Math.abs(dy);
    for (let t = 3; t <= 12; t++) {
      const [x, y] = at(t);
      if (t < 12) {
        if (wide) g.set(x, y + 1, PAL.o);
        else g.set(x + 1, y, PAL.o);
      }
      g.set(x, y, PAL.V);
    }
    tip = at(12);
  }
  if (behind) stampHead(g, look, 'right', bx - 7 + lean, ty - 10);
  seg(g, sx, sy, hx, hy, mage ? PAL.L : PAL.Y, 2);
  const skin = PAL[sw.S];
  g.set(hx, hy, skin);
  g.set(hx + 1, hy, skin);
  g.set(hx, hy + 1, skin);
  g.set(hx + 1, hy + 1, skin);
  if (p.flash) g.tint(PAL.H);
  g.outline(PAL.K);
  return { g, tip: { x: tip[0], y: tip[1] }, sh: { x: sx, y: sy }, hand: { x: hx, y: hy }, feet: { x: bx, y: gy } };
}

// A head-and-shoulders portrait for the battle HUD and menus: the front-facing head, cropped.
export function heroHead(look: HeroLook): Grid {
  const g = new Grid(18, look.cls === 'mage' ? 22 : 15);
  stampHead(g, look, 'down', 2, look.cls === 'mage' ? 9 : 2);
  g.outline(PAL.K);
  return g;
}
