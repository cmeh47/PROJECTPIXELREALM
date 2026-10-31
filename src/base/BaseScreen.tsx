import { Canvas, Group, Oval, Path, Picture, Skia } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BattleScreen, type BattleResult } from '../combat/BattleScreen';
import { PopText, type Pop } from '../combat/Pops';
import { TREE_H, TREE_W, type Dir } from '../sprites/overworld';
import { colors, fonts } from '../theme';
import { Chip, Framed, haptic, PixelButton, styles as t } from '../ui/pixel';
import {
  bubblePicture,
  groundPicture,
  heartPicture,
  heroOwPicture,
  housePicture,
  hammerPicture,
  hutPicture,
  leafPicture,
  logPicture,
  oldManPicture,
  shackPicture,
  stumpPicture,
  swipePicture,
  toadOwPicture,
  treePicture,
} from './art';
import { BUTCHER, HOUSE, HOUSE_BOX, HUT, HUT_BOX, MAP_H, MAP_W, SPAWN, TOAD_SPAWNS, TREES, inPond, type Pt } from './map';
import { Conversation, type Script, type Speaker } from './Conversation';
import { QuestLog } from './QuestLog';
import type { Hero } from '../net/useHero';
import { HERO_OW_H, HERO_OW_W } from '../sprites/hero';
import { useBaseSave, type SavedBase, type SaveStatus } from '../net/useBaseSave';
import { BUTCHER_SCRIPT, BUTCHER_SPEAKER, CRITTER_SCRIPT, critterSpeaker } from './npcs';
import { WindLayer } from './WindLayer';

// ---------- Tuning ----------
const HERO_SPEED = 64; // art px per second
const STEP_MS = 1000 / 8; // walk cycle: 8 frames per second, DS style
const CHOP_MS = 420; // one swing
const CHOPS_PER_TREE = 3;
const REGROW_MS = 60_000;
const TOUCH_RADIUS = 11; // bumping into a Shroomie
const GRACE_MS = 2500; // after fleeing or losing, Shroomies ignore you for a moment
const MAX_VISITORS = 4;
const HUT_WOOD = 10; // the butcher's quest
const BUILD_MS = 10 * 60_000; // he rebuilds his shack in 10 real minutes

const TOAD_NAMES = ['Mossback Shroomie', 'Lilac Shroomie', 'Gilded Shroomie', 'Mossback Shroomie'];
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
  status: 'wild' | 'gone' | 'critter';
};
type Tree = (typeof TREES)[number] & { hits: number; felledAt: number | null; flash: number; shake: number };
type Leaf = { x: number; y: number; vx: number; vy: number; life: number };
type Phase = 'roam' | 'alert' | 'swirl' | 'battle';
type Foe = { kind: 'shroomie'; id: number } | { kind: 'butcher' };
// How far you've got with the old butcher: he's hostile until you beat him, then offers the hut job.
// After you bring the wood he rebuilds ('building'); 'built' until he shows you round, then 'shop'.
type ButcherStage = 'hostile' | 'spared' | 'quest' | 'building' | 'built' | 'shop';
type Talk = { speaker: Speaker; script: Script; start: string; key: number };

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
// Critters settle by the cottage, each in its own spot.
function settleCritter(td: Toad) {
  td.home = { x: HOUSE.x + 10 + td.id * 12, y: HOUSE.y + 66 + (td.id % 2) * 8 };
  td.x = td.home.x;
  td.y = td.home.y;
  td.from = td.home;
  td.to = td.home;
}
const newTrees = (): Tree[] => TREES.map((tr) => ({ ...tr, hits: 0, felledAt: null, flash: 0, shake: 0 }));

