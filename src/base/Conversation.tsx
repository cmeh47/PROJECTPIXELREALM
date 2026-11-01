import { Canvas, Picture } from '@shopify/react-native-skia';
import { useAudioPlayer, type AudioSource } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { HEADSHOT } from '../sprites/characters';
import type { Grid } from '../sprites/pixel';
import { gridPicture } from '../sprites/render';
import { colors, fonts } from '../theme';
import { Framed, haptic, PixelIcon } from '../ui/pixel';

// One box of a conversation. A node either moves on to `next`, offers `choices`, or ends the
// conversation with an `end` tag that the base acts on (start a battle, accept a quest...).
export type Node = {
  say: string;
  mood?: string; // passed to the speaker's portrait
  name?: string; // overrides the speaker's name on the tab from this box on
  silent?: boolean; // no voice and no mouth movement: for "..." beats
  choices?: { label: string; next: string }[];
  next?: string;
  end?: string;
};
export type Script = Record<string, Node>;
export type Speaker = {
  key: string;
  name: string;
  voice: AudioSource;
  // loop: the clip repeats while a line types and stops when it finishes (the butcher's grunts).
  // Otherwise it plays once per line (a Shroomie's squeak).
  loop?: boolean;
  portrait: (mood: string | undefined, talking: boolean) => Grid;
};

const CHAR_MS = 48;
const SILENT_CHAR_MS = 220; // "..." types out slowly, a beat at a time
const MOUTH_MS = 1000 / 6; // the mouth flaps every two 12 fps ticks while the text runs
const TYPE_TICK = 1000 / 30;
const PORTRAIT_SCALE = 2;

// Classic RPG text box: the speaker's headshot on the left, their name on a tab, each line typing
// out with their voice. A tap while it types shows the whole line; a tap after moves on. When a
// line offers choices, they stack above the box once it has finished typing.
export function Conversation({ speaker, script, start, bottom, onEnd }: { speaker: Speaker; script: Script; start: string; bottom: number; onEnd: (end?: string) => void }) {
  const [id, setId] = useState(start);
  const [name, setName] = useState(script[start].name ?? speaker.name);
  const [shown, setShown] = useState(0);
  const [mouth, setMouth] = useState(false);
  const node = script[id];
  const done = shown >= node.say.length;
  const player = useAudioPlayer(speaker.voice);
  player.loop = !!speaker.loop;
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    haptic('light');
    rise.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each new box speaks, unless it's a silent beat.
  useEffect(() => {
    if (node.name) setName(node.name);
    if (!node.silent) {
      player.seekTo(0);
      player.play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (done) {
      setMouth(false);
      if (speaker.loop) player.pause();
      return;
    }
    // Letters follow the clock, not the timer count, so a busy frame never slows the line down.
    const per = node.silent ? SILENT_CHAR_MS : CHAR_MS;
    const t0 = performance.now();
    const type = setInterval(() => setShown(Math.floor((performance.now() - t0) / per)), TYPE_TICK);
    const flap = node.silent ? null : setInterval(() => setMouth((m) => !m), MOUTH_MS);
    return () => {
      clearInterval(type);
      if (flap) clearInterval(flap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, node.silent]);

  const portraits = useMemo(
    () => [false, true].map((talking) => gridPicture(`talk-${speaker.key}-${node.mood ?? ''}-${talking ? 1 : 0}`, speaker.portrait(node.mood, talking), PORTRAIT_SCALE)),
    [speaker, node.mood],
  );
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: Math.round(rise.value * 40) }], opacity: 1 - rise.value }));
  const side = HEADSHOT * PORTRAIT_SCALE;
  const choosing = done && !!node.choices;

  const go = (next?: string, end?: string) => {
    if (next) {
      haptic('light');
      setShown(0);
      setId(next);
    } else {
      player.pause();
      onEnd(end);
    }
  };
  const tap = () => {
    if (!done) setShown(node.say.length);
    else if (!node.choices) go(node.next, node.end);
  };
  const plain = node.say.replace(/​/g, '');

  return (
    <Pressable
      style={StyleSheet.absoluteFill}
      onPress={tap}
      accessibilityRole="button"
      accessibilityLabel={`${name} says ${plain}${choosing ? '' : `. Tap to ${done ? 'continue' : 'skip'}.`}`}
    >
      <Animated.View style={[st.wrap, { bottom }, slide]}>
        {choosing ? (
          <View style={st.choices}>
            {node.choices!.map((c) => (
              <Choice key={c.label} label={c.label} onPress={() => go(c.next)} />
            ))}
          </View>
        ) : null}
        <View style={st.nameTab}>
          <Text style={st.name}>{name.toUpperCase()}</Text>
        </View>
        <Framed depth={2}>
          <View style={st.row}>
            <View style={[st.portrait, { width: side + 8, height: side + 8 }]}>
              <Canvas style={{ width: side, height: side }}>
                <Picture picture={portraits[mouth ? 1 : 0]} />
              </Canvas>
            </View>
            <View style={st.textBox}>
              <Text style={st.line}>{node.say.slice(0, shown)}</Text>
              {done && !node.choices ? <NextArrow /> : null}
            </View>
          </View>
        </Framed>
      </Animated.View>
    </Pressable>
  );
}

// A reply option: a framed row with a cursor that slides in while it's held.
function Choice({ label, onPress }: { label: string; onPress: () => void }) {
  const [down, setDown] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={() => {
        setDown(true);
        haptic('light');
      }}
      onPressOut={() => setDown(false)}
      onPress={onPress}
      style={[st.choice, down ? st.choiceDown : null]}
    >
      <View style={{ width: 14, opacity: down ? 1 : 0.35, transform: [{ rotate: '-90deg' }] }}>
        <PixelIcon name="next" size={2} color={colors.ink} />
      </View>
      <Text style={st.choiceText}>{label}</Text>
    </Pressable>
  );
}

// The little "more" arrow that bobs in the corner once the line has finished.
function NextArrow() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setUp((u) => !u), 333);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={[st.arrow, { transform: [{ translateY: up ? -2 : 0 }] }]}>
      <PixelIcon name="next" size={2} color={colors.lavenderDeep} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  choices: { alignSelf: 'flex-end', maxWidth: '88%', gap: 6, marginBottom: 10 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.vellum,
    borderWidth: 3,
    borderColor: colors.ink,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  choiceDown: { backgroundColor: colors.butter },
  choiceText: { flex: 1, fontFamily: fonts.heading, fontSize: 16, lineHeight: 21, color: colors.ink },
  nameTab: { alignSelf: 'flex-start', marginLeft: 10, marginBottom: -2, backgroundColor: colors.lavender, borderWidth: 2, borderColor: colors.ink, borderBottomWidth: 0, paddingHorizontal: 8, paddingTop: 3, paddingBottom: 2 },
  name: { fontFamily: fonts.stat, fontSize: 12, lineHeight: 15, color: colors.ink },
  row: { flexDirection: 'row', gap: 12, padding: 10, alignItems: 'center' },
  portrait: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  textBox: { flex: 1, minHeight: 88, justifyContent: 'center' },
  line: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 26, color: colors.ink },
  arrow: { position: 'absolute', right: 0, bottom: 0 },
});
