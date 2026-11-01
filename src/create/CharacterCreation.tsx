import { Canvas, Group, Oval, Picture } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Hero } from '../net/useHero';
import { CLASS_STATS, HAIR_COLORS, HAIR_STYLES, HERO_OW_H, HERO_OW_W, heroHead, heroOw, SKIN_TONES, STAT_LIST, type HeroClass, type HeroLook, type StatKey } from '../sprites/hero';
import { PAL } from '../sprites/pixel';
import { gridPicture } from '../sprites/render';
import { colors, fonts } from '../theme';
import { Framed, haptic, PixelButton, PixelIcon, SegBar, styles as t } from '../ui/pixel';

const PREVIEW_SCALE = 6;
const FRAME_MS = 1000 / 8; // the base map's walk cycle
const DIRS = ['down', 'right', 'up', 'left'] as const;
type Dir = (typeof DIRS)[number];

const CLASS_INFO: Record<HeroClass, { name: string; blurb: string }> = {
  warrior: { name: 'Warrior', blurb: 'Tough and strong. Wins up close.' },
  mage: { name: 'Mage', blurb: 'Quick, with powerful magic.' },
};

const STAT_COLOR: Record<StatKey, string> = {
  hp: colors.hpRose,
  str: colors.xpGold,
  def: colors.manaBlue,
  mag: colors.epicPurple,
  spd: colors.questGreen,
};

const lookKey = (l: HeroLook) => `${l.cls}-${l.sex}-${l.skin}-${l.hair}-${l.hairColor}`;

// The first screen a new player sees: one page with a big live preview of their hero, the class's
// starting stats as bars, and every choice underneath. "Begin adventure" makes the hero on the
// server and opens the base.
export function CharacterCreation({ onCreate }: { onCreate: (hero: Hero) => Promise<unknown> }) {
  const insets = useSafeAreaInsets();
  const [look, setLook] = useState<HeroLook>({ cls: 'warrior', sex: 'male', skin: 1, hair: 0, hairColor: 0 });
  const [name, setName] = useState('');
  const [dir, setDir] = useState<Dir>('down');
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pose, setPose] = useState(0); // bumps on every change: the preview hops and steps in place
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  const change = (next: Partial<HeroLook>) => {
    haptic('light');
    setLook((l) => ({ ...l, ...next }));
    setPose((p) => p + 1);
    setError(null);
  };
  const turn = (by: number) => {
    haptic('light');
    setDir((d) => DIRS[(DIRS.indexOf(d) + by + DIRS.length) % DIRS.length]);
  };
  const shuffle = () => {
    const r = (n: number) => Math.floor(Math.random() * n);
    change({ sex: r(2) ? 'female' : 'male', skin: r(SKIN_TONES.length), hair: r(HAIR_STYLES.length), hairColor: r(HAIR_COLORS.length) });
  };

  const begin = async () => {
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!clean) {
      haptic('warning');
      nameRef.current?.focus();
      if (!reduceMotion) shake.value = withSequence(...[4, -4, 3, -3, 0].map((x) => withTiming(x, { duration: 50 })));
      setError('Give your hero a name first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate({ name: clean, look });
      haptic('success');
    } catch (e) {
      haptic('warning');
      setError(e instanceof Error ? e.message : "Couldn't save your hero. Try again.");
      setBusy(false);
    }
  };
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  return (
    <View style={[st.screen, { paddingTop: insets.top + 12 }]}>
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
        <View style={st.column}>
          <Text style={t.title} accessibilityRole="header">
            Create your hero
          </Text>
          <Text style={st.subtitle}>Choose how you look and how you fight.</Text>

          <Framed depth={2} style={st.top}>
            <View style={st.topRow}>
              <View style={st.previewCol}>
                <Preview look={look} dir={dir} pose={pose} onTap={() => turn(1)} />
                <View style={st.turnRow}>
                  <TurnButton label="Turn left" flip onPress={() => turn(-1)} />
                  <TurnButton label="Turn right" onPress={() => turn(1)} />
                </View>
              </View>
              <View style={st.infoCol}>
                <Animated.View style={shakeStyle}>
                  <TextInput
                    ref={nameRef}
                    value={name}
                    onChangeText={(v) => {
                      setName(v);
                      setError(null);
                    }}
                    placeholder="Name"
                    placeholderTextColor={colors.inkSoft}
                    maxLength={12}
                    autoCapitalize="words"
                    autoCorrect={false}
                    returnKeyType="done"
                    accessibilityLabel="Hero name, up to 12 characters"
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    style={[st.name, focused ? st.nameFocus : null]}
                  />
                </Animated.View>
                <View style={st.classChip}>
                  <Text style={t.stat}>{CLASS_INFO[look.cls].name.toUpperCase()}</Text>
                </View>
                <Stats cls={look.cls} />
              </View>
            </View>
          </Framed>

          <Section label="Class">
            <View style={st.row}>
              {(['warrior', 'mage'] as const).map((c) => (
                <ClassCard key={c} cls={c} look={look} selected={look.cls === c} onPress={() => look.cls !== c && change({ cls: c })} />
              ))}
            </View>
          </Section>

          <Section label="Body">
            <View style={st.row}>
              {(['male', 'female'] as const).map((s) => (
                <Option key={s} label={s === 'male' ? 'Male' : 'Female'} selected={look.sex === s} onPress={() => change({ sex: s })} />
              ))}
            </View>
          </Section>

          <Section label="Hairstyle">
            <View style={st.row}>
              {HAIR_STYLES.map((h, i) => (
                <Option key={h} label={h} selected={look.hair === i} onPress={() => change({ hair: i })} />
              ))}
            </View>
          </Section>

          <Section label="Skin tone">
            <View style={st.swatches}>
              {SKIN_TONES.map((s, i) => (
                <Swatch key={s.name} label={`${s.name} skin`} fill={PAL[s.swap.S]} shade={PAL[s.swap.s]} selected={look.skin === i} onPress={() => change({ skin: i })} />
              ))}
            </View>
          </Section>

          <Section label="Hair color">
            <View style={st.swatches}>
              {HAIR_COLORS.map((h, i) => (
                <Swatch key={h.name} label={`${h.name} hair`} fill={PAL[h.swap.h]} shade={PAL[h.swap.z]} selected={look.hairColor === i} onPress={() => change({ hairColor: i })} />
              ))}
            </View>
          </Section>

          <Pressable onPress={shuffle} accessibilityRole="button" accessibilityLabel="Shuffle your look" hitSlop={8} style={st.shuffle}>
            <Text style={st.shuffleText}>SHUFFLE LOOK</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[st.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={st.column}>
          {error ? (
            <Animated.View entering={FadeIn.duration(120)} style={st.error} accessibilityLiveRegion="polite">
              <Text style={st.errorText}>{error}</Text>
            </Animated.View>
          ) : null}
          <PixelButton onPress={begin} disabled={busy} fill={colors.butter} shadow={colors.xpGold} height={56} accessibilityLabel="Begin adventure">
            <Text style={[t.button, { textAlign: 'center' }]}>{busy ? 'SAVING...' : 'BEGIN ADVENTURE'}</Text>
          </PixelButton>
        </View>
      </View>
    </View>
  );
}

