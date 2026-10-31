import { Canvas, Circle, DashPathEffect, Group, Line, Picture, type SkPicture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { FOE_GROUND, HERO_GROUND, type FoePose, type HeroPose } from '../sprites/characters';
import { Grid, PAL } from '../sprites/pixel';
import { backdropPicture, foePicture, gridPicture, heroPicture } from '../sprites/render';
import { GLYPH_C, glyphGrid, type GlyphState } from '../sprites/spells';
import { colors } from '../theme';
import type { Field, Slot } from './field';

// Derived-value dependencies matter only on the web; on phones Reanimated tracks them itself and
// warns when they're passed.
const webDeps = (deps: unknown[]) => (Platform.OS === 'web' ? deps : undefined);

// Where a sprite frame sits for a slot: hero bodies are 22 px into their frame, foes 36.
export const heroFrame = (slot: Slot) => ({ x: slot.x - 22, y: slot.y - HERO_GROUND });
export const foeFrame = (slot: Slot) => ({ x: slot.x - 36, y: slot.y - FOE_GROUND });

export type RuneFx = {
  visible: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  ring: SharedValue<number>;
  decoy: SharedValue<number>;
  decoyX: SharedValue<number>;
  decoyY: SharedValue<number>;
};

// A mage's glyph chain: up to four glyphs, each with a position (art px, its centre) and a state
// (0 hidden, 1 waiting, 2 live, 3 lit, 4 missed). One ring closes on the live glyph.
export const GLYPH_MAX = 4;
export const G_HIDDEN = 0;
export const G_NEXT = 1;
export const G_LIVE = 2;
export const G_LIT = 3;
export const G_MISSED = 4;
export type GlyphFx = {
  x: SharedValue<number>[];
  y: SharedValue<number>[];
  state: SharedValue<number>[];
  ring: SharedValue<number>;
  ringX: SharedValue<number>;
  ringY: SharedValue<number>;
  ringOn: SharedValue<number>;
};

// A spell effect frame (a bolt, a lance, a burst) placed in art pixels; dx / dy move it at 60 fps.
export type FxItem = { key: string; pic: SkPicture; x: number; y: number; dx?: SharedValue<number>; dy?: SharedValue<number> };

// z overrides draw order (it defaults to the slot's lane), so a hero who dashes into another lane draws in it.
type ActorBase = { key: string; slot: Slot; z?: number; dx?: SharedValue<number>; dy?: SharedValue<number> };
export type Actor = (ActorBase & { kind: 'hero'; pose: HeroPose }) | (ActorBase & { kind: 'foe'; pose: FoePose });

function runeGrid(decoy: boolean) {
  const g = new Grid(7, 7);
  g.stamp(['..b..', '.bBb.', 'bBHBb', '.bBb.', '..b..'], 1, 1);
  if (decoy) g.tint(PAL.L);
  g.outline(decoy ? PAL.D : PAL.K);
  return g;
}

function ActorSprite({ actor, s }: { actor: Actor; s: number }) {
  const pic = useMemo(
    () => (actor.kind === 'hero' ? heroPicture(actor.pose, s) : foePicture(actor.pose, s)),
    [actor.kind, actor.pose, s],
  );
  const frame = actor.kind === 'hero' ? heroFrame(actor.slot) : foeFrame(actor.slot);
  const { dx, dy } = actor;
  const transform = useDerivedValue(
    () => [{ translateX: Math.round(frame.x + (dx ? dx.value : 0)) * s }, { translateY: Math.round(frame.y + (dy ? dy.value : 0)) * s }],
    webDeps([frame.x, frame.y, dx, dy, s]),
  );
  return (
    <Group transform={transform}>
      <Picture picture={pic} />
    </Group>
  );
}

const STATES: [number, GlyphState][] = [
  [G_NEXT, 'next'],
  [G_LIVE, 'live'],
  [G_LIT, 'lit'],
  [G_MISSED, 'missed'],
];

function GlyphSprite({ glyphs, k, s }: { glyphs: GlyphFx; k: number; s: number }) {
  const pics = useMemo(() => STATES.map(([, st]) => gridPicture(`glyph${k + 1}${st}`, glyphGrid(k + 1, st), s)), [k, s]);
  return (
    <>
      {STATES.map(([v], i) => (
        <GlyphFace key={v} glyphs={glyphs} k={k} s={s} when={v} pic={pics[i]} />
      ))}
    </>
  );
}

// One look of a glyph. Every look but the current one parks off-canvas (some renderers ignore
// group opacity driven from the UI thread, so nothing relies on it).
function GlyphFace({ glyphs, k, s, when, pic }: { glyphs: GlyphFx; k: number; s: number; when: number; pic: SkPicture }) {
  const xs = glyphs.x[k];
  const ys = glyphs.y[k];
  const state = glyphs.state[k];
  const t = useDerivedValue(() =>
    state.value === when
      ? [{ translateX: (Math.round(xs.value) - GLYPH_C) * s }, { translateY: (Math.round(ys.value) - GLYPH_C) * s }]
      : [{ translateX: -100 * s }, { translateY: 0 }],
  );
  return (
    <Group transform={t}>
      <Picture picture={pic} />
    </Group>
  );
}

// A dotted thread of light from a lit glyph to the next one in the chain.
function GlyphThread({ glyphs, k, s }: { glyphs: GlyphFx; k: number; s: number }) {
  const a = glyphs.state[k];
  const b = glyphs.state[k + 1];
  const on = useDerivedValue(() => a.value === G_LIT && (b.value === G_LIVE || b.value === G_LIT));
  const p1 = useDerivedValue(() => (on.value ? { x: (Math.round(glyphs.x[k].value) + 0.5) * s, y: (Math.round(glyphs.y[k].value) + 0.5) * s } : { x: -100, y: -100 }));
  const p2 = useDerivedValue(() => (on.value ? { x: (Math.round(glyphs.x[k + 1].value) + 0.5) * s, y: (Math.round(glyphs.y[k + 1].value) + 0.5) * s } : { x: -100, y: -100 }));
  return (
    <Line p1={p1} p2={p2} color={colors.butter} strokeWidth={s} style="stroke" antiAlias={false}>
      <DashPathEffect intervals={[2 * s, s]} />
    </Line>
  );
}

function FxSprite({ item, s }: { item: FxItem; s: number }) {
  const { dx, dy, x, y } = item;
  const t = useDerivedValue(() => [{ translateX: Math.round(x + (dx ? dx.value : 0)) * s }, { translateY: Math.round(y + (dy ? dy.value : 0)) * s }], webDeps([x, y, dx, dy, s]));
  return (
    <Group transform={t}>
      <Picture picture={item.pic} />
    </Group>
  );
}

export function BattleScene({ field, actors, rune, glyphs, fx }: { field: Field; actors: Actor[]; rune: RuneFx; glyphs: GlyphFx; fx: FxItem[] }) {
  const { s, w, h, horizon } = field;
  const bg = useMemo(() => backdropPicture(w, h, horizon, s), [w, h, horizon, s]);
  const runePic = useMemo(() => gridPicture('rune', runeGrid(false), s), [s]);
  const decoyPic = useMemo(() => gridPicture('decoy', runeGrid(true), s), [s]);
  // Back lanes first, so nearer sprites overlap farther ones.
  const sorted = useMemo(() => [...actors].sort((a, b) => (a.z ?? a.slot.y) - (b.z ?? b.slot.y)), [actors]);

  // Hidden runes also park off-canvas, so nothing peeks out if a renderer ignores group opacity.
  const runeT = useDerivedValue(() =>
    rune.visible.value > 0 ? [{ translateX: (Math.round(rune.x.value) - 3) * s }, { translateY: (Math.round(rune.y.value) - 3) * s }] : [{ translateX: -100 * s }, { translateY: 0 }],
  );
  const decoyT = useDerivedValue(() =>
    rune.decoy.value > 0 ? [{ translateX: (Math.round(rune.decoyX.value) - 3) * s }, { translateY: (Math.round(rune.decoyY.value) - 3) * s }] : [{ translateX: -100 * s }, { translateY: 0 }],
  );
  const ringCx = useDerivedValue(() => (Math.round(rune.x.value) + 0.5) * s);
  const ringCy = useDerivedValue(() => (Math.round(rune.y.value) + 0.5) * s);
  const ringR = useDerivedValue(() => (rune.visible.value > 0 ? Math.round(rune.ring.value) * s : 0));
  const ringColor = useDerivedValue(() => (rune.ring.value <= 5 ? colors.xpGold : colors.lavenderDeep));
  const gRingCx = useDerivedValue(() => (Math.round(glyphs.ringX.value) + 0.5) * s);
  const gRingCy = useDerivedValue(() => (Math.round(glyphs.ringY.value) + 0.5) * s);
  const gRingR = useDerivedValue(() => (glyphs.ringOn.value > 0 ? Math.round(glyphs.ring.value) * s : 0));
  const gRingColor = useDerivedValue(() => (glyphs.ring.value <= 7 ? colors.xpGold : colors.lavenderDeep));
  const glyphKeys = useMemo(() => Array.from({ length: GLYPH_MAX }, (_, k) => k), []);

  return (
    <Canvas style={{ width: w * s, height: h * s }}>
      <Picture picture={bg} />
      {sorted.map((a) => (
        <ActorSprite key={a.key} actor={a} s={s} />
      ))}
      {fx.map((f) => (
        <FxSprite key={f.key} item={f} s={s} />
      ))}
      {glyphKeys.slice(0, -1).map((k) => (
        <GlyphThread key={`t${k}`} glyphs={glyphs} k={k} s={s} />
      ))}
      {glyphKeys.map((k) => (
        <GlyphSprite key={`g${k}`} glyphs={glyphs} k={k} s={s} />
      ))}
      <Circle cx={gRingCx} cy={gRingCy} r={gRingR} style="stroke" strokeWidth={s} color={gRingColor} antiAlias={false} />
      <Group opacity={rune.decoy} transform={decoyT}>
        <Picture picture={decoyPic} />
      </Group>
      <Group opacity={rune.visible}>
        <Circle cx={ringCx} cy={ringCy} r={ringR} style="stroke" strokeWidth={s} color={ringColor} antiAlias={false} />
        <Group transform={runeT}>
          <Picture picture={runePic} />
        </Group>
      </Group>
    </Canvas>
  );
}
