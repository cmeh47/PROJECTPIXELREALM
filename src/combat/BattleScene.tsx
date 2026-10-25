import { Canvas, Circle, Group, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { FOE_GROUND, HERO_GROUND, type FoePose, type HeroPose } from '../sprites/characters';
import { Grid, PAL } from '../sprites/pixel';
import { backdropPicture, foePicture, gridPicture, heroPicture } from '../sprites/render';
import { colors } from '../theme';
import type { Field, Slot } from './field';

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

export type Actor =
  | { kind: 'hero'; key: string; slot: Slot; pose: HeroPose; dx?: SharedValue<number> }
  | { kind: 'foe'; key: string; slot: Slot; pose: FoePose; dx?: SharedValue<number> };

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
  const dx = actor.dx;
  const transform = useDerivedValue(
    () => [{ translateX: Math.round(frame.x + (dx ? dx.value : 0)) * s }, { translateY: frame.y * s }],
    [frame.x, frame.y, dx, s],
  );
  return (
    <Group transform={transform}>
      <Picture picture={pic} />
    </Group>
  );
}

export function BattleScene({ field, actors, rune }: { field: Field; actors: Actor[]; rune: RuneFx }) {
  const { s, w, h, horizon } = field;
  const bg = useMemo(() => backdropPicture(w, h, horizon, s), [w, h, horizon, s]);
  const runePic = useMemo(() => gridPicture('rune', runeGrid(false), s), [s]);
  const decoyPic = useMemo(() => gridPicture('decoy', runeGrid(true), s), [s]);
  // Back lanes first, so nearer sprites overlap farther ones.
  const sorted = useMemo(() => [...actors].sort((a, b) => a.slot.y - b.slot.y), [actors]);

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

  return (
    <Canvas style={{ width: w * s, height: h * s }}>
      <Picture picture={bg} />
      {sorted.map((a) => (
        <ActorSprite key={a.key} actor={a} s={s} />
      ))}
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