export function BaseScreen({ player }: { player: Hero }) {
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
  const woodRef = useRef(0);
  woodRef.current = wood;
  const [pops, setPops] = useState<Pop[]>([]);
  const [hintSeen, setHintSeen] = useState(false);
  const [invite, setInvite] = useState(false);
  const [arena, setArena] = useState(false);
  const reduceMotion = useReducedMotion();
  const [battle, setBattle] = useState<{ foe: Foe; key: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [stage, setStageState] = useState<ButcherStage>('hostile');
  const stageRef = useRef<ButcherStage>('hostile');
  const setStage = (b: ButcherStage) => {
    stageRef.current = b;
    setStageState(b);
  };

  // World state, mutated by the game loop.
  const hero = useRef({ x: SPAWN.x, y: SPAWN.y, dir: 'down' as Dir, frame: 0, walkMs: 0, grace: 0 });
  // talk: walking over to speak with the butcher; the box opens on arrival.
  const goal = useRef<{ to: Pt | null; holding: boolean; chop: number | null; talk?: boolean; downAt: number }>({ to: null, holding: false, chop: null, downAt: 0 });
  // Where a held finger rests on screen, in art pixels. The hero keeps walking toward it while the camera follows.
  const finger = useRef<Pt | null>(null);
  const chop = useRef<{ tree: number; ms: number; swing: number } | null>(null);
  const toads = useRef<Toad[]>(newToads());
  const trees = useRef<Tree[]>(newTrees());
  const leaves = useRef<Leaf[]>([]);
  const alertFoe = useRef<Foe | null>(null);
  const talking = useRef(false); // a text box is open: Shroomies won't start a fight

  // Positions on the UI thread for smooth movement; everything else repaints at sprite rate.
  const heroX = useSharedValue(SPAWN.x);
  const beat = useSharedValue(0);
  const heroY = useSharedValue(SPAWN.y);
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const tx = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const ty = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const npcX = useSharedValue(BUTCHER.x);
  const npcY = useSharedValue(BUTCHER.y);
  const npcBeat = useSharedValue(0);
  const hammerBeat = useSharedValue(0);
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
    if (x > HUT_BOX.x && x < HUT_BOX.x + HUT_BOX.w && y > HUT_BOX.y && y < HUT_BOX.y + HUT_BOX.h) return true;
    if (Math.abs(x - BUTCHER.x) < 6 && y > BUTCHER.y - 5 && y < BUTCHER.y + 3) return true;
    for (const tr of trees.current) {
      const r = tr.felledAt ? 5 : 6;
      if (Math.abs(x - tr.x) < r && y > tr.y - 5 && y < tr.y + 3) return true;
    }
    return false;
  }, []);

  // ---------- Encounters ----------
  const startEncounter = useCallback(
    async (foe: Foe) => {
      const h = hero.current;
      setPhase('alert');
      goal.current = { to: null, holding: false, chop: null, downAt: 0 };
      chop.current = null;
      alertFoe.current = foe;
      // Face each other.
      const at = foe.kind === 'shroomie' ? toads.current[foe.id] : BUTCHER;
      const dx = at.x - h.x;
      const dy = at.y - h.y;
      h.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      h.frame = 0;
      if (foe.kind === 'shroomie') {
        const tdx = toads.current[foe.id];
        tdx.flip = dx < 0;
        tdx.mode = 'idle';
        tdx.hop = 0;
      }
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
      setBattle({ foe, key: Date.now() });
      setPhase('battle');
      swirl.value = 0;
      flash.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) });
    },
    [bubble, flash, swirl],
  );

  const endBattle = useCallback(
    async (result: BattleResult) => {
      const foe = battle?.foe;
      const id = foe?.kind === 'shroomie' ? foe.id : null;
      flash.value = withTiming(1, { duration: 200 });
      await wait(220);
      setBattle(null);
      setPhase('roam');
      alertFoe.current = null;
      const h = hero.current;
      if (foe?.kind === 'butcher') {
        if (result === 'won') {
          // He's had enough. Once the flash clears, he talks.
          setStage('spared');
          save({ fn: 'butcher_step', step: 'beaten' });
          setTimeout(() => openTalk(BUTCHER_SPEAKER, BUTCHER_SCRIPT, 'spared'), 650);
        } else if (result === 'fled') {
          stepBack(BUTCHER);
        } else {
          respawn();
        }
      }
      if (id != null) {
        const td = toads.current[id];
        if (result === 'won') {
          td.status = 'gone';
          setWood((w) => w + 3);
          save({ fn: 'shroomie_battle', idx: id, result: 'won' });
          for (let k = 0; k < 8; k++) leaves.current.push({ x: td.x, y: td.y - 6, vx: rand(-30, 30), vy: rand(-50, -10), life: 600 });
          setTimeout(() => pop('+3 WOOD', colors.butter, td.x, td.y - 20), 300);
        } else if (result === 'tamed') {
          td.status = 'critter';
          settleCritter(td);
          save({ fn: 'shroomie_battle', idx: id, result: 'tamed' });
          setTimeout(() => pop('NEW CRITTER!', colors.mint, td.x, td.y - 20, { big: true }), 300);
          setTimeout(() => setBanner(`Your ${td.name} moved in by the cottage. Tap it to say hi!`), 700);
        } else if (result === 'fled') {
          stepBack(td);
        } else {
          respawn();
        }
      }
      heroX.value = h.x;
      heroY.value = h.y;
      force();
      flash.value = withTiming(0, { duration: 380 });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [battle, blocked, flash, heroX, heroY, pop],
  );

  // After fleeing: step back out of reach and get a moment's grace.
  const stepBack = (from: Pt) => {
    const h = hero.current;
    const dx = h.x - from.x;
    const dy = h.y - from.y;
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
  };
  // After losing: wake up at home.
  const respawn = () => {
    const h = hero.current;
    h.x = SPAWN.x;
    h.y = SPAWN.y;
    h.dir = 'down';
    h.grace = GRACE_MS;
    setTimeout(() => setBanner('You wake up by your door, good as new.'), 200);
  };

  const talkKey = useRef(0);
  const openTalk = (speaker: Speaker, script: Script, start: string) => {
    talkKey.current += 1;
    talking.current = true;
    setTalk({ speaker, script, start, key: talkKey.current });
  };
  // Talking to the butcher picks up wherever you left off with him.
  const talkToButcher = () => {
    const h = hero.current;
    const dx = BUTCHER.x - h.x;
    const dy = BUTCHER.y - h.y;
    h.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    h.frame = 0;
    const b = stageRef.current;
    const start =
      b === 'hostile' ? 'hostile' : b === 'spared' ? 'ask' : b === 'quest' ? (woodRef.current >= HUT_WOOD ? 'ready' : 'quest') : b === 'building' ? 'building' : b === 'built' ? 'opened' : 'shop';
    openTalk(BUTCHER_SPEAKER, BUTCHER_SCRIPT, start);
    force();
  };
  const endTalk = (end?: string) => {
    setTalk(null);
    talking.current = false;
    if (end === 'fight') startEncounter({ kind: 'butcher' });
    else if (end === 'accept') {
      setStage('quest');
      save({ fn: 'butcher_step', step: 'accept' });
      haptic('success');
      pop('NEW QUEST!', colors.butter, BUTCHER.x, BUTCHER.y - 30, { big: true });
      setTimeout(() => setBanner(`Quest: rebuild the butcher's hut. Bring him ${HUT_WOOD} wood.`), 500);
    } else if (end === 'handin') {
      // The quest is done and leaves the log; the rebuild starts now.
      setWood((w) => w - HUT_WOOD);
      pop(`-${HUT_WOOD} WOOD`, colors.butter, BUTCHER.x, BUTCHER.y - 30);
      buildStart.current = Date.now();
      setBuildLeft(BUILD_MS);
      setStage('building');
      save({ fn: 'butcher_step', step: 'handin' });
      haptic('success');
    } else if (end === 'opened') {
      setStage('shop');
      save({ fn: 'butcher_step', step: 'opened' });
    }
  };

  // The rebuild's clock. It ticks once a second for the bar over the shack.
  const buildStart = useRef(0);
  const [buildLeft, setBuildLeft] = useState(BUILD_MS);
  useEffect(() => {
    if (stage !== 'building') return;
    const tickBuild = () => {
      const left = Math.max(0, BUILD_MS - (Date.now() - buildStart.current));
      setBuildLeft(left);
      if (left === 0) {
        setStage('built');
        haptic('success');
        pop('SHACK BUILT!', colors.butter, HUT.x + 23, HUT.y - 6, { big: true });
        setBanner("The butcher's shack is finished! Go take a look.");
      }
    };
    tickBuild();
    const id = setInterval(tickBuild, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ---------- Saving ----------
  // The server keeps the base between sessions. Each change above is made here first and sent as a
  // server call; whenever the server answers, its copy wins.
  const applySaved = (b: SavedBase) => {
    setWood(b.wood);
    b.shroomies.forEach((status, id) => {
      const td = toads.current[id];
      if (!td || td.status === status) return;
      td.status = status;
      if (status === 'critter') settleCritter(td);
      else if (status === 'wild') Object.assign(td, newToads()[id]);
    });
    if (b.buildStartedAt != null) buildStart.current = b.buildStartedAt;
    const next: ButcherStage = b.butcher === 'building' && b.buildDone ? 'built' : b.butcher;
    // If this device's timer finished a moment before the server's, keep showing the finished shack.
    if (!(next === 'building' && stageRef.current === 'built')) setStage(next);
    force();
  };
  const { status: saveStatus, send: save } = useBaseSave(applySaved);
  const saveRef = useRef(save);
  saveRef.current = save;

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
            saveRef.current({ fn: 'chop' });
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
            // Arrived in front of the butcher?
            if (g.talk && Math.hypot(BUTCHER.x - h.x, BUTCHER.y - h.y) < 20 && (dist < 3 || !moving)) {
              g.talk = false;
              g.to = null;
              moving = false;
              talkToButcher();
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

        // Shroomies wander in little hops around home; critters stay by the cottage.
        for (const td of toads.current) {
          if (td.status === 'gone') continue;
          td.t -= dt;
          if (td.mode === 'idle' && td.t <= 0) {
            const r = td.status === 'critter' ? 14 : 34;
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
          if (td.status === 'wild' && h.grace <= 0 && !talking.current && phaseRef.current === 'roam' && Math.hypot(td.x - h.x, td.y - h.y) < TOUCH_RADIUS) {
            startEncounter({ kind: 'shroomie', id: td.id });
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
      npcBeat.value = Math.floor(now / 700) % 2;
      hammerBeat.value = Math.floor(now / 250) % 2;
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
    // One of your critters? Stop and chat. It pauses its hopping while the box is open.
    const pal = toads.current.find((td) => td.status === 'critter' && Math.abs(p.x - td.x) < 10 && p.y > td.y - 17 && p.y < td.y + 4);
    if (pal) {
      const h = hero.current;
      const dx = pal.x - h.x;
      const dy = pal.y - h.y;
      h.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      h.frame = 0;
      pal.mode = 'idle';
      pal.hop = 0;
      pal.t = 4000;
      goal.current = { to: null, holding: false, chop: null, downAt: g.downAt };
      openTalk(critterSpeaker(pal.name, pal.look), CRITTER_SCRIPT, 'hi');
      force();
      return;
    }
    // The butcher? Walk up to him, then talk.
    if (Math.abs(p.x - BUTCHER.x) < 10 && p.y > BUTCHER.y - 22 && p.y < BUTCHER.y + 4) {
      const h = hero.current;
      if (Math.hypot(BUTCHER.x - h.x, BUTCHER.y - h.y) < 20) {
        goal.current = { to: null, holding: false, chop: null, downAt: g.downAt };
        talkToButcher();
        return;
      }
      const spots = [
        { x: BUTCHER.x, y: BUTCHER.y + 12 },
        { x: BUTCHER.x - 14, y: BUTCHER.y + 1 },
        { x: BUTCHER.x + 14, y: BUTCHER.y + 1 },
      ].filter((q) => !blocked(q.x, q.y));
      spots.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
      if (spots.length) {
        goal.current = { to: spots[0], holding: false, chop: null, talk: true, downAt: g.downAt };
        return;
      }
    }
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
    // Every Shroomie comes back, except the ones that became critters.
    const kept = toads.current;
    toads.current = newToads().map((td, i) => (kept[i].status === 'critter' ? kept[i] : td));
    trees.current = newTrees();
    save({ fn: 'reset_base' });
    hero.current = { x: SPAWN.x, y: SPAWN.y, dir: 'down', frame: 0, walkMs: 0, grace: 0 };
    setWood(0);
    setBanner(null);
    force();
  };

  // ---------- Draw list, back to front ----------
  const h = hero.current;
  const wild = toads.current.filter((td) => td.status === 'wild').length;
  const critters = toads.current.filter((td) => td.status === 'critter').length;
  type Item = { y: number; key: string; node: ReactNode };
  const items: Item[] = [];
  items.push({ y: HOUSE.y + 50, key: 'house', node: <Static key="house" pic={housePicture(s)} x={HOUSE.x} y={HOUSE.y} s={s} /> });
  // The ruins until he gets his wood, then the shack going up, then the finished shack. The shack's
  // frame is taller, so it's drawn 8 px higher to keep the footings lined up.
  const building = stage === 'building';
  const shack = building || stage === 'built' || stage === 'shop';
  const hutPic = !shack ? hutPicture(s) : shackPicture(building ? 1 - buildLeft / BUILD_MS : 1, s);
  items.push({ y: HUT_BOX.y + HUT_BOX.h - 4, key: 'hut', node: <Static key="hut" pic={hutPic} x={HUT.x} y={shack ? HUT.y - 8 : HUT.y} s={s} /> });
  items.push({ y: BUTCHER.y, key: 'butcher', node: <OldMan key="butcher" beat={npcBeat} hammer={building ? hammerBeat : null} s={s} /> });
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
    node: <Mover key="hero" pic={heroOwPicture(h.dir, chop.current ? (chop.current.ms < CHOP_MS / 2 ? 2 : 0) : h.frame, player.look, s)} x={heroX} y={heroY} w={HERO_OW_W} h={HERO_OW_H} s={s} shadow blink={h.grace > 0} />,
  });
  items.sort((a, b) => a.y - b.y);

  const ground = useMemo(() => groundPicture(s), [s]);
  const worldT = useDerivedValue(() => [{ translateX: -camX.value * s }, { translateY: -camY.value * s }]);
  const af = alertFoe.current;
  const alert = af == null ? null : af.kind === 'shroomie' ? { x: tx[af.id], y: ty[af.id], top: 16 } : { x: npcX, y: npcY, top: 22 };

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
                  td.status === 'critter' ? <Heart key={`hrt${i}`} x={tx[i]} y={ty[i]} beat={beat} s={s} /> : null,
                )}
                {alert ? <Bubble x={alert.x} y={alert.y} top={alert.top} scale={bubble} s={s} /> : null}
              </Group>
            </Canvas>
          ) : null}

          {box
            ? pops.map((p) => (
                <PopText key={p.id} pop={p} s={s} onDone={dropPop} />
              ))
            : null}

          {box && building ? <BuildBar left={buildLeft} camX={camX} camY={camY} s={s} /> : null}

          {/* HUD */}
          <View style={[st.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
            <View style={{ gap: 8 }}>
              <Framed depth={1}>
                <View style={st.hudPanel}>
                  <View style={st.baseTitle}>
                    <Text style={t.statSoft}>YOUR BASE</Text>
                    <SaveBadge status={saveStatus} />
                  </View>
                  <View style={st.counters}>
                    <View style={st.counter} accessibilityLabel={`${wood} wood`}>
                      <Icon pic={logPicture(2)} w={28} h={18} />
                      <Text style={t.stat}>{wood}</Text>
                    </View>
                    <View style={st.counter} accessibilityLabel={`${wild} wild Shroomies`}>
                      <Icon pic={toadOwPicture(0, 0, false, 1)} w={16} h={16} />
                      <Text style={t.stat}>{wild}</Text>
                    </View>
                    <View style={st.counter} accessibilityLabel={`${critters} critters`}>
                      <Icon pic={heartPicture(1)} w={9} h={8} />
                      <Text style={t.stat}>{critters}</Text>
                    </View>
                  </View>
                </View>
              </Framed>
              {stage === 'quest' ? (
                <QuestLog quests={[{ id: 'hut', title: "Rebuild the butcher's hut", giver: 'butcher', item: 'wood', have: wood, need: HUT_WOOD, turnIn: 'Bring it to him' }]} />
              ) : null}
            </View>
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
                      ? `Your base is clear! ${critters ? `${critters} ${critters === 1 ? 'critter is' : 'critters are'} settling in by the cottage. Tap one to say hi.` : 'Time to build.'}`
                      : 'Hold anywhere to walk. Tap a tree to chop it. Bump into a Shroomie to battle.')}
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
              you={player}
              encounter={
                battle.foe.kind === 'butcher'
                  ? { look: 0, name: 'Old Man', kind: 'butcher' }
                  : { look: toads.current[battle.foe.id].look, name: toads.current[battle.foe.id].name }
              }
              onDone={endBattle}
            />
          </View>
        ) : null}
        {arena ? (
          <View style={StyleSheet.absoluteFill}>
            <BattleScreen you={player} onExit={() => setArena(false)} />
          </View>
        ) : null}
        <FlashOverlay value={flash} />

        {talk ? <Conversation key={talk.key} speaker={talk.speaker} script={talk.script} start={talk.start} bottom={insets.bottom + 14} onEnd={endTalk} /> : null}

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

