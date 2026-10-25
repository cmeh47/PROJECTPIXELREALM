import { Canvas, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type HostInstance } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { foePortrait, heroPortrait, type FoePose, type HeroPose } from '../sprites/characters';
import { gridPicture, SCENE_W } from '../sprites/render';
import { colors } from '../theme';
import { Chip, Framed, haptic, PixelButton, PixelIcon, SegBar, styles as t } from '../ui/pixel';
import { FOE, HERO, TICK, type Frames } from './anims';
import { BattleScene, FOE_HOME, HERO_HOME, type RuneFx } from './BattleScene';
import { PopText, type Pop } from './Pops';
import {
  AP_MAX,
  BREAK_MAX,
  COUNTER_BREAK,
  COUNTER_DAMAGE,
  ENEMY_HIT,
  FINISHER_BREAK,
  FINISHER_DAMAGE,
  FLEE_CHANCE,
  FOE_MAX_HP,
  GRADE_BREAK,
  GRADE_MULT,
  HERO_MAX_HP,
  MOVES,
  PATTERNS,
  rand,
  tameChance,
  type Move,
} from './rules';
import { useCombatInput } from './useCombatInput';

type Phase = 'menu' | 'moves' | 'tame' | 'flee' | 'acting' | 'won' | 'lost' | 'tamed' | 'fled';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const MELEE_GAP = 14;

