import { Canvas, Group, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useDerivedValue, useReducedMotion, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PopText, type Pop } from '../combat/Pops';
import type { Hero } from '../net/useHero';
import { BACK_WALL, BAR_DOOR, BAR_H, BAR_W, COUNTER, FIRE, FIRE_FRAMES, NPC_H, NPC_W, PATRONS, roomGrid } from '../sprites/bar';
import { HERO_OW_H, HERO_OW_W } from '../sprites/hero';
import type { Dir } from '../sprites/overworld';
import { colors } from '../theme';
import { Framed, haptic, styles as t } from '../ui/pixel';
import { bake, bartenderPicture, counterPicture, firePicture, heroOwPicture, patronPicture, stoolPicture, strangerPicture, tablePicture, tapRingPicture, type Baked } from './art';
import { Conversation, type Script, type Speaker } from './Conversation';
import { CoinCounter, PackButton } from './Inventory';
import type { Pt } from './map';
import { BARTENDER_SPEAKER, FIREWOOD_NEED, FIREWOOD_REWARD, PATRON_SCRIPTS, STRANGER_SCRIPT, STRANGER_SPEAKER, bartenderScript, patronSpeaker, type BartenderStage } from './npcs';
import { Mover, Static } from './pieces';
import { QuestLog, type Quest } from './QuestLog';
import { route } from './route';
import { BakedImage } from './WindLayer';

// Inside the bar: Barley behind the counter, three tables of two regulars, and the hooded stranger
// in the dark corner. Same controls as outside: hold to walk, tap someone to walk over and talk.
// Walk back out through the door at the bottom to return to the street.

// ---------- Layout (room art pixels; see sprites/bar.ts) ----------
const HERO_SPEED = 64;
const STEP_MS = 1000 / 8;
const ENTRY: Pt = { x: 96, y: 226 };
const BARLEY: Pt = { x: 96, y: 62 }; // his feet, behind the counter
const BARLEY_SPOT: Pt = { x: 96, y: 86 }; // where you stand to talk to him, at the end of the runner
const STOOLS = [62, 80, 112, 130];
const STOOL_Y = 84;
// Each table and its two regulars, sat either side facing each other: PATRONS[2i] on the left.
const TABLES: Pt[] = [
  { x: 48, y: 128 },
  { x: 144, y: 128 },
  { x: 144, y: 198 },
];
const SEATS = TABLES.flatMap((tb, i) => [
  { i: i * 2, x: tb.x - 17, y: tb.y - 1, faceRight: true },
  { i: i * 2 + 1, x: tb.x + 17, y: tb.y - 1, faceRight: false },
]);
const STRANGER: Pt = { x: 28, y: 206 };
const STRANGER_TABLE: Pt = { x: 28, y: 214 };
const NOTICE = 34; // the stranger's eyes narrow when you come this close

type Who = { kind: 'barley' } | { kind: 'patron'; i: number } | { kind: 'stranger' };
type Talk = { speaker: Speaker; script: Script; start: string; who: Who; key: number };

const facing = (dx: number, dy: number): Dir => (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

// The room is one big still picture: baked once into an image like the map grounds.
let roomBaked: Baked | null | undefined;
const roomImage = () => {
  if (roomBaked === undefined) {
    const g = roomGrid();
    const px = [];
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = g.c[y * g.w + x];
      if (c) px.push({ x, y, c });
    }
    roomBaked = bake(px, BAR_W, BAR_H);
  }
  return roomBaked;
};

const blocked = (x: number, y: number) => {
  if (x < 8 || x > BAR_W - 8) return true;
  if (y < BACK_WALL + 8) return true;
  if (y > BAR_H - 6 && !(x > BAR_DOOR.x0 + 4 && x < BAR_DOOR.x1 - 4)) return true;
  // Plain boxes with no nooks between them, so tapping past one never wedges you in a corner: the
  // counter, each pair of stools along it, and each table with its two regulars.
  if (x > COUNTER.x - 4 && x < COUNTER.x + COUNTER.w + 4 && y < COUNTER.y + COUNTER.h + 6) return true;
  if (y < STOOL_Y + 3 && ((x > STOOLS[0] - 5 && x < STOOLS[1] + 5) || (x > STOOLS[2] - 5 && x < STOOLS[3] + 5))) return true;
  for (const tb of TABLES) if (Math.abs(x - tb.x) < 24 && y > tb.y - 11 && y < tb.y + 3) return true;
  if (Math.abs(x - STRANGER.x) < 11 && y > STRANGER.y - 10 && y < STRANGER_TABLE.y + 3) return true;
  return false;
};

