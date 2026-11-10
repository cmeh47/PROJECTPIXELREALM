import { Canvas, Group, Picture, type SkPicture } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { HERO, MAGE, TICK, type Frames } from '../combat/anims';
import type { Hero } from '../net/useHero';
import type { HeroPose } from '../sprites/characters';
import {
  CLASS_OUTFIT,
  CLASS_STATS,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  heroOw,
  lookKey,
  OUTFIT_COLORS,
  SKIN_TONES,
  STAT_LIST,
  type HeroClass,
  type HeroLook,
  type StatKey,
} from '../sprites/hero';
import { PAL } from '../sprites/pixel';
import { gridPicture, heroPicture } from '../sprites/render';
import { colors, fonts } from '../theme';
import { haptic, PixelButton, PixelIcon, SegBar, styles as t } from '../ui/pixel';
import { classScene, SCENE_PHASES } from './scenes';

// Character creation, the first thing a new player sees. Two steps:
//   1. Class: one full-screen card per class, swiped like a dating app. Left throws the card away
//      and brings up the next class; right (or the big button) picks it.
//   2. Look: the picked class's hero in its default outfit, with a name, hair, skin tone, eye color
//      and clothing color to choose. "Begin adventure" makes the hero on the server.

const CLASSES: HeroClass[] = ['warrior', 'mage'];
const DIRS = ['down', 'right', 'up', 'left'] as const;
type Dir = (typeof DIRS)[number];

type ClassInfo = { name: string; role: string; blurb: string; moves: string[]; accent: string; accentDeep: string };
const CLASS_INFO: Record<HeroClass, ClassInfo> = {
  warrior: {
    name: 'Warrior',
    role: 'FRONT LINE',
    blurb: 'Tough and strong. Holds the front, turns blows aside and wins up close.',
    moves: ['Moonlit Slash', 'Starfall Thrust', 'Shield Bash'],
    accent: colors.peach,
    accentDeep: colors.skinPeachShade,
  },
  mage: {
    name: 'Mage',
    role: 'SPELLCASTER',
    blurb: 'Quick and clever. Chains glyphs into fire, frost and healing from afar.',
    moves: ['Ember Bolt', 'Frost Lance', 'Mend'],
    accent: colors.lavender,
    accentDeep: colors.lavenderDeep,
  },
};

// Each class's hero as the cards first show them. The outfit is the class default until dyed.
const START_LOOKS: Record<HeroClass, HeroLook> = {
  warrior: { cls: 'warrior', sex: 'male', skin: 1, hair: 0, hairColor: 0, eyes: 0, outfit: CLASS_OUTFIT.warrior },
  mage: { cls: 'mage', sex: 'female', skin: 0, hair: 2, hairColor: 4, eyes: 4, outfit: CLASS_OUTFIT.mage },
};

const STAT_COLOR: Record<StatKey, string> = {
  hp: colors.hpRose,
  str: colors.xpGold,
  def: colors.manaBlue,
  mag: colors.epicPurple,
  spd: colors.questGreen,
};

const NAMES = ['Bramble', 'Pip', 'Wren', 'Tansy', 'Fennel', 'Juniper', 'Moss', 'Clover', 'Sorrel', 'Thistle', 'Hazel', 'Rowan', 'Briar', 'Poppy', 'Finch', 'Ember', 'Willow', 'Sage', 'Aster', 'Nettle'];

// What each card's hero does while it's on top: breathe, then show the class's signature move with
// the storyboard's own frames (wind-up, a one-tick strike, recovery), then breathe again.
const SHOW: Record<HeroClass, Frames<HeroPose>> = {
  warrior: [...HERO.idle, ...HERO.idle, [3, HERO.ready], ...HERO.coil, [2, HERO.coilHold], ...HERO.slash, ...HERO.back],
  mage: [...HERO.idle, ...HERO.idle, ...MAGE.windup(3, 'G'), [5, MAGE.hold('G')], ...MAGE.cast, [2, MAGE.castHold], ...MAGE.recover],
};
const SHOW_TICKS: Record<HeroClass, number> = {
  warrior: SHOW.warrior.reduce((n, f) => n + f[0], 0),
  mage: SHOW.mage.reduce((n, f) => n + f[0], 0),
};
function poseAt(cls: HeroClass, tick: number): HeroPose {
  let left = tick % SHOW_TICKS[cls];
  for (const [ticks, pose] of SHOW[cls]) {
    if (left < ticks) return pose;
    left -= ticks;
  }
  return {};
}