// The hero on a little patch of meadow. After every change they hop and take a few steps in place,
// so the new look is seen moving; otherwise they stand still. Tap to turn them round.
function Preview({ look, dir, pose, onTap }: { look: HeroLook; dir: Dir; pose: number; onTap: () => void }) {
  const [frame, setFrame] = useState(0);
  const reduceMotion = useReducedMotion();
  const hop = useSharedValue(0);
  useEffect(() => {
    if (pose === 0 || reduceMotion) return;
    // Two 12 fps beats up a pixel, then down, while the legs run one walk cycle.
    hop.value = withSequence(withTiming(-PREVIEW_SCALE, { duration: 0 }), withTiming(-PREVIEW_SCALE, { duration: 166 }), withTiming(0, { duration: 0 }));
    let f = 0;
    const id = setInterval(() => {
      f += 1;
      setFrame(f % 4);
      if (f >= 8) {
        clearInterval(id);
        setFrame(0);
      }
    }, FRAME_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);
  const pic = useMemo(() => gridPicture(`create-${lookKey(look)}-${dir}-${frame}`, heroOw(look, dir, frame), PREVIEW_SCALE), [look, dir, frame]);
  const hopStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));
  const w = HERO_OW_W * PREVIEW_SCALE;
  const h = HERO_OW_H * PREVIEW_SCALE;
  // Feet sit two rows above the frame's bottom edge.
  const feet = (HERO_OW_H - 2) * PREVIEW_SCALE;
  return (
    <Pressable onPress={onTap} accessibilityRole="button" accessibilityLabel="Your hero. Tap to turn them around." style={st.preview}>
      <Canvas style={{ position: 'absolute', left: 0, top: 0, width: w + 24, height: h }}>
        <Group>
          <Oval x={12 + 3 * PREVIEW_SCALE} y={feet - PREVIEW_SCALE} width={12 * PREVIEW_SCALE} height={3 * PREVIEW_SCALE} color={colors.ink} opacity={0.14} />
        </Group>
      </Canvas>
      <Animated.View style={[{ width: w, height: h, marginHorizontal: 12 }, hopStyle]}>
        <Canvas style={{ width: w, height: h }}>
          <Picture picture={pic} />
        </Canvas>
      </Animated.View>
    </Pressable>
  );
}

function TurnButton({ label, flip, onPress }: { label: string; flip?: boolean; onPress: () => void }) {
  const [down, setDown] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[st.turn, down ? { backgroundColor: colors.lavender } : null]}
    >
      <View style={{ transform: [{ rotate: flip ? '90deg' : '-90deg' }] }}>
        <PixelIcon name="next" size={3} color={colors.ink} />
      </View>
    </Pressable>
  );
}

