import { Canvas, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { foePortrait, HERO_LOOKS, heroPortrait, type FoePose, type HeroPose } from '../sprites/characters';
import { gridPicture } from '../sprites/render';
import { colors } from '../theme';
import { Chip, Framed, haptic, PixelButton, PixelIcon, SegBar, styles as t } from '../ui/pixel';
import { FOE, HERO, TICK, type Frames } from './anims';
import { BattleScene, foeFrame, type Actor, type RuneFx } from './BattleScene';
import { fieldLayout, type Field } from './field';
import { PopText, type Pop } from './Pops';
import {
  AP_MAX,
  AP_PARRY,
  AP_PERFECT,
  AP_START,
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
type Mood = 'ready' | 'guard' | 'cheer' | 'rest';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
// Your body stops this many art pixels short of the target's body when you dash in.
const MELEE_REACH = 28;
// The enemy's body stops this far in front of yours when it lunges.
const FOE_REACH = 36;
// The command dock keeps one height in every phase, so the scene never jumps.
const PANEL_H = 214;

const ALLY_NAMES = ['Mint Ranger', 'Gold Warden', 'Sky Mage'];

export function BattleScreen() {
  const insets = useSafeAreaInsets();

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [full, setFull] = useState(false);
  const field = useMemo(() => (box ? fieldLayout(box.w, box.h, full) : null), [box, full]);
  const fieldRef = useRef<Field | null>(field);
  fieldRef.current = field;

  const [phase, setPhase] = useState<Phase>('menu');
  const [guarding, setGuarding] = useState(false);
  const [heroPose, setHeroPose] = useState<HeroPose>(HERO.ready);
  const [foePose, setFoePose] = useState<FoePose>({});
  const [mood, setMood] = useState<Mood>('ready');
  const [beat, setBeat] = useState(0);
  const [hp, setHp] = useState(HERO_MAX_HP);
  const [foeHp, setFoeHp] = useState(FOE_MAX_HP);
  const [brk, setBrk] = useState(0);
  const [broken, setBroken] = useState(false);
  const [ap, setAp] = useState(AP_START);
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
  const partyX = useSharedValue(0);
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
      sceneOrigin.current = { x, y };
    });
  }, []);
  const onSceneLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setBox((b) => (b && b.w === Math.round(width) && b.h === Math.round(height) ? b : { w: Math.round(width), h: Math.round(height) }));
      measureScene();
    },
    [measureScene],
  );
  const { gesture, armRune, armDefend, disarm } = useCombatInput(assist);

  // One shared beat keeps everyone breathing; you and your target only follow it while the player decides.
  useEffect(() => {
    const id = setInterval(() => setBeat((b) => (b + 1) % 4), TICK * 3);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!idle) return;
    setFoePose(FOE.idle[beat][1]);
    setHeroPose(beat % 2 === 0 ? HERO.ready : { ...HERO.ready, crouch: true, hy: 5 });
  }, [beat, idle]);

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

  // Positions in art pixels, read from the live field so async sequences survive a resize.
  const geo = useCallback(() => {
    const f = fieldRef.current!;
    const you = f.heroes[0];
    const foe = f.foes[0];
    return {
      you,
      foe,
      s: f.s,
      // Pop heights are authored for the storyboard; 0.7 keeps them just over the sprites' heads.
      up: (n: number) => f.ground - Math.round(n * 0.7),
      meleeX: () => foe.x + foeX.value - MELEE_REACH - you.x,
      lungeX: () => you.x + FOE_REACH - foe.x,
      foeBody: () => foe.x + foeX.value,
      toScreen: (ax: number, ay: number) => ({ x: sceneOrigin.current.x + ax * f.s, y: sceneOrigin.current.y + ay * f.s }),
    };
  }, [foeX]);

  const apRef = useRef(ap);
  apRef.current = ap;
  const gainAp = useCallback(
    (n: number, x: number, y: number) => {
      pop(apRef.current < AP_MAX ? `+${n} AP` : 'AP FULL', colors.lavender, x, y);
      apRef.current = Math.min(AP_MAX, apRef.current + n);
      setAp((a) => Math.min(AP_MAX, a + n));
    },
    [pop],
  );

  const dealDamage = useCallback((dmg: number, brkGain: number) => {
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
  }, []);

  // ---------- Enemy turn ----------
  const enemyTurn = useCallback(async () => {
    const g = geo();
    if (live.current.broken) {
      setHint('It is Broken and loses its turn.');
      pop('STUNNED', colors.rose, g.foe.x, g.up(44));
      await playFoe(FOE.stagger);
      live.current = { ...live.current, broken: false, brk: 0 };
      setBroken(false);
      setBrk(0);
      return;
    }
    const pattern = PATTERNS[Math.floor(Math.random() * PATTERNS.length)];
    setGuarding(true);
    setMood('guard');
    setHint('Watch the wind-up. Tap to parry, swipe sideways to dodge.');
    setLine(pattern.feint ? 'The toadstool sways oddly...' : 'The toadstool raises its club!');
    setHeroPose(HERO.guard);
    foeX.value = withTiming(g.lungeX(), { duration: 280, easing: Easing.out(Easing.quad) });
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
          pop('TOO EARLY', colors.rose, g.you.x + 2, g.up(48), { sub: v.dt != null ? `${Math.round(v.dt)} MS` : undefined });
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
      const at = { x: g.you.x + 8, y: g.up(40) };
      const sub = v.dt != null ? `${Math.round(v.dt)} MS` : undefined;
      if (v.defense === 'parry' && !early) {
        parried += 1;
        haptic('success');
        doShake(2);
        pop(parried > 1 ? `PARRY X${parried}` : 'PARRY', colors.sky, at.x, at.y - 6, { sub });
        gainAp(AP_PARRY, at.x, at.y - 18);
        await playHero(HERO.parry);
      } else if (v.defense === 'dodge' && !early) {
        pop('DODGE', colors.lavender, at.x, at.y - 6, { sub });
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
      heroX.value = withTiming(g.meleeX(), { duration: TICK * 2, easing: Easing.out(Easing.cubic) });
      const counter = playHero(HERO.counter);
      await wait(TICK * 2);
      haptic('heavy');
      const r = dealDamage(COUNTER_DAMAGE, COUNTER_BREAK);
      await wait(TICK);
      setFoePose(FOE.hurt[0][1]);
      doShake(5);
      const fb = g.foeBody();
      pop('COUNTER', colors.butter, fb - 6, g.up(50), { big: true });
      pop(`-${r.real}`, colors.hpRose, fb + 4, g.up(36));
      if (r.justBroke) pop('BREAK!', colors.rose, fb + 8, g.up(56));
      await counter;
      heroX.value = withTiming(0, { duration: 260 });
    }
    foeX.value = withTiming(0, { duration: 300, easing: Easing.inOut(Easing.quad) });
    await playFoe(FOE.recover);
  }, [armDefend, dealDamage, doShake, foeX, gainAp, geo, heroX, playFoe, playHero, pop]);

  const endTurn = useCallback(async () => {
    if (live.current.foeHp <= 0) {
      setFoePose(FOE.down);
      setMood('cheer');
      setLine('The Mossback Toadstool flops over. Victory!');
      setPhase('won');
      setIdle(false);
      haptic('success');
      await playHero(HERO.cheer);
      return;
    }
    await enemyTurn();
    setGuarding(false);
    if (!alive.current) return;
    if (live.current.hp <= 0) {
      setHeroPose(HERO.down);
      setMood('rest');
      setLine('Your party rests... and tries again.');
      setPhase('lost');
      return;
    }
    if (live.current.foeHp <= 0) {
      await endTurn();
      return;
    }
    setHint('');
    setMood('ready');
    setLine(live.current.broken ? 'It is Broken! Hit it hard, or try to tame it.' : 'The toadstool steadies itself. Your turn.');
    setPhase('menu');
    setIdle(true);
  }, [enemyTurn, playHero]);

  // ---------- Your turn: a move with strike runes ----------
  const runMove = useCallback(
    async (move: Move) => {
      measureScene();
      const g = geo();
      setPhase('acting');
      setIdle(false);
      setAp((a) => Math.min(AP_MAX, a - move.cost));
      setLine(`You use ${move.name}!`);
      setHint('Tap the rune as the ring closes on it.');
      setChain(0);

      await playHero(HERO.dash.slice(0, 1));
      heroX.value = withTiming(g.meleeX(), { duration: TICK * 2, easing: Easing.out(Easing.cubic) });
      await playHero(HERO.dash.slice(1));
      await playHero(HERO.coil);

      // Rune coordinates are authored inside the target's frame.
      const frame = foeFrame(g.foe);
      const ox = frame.x + foeX.value;
      const oy = frame.y;
      let perfects = 0;
      let lastX = ox + move.runes[0].x;
      let lastY = oy + move.runes[0].y;
      for (let i = 0; i < move.runes.length; i++) {
        if (!alive.current) return;
        const r = move.runes[i];
        const rx = ox + r.x;
        const ry = oy + r.y;
        setHeroPose(HERO.coilHold);
        if (r.decoy) {
          rune.decoyX.value = ox + r.decoy[0];
          rune.decoyY.value = oy + r.decoy[1];
          rune.decoy.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(0.2, { duration: 90 }), withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 120 }));
          await wait(340);
        }
        if (r.dart && i > 0) {
          rune.x.value = lastX;
          rune.y.value = lastY;
          rune.visible.value = 1;
          rune.x.value = withTiming(rx, { duration: 140, easing: Easing.out(Easing.cubic) });
          rune.y.value = withTiming(ry, { duration: 140, easing: Easing.out(Easing.cubic) });
        } else {
          rune.x.value = rx;
          rune.y.value = ry;
          rune.visible.value = 1;
          if (r.drift) {
            rune.x.value = withTiming(rx + r.drift[0], { duration: r.delay, easing: Easing.inOut(Easing.sin) });
            rune.y.value = withTiming(ry + r.drift[1], { duration: r.delay, easing: Easing.inOut(Easing.sin) });
          }
        }
        rune.ring.value = 18;
        rune.ring.value = withTiming(4, { duration: r.delay, easing: Easing.linear });
        // Judge against where the rune sits when its ring closes.
        const hitX = rx + (r.drift ? r.drift[0] : 0);
        const hitY = ry + (r.drift ? r.drift[1] : 0);
        const v = await armRune(r.delay, { ...g.toScreen(hitX, hitY), radius: 52 });
        rune.visible.value = 0;
        lastX = rx;
        lastY = ry;

        const grade = v.grade;
        const sub = v.dt != null ? `${v.dt > 0 ? '+' : ''}${Math.round(v.dt)} MS` : undefined;
        const strong = grade === 'perfect' || grade === 'good';
        const slash = playHero(strong ? HERO.slash : HERO.weakSlash);
        await wait(TICK);
        const res = dealDamage(move.damage * GRADE_MULT[grade], move.brk * GRADE_BREAK[grade]);
        setFoePose(FOE.hurt[0][1]);
        const fb = g.foeBody();
        if (grade === 'perfect') {
          perfects += 1;
          setChain(perfects);
          haptic('heavy');
          doShake(3);
          pop('PERFECT', colors.butter, fb - 14, g.up(52), { sub });
          gainAp(AP_PERFECT, g.you.x + 4, g.up(46));
          await wait(80); // hit-stop
        } else if (grade === 'good') {
          setChain(0);
          haptic('light');
          doShake(2);
          pop('GOOD', colors.mint, fb - 14, g.up(52), { sub });
        } else {
          setChain(0);
          pop(grade === 'early' ? 'TOO EARLY' : 'MISS', colors.lavender, fb - 14, g.up(52), { sub });
        }
        pop(`-${res.real}`, colors.hpRose, fb + 6, g.up(38));
        if (res.justBroke) {
          pop('BREAK!', colors.rose, fb + 4, g.up(60), { big: true });
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
        pop('CHAIN X3', colors.peach, g.foe.x - 26, g.up(54), { big: true });
        pop(`-${res.real}`, colors.hpRose, g.foe.x + 8, g.up(38));
        if (res.justBroke) pop('BREAK!', colors.rose, g.foe.x + 8, g.up(60), { big: true });
        await fin;
      }

      if (live.current.broken) await playFoe(FOE.stagger.slice(0, 1));
      heroX.value = withTiming(0, { duration: 260, easing: Easing.inOut(Easing.quad) });
      await playHero(HERO.back);
      await endTurn();
    },
    [armRune, dealDamage, doShake, endTurn, foeX, gainAp, geo, heroX, measureScene, playFoe, playHero, pop, rune],
  );

  // ---------- Tame and flee ----------
  const chance = tameChance(foeHp, broken, treat && treats > 0);

  const tryTame = useCallback(async () => {
    const g = geo();
    setPhase('acting');
    setIdle(false);
    const usedTreat = treat && treats > 0;
    if (usedTreat) setTreats((n) => n - 1);
    setTreat(false);
    setHint('Fingers crossed...');
    setLine(usedTreat ? 'You offer a Dewberry...' : 'You reach out a friendly hand...');
    await playHero(HERO.cheer);
    pop('...', colors.mint, g.foe.x, g.up(44));
    for (let i = 0; i < 3; i++) {
      await playFoe([[3, { tilt: 2, capDy: 1 }], [3, { tilt: -2 }]]);
    }
    if (Math.random() < chance) {
      haptic('success');
      pop('TAMED!', colors.mint, g.foe.x - 6, g.up(54), { big: true });
      setMood('cheer');
      await playFoe(FOE.happy);
      await playFoe(FOE.happy);
      setLine('The Mossback Toadstool wants to come home with you!');
      setPhase('tamed');
      setIdle(false);
      return;
    }
    pop('IT SHOOK FREE', colors.rose, g.foe.x - 6, g.up(54));
    setLine('It shook free!');
    await wait(500);
    await endTurn();
  }, [chance, endTurn, geo, playFoe, playHero, pop, treat, treats]);

  const tryFlee = useCallback(async () => {
    const g = geo();
    setPhase('acting');
    setIdle(false);
    setHint('');
    if (Math.random() < FLEE_CHANCE) {
      setLine('You slip away into the fog.');
      setHeroPose({ ...HERO.ready, lean: -2, cape: 1 });
      heroX.value = withTiming(-g.you.x - 30, { duration: 500, easing: Easing.in(Easing.quad) });
      partyX.value = withTiming(-g.you.x - 30, { duration: 560, easing: Easing.in(Easing.quad) });
      await wait(600);
      setPhase('fled');
      return;
    }
    pop("CAN'T ESCAPE", colors.rose, g.you.x + 6, g.up(48));
    setLine('The toadstool blocks your way!');
    await wait(500);
    await endTurn();
  }, [endTurn, geo, heroX, partyX, pop]);

  const reset = useCallback(
    (nextLine = 'Another Mossback Toadstool wanders out of the fog.') => {
      disarm();
      heroX.value = 0;
      foeX.value = 0;
      partyX.value = 0;
      rune.visible.value = 0;
      setHp(HERO_MAX_HP);
      setFoeHp(FOE_MAX_HP);
      setBrk(0);
      setBroken(false);
      setAp(AP_START);
      setChain(0);
      setTreats(3);
      setTreat(false);
      setPops([]);
      setLine(nextLine);
      setHint('');
      setFoePose({});
      setHeroPose(HERO.ready);
      setMood('ready');
      setPhase('menu');
      setGuarding(false);
      setIdle(true);
    },
    [disarm, foeX, heroX, partyX, rune.visible],
  );

  const toggleParty = () => {
    const next = !full;
    setFull(next);
    reset(next ? 'Your party of four meets a pack of toadstools. You lead the charge.' : 'A Mossback Toadstool blocks the path. It grips its club and sways.');
  };

  // ---------- The field ----------
  const actors = useMemo<Actor[]>(() => {
    if (!field) return [];
    const list: Actor[] = [
      { kind: 'hero', key: 'you', slot: field.heroes[0], pose: heroPose, dx: heroX },
      { kind: 'foe', key: 'target', slot: field.foes[0], pose: foePose, dx: foeX },
    ];
    field.heroes.slice(1).forEach((slot, i) => {
      const b = (beat + i + 1) % 4;
      const pose: HeroPose =
        mood === 'guard'
          ? HERO.guard
          : mood === 'cheer'
            ? b % 2 === 0
              ? HERO.cheer[0][1]
              : HERO.cheer[1][1]
            : mood === 'rest'
              ? HERO.down
              : b % 2 === 0
                ? HERO.ready
                : { ...HERO.ready, crouch: true, hy: 5 };
      list.push({ kind: 'hero', key: `ally${i}`, slot, pose: { ...pose, look: i + 1 }, dx: partyX });
    });
    field.foes.slice(1).forEach((slot, i) => {
      const pose: FoePose = phase === 'won' ? FOE.down : FOE.idle[(beat + i + 2) % 4][1];
      list.push({ kind: 'foe', key: `pack${i}`, slot, pose: { ...pose, look: i + 1 } });
    });
    return list;
  }, [beat, field, foePose, foeX, heroPose, heroX, mood, partyX, phase]);

  const move = MOVES[sel];
  const canUse = (m: Move) => m.cost <= ap;
  const ended = phase === 'won' || phase === 'lost' || phase === 'tamed' || phase === 'fled';
  const caption =
    phase === 'moves'
      ? move.desc
      : phase === 'tame'
        ? 'Lower HP and a Broken enemy raise the chance, and a treat adds more. If the roll fails, the monster gets its turn.'
        : phase === 'flee'
          ? "You keep the loot found so far, but lose this room's rewards. A failed flee costs your turn."
          : line;

  return (
    <GestureDetector gesture={gesture}>
      <View style={st.screen}>
        <View style={st.column}>
          {/* The scene fills everything above the dock. */}
          <View style={st.sceneBox} ref={sceneRef} onLayout={onSceneLayout}>
            {field ? (
              <Animated.View style={shakeStyle}>
                <BattleScene field={field} actors={actors} rune={rune} />
              </Animated.View>
            ) : null}
            {field
              ? pops.map((p) => (
                  <PopText key={p.id} pop={p} s={field.s} onDone={dropPop} />
                ))
              : null}

            <View style={[st.hudTop, { top: insets.top + 8 }]} pointerEvents="box-none">
              <Framed style={{ flex: 1 }} depth={1}>
                <View style={{ paddingHorizontal: 8, paddingVertical: 6, gap: 4 }}>
                  <View style={st.rowBetween}>
                    <Text style={[t.heading, { fontSize: 15, lineHeight: 19 }]} numberOfLines={1}>
                      Mossback Toadstool
                    </Text>
                    <Text style={t.statSoft}>{full ? '1 OF 3' : 'LV 6'}</Text>
                  </View>
                  <View style={st.barRow}>
                    <Text style={[t.stat, st.barLabel]}>HP</Text>
                    <SegBar value={foeHp} max={FOE_MAX_HP} segs={16} fill={colors.hpRose} height={6} />
                  </View>
                  <View style={st.barRow}>
                    <Text style={[t.stat, st.barLabel]}>BREAK</Text>
                    <SegBar value={broken ? BREAK_MAX : brk} max={BREAK_MAX} segs={10} fill={broken ? colors.rose : colors.xpGold} height={4} />
                    {broken ? <Chip label="BROKEN" fill={colors.rose} /> : null}
                  </View>
                </View>
              </Framed>
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: assist }} onPress={() => setAssist((a) => !a)} hitSlop={8}>
                  <Chip label={assist ? 'ASSIST ON' : 'ASSIST OFF'} fill={assist ? colors.mint : colors.vellum} />
                </Pressable>
                <Pressable
                  accessibilityRole="switch"
                  accessibilityLabel="Party size"
                  accessibilityState={{ checked: full, disabled: phase === 'acting' }}
                  disabled={phase === 'acting'}
                  onPress={toggleParty}
                  hitSlop={8}
                >
                  <Chip label={full ? 'PARTY 4' : 'SOLO'} fill={full ? colors.butter : colors.vellum} />
                </Pressable>
              </View>
            </View>

            {!ended ? (
              <View style={st.caption} pointerEvents="none">
                <Framed shadow={null} fill={colors.vellum}>
                  <View style={st.dialog}>
                    <FoeHead />
                    <Text style={[t.body, { flex: 1, fontSize: 14, lineHeight: 19 }]}>{caption}</Text>
                  </View>
                </Framed>
              </View>
            ) : null}
          </View>

          {/* The command dock: bottom-lined, one fixed height in every phase. */}
          <View style={[st.dock, { paddingBottom: insets.bottom + 10 }]}>
            <View style={st.statusRow}>
              <View style={st.heroStat}>
                <HeadSprite look={0} />
                <View style={{ gap: 2 }}>
                  <Text style={t.stat}>YOU · HP {hp}</Text>
                  <View style={{ width: 92, flexDirection: 'row' }}>
                    <SegBar value={hp} max={HERO_MAX_HP} segs={10} fill={colors.hpRose} height={4} />
                  </View>
                </View>
                {full ? (
                  <View style={{ flexDirection: 'row', gap: 4, marginLeft: 2 }} accessibilityLabel={`Party: ${ALLY_NAMES.join(', ')}`}>
                    {ALLY_NAMES.map((n, i) => (
                      <HeadSprite key={n} look={i + 1} small />
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} accessibilityLabel={`${ap} of ${AP_MAX} AP`}>
                  <Text style={t.stat}>AP</Text>
                  {Array.from({ length: AP_MAX }, (_, i) => (
                    <View key={i} style={[st.pip, { backgroundColor: i < ap ? colors.lavender : colors.scroll }]} />
                  ))}
                </View>
                <Text style={t.statSoft}>CHAIN {chain}</Text>
              </View>
            </View>

            <View style={{ height: PANEL_H }}>
              {phase === 'menu' ? (
                <View style={{ gap: 10, flex: 1 }}>
                  <PixelButton height={96} onPress={() => setPhase('moves')} accessibilityLabel="Attack">
                    <View style={st.btnRow}>
                      <PixelIcon name="sword" size={5} />
                      <View>
                        <Text style={[t.button, { fontSize: 28, lineHeight: 32 }]}>ATTACK</Text>
                        <Text style={t.caption}>{MOVES.filter(canUse).length} moves ready</Text>
                      </View>
                    </View>
                  </PixelButton>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <PixelButton style={{ flex: 1 }} height={84} fill={colors.mint} shadow={colors.questGreen} onPress={() => setPhase('tame')} accessibilityLabel="Tame">
                      <View style={st.btnRow}>
                        <PixelIcon name="heart" size={3} />
                        <View>
                          <Text style={[t.button, { fontSize: 20 }]}>TAME</Text>
                          <Text style={[t.caption, { fontSize: 12 }]}>{Math.round(tameChance(foeHp, broken, false) * 100)}% now</Text>
                        </View>
                      </View>
                    </PixelButton>
                    <PixelButton style={{ flex: 1 }} height={84} fill={colors.vellum} shadow={colors.ink} onPress={() => setPhase('flee')} accessibilityLabel="Flee">
                      <View style={st.btnRow}>
                        <PixelIcon name="flee" size={3} />
                        <View>
                          <Text style={[t.button, { fontSize: 20 }]}>FLEE</Text>
                          <Text style={[t.caption, { fontSize: 12 }]}>{Math.round(FLEE_CHANCE * 100)}% chance</Text>
                        </View>
                      </View>
                    </PixelButton>
                  </View>
                </View>
              ) : null}

              {phase === 'moves' ? (
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={st.grid}>
                    {MOVES.map((m, i) => {
                      const on = i === sel;
                      return (
                        <Pressable
                          key={m.id}
                          accessibilityRole="radio"
                          accessibilityLabel={m.name}
                          accessibilityState={{ selected: on, disabled: !canUse(m) }}
                          onPress={() => setSel(i)}
                          style={[st.moveTile, { backgroundColor: on ? colors.lavender : colors.vellum, opacity: canUse(m) ? 1 : 0.55 }]}
                        >
                          <View style={st.rowBetween}>
                            <Text style={[t.statSoft, { fontSize: 8, lineHeight: 10 }]}>{m.kind}</Text>
                            <Chip label={m.cost < 0 ? `+${-m.cost} AP` : `${m.cost} AP`} fill={m.cost < 0 ? colors.mint : colors.butter} />
                          </View>
                          <Text style={[t.heading, { fontSize: 16, lineHeight: 20 }]} numberOfLines={1}>
                            {m.name}
                          </Text>
                          <View style={{ flexDirection: 'row', gap: 4 }}>
                            {m.runes.map((_, k) => (
                              <View key={k} style={st.runeDot} />
                            ))}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <PixelButton height={52} fill={colors.scroll} shadow={colors.ink} onPress={() => setPhase('menu')} style={{ width: 96 }}>
                      <Text style={t.buttonSmall} numberOfLines={1}>
                        ‹ Back
                      </Text>
                    </PixelButton>
                    <PixelButton style={{ flex: 1 }} height={52} disabled={!canUse(move)} onPress={() => runMove(move)}>
                      <Text style={[t.buttonSmall, st.cta]} numberOfLines={1}>
                        {canUse(move) ? `Use ${move.name}` : `Needs ${move.cost} AP`}
                      </Text>
                    </PixelButton>
                  </View>
                </View>
              ) : null}

              {phase === 'tame' ? (
                <View style={{ flex: 1, gap: 10 }}>
                  <View style={st.barRow}>
                    <Text style={[t.stat, { width: 58 }]}>CHANCE</Text>
                    <SegBar value={chance * 100} max={100} segs={10} fill={colors.questGreen} />
                    <Text style={t.stat}>{Math.round(chance * 100)}%</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, flex: 1 }}>
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
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <PixelButton height={52} fill={colors.scroll} shadow={colors.ink} onPress={() => setPhase('menu')} style={{ width: 96 }}>
                      <Text style={t.buttonSmall} numberOfLines={1}>
                        ‹ Back
                      </Text>
                    </PixelButton>
                    <PixelButton style={{ flex: 1 }} height={52} fill={colors.mint} shadow={colors.questGreen} onPress={tryTame}>
                      <Text style={[t.buttonSmall, st.cta]}>Try to tame · {Math.round(chance * 100)}%</Text>
                    </PixelButton>
                  </View>
                </View>
              ) : null}

              {phase === 'flee' ? (
                <View style={{ flex: 1, gap: 10 }}>
                  <View style={st.rowBetween}>
                    <Text style={t.heading}>Run away?</Text>
                    <Chip label={`${Math.round(FLEE_CHANCE * 100)}% CHANCE`} />
                  </View>
                  <View style={st.note}>
                    <Text style={[t.body, { fontSize: 14 }]}>In a live party, everyone votes before you flee.</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 'auto' }}>
                    <PixelButton style={{ flex: 1 }} height={56} fill={colors.vellum} shadow={colors.ink} onPress={() => setPhase('menu')}>
                      <Text style={[t.buttonSmall, { textAlign: 'center' }]}>Keep fighting</Text>
                    </PixelButton>
                    <PixelButton style={{ flex: 1 }} height={56} fill={colors.hpRose} shadow={colors.ink} onPress={tryFlee}>
                      <Text style={[t.buttonSmall, st.cta]}>Flee</Text>
                    </PixelButton>
                  </View>
                </View>
              ) : null}

              {phase === 'acting' ? (
                <Framed shadow={null} fill={colors.scroll} style={{ flex: 1 }}>
                  <View style={{ flex: 1, padding: 14, gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                    {hint ? <Text style={[t.heading, { textAlign: 'center' }]}>{hint}</Text> : null}
                    {guarding ? <Text style={[t.statSoft, { textAlign: 'center', marginTop: 6 }]}>TAP ANYWHERE TO PARRY · SWIPE TO DODGE</Text> : null}
                  </View>
                </Framed>
              ) : null}

              {ended ? (
                <Framed style={{ flex: 1 }} fill={phase === 'lost' ? colors.vellum : phase === 'tamed' ? colors.mint : colors.butter}>
                  <View style={{ padding: 12, gap: 6, flex: 1 }}>
                    <Text style={[t.title, { fontSize: 24, lineHeight: 30 }]}>
                      {phase === 'won' ? 'Victory!' : phase === 'lost' ? 'Your party rests...' : phase === 'tamed' ? 'New pet!' : 'Got away!'}
                    </Text>
                    <Text style={[t.body, { fontSize: 14, lineHeight: 19 }]}>
                      {phase === 'won'
                        ? 'The Mossback Toadstool is defeated. +40 XP and 3 wood for the base.'
                        : phase === 'lost'
                          ? 'The toadstool wins this round. Try reading the wind-up before you tap.'
                          : phase === 'tamed'
                            ? 'The Mossback Toadstool is heading to your base. It will work as a Forager: +10% wood.'
                            : 'You slipped away into the fog. No rewards from this room.'}
                    </Text>
                    <PixelButton height={52} onPress={() => reset()} style={{ marginTop: 'auto' }}>
                      <Text style={[t.buttonSmall, st.cta]}>Fight again</Text>
                    </PixelButton>
                  </View>
                </Framed>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

function HeadSprite({ look, small }: { look: number; small?: boolean }) {
  const pic = useMemo(() => gridPicture(`herohead${look}`, heroPortrait(HERO_LOOKS[look]), 2), [look]);
  const size = small ? 26 : 30;
  return (
    <View style={[st.portrait, { width: size, height: size }]}>
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
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 560, backgroundColor: colors.parchment },
  sceneBox: { flex: 1, overflow: 'hidden', backgroundColor: colors.vellum },
  hudTop: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  caption: { position: 'absolute', left: 12, right: 12, bottom: 10 },
  dock: { paddingHorizontal: 12, paddingTop: 10, gap: 10, borderTopWidth: 3, borderColor: colors.ink, backgroundColor: colors.parchment },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 44 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pip: { width: 12, height: 12, borderWidth: 2, borderColor: colors.ink, transform: [{ rotate: '45deg' }], marginHorizontal: 2 },
  dialog: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  portrait: { borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.scroll, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'stretch', gap: 8, flex: 1 },
  moveTile: { width: '48.5%', flexGrow: 1, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 8, paddingVertical: 6, justifyContent: 'space-between' },
  runeDot: { width: 7, height: 7, backgroundColor: colors.xpGold, borderWidth: 1, borderColor: colors.ink, transform: [{ rotate: '45deg' }] },
  card: { flex: 1, borderWidth: 2, borderColor: colors.ink, padding: 8, gap: 2 },
  note: { borderWidth: 2, borderColor: colors.ink, padding: 8, backgroundColor: colors.sky },
  cta: { textAlign: 'center', fontFamily: 'PixelifySans_700Bold', fontSize: 18 },
});
