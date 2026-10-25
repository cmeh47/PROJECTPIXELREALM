import { useCallback, useRef } from 'react';
import { useManualGesture } from 'react-native-gesture-handler';
import { useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { WINDOWS, type Defense, type Grade } from './rules';

// Timing is judged on the UI thread, at the moment the finger lands, against a target
// time both threads read from the same clock. The JS side only hears the verdict.

const MODE_OFF = 0;
const MODE_RUNE = 1;
const MODE_DEFEND = 2;

export type RuneVerdict = { grade: Grade; dt: number | null };
export type DefendVerdict = { defense: Defense; dt: number | null };

// x / y are window coordinates.
type RuneTarget = { x: number; y: number; radius: number };

export function useCombatInput(assist: boolean) {
  const mode = useSharedValue(MODE_OFF);
  const target = useSharedValue(0);
  const runeX = useSharedValue(0);
  const runeY = useSharedValue(0);
  const runeR = useSharedValue(40);
  const downT = useSharedValue(0);
  const downX = useSharedValue(0);
  const pending = useSharedValue(0);
  const scale = useSharedValue(assist ? WINDOWS.assist : 1);
  scale.value = assist ? WINDOWS.assist : 1;

  const resolveRef = useRef<((v: RuneVerdict) => void) | null>(null);
  const defendRef = useRef<((v: DefendVerdict) => void) | null>(null);

  const finishRune = useCallback((grade: Grade, dt: number) => {
    const r = resolveRef.current;
    resolveRef.current = null;
    r?.({ grade, dt });
  }, []);

  const finishDefend = useCallback((defense: Defense, dt: number) => {
    const r = defendRef.current;
    defendRef.current = null;
    r?.({ defense, dt });
  }, []);

  const gesture = useManualGesture({
    onTouchesDown: (e) => {
      'worklet';
      const t = Date.now();
      const touch = e.changedTouches[0];
      if (!touch) return;
      if (mode.value === MODE_RUNE) {
        const ddx = touch.absoluteX - runeX.value;
        const ddy = touch.absoluteY - runeY.value;
        if (ddx * ddx + ddy * ddy > runeR.value * runeR.value) return;
        const dt = t - target.value;
        const k = scale.value;
        let grade: Grade = 'miss';
        if (dt < -WINDOWS.good * k) grade = 'early';
        else if (Math.abs(dt) <= WINDOWS.perfect * k) grade = 'perfect';
        else if (Math.abs(dt) <= WINDOWS.good * k) grade = 'good';
        mode.value = MODE_OFF;
        scheduleOnRN(finishRune, grade, dt);
      } else if (mode.value === MODE_DEFEND && pending.value === 0) {
        downT.value = t;
        downX.value = touch.x;
        pending.value = 1;
      }
    },
    onTouchesMove: (e) => {
      'worklet';
      const touch = e.changedTouches[0];
      if (!touch || mode.value !== MODE_DEFEND || pending.value !== 1) return;
      if (Math.abs(touch.x - downX.value) > 28) {
        pending.value = 2;
        const dt = downT.value - target.value;
        const k = scale.value;
        const defense: Defense = dt < -WINDOWS.dodge * k ? 'early' : Math.abs(dt) <= WINDOWS.dodge * k ? 'dodge' : 'hit';
        mode.value = MODE_OFF;
        scheduleOnRN(finishDefend, defense, dt);
      }
    },
    onTouchesUp: () => {
      'worklet';
      if (mode.value !== MODE_DEFEND || pending.value !== 1) return;
      pending.value = 2;
      const dt = downT.value - target.value;
      const k = scale.value;
      const defense: Defense = dt < -WINDOWS.parry * k ? 'early' : Math.abs(dt) <= WINDOWS.parry * k ? 'parry' : 'hit';
      mode.value = MODE_OFF;
      scheduleOnRN(finishDefend, defense, dt);
    },
  });

  // Arms one strike rune. Resolves with the grade, or a miss once the window has passed.
  const armRune = useCallback(
    (delay: number, at: RuneTarget) =>
      new Promise<RuneVerdict>((resolve) => {
        resolveRef.current = resolve;
        runeX.value = at.x;
        runeY.value = at.y;
        runeR.value = at.radius;
        target.value = Date.now() + delay;
        mode.value = MODE_RUNE;
        const late = WINDOWS.good * (assist ? WINDOWS.assist : 1);
        setTimeout(() => {
          if (resolveRef.current !== resolve) return;
          mode.value = MODE_OFF;
          resolveRef.current = null;
          resolve({ grade: 'miss', dt: null });
        }, delay + late + 60);
      }),
    [assist, mode, runeR, runeX, runeY, target],
  );

  // Moves the live rune target while it drifts or darts, so taps follow what the player sees.
  const moveRune = useCallback(
    (x: number, y: number) => {
      runeX.value = x;
      runeY.value = y;
    },
    [runeX, runeY],
  );

  // Arms the defense window for one enemy hit landing `delay` ms from now.
  const armDefend = useCallback(
    (delay: number) =>
      new Promise<DefendVerdict>((resolve) => {
        defendRef.current = resolve;
        pending.value = 0;
        target.value = Date.now() + delay;
        mode.value = MODE_DEFEND;
        const late = WINDOWS.dodge * (assist ? WINDOWS.assist : 1);
        setTimeout(() => {
          if (defendRef.current !== resolve) return;
          mode.value = MODE_OFF;
          defendRef.current = null;
          resolve({ defense: 'hit', dt: null });
        }, delay + late + 60);
      }),
    [assist, mode, pending, target],
  );

  const disarm = useCallback(() => {
    mode.value = MODE_OFF;
    resolveRef.current = null;
    defendRef.current = null;
  }, [mode]);

  return { gesture, armRune, moveRune, armDefend, disarm };
}
