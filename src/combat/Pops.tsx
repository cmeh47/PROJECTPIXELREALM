import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { colors, fonts } from '../theme';

export type Pop = { id: number; text: string; color: string; x: number; y: number; sub?: string; big?: boolean };

// Floating combat text: pops in, overshoots, settles, then drifts up and fades.
export function PopText({ pop, s, onDone }: { pop: Pop; s: number; onDone: (id: number) => void }) {
  const t = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    t.value = withSequence(withTiming(1.18, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 80 }));
    fade.value = withDelay(620, withTiming(0, { duration: 220 }));
    const id = setTimeout(() => onDone(pop.id), 900);
    return () => clearTimeout(id);
  }, [fade, onDone, pop.id, t]);

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: -Math.round((1 - fade.value) * 4) * 3 }, { scale: t.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { left: pop.x * s - 100, top: pop.y * s - 14 }, style]}>
      <Text style={[styles.text, pop.big && styles.big, { color: pop.color }]}>{pop.text}</Text>
      {pop.sub ? <Text style={styles.sub}>{pop.sub}</Text> : null}
    </Animated.View>
  );
}

const outline = { textShadowColor: colors.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 };

const styles = StyleSheet.create({
  wrap: { position: 'absolute', width: 200, alignItems: 'center' },
  text: { fontFamily: fonts.stat, fontSize: 16, lineHeight: 20, ...outline },
  big: { fontSize: 22, lineHeight: 26 },
  sub: { fontFamily: fonts.stat, fontSize: 8, lineHeight: 10, color: colors.inkSoft },
});