export function BattleScreen() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const s = Math.max(2, Math.min(4, Math.floor((Math.min(width, 520) - 32) / SCENE_W)));

  const [phase, setPhase] = useState<Phase>('menu');
  const [guarding, setGuarding] = useState(false);
  const [heroPose, setHeroPose] = useState<HeroPose>(HERO.ready);
  const [foePose, setFoePose] = useState<FoePose>({});
  const [hp, setHp] = useState(HERO_MAX_HP);
  const [foeHp, setFoeHp] = useState(FOE_MAX_HP);
  const [brk, setBrk] = useState(0);
  const [broken, setBroken] = useState(false);
  const [ap, setAp] = useState(2);
  const [chain, setChain] = useState(0);
  const [hint, setHint] = useState('');
  const [line, setLine] = useState('A Mossback Toadstool blocks the path. It grips its club and sways.');
  const [pops, setPops] = useState<Pop[]>([]);
  const [sel, setSel] = useState(0);
  const [treat, setTreat] = useState(false);
  const [treats, setTreats] = useState(3);
  const [assist, setAssist] = useState(false);
  const [idle, setIdle] = useState(true);

  // Mirrors of state for the async combat sequences.
  const live = useRef({ hp, foeHp, brk, broken });
  live.current = { hp, foeHp, brk, broken };
  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  const heroX = useSharedValue(0);
  const foeX = useSharedValue(0);
  const shake = useSharedValue(0);
  const rune: RuneFx = {
    visible: useSharedValue(0),
    x: useSharedValue(0),
    y: useSharedValue(0),
    ring: useSharedValue(16),
    decoy: useSharedValue(0),
    decoyX: useSharedValue(0),
    decoyY: useSharedValue(0),
  };
  // The scene's top-left in window coordinates; runes are hit-tested against absolute touch points.
  const sceneOrigin = useRef({ x: 0, y: 0 });
  const sceneRef = useRef<HostInstance>(null);
  const measureScene = useCallback(() => {
    sceneRef.current?.measureInWindow((x: number, y: number) => {
      sceneOrigin.current = { x: x + 3, y: y + 3 };
    });
  }, []);
  const { gesture, armRune, armDefend, disarm } = useCombatInput(assist);

  // Idle breathing for both characters while the player decides.
  useEffect(() => {
    if (!idle) return;
    let i = 0;
    const id = setInterval(() => {
      i = (i + 1) % 4;
      setFoePose(FOE.idle[i][1]);
      setHeroPose(i % 2 === 0 ? HERO.ready : { ...HERO.ready, crouch: true, hy: 5 });
    }, TICK * 3);
    return () => clearInterval(id);
  }, [idle]);

  const popId = useRef(0);
  const pop = useCallback((text: string, color: string, x: number, y: number, extra?: Partial<Pop>) => {
    popId.current += 1;
    const p: Pop = { id: popId.current, text, color, x, y, ...extra };
    setPops((ps) => [...ps, p]);
  }, []);
  const dropPop = useCallback((id: number) => setPops((ps) => ps.filter((p) => p.id !== id)), []);

  const doShake = useCallback(
    (amt: number) => {
      shake.value = withSequence(
        withTiming(amt, { duration: 30 }),
        withTiming(-amt, { duration: 40 }),
        withTiming(amt / 2, { duration: 40 }),
        withTiming(0, { duration: 40 }),
      );
    },
    [shake],
  );
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: Math.round(shake.value) }] }));

  const playHero = useCallback(async (frames: Frames<HeroPose>) => {
    for (const [ticks, pose] of frames) {
      if (!alive.current) return;
      setHeroPose(pose);
      await wait(ticks * TICK);
    }
  }, []);
  const playFoe = useCallback(async (frames: Frames<FoePose>) => {
    for (const [ticks, pose] of frames) {
      if (!alive.current) return;
      setFoePose(pose);
      await wait(ticks * TICK);
    }
  }, []);

  const meleeX = () => FOE_HOME + foeX.value - MELEE_GAP - HERO_HOME;

  const dealDamage = useCallback(
    (dmg: number, brkGain: number) => {
      const st = live.current;
      const real = Math.round(dmg * (st.broken ? 1.5 : 1));
      const nextHp = Math.max(0, st.foeHp - real);
      let nextBrk = st.brk;
      let justBroke = false;
      if (!st.broken) {
        nextBrk = Math.min(BREAK_MAX, st.brk + brkGain);
        if (nextBrk >= BREAK_MAX) justBroke = true;
      }
      live.current = { ...st, foeHp: nextHp, brk: nextBrk, broken: st.broken || justBroke };
      setFoeHp(nextHp);
      setBrk(nextBrk);
      if (justBroke) setBroken(true);
      return { real, justBroke, dead: nextHp <= 0 };
    },
    [],
  );

  const toScreen = (ax: number, ay: number) => ({ x: sceneOrigin.current.x + ax * s, y: sceneOrigin.current.y + ay * s });

  // ---------- Enemy turn ----------
  const enemyTurn = useCallback(async () => {
    if (live.current.broken) {
      setHint('It is Broken and loses its turn.');
      pop('STUNNED', colors.rose, FOE_HOME + 36, 18);
      await playFoe(FOE.stagger);
      live.current = { ...live.current, broken: false, brk: 0 };
      setBroken(false);
      setBrk(0);
      return;
    }
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    setGuarding(true);
    setHint('Watch the wind-up. Tap to parry, swipe sideways to dodge.');
    setLine(pattern.feint ? 'The toadstool sways oddly...' : 'The toadstool raises its club!');
    setHeroPose(HERO.guard);
    foeX.value = withTiming(-36, { duration: 280, easing: Easing.out(Easing.quad) });
    await playFoe([[3, { crouch: true }], [1, {}]]);

    let parried = 0;
    let wasted = false;
    for (let hit = 0; hit < pattern.hits; hit++) {
      if (!alive.current) return;
      const windTicks = hit === 0 ? 4 : 2;
      const hold = hit === 0 ? rand(380, 900) : rand(280, 520);
      const feintMs = pattern.feint && hit === 0 ? 3 * TICK + rand(250, 520) : 0;
      const delay = windTicks * TICK + hold + feintMs;
      const verdictP = armDefend(delay);
      let early = false;
      verdictP.then((v) => {
        if (v.defense === 'early') {
          early = true;
          wasted = true;
          setHeroPose(HERO.early[0][1]);
          pop('TOO EARLY', colors.rose, HERO_HOME + 24, 14, { sub: v.dt != null ? `${Math.round(v.dt)} MS` : undefined });
        }
      });
      await playFoe(hit === 0 ? FOE.windup : FOE.rewind);
      setFoePose(FOE.tellHold);
      if (feintMs) {
        await wait(hold * 0.6);
        await playFoe(FOE.feint);
        setFoePose(FOE.tellHold);
        await wait(feintMs - 3 * TICK + hold * 0.4);
      } else {
        await wait(hold);
      }
      setFoePose(FOE.swing[0][1]);
      const v = await verdictP;
      setFoePose(FOE.impact);
      const at = { x: HERO_HOME + 30, y: 22 };
      if (v.defense === 'parry' && !early) {
        parried += 1;
        haptic('success');
        doShake(2);
        pop(parried > 1 ? `PARRY X${parried}` : 'PARRY', colors.sky, at.x, at.y - 6, { sub: v.dt != null ? `${Math.round(v.dt)} MS` : undefined });
        setAp((a) => Math.min(AP_MAX, a + 1));
        await playHero(HERO.parry);
      } else if (v.defense === 'dodge' && !early) {
        pop('DODGE', colors.lavender, at.x, at.y - 6, { sub: v.dt != null ? `${Math.round(v.dt)} MS` : undefined });
        await playHero(HERO.dodge.slice(0, 3));
        setHeroPose(HERO.dodge[4][1]);
      } else {
        haptic('warning');
        doShake(4);
        const next = Math.max(0, live.current.hp - ENEMY_HIT);
        live.current = { ...live.current, hp: next };
        setHp(next);
        pop(`-${ENEMY_HIT}`, colors.hpRose, at.x, at.y, { big: true });
        await playHero(HERO.hurt);
        if (next <= 0) break;
      }
      await playFoe(FOE.recover.slice(0, 1));
      setHeroPose(HERO.guard);
    }

    if (live.current.hp <= 0) return;

    if (parried === pattern.hits && !wasted) {
      setHint('Every hit parried: counter!');
      setLine('A perfect defense. Your knight strikes back!');
      heroX.value = withTiming(meleeX(), { duration: TICK * 2, easing: Easing.out(Easing.cubic) });
      const counter = playHero(HERO.counter);
      await wait(TICK * 2);
      haptic('heavy');
      const r = dealDamage(COUNTER_DAMAGE, COUNTER_BREAK);
      await wait(TICK);
      setFoePose(FOE.hurt[0][1]);
      doShake(5);
      pop('COUNTER', colors.butter, FOE_HOME - 36 + 30, 12, { big: true });
      pop(`-${r.real}`, colors.hpRose, FOE_HOME - 36 + 40, 26);
      if (r.justBroke) pop('BREAK!', colors.rose, FOE_HOME - 36 + 44, 6);
      await counter;
      heroX.value = withTiming(0, { duration: 260 });
    }
    foeX.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) });
    await playFoe(FOE.recover);
  }, [armDefend, dealDamage, doShake, foeX, heroX, playFoe, playHero, pop]);

  const endTurn = useCallback(async () => {
    if (live.current.foeHp <= 0) {
      setFoePose(FOE.down);
      setLine('The Mossback Toadstool flops over. Victory!');
      setPhase('won');
      setIdle(false);
      haptic('success');
      return;
    }
    await enemyTurn();
    setGuarding(false);
    if (!alive.current) return;
    if (live.current.hp <= 0) {
      setHeroPose(HERO.down);
      setLine('Your party rests... and tries again.');
      setPhase('lost');
      return;
    }
    if (live.current.foeHp <= 0) {
      await endTurn();
      return;
    }
    setHint('');
    setLine(live.current.broken ? 'It is Broken! Hit it hard, or try to tame it.' : 'The toadstool steadies itself. Your turn.');
    setPhase('menu');
    setIdle(true);
  }, [enemyTurn]);

  // ---------- Your turn: a move with strike runes ----------
  const runMove = useCallback(
    async (move: Move) => {
      measureScene();
      setPhase('acting');
      setIdle(false);
      setAp((a) => Math.min(AP_MAX, a - move.cost));
      setLine(`You use ${move.name}!`);
      setHint('Tap the rune as the ring closes on it.');
      setChain(0);

      await playHero(HERO.dash.slice(0, 1));
      heroX.value = withTiming(meleeX(), { duration: TICK * 2, easing: Easing.out(Easing.cubic) });
      await playHero(HERO.dash.slice(1));
      await playHero(HERO.coil);

      let perfects = 0;
      let lastX = move.runes[0].x;
      let lastY = move.runes[0].y;
      for (let i = 0; i < move.runes.length; i++) {
        if (!alive.current) return;
        const r = move.runes[i];
        setHeroPose(HERO.coilHold);
        if (r.decoy) {
          rune.decoyX.value = r.decoy[0];
          rune.decoyY.value = r.decoy[1];
          rune.decoy.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(0.2, { duration: 90 }), withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 120 }));
          await wait(340);
        }
        if (r.dart && i > 0) {
          rune.x.value = lastX;
          rune.y.value = lastY;
          rune.visible.value = 1;
          rune.x.value = withTiming(r.x, { duration: 140, easing: Easing.out(Easing.cubic) });
          rune.y.value = withTiming(r.y, { duration: 140, easing: Easing.out(Easing.cubic) });
        } else {
          rune.x.value = r.x;
          rune.y.value = r.y;
          rune.visible.value = 1;
          if (r.drift) {
            rune.x.value = withTiming(r.x + r.drift[0], { duration: r.delay, easing: Easing.inOut(Easing.sin) });
            rune.y.value = withTiming(r.y + r.drift[1], { duration: r.delay, easing: Easing.inOut(Easing.sin) });
          }
        }
        rune.ring.value = 18;
        rune.ring.value = withTiming(4, { duration: r.delay, easing: Easing.linear });
        // Judge against where the rune sits when its ring closes.
        const hitX = r.x + (r.drift ? r.drift[0] : 0);
        const hitY = r.y + (r.drift ? r.drift[1] : 0);
        const v = await armRune(r.delay, { ...toScreen(hitX, hitY), radius: 52 });
        rune.visible.value = 0;
        lastX = r.x;
        lastY = r.y;

        const grade = v.grade;
        const sub = v.dt != null ? `${v.dt > 0 ? '+' : ''}${Math.round(v.dt)} MS` : undefined;
        const strong = grade === 'perfect' || grade === 'good';
        const slash = playHero(strong ? HERO.slash : HERO.weakSlash);
        await wait(TICK);
        const res = dealDamage(move.damage * GRADE_MULT[grade], move.brk * GRADE_BREAK[grade]);
        setFoePose(FOE.hurt[0][1]);
        const fx = FOE_HOME + foeX.value + 36;
        if (grade === 'perfect') {
          perfects += 1;
          setChain(perfects);
          haptic('heavy');
          doShake(3);
          pop('PERFECT', colors.butter, fx - 14, 10, { sub });
          await wait(80); // hit-stop
        } else if (grade === 'good') {
          setChain(0);
          haptic('light');
          doShake(2);
          pop('GOOD', colors.mint, fx - 14, 10, { sub });
        } else {
          setChain(0);
          pop(grade === 'early' ? 'TOO EARLY' : 'MISS', colors.lavender, fx - 14, 10, { sub });
        }
        pop(`-${res.real}`, colors.hpRose, fx + 6, 24);
        if (res.justBroke) {
          pop('BREAK!', colors.rose, fx + 4, 2, { big: true });
          haptic('heavy');
        }
        await slash;
        await playFoe(FOE.hurt.slice(1));
        if (res.dead) break;
        await wait(rand(120, 320));
      }

      if (move.finisher && perfects === move.runes.length && live.current.foeHp > 0) {
        setHint('Chain x3: finisher!');
        const fin = playHero(HERO.finisher);
        await wait(TICK * 3);
        const res = dealDamage(FINISHER_DAMAGE, FINISHER_BREAK);
        setFoePose(FOE.hurt[0][1]);
        haptic('heavy');
        doShake(5);
        pop('CHAIN X3', colors.peach, FOE_HOME + 10, 8, { big: true });
        pop(`-${res.real}`, colors.hpRose, FOE_HOME + 44, 24);
        if (res.justBroke) pop('BREAK!', colors.rose, FOE_HOME + 44, 2, { big: true });
        await fin;
      }

      if (live.current.broken) await playFoe(FOE.stagger.slice(0, 1));
      heroX.value = withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) });
      await playHero(HERO.back);
      await endTurn();
    },
    [armRune, dealDamage, doShake, endTurn, foeX, heroX, playFoe, playHero, pop, rune, s],
  );

  // ---------- Tame and flee ----------
  const chance = tameChance(foeHp, broken, treat && treats > 0);

  const tryTame = useCallback(async () => {
    setPhase('acting');
    setIdle(false);
    const usedTreat = treat && treats > 0;
    if (usedTreat) setTreats((n) => n - 1);
    setTreat(false);
    setHint('Fingers crossed...');
    setLine(usedTreat ? 'You offer a Dewberry...' : 'You reach out a friendly hand...');
    await playHero(HERO.cheer);
    pop('...', colors.mint, FOE_HOME + 36, 18);
    for (let i = 0; i < 3; i++) {
      await playFoe([[3, { tilt: 2, capDy: 1 }], [3, { tilt: -2 }]]);
    }
    if (Math.random() < chance) {
      haptic('success');
      pop('TAMED!', colors.mint, FOE_HOME + 30, 8, { big: true });
      await playFoe(FOE.happy);
      await playFoe(FOE.happy);
      setLine('The Mossback Toadstool wants to come home with you!');
      setPhase('tamed');
      setIdle(false);
      return;
    }
    pop('IT SHOOK FREE', colors.rose, FOE_HOME + 30, 8);
    setLine('It shook free!');
    await wait(500);
    await endTurn();
  }, [chance, endTurn, playFoe, playHero, pop, treat, treats]);

  const tryFlee = useCallback(async () => {
    setPhase('acting');
    setIdle(false);
    setHint('');
    if (Math.random() < FLEE_CHANCE) {
      setLine('You slip away into the fog.');
      setHeroPose({ ...HERO.ready, lean: -2, cape: 1 });
      heroX.value = withTiming(-40, { duration: 500, easing: Easing.in(Easing.quad) });
      await wait(600);
      setPhase('fled');
      return;
    }
    pop("CAN'T ESCAPE", colors.rose, HERO_HOME + 28, 14);
    setLine("The toadstool blocks your way!");
    await wait(500);
    await endTurn();
  }, [endTurn, heroX, pop]);

  const reset = useCallback(() => {
    disarm();
    heroX.value = 0;
    foeX.value = 0;
    rune.visible.value = 0;
    setHp(HERO_MAX_HP);
    setFoeHp(FOE_MAX_HP);
    setBrk(0);
    setBroken(false);
    setAp(2);
    setChain(0);
    setTreats(3);
    setTreat(false);
    setPops([]);
    setLine('Another Mossback Toadstool wanders out of the fog.');
    setHint('');
    setFoePose({});
    setHeroPose(HERO.ready);
    setPhase('menu');
    setGuarding(false);
    setIdle(true);
  }, [disarm, foeX, heroX, rune.visible]);

  const move = MOVES[sel];
  const canUse = (m: Move) => m.cost <= ap;

  return (
    <GestureDetector gesture={gesture}>
      <View style={[st.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
        <View style={st.column}>
          <View style={st.topRow}>
            <Text style={t.statSoft}>FOGGY FOREST · PROTOTYPE</Text>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: assist }} onPress={() => setAssist((a) => !a)} hitSlop={10}>
              <Chip label={assist ? 'ASSIST ON' : 'ASSIST OFF'} fill={assist ? colors.mint : colors.vellum} />
            </Pressable>
          </View>

          <Framed style={{ marginTop: 8 }}>
            <View style={{ padding: 8, gap: 6 }}>
              <View style={st.rowBetween}>
                <Text style={[t.heading, { fontSize: 17, lineHeight: 22 }]}>Mossback Toadstool</Text>
                <Text style={t.stat}>LV 6</Text>
              </View>
              <View style={st.barRow}>
                <Text style={[t.stat, st.barLabel]}>HP</Text>
                <SegBar value={foeHp} max={FOE_MAX_HP} segs={16} fill={colors.hpRose} />
              </View>
              <View style={st.barRow}>
                <Text style={[t.stat, st.barLabel]}>BREAK</Text>
                <SegBar value={broken ? BREAK_MAX : brk} max={BREAK_MAX} segs={10} fill={broken ? colors.rose : colors.xpGold} height={6} />
                {broken ? <Chip label="BROKEN" fill={colors.rose} /> : null}
              </View>
            </View>
          </Framed>

          <Animated.View
            style={[st.sceneWrap, { width: SCENE_W * s + 6 }, shakeStyle]}
            ref={sceneRef}
            onLayout={measureScene}
          >
            <BattleScene s={s} hero={heroPose} foe={foePose} heroX={heroX} foeX={foeX} rune={rune} />
            {pops.map((p) => (
              <PopText key={p.id} pop={p} s={s} onDone={dropPop} />
            ))}
          </Animated.View>

          <View style={st.statusRow}>
            <View style={st.heroStat}>
              <HeadSprite />
              <View style={{ gap: 2 }}>
                <Text style={t.stat}>YOU · HP {hp}</Text>
                <View style={{ width: 96, flexDirection: 'row' }}>
                  <SegBar value={hp} max={HERO_MAX_HP} segs={10} fill={colors.hpRose} height={5} />
                </View>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={t.stat}>AP</Text>
                {Array.from({ length: AP_MAX }, (_, i) => (
                  <View key={i} style={[st.pip, { backgroundColor: i < ap ? colors.lavender : colors.scroll }]} />
                ))}
              </View>
              <Text style={t.statSoft}>CHAIN {chain}</Text>
            </View>
          </View>

          <View style={{ flex: 1, marginTop: 10 }}>
            {phase === 'menu' ? (
              <View style={{ gap: 12, flex: 1 }}>
                <Framed shadow={null}>
                  <View style={st.dialog}>
                    <FoeHead />
                    <Text style={[t.body, { flex: 1 }]}>{line}</Text>
                  </View>
                </Framed>
                <PixelButton height={64} onPress={() => setPhase('moves')} accessibilityLabel="Attack">
                  <View style={st.btnRow}>
                    <PixelIcon name="sword" size={4} />
                    <View>
                      <Text style={t.button}>ATTACK</Text>
                      <Text style={t.caption}>{MOVES.filter(canUse).length} moves ready</Text>
                    </View>
                  </View>
                </PixelButton>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <PixelButton style={{ flex: 1 }} height={60} fill={colors.mint} shadow={colors.questGreen} onPress={() => setPhase('tame')} accessibilityLabel="Tame">
                    <View style={st.btnRow}>
                      <PixelIcon name="heart" size={3} />
                      <View>
                        <Text style={[t.button, { fontSize: 19 }]}>TAME</Text>
                        <Text style={[t.caption, { fontSize: 12 }]}>{Math.round(tameChance(foeHp, broken, false) * 100)}% now</Text>
                      </View>
                    </View>
                  </PixelButton>
                  <PixelButton style={{ flex: 1 }} height={60} fill={colors.vellum} shadow={colors.ink} onPress={() => setPhase('flee')} accessibilityLabel="Flee">
                    <View style={st.btnRow}>
                      <PixelIcon name="flee" size={3} />
                      <View>
                        <Text style={[t.button, { fontSize: 19 }]}>FLEE</Text>
                        <Text style={[t.caption, { fontSize: 12 }]}>{Math.round(FLEE_CHANCE * 100)}% chance</Text>
                      </View>
                    </View>
                  </PixelButton>
                </View>
              </View>
            ) : null}

            {phase === 'moves' ? (
              <Framed style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ padding: 8, gap: 6 }}>
                  <View style={st.rowBetween}>
                    <PixelButton height={44} fill={colors.scroll} shadow={colors.ink} onPress={() => setPhase('menu')} style={{ width: 100 }}>
                      <Text style={t.buttonSmall} numberOfLines={1}>
                        ‹ Back
                      </Text>
                    </PixelButton>
                    <Text style={t.heading}>Moves</Text>
                    <View style={{ width: 100 }} />
                  </View>
                  {MOVES.map((m, i) => {
                    const on = i === sel;
                    return (
                      <Pressable
                        key={m.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on, disabled: !canUse(m) }}
                        onPress={() => setSel(i)}
                        style={[st.moveRow, { backgroundColor: on ? colors.lavender : colors.vellum, opacity: canUse(m) ? 1 : 0.55 }]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[t.heading, { fontSize: 17, lineHeight: 21 }]}>{m.name}</Text>
                          <Text style={[t.statSoft, { fontSize: 8, lineHeight: 10 }]}>
                            {m.kind} · {m.runes.length} {m.runes.length === 1 ? 'RUNE' : 'RUNES'}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {m.runes.map((_, k) => (
                            <View key={k} style={st.runeDot} />
                          ))}
                        </View>
                        <Chip label={m.cost < 0 ? `+${-m.cost} AP` : `${m.cost} AP`} fill={m.cost < 0 ? colors.mint : colors.butter} />
                      </Pressable>
                    );
                  })}
                  <Text style={[t.body, { fontSize: 14, lineHeight: 19 }]}>{move.desc}</Text>
                  <PixelButton disabled={!canUse(move)} onPress={() => runMove(move)}>
                    <Text style={[t.buttonSmall, { textAlign: 'center', fontFamily: 'PixelifySans_700Bold', fontSize: 18 }]}>
                      {canUse(move) ? `Use ${move.name}` : `Needs ${move.cost} AP`}
                    </Text>
                  </PixelButton>
                </ScrollView>
              </Framed>
            ) : null}

            {phase === 'tame' ? (
              <Framed style={{ flex: 1 }} shadow={colors.questGreen}>
                <View style={{ padding: 10, gap: 10, flex: 1 }}>
                  <View style={st.rowBetween}>
                    <PixelButton height={44} fill={colors.scroll} shadow={colors.ink} onPress={() => setPhase('menu')} style={{ width: 100 }}>
                      <Text style={t.buttonSmall} numberOfLines={1}>
                        ‹ Back
                      </Text>
                    </PixelButton>
                    <Text style={t.heading}>Tame</Text>
                    <View style={{ width: 100 }} />
                  </View>
                  <View style={st.barRow}>
                    <Text style={[t.stat, { width: 58 }]}>CHANCE</Text>
                    <SegBar value={chance * 100} max={100} segs={10} fill={colors.questGreen} />
                    <Text style={t.stat}>{Math.round(chance * 100)}%</Text>
                  </View>
                  <Text style={[t.body, { fontSize: 14, lineHeight: 20 }]}>
                    Lower HP and a Broken enemy raise the chance, and a treat adds more. If the roll fails, the monster gets its turn.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: treat, disabled: treats === 0 }}
                      disabled={treats === 0}
                      onPress={() => setTreat((v) => !v)}
                      style={[st.card, { backgroundColor: treat ? colors.butter : colors.vellum }]}
                    >
                      <Text style={[t.statSoft, { fontSize: 8 }]}>{treat ? 'OFFERING' : 'TAP TO OFFER'}</Text>
                      <Text style={[t.heading, { fontSize: 15, lineHeight: 20 }]}>Dewberry · +15%</Text>
                      <Text style={[t.statSoft, { fontSize: 8 }]}>{treats} LEFT</Text>
                    </Pressable>
                    <View style={[st.card, { backgroundColor: colors.mint }]}>
                      <Text style={[t.statSoft, { fontSize: 8 }]}>JOB ON THE BASE</Text>
                      <Text style={[t.heading, { fontSize: 15, lineHeight: 20 }]}>Forager · +10% wood</Text>
                    </View>
                  </View>
                  <PixelButton fill={colors.mint} shadow={colors.questGreen} onPress={tryTame} style={{ marginTop: 'auto' }}>
                    <Text style={[t.buttonSmall, { textAlign: 'center', fontFamily: 'PixelifySans_700Bold', fontSize: 18 }]}>
                      Try to tame · {Math.round(chance * 100)}%
                    </Text>
                  </PixelButton>
                </View>
              </Framed>
            ) : null}

            {phase === 'flee' ? (
              <Framed style={{ flex: 1 }}>
                <View style={{ padding: 12, gap: 10, flex: 1 }}>
                  <Text style={t.heading}>Run away?</Text>
                  <Text style={t.body}>
                    You keep the loot found so far, but lose this room's rewards. Flee chance: {Math.round(FLEE_CHANCE * 100)}%. A failed flee costs your turn.
                  </Text>
                  <View style={st.note}>
                    <Text style={[t.body, { fontSize: 14 }]}>In a live party, everyone votes before you flee.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
                    <PixelButton style={{ flex: 1 }} fill={colors.vellum} shadow={colors.ink} onPress={() => setPhase('menu')}>
                      <Text style={[t.buttonSmall, { textAlign: 'center' }]}>Keep fighting</Text>
                    </PixelButton>
                    <PixelButton style={{ flex: 1 }} fill={colors.hpRose} shadow={colors.ink} onPress={tryFlee}>
                      <Text style={[t.buttonSmall, { textAlign: 'center', fontFamily: 'PixelifySans_700Bold' }]}>Flee</Text>
                    </PixelButton>
                  </View>
                </View>
              </Framed>
            ) : null}

            {phase === 'acting' ? (
              <Framed shadow={null} fill={colors.scroll} style={{ flex: 1 }}>
                <View style={{ flex: 1, padding: 14, gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={[t.body, { textAlign: 'center' }]}>{line}</Text>
                  {hint ? <Text style={[t.heading, { textAlign: 'center' }]}>{hint}</Text> : null}
                  {guarding ? <Text style={[t.statSoft, { textAlign: 'center', marginTop: 6 }]}>TAP ANYWHERE TO PARRY · SWIPE TO DODGE</Text> : null}
                </View>
              </Framed>
            ) : null}

            {phase === 'won' || phase === 'lost' || phase === 'tamed' || phase === 'fled' ? (
              <Framed style={{ flex: 1 }} fill={phase === 'lost' ? colors.vellum : phase === 'tamed' ? colors.mint : colors.butter}>
                <View style={{ padding: 14, gap: 10, flex: 1 }}>
                  <Text style={t.title}>
                    {phase === 'won' ? 'Victory!' : phase === 'lost' ? 'Your party rests...' : phase === 'tamed' ? 'New pet!' : 'Got away!'}
                  </Text>
                  <Text style={t.body}>
                    {phase === 'won'
                      ? 'The Mossback Toadstool is defeated. +40 XP and 3 wood for the base.'
                      : phase === 'lost'
                        ? 'The toadstool wins this round. Try reading the wind-up before you tap.'
                        : phase === 'tamed'
                          ? 'The Mossback Toadstool is heading to your base. It will work as a Forager: +10% wood.'
                          : 'You slipped away into the fog. No rewards from this room.'}
                  </Text>
                  <PixelButton onPress={reset} style={{ marginTop: 'auto' }}>
                    <Text style={[t.buttonSmall, { textAlign: 'center', fontFamily: 'PixelifySans_700Bold', fontSize: 18 }]}>Fight again</Text>
                  </PixelButton>
                </View>
              </Framed>
            ) : null}
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

function HeadSprite() {
  const pic = useMemo(() => gridPicture('herohead', heroPortrait(), 2), []);
  return (
    <View style={st.portrait}>
      <Canvas style={{ width: 24, height: 24 }}>
        <Picture picture={pic} />
      </Canvas>
    </View>
  );
}

function FoeHead() {
  const pic = useMemo(() => gridPicture('foehead', foePortrait(), 2), []);
  return (
    <View style={[st.portrait, { width: 46, height: 46 }]}>
      <Canvas style={{ width: 40, height: 40 }}>
        <Picture picture={pic} />
      </Canvas>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.parchment, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 520, paddingHorizontal: 16 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 46 },
  sceneWrap: { marginTop: 10, alignSelf: 'center', borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.vellum },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pip: { width: 12, height: 12, borderWidth: 2, borderColor: colors.ink, transform: [{ rotate: '45deg' }], marginHorizontal: 2 },
  dialog: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 10 },
  portrait: { width: 30, height: 30, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.scroll, alignItems: 'center', justifyContent: 'center' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 10, minHeight: 50 },
  runeDot: { width: 8, height: 8, backgroundColor: colors.xpGold, borderWidth: 1, borderColor: colors.ink, transform: [{ rotate: '45deg' }] },
  card: { flex: 1, borderWidth: 2, borderColor: colors.ink, padding: 8, gap: 2 },
  note: { borderWidth: 2, borderColor: colors.ink, padding: 8, backgroundColor: colors.sky },
});