// Starting stats as segmented bars. When the class changes, each bar fills or empties block by
// block toward its new value (DESIGN.md: stat bars animate a block at a time, never a slide).
function Stats({ cls }: { cls: HeroClass }) {
  const target = CLASS_STATS[cls];
  const [shown, setShown] = useState(target);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (reduceMotion) {
      setShown(target);
      return;
    }
    const id = setInterval(() => {
      setShown((s) => {
        let moving = false;
        const next = { ...s };
        for (const { key } of STAT_LIST) {
          if (next[key] !== target[key]) {
            next[key] += next[key] < target[key] ? 1 : -1;
            moving = true;
          }
        }
        if (!moving) clearInterval(id);
        return next;
      });
    }, 55);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cls]);
  return (
    <View style={st.stats}>
      {STAT_LIST.map(({ key, label, name }) => (
        <View key={key} style={st.statRow} accessibilityLabel={`${name} ${target[key]} out of 10`}>
          <Text style={[t.stat, st.statLabel]}>{label}</Text>
          <SegBar value={shown[key]} max={10} segs={10} fill={STAT_COLOR[key]} height={6} />
          <Text style={[t.stat, st.statValue]}>{shown[key]}</Text>
        </View>
      ))}
    </View>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.sectionLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

// A class to pick: the hero's own head in that class's headgear, the name, and a one-line pitch.
function ClassCard({ cls, look, selected, onPress }: { cls: HeroClass; look: HeroLook; selected: boolean; onPress: () => void }) {
  const key = lookKey({ ...look, cls });
  const head = useMemo(() => heroHead({ ...look, cls }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const pic = useMemo(() => gridPicture(`create-head-${key}`, head, 2), [key, head]);
  const info = CLASS_INFO[cls];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${info.name}. ${info.blurb}`}
      style={[st.card, selected ? st.cardOn : null]}
    >
      <View style={{ width: head.w * 2, height: 44, justifyContent: 'flex-end' }}>
        <Canvas style={{ width: head.w * 2, height: head.h * 2 }}>
          <Picture picture={pic} />
        </Canvas>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.cardName}>{info.name}</Text>
        <Text style={st.cardBlurb}>{info.blurb}</Text>
      </View>
    </Pressable>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} style={[st.option, selected ? st.optionOn : null]}>
      <Text style={t.buttonSmall}>{label}</Text>
    </Pressable>
  );
}

// A paint chip: the color with its shade along the bottom. The picked one sits in a lavender frame.
function Swatch({ label, fill, shade, selected, onPress }: { label: string; fill: string; shade: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} style={[st.swatch, selected ? st.swatchOn : null]}>
      <View style={[st.chip, { backgroundColor: fill }]}>
        <View style={{ flex: 1 }} />
        <View style={{ height: 8, backgroundColor: shade }} />
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment },
  scroll: { paddingHorizontal: 16, paddingBottom: 24 },
  column: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  subtitle: { ...t.body, color: colors.inkSoft, marginBottom: 12 },
  top: { marginBottom: 8 },
  topRow: { flexDirection: 'row', padding: 10, gap: 10 },
  previewCol: { alignItems: 'center', gap: 6 },
  preview: { backgroundColor: colors.mint, borderWidth: 2, borderColor: colors.ink, paddingTop: 4 },
  turnRow: { flexDirection: 'row', gap: 8 },
  turn: { width: 48, height: 40, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.vellum, alignItems: 'center', justifyContent: 'center' },
  infoCol: { flex: 1, gap: 6 },
  name: {
    height: 44,
    backgroundColor: colors.scroll,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 10,
    fontFamily: fonts.heading,
    fontSize: 18,
    color: colors.ink,
  },
  classChip: { alignSelf: 'flex-start', backgroundColor: colors.lavender, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 6, paddingVertical: 1, marginTop: 2 },
  nameFocus: { borderColor: colors.lavenderDeep },
  stats: { gap: 5 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { width: 30 },
  statValue: { width: 16, textAlign: 'right' },
  section: { marginTop: 14, gap: 6 },
  sectionLabel: { fontFamily: fonts.stat, fontSize: 12, lineHeight: 15, color: colors.ink },
  row: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 64, padding: 8, backgroundColor: colors.vellum, borderWidth: 3, borderColor: colors.ink },
  cardOn: { backgroundColor: colors.lavender, transform: [{ translateY: -2 }], borderBottomWidth: 5 },
  cardName: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22, color: colors.ink },
  cardBlurb: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.ink },
  option: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.vellum, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 4 },
  optionOn: { backgroundColor: colors.lavender },
  swatches: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  swatch: { width: 52, height: 52, padding: 4, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.lavenderDeep, backgroundColor: colors.lavender },
  chip: { flex: 1, borderWidth: 2, borderColor: colors.ink },
  shuffle: { alignSelf: 'flex-start', marginTop: 16, minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.sky },
  shuffleText: { fontFamily: fonts.stat, fontSize: 12, lineHeight: 15, color: colors.ink },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.vellum, borderTopWidth: 3, borderColor: colors.ink, gap: 8 },
  error: { alignSelf: 'stretch', backgroundColor: colors.rose, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  errorText: { ...t.caption },
});
