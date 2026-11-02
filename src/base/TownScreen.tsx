import { Canvas, Group, Oval, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useDerivedValue, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PopText, type Pop } from '../combat/Pops';
import type { Hero } from '../net/useHero';
import { HERO_OW_H, HERO_OW_W } from '../sprites/hero';
import { TREE_H, TREE_W, type Dir } from '../sprites/overworld';
import { BUILDING_SIZE, HELPER_OW_H, HELPER_OW_W, PROP_SIZE, SMOKE_FRAMES } from '../sprites/town';
import { colors } from '../theme';
import { Framed, haptic, styles as t } from '../ui/pixel';
import { bake, buildingPicture, helperOwPicture, heroOwPicture, ownerOwPicture, propPicture, smokePicture, tapRingPicture, treePicture, type Baked } from './art';
import { followY, newVCam } from './camera';
import { Conversation, type Script, type Speaker } from './Conversation';
import { CoinCounter, PackButton } from './Inventory';
import type { Pt } from './map';
import { HELPER_SCRIPT, OWNER_SCRIPT, OWNER_SPEAKER, helperSpeaker } from './npcs';
import { Mover, Static } from './pieces';
import { QuestLog, type Quest } from './QuestLog';
import { BakedImage } from './WindLayer';
import { BUILDINGS, HELPER_HOMES, NORTH_GAP, OWNER_POST, PROPS, TOWN_ENTRY, TOWN_H, TOWN_TREES, TOWN_W, WITCH_SMOKE, propBox, townGround, type Building } from './town';

// ---------- Tuning ----------
const HERO_SPEED = 64; // art px per second, as on the base
const STEP_MS = 1000 / 8;
const TALK_RANGE = 20; // close enough to chat
const LOOK_RANGE = 48; // Mira turns to watch you within this
const HOP_RANGE = 14; // helpers potter about this close to home

type Phase = 'roam' | 'talk';
type Helper = { id: number; home: Pt; x: number; y: number; flip: boolean; hop: 0 | 1 | 2; t: number; from: Pt; to: Pt; mode: 'idle' | 'squash' | 'air' };
type Talk = { speaker: Speaker; script: Script; start: string; key: number };
// What a walk is headed for: a chat with Mira or a helper, or a building's door.
type Aim = { kind: 'owner' } | { kind: 'helper'; id: number } | { kind: 'door'; b: number };

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const facing = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
const inBox = (x: number, y: number, r: { x: number; y: number; w: number; h: number }) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;

let groundBaked: Baked | null | undefined;
const townGroundImage = () => {
  if (groundBaked === undefined) groundBaked = bake(townGround(), TOWN_W, TOWN_H);
  return groundBaked;
};

const newHelpers = (): Helper[] =>
  HELPER_HOMES.map((p, id) => ({ id, home: p, x: p.x, y: p.y, flip: id === 1, hop: 0, t: rand(400, 1600), from: p, to: p, mode: 'idle' }));

export type TownProps = {
  player: Hero;
  coins: number;
  itemCount: number;
  packBump: number;
  packFull: number;
  onOpenPack: () => void;
  onLeave: () => void;
  covered: boolean; // the inventory sheet or the leaf wipe is over the town
  metOwner: boolean;
  onMeetOwner: () => void;
  quests: Quest[];
};

