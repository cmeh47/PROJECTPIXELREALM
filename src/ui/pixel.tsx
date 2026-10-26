import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fonts, P } from '../theme';

// A framed panel: chunky ink border, hard offset shadow drawn as a sibling view (DESIGN.md 4).
export function Framed({
  children,
  style,
  fill = colors.vellum,
  shadow = colors.ink,
  depth = 1,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  fill?: string;
  shadow?: string | null;
  depth?: number;
}) {
  const off = depth * P;
  return (
    <View style={[{ marginRight: shadow ? off : 0, marginBottom: shadow ? off : 0 }, style]}>
      {shadow ? <View style={[StyleSheet.absoluteFill, { backgroundColor: shadow, transform: [{ translateX: off }, { translateY: off }] }]} /> : null}
      <View style={{ flex: 1, backgroundColor: fill, borderWidth: 3, borderColor: colors.ink }}>{children}</View>
    </View>
  );
}

export function haptic(kind: 'light' | 'heavy' | 'success' | 'warning') {
  if (Platform.OS === 'web') return;
  if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (kind === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else Haptics.impactAsync(kind === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
}

// Pressed state moves the button into the page and hides its shadow.
export function PixelButton({
  onPress,
  fill = colors.lavender,
  shadow = colors.lavenderDeep,
  height = 52,
  disabled,
  style,
  children,
  accessibilityLabel,
}: {
  onPress?: () => void;
  fill?: string;
  shadow?: string;
  height?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const [down, setDown] = useState(false);
  const off = down || disabled ? 0 : P;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        setDown(true);
        haptic('light');
      }}
      onPressOut={() => setDown(false)}
      onPress={onPress}
      style={[{ height, marginRight: P, marginBottom: P }, style]}
    >
      <View style={[StyleSheet.absoluteFill, { backgroundColor: disabled ? 'transparent' : shadow, transform: [{ translateX: P }, { translateY: P }] }]} />
      <View
        style={{
          flex: 1,
          backgroundColor: disabled ? colors.scroll : fill,
          borderWidth: 3,
          borderColor: colors.ink,
          transform: [{ translateX: P - off }, { translateY: P - off }],
          justifyContent: 'center',
          paddingHorizontal: 14,
        }}
      >
        {children}
      </View>
    </Pressable>
  );
}

export function SegBar({ value, max, segs, fill, height = 8 }: { value: number; max: number; segs: number; fill: string; height?: number }) {
  const lit = Math.ceil((Math.max(0, value) / max) * segs);
  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 2, borderWidth: 2, borderColor: colors.ink, padding: 2, backgroundColor: colors.scroll }}>
      {Array.from({ length: segs }, (_, i) => (
        <View key={i} style={{ flex: 1, height, backgroundColor: i < lit ? fill : colors.scroll }} />
      ))}
    </View>
  );
}

export function Chip({ label, fill = colors.butter }: { label: string; fill?: string }) {
  return (
    <View style={{ backgroundColor: fill, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 6, paddingVertical: 1 }}>
      <Text style={styles.stat}>{label}</Text>
    </View>
  );
}

// Tiny bitmap icons (8 x 8), drawn as views so they stay on the pixel grid.
const ICONS: Record<string, string[]> = {
  sword: ['.......X', '......X.', '.....X..', '.X..X...', '..XX....', '..XX....', '.X..X...', 'X.......'],
  heart: ['.XX.XX..', 'XXXXXXX.', 'XXXXXXX.', '.XXXXX..', '..XXX...', '...X....', '........', '........'],
  flee: ['X...X...', '.X...X..', '..X...X.', '..X...X.', '.X...X..', 'X...X...', '........', '........'],
  next: ['........', '........', 'XXXXXXX.', '.XXXXX..', '..XXX...', '...X....', '........', '........'],
};

export function PixelIcon({ name, size = 3, color = colors.ink }: { name: keyof typeof ICONS; size?: number; color?: string }) {
  const rows = ICONS[name];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {rows.map((row, j) => (
        <View key={j} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, i) => (
            <View key={i} style={{ width: size, height: size, backgroundColor: c === 'X' ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  stat: { fontFamily: fonts.stat, fontSize: 11, lineHeight: 14, color: colors.ink },
  statSoft: { fontFamily: fonts.stat, fontSize: 11, lineHeight: 14, color: colors.inkSoft },
  heading: { fontFamily: fonts.heading, fontSize: 20, lineHeight: 26, color: colors.ink },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 36, color: colors.ink },
  button: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, color: colors.ink },
  buttonSmall: { fontFamily: fonts.button, fontSize: 16, lineHeight: 20, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  caption: { fontFamily: fonts.bodyBold, fontSize: 13, lineHeight: 18, color: colors.ink },
});