function Bubble({ x, y, top, scale, s }: { x: SharedValue<number>; y: SharedValue<number>; top: number; scale: SharedValue<number>; s: number }) {
  // Pops out of the top of the foe's head (top px above its feet), anchored at the tail.
  const transform = useDerivedValue(() => {
    const k = scale.value;
    const ax = Math.round(x.value) * s;
    const ay = Math.round(y.value - top) * s;
    return [{ translateX: ax }, { translateY: ay }, { scale: k }, { translateX: -5.5 * s }, { translateY: -14 * s }];
  });
  return (
    <Group transform={transform}>
      <Picture picture={bubblePicture(s)} />
    </Group>
  );
}

const SAVE_LABELS: Record<SaveStatus, string> = { offline: 'OFFLINE', loading: 'LOADING', saving: 'SAVING', saved: 'SAVED', error: 'NOT SAVED' };
const SAVE_A11Y: Record<SaveStatus, string> = {
  offline: 'Offline: progress is not saved',
  loading: 'Loading your base',
  saving: 'Saving',
  saved: 'Progress saved',
  error: "Couldn't save the last change",
};

// A quiet word beside "YOUR BASE" saying whether your progress is safe.
function SaveBadge({ status }: { status: SaveStatus }) {
  const warn = status === 'error' || status === 'offline';
  return (
    <Text style={[t.statSoft, { fontSize: 10, color: warn ? colors.ink : colors.inkSoft }]} accessibilityLabel={SAVE_A11Y[status]}>
      · {SAVE_LABELS[status]}
    </Text>
  );
}

