import { Canvas, Picture } from '@shopify/react-native-skia';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, SlideInLeft, SlideOutLeft } from 'react-native-reanimated';

import { foePortrait } from '../sprites/characters';
import { gridPicture } from '../sprites/render';
import { colors, fonts } from '../theme';
import { haptic, PixelIcon, SegBar, styles as t } from '../ui/pixel';
import { logPicture } from './art';

// item 'wood': bring `need` wood (a bar fills as you gather it). 'go': a task with no count, like
// leading someone home; `turnIn` is the step to take, shown under the title.
export type Quest = { id: string; title: string; giver: 'butcher' | 'merchant'; item: 'wood' | 'go'; have: number; need: number; turnIn: string };

// The quest log: a little parchment scroll under the base panel. Tap its header to roll it up to
// a single band, and again to unroll it. It's only on screen while you have a quest.
export function QuestLog({ quests }: { quests: Quest[] }) {
  const [open, setOpen] = useState(true);
  const toggle = () => {
    haptic('light');
    setOpen((o) => !o);
  };
  return (
    <Animated.View entering={SlideInLeft.duration(240)} exiting={SlideOutLeft.duration(200)} layout={LinearTransition.duration(180)} style={st.wrap}>
      <Rod />
      <Animated.View layout={LinearTransition.duration(180)} style={st.paper}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={`Quest log, ${quests.length} ${quests.length === 1 ? 'quest' : 'quests'}. ${open ? 'Roll up' : 'Unroll'}`}
          accessibilityState={{ expanded: open }}
          hitSlop={6}
          style={st.header}
        >
          <Text style={st.headerText}>QUESTS · {quests.length}</Text>
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
            <PixelIcon name="next" size={2} color={colors.barkDeep} />
          </View>
        </Pressable>
        {open ? (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(100)}>
            {quests.map((q) => (
              <QuestEntry key={q.id} q={q} />
            ))}
          </Animated.View>
        ) : null}
      </Animated.View>
      <Rod />
    </Animated.View>
  );
}

function QuestEntry({ q }: { q: Quest }) {
  const face = useMemo(() => gridPicture(`quest-giver-${q.giver}`, foePortrait(q.giver), 1), [q.giver]);
  const have = Math.min(q.have, q.need);
  const ready = have >= q.need;
  if (q.item === 'go') {
    return (
      <View style={st.entry} accessibilityLabel={`${q.title}. ${q.turnIn}.`}>
        <View style={st.rule} />
        <View style={st.titleRow}>
          <View style={st.face}>
            <Canvas style={{ width: 20, height: 20 }}>
              <Picture picture={face} />
            </Canvas>
          </View>
          <Text style={st.title}>{q.title}</Text>
        </View>
        <Text style={st.step}>{q.turnIn}</Text>
      </View>
    );
  }
  return (
    <View style={st.entry} accessibilityLabel={`${q.title}. Wood ${have} of ${q.need}.${ready ? ` ${q.turnIn}.` : ''}`}>
      <View style={st.rule} />
      <View style={st.titleRow}>
        <View style={st.face}>
          <Canvas style={{ width: 20, height: 20 }}>
            <Picture picture={face} />
          </Canvas>
        </View>
        <Text style={st.title}>{q.title}</Text>
      </View>
      <View style={st.goal}>
        <Canvas style={{ width: 14, height: 9 }}>
          <Picture picture={logPicture(1)} />
        </Canvas>
        <Text style={t.stat}>
          {have}/{q.need}
        </Text>
        <SegBar value={have} max={q.need} segs={q.need} fill={colors.questGreen} height={5} />
      </View>
      {ready ? <Text style={st.ready}>{q.turnIn.toUpperCase()}</Text> : null}
    </View>
  );
}

// A wooden roller with a knob at each end; the paper hangs between two of them.
function Rod() {
  return (
    <View style={st.rod}>
      <View style={st.knob} />
      <View style={st.bar}>
        <View style={st.barShine} />
      </View>
      <View style={st.knob} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { width: 184 },
  rod: { flexDirection: 'row', alignItems: 'center', height: 12, zIndex: 1 },
  knob: { width: 7, height: 12, backgroundColor: colors.barkDeep, borderWidth: 2, borderColor: colors.ink },
  bar: { flex: 1, height: 9, backgroundColor: colors.bark, borderTopWidth: 2, borderBottomWidth: 2, borderColor: colors.ink, justifyContent: 'flex-start' },
  barShine: { height: 2, marginHorizontal: 4, backgroundColor: colors.peach, opacity: 0.6 },
  paper: {
    marginHorizontal: 6,
    marginVertical: -2,
    backgroundColor: colors.scroll,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 6,
  },
  header: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { fontFamily: fonts.stat, fontSize: 11, lineHeight: 14, color: colors.barkDeep },
  entry: { gap: 4, paddingBottom: 2 },
  rule: { height: 2, backgroundColor: colors.bark, opacity: 0.35, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  face: { width: 24, height: 24, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 14, lineHeight: 17, color: colors.ink },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  step: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  ready: { alignSelf: 'flex-start', fontFamily: fonts.stat, fontSize: 10, lineHeight: 13, color: colors.ink, backgroundColor: colors.mint, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 4 },
});
