import { Canvas, Group, Oval, Path, Picture, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BattleScreen, type BattleResult } from '../combat/BattleScreen';
import { PopText, type Pop } from '../combat/Pops';
import { TREE_H, TREE_W, type Dir } from '../sprites/overworld';
import { colors } from '../theme';
import { Chip, Framed, haptic, PixelButton, styles as t } from '../ui/pixel';
import {
  bubblePicture,
  groundPicture,
  heartPicture,
  heroOwPicture,
  housePicture,
  leafPicture,
  logPicture,
  stumpPicture,
  swipePicture,
  toadOwPicture,
  treePicture,
} from './art';
import { HOUSE, HOUSE_BOX, MAP_H, MAP_W, SPAWN, TOAD_SPAWNS, TREES, inPond, type Pt } from './map';
import { WindLayer } from './WindLayer';

// ---------- Tuning ----------
const HERO_SPEED = 64; // art px per second
const STEP_MS = 1000 / 8; // walk cycle: 8 frames per second, DS style
const CHOP_MS = 420; // one swing
const CHOPS_PER_TREE = 3;
const REGROW_MS = 60_000;
const TOUCH_RADIUS = 11; // bumping into a toadstool
const GRACE_MS = 2500; // after fleeing or losing, toadstools ignore you for a moment
const MAX_VISITORS = 4;

const TOAD_NAMES = ['Mossback Toadstool', 'Lilac Toadstool', 'Gilded Toadstool', 'Mossback Toadstool'];
const TOAD_LOOKS = [0, 1, 2, 0];

type Toad = {
  id: number;
  look: number;
  name: string;
  home: Pt;
  x: number;
  y: number;
  flip: boolean;
  hop: 0 | 1 | 2;
  t: number; // ms left in the current idle or hop step
  from: Pt;
  to: Pt;
  mode: 'idle' | 'squash' | 'air';
  status: 'wild' | 'gone' | 'pet';
};
type Tree = (typeof TREES)[number] & { hits: number; felledAt: number | null; flash: number; shake: number };
type Leaf = { x: number; y: number; vx: number; vy: number; life: number };
type Phase = 'roam' | 'alert' | 'swirl' | 'battle';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

function newToads(): Toad[] {
  return TOAD_SPAWNS.map((p, i) => ({
    id: i,
    look: TOAD_LOOKS[i],
    name: TOAD_NAMES[i],
    home: p,
    x: p.x,
    y: p.y,
    flip: false,
    hop: 0,
    t: rand(300, 1500),
    from: p,
    to: p,
    mode: 'idle',
    status: 'wild',
  }));
}
const newTrees = (): Tree[] => TREES.map((tr) => ({ ...tr, hits: 0, felledAt: null, flash: 0, shake: 0 }));