// A 12 fps tick counter (DESIGN.md 12) that only runs while its screen is in front.
function useTicks(on: boolean) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => setTick((n) => n + 1), TICK);
    return () => clearInterval(id);
  }, [on]);
  return tick;
}

export function CharacterCreation({ onCreate }: { onCreate: (hero: Hero) => Promise<unknown> }) {
  const [step, setStep] = useState<'class' | 'look'>('class');
  const [cls, setCls] = useState<HeroClass>('warrior');
  const [looks, setLooks] = useState(START_LOOKS);
  const [name, setName] = useState('');

  if (step === 'class') {
    return (
      <ClassDeck
        looks={looks}
        start={cls}
        onPick={(c) => {
          haptic('success');
          setCls(c);
          setStep('look');
        }}
      />
    );
  }
  return (
    <Customise
      look={looks[cls]}
      name={name}
      onName={setName}
      onChange={(next) => setLooks((all) => ({ ...all, [cls]: { ...all[cls], ...next } }))}
      onBack={() => setStep('class')}
      onCreate={onCreate}
    />
  );
}

// ---------------------------------------------------------------------------------------------
// Step 1: the class deck.

const CARD_MAX_W = 520;
const BAR_H = 60;

function ClassDeck({ looks, start, onPick }: { looks: Record<HeroClass, HeroLook>; start: HeroClass; onPick: (cls: HeroClass) => void }) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [index, setIndex] = useState(CLASSES.indexOf(start));
  const w = size.w;

  // All on the UI thread: the top card follows the finger and the throw never waits for React.
  const top = useSharedValue(CLASSES.indexOf(start));
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lock = useSharedValue(0);
  const armed = useSharedValue(0);
  const leave = useSharedValue(0);

  const tick = (kind: 'light' | 'heavy') => haptic(kind);
  const picked = (i: number) => onPick(CLASSES[i]);

  // Throws the top card off to the left and brings the next class up.
  const pass = () => {
    'worklet';
    if (lock.value || !w) return;
    lock.value = 1;
    scheduleOnRN(tick, 'light');
    tx.value = withTiming(-w * 1.5, { duration: reduceMotion ? 120 : 240, easing: Easing.in(Easing.quad) }, () => {
      'worklet';
      top.value = (top.value + 1) % CLASSES.length;
      tx.value = 0;
      ty.value = 0;
      armed.value = 0;
      lock.value = 0;
      scheduleOnRN(setIndex, top.value);
    });
  };
  // Throws the top card off to the right: that class is picked.
  const choose = () => {
    'worklet';
    if (lock.value || !w) return;
    lock.value = 1;
    leave.value = withDelay(120, withTiming(1, { duration: 160 }));
    tx.value = withTiming(w * 1.5, { duration: reduceMotion ? 120 : 280, easing: Easing.in(Easing.quad) }, () => {
      'worklet';
      scheduleOnRN(picked, top.value);
    });
  };

  const pan = usePanGesture({
    minDistance: 6,
    onUpdate: (e) => {
      'worklet';
      if (lock.value) return;
      tx.value = e.translationX;
      ty.value = e.translationY * 0.35;
      const now = e.translationX > w * 0.26 ? 1 : e.translationX < -w * 0.26 ? -1 : 0;
      if (now !== armed.value) {
        armed.value = now;
        if (now !== 0) scheduleOnRN(tick, 'light');
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (lock.value) return;
      const far = Math.abs(tx.value) > w * 0.26;
      const fast = Math.abs(e.velocityX) > 700 && Math.abs(tx.value) > 24;
      if ((far && tx.value > 0) || (fast && e.velocityX > 0 && tx.value > 0)) choose();
      else if ((far && tx.value < 0) || (fast && e.velocityX < 0 && tx.value < 0)) pass();
      else {
        armed.value = 0;
        tx.value = reduceMotion ? withTiming(0, { duration: 100 }) : withSpring(0, { damping: 14, stiffness: 180 });
        ty.value = reduceMotion ? withTiming(0, { duration: 100 }) : withSpring(0, { damping: 14, stiffness: 180 });
      }
    },
  });

  // Once, a moment after the deck appears, the top card leans left and settles: it can be thrown.
  useEffect(() => {
    if (!w || reduceMotion) return;
    tx.value = withDelay(900, withSequence(withTiming(-34, { duration: 200, easing: Easing.out(Easing.quad) }), withSpring(0, { damping: 9, stiffness: 160 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w > 0]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: Math.min(width, CARD_MAX_W), h: height });
  };
  const chromeStyle = useAnimatedStyle(() => ({ opacity: 1 - leave.value }));
  const info = CLASS_INFO[CLASSES[index]];
  const barBottom = insets.bottom + 12;

  return (
    <View style={st.deckScreen} onLayout={onLayout}>
      {w > 0 ? (
        <GestureDetector gesture={pan}>
          <View style={{ width: w, height: size.h }}>
            {CLASSES.map((c, i) => (
              <DeckCard key={c} i={i} cls={c} look={looks[c]} w={w} h={size.h} top={top} tx={tx} ty={ty} leave={leave} active={index === i} insetTop={insets.top} padBottom={barBottom + BAR_H + 16} tilt={!reduceMotion} />
            ))}
          </View>
        </GestureDetector>
      ) : null}

      <Animated.View pointerEvents="none" style={[st.deckTop, { top: insets.top + 8 }, chromeStyle]}>
        <View style={st.banner}>
          <Text style={t.stat} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            CHOOSE YOUR CLASS
          </Text>
        </View>
        <View style={st.pips} accessibilityLabel={`Class ${index + 1} of ${CLASSES.length}`}>
          {CLASSES.map((c, i) => (
            <View key={c} style={[st.pip, i === index ? st.pipOn : null]} />
          ))}
        </View>
      </Animated.View>

      <Animated.View style={[st.deckBar, { bottom: barBottom, width: Math.min(w || CARD_MAX_W, CARD_MAX_W) }, chromeStyle]}>
        <PixelButton onPress={() => pass()} fill={colors.vellum} shadow={colors.ink} height={BAR_H} style={{ width: 68 }} accessibilityLabel="Next class">
          <View style={{ alignItems: 'center' }}>
            <PixelIcon name="pass" size={3} color={colors.hpRose} />
          </View>
        </PixelButton>
        <PixelButton onPress={() => choose()} fill={colors.butter} shadow={colors.xpGold} height={BAR_H} style={{ flex: 1 }} accessibilityLabel={`Choose ${info.name}`}>
          <Text style={[t.button, { textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
            CHOOSE {info.name.toUpperCase()}
          </Text>
        </PixelButton>
      </Animated.View>
    </View>
  );
}

// One class card. The top card moves with the finger and tilts; the one behind grows into place as
// the top one leaves, so there is always a card under your thumb.
function DeckCard({
  i,
  cls,
  look,
  w,
  h,
  top,
  tx,
  ty,
  leave,
  active,
  insetTop,
  padBottom,
  tilt,
}: {
  i: number;
  cls: HeroClass;
  look: HeroLook;
  w: number;
  h: number;
  top: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  leave: SharedValue<number>;
  active: boolean;
  insetTop: number;
  padBottom: number;
  tilt: boolean;
}) {
  const n = CLASSES.length;
  const cardStyle = useAnimatedStyle(() => {
    const order = (i - top.value + n) % n;
    if (order === 0) {
      return {
        zIndex: 2,
        opacity: 1,
        transform: [{ translateX: tx.value }, { translateY: ty.value }, { rotate: `${tilt ? (tx.value / w) * 10 : 0}deg` }, { scale: 1 }],
      };
    }
    const p = Math.min(1, Math.abs(tx.value) / (w * 0.6));
    return {
      zIndex: 1,
      opacity: order === 1 ? 1 - leave.value : 0,
      transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 0.9 + 0.1 * p }],
    };
  });
  const pickStyle = useAnimatedStyle(() => ({ opacity: (i - top.value + n) % n === 0 ? interpolate(tx.value, [16, w * 0.26], [0, 1], 'clamp') : 0 }));
  const passStyle = useAnimatedStyle(() => ({ opacity: (i - top.value + n) % n === 0 ? interpolate(tx.value, [-w * 0.26, -40], [1, 0], 'clamp') : 0 }));
  return (
    <Animated.View style={[st.card, { width: w, height: h }, cardStyle]}>
      <ClassCard cls={cls} look={look} w={w - 8} h={h - 8} active={active} padBottom={padBottom} />
      <Animated.View pointerEvents="none" style={[st.stamp, { top: insetTop + 76, left: 20, borderColor: colors.questGreen, transform: [{ rotate: '-12deg' }] }, pickStyle]}>
        <Text style={[st.stampText, { color: colors.leafDeep }]}>PICK!</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[st.stamp, { top: insetTop + 76, right: 20, borderColor: colors.hpRose, transform: [{ rotate: '12deg' }] }, passStyle]}>
        <Text style={[st.stampText, { color: colors.leafRedDeep }]}>NEXT</Text>
      </Animated.View>
    </Animated.View>
  );
}

const ClassCard = memo(function ClassCard({ cls, look, w, h, active, padBottom }: { cls: HeroClass; look: HeroLook; w: number; h: number; active: boolean; padBottom: number }) {
  const info = CLASS_INFO[cls];
  const [sheetH, setSheetH] = useState(250 + padBottom);
  const sceneH = Math.max(120, h - sheetH + 4);
  return (
    <View style={{ width: w, height: h, overflow: 'hidden', backgroundColor: cls === 'warrior' ? colors.sky : colors.leafPlumDeep }}>
      <ShowScene cls={cls} look={look} w={w} h={sceneH} active={active} />
      <View style={[st.sheet, { paddingBottom: padBottom }]} onLayout={(e) => setSheetH(Math.round(e.nativeEvent.layout.height))}>
        <View style={st.sheetHead}>
          <Text style={st.className} maxFontSizeMultiplier={1.2}>
            {info.name}
          </Text>
          <View style={[st.role, { backgroundColor: info.accent }]}>
            <Text style={t.stat} maxFontSizeMultiplier={1.3}>
              {info.role}
            </Text>
          </View>
        </View>
        <Text style={st.blurb}>{info.blurb}</Text>
        <Stats cls={cls} go={active} />
        <View style={st.moves}>
          {info.moves.map((m) => (
            <View key={m} style={[st.move, { backgroundColor: info.accent }]}>
              <Text style={st.moveText} maxFontSizeMultiplier={1.3}>
                {m}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
});

// The class's backdrop with its hero in battle stance, showing off its move while the card is on top.
function ShowScene({ cls, look, w, h, active }: { cls: HeroClass; look: HeroLook; w: number; h: number; active: boolean }) {
  const reduceMotion = useReducedMotion();
  const tick = useTicks(active && !reduceMotion);
  const s = Math.max(4, Math.min(Math.floor(w / 48), Math.floor(h / 50)));
  const gw = Math.ceil(w / s);
  const gh = Math.ceil(h / s);
  const ground = gh - 7;
  const sprite = heroPicture({ ...poseAt(cls, tick), hero: look }, s);
  // The battle frame is 56 x 40 with the body near column 25 and feet on row 37.
  return <SceneCanvas cls={cls} w={w} h={h} s={s} gw={gw} gh={gh} ground={ground} tick={tick} sprite={sprite} sx={Math.round(gw / 2) - 26} sy={ground - 37} />;
}

function SceneCanvas({
  cls,
  w,
  h,
  s,
  gw,
  gh,
  ground,
  tick,
  sprite,
  sx,
  sy,
}: {
  cls: HeroClass;
  w: number;
  h: number;
  s: number;
  gw: number;
  gh: number;
  ground: number;
  tick: number;
  sprite: SkPicture;
  sx: number;
  sy: number;
}) {
  const key = `create-${cls}-${gw}x${gh}@${ground}`;
  const scene = useMemo(() => classScene(cls, gw, gh, ground), [cls, gw, gh, ground]);
  const base = gridPicture(`${key}-base`, scene.base, s);
  const drift = gridPicture(`${key}-drift`, scene.drift, s);
  const phase = Math.floor(tick / 3) % SCENE_PHASES;
  const fx = gridPicture(`${key}-fx${phase}`, () => scene.fx(phase), s);
  const slide = Math.floor(tick / 9) % gw;
  // The canvas is a whole number of art pixels, centered, so it overhangs the card by under one.
  const left = Math.round((w - gw * s) / 2);
  return (
    <Canvas style={{ position: 'absolute', left, top: h - gh * s, width: gw * s, height: gh * s }} pointerEvents="none">
      <Picture picture={base} />
      <Group transform={[{ translateX: slide * s }]}>
        <Picture picture={drift} />
      </Group>
      <Group transform={[{ translateX: (slide - gw) * s }]}>
        <Picture picture={drift} />
      </Group>
      <Picture picture={fx} />
      <Group transform={[{ translateX: sx * s }, { translateY: sy * s }]}>
        <Picture picture={sprite} />
      </Group>
    </Canvas>
  );
}

// Starting stats as segmented bars. They fill block by block each time the card comes to the top
// (DESIGN.md: stat bars animate a block at a time, never a slide).
function Stats({ cls, go }: { cls: HeroClass; go: boolean }) {
  const target = CLASS_STATS[cls];
  const reduceMotion = useReducedMotion();
  const [lit, setLit] = useState(reduceMotion ? 10 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    if (!go) {
      setLit(0);
      return;
    }
    const id = setInterval(() => {
      setLit((n) => {
        if (n >= 10) clearInterval(id);
        return Math.min(10, n + 1);
      });
    }, 45);
    return () => clearInterval(id);
  }, [go, reduceMotion]);
  return (
    <View style={st.stats}>
      {STAT_LIST.map(({ key, label, name }) => (
        <View key={key} style={st.statRow} accessibilityLabel={`${name} ${target[key]} out of 10`}>
          <Text style={[t.stat, st.statLabel]} maxFontSizeMultiplier={1.3}>
            {label}
          </Text>
          <SegBar value={Math.min(lit, target[key])} max={10} segs={10} fill={STAT_COLOR[key]} height={6} />
          <Text style={[t.stat, st.statValue]} maxFontSizeMultiplier={1.3}>
            {target[key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Step 2: the look.

type Tab = 'hair' | 'skin' | 'eyes' | 'clothes';
const TABS: { key: Tab; label: string }[] = [
  { key: 'hair', label: 'Hair' },
  { key: 'skin', label: 'Skin' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'clothes', label: 'Clothes' },
];

function Customise({
  look,
  name,
  onName,
  onChange,
  onBack,
  onCreate,
}: {
  look: HeroLook;
  name: string;
  onName: (name: string) => void;
  onChange: (next: Partial<HeroLook>) => void;
  onBack: () => void;
  onCreate: (hero: Hero) => Promise<unknown>;
}) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const info = CLASS_INFO[look.cls];
  const [tab, setTab] = useState<Tab>('hair');
  const [dir, setDir] = useState(0);
  const [pose, setPose] = useState(0); // bumps on every change: the hero hops and steps in place
  const [busy, setBusy] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);

  // The scene keeps its height when the keyboard squeezes the window (Android).
  const tallest = useRef(0);
  tallest.current = Math.max(tallest.current, win.height);
  const w = Math.min(win.width, 600);
  const sceneH = Math.round(Math.min(420, Math.max(230, tallest.current - 470 - insets.bottom)));

  const change = (next: Partial<HeroLook>) => {
    haptic('light');
    onChange(next);
    setPose((p) => p + 1);
    setError(null);
  };
  const turnTo = (i: number) => setDir(((i % 4) + 4) % 4);
  const shuffle = () => {
    const r = (n: number) => Math.floor(Math.random() * n);
    change({ sex: r(2) ? 'female' : 'male', skin: r(SKIN_TONES.length), hair: r(HAIR_STYLES.length), hairColor: r(HAIR_COLORS.length), eyes: r(EYE_COLORS.length), outfit: r(OUTFIT_COLORS.length) });
  };
  const rollName = () => {
    haptic('light');
    let next = name;
    while (next === name) next = NAMES[Math.floor(Math.random() * NAMES.length)];
    onName(next);
    setError(null);
  };

  // Dragging across the scene spins the hero a quarter turn every 44 points; a tap turns once.
  const spinFrom = useRef(0);
  const dragged = useRef(false);
  const dirRef = useRef(dir);
  dirRef.current = dir;
  const spinStart = () => {
    spinFrom.current = dirRef.current;
    dragged.current = true;
  };
  const spinBy = (steps: number) => {
    haptic('light');
    turnTo(spinFrom.current - steps);
  };
  const dragStep = useSharedValue(0);
  const spin = usePanGesture({
    minDistance: 8,
    onActivate: () => {
      'worklet';
      dragStep.value = 0;
      scheduleOnRN(spinStart);
    },
    onUpdate: (e) => {
      'worklet';
      const steps = Math.round(e.translationX / 44);
      if (steps !== dragStep.value) {
        dragStep.value = steps;
        scheduleOnRN(spinBy, steps);
      }
    },
  });

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
  const dye = OUTFIT_COLORS[look.outfit ?? CLASS_OUTFIT[look.cls]];

  return (
    <Animated.View entering={FadeIn.duration(180)} style={st.lookScreen}>
      <View style={[st.lookScene, { height: sceneH, backgroundColor: look.cls === 'warrior' ? colors.sky : colors.leafPlumDeep }]}>
        <GestureDetector gesture={spin}>
          <Pressable
            onPressIn={() => {
              dragged.current = false;
            }}
            onPress={() => {
              if (dragged.current) return;
              haptic('light');
              turnTo(dir + 1);
            }}
            accessibilityRole="button"
            accessibilityLabel="Your hero. Tap or drag to turn them around."
            style={{ width: w, height: sceneH, alignSelf: 'center', overflow: 'hidden' }}
          >
            <LookScene look={look} dir={DIRS[dir]} pose={pose} w={w} h={sceneH} top={insets.top + 56} />
          </Pressable>
        </GestureDetector>
        <View style={[st.lookTop, { top: insets.top + 8 }]} pointerEvents="box-none">
          <SquareButton icon="back" label="Back to classes" onPress={onBack} />
          <View style={[st.banner, { backgroundColor: info.accent }]} pointerEvents="none">
            <Text style={t.stat} maxFontSizeMultiplier={1.3}>
              {info.name.toUpperCase()}
            </Text>
          </View>
          <SquareButton icon="dice" label="Shuffle your look" onPress={shuffle} />
        </View>
        <View style={st.turnHint} pointerEvents="none">
          <Text style={t.stat} maxFontSizeMultiplier={1.3}>
            DRAG TO TURN
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={st.lookScroll} keyboardShouldPersistTaps="handled">
        <View style={st.column}>
          <Text style={st.label}>NAME</Text>
          <View style={st.nameRow}>
            <Animated.View style={[{ flex: 1 }, shakeStyle]}>
              <TextInput
                ref={nameRef}
                value={name}
                onChangeText={(v) => {
                  onName(v);
                  setError(null);
                }}
                placeholder="Name your hero"
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
            <SquareButton icon="spark" label="Suggest a name" onPress={rollName} size={52} />
          </View>

          <View style={st.tabs} accessibilityRole="tablist">
            {TABS.map(({ key, label }) => (
              <Pressable
                key={key}
                onPress={() => {
                  haptic('light');
                  setTab(key);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === key }}
                accessibilityLabel={label}
                style={[st.tab, tab === key ? st.tabOn : null]}
              >
                <Text style={st.tabText} maxFontSizeMultiplier={1.2} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={st.panel}>
            {tab === 'hair' ? (
              <>
                <Section label="Style">
                  <View style={st.row}>
                    {HAIR_STYLES.map((h, i) => (
                      <Option key={h} label={h} selected={look.hair === i} onPress={() => change({ hair: i })} />
                    ))}
                  </View>
                </Section>
                <Section label={`Color: ${HAIR_COLORS[look.hairColor].name}`}>
                  <View style={st.swatches}>
                    {HAIR_COLORS.map((h, i) => (
                      <Swatch key={h.name} label={`${h.name} hair`} fill={PAL[h.swap.h]} shade={PAL[h.swap.z]} selected={look.hairColor === i} onPress={() => change({ hairColor: i })} />
                    ))}
                  </View>
                </Section>
              </>
            ) : null}
            {tab === 'skin' ? (
              <>
                <Section label={`Skin tone: ${SKIN_TONES[look.skin].name}`}>
                  <View style={st.swatches}>
                    {SKIN_TONES.map((s, i) => (
                      <Swatch key={s.name} label={`${s.name} skin`} fill={PAL[s.swap.S]} shade={PAL[s.swap.s]} selected={look.skin === i} onPress={() => change({ skin: i })} />
                    ))}
                  </View>
                </Section>
                <Section label="Build">
                  <View style={st.row}>
                    {(['male', 'female'] as const).map((s) => (
                      <Option key={s} label={s === 'male' ? 'Male' : 'Female'} selected={look.sex === s} onPress={() => change({ sex: s })} />
                    ))}
                  </View>
                </Section>
              </>
            ) : null}
            {tab === 'eyes' ? (
              <Section label={`Eye color: ${EYE_COLORS[look.eyes ?? 0].name}`}>
                <View style={st.swatches}>
                  {EYE_COLORS.map((e, i) => (
                    <Swatch key={e.name} label={`${e.name} eyes`} fill={PAL[e.key]} shade={colors.ink} selected={(look.eyes ?? 0) === i} onPress={() => change({ eyes: i })} />
                  ))}
                </View>
              </Section>
            ) : null}
            {tab === 'clothes' ? (
              <Section label={`Clothing color: ${dye.name}`}>
                <View style={st.swatches}>
                  {OUTFIT_COLORS.map((o, i) => (
                    <Swatch key={o.name} label={`${o.name} clothes`} fill={PAL[o.main]} shade={PAL[o.shade]} selected={dye === o} onPress={() => change({ outfit: i })} />
                  ))}
                </View>
                <Text style={st.note}>{look.cls === 'warrior' ? "Dyes the warrior's padded coat. The leather and steel stay as they are." : "Dyes the mage's robe and hat."}</Text>
              </Section>
            ) : null}
          </View>
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
            <Text style={[t.button, { textAlign: 'center' }]} maxFontSizeMultiplier={1.3}>
              {busy ? 'SAVING...' : 'BEGIN ADVENTURE'}
            </Text>
          </PixelButton>
        </View>
      </View>
    </Animated.View>
  );
}

// The hero on their class's backdrop, as they'll look on the map. After every change they hop and
// take a few steps in place, so the new look is seen moving.
function LookScene({ look, dir, pose, w, h, top }: { look: HeroLook; dir: Dir; pose: number; w: number; h: number; top: number }) {
  const reduceMotion = useReducedMotion();
  const tick = useTicks(!reduceMotion);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (pose === 0 || reduceMotion) return;
    let f = 0;
    setStep(1);
    const id = setInterval(() => {
      f += 1;
      setStep(f >= 8 ? 0 : f + 1);
      if (f >= 8) clearInterval(id);
    }, 1000 / 8); // the base map's walk cycle
    return () => clearInterval(id);
  }, [pose, reduceMotion]);
  // The hero is 30 rows with headgear; leave the top bar's height clear above them.
  const s = Math.max(3, Math.min(Math.floor(w / 40), Math.floor((h - top) / 36)));
  const gw = Math.ceil(w / s);
  const gh = Math.ceil(h / s);
  const ground = gh - 5;
  const frame = step === 0 ? 0 : (step - 1) % 4;
  const sprite = gridPicture(`create-ow-${lookKey(look)}-${dir}-${frame}`, () => heroOw(look, dir, frame), s);
  const lift = step > 0 && step <= 2 ? 1 : 0;
  return <SceneCanvas cls={look.cls} w={w} h={h} s={s} gw={gw} gh={gh} ground={ground} tick={tick} sprite={sprite} sx={Math.round(gw / 2) - 9} sy={ground - 27 - lift} />;
}

function SquareButton({ icon, label, onPress, size = 48 }: { icon: 'back' | 'dice' | 'spark'; label: string; onPress: () => void; size?: number }) {
  return (
    <PixelButton onPress={onPress} fill={colors.vellum} shadow={colors.ink} height={size} style={{ width: size }} accessibilityLabel={label}>
      <View style={{ alignItems: 'center', marginHorizontal: -14 }}>
        <PixelIcon name={icon} size={3} />
      </View>
    </PixelButton>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={st.section}>
      <Text style={st.label}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={label} style={[st.option, selected ? st.optionOn : null]}>
      <Text style={t.buttonSmall} maxFontSizeMultiplier={1.2} numberOfLines={1}>
        {label}
      </Text>
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
  // Deck
  deckScreen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center' },
  card: { position: 'absolute', left: 0, top: 0, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.ink },
  deckTop: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6 },
  banner: { backgroundColor: colors.vellum, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 10, paddingVertical: 4 },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 16, height: 8, backgroundColor: colors.vellum, borderWidth: 2, borderColor: colors.ink },
  pipOn: { backgroundColor: colors.lavenderDeep, width: 24 },
  deckBar: { position: 'absolute', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  stamp: { position: 'absolute', backgroundColor: colors.vellum, borderWidth: 4, paddingHorizontal: 12, paddingVertical: 2 },
  stampText: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.vellum, borderTopWidth: 4, borderColor: colors.ink, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  className: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, color: colors.ink },
  role: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 6, paddingVertical: 2 },
  blurb: { ...t.body },
  stats: { gap: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { width: 30 },
  statValue: { width: 16, textAlign: 'right' },
  moves: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  move: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 2 },
  moveText: { fontFamily: fonts.button, fontSize: 16, lineHeight: 20, color: colors.ink },

  // Look
  lookScreen: { flex: 1, backgroundColor: colors.parchment },
  lookScene: { borderBottomWidth: 4, borderColor: colors.ink, overflow: 'hidden' },
  lookTop: { position: 'absolute', left: 12, right: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  turnHint: { position: 'absolute', right: 8, bottom: 8, backgroundColor: colors.vellum, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 6, paddingVertical: 1 },
  lookScroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 },
  column: { width: '100%', maxWidth: 600, alignSelf: 'center' },
  label: { fontFamily: fonts.stat, fontSize: 11, lineHeight: 14, color: colors.ink, marginBottom: 6 },
  nameRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  name: {
    height: 52,
    backgroundColor: colors.scroll,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.ink,
  },
  nameFocus: { borderColor: colors.lavenderDeep },
  tabs: { flexDirection: 'row', marginTop: 14 },
  tab: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scroll, borderWidth: 3, borderColor: colors.ink, marginRight: -3, paddingHorizontal: 2 },
  tabOn: { backgroundColor: colors.lavender, zIndex: 1 },
  tabText: { fontFamily: fonts.button, fontSize: 16, lineHeight: 20, color: colors.ink },
  panel: { backgroundColor: colors.vellum, borderWidth: 3, borderColor: colors.ink, marginTop: -3, marginRight: -3, padding: 12, gap: 14, minHeight: 172 },
  section: {},
  row: { flexDirection: 'row', gap: 8 },
  option: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.vellum, borderWidth: 3, borderColor: colors.ink, paddingHorizontal: 2 },
  optionOn: { backgroundColor: colors.lavender },
  swatches: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  swatch: { width: 48, height: 48, padding: 3, borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: colors.lavenderDeep, backgroundColor: colors.lavender },
  chip: { flex: 1, borderWidth: 2, borderColor: colors.ink },
  note: { ...t.caption, color: colors.inkSoft, marginTop: 8 },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.vellum, borderTopWidth: 3, borderColor: colors.ink },
  error: { alignSelf: 'stretch', backgroundColor: colors.rose, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 },
  errorText: { ...t.caption },
});