// The old butcher, breathing slowly where he stands, or swinging his hammer while he rebuilds.
function OldMan({ beat, hammer, s }: { beat: SharedValue<number>; hammer: SharedValue<number> | null; s: number }) {
  const frames = useMemo(() => [oldManPicture(0, s), oldManPicture(1, s)], [s]);
  const hammers = useMemo(() => [hammerPicture(0, s), hammerPicture(1, s)], [s]);
  const pic = useDerivedValue(() => frames[hammer ? 0 : beat.value]);
  const hammerPic = useDerivedValue(() => hammers[hammer ? hammer.value : 0]);
  return (
    <>
      <Group transform={[{ translateX: Math.round(BUTCHER.x - 5) * s }, { translateY: Math.round(BUTCHER.y - 1) * s }]}>
        <Oval x={0} y={0} width={10 * s} height={3 * s} color={colors.ink} opacity={0.14} />
      </Group>
      <Group transform={[{ translateX: Math.round(BUTCHER.x - 8) * s }, { translateY: Math.round(BUTCHER.y - 21) * s }]}>
        <Picture picture={pic} />
      </Group>
      {hammer ? (
        <Group transform={[{ translateX: Math.round(BUTCHER.x + 7) * s }, { translateY: Math.round(BUTCHER.y - 17) * s }]}>
          <Picture picture={hammerPic} />
        </Group>
      ) : null}
    </>
  );
}