export function BaseScreen() {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  // DS-like framing: about 190 art pixels across, at a whole-number scale.
  const s = box ? Math.max(2, Math.floor(box.w / 190)) : 2;
  const viewW = box ? box.w / s : 195;
  const viewH = box ? box.h / s : 420;

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [phase, setPhaseState] = useState<Phase>('roam');
  const phaseRef = useRef<Phase>('roam');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [wood, setWood] = useState(0);
  const [pops, setPops] = useState<Pop[]>([]);
  const [hintSeen, setHintSeen] = useState(false);
  const [invite, setInvite] = useState(false);
  const [arena, setArena] = useState(false);
  const reduceMotion = useReducedMotion();
  const [battle, setBattle] = useState<{ toad: number; key: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  // World state, mutated by the game loop.
  const hero = useRef({ x: SPAWN.x, y: SPAWN.y, dir: 'down' as Dir, frame: 0, walkMs: 0, grace: 0 });
  const goal = useRef<{ to: Pt | null; holding: boolean; chop: number | null; downAt: number }>({ to: null, holding: false, chop: null, downAt: 0 });
  // Where a held finger rests on screen, in art pixels. The hero keeps walking toward it while the camera follows.
  const finger = useRef<Pt | null>(null);
  const chop = useRef<{ tree: number; ms: number; swing: number } | null>(null);
  const toads = useRef<Toad[]>(newToads());
  const trees = useRef<Tree[]>(newTrees());
  const leaves = useRef<Leaf[]>([]);
  const alertToad = useRef<number | null>(null);

  // Positions on the UI thread for smooth movement; everything else repaints at sprite rate.
  const heroX = useSharedValue(SPAWN.x);
  const beat = useSharedValue(0);
  const heroY = useSharedValue(SPAWN.y);
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const tx = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const ty = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const bubble = useSharedValue(0);
  const swirl = useSharedValue(0);
  const flash = useSharedValue(0);

  const viewRef = useRef({ w: viewW, h: viewH });
  viewRef.current = { w: viewW, h: viewH };

  const popId = useRef(0);
  const pop = useCallback((text: string, color: string, wx: number, wy: number, extra?: Partial<Pop>) => {
    popId.current += 1;
    // Pops live in screen space; convert from world at the moment they appear.
    const p: Pop = { id: popId.current, text, color, x: wx - camX.value, y: wy - camY.value, ...extra };
    setPops((ps) => [...ps, p]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dropPop = useCallback((id: number) => setPops((ps) => ps.filter((p) => p.id !== id)), []);

  // ---------- Collision ----------
  const blocked = useCallback((x: number, y: number) => {
    if (x < 14 || x > MAP_W - 14 || y < 46 || y > MAP_H - 10) return true;
    if (x > HOUSE_BOX.x - 3 && x < HOUSE_BOX.x + HOUSE_BOX.w + 3 && y > HOUSE_BOX.y && y < HOUSE_BOX.y + HOUSE_BOX.h + 2) return true;
    if (inPond({ x, y }, 3)) return true;
    for (const tr of trees.current) {
      const r = tr.felledAt ? 5 : 6;
      if (Math.abs(x - tr.x) < r && y > tr.y - 5 && y < tr.y + 3) return true;
    }
    return false;
  }, []);

  // ---------- Encounters ----------
  const startEncounter = useCallback(
    async (id: number) => {
      const tdx = toads.current[id];
      const h = hero.current;
      setPhase('alert');
      goal.current = { to: null, holding: false, chop: null, downAt: 0 };
      chop.current = null;
      alertToad.current = id;
      // Face each other.
      const dx = tdx.x - h.x;
      const dy = tdx.y - h.y;
      h.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      h.frame = 0;
      tdx.flip = dx < 0;
      tdx.mode = 'idle';
      tdx.hop = 0;
      force();
      haptic('heavy');
      bubble.value = withSequence(withTiming(1.3, { duration: 110, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 90 }));
      await wait(700);
      setPhase('swirl');
      swirl.value = 0;
      swirl.value = withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) });
      await wait(920);
      bubble.value = 0;
      flash.value = 1;
      setBattle({ toad: id, key: Date.now() });
      setPhase('battle');
      swirl.value = 0;
      flash.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
    },
    [bubble, flash, swirl],
  );

  const endBattle = useCallback(
    async (result: BattleResult) => {
      const id = battle?.toad;
      flash.value = withTiming(1, { duration: 200 });
      await wait(220);
      setBattle(null);
      setPhase('roam');
      alertToad.current = null;
      const h = hero.current;
      if (id != null) {
        const td = toads.current[id];
        if (result === 'won') {
          td.status = 'gone';
          setWood((w) => w + 3);
          for (let k = 0; k < 8; k++) leaves.current.push({ x: td.x, y: td.y - 6, vx: rand(-30, 30), vy: rand(-50, -10), life: 600 });
          setTimeout(() => pop('+3 WOOD', colors.butter, td.x, td.y - 20), 300);
        } else if (result === 'tamed') {
          td.status = 'pet';
          // Pets settle by the cottage.
          td.home = { x: HOUSE.x + 10 + id * 12, y: HOUSE.y + 66 + (id % 2) * 8 };
          td.x = td.home.x;
          td.y = td.home.y;
          td.from = td.home;
          td.to = td.home;
          setTimeout(() => pop('NEW PET!', colors.mint, td.x, td.y - 20, { big: true }), 300);
        } else if (result === 'fled') {
          // Step back out of reach and get a moment's grace.
          const dx = h.x - td.x;
          const dy = h.y - td.y;
          const d = Math.max(1, Math.hypot(dx, dy));
          for (let k = 24; k > 0; k -= 4) {
            const nx = h.x + (dx / d) * k;
            const ny = h.y + (dy / d) * k;
            if (!blocked(nx, ny)) {
              h.x = nx;
              h.y = ny;
              break;
            }
          }
          h.grace = GRACE_MS;
        } else {
          h.x = SPAWN.x;
          h.y = SPAWN.y;
          h.dir = 'down';
          h.grace = GRACE_MS;
          setTimeout(() => setBanner('You wake up by your door, good as new.'), 200);
        }
      }
      heroX.value = h.x;
      heroY.value = h.y;
      force();
      flash.value = withTiming(0, { duration: 380 });
    },
    [battle, blocked, flash, heroX, heroY, pop],
  );

  // ---------- The game loop ----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let repaint = false;
    const tick = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      repaint = false;
      const h = hero.current;
      const g = goal.current;
      const ph = phaseRef.current;
      h.grace = Math.max(0, h.grace - dt);

      if (ph === 'roam') {
        // Chopping
        const c = chop.current;
        if (c) {
          c.ms += dt;
          if (c.ms >= CHOP_MS) {
            c.ms -= CHOP_MS;
            c.swing += 1;
            const tr = trees.current[c.tree];
            tr.hits += 1;
            tr.shake = 160;
            tr.flash = 80;
            setWood((w) => w + 1);
            haptic('light');
            pop('+1', colors.butter, tr.x, tr.y - 44);
            for (let k = 0; k < 3; k++) leaves.current.push({ x: tr.x + rand(-10, 10), y: tr.y - rand(18, 36), vx: rand(-12, 12), vy: rand(-20, 0), life: 700 });
            if (tr.hits >= CHOPS_PER_TREE) {
              tr.felledAt = Date.now();
              for (let k = 0; k < 10; k++) leaves.current.push({ x: tr.x + rand(-12, 12), y: tr.y - rand(12, 40), vx: rand(-30, 30), vy: rand(-40, -5), life: 800 });
              chop.current = null;
              haptic('success');
            }
            repaint = true;
          }
        } else {
          // Walking
          if (g.holding && finger.current) g.to = { x: camX.value + finger.current.x, y: camY.value + finger.current.y };
          const target = g.to;
          let moving = false;
          if (target) {
            const dx = target.x - h.x;
            const dy = target.y - h.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 1.5) {
              const step = Math.min(dist, (HERO_SPEED * dt) / 1000);
              const nx = h.x + (dx / dist) * step;
              const ny = h.y + (dy / dist) * step;
              if (!blocked(nx, ny)) {
                h.x = nx;
                h.y = ny;
                moving = true;
              } else if (!blocked(nx, h.y)) {
                h.x = nx;
                moving = true;
              } else if (!blocked(h.x, ny)) {
                h.y = ny;
                moving = true;
              }
              const dir: Dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
              if (dir !== h.dir) {
                h.dir = dir;
                repaint = true;
              }
            }
            if (!moving && !g.holding) g.to = null;
            // Arrived next to the tree we were sent to chop?
            if (g.chop != null) {
              const tr = trees.current[g.chop];
              if (!tr.felledAt && Math.hypot(tr.x - h.x, tr.y + 2 - h.y) < 15 && (dist < 3 || !moving)) {
                const ddx = tr.x - h.x;
                const ddy = tr.y - h.y;
                h.dir = Math.abs(ddx) > Math.abs(ddy) ? (ddx > 0 ? 'right' : 'left') : ddy > 0 ? 'down' : 'up';
                chop.current = { tree: g.chop, ms: CHOP_MS * 0.6, swing: 0 };
                g.chop = null;
                g.to = null;
                moving = false;
                repaint = true;
              }
            }
          }
          if (moving) {
            h.walkMs += dt;
            const f = Math.floor(h.walkMs / STEP_MS) % 4;
            if (f !== h.frame) {
              h.frame = f;
              repaint = true;
            }
          } else if (h.frame !== 0) {
            h.frame = 0;
            h.walkMs = 0;
            repaint = true;
          }
        }

        // Toadstools wander in little hops around home; pets stay by the cottage.
        for (const td of toads.current) {
          if (td.status === 'gone') continue;
          td.t -= dt;
          if (td.mode === 'idle' && td.t <= 0) {
            const r = td.status === 'pet' ? 14 : 34;
            const a = Math.random() * Math.PI * 2;
            const to = { x: td.home.x + Math.cos(a) * rand(0, r), y: td.home.y + Math.sin(a) * rand(0, r) * 0.7 };
            if (blocked(to.x, to.y)) {
              td.t = 400;
              continue;
            }
            td.from = { x: td.x, y: td.y };
            td.to = to;
            td.flip = to.x < td.x;
            td.mode = 'squash';
            td.hop = 1;
            td.t = 130;
            repaint = true;
          } else if (td.mode === 'squash' && td.t <= 0) {
            td.mode = 'air';
            td.hop = 2;
            td.t = 320;
            repaint = true;
          } else if (td.mode === 'air') {
            const u = Math.min(1, 1 - td.t / 320);
            td.x = td.from.x + (td.to.x - td.from.x) * u;
            td.y = td.from.y + (td.to.y - td.from.y) * u;
            if (td.t <= 0) {
              td.mode = 'idle';
              td.hop = 0;
              td.t = rand(700, 2200);
              repaint = true;
            }
          }
          // Bump!
          if (td.status === 'wild' && h.grace <= 0 && phaseRef.current === 'roam' && Math.hypot(td.x - h.x, td.y - h.y) < TOUCH_RADIUS) {
            startEncounter(td.id);
            repaint = true;
          }
        }

        // Trees: shake and flash decay, regrowth.
        for (const tr of trees.current) {
          if (tr.shake > 0 || tr.flash > 0) {
            tr.shake = Math.max(0, tr.shake - dt);
            tr.flash = Math.max(0, tr.flash - dt);
            if (tr.shake === 0 || tr.flash === 0) repaint = true;
          }
          if (tr.felledAt && Date.now() - tr.felledAt > REGROW_MS && Math.hypot(tr.x - h.x, tr.y - h.y) > 30) {
            tr.felledAt = null;
            tr.hits = 0;
            repaint = true;
          }
        }
      }

      // Leaves
      if (leaves.current.length) {
        for (const l of leaves.current) {
          l.life -= dt;
          l.vy += (60 * dt) / 1000;
          l.x += (l.vx * dt) / 1000;
          l.y += (l.vy * dt) / 1000;
        }
        leaves.current = leaves.current.filter((l) => l.life > 0);
        repaint = true;
      }

      // Push positions to the UI thread; the camera stays locked on the hero, clamped to the map.
      beat.value = Math.floor(now / 400) % 2;
      heroX.value = h.x;
      heroY.value = h.y;
      toads.current.forEach((td, i) => {
        tx[i].value = td.x;
        ty[i].value = td.y;
      });
      const v = viewRef.current;
      camX.value = Math.round(Math.max(0, Math.min(MAP_W - v.w, h.x - v.w / 2)));
      camY.value = Math.round(Math.max(0, Math.min(MAP_H - v.h, h.y - 10 - v.h / 2)));

      if (repaint) force();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, pop, startEncounter]);

  // ---------- Touch: hold to walk, tap a tree to chop ----------
  const toScreen = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX / s, y: e.nativeEvent.locationY / s });
  const toWorld = (e: GestureResponderEvent) => {
    const q = toScreen(e);
    return { x: camX.value + q.x, y: camY.value + q.y };
  };
  const onGrant = (e: GestureResponderEvent) => {
    if (phaseRef.current !== 'roam') return;
    setHintSeen(true);
    setBanner(null);
    const p = toWorld(e);
    const g = goal.current;
    g.downAt = Date.now();
    chop.current = null;
    // A tree? Walk to the nearest free side of its trunk, then chop.
    const tr = trees.current.find((tt) => !tt.border && !tt.felledAt && p.x > tt.x - 13 && p.x < tt.x + 13 && p.y > tt.y - TREE_H + 4 && p.y < tt.y + 3);
    if (tr) {
      const h = hero.current;
      const sides = [
        { x: tr.x, y: tr.y + 9 },
        { x: tr.x - 11, y: tr.y + 1 },
        { x: tr.x + 11, y: tr.y + 1 },
      ].filter((q) => !blocked(q.x, q.y));
      sides.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
      if (sides.length) {
        goal.current = { to: sides[0], holding: false, chop: tr.id, downAt: g.downAt };
        return;
      }
    }
    finger.current = toScreen(e);
    goal.current = { to: p, holding: true, chop: null, downAt: g.downAt };
  };
  const onMove = (e: GestureResponderEvent) => {
    const g = goal.current;
    if (!g.holding || phaseRef.current !== 'roam') return;
    finger.current = toScreen(e);
    g.to = toWorld(e);
  };
  const onRelease = () => {
    const g = goal.current;
    finger.current = null;
    if (!g.holding) return;
    g.holding = false;
    // A quick tap walks to the spot; letting go after a hold stops on the spot.
    if (Date.now() - g.downAt > 260) g.to = null;
  };

  const resetBase = () => {
    toads.current = newToads();
    trees.current = newTrees();
    hero.current = { x: SPAWN.x, y: SPAWN.y, dir: 'down', frame: 0, walkMs: 0, grace: 0 };
    setWood(0);
    setBanner(null);
    force();
  };

  // ---------- Draw list, back to front ----------
  const h = hero.current;
  const wild = toads.current.filter((td) => td.status === 'wild').length;
  const pets = toads.current.filter((td) => td.status === 'pet').length;
  type Item = { y: number; key: string; node: ReactNode };
  const items: Item[] = [];
  items.push({ y: HOUSE.y + 50, key: 'house', node: <Static key="house" pic={housePicture(s)} x={HOUSE.x} y={HOUSE.y} s={s} /> });
  for (const tr of trees.current) {
    const left = tr.x - TREE_W / 2 + (tr.shake > 0 ? (Math.floor(tr.shake / 40) % 2 ? 1 : -1) : 0);
    items.push({
      y: tr.y,
      key: `t${tr.id}`,
      node: tr.felledAt ? (
        <Static key={`t${tr.id}`} pic={stumpPicture(s)} x={tr.x - 8} y={tr.y - 9} s={s} />
      ) : (
        <Static key={`t${tr.id}`} pic={treePicture(tr.variant, tr.flash > 0, s)} x={left} y={tr.y - TREE_H + 1} s={s} />
      ),
    });
  }
  toads.current.forEach((td, i) => {
    if (td.status === 'gone') return;
    items.push({
      y: td.y,
      key: `d${td.id}`,
      node: <Mover key={`d${td.id}`} pic={toadOwPicture(td.hop, td.look, td.flip, s)} x={tx[i]} y={ty[i]} w={16} h={16} s={s} shadow={td.hop !== 2} />,
    });
  });
  items.push({
    y: h.y,
    key: 'hero',
    node: <Mover key="hero" pic={heroOwPicture(h.dir, chop.current ? (chop.current.ms < CHOP_MS / 2 ? 2 : 0) : h.frame, 0, s)} x={heroX} y={heroY} w={16} h={22} s={s} shadow blink={h.grace > 0} />,
  });
  items.sort((a, b) => a.y - b.y);

  const ground = useMemo(() => groundPicture(s), [s]);
  const worldT = useDerivedValue(() => [{ translateX: -camX.value * s }, { translateY: -camY.value * s }]);
  const alert = alertToad.current;

  return (
    <View style={st.screen}>
      <View style={st.column}>
        <View
          style={st.mapBox}
          onLayout={(e: LayoutChangeEvent) => {
            const w = Math.round(e.nativeEvent.layout.width);
            const hh = Math.round(e.nativeEvent.layout.height);
            setBox((b) => (b && b.w === w && b.h === hh ? b : { w, h: hh }));
          }}
          onStartShouldSetResponder={() => phaseRef.current === 'roam'}
          onMoveShouldSetResponder={() => phaseRef.current === 'roam'}
          onResponderGrant={onGrant}
          onResponderMove={onMove}
          onResponderRelease={onRelease}
          onResponderTerminate={onRelease}
        >
          {box ? (
            <Canvas style={{ width: box.w, height: box.h }}>
              <Group transform={worldT}>
                <Picture picture={ground} />
                <WindLayer s={s} active={phase === 'roam' && !arena && !reduceMotion} />
                {items.map((it) => it.node)}
                {chop.current ? <Swipe dir={h.dir} hx={h.x} hy={h.y} s={s} /> : null}
                {leaves.current.map((l, i) => (
                  <Group key={i} transform={[{ translateX: Math.round(l.x) * s }, { translateY: Math.round(l.y) * s }]} opacity={Math.min(1, l.life / 300)}>
                    <Picture picture={leafPicture(s)} />
                  </Group>
                ))}
                {toads.current.map((td, i) =>
                  td.status === 'pet' ? <Heart key={`hrt${i}`} x={tx[i]} y={ty[i]} beat={beat} s={s} /> : null,
                )}
                {alert != null ? <Bubble x={tx[alert]} y={ty[alert]} scale={bubble} s={s} /> : null}
              </Group>
            </Canvas>
          ) : null}

          {box
            ? pops.map((p) => (
                <PopText key={p.id} pop={p} s={s} onDone={dropPop} />
              ))
            : null}

          {/* HUD */}
          <View style={[st.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
            <Framed depth={1}>
              <View style={st.hudPanel}>
                <Text style={t.statSoft}>YOUR BASE</Text>
                <View style={st.counters}>
                  <View style={st.counter} accessibilityLabel={`${wood} wood`}>
                    <Icon pic={logPicture(2)} w={28} h={18} />
                    <Text style={t.stat}>{wood}</Text>
                  </View>
                  <View style={st.counter} accessibilityLabel={`${wild} wild toadstools`}>
                    <Icon pic={toadOwPicture(0, 0, false, 1)} w={16} h={16} />
                    <Text style={t.stat}>{wild}</Text>
                  </View>
                  <View style={st.counter} accessibilityLabel={`${pets} pets`}>
                    <Icon pic={heartPicture(1)} w={9} h={8} />
                    <Text style={t.stat}>{pets}</Text>
                  </View>
                </View>
              </View>
            </Framed>
            <View style={{ gap: 6, alignItems: 'flex-end' }}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Visitors: 1 of ${MAX_VISITORS}. Invite friends`} onPress={() => setInvite(true)} hitSlop={8}>
                <Chip label={`VISITORS 1/${MAX_VISITORS}`} fill={colors.butter} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Practice arena" onPress={() => setArena(true)} hitSlop={8}>
                <Chip label="ARENA" fill={colors.vellum} />
              </Pressable>
              {wild === 0 ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Reset base" onPress={resetBase} hitSlop={8}>
                  <Chip label="RESET" fill={colors.vellum} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {phase === 'roam' && (!hintSeen || banner || wild === 0) ? (
            <View style={[st.toast, { bottom: insets.bottom + 14 }]} pointerEvents="none">
              <Framed shadow={null} fill={colors.vellum}>
                <Text style={[t.body, st.toastText]}>
                  {banner ??
                    (wild === 0
                      ? `Your base is clear! ${pets ? `${pets} ${pets === 1 ? 'pet is' : 'pets are'} settling in by the cottage.` : 'Time to build.'}`
                      : 'Hold anywhere to walk. Tap a tree to chop it. Bump into a toadstool to battle.')}
                </Text>
              </Framed>
            </View>
          ) : null}

          <SwirlOverlay progress={swirl} w={box?.w ?? 0} h={box?.h ?? 0} />
        </View>

        {battle ? (
          <View style={StyleSheet.absoluteFill}>
            <BattleScreen
              key={battle.key}
              encounter={{ look: toads.current[battle.toad].look, name: toads.current[battle.toad].name }}
              onDone={endBattle}
            />
          </View>
        ) : null}
        {arena ? (
          <View style={StyleSheet.absoluteFill}>
            <BattleScreen onExit={() => setArena(false)} />
          </View>
        ) : null}
        <FlashOverlay value={flash} />

        {invite ? (
          <View style={st.sheetWrap}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setInvite(false)} accessibilityLabel="Close" />
            <Framed style={st.sheet}>
              <View style={{ padding: 14, gap: 10 }}>
                <Text style={t.heading}>Invite helpers</Text>
                <Text style={t.body}>
                  Up to {MAX_VISITORS} players can be on your base at once: you and three friends. Helpers chop, battle and tame alongside you.
                </Text>
                <View style={st.note}>
                  <Text style={[t.body, { fontSize: 14 }]}>Invite codes switch on once sign-in is built, in the next milestone.</Text>
                </View>
                <PixelButton height={52} onPress={() => setInvite(false)}>
                  <Text style={[t.buttonSmall, { textAlign: 'center', fontFamily: 'PixelifySans_700Bold', fontSize: 18 }]}>Got it</Text>
                </PixelButton>
              </View>
            </Framed>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ---------- Drawing pieces ----------

function Static({ pic, x, y, s }: { pic: ReturnType<typeof housePicture>; x: number; y: number; s: number }) {
  return (
    <Group transform={[{ translateX: Math.round(x) * s }, { translateY: Math.round(y) * s }]}>
      <Picture picture={pic} />
    </Group>
  );
}

// A sprite whose feet follow shared x/y, with a soft ink shadow under it.
function Mover({ pic, x, y, w, h, s, shadow, blink }: { pic: ReturnType<typeof housePicture>; x: SharedValue<number>; y: SharedValue<number>; w: number; h: number; s: number; shadow?: boolean; blink?: boolean }) {
  const transform = useDerivedValue(() => [{ translateX: Math.round(x.value - w / 2) * s }, { translateY: Math.round(y.value - h + 1) * s }]);
  const shadowT = useDerivedValue(() => [{ translateX: Math.round(x.value - 5) * s }, { translateY: Math.round(y.value - 1) * s }]);
  return (
    <>
      {shadow ? (
        <Group transform={shadowT}>
          <Oval x={0} y={0} width={10 * s} height={3 * s} color={colors.ink} opacity={0.14} />
        </Group>
      ) : null}
      <Group transform={transform} opacity={blink ? 0.6 : 1}>
        <Picture picture={pic} />
      </Group>
    </>
  );
}

function Swipe({ dir, hx, hy, s }: { dir: Dir; hx: number; hy: number; s: number }) {
  const off = dir === 'left' ? { x: -16, y: -16 } : dir === 'right' ? { x: 4, y: -16 } : dir === 'up' ? { x: -4, y: -30 } : { x: -4, y: -8 };
  return (
    <Group transform={[{ translateX: Math.round(hx + off.x) * s }, { translateY: Math.round(hy + off.y) * s }]}>
      <Picture picture={swipePicture(dir === 'left', s)} />
    </Group>
  );
}

function Heart({ x, y, beat, s }: { x: SharedValue<number>; y: SharedValue<number>; beat: SharedValue<number>; s: number }) {
  const transform = useDerivedValue(() => [{ translateX: Math.round(x.value - 4) * s }, { translateY: Math.round(y.value - 26 - beat.value) * s }]);
  return (
    <Group transform={transform}>
      <Picture picture={heartPicture(s)} />
    </Group>
  );
}

function Bubble({ x, y, scale, s }: { x: SharedValue<number>; y: SharedValue<number>; scale: SharedValue<number>; s: number }) {
  // Pops out of the toadstool's cap, anchored at the tail.
  const transform = useDerivedValue(() => {
    const k = scale.value;
    const ax = Math.round(x.value) * s;
    const ay = Math.round(y.value - 16) * s;
    return [{ translateX: ax }, { translateY: ay }, { scale: k }, { translateX: -5.5 * s }, { translateY: -14 * s }];
  });
  return (
    <Group transform={transform}>
      <Picture picture={bubblePicture(s)} />
    </Group>
  );
}

function Icon({ pic, w, h }: { pic: ReturnType<typeof housePicture>; w: number; h: number }) {
  return (
    <Canvas style={{ width: w, height: h }}>
      <Picture picture={pic} />
    </Canvas>
  );
}

// The battle swirl: spiral arms in lavender, then ink, sweep around until they cover the screen.
function SwirlOverlay({ progress, w, h }: { progress: SharedValue<number>; w: number; h: number }) {
  const arms = (lag: number, widthBoost: number) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useDerivedValue(() => {
      const path = Skia.PathBuilder.Make();
      const p = Math.max(0, Math.min(1, (progress.value - lag) / (1 - lag)));
      if (p <= 0 || w === 0) return path.detach();
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h) * 0.6;
      const N = 6;
      const rot = p * Math.PI * 1.4;
      const span = ((Math.PI * 2) / N) * Math.min(1, p * widthBoost);
      const twist = 1.6 * (1 - p * 0.5);
      for (let k = 0; k < N; k++) {
        const a0 = (k * Math.PI * 2) / N + rot;
        path.moveTo(cx, cy);
        for (let i = 1; i <= 14; i++) {
          const r = (R * i) / 14;
          const a = a0 + (i / 14) * twist;
          path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        for (let i = 14; i >= 1; i--) {
          const r = (R * i) / 14;
          const a = a0 + span + (i / 14) * twist;
          path.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
        path.close();
      }
      return path.detach();
    });
  const back = arms(0, 1.25);
  const front = arms(0.18, 1.3);
  const show = useAnimatedStyle(() => ({ opacity: progress.value > 0 ? 1 : 0 }));
  if (!w) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, show]}>
      <Canvas style={{ width: w, height: h }}>
        <Path path={back} color={colors.lavender} antiAlias={false} />
        <Path path={front} color={colors.ink} antiAlias={false} />
      </Canvas>
    </Animated.View>
  );
}

function FlashOverlay({ value }: { value: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ opacity: value.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.white }, style]} />;
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 560, backgroundColor: colors.mint },
  mapBox: { flex: 1, overflow: 'hidden' },
  hud: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hudPanel: { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  counters: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  counter: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  toast: { position: 'absolute', left: 12, right: 12 },
  toastText: { fontSize: 14, lineHeight: 19, paddingHorizontal: 12, paddingVertical: 8, textAlign: 'center' },
  sheetWrap: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(59,42,74,0.35)', justifyContent: 'center', padding: 20 },
  sheet: {},
  note: { borderWidth: 2, borderColor: colors.ink, padding: 8, backgroundColor: colors.sky },
});