// The town. Same controls as the base: hold to walk, tap to walk somewhere. Tap Mira or one of her
// helpers to chat, or a building to walk to its door. Walk north out of the gap to go home.
export function TownScreen(props: TownProps) {
  const { player, coins, itemCount, packBump, packFull, onOpenPack, onLeave, covered, metOwner, onMeetOwner, quests } = props;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const s = box ? Math.max(2, Math.floor(box.w / 190)) : 2;
  const viewW = box ? box.w / s : 195;
  const viewH = box ? box.h / s : 420;
  const viewRef = useRef({ w: viewW, h: viewH, s });
  viewRef.current = { w: viewW, h: viewH, s };

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [phase, setPhaseState] = useState<Phase>('roam');
  const phaseRef = useRef<Phase>('roam');
  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };
  const [talk, setTalk] = useState<Talk | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setHint((h) => h ?? (metOwner ? 'Back in town. Walk north through the gap to go home.' : 'Welcome to town! Tap a building to walk to its door, or tap someone to say hi.')), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const coveredRef = useRef(false);
  coveredRef.current = covered;
  const metRef = useRef(metOwner);
  metRef.current = metOwner;

  const hero = useRef({ x: TOWN_ENTRY.x, y: TOWN_ENTRY.y, dir: 'down' as Dir, frame: 0, walkMs: 0 });
  const goal = useRef<{ to: Pt | null; holding: boolean; aim: Aim | null; downAt: number }>({ to: null, holding: false, aim: null, downAt: 0 });
  const finger = useRef<Pt | null>(null);
  const helpers = useRef<Helper[]>(newHelpers());
  const owner = useRef<{ dir: Dir }>({ dir: 'down' });
  const tapAt = useRef<{ x: number; y: number; ms: number } | null>(null);

  const heroX = useSharedValue(TOWN_ENTRY.x);
  const heroY = useSharedValue(TOWN_ENTRY.y);
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const vcam = useRef(newVCam());
  const hx = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const hy = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const breath = useSharedValue(0);
  const smoke = useSharedValue(0);

  const popId = useRef(0);
  const pop = useCallback((text: string, color: string, wx: number, wy: number, extra?: Partial<Pop>) => {
    popId.current += 1;
    setPops((ps) => [...ps, { id: popId.current, text, color, x: wx - camX.value, y: wy - camY.value, ...extra }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dropPop = useCallback((id: number) => setPops((ps) => ps.filter((p) => p.id !== id)), []);

  const inGap = (x: number) => x > NORTH_GAP.walkX0 && x < NORTH_GAP.walkX1;
  const blocked = useCallback((x: number, y: number) => {
    if (x < 12 || x > TOWN_W - 12 || y > TOWN_H - 12) return true;
    if (y < 44 && !(inGap(x) && y > 1)) return true;
    for (const b of BUILDINGS) if (inBox(x, y, b.box)) return true;
    for (const p of PROPS) if (inBox(x, y, propBox(p))) return true;
    for (const tr of TOWN_TREES) if (Math.abs(x - tr.x) < 6 && y > tr.y - 5 && y < tr.y + 3) return true;
    if (Math.abs(x - OWNER_POST.x) < 6 && y > OWNER_POST.y - 5 && y < OWNER_POST.y + 3) return true;
    return false;
  }, []);

  // ---------- Talking ----------
  const faceHero = (to: Pt) => {
    const h = hero.current;
    h.dir = facing(to.x - h.x, to.y - h.y);
    h.frame = 0;
  };
  const talkToOwner = () => {
    const h = hero.current;
    faceHero(OWNER_POST);
    owner.current.dir = facing(h.x - OWNER_POST.x, h.y - OWNER_POST.y);
    goal.current = { to: null, holding: false, aim: null, downAt: 0 };
    setHint(null);
    setPhase('talk');
    setTalk({ speaker: { ...OWNER_SPEAKER, name: metRef.current ? 'Mira' : OWNER_SPEAKER.name }, script: OWNER_SCRIPT, start: metRef.current ? 'again' : 'hi', key: Date.now() });
    force();
  };
  const talkToHelper = (id: number) => {
    const hp = helpers.current[id];
    faceHero(hp);
    // It stops hopping and turns to you while you chat.
    Object.assign(hp, { mode: 'idle', hop: 0, t: 4000, flip: hero.current.x < hp.x });
    goal.current = { to: null, holding: false, aim: null, downAt: 0 };
    setHint(null);
    setPhase('talk');
    setTalk({ speaker: helperSpeaker(id), script: HELPER_SCRIPT, start: `hi${id}`, key: Date.now() });
    force();
  };
  const knock = (b: Building) => {
    faceHero({ x: b.door.x, y: b.door.y - 10 });
    haptic('light');
    pop(b.name.toUpperCase(), colors.butter, b.door.x, b.door.y - 30);
    setHint(b.kind === 'critters' ? "Mira's critter store. Its doors open soon!" : `${b.name}. The door's shut for now. Check back soon!`);
    force();
  };
  const endTalk = (end?: string) => {
    setTalk(null);
    setPhase('roam');
    if (end === 'met') {
      onMeetOwner();
      // The helpers hop for joy.
      for (const hp of helpers.current) Object.assign(hp, { mode: 'idle', t: rand(0, 200) });
    }
    force();
  };
  const arrive = (aim: Aim) => {
    if (aim.kind === 'owner') talkToOwner();
    else if (aim.kind === 'helper') talkToHelper(aim.id);
    else knock(BUILDINGS[aim.b]);
  };
  const arriveRef = useRef(arrive);
  arriveRef.current = arrive;

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
    let left = false;
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
      if (tapAt.current) {
        tapAt.current.ms -= dt;
        if (tapAt.current.ms <= 0) {
          tapAt.current = null;
          repaint = true;
        }
      }

      if (phaseRef.current === 'roam') {
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
          // Arrived where the tap was headed?
          if (g.aim && (dist < 3 || !moving)) {
            const aim = g.aim;
            const target = aim.kind === 'owner' ? OWNER_POST : aim.kind === 'helper' ? helpers.current[aim.id] : BUILDINGS[aim.b].door;
            g.aim = null;
            g.to = null;
            moving = false;
            if (Math.hypot(target.x - h.x, target.y - h.y) < (aim.kind === 'door' ? 14 : TALK_RANGE + 4)) arriveRef.current(aim);
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
        // Out through the north gap: home.
        if (h.y < 30 && inGap(h.x) && !left) {
          left = true;
          g.to = null;
          g.holding = false;
          onLeave();
        }

        // Mira keeps an eye on you as you pass.
        const o = owner.current;
        const near = Math.hypot(h.x - OWNER_POST.x, h.y - OWNER_POST.y) < LOOK_RANGE;
        const want: Dir = near ? facing(h.x - OWNER_POST.x, h.y - OWNER_POST.y) : 'down';
        if (want !== o.dir) {
          o.dir = want === 'up' ? 'down' : want;
          repaint = true;
        }

        // Helpers potter about the shop front in little hops.
        for (const hp of helpers.current) {
          hp.t -= dt;
          if (hp.mode === 'idle' && hp.t <= 0) {
            const a = Math.random() * Math.PI * 2;
            const to = { x: hp.home.x + Math.cos(a) * rand(0, HOP_RANGE), y: hp.home.y + Math.sin(a) * rand(0, HOP_RANGE) * 0.6 };
            if (blocked(to.x, to.y) || Math.hypot(to.x - h.x, to.y - h.y) < 10) {
              hp.t = 400;
              continue;
            }
            Object.assign(hp, { from: { x: hp.x, y: hp.y }, to, flip: to.x < hp.x, mode: 'squash', hop: 1, t: 110 });
            repaint = true;
          } else if (hp.mode === 'squash' && hp.t <= 0) {
            Object.assign(hp, { mode: 'air', hop: 2, t: 260 });
            repaint = true;
          } else if (hp.mode === 'air') {
            const u = Math.min(1, 1 - hp.t / 260);
            hp.x = hp.from.x + (hp.to.x - hp.from.x) * u;
            hp.y = hp.from.y + (hp.to.y - hp.from.y) * u;
            if (hp.t <= 0) {
              Object.assign(hp, { mode: 'idle', hop: 0, t: rand(600, 1900) });
              repaint = true;
            }
          }
        }
      }

      // 12 fps ambient beats: Mira's breath, the witch's chimney. Both rest with Reduce Motion.
      put(breath, reduceMotion ? 0 : Math.floor(now / 700) % 2);
      put(smoke, reduceMotion ? 0 : Math.floor(now / 166) % SMOKE_FRAMES);
      put(heroX, h.x);
      put(heroY, h.y);
      helpers.current.forEach((hp, i) => {
        put(hx[i], hp.x);
        put(hy[i], hp.y);
      });
      const v = viewRef.current;
      put(camX, Math.round(Math.max(0, Math.min(TOWN_W - v.w, h.x - v.w / 2))));
      put(camY, followY(vcam.current, h.y, v.h, TOWN_H, dt, v.s));
      if (repaint) force();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked, reduceMotion]);

  // ---------- Touch ----------
  const toScreen = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX / s, y: e.nativeEvent.locationY / s });
  const toWorld = (e: GestureResponderEvent) => {
    const q = toScreen(e);
    return { x: camX.value + q.x, y: camY.value + q.y };
  };
  // Where to stand to talk to someone at p: in front, or beside them, whichever is free and nearest.
  const standBy = (p: Pt) => {
    const h = hero.current;
    const spots = [
      { x: p.x, y: p.y + 12 },
      { x: p.x - 14, y: p.y + 1 },
      { x: p.x + 14, y: p.y + 1 },
    ].filter((q) => !blocked(q.x, q.y));
    spots.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    return spots[0] ?? null;
  };
  const walkTo = (to: Pt | null, aim: Aim, downAt: number) => {
    if (!to) return false;
    const h = hero.current;
    tapAt.current = { x: to.x, y: to.y, ms: 600 };
    goal.current = { to, holding: false, aim, downAt };
    if (Math.hypot(to.x - h.x, to.y - h.y) < 3) {
      goal.current.to = null;
      goal.current.aim = null;
      arrive(aim);
    }
    force();
    return true;
  };
  const onGrant = (e: GestureResponderEvent) => {
    if (phaseRef.current !== 'roam') return;
    setHint(null);
    const p = toWorld(e);
    const h = hero.current;
    const downAt = Date.now();
    // Mira?
    if (Math.abs(p.x - OWNER_POST.x) < 10 && p.y > OWNER_POST.y - 22 && p.y < OWNER_POST.y + 4) {
      if (Math.hypot(OWNER_POST.x - h.x, OWNER_POST.y - h.y) < TALK_RANGE) return talkToOwner();
      if (walkTo(standBy(OWNER_POST), { kind: 'owner' }, downAt)) return;
    }
    // A helper?
    const hp = helpers.current.find((q) => Math.abs(p.x - q.x) < 9 && p.y > q.y - 14 && p.y < q.y + 4);
    if (hp) {
      if (Math.hypot(hp.x - h.x, hp.y - h.y) < TALK_RANGE) return talkToHelper(hp.id);
      if (walkTo(standBy(hp), { kind: 'helper', id: hp.id }, downAt)) return;
    }
    // A building, anywhere on it? Walk to its door.
    const bi = BUILDINGS.findIndex((b) => {
      const { w, h: bh } = BUILDING_SIZE[b.kind];
      return p.x > b.x + 2 && p.x < b.x + w - 2 && p.y > b.y + 2 && p.y < b.y + bh;
    });
    if (bi >= 0 && walkTo(BUILDINGS[bi].door, { kind: 'door', b: bi }, downAt)) return;
    finger.current = toScreen(e);
    goal.current = { to: p, holding: true, aim: null, downAt };
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
  for (const b of BUILDINGS) {
    items.push({ y: b.box.y + b.box.h, key: `b-${b.kind}`, node: <Static key={`b-${b.kind}`} pic={buildingPicture(b.kind, s)} x={b.x} y={b.y} s={s} /> });
  }
  // A tree you've walked behind turns see-through, so it never hides you.
  for (const tr of TOWN_TREES) {
    const behind = h.y < tr.y - 2 && h.y > tr.y - TREE_H + 8 && Math.abs(h.x - tr.x) < TREE_W / 2 + 2;
    const node = <Static key={`t${tr.id}`} pic={treePicture(tr.variant, false, s)} x={tr.x - TREE_W / 2} y={tr.y - TREE_H + 1} s={s} />;
    items.push({ y: tr.y, key: `t${tr.id}`, node: behind ? <Group key={`t${tr.id}`} opacity={0.5}>{node}</Group> : node });
  }
  for (const p of PROPS) {
    const { w, h: ph } = PROP_SIZE[p.kind];
    items.push({ y: p.y, key: `p${p.id}`, node: <Static key={`p${p.id}`} pic={propPicture(p.kind, s)} x={p.x - Math.floor(w / 2)} y={p.y - ph + 2} s={s} /> });
  }
  items.push({ y: OWNER_POST.y, key: 'owner', node: <Owner key="owner" dir={owner.current.dir} beat={breath} s={s} /> });
  helpers.current.forEach((hp, i) => {
    items.push({
      y: hp.y,
      key: `h${hp.id}`,
      node: <Mover key={`h${hp.id}`} pic={helperOwPicture(hp.hop, hp.id, hp.flip, s)} x={hx[i]} y={hy[i]} w={HELPER_OW_W} h={HELPER_OW_H} s={s} shadow={hp.hop !== 2} />,
    });
  });
  items.push({ y: h.y, key: 'hero', node: <Mover key="hero" pic={heroOwPicture(h.dir, h.frame, player.look, s)} x={heroX} y={heroY} w={HERO_OW_W} h={HERO_OW_H} s={s} shadow /> });
  items.sort((a, b) => a.y - b.y);

  const ground = townGroundImage();
  const worldT = useDerivedValue(() => [{ translateX: -camX.value * s }, { translateY: -camY.value * s }]);
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
              <Smoke beat={smoke} s={s} />
            </Group>
          </Canvas>
        ) : null}
        {box ? pops.map((p) => <PopText key={p.id} pop={p} s={s} onDone={dropPop} />) : null}

        <View style={[st.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Framed depth={1}>
            <View style={st.hudPanel}>
              <Text style={t.statSoft}>TOWN</Text>
              <CoinCounter coins={coins} />
            </View>
          </Framed>
        </View>
        {/* Same corners as the base: the pack under the panel, the quest log up in the top right. */}
        <View style={[st.pack, { top: insets.top + 64 }]} pointerEvents="box-none">
          <PackButton count={itemCount} bump={packBump} full={packFull} onPress={onOpenPack} />
        </View>
        {quests.length ? (
          <View style={[st.quests, { top: insets.top + 8 }]} pointerEvents="box-none">
            <QuestLog quests={quests} />
          </View>
        ) : null}
      </View>

      {phase === 'roam' && hint ? (
        <View style={[st.toast, { bottom: insets.bottom + 14 }]} pointerEvents="none">
          <Framed shadow={null} fill={colors.vellum}>
            <Text style={[t.body, st.toastText]}>{hint}</Text>
          </Framed>
        </View>
      ) : null}
      {talk ? <Conversation key={talk.key} speaker={talk.speaker} script={talk.script} start={talk.start} bottom={insets.bottom + 14} onEnd={endTalk} /> : null}
    </View>
  );
}

