import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BattleScreen, type BattleInfo, type BattleResult } from '../combat/BattleScreen';
import { PopText, type Pop } from '../combat/Pops';
import type { Hero } from '../net/useHero';
import { BOAR_OW_H, BOAR_OW_W } from '../sprites/boar';
import { HERO_OW_H, HERO_OW_W } from '../sprites/hero';
import { TREE_H, TREE_W, type Dir } from '../sprites/overworld';
import { colors } from '../theme';
import { Framed, haptic, styles as t } from '../ui/pixel';
import { bake, boarOwPicture, dizzyPicture, heroOwPicture, meatPicture, merchantOwPicture, tapRingPicture, treePicture, type Baked } from './art';
import { Conversation } from './Conversation';
import { faceToward, newFollower, stepFollower, type Follower } from './follow';
import { MERCHANT_SCRIPT, MERCHANT_SPEAKER, PUUL_SPEAKER, type MerchantStage } from './npcs';
import { QuestLog, type Quest } from './QuestLog';
import { MERCHANT_OW_H, MERCHANT_OW_W } from '../sprites/merchant';
import { CoinCounter, PackButton } from './Inventory';
import { Bubble, FlashOverlay, Mover, Static, SwirlOverlay } from './pieces';
import { BakedImage } from './WindLayer';
import { BOAR_HOMES, CLEARING, ENTRY, ROAM, WEST_GAP, WOODS_H, WOODS_TREES, WOODS_W, woodsGround } from './woods';
import type { Pt } from './map';

// ---------- Tuning ----------
const HERO_SPEED = 64; // art px per second, as on the base
const STEP_MS = 1000 / 8;
const TROT_SPEED = 26;
const CHARGE_SPEED = 150;
const SPOT_RANGE = 64; // 4 tiles: a boar notices you this close
const ALERT_MS = 4 * 83; // the "!" and the hoof scrape before it charges: 4 ticks
const CHARGE_REACH = 40; // it charges this far past where you stood
const DIZZY_MS = 1800; // after skidding past you
const COOL_MS = 1800; // before a boar that has calmed down can spot you again
const TOUCH = 10;
const GRACE_MS = 2500;
const PICK_RANGE = 14;
const MEET_RANGE = 60; // walking this close to the lost merchant sets off his cry for help
const CALL_RANGE = 170; // within this, he shouts every few seconds so you can find him
const CALL_MS = 4200;
const CIRCLE_MS = 5200; // one lap of the boars round him
const RESCUE_PACK = ['Bristleback Boar', 'Old Tusker', 'Bristleback Boar'];

const BOAR_NAMES = ['Bristleback Boar', 'Bristleback Boar', 'Old Tusker'];

type Mode = 'gone' | 'idle' | 'trot' | 'alert' | 'charge' | 'skid' | 'dizzy';
type Boar = { id: number; home: Pt; x: number; y: number; flip: boolean; frame: number; mode: Mode; t: number; to: Pt; dir: Pt; left: number; cool: number; anim: number };
type Drop = { id: number; x: number; y: number };
type Phase = 'roam' | 'alert' | 'swirl' | 'battle' | 'talk';
// The merchant in the woods: lost and circled by boars, calmed down after the rescue, or following you.
type Puul = Follower & { mode: 'lost' | 'calm' | 'follow' | 'gone' };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const facing = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');

let groundBaked: Baked | null | undefined;
const woodsGroundImage = () => {
  if (groundBaked === undefined) groundBaked = bake(woodsGround(), WOODS_W, WOODS_H);
  return groundBaked;
};

const newBoar = (id: number, back: number | null): Boar => {
  const home = BOAR_HOMES[id];
  return { id, home, x: home.x, y: home.y, flip: false, frame: 0, mode: back != null && back > Date.now() ? 'gone' : 'idle', t: rand(300, 1500), to: home, dir: { x: 0, y: 0 }, left: 0, cool: 0, anim: 0 };
};

export type WoodsProps = {
  player: Hero;
  coins: number;
  itemCount: number;
  groundMeat: number;
  boarsBackAt: (number | null)[];
  packBump: number;
  packFull: number;
  onOpenPack: () => void;
  onHunt: (idx: number, perfect: boolean) => void;
  // Picks up n meat. Returns false when there's no room in the inventory.
  onPickUp: (n: number) => boolean;
  onLeave: () => void;
  covered: boolean; // the inventory sheet or the leaf wipe is over the woods
  merchant: MerchantStage;
  // After the rescue, once Puul says he'll follow you home.
  onRescued: () => void;
  quests: Quest[];
};

