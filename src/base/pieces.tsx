import { Canvas, Group, Oval, Path, Picture, Rect, Skia, type SkPicture } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { colors } from '../theme';
import { bubblePicture, leafPicture } from './art';

// Drawing pieces shared by the base and the Boar Woods: sprites placed in the world, the "!"
// bubble, the swirl into battle and the white flash out of it.

type Pic = SkPicture;

export function Static({ pic, x, y, s }: { pic: Pic; x: number; y: number; s: number }) {
  return (
    <Group transform={[{ translateX: Math.round(x) * s }, { translateY: Math.round(y) * s }]}>
      <Picture picture={pic} />
    </Group>
  );
}

// A sprite whose feet follow shared x/y, with a soft ink shadow under it.
export function Mover({ pic, x, y, w, h, s, shadow, blink }: { pic: Pic; x: SharedValue<number>; y: SharedValue<number>; w: number; h: number; s: number; shadow?: boolean; blink?: boolean }) {
  const transform = useDerivedValue(() => [{ translateX: Math.round(x.value - w / 2) * s }, { translateY: Math.round(y.value - h + 1) * s }]);
  const shadowT = useDerivedValue(() => [{ translateX: Math.round(x.value - 5) * s }, { translateY: Math.round(y.value - 1) * s }]);
  return (
    <>
      {shadow ? (
        <Group transform={shadowT}>
          <Oval x={0} y={0} width={10 * s} height={3 * s} color={colors.ink} opacity={0.14} />
        </Group>
      ) : null}
      <Group transform={transform} opacity={blink ? 0.6 : 1}>
        <Picture picture={pic} />
      </Group>
    </>
  );
}

export function Bubble({ x, y, top, scale, s }: { x: SharedValue<number>; y: SharedValue<number>; top: number; scale: SharedValue<number>; s: number }) {
  // Pops out of the top of the foe's head (top px above its feet), anchored at the tail.
  const transform = useDerivedValue(() => {
    const k = scale.value;
    const ax = Math.round(x.value) * s;
    const ay = Math.round(y.value - top) * s;
    return [{ translateX: ax }, { translateY: ay }, { scale: k }, { translateX: -5.5 * s }, { translateY: -14 * s }];
  });
  return (
    <Group transform={transform}>
      <Picture picture={bubblePicture(s)} />
    </Group>
  );
}

export function Icon({ pic, w, h }: { pic: Pic; w: number; h: number }) {
  return (
    <Canvas style={{ width: w, height: h }}>
      <Picture picture={pic} />
    </Canvas>
  );
}

// The battle swirl: spiral arms in lavender, then ink, sweep around until they cover the screen.
export function SwirlOverlay({ progress, w, h }: { progress: SharedValue<number>; w: number; h: number }) {
  const arms = (lag: number, widthBoost: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const path = Skia.PathBuilder.Make();
      const p = Math.max(0, Math.min(1, (progress.value - lag) / (1 - lag)));
      if (p <= 0 || w === 0) return path.detach();
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h) * 0.6;
      const N = 6;
      const rot = p * Math.PI * 1.4;
      const span = ((Math.PI * 2) / N) * Math.min(1, p * widthBoost);
      const twist = 1.6 * (1 - p * 0.5);
      for (let k = 0; k < N; k++) {
        const a0 = (k * Math.PI * 2) / N + rot;
        path.moveTo(cx, cy);
        for (let i = 1; i <= 14; i++) {
          const r = (R * i) / 14;
          const a = a0 + (i / 14) * twist;
          path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        for (let i = 14; i >= 1; i--) {
          const r = (R * i) / 14;
          const a = a0 + span + (i / 14) * twist;
          path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        path.close();
      }
      return path.detach();
    });
  const back = arms(0, 1.25);
  const front = arms(0.18, 1.3);
  const show = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));
  if (!w) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, show]}>
      <Canvas style={{ width: w, height: h }}>
        <Path path={back} color={colors.lavender} antiAlias={false} />
        <Path path={front} color={colors.ink} antiAlias={false} />
      </Canvas>
    </Animated.View>
  );
}

export function FlashOverlay({ value }: { value: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: value.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }, style]} />;
}


// Going between the base and the Boar Woods: a band of leaves blows across the screen from right to
// left. The scene swaps underneath while the band covers it (progress 0.5).
export function LeafWipe({ progress, w, h, s }: { progress: SharedValue<number>; w: number; h: number; s: number }) {
  const band = w * 1.6;
  const edge = 24 * s;
  const leaves = useMemo(() => {
    const out: { x: number; y: number }[] = [];
    let seed = 7;
    const r = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const n = Math.round((h / (8 * s)) * 6);
    for (let i = 0; i < n; i++) {
      // Thick inside the band's edges, thinning out ahead of it and behind it.
      const side = i % 2 ? 0 : band + edge;
      out.push({ x: side + (r() - 0.5) * edge * 2.2 + (i % 2 ? edge : 0), y: r() * h });
    }
    return out;
  }, [band, edge, h, s]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value > 0 && progress.value < 1 ? 1 : 0,
    transform: [{ translateX: w - edge - progress.value * (w + band + edge * 2) }],
  }));
  if (!w) return null;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: band + edge * 2, height: h }, style]}>
      <Canvas style={{ width: band + edge * 2, height: h }}>
        <Rect x={edge} y={0} width={band} height={h} color={colors.mint} />
        {leaves.map((l, i) => (
          <Group key={i} transform={[{ translateX: Math.round(l.x / s) * s }, { translateY: Math.round(l.y / s) * s }]}>
            <Picture picture={leafPicture(s)} />
          </Group>
        ))}
      </Canvas>
    </Animated.View>
  );
}