// Mira at her post, breathing slowly, turned the way she's looking.
function Owner({ dir, beat, s }: { dir: Dir; beat: SharedValue<number>; s: number }) {
  const frames = useMemo(() => [ownerOwPicture(dir, 0, s), ownerOwPicture(dir, 1, s)], [dir, s]);
  const pic = useDerivedValue(() => frames[beat.value]);
  return (
    <>
      <Group transform={[{ translateX: Math.round(OWNER_POST.x - 5) * s }, { translateY: Math.round(OWNER_POST.y - 1) * s }]}>
        <Oval x={0} y={0} width={10 * s} height={3 * s} color={colors.ink} opacity={0.14} />
      </Group>
      <Group transform={[{ translateX: Math.round(OWNER_POST.x - 9) * s }, { translateY: Math.round(OWNER_POST.y - 21) * s }]}>
        <Picture picture={pic} />
      </Group>
    </>
  );
}

// Lavender puffs curling up out of the witch's chimney.
function Smoke({ beat, s }: { beat: SharedValue<number>; s: number }) {
  const frames = useMemo(() => Array.from({ length: SMOKE_FRAMES }, (_, f) => smokePicture(f, s)), [s]);
  const pic = useDerivedValue(() => frames[beat.value]);
  return (
    <Group transform={[{ translateX: Math.round(WITCH_SMOKE.x - 3) * s }, { translateY: Math.round(WITCH_SMOKE.y - 17) * s }]}>
      <Picture picture={pic} />
    </Group>
  );
}

const st = StyleSheet.create({
  mapBox: { flex: 1, overflow: 'hidden', backgroundColor: colors.mint },
  hud: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hudPanel: { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  toast: { position: 'absolute', left: 12, right: 12 },
  pack: { position: 'absolute', left: 12 },
  quests: { position: 'absolute', right: 12 },
  toastText: { fontSize: 14, lineHeight: 19, paddingHorizontal: 12, paddingVertical: 8, textAlign: 'center' },
});
