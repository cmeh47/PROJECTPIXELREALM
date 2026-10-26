import { Canvas, Picture } from '@shopify/react-native-skia';
import { useAudioPlayer } from 'expo-audio';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { SHROOMIE_PORTRAIT, shroomiePortrait } from '../sprites/characters';
import { gridPicture } from '../sprites/render';
import { colors, fonts } from '../theme';
import { Framed, haptic, PixelIcon } from '../ui/pixel';

export type Critter = { name: string; look: number };

// A zero-width space lets the line wrap after the first long "Weeeeeiiiie" on a narrow phone.
const SHROOMIE_LINE = '...Weeeeeiiiie\u200bWeWeWeeeiiiiii...';
const CHAR_MS = 48; // types out alongside the 1.5 s voice clip
const MOUTH_MS = 1000 / 6; // the mouth flaps every two 12 fps ticks while the text runs
const PORTRAIT_SCALE = 2;
const voice = require('../../assets/sounds/shroomie.wav');

// Classic RPG text box: the critter's portrait on the left, its name on a tab, the line typing
// out with its voice. A tap while it types shows the whole line; a tap after closes the box.
export function CritterDialog({ critter, bottom, onClose }: { critter: Critter; bottom: number; onClose: () => void }) {
  const [shown, setShown] = useState(0);
  const [mouth, setMouth] = useState(false);
  const done = shown >= SHROOMIE_LINE.length;
  const player = useAudioPlayer(voice);
  const reduceMotion = useReducedMotion();
  const rise = useSharedValue(reduceMotion ? 0 : 1);

  useEffect(() => {
    haptic('light');
    player.seekTo(0);
    player.play();
    rise.value = withTiming(0, { duration: 160, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done) {
      setMouth(false);
      return;
    }
    const type = setInterval(() => setShown((n) => n + 1), CHAR_MS);
    const flap = setInterval(() => setMouth((m) => !m), MOUTH_MS);
    return () => {
      clearInterval(type);
      clearInterval(flap);
    };
  }, [done]);

  const portraits = useMemo(
    () => [false, true].map((talking) => gridPicture(`critter-${critter.look}-${talking ? 1 : 0}`, shroomiePortrait(critter.look, talking), PORTRAIT_SCALE)),
    [critter.look],
  );
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: Math.round(rise.value * 40) }], opacity: 1 - rise.value }));
  const side = SHROOMIE_PORTRAIT * PORTRAIT_SCALE;

  const tap = () => {
    if (!done) setShown(SHROOMIE_LINE.length);
    else {
      player.pause();
      onClose();
    }
  };

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={tap} accessibilityRole="button" accessibilityLabel={`${critter.name} says ${SHROOMIE_LINE.replace(/\u200b/g, '')}. Tap to ${done ? 'close' : 'skip'}.`}>
      <Animated.View style={[st.wrap, { bottom }, slide]}>
        <View style={st.nameTab}>
          <Text style={st.name}>{critter.name.toUpperCase()}</Text>
        </View>
        <Framed depth={2}>
          <View style={st.row}>
            <View style={[st.portrait, { width: side + 8, height: side + 8 }]}>
              <Canvas style={{ width: side, height: side }}>
                <Picture picture={portraits[mouth ? 1 : 0]} />
              </Canvas>
            </View>
            <View style={st.textBox}>
              <Text style={st.line}>{SHROOMIE_LINE.slice(0, shown)}</Text>
              {done ? <NextArrow /> : null}
            </View>
          </View>
        </Framed>
      </Animated.View>
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
  nameTab: { alignSelf: 'flex-start', marginLeft: 10, marginBottom: -2, backgroundColor: colors.lavender, borderWidth: 2, borderColor: colors.ink, borderBottomWidth: 0, paddingHorizontal: 8, paddingTop: 3, paddingBottom: 2 },
  name: { fontFamily: fonts.stat, fontSize: 12, lineHeight: 15, color: colors.ink },
  row: { flexDirection: 'row', gap: 12, padding: 10, alignItems: 'center' },
  portrait: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.sky, alignItems: 'center', justifyContent: 'center' },
  textBox: { flex: 1, minHeight: 88, justifyContent: 'center' },
  line: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 26, color: colors.ink },
  arrow: { position: 'absolute', right: 0, bottom: 0 },
});