export type BarProps = {
  player: Hero;
  coins: number;
  itemCount: number;
  packBump: number;
  packFull: number;
  onOpenPack: () => void;
  covered: boolean;
  quests: Quest[];
  bartender: BartenderStage;
  firewood: number;
  metBarley: boolean;
  onBartender: (step: 'met' | 'accept' | 'handin') => void;
  onLeave: () => void;
};

export function BarScreen(props: BarProps) {
  const { player, coins, itemCount, packBump, packFull, onOpenPack, covered, quests, bartender, firewood, metBarley, onBartender, onLeave } = props;
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const s = box ? Math.max(2, Math.floor(box.w / 190)) : 2;
  const viewW = box ? box.w / s : 195;
  const viewH = box ? box.h / s : 420;
  // Keep the back wall clear of the coins panel and pack when the room fits below them.
  const hudPad = (insets.top + 64 + 52) / s;
  const viewRef = useRef({ w: viewW, h: viewH, pad: hudPad });
  viewRef.current = { w: viewW, h: viewH, pad: hudPad };

  const [, force] = useReducer((x: number) => x + 1, 0);
  const [talk, setTalk] = useState<Talk | null>(null);
  const talkRef = useRef(false);
  talkRef.current = !!talk;
  const [pops, setPops] = useState<Pop[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setHint((h) => h ?? (bartender === 'new' ? 'Tap someone to talk. Walk out the door to leave.' : null)), 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const coveredRef = useRef(covered);
  coveredRef.current = covered;

  const hero = useRef({ x: ENTRY.x, y: ENTRY.y, dir: 'up' as Dir, frame: 0, walkMs: 0 });
  // path: the rest of a tapped route round the furniture (to is its next waypoint).
  const goal = useRef<{ to: Pt | null; holding: boolean; who: Who | null; downAt: number; path?: Pt[] }>({ to: null, holding: false, who: null, downAt: 0 });
  const finger = useRef<Pt | null>(null);
  const tapAt = useRef<{ x: number; y: number; ms: number } | null>(null);
  // Each regular takes a sip now and then; the stranger watches you when you come close.
  const sips = useRef(SEATS.map(() => ({ up: false, t: rand(800, 5000) })));
  const eyes = useRef(0);

  const heroX = useSharedValue(ENTRY.x);
  const heroY = useSharedValue(ENTRY.y);
  const camX = useSharedValue(0);
  const camY = useSharedValue(0);
  const polish = useSharedValue(0);
  const flicker = useSharedValue(0);

  const popId = useRef(0);
  const pop = useCallback((text: string, color: string, wx: number, wy: number, extra?: Partial<Pop>) => {
    popId.current += 1;
    setPops((ps) => [...ps, { id: popId.current, text, color, x: wx - camX.value, y: wy - camY.value, ...extra }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dropPop = useCallback((id: number) => setPops((ps) => ps.filter((p) => p.id !== id)), []);

  // ---------- Talking ----------
  const where = (who: Who): Pt => (who.kind === 'barley' ? BARLEY : who.kind === 'stranger' ? STRANGER : SEATS[who.i]);
  const talkTo = (who: Who) => {
    const h = hero.current;
    const at = where(who);
    h.dir = facing(at.x - h.x, at.y - h.y);
    h.frame = 0;
    goal.current = { to: null, holding: false, who: null, downAt: 0 };
    setHint(null);
    let next: Omit<Talk, 'key' | 'who'>;
    if (who.kind === 'barley') {
      const start = bartender === 'done' ? 'done' : bartender === 'quest' ? (firewood >= FIREWOOD_NEED ? 'ready' : 'quest') : metBarley ? 'ask' : 'hi';
      next = { speaker: { ...BARTENDER_SPEAKER, name: metBarley || bartender !== 'new' ? 'Barley' : BARTENDER_SPEAKER.name }, script: bartenderScript(firewood), start };
    } else if (who.kind === 'stranger') {
      next = { speaker: STRANGER_SPEAKER, script: STRANGER_SCRIPT, start: 'hi' };
    } else {
      const seat = SEATS[who.i];
      // They put the mug down to talk.
      sips.current[who.i] = { up: false, t: 4000 };
      const script = PATRON_SCRIPTS[seat.i];
      next = { speaker: patronSpeaker(seat.i), script, start: bartender === 'done' && script.warm ? 'warm' : 'hi' };
    }
    setTalk({ ...next, who, key: Date.now() });
    force();
  };
  const endTalk = (end?: string) => {
    setTalk(null);
    if (end === 'accept') {
      onBartender('met');
      onBartender('accept');
      haptic('success');
      setTimeout(() => setHint(`Quest: split ${FIREWOOD_NEED} logs on the chopping block out back, round the bar's right side.`), 300);
    } else if (end === 'decline') {
      onBartender('met');
    } else if (end === 'handin') {
      onBartender('handin');
      haptic('success');
      pop(`+${FIREWOOD_REWARD}`, colors.butter, BARLEY.x, BARLEY.y - 30, { sub: 'COINS' });
    }
    force();
  };
  const arriveRef = useRef(talkTo);
  arriveRef.current = talkTo;

  // ---------- The loop ----------
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let left = false;
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
      if (tapAt.current) {
        tapAt.current.ms -= dt;
        if (tapAt.current.ms <= 0) {
          tapAt.current = null;
          repaint = true;
        }
      }
      if (!talkRef.current) {
        if (g.holding && finger.current) g.to = { x: camX.value + finger.current.x, y: camY.value + finger.current.y };
        let moving = false;
        if (g.to && g.path && g.path.length > 1 && Math.hypot(g.to.x - h.x, g.to.y - h.y) < 2) {
          g.path.shift();
          g.to = g.path[0];
        }
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
            } else if (Math.abs(nx - h.x) > 0.01 && !blocked(nx, h.y)) {
              // Slide along whatever's in the way (but going nowhere isn't walking).
              h.x = nx;
              moving = true;
            } else if (Math.abs(ny - h.y) > 0.01 && !blocked(h.x, ny)) {
              h.y = ny;
              moving = true;
            }
            const dir = facing(dx, dy);
            if (dir !== h.dir) {
              h.dir = dir;
              repaint = true;
            }
          }
          if (g.who && (dist < 3 || !moving) && !(g.path && g.path.length > 1)) {
            const who = g.who;
            g.who = null;
            g.to = null;
            moving = false;
            const at = where(who);
            if (Math.hypot(at.x - h.x, at.y - h.y) < (who.kind === 'barley' ? 28 : 24)) arriveRef.current(who);
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
        // Out the door.
        if (h.y > BAR_H - 3 && !left) {
          left = true;
          g.to = null;
          g.holding = false;
          onLeave();
        }
      }

      // The regulars sip; the stranger's eyes narrow when you come near.
      if (!reduceMotion) {
        sips.current.forEach((sp) => {
          sp.t -= dt;
          if (sp.t > 0) return;
          sp.up = !sp.up;
          sp.t = sp.up ? rand(600, 900) : rand(2500, 7000);
          repaint = true;
        });
      }
      const near = Math.hypot(h.x - STRANGER.x, h.y - STRANGER.y) < NOTICE ? 1 : 0;
      if (near !== eyes.current) {
        eyes.current = near;
        repaint = true;
      }
      put(polish, reduceMotion ? 0 : Math.floor(now / 500) % 2);
      put(flicker, reduceMotion ? 0 : Math.floor(now / 125) % FIRE_FRAMES);
      put(heroX, h.x);
      put(heroY, h.y);
      // The room sits still in the middle when it fits, and follows you when it doesn't.
      const v = viewRef.current;
      const cx = BAR_W <= v.w ? -Math.round((v.w - BAR_W) / 2) : Math.round(Math.max(0, Math.min(BAR_W - v.w, h.x - v.w / 2)));
      const top = Math.max((v.h - BAR_H) / 2, Math.min(v.pad, v.h - BAR_H));
      const cy = BAR_H <= v.h ? -Math.round(top) : Math.round(Math.max(0, Math.min(BAR_H - v.h, h.y - v.h / 2)));
      put(camX, cx);
      put(camY, cy);
      if (repaint) force();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // ---------- Touch ----------
  const toScreen = (e: GestureResponderEvent) => ({ x: e.nativeEvent.locationX / s, y: e.nativeEvent.locationY / s });
  const toWorld = (e: GestureResponderEvent) => {
    const q = toScreen(e);
    return { x: camX.value + q.x, y: camY.value + q.y };
  };
  // Where to stand to talk to a regular: in front of them, or on their outer side.
  const spotFor = (who: Who): Pt | null => {
    if (who.kind === 'barley') return BARLEY_SPOT;
    const h = hero.current;
    const at = where(who);
    const out = who.kind === 'patron' ? (SEATS[who.i].faceRight ? -1 : 1) : 1;
    const spots = (who.kind === 'stranger' ? [{ x: STRANGER.x, y: STRANGER_TABLE.y + 10 }, { x: STRANGER.x + 16, y: STRANGER.y + 2 }] : [{ x: at.x, y: at.y + 10 }, { x: at.x + out * 13, y: at.y + 1 }]).filter(
      (q) => !blocked(q.x, q.y),
    );
    spots.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
    return spots[0] ?? null;
  };
  const hitWho = (p: Pt): Who | null => {
    const hit = (at: Pt, w = 9, top = 20) => Math.abs(p.x - at.x) < w && p.y > at.y - top && p.y < at.y + 4;
    if (hit(BARLEY, 11, 24) || (p.y < COUNTER.y + COUNTER.h && Math.abs(p.x - BARLEY.x) < 14 && p.y > BARLEY.y - 24)) return { kind: 'barley' };
    if (hit(STRANGER, 10, 22)) return { kind: 'stranger' };
    const seat = SEATS.findIndex((st) => hit(st, 8, 20));
    return seat >= 0 ? { kind: 'patron', i: seat } : null;
  };
  const onGrant = (e: GestureResponderEvent) => {
    if (talkRef.current) return;
    setHint(null);
    const p = toWorld(e);
    const h = hero.current;
    const downAt = Date.now();
    const who = hitWho(p);
    if (who) {
      const spot = spotFor(who);
      if (spot) {
        tapAt.current = { x: spot.x, y: spot.y, ms: 600 };
        if (Math.hypot(spot.x - h.x, spot.y - h.y) < 4) return talkTo(who);
        const path = route(h, spot, blocked, BAR_W, BAR_H) ?? [spot];
        goal.current = { to: path[0], holding: false, who, downAt, path };
        force();
        return;
      }
    }
    finger.current = toScreen(e);
    goal.current = { to: p, holding: true, who: null, downAt };
  };
  const onMove = (e: GestureResponderEvent) => {
    const g = goal.current;
    if (!g.holding || talkRef.current) return;
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
  const talkingTo = talk?.who;
  type Item = { y: number; key: string; node: ReactNode };
  const items: Item[] = [];
  items.push({ y: BARLEY.y, key: 'barley', node: <Barley key="barley" beat={polish} still={talkingTo?.kind === 'barley'} s={s} /> });
  items.push({ y: COUNTER.y + COUNTER.h - 2, key: 'counter', node: <Static key="counter" pic={counterPicture(s)} x={COUNTER.x} y={COUNTER.y} s={s} /> });
  for (const sx of STOOLS) items.push({ y: STOOL_Y, key: `stool${sx}`, node: <Static key={`stool${sx}`} pic={stoolPicture(s)} x={sx - 5} y={STOOL_Y - 8} s={s} /> });
  TABLES.forEach((tb, i) => items.push({ y: tb.y, key: `table${i}`, node: <Static key={`table${i}`} pic={tablePicture(false, s)} x={tb.x - 15} y={tb.y - 18} s={s} /> }));
  SEATS.forEach((st, k) => {
    const sip = sips.current[k].up && !(talkingTo?.kind === 'patron' && talkingTo.i === k);
    items.push({ y: st.y, key: `seat${k}`, node: <Static key={`seat${k}`} pic={patronPicture(st.i, st.faceRight, sip ? 1 : 0, s)} x={st.x - NPC_W / 2} y={st.y - 18} s={s} /> });
  });
  items.push({ y: STRANGER.y, key: 'stranger', node: <Static key="stranger" pic={strangerPicture(eyes.current, s)} x={STRANGER.x - NPC_W / 2} y={STRANGER.y - NPC_H + 3} s={s} /> });
  items.push({ y: STRANGER_TABLE.y, key: 'stable', node: <Static key="stable" pic={tablePicture(true, s)} x={STRANGER_TABLE.x - 10} y={STRANGER_TABLE.y - 18} s={s} /> });
  items.push({ y: h.y, key: 'hero', node: <Mover key="hero" pic={heroOwPicture(h.dir, h.frame, player.look, s)} x={heroX} y={heroY} w={HERO_OW_W} h={HERO_OW_H} s={s} shadow /> });
  items.sort((a, b) => a.y - b.y);

  const room = roomImage();
  const worldT = useDerivedValue(() => [{ translateX: -camX.value * s }, { translateY: -camY.value * s }]);
  const tap = tapAt.current;

  return (
    <View style={StyleSheet.absoluteFill}>
      <View
        style={st.box}
        onLayout={(e: LayoutChangeEvent) => {
          const w = Math.round(e.nativeEvent.layout.width);
          const hh = Math.round(e.nativeEvent.layout.height);
          setBox((b) => (b && b.w === w && b.h === hh ? b : { w, h: hh }));
        }}
        onStartShouldSetResponder={() => !talkRef.current}
        onMoveShouldSetResponder={() => !talkRef.current}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}
      >
        {box ? (
          <Canvas style={{ width: box.w, height: box.h }}>
            <Group transform={worldT}>
              {room ? <BakedImage baked={room} s={s} /> : null}
              <Fire beat={flicker} low={bartender !== 'done'} s={s} />
              {tap ? <Static pic={tapRingPicture(s)} x={tap.x - 10} y={tap.y - 5} s={s} /> : null}
              {items.map((it) => it.node)}
            </Group>
          </Canvas>
        ) : null}
        {box ? pops.map((p) => <PopText key={p.id} pop={p} s={s} onDone={dropPop} />) : null}

        <View style={[st.hud, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Framed depth={1}>
            <View style={st.hudPanel}>
              <Text style={t.statSoft}>THE BAR</Text>
              <CoinCounter coins={coins} />
            </View>
          </Framed>
        </View>
        <View style={[st.pack, { top: insets.top + 64 }]} pointerEvents="box-none">
          <PackButton count={itemCount} bump={packBump} full={packFull} onPress={onOpenPack} />
        </View>
        {quests.length ? (
          <View style={[st.quests, { top: insets.top + 8 }]} pointerEvents="box-none">
            <QuestLog quests={quests} />
          </View>
        ) : null}
      </View>

      {!talk && hint ? (
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

// Barley polishing a mug behind the counter. He stops to talk.
function Barley({ beat, still, s }: { beat: SharedValue<number>; still: boolean; s: number }) {
  const frames = useMemo(() => [bartenderPicture(0, s), bartenderPicture(1, s)], [s]);
  const pic = useDerivedValue(() => frames[still ? 0 : beat.value]);
  return (
    <Group transform={[{ translateX: (BARLEY.x - NPC_W / 2) * s }, { translateY: (BARLEY.y - NPC_H + 3) * s }]}>
      <Picture picture={pic} />
    </Group>
  );
}

// The hearth: embers until you've split Barley's firewood, then a roaring fire.
function Fire({ beat, low, s }: { beat: SharedValue<number>; low: boolean; s: number }) {
  const frames = useMemo(() => Array.from({ length: FIRE_FRAMES }, (_, f) => firePicture(f, low, s)), [low, s]);
  const pic = useDerivedValue(() => frames[beat.value]);
  return (
    <Group transform={[{ translateX: FIRE.x * s }, { translateY: FIRE.y * s }]}>
      <Picture picture={pic} />
    </Group>
  );
}

const st = StyleSheet.create({
  box: { flex: 1, overflow: 'hidden', backgroundColor: colors.ink },
  hud: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  hudPanel: { paddingHorizontal: 10, paddingVertical: 6, gap: 4 },
  toast: { position: 'absolute', left: 12, right: 12 },
  pack: { position: 'absolute', left: 12 },
  quests: { position: 'absolute', right: 12 },
  toastText: { fontSize: 14, lineHeight: 19, paddingHorizontal: 12, paddingVertical: 8, textAlign: 'center' },
});