// The Boar Woods. Same controls as the base: hold to walk, tap to walk somewhere, tap meat to pick
// it up. A boar that spots you paws the ground and charges in a straight line: step aside and it
// skids past, dizzy, so the fight opens with it Broken; let it reach you and the fight starts as is.
export function WoodsScreen(props: WoodsProps) {
  const { player, coins, itemCount, groundMeat, boarsBackAt, packBump, packFull, onOpenPack, onHunt, onPickUp, onLeave, covered, merchant, onRescued, quests } = props;
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const s = box ? Math.max(2, Math.floor(box.w / 190)) : 2;
  const viewW = box ? box.w / s : 195;
  const viewH = box ? box.h / s : 420;
  const viewRef = useRef({ w: viewW, h: viewH });
  viewRef.current = { w: viewW, h: viewH };

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [phase, setPhaseState] = useState<Phase>('roam');
  const phaseRef = useRef<Phase>('roam');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  // id -1 is the rescue: the three boars circling Puul, with Puul fighting beside you.
  const [battle, setBattle] = useState<{ id: number; dizzy: boolean; key: number } | null>(null);
  const [talk, setTalk] = useState<{ start: string; key: number } | null>(null);
  // Met him already (the rescue started, then you fled or lost): his plea is shorter next time.
  const met = useRef(false);
  const [metState, setMet] = useState(false);
  const [pops, setPops] = useState<Pop[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  // The tip appears a moment after you arrive, once the wipe has cleared.
  useEffect(() => {
    const id = setTimeout(
      () =>
        setHint(
          (h) =>
            h ??
            (merchant === 'escort'
              ? 'Puul is right behind you. Lead him out through the west gap to your base.'
              : 'Boars charge when they spot you. Step aside and they skid past, dizzy. Tap meat to pick it up. Walk west to go home.'),
        ),
      600,
    );
    return () => clearTimeout(id);
  }, []);
  const coveredRef = useRef(false);
  coveredRef.current = covered || phase === 'battle';
  const puul = useRef<Puul>(
    merchant === 'lost'
      ? { ...newFollower(CLEARING), mode: 'lost' }
      : merchant === 'escort'
        ? { ...newFollower({ x: ENTRY.x + 2, y: ENTRY.y - 12 }, 'right'), mode: 'follow' }
        : { ...newFollower(CLEARING), mode: 'gone' },
  );
  const circle = useRef({ t: 0, call: CALL_MS / 2 });

  const hero = useRef({ x: ENTRY.x, y: ENTRY.y, dir: 'right' as Dir, frame: 0, walkMs: 0, grace: 0 });
  const goal = useRef<{ to: Pt | null; holding: boolean; pick: number | null; downAt: number }>({ to: null, holding: false, pick: null, downAt: 0 });
  const finger = useRef<Pt | null>(null);
  const boars = useRef<Boar[]>(BOAR_HOMES.map((_, i) => newBoar(i, boarsBackAt[i] ?? null)));
  const backAt = useRef(boarsBackAt);
  backAt.current = boarsBackAt;
  // Meat left on the ground. Meat already waiting when you arrive lies by the trail.
  const dropId = useRef(0);
  const drops = useRef<Drop[]>(
    Array.from({ length: groundMeat }, (_, i) => ({ id: dropId.current++, x: 70 + (i % 4) * 7, y: ENTRY.y - 16 + Math.floor(i / 4) * 6 })),
  );
  const tapAt = useRef<{ x: number; y: number; ms: number } | null>(null);
  const circleBeat = useRef(0);
  const metRef = met;
  const alertBoar = useRef<number | null>(null);

  const heroX = useSharedValue(ENTRY.x);
  const heroY = useSharedValue(ENTRY.y);
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const bx = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const by = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const px = useSharedValue(puul.current.x);
  const py = useSharedValue(puul.current.y);
  const cx = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const cy = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const helpBubble = useSharedValue(0);
  const bubble = useSharedValue(0);
  const swirl = useSharedValue(0);
  const flash = useSharedValue(0);
  const starBeat = useSharedValue(0);

  const popId = useRef(0);
  const pop = useCallback((text: string, color: string, wx: number, wy: number, extra?: Partial<Pop>) => {
    popId.current += 1;
    setPops((ps) => [...ps, { id: popId.current, text, color, x: wx - camX.value, y: wy - camY.value, ...extra }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dropPop = useCallback((id: number) => setPops((ps) => ps.filter((p) => p.id !== id)), []);

  const inGap = (y: number) => y > WEST_GAP.walkY0 && y < WEST_GAP.walkY1;
  const blocked = useCallback((x: number, y: number) => {
    if (y < 46 || y > WOODS_H - 10 || x > WOODS_W - 14) return true;
    if (x < 14 && !(inGap(y) && x > 1)) return true;
    for (const tr of WOODS_TREES) if (Math.abs(x - tr.x) < 6 && y > tr.y - 5 && y < tr.y + 3) return true;
    return false;
  }, []);

  // ---------- Encounters ----------
  const startEncounter = useCallback(
    async (id: number, dizzy: boolean) => {
      if (phaseRef.current !== 'roam') return;
      const h = hero.current;
      const b = boars.current[id];
      setPhase('swirl');
      goal.current = { to: null, holding: false, pick: null, downAt: 0 };
      h.dir = facing(b.x - h.x, b.y - h.y);
      h.frame = 0;
      haptic('heavy');
      force();
      swirl.value = 0;
      swirl.value = withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) });
      await wait(920);
      bubble.value = 0;
      alertBoar.current = null;
      flash.value = 1;
      setBattle({ id, dizzy, key: Date.now() });
      setPhase('battle');
      swirl.value = 0;
      flash.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
    },
    [bubble, flash, swirl],
  );

  // ---------- Puul's rescue ----------
  // You walk into the clearing: he spots you, a "!" pops over him, and his plea opens.
  const meetPuul = useCallback(() => {
    if (phaseRef.current !== 'roam') return;
    const h = hero.current;
    setPhase('talk');
    setHint(null);
    goal.current = { to: null, holding: false, pick: null, downAt: 0 };
    finger.current = null;
    h.dir = facing(CLEARING.x - h.x, CLEARING.y - h.y);
    h.frame = 0;
    faceToward(puul.current, h);
    haptic('heavy');
    helpBubble.value = withSequence(withTiming(1.3, { duration: 110, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 90 }));
    force();
    setTimeout(() => {
      helpBubble.value = 0;
      setTalk({ start: met.current ? 'again' : 'help', key: Date.now() });
    }, 650);
  }, [helpBubble]);

  const startRescue = async () => {
    met.current = true;
    setMet(true);
    setPhase('swirl');
    haptic('heavy');
    swirl.value = 0;
    swirl.value = withTiming(1, { duration: 900, easing: Easing.in(Easing.quad) });
    await wait(920);
    flash.value = 1;
    setBattle({ id: -1, dizzy: false, key: Date.now() });
    setPhase('battle');
    swirl.value = 0;
    flash.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
  };

  const endTalk = (end?: string) => {
    setTalk(null);
    if (end === 'fight') {
      void startRescue();
      return;
    }
    if (end === 'follow') {
      // He falls in behind you.
      const p = puul.current;
      p.mode = 'follow';
      p.trail = [];
      onRescued();
      haptic('success');
      pop('NEW QUEST!', colors.butter, p.x, p.y - 30, { big: true });
      setTimeout(() => setHint('Quest: escort Puul home. Lead him out through the west gap.'), 500);
    }
    setPhase('roam');
    force();
  };

  const endRescue = async (result: BattleResult) => {
    flash.value = withTiming(1, { duration: 200 });
    await wait(220);
    setBattle(null);
    const h = hero.current;
    const p = puul.current;
    if (result === 'won') {
      // The boars bolt. Once the flash clears, he catches his breath and thanks you.
      p.mode = 'calm';
      faceToward(p, h);
      setPhase('talk');
      setTimeout(() => setTalk({ start: 'saved', key: Date.now() }), 650);
    } else {
      if (result === 'fled') {
        // Back out of the clearing the way you came in.
        h.x = CLEARING.x;
        h.y = CLEARING.y + MEET_RANGE + 18;
        h.dir = 'up';
      } else {
        h.x = ENTRY.x;
        h.y = ENTRY.y;
        h.dir = 'right';
        setTimeout(() => setHint('You come to at the edge of the woods. The stranger is still out there, shouting for help.'), 200);
      }
      h.grace = GRACE_MS;
      setPhase('roam');
    }
    heroX.value = h.x;
    heroY.value = h.y;
    force();
    flash.value = withTiming(0, { duration: 380 });
  };

  const endBattle = async (result: BattleResult, info: BattleInfo) => {
    if (battle?.id === -1) return endRescue(result);
    const id = battle?.id;
    flash.value = withTiming(1, { duration: 200 });
    await wait(220);
    setBattle(null);
    setPhase('roam');
    const h = hero.current;
    if (id != null) {
      const b = boars.current[id];
      if (result === 'won') {
        const n = info.perfect ? 2 : 1;
        // The meat lands where the boar fell, a step past you so you can see it.
        const dx = b.x - h.x;
        const dy = b.y - h.y;
        const d = Math.hypot(dx, dy) || 1;
        const at = { x: h.x + (dx / d) * 18, y: h.y + (dy / d) * 10 };
        if (blocked(at.x, at.y)) Object.assign(at, { x: h.x + (h.x < WOODS_W / 2 ? 18 : -18), y: h.y });
        for (let k = 0; k < n; k++) drops.current.push({ id: dropId.current++, x: at.x - (n - 1) * 4 + k * 8, y: at.y + (k % 2) * 3 });
        onHunt(id, info.perfect);
        b.mode = 'gone';
        setTimeout(() => pop(n === 2 ? 'DROPPED 2 MEAT' : 'DROPPED MEAT', colors.rose, at.x, at.y - 18), 300);
      } else if (result === 'fled') {
        const dx = h.x - b.x;
        const dy = h.y - b.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        for (let k = 24; k > 0; k -= 4) {
          if (!blocked(h.x + (dx / d) * k, h.y + (dy / d) * k)) {
            h.x += (dx / d) * k;
            h.y += (dy / d) * k;
            break;
          }
        }
        h.grace = GRACE_MS;
        b.mode = 'idle';
        b.cool = COOL_MS;
      } else {
        h.x = ENTRY.x;
        h.y = ENTRY.y;
        h.dir = 'right';
        h.grace = GRACE_MS;
        if (puul.current.mode === 'follow') Object.assign(puul.current, newFollower({ x: ENTRY.x + 2, y: ENTRY.y - 12 }, 'right'));
        b.mode = 'idle';
        b.x = b.home.x;
        b.y = b.home.y;
        b.cool = COOL_MS;
        setTimeout(() => setHint('You come to at the edge of the woods, bruised but fine.'), 200);
      }
    }
    heroX.value = h.x;
    heroY.value = h.y;
    force();
    flash.value = withTiming(0, { duration: 380 });
  };

  // Picks up every meat within reach of where you stand.
  const pickUp = (at: Pt) => {
    const near = drops.current.filter((d) => Math.hypot(d.x - at.x, d.y - at.y) < PICK_RANGE);
    if (!near.length) return;
    if (!onPickUp(near.length)) {
      haptic('warning');
      pop('FULL', colors.hpRose, at.x, at.y - 30);
      return;
    }
    haptic('success');
    drops.current = drops.current.filter((d) => !near.includes(d));
    pop(`+${near.length} BOAR MEAT`, colors.questGreen, at.x, at.y - 30);
  };
  const pickUpRef = useRef(pickUp);
  pickUpRef.current = pickUp;

  // ---------- The game loop ----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const sent = new Map<SharedValue<number>, number>();
    const put = (sv: SharedValue<number>, v: number) => {
      if (sent.get(sv) === v) return;
      sent.set(sv, v);
      sv.value = v;
    };
    const tick = (now: number) => {
      if (coveredRef.current) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(50, now - last);
      last = now;
      let repaint = false;
      const h = hero.current;
      const g = goal.current;
      h.grace = Math.max(0, h.grace - dt);
      if (tapAt.current) {
        tapAt.current.ms -= dt;
        if (tapAt.current.ms <= 0) {
          tapAt.current = null;
          repaint = true;
        }
      }

      if (phaseRef.current === 'roam') {
        // Walking
        if (g.holding && finger.current) g.to = { x: camX.value + finger.current.x, y: camY.value + finger.current.y };
        let moving = false;
        if (g.to) {
          const dx = g.to.x - h.x;
          const dy = g.to.y - h.y;
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
            const dir = facing(dx, dy);
            if (dir !== h.dir) {
              h.dir = dir;
              repaint = true;
            }
          }
          if (g.pick != null && (dist < 3 || !moving)) {
            const target = g.to;
            g.pick = null;
            g.to = null;
            if (Math.hypot(target.x - h.x, target.y - h.y) < PICK_RANGE + 4) pickUpRef.current({ x: h.x, y: h.y });
            repaint = true;
          } else if (!moving && !g.holding) g.to = null;
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
        // Out through the west gap: home.
        if (h.x < 6 && inGap(h.y)) {
          g.to = null;
          g.holding = false;
          h.x = 8;
          onLeave();
        }

        // Boars
        for (const b of boars.current) {
          const dHero = Math.hypot(b.x - h.x, b.y - h.y);
          b.cool = Math.max(0, b.cool - dt);
          b.t -= dt;
          b.anim += dt;
          const setFrame = (f: number) => {
            if (b.frame !== f) {
              b.frame = f;
              repaint = true;
            }
          };
          if (b.mode === 'gone') {
            const back = backAt.current[b.id];
            if (back == null || Date.now() >= back) {
              Object.assign(b, newBoar(b.id, null));
              repaint = true;
            }
            continue;
          }
          const canSpot = h.grace <= 0 && b.cool <= 0 && phaseRef.current === 'roam';
          if ((b.mode === 'idle' || b.mode === 'trot') && canSpot && dHero < SPOT_RANGE) {
            // Spotted! The "!" pops, it drops its head and scrapes a hoof.
            b.mode = 'alert';
            b.t = ALERT_MS;
            b.flip = h.x > b.x;
            setFrame(3);
            alertBoar.current = b.id;
            bubble.value = withSequence(withTiming(1.3, { duration: 110, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 90 }));
            haptic('light');
            repaint = true;
          }
          if (b.mode === 'idle') {
            // Rooting: nose down and up.
            setFrame(Math.floor(b.anim / 400) % 3 === 0 ? 3 : 0);
            if (b.t <= 0) {
              const a = Math.random() * Math.PI * 2;
              const to = { x: b.home.x + Math.cos(a) * rand(8, ROAM), y: b.home.y + Math.sin(a) * rand(4, ROAM) * 0.7 };
              if (!blocked(to.x, to.y)) {
                b.to = to;
                b.mode = 'trot';
                b.flip = to.x > b.x;
              }
              b.t = 400;
            }
          } else if (b.mode === 'trot') {
            setFrame(Math.floor(b.anim / 125) % 2 ? 2 : 1);
            const dx = b.to.x - b.x;
            const dy = b.to.y - b.y;
            const d = Math.hypot(dx, dy);
            const step = (TROT_SPEED * dt) / 1000;
            if (d <= step || blocked(b.x + (dx / d) * step, b.y + (dy / d) * step)) {
              b.mode = 'idle';
              b.t = rand(900, 2600);
            } else {
              b.x += (dx / d) * step;
              b.y += (dy / d) * step;
            }
          } else if (b.mode === 'alert') {
            setFrame(Math.floor(b.anim / 166) % 2 ? 3 : 0);
            if (b.t <= 0) {
              // Charge in a straight line at where you stand now, and on past it.
              const dx = h.x - b.x;
              const dy = h.y - b.y;
              const d = Math.max(1, Math.hypot(dx, dy));
              b.dir = { x: dx / d, y: dy / d };
              b.left = d + CHARGE_REACH;
              b.flip = dx > 0;
              b.mode = 'charge';
              alertBoar.current = null;
              bubble.value = 0;
              repaint = true;
            }
          } else if (b.mode === 'charge') {
            setFrame(Math.floor(b.anim / 60) % 2 ? 2 : 1);
            const step = (CHARGE_SPEED * dt) / 1000;
            const nx = b.x + b.dir.x * step;
            const ny = b.y + b.dir.y * step;
            b.left -= step;
            if (dHero < TOUCH) {
              startEncounter(b.id, false);
            } else if (b.left <= 0 || blocked(nx, ny)) {
              b.mode = 'skid';
              b.t = 250;
              setFrame(0);
            } else {
              b.x = nx;
              b.y = ny;
            }
          } else if (b.mode === 'skid') {
            if (b.t <= 0) {
              b.mode = 'dizzy';
              b.t = DIZZY_MS;
              repaint = true;
            }
          } else if (b.mode === 'dizzy') {
            setFrame(0);
            if (b.t <= 0) {
              b.mode = 'idle';
              b.t = rand(600, 1200);
              b.cool = COOL_MS;
              repaint = true;
            }
          }
          // Bumping into a boar starts the fight; a dizzy one opens it Broken.
          if (b.mode !== 'charge' && h.grace <= 0 && phaseRef.current === 'roam' && dHero < TOUCH) startEncounter(b.id, b.mode === 'dizzy' || b.mode === 'skid');
        }
      }

      // Puul: circled by boars and calling for help, or walking behind you.
      const p = puul.current;
      if (p.mode === 'lost') {
        const c = circle.current;
        c.t += dt;
        c.call -= dt;
        const dMeet = Math.hypot(h.x - CLEARING.x, h.y - CLEARING.y);
        // He turns to keep an eye on the nearest boar.
        const lap = (c.t / CIRCLE_MS) * Math.PI * 2;
        const near = { x: CLEARING.x + Math.cos(lap) * 24, y: CLEARING.y + Math.sin(lap) * 14 };
        const before = p.dir;
        faceToward(p, near);
        if (p.dir === 'up') p.dir = near.x > p.x ? 'right' : 'left';
        if (p.dir !== before) repaint = true;
        if (phaseRef.current === 'roam') {
          if (c.call <= 0 && dMeet < CALL_RANGE) {
            c.call = CALL_MS;
            pop(metRef.current ? 'PLEASE!' : 'HELP!', colors.vellum, CLEARING.x, CLEARING.y - 30);
          }
          if (dMeet < MEET_RANGE && h.grace <= 0) meetPuul();
        }
      } else if (p.mode === 'follow' && phaseRef.current === 'roam') {
        if (stepFollower(p, h, HERO_SPEED * 1.05, dt)) repaint = true;
      }
      put(px, p.x);
      put(py, p.y);
      if (p.mode === 'lost') {
        const lap = (circle.current.t / CIRCLE_MS) * Math.PI * 2;
        for (let k = 0; k < 3; k++) {
          const a = lap + (k * Math.PI * 2) / 3;
          put(cx[k], CLEARING.x + Math.cos(a) * 26);
          put(cy[k], CLEARING.y + 3 + Math.sin(a) * 15);
        }
        // Their trot frames and which way they face only change a few times a second.
        const tick8 = Math.floor(now / 125);
        if (tick8 !== circleBeat.current) {
          circleBeat.current = tick8;
          repaint = true;
        }
      }

      put(starBeat, Math.floor(now / 250) % 4);
      put(heroX, h.x);
      put(heroY, h.y);
      boars.current.forEach((b, i) => {
        put(bx[i], b.x);
        put(by[i], b.y);
      });
      const v = viewRef.current;
      put(camX, Math.round(Math.max(0, Math.min(WOODS_W - v.w, h.x - v.w / 2))));
      put(camY, Math.round(Math.max(0, Math.min(WOODS_H - v.h, h.y - 10 - v.h / 2))));
      if (repaint) force();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, startEncounter]);

  // ---------- Touch ----------
  const toScreen = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX / s, y: e.nativeEvent.locationY / s });
  const toWorld = (e: GestureResponderEvent) => {
    const q = toScreen(e);
    return { x: camX.value + q.x, y: camY.value + q.y };
  };
  const onGrant = (e: GestureResponderEvent) => {
    if (phaseRef.current !== 'roam') return;
    setHint(null);
    const p = toWorld(e);
    const g = goal.current;
    g.downAt = Date.now();
    // Puul, following you? He has a word for you.
    const pl = puul.current;
    if (pl.mode === 'follow' && Math.abs(p.x - pl.x) < 10 && p.y > pl.y - 20 && p.y < pl.y + 4) {
      const h = hero.current;
      h.dir = facing(pl.x - h.x, pl.y - h.y);
      h.frame = 0;
      faceToward(pl, h);
      goal.current = { to: null, holding: false, pick: null, downAt: g.downAt };
      setPhase('talk');
      setTalk({ start: 'escort', key: Date.now() });
      force();
      return;
    }
    // Meat? Walk over and pick it up.
    const meat = drops.current.find((d) => Math.abs(p.x - d.x) < 10 && p.y > d.y - 12 && p.y < d.y + 6);
    if (meat) {
      tapAt.current = { x: meat.x, y: meat.y, ms: 600 };
      const h = hero.current;
      if (Math.hypot(meat.x - h.x, meat.y - h.y) < PICK_RANGE) {
        goal.current = { to: null, holding: false, pick: null, downAt: g.downAt };
        pickUp({ x: h.x, y: h.y });
      } else goal.current = { to: { x: meat.x, y: meat.y + 2 }, holding: false, pick: meat.id, downAt: g.downAt };
      force();
      return;
    }
    // A dizzy boar? Walk into it.
    const dizzy = boars.current.find((b) => b.mode === 'dizzy' && Math.abs(p.x - b.x) < 14 && p.y > b.y - 16 && p.y < b.y + 4);
    if (dizzy) {
      goal.current = { to: { x: dizzy.x, y: dizzy.y }, holding: false, pick: null, downAt: g.downAt };
      return;
    }
    finger.current = toScreen(e);
    goal.current = { to: p, holding: true, pick: null, downAt: g.downAt };
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
    if (Date.now() - g.downAt > 260) g.to = null;
  };

  // ---------- Draw list ----------
  const h = hero.current;
  type Item = { y: number; key: string; node: ReactNode };
  const items: Item[] = [];
  for (const tr of WOODS_TREES) {
    items.push({ y: tr.y, key: `t${tr.id}`, node: <Static key={`t${tr.id}`} pic={treePicture(tr.variant, false, s)} x={tr.x - TREE_W / 2} y={tr.y - TREE_H + 1} s={s} /> });
  }
  for (const d of drops.current) items.push({ y: d.y - 2, key: `m${d.id}`, node: <Static key={`m${d.id}`} pic={meatPicture(s)} x={d.x - 7} y={d.y - 10} s={s} /> });
  boars.current.forEach((b, i) => {
    if (b.mode === 'gone') return;
    items.push({ y: b.y, key: `b${b.id}`, node: <Mover key={`b${b.id}`} pic={boarOwPicture(b.frame, b.flip, s)} x={bx[i]} y={by[i]} w={BOAR_OW_W} h={BOAR_OW_H} s={s} shadow /> });
  });
  const pl = puul.current;
  if (pl.mode !== 'gone') {
    const scared = pl.mode === 'lost';
    items.push({
      y: pl.y,
      key: 'puul',
      node: <Mover key="puul" pic={merchantOwPicture(pl.dir, scared ? Math.floor(circleBeat.current / 2) % 2 : pl.frame, scared, s)} x={px} y={py} w={MERCHANT_OW_W} h={MERCHANT_OW_H} s={s} shadow />,
    });
  }
  if (pl.mode === 'lost') {
    // The three boars trotting round him. Each faces the way it's running.
    // Same angle the game loop placed them at, so each boar sorts behind Puul on the far side of
    // its lap and in front of him on the near side.
    const lap = (circle.current.t / CIRCLE_MS) * Math.PI * 2;
    for (let k = 0; k < 3; k++) {
      const a = lap + (k * Math.PI * 2) / 3;
      const runsRight = -Math.sin(a) > 0;
      const yy = CLEARING.y + 3 + Math.sin(a) * 15;
      items.push({ y: yy, key: `cb${k}`, node: <Mover key={`cb${k}`} pic={boarOwPicture((circleBeat.current + k) % 2 ? 2 : 1, runsRight, s)} x={cx[k]} y={cy[k]} w={BOAR_OW_W} h={BOAR_OW_H} s={s} shadow /> });
    }
  }
  items.push({ y: h.y, key: 'hero', node: <Mover key="hero" pic={heroOwPicture(h.dir, h.frame, player.look, s)} x={heroX} y={heroY} w={HERO_OW_W} h={HERO_OW_H} s={s} shadow blink={h.grace > 0} /> });
  items.sort((a, b) => a.y - b.y);

  const ground = woodsGroundImage();
  const worldT = useDerivedValue(() => [{ translateX: -camX.value * s }, { translateY: -camY.value * s }]);
  const ab = alertBoar.current;
  const boarsHere = boars.current.filter((b) => b.mode !== 'gone').length;
  const tap = tapAt.current;

  return (
    <View style={StyleSheet.absoluteFill}>
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
              {ground ? <BakedImage baked={ground} s={s} /> : null}
              {tap ? <Static pic={tapRingPicture(s)} x={tap.x - 10} y={tap.y - 5} s={s} /> : null}
              {items.map((it) => it.node)}
              {boars.current.map((b, i) => (b.mode === 'dizzy' || b.mode === 'skid' ? <Dizzy key={`dz${i}`} x={bx[i]} y={by[i]} flip={b.flip} beat={starBeat} s={s} /> : null))}
              {ab != null ? <Bubble x={bx[ab]} y={by[ab]} top={15} scale={bubble} s={s} /> : null}
              {pl.mode === 'lost' ? <Bubble x={px} y={py} top={24} scale={helpBubble} s={s} /> : null}
            </Group>
          </Canvas>
        ) : null}
        {box ? pops.map((p) => <PopText key={p.id} pop={p} s={s} onDone={dropPop} />) : null}

        <View style={[st.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Framed depth={1}>
            <View style={st.hudPanel}>
              <Text style={t.statSoft}>BOAR WOODS</Text>
              <View style={st.counters}>
                <CoinCounter coins={coins} />
                <View style={st.counter} accessibilityLabel={`${boarsHere} boars about`}>
                  <Canvas style={{ width: 22, height: 15 }}>
                    <Picture picture={boarOwPicture(0, false, 1)} />
                  </Canvas>
                  <Text style={t.stat}>{boarsHere}</Text>
                </View>
              </View>
            </View>
          </Framed>
          <View style={{ gap: 8, alignItems: 'flex-end' }}>
            <PackButton count={itemCount} bump={packBump} full={packFull} onPress={onOpenPack} />
          </View>
        </View>
        {quests.length || (metState && pl.mode === 'lost') ? (
          <View style={[st.quests, { top: insets.top + 64 }]} pointerEvents="box-none">
            <QuestLog
              quests={
                metState && pl.mode === 'lost'
                  ? [{ id: 'rescue', title: 'Save the stranger', giver: 'merchant', item: 'go', have: 0, need: 1, turnIn: 'Drive off the boars circling him' }, ...quests]
                  : quests
              }
            />
          </View>
        ) : null}


        <SwirlOverlay progress={swirl} w={box?.w ?? 0} h={box?.h ?? 0} />
      </View>

      {phase === 'roam' && hint ? (
        <View style={[st.toast, { bottom: insets.bottom + 14 }]} pointerEvents="none">
          <Framed shadow={null} fill={colors.vellum}>
            <Text style={[t.body, st.toastText]}>{hint}</Text>
          </Framed>
        </View>
      ) : null}
      {battle ? (
        <View style={StyleSheet.absoluteFill}>
          <BattleScreen
            key={battle.key}
            you={player}
            encounter={
              battle.id === -1
                ? {
                    look: 0,
                    name: RESCUE_PACK[0],
                    kind: 'boar',
                    pack: RESCUE_PACK,
                    ally: '???',
                    intro: 'Three angry boars wheel round to face you. The stranger raises his walking stick beside you!',
                    won: 'The boars bolt into the trees. The stranger leans on his stick, panting. +60 XP.',
                    fled: 'You backed off. The boars are still circling the stranger.',
                  }
                : { look: 0, name: BOAR_NAMES[battle.id], kind: 'boar', dizzy: battle.dizzy, ally: pl.mode === 'follow' ? 'Puul' : undefined }
            }
            onDone={endBattle}
          />
        </View>
      ) : null}
      <FlashOverlay value={flash} />
      {talk ? (
        <Conversation
          key={talk.key}
          speaker={talk.start === 'help' || talk.start === 'again' || talk.start === 'saved' ? MERCHANT_SPEAKER : PUUL_SPEAKER}
          script={MERCHANT_SCRIPT}
          start={talk.start}
          bottom={insets.bottom + 14}
          onEnd={endTalk}
        />
      ) : null}
    </View>
  );
}

// Stars circling a dizzy boar's head.
function Dizzy({ x, y, flip, beat, s }: { x: SharedValue<number>; y: SharedValue<number>; flip: boolean; beat: SharedValue<number>; s: number }) {
  const frames = [0, 1, 2, 3].map((f) => dizzyPicture(f, s));
  const pic = useDerivedValue(() => frames[beat.value]);
  const transform = useDerivedValue(() => [{ translateX: Math.round(x.value - (flip ? 2 : 14)) * s }, { translateY: Math.round(y.value - 19) * s }]);
  return (
    <Group transform={transform}>
      <Picture picture={pic} />
    </Group>
  );
}

const st = StyleSheet.create({
  mapBox: { flex: 1, overflow: 'hidden', backgroundColor: colors.mint },
  hud: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hudPanel: { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  counters: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  counter: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  toast: { position: 'absolute', left: 12, right: 12 },
  quests: { position: 'absolute', left: 12 },
  toastText: { fontSize: 14, lineHeight: 19, paddingHorizontal: 12, paddingVertical: 8, textAlign: 'center' },
});