// The bar over the shack while it's going up: fills as the clock runs, with the time left beside it.
// It lives in screen space, following the camera.
function BuildBar({ left, camX, camY, s }: { left: number; camX: SharedValue<number>; camY: SharedValue<number>; s: number }) {
  const W = 40;
  const pos = useAnimatedStyle(() => ({
    transform: [{ translateX: (HUT.x + 23 - W / 2 - camX.value) * s }, { translateY: (HUT.y - 16 - camY.value) * s }],
  }));
  const secs = Math.ceil(left / 1000);
  const label = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const frac = 1 - left / BUILD_MS;
  return (
    <Animated.View pointerEvents="none" style={[st.buildBar, { width: W * s }, pos]} accessibilityLabel={`Rebuilding the shack, ${label} left`}>
      <View style={st.buildTrack}>
        <View style={[st.buildFill, { width: `${Math.round(frac * 100)}%` }]} />
      </View>
      <Text style={st.buildTime}>{label}</Text>
    </Animated.View>
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
  baseTitle: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  buildBar: { position: 'absolute', left: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  buildTrack: { flex: 1, height: 12, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.scroll },
  buildFill: { height: '100%', backgroundColor: colors.questGreen },
  buildTime: { fontFamily: fonts.stat, fontSize: 11, lineHeight: 14, color: colors.ink, backgroundColor: colors.vellum, borderWidth: 2, borderColor: colors.ink, paddingHorizontal: 3 },
  toast: { position: 'absolute', left: 12, right: 12 },
  toastText: { fontSize: 14, lineHeight: 19, paddingHorizontal: 12, paddingVertical: 8, textAlign: 'center' },
  sheetWrap: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(59,42,74,0.35)', justifyContent: 'center', padding: 20 },
  sheet: {},
  note: { borderWidth: 2, borderColor: colors.ink, padding: 8, backgroundColor: colors.sky },
});
