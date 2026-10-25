import { Canvas, Circle, Group, Picture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { FOE_GROUND, HERO_GROUND, type FoePose, type HeroPose } from '../sprites/characters';
import { Grid, PAL } from '../sprites/pixel';
import { backdropPicture, foePicture, gridPicture, heroPicture, SCENE_GROUND, SCENE_H, SCENE_W } from '../sprites/render';
import { colors } from '../theme';

// Where the characters stand, in art pixels. heroX / foeX shift them for dashes and lunges.
export const HERO_HOME = -6;
export const FOE_HOME = 52;

export type RuneFx = {
  visible: SharedValue<number>;
  x: SharedValue<number>;
  y: SharedValue<number>;
  ring: SharedValue<number>;
  decoy: SharedValue<number>;
  decoyX: SharedValue<number>;
  decoyY: SharedValue<number>;
};

function runeGrid(decoy: boolean) {
  const g = new Grid(7, 7);
  g.stamp(['..b..', '.bBb.', 'bBHBb', '.bBb.', '..b..'], 1, 1);
  if (decoy) g.tint(PAL.L);
  g.outline(decoy ? PAL.D : PAL.K);
  return g;
}

export function BattleScene({
  s,
  hero,
  foe,
  heroX,
  foeX,
  rune,
}: {
  s: number;
  hero: HeroPose;
  foe: FoePose;
  heroX: SharedValue<number>;
  foeX: SharedValue<number>;
  rune: RuneFx;
}) {
  const bg = useMemo(() => backdropPicture(s), [s]);
  const heroPic = useMemo(() => heroPicture(hero, s), [hero, s]);
  const foePic = useMemo(() => foePicture(foe, s), [foe, s]);
  const runePic = useMemo(() => gridPicture('rune', runeGrid(false), s), [s]);
  const decoyPic = useMemo(() => gridPicture('decoy', runeGrid(true), s), [s]);

  const heroT = useDerivedValue(() => [{ translateX: Math.round(HERO_HOME + heroX.value) * s }, { translateY: (SCENE_GROUND - HERO_GROUND) * s }]);
  const foeT = useDerivedValue(() => [{ translateX: Math.round(FOE_HOME + foeX.value) * s }, { translateY: (SCENE_GROUND - FOE_GROUND) * s }]);
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
    <Canvas style={{ width: SCENE_W * s, height: SCENE_H * s }}>
      <Picture picture={bg} />
      <Group transform={foeT}>
        <Picture picture={foePic} />
      </Group>
      <Group transform={heroT}>
        <Picture picture={heroPic} />
      </Group>
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
