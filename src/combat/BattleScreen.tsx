import { Canvas, Picture } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type HostInstance, type LayoutChangeEvent } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { foePortrait, type FoePose, type HeroPose } from '../sprites/characters';
import { DEFAULT_LOOK, heroBattle, heroFace, PARTY_LOOKS, type HeroClass, type HeroLook } from '../sprites/hero';
import type { Hero } from '../net/useHero';
import { merchantFace } from '../sprites/merchant';
import { fxPicture, gridPicture } from '../sprites/render';
import { boltFx, burstFx, EMBER_C, emberGrid, lanceFx, motesFx, type FxGrid, type Pt } from '../sprites/spells';
import { colors } from '../theme';
import { Chip, Framed, haptic, PixelButton, PixelIcon, SegBar, styles as t } from '../ui/pixel';
import { FOE, HERO, MAGE, TICK, type Frames } from './anims';
import {
  BattleScene,
  foeFrame,
  G_HIDDEN,
  G_LIT,
  G_LIVE,
  G_MISSED,
  G_NEXT,
  GLYPH_MAX,
  heroFrame,
  type Actor,
  type FxItem,
  type GlyphFx,
  type RuneFx,
} from './BattleScene';
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
  ECHO_DEFENSE,
  ECHO_SPELL,
  ECHO_STRIKE,
  echoGrade,
  ENEMY_HIT,
  FINISHER_BREAK,
  FINISHER_DAMAGE,
  FLEE_CHANCE,
  FOE_MAX_HP,
  GRADE_BREAK,
  GRADE_MULT,
  hitOn,
  maxHpOf,
  MOVES,
  NPC_STRIKE,
  PATTERNS,
  powerMult,
  rand,
  SHATTER_BREAK,
  SHATTER_DAMAGE,
  SPELLS,
  statsOf,
  tameChance,
  type Grade,
  type Move,
  type Spell,
  type Stats,
} from './rules';
import { useCombatInput } from './useCombatInput';

type Phase = 'menu' | 'moves' | 'tame' | 'flee' | 'acting' | 'won' | 'lost' | 'tamed' | 'fled';

// Battle state lives in a ref and is mutated by the async combat sequences; force() repaints.
// pose === null means "breathe with the shared idle beat".
// npc: an ally the game controls, drawn with foe-style art facing right (Puul the merchant). Its
// frames go in fpose; pose is ignored for it.
type HeroState = { name: string; look: HeroLook; stats: Stats; maxHp: number; hp: number; pose: HeroPose | null; z?: number; npc?: 'merchant'; fpose?: FoePose | null };
type FoeState = { name: string; look: number; kind?: FoePose['kind']; maxHp: number; hp: number; brk: number; broken: boolean; out: null | 'down' | 'tamed' | 'fled'; pose: FoePose | null; z?: number };
type Game = { heroes: HeroState[]; foes: FoeState[] };

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
// A hero's body stops this many art pixels short of the target's body when it dashes in.
const MELEE_REACH = 28;
// An enemy's body stops this far in front of its target's body when it lunges.
const FOE_REACH = 36;
// The command dock keeps one height in every phase, so the scene never jumps.
const PANEL_H = 214;
// Glyphs are hit-tested within this many points of their centre (DESIGN.md asks 56 pt targets).
const GLYPH_RADIUS = 40;
// The orb's glow and its effects take each spell's colour (palette keys).
const SPELL_GLOW: Record<Spell['fx'], string> = { ember: 'G', frost: 'Y', arc: 'B', mend: 'M' };
// A warrior swings moves with strike runes; a mage casts spells with glyph chains.
type Action = Move | Spell;
const isSpell = (a: Action): a is Spell => 'glyphs' in a;

const HERO_NAMES = ['You', 'Mint Ranger', 'Gold Warden', 'Sky Mage'];
const FOE_NAMES = ['Mossback Shroomie', 'Lilac Shroomie', 'Gilded Shroomie'];

// dizzy: the boar charged past you on the map and opens the fight Broken.
// pack: a group fight, one foe of this kind per name. ally: an NPC who fights beside you (its name).
// intro, won and fled replace the battle's usual lines.
export type Encounter = {
  look: number;
  name: string;
  kind?: FoePose['kind'];
  dizzy?: boolean;
  pack?: string[];
  ally?: string;
  intro?: string;
  won?: string;
  fled?: string;
};
// Puul in battle: a sturdy traveller, slower than you, so he swings after your move.
const MERCHANT_STATS: Stats = { hp: 6, str: 5, def: 5, mag: 1, spd: 3 };
// "the Mint Ranger", but a named NPC goes by his name alone.
const called = (h: { name: string; npc?: string }) => (h.npc ? h.name : `the ${h.name}`);
// A boar is a quick hunt: less health than a Shroomie, and it can't be tamed.
const BOAR_MAX_HP = 80;

// Lines that change with who you're fighting: a toadstool and its club, or the old butcher.
function foeCopy(kind: FoePose['kind']) {
  if (kind === 'boar')
    return {
      intro: (name: string) => `A ${name} snorts and lowers its tusks.`,
      tell: (name: string) => `The ${name} paws the ground!`,
      win: 'The boar slumps over. Victory!',
      broken: 'The boar is Broken! It staggers, dizzy. Hit it hard.',
      steady: 'The boar shakes its head and snorts. Your turn.',
      block: 'The boar blocks your way!',
      lost: 'The boar wins this round. Parry as the tusks reach your blade.',
    };
  return kind === 'butcher'
    ? {
        intro: (name: string) => `The ${name} raises his cleaver. He won't back down.`,
        tell: (name: string) => `The ${name} raises his cleaver at you!`,
        win: 'The old man drops to one knee, out of breath. Victory!',
        broken: 'The old man is Broken! Hit him hard while he reels.',
        steady: 'The old man steadies himself. Your turn.',
        block: 'The old man blocks your way!',
        lost: 'The old man wins this round. Watch his cleaver come up before you tap.',
      }
    : {
        intro: (name: string) => `A ${name} blocks the path. It grips its club and sways.`,
        tell: (name: string) => `The ${name} raises its club at you!`,
        win: 'The last Shroomie flops over. Victory!',
        broken: 'A Shroomie is Broken! Hit it hard, or try to tame it.',
        steady: 'The Shroomies steady themselves. Your turn.',
        block: 'The Shroomies block your way!',
        lost: 'The Shroomies win this round. Try reading the wind-up before you tap.',
      };
}
export type BattleResult = 'won' | 'lost' | 'tamed' | 'fled';
// perfect: the finishing hit was graded Perfect (a boar then drops two meat).
export type BattleInfo = { perfect: boolean };

function newGame(full: boolean, encounter?: Encounter, you?: Hero): Game {
  const heroes = (full ? [0, 1, 2, 3] : [0]).map((i) => {
    const look = i === 0 ? (you?.look ?? DEFAULT_LOOK) : PARTY_LOOKS[i];
    const stats = statsOf(look.cls);
    const maxHp = maxHpOf(stats);
    return { name: HERO_NAMES[i], look, stats, maxHp, hp: maxHp, pose: null } as HeroState;
  });
  if (encounter?.ally && !full) {
    const maxHp = maxHpOf(MERCHANT_STATS);
    heroes.push({ name: encounter.ally, look: DEFAULT_LOOK, stats: MERCHANT_STATS, maxHp, hp: maxHp, pose: null, npc: 'merchant', fpose: null });
  }
  const foes: FoeState[] = (full ? [0, 1, 2] : [0]).map((j) => ({ name: FOE_NAMES[j], look: j, maxHp: FOE_MAX_HP, hp: FOE_MAX_HP, brk: 0, broken: false, out: null, pose: null }));
  if (encounter?.pack && !full) {
    const maxHp = encounter.kind === 'boar' ? BOAR_MAX_HP : FOE_MAX_HP;
    return { heroes, foes: encounter.pack.map((name) => ({ name, look: encounter.look, kind: encounter.kind, maxHp, hp: maxHp, brk: 0, broken: false, out: null, pose: null })) };
  }
  if (encounter && !full) {
    const { dizzy, pack: _p, ally: _a, intro: _i, won: _w, fled: _f, ...who } = encounter;
    Object.assign(foes[0], who);
    if (encounter.kind === 'boar') foes[0].maxHp = foes[0].hp = BOAR_MAX_HP;
    if (dizzy) {
      foes[0].broken = true;
      foes[0].brk = BREAK_MAX;
    }
  }
  return { heroes, foes };
}

const active = (g: Game) => g.foes.map((f, j) => (f.out ? -1 : j)).filter((j) => j >= 0);
const standing = (g: Game) => g.heroes.map((h, i) => (h.hp > 0 ? i : -1)).filter((i) => i >= 0);
// SPD decides who acts first in a group round. Allies quicker than you act before your move;
// on a tie you go first. Faster first within each group.
const bySpeed = (g: Game) => (a: number, b: number) => g.heroes[b].stats.spd - g.heroes[a].stats.spd;
const quicker = (g: Game) => standing(g).filter((i) => i > 0 && g.heroes[i].stats.spd > g.heroes[0].stats.spd).sort(bySpeed(g));
// The party member Mend goes to: the lowest share of HP left, you on a tie.
const mostHurt = (g: Game) =>
  standing(g).reduce((best, i) => (g.heroes[i].hp / g.heroes[i].maxHp < g.heroes[best].hp / g.heroes[best].maxHp ? i : best), standing(g)[0] ?? 0);

// encounter: a fight started on the base map against one Shroomie or the butcher; onDone hands the result back.
// Without an encounter it is the practice arena, with the SOLO / PARTY 4 toggle and onExit.
export function BattleScreen({ encounter, you, onDone, onExit }: { encounter?: Encounter; you?: Hero; onDone?: (r: BattleResult, info: BattleInfo) => void; onExit?: () => void } = {}) {
  const insets = useSafeAreaInsets();

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [full, setFull] = useState(false);
  // A group encounter (a pack, or an ally beside you) uses the wide party camera.
  const wide = full || !!encounter?.pack || !!encounter?.ally;
  const field = useMemo(() => (box ? fieldLayout(box.w, box.h, wide) : null), [box, wide]);
  const fieldRef = useRef<Field | null>(field);
  fieldRef.current = field;

  // The practice arena can swap your class to try both: your look, the other class's gear.
  const [cls, setCls] = useState<HeroClass | null>(null);
  const youAs = (c: HeroClass | null): Hero | undefined => (c ? { name: you?.name ?? 'You', look: { ...(you?.look ?? DEFAULT_LOOK), cls: c } } : you);
  const game = useRef<Game>(newGame(false, encounter, you));
  const [, force] = useReducer((x: number) => x + 1, 0);

  const [phase, setPhase] = useState<Phase>('menu');
  const [guarding, setGuarding] = useState(false);
  const [cheer, setCheer] = useState(false);
  const [beat, setBeat] = useState(0);
  const [target, setTarget] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [ap, setAp] = useState(AP_START);
  const [chain, setChain] = useState(0);
  const [hint, setHint] = useState('');
  const kind = encounter?.kind ?? 'shroomie';
  const copy = foeCopy(kind);
  const [line, setLine] = useState(encounter?.intro ? encounter.intro : encounter?.dizzy ? `The ${encounter.name} skidded past you and is dizzy. Strike now!` : copy.intro(encounter?.name ?? 'Mossback Shroomie'));
  const [pops, setPops] = useState<Pop[]>([]);
  const [sel, setSel] = useState(0);
  const [treat, setTreat] = useState(false);
  const [treats, setTreats] = useState(3);
  const [tamed, setTamed] = useState(0);
  const [assist, setAssist] = useState(false);

  const alive = useRef(true);
  useEffect(() => () => {
    alive.current = false;
  }, []);

  // Offsets from each slot, in art pixels: dashes, lunges and the flee run.
  const hdx = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const hdy = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const fdx = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const fdy = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
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
  const glyphs: GlyphFx = {
    x: [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)],
    y: [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)],
    state: [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)],
    ring: useSharedValue(16),
    ringX: useSharedValue(0),
    ringY: useSharedValue(0),
    ringOn: useSharedValue(0),
  };
  const clearGlyphs = () => {
    glyphs.ringOn.value = 0;
    glyphs.state.forEach((v) => {
      v.value = G_HIDDEN;
    });
  };
  // Spell effects: frames placed in the field, and one projectile offset that flies at 60 fps.
  const [fx, setFx] = useState<FxItem[]>([]);
  const shotDx = useSharedValue(0);
  const shotDy = useSharedValue(0);
  const fxId = useRef(0);
  const showFx = useCallback((f: FxGrid, moving = false) => {
    const s = fieldRef.current?.s ?? 1;
    fxId.current += 1;
    const item: FxItem = { key: `fx${fxId.current}`, pic: fxPicture(f.grid, s), x: f.x, y: f.y, ...(moving ? { dx: shotDx, dy: shotDy } : null) };
    setFx((xs) => [...xs, item]);
    return item.key;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dropFx = useCallback((key?: string) => setFx((xs) => (key ? xs.filter((x) => x.key !== key) : [])), []);

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
      const w = Math.round(e.nativeEvent.layout.width);
      const h = Math.round(e.nativeEvent.layout.height);
      setBox((b) => (b && b.w === w && b.h === h ? b : { w, h }));
      measureScene();
    },
    [measureScene],
  );
  const { gesture, armRune, armDefend, disarm } = useCombatInput(assist);

  // One shared beat keeps everyone who isn't mid-action breathing.
  useEffect(() => {
    const id = setInterval(() => setBeat((b) => (b + 1) % 4), TICK * 3);
    return () => clearInterval(id);
  }, []);

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

  const setHeroPose = useCallback((i: number, pose: HeroPose | null) => {
    game.current.heroes[i].pose = pose;
    force();
  }, []);
  const setFoePose = useCallback((j: number, pose: FoePose | null) => {
    game.current.foes[j].pose = pose;
    force();
  }, []);
  const playHero = useCallback(
    async (i: number, frames: Frames<HeroPose>) => {
      for (const [ticks, pose] of frames) {
        if (!alive.current) return;
        setHeroPose(i, pose);
        await wait(ticks * TICK);
      }
    },
    [setHeroPose],
  );
  // An NPC ally's frames: the foe pose tables, drawn mirrored on the heroes' side.
  const setAllyPose = useCallback((i: number, pose: FoePose | null) => {
    game.current.heroes[i].fpose = pose;
    force();
  }, []);
  const playAlly = useCallback(
    async (i: number, frames: Frames<FoePose>) => {
      for (const [ticks, pose] of frames) {
        if (!alive.current) return;
        setAllyPose(i, pose);
        await wait(ticks * TICK);
      }
    },
    [setAllyPose],
  );
  const playFoe = useCallback(
    async (j: number, frames: Frames<FoePose>) => {
      for (const [ticks, pose] of frames) {
        if (!alive.current) return;
        setFoePose(j, pose);
        await wait(ticks * TICK);
      }
    },
    [setFoePose],
  );

  // Positions in art pixels, read from the live field so async sequences survive a resize.
  const geo = useCallback(() => {
    const f = fieldRef.current!;
    const hero = (i: number) => ({ x: f.heroes[i].x + hdx[i].value, y: f.heroes[i].y + hdy[i].value });
    const foe = (j: number) => ({ x: f.foes[j].x + fdx[j].value, y: f.foes[j].y + fdy[j].value });
    return {
      f,
      hero,
      foe,
      // Pop heights are authored for the storyboard; 0.7 keeps them just over the sprites' heads.
      above: (p: { y: number }, n: number) => p.y - Math.round(n * 0.7),
      // Offsets that put hero i's body MELEE_REACH short of foe j, on the foe's lane.
      dashTo: (i: number, j: number) => ({ dx: foe(j).x - MELEE_REACH - f.heroes[i].x, dy: foe(j).y - f.heroes[i].y }),
      lungeTo: (j: number, i: number) => ({ dx: hero(i).x + FOE_REACH - f.foes[j].x, dy: hero(i).y - f.foes[j].y }),
      toScreen: (ax: number, ay: number) => ({ x: sceneOrigin.current.x + ax * f.s, y: sceneOrigin.current.y + ay * f.s }),
    };
    // Shared values are stable for the component's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveHero = (i: number, to: { dx: number; dy: number }, duration: number, easing = Easing.out(Easing.cubic)) => {
    hdx[i].value = withTiming(to.dx, { duration, easing });
    hdy[i].value = withTiming(to.dy, { duration, easing });
  };
  const moveFoe = (j: number, to: { dx: number; dy: number }, duration: number, easing = Easing.out(Easing.quad)) => {
    fdx[j].value = withTiming(to.dx, { duration, easing });
    fdy[j].value = withTiming(to.dy, { duration, easing });
  };

  // Where hero i's staff orb is for a pose, in field art pixels.
  const orbAt = (i: number, pose: HeroPose): Pt => {
    const f = fieldRef.current!;
    const fr = heroFrame(f.heroes[i]);
    const tip = heroBattle(game.current.heroes[i].look, pose).tip;
    return { x: fr.x + hdx[i].value + tip.x, y: fr.y + hdy[i].value + tip.y };
  };
  // The middle of a foe's body, where spells land.
  const foeCore = (j: number): Pt => {
    const p = geo().foe(j);
    return { x: p.x - 2, y: p.y - 14 };
  };
  // Shows an effect frame for a while without holding up the sequence.
  const flashFx = (f: FxGrid, ms: number) => {
    const key = showFx(f);
    setTimeout(() => dropFx(key), ms);
  };

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

  // The grade of the hit being dealt right now, if it was your own timed strike or spell, so a
  // boar knows whether the finishing hit was Perfect.
  const lastGrade = useRef<Grade | null>(null);
  const finalPerfect = useRef(false);
  const dealDamage = useCallback((j: number, dmg: number, brkGain: number) => {
    const f = game.current.foes[j];
    const real = Math.round(dmg * (f.broken ? 1.5 : 1));
    f.hp = Math.max(0, f.hp - real);
    let justBroke = false;
    if (!f.broken) {
      f.brk = Math.min(BREAK_MAX, f.brk + brkGain);
      if (f.brk >= BREAK_MAX) {
        f.broken = true;
        justBroke = true;
      }
    }
    const dead = f.hp <= 0;
    if (dead) {
      finalPerfect.current = lastGrade.current === 'perfect';
      f.out = 'down';
      f.pose = null;
    }
    force();
    return { real, justBroke, dead };
  }, []);

  // A spell landing on foe j: the damage, a hit flash and the pops.
  const spellHit = (j: number, dmg: number, brk: number) => {
    const g = geo();
    const res = dealDamage(j, dmg, brk);
    if (!res.dead) setFoePose(j, FOE.hurt[0][1]);
    const fb = g.foe(j);
    pop(`-${res.real}`, colors.hpRose, fb.x + 6, g.above(fb, 38));
    if (res.justBroke) {
      pop('BREAK!', colors.rose, fb.x + 4, g.above(fb, 60), { big: true });
      haptic('heavy');
    }
    return res;
  };

  // The cast itself, after the wind-up: the one-tick thrust (or Mend's release) and the spell
  // travelling to `to`. Resolves on the tick it lands.
  const castAt = async (i: number, kind: Spell['fx'], to: Pt) => {
    const castPose = (kind === 'mend' ? MAGE.release : MAGE.cast)[0][1];
    const orb = orbAt(i, castPose);
    setHeroPose(i, castPose);
    if (kind === 'ember') {
      shotDx.value = 0;
      shotDy.value = 0;
      const key = showFx({ grid: emberGrid(), x: Math.round(orb.x) + 2 - EMBER_C.x, y: Math.round(orb.y) - EMBER_C.y }, true);
      shotDx.value = withTiming(to.x - orb.x - 2, { duration: TICK * 2, easing: Easing.in(Easing.quad) });
      shotDy.value = withTiming(to.y - orb.y, { duration: TICK * 2, easing: Easing.in(Easing.quad) });
      await wait(TICK);
      setHeroPose(i, MAGE.castHold);
      await wait(TICK);
      dropFx(key);
    } else if (kind === 'frost') {
      const key = showFx(lanceFx({ x: orb.x + 3, y: orb.y }, to));
      await wait(TICK);
      setHeroPose(i, MAGE.castHold);
      await wait(TICK);
      dropFx(key);
    } else if (kind === 'arc') {
      const key = showFx(boltFx(orb, to, 3));
      await wait(TICK);
      setHeroPose(i, MAGE.castHold);
      dropFx(key);
    } else {
      await wait(TICK);
    }
  };

  const hurtHero = useCallback((i: number, dmg: number) => {
    const h = game.current.heroes[i];
    h.hp = Math.max(0, h.hp - dmg);
    force();
    return h.hp <= 0;
  }, []);

  // Moves the selection off an enemy that is down or tamed.
  const retarget = useCallback(() => {
    const act = active(game.current);
    if (act.length) setTarget((tg) => (act.includes(tg) ? tg : act[0]));
  }, []);

  // ---------- One enemy attacks one hero ----------
  const foeAttack = useCallback(
    async (j: number, i: number) => {
      const g = geo();
      const g0 = game.current;
      setFocus(j);
      g0.foes[j].z = g.f.heroes[i].y + 0.5;
      const youAreTarget = i === 0;
      const pattern = youAreTarget ? pick(PATTERNS) : { feint: false, hits: 1 };
      if (youAreTarget) {
        setGuarding(true);
        setHint('Watch the wind-up. Tap to parry, swipe sideways to dodge.');
        setLine(pattern.feint ? `The ${g0.foes[j].name} sways oddly...` : copy.tell(g0.foes[j].name));
      } else {
        setHint('');
        setLine(`The ${g0.foes[j].name} goes for ${called(g0.heroes[i])}!`);
      }
      setHeroPose(i, HERO.guard);
      moveFoe(j, g.lungeTo(j, i), 280);
      await playFoe(j, [[3, { crouch: true }], [1, {}]]);

      let parried = 0;
      let wasted = false;
      for (let hit = 0; hit < pattern.hits; hit++) {
        if (!alive.current) return;
        const hp = g.hero(i);
        const at = { x: hp.x + 8, y: g.above(hp, 40) };

        if (!youAreTarget) {
          // An Echo defends on its own.
          await playFoe(j, FOE.windup);
          setFoePose(j, FOE.tellHold);
          await wait(rand(260, 520));
          setFoePose(j, FOE.swing[0][1]);
          await wait(TICK);
          setFoePose(j, FOE.impact);
          const r = Math.random();
          const npc = !!g0.heroes[i].npc;
          if (r < ECHO_DEFENSE.parry) {
            doShake(1);
            pop(npc ? 'BLOCK' : 'PARRY', colors.sky, at.x, at.y - 6);
            // Puul gets his stick up across the blow.
            if (npc) await playAlly(i, [[1, { ...FOE.tellHold, glint: false, spark: 2 }], [2, { ...FOE.tellHold, glint: false }]]);
            else await playHero(i, HERO.parry);
          } else if (r < ECHO_DEFENSE.parry + ECHO_DEFENSE.dodge) {
            pop('DODGE', colors.lavender, at.x, at.y - 6);
            if (npc) await playAlly(i, [[1, { x: 3, crouch: true, tilt: 1 }], [2, { x: 5, crouch: true }], [1, { x: 2 }]]);
            else await playHero(i, HERO.dodge.slice(0, 3));
          } else {
            doShake(2);
            const dmg = hitOn(ENEMY_HIT, g0.heroes[i].stats);
            const down = hurtHero(i, dmg);
            pop(`-${dmg}`, colors.hpRose, at.x, at.y);
            if (npc) await playAlly(i, FOE.hurt);
            else await playHero(i, HERO.hurt);
            if (down) pop('DOWN', colors.inkSoft, at.x, at.y - 12);
          }
          if (npc) setAllyPose(i, null);
          break;
        }

        const windTicks = hit === 0 ? 4 : 2;
        const hold = hit === 0 ? rand(380, 900) : rand(280, 520);
        const feintMs = pattern.feint && hit === 0 ? 3 * TICK + rand(250, 520) : 0;
        const verdictP = armDefend(windTicks * TICK + hold + feintMs);
        let early = false;
        verdictP.then((v) => {
          if (v.defense === 'early') {
            early = true;
            wasted = true;
            setHeroPose(0, HERO.early[0][1]);
            pop('TOO EARLY', colors.rose, at.x - 6, at.y - 8, { sub: v.dt != null ? `${Math.round(v.dt)} MS` : undefined });
          }
        });
        await playFoe(j, hit === 0 ? FOE.windup : FOE.rewind);
        setFoePose(j, FOE.tellHold);
        if (feintMs) {
          await wait(hold * 0.6);
          await playFoe(j, FOE.feint);
          setFoePose(j, FOE.tellHold);
          await wait(feintMs - 3 * TICK + hold * 0.4);
        } else {
          await wait(hold);
        }
        setFoePose(j, FOE.swing[0][1]);
        const v = await verdictP;
        setFoePose(j, FOE.impact);
        const sub = v.dt != null ? `${Math.round(v.dt)} MS` : undefined;
        if (v.defense === 'parry' && !early) {
          parried += 1;
          haptic('success');
          doShake(2);
          pop(parried > 1 ? `PARRY X${parried}` : 'PARRY', colors.sky, at.x, at.y - 6, { sub });
          gainAp(AP_PARRY, at.x, at.y - 18);
          await playHero(0, HERO.parry);
        } else if (v.defense === 'dodge' && !early) {
          pop('DODGE', colors.lavender, at.x, at.y - 6, { sub });
          await playHero(0, HERO.dodge.slice(0, 3));
          setHeroPose(0, HERO.dodge[4][1]);
        } else {
          haptic('warning');
          doShake(4);
          const dmg = hitOn(ENEMY_HIT, g0.heroes[0].stats);
          const down = hurtHero(0, dmg);
          pop(`-${dmg}`, colors.hpRose, at.x, at.y, { big: true });
          await playHero(0, HERO.hurt);
          if (down) break;
        }
        await playFoe(j, FOE.recover.slice(0, 1));
        setHeroPose(0, HERO.guard);
      }

      if (youAreTarget && g0.heroes[0].hp > 0 && parried === pattern.hits && !wasted) {
        setHint('Every hit parried: counter!');
        setLine('A perfect defense. You strike back!');
        g0.heroes[0].z = g.f.foes[j].y + 0.6;
        moveHero(0, g.dashTo(0, j), TICK * 2);
        const counter = playHero(0, HERO.counter);
        await wait(TICK * 2);
        haptic('heavy');
        const r = dealDamage(j, COUNTER_DAMAGE * powerMult(g0.heroes[0].stats.str), COUNTER_BREAK);
        await wait(TICK);
        if (!r.dead) setFoePose(j, FOE.hurt[0][1]);
        doShake(5);
        const fb = g.foe(j);
        pop('COUNTER', colors.butter, fb.x - 6, g.above(fb, 50), { big: true });
        pop(`-${r.real}`, colors.hpRose, fb.x + 4, g.above(fb, 36));
        if (r.justBroke) pop('BREAK!', colors.rose, fb.x + 8, g.above(fb, 56));
        await counter;
        moveHero(0, { dx: 0, dy: 0 }, 260);
        g0.heroes[0].z = undefined;
      }
      setGuarding(false);
      if (g0.heroes[i].hp > 0) setHeroPose(i, null);
      moveFoe(j, { dx: 0, dy: 0 }, 300, Easing.inOut(Easing.quad));
      if (!g0.foes[j].out) await playFoe(j, FOE.recover);
      setFoePose(j, null);
      g0.foes[j].z = undefined;
      setFocus(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [armDefend, dealDamage, doShake, gainAp, geo, hurtHero, playAlly, playFoe, playHero, pop, setAllyPose, setFoePose, setHeroPose],
  );

  // ---------- An Echo ally strikes ----------
  const allyAct = useCallback(
    async (i: number) => {
      const g = geo();
      const g0 = game.current;
      const targets = active(g0);
      if (!targets.length) return;
      const j = pick(targets);
      setFocus(j);
      setHint('');
      if (g0.heroes[i].npc) {
        // Puul steps in and brings his walking stick down: the butcher's swing, frame for frame.
        setLine(`${g0.heroes[i].name} swings his walking stick at the ${g0.foes[j].name}!`);
        g0.heroes[i].z = g.f.foes[j].y + 0.5;
        moveHero(i, g.dashTo(i, j), TICK * 3);
        await playAlly(i, [[2, { crouch: true }], [1, {}]]);
        await playAlly(i, FOE.windup);
        setAllyPose(i, FOE.tellHold);
        await wait(rand(200, 380));
        const grade: Grade = echoGrade();
        setAllyPose(i, FOE.swing[0][1]);
        await wait(TICK);
        setAllyPose(i, FOE.impact);
        const r = dealDamage(j, NPC_STRIKE.damage * GRADE_MULT[grade] * powerMult(g0.heroes[i].stats.str), NPC_STRIKE.brk * GRADE_BREAK[grade]);
        const fb = g.foe(j);
        if (!r.dead) setFoePose(j, FOE.hurt[0][1]);
        doShake(grade === 'perfect' ? 3 : 1);
        const label = grade === 'perfect' ? 'PERFECT' : grade === 'good' ? 'GOOD' : 'MISS';
        const tone = grade === 'perfect' ? colors.butter : grade === 'good' ? colors.mint : colors.lavender;
        pop(label, tone, fb.x - 12, g.above(fb, 52));
        pop(`-${r.real}`, colors.hpRose, fb.x + 6, g.above(fb, 38));
        if (r.justBroke) pop('BREAK!', colors.rose, fb.x + 4, g.above(fb, 60), { big: true });
        await wait(TICK * 2);
        if (!r.dead) void playFoe(j, FOE.hurt.slice(1));
        moveHero(i, { dx: 0, dy: 0 }, 300, Easing.inOut(Easing.quad));
        await playAlly(i, FOE.recover);
        setAllyPose(i, null);
        g0.heroes[i].z = undefined;
        setFoePose(j, null);
        setFocus(null);
        return;
      }
      if (g0.heroes[i].look.cls === 'mage') {
        // A mage Echo casts Frost Lance from where it stands, its glyphs rolled.
        setLine(`The ${g0.heroes[i].name} casts Frost Lance at the ${g0.foes[j].name}!`);
        await playHero(i, MAGE.windup(3, 'Y'));
        setHeroPose(i, MAGE.hold('Y'));
        await wait(rand(380, 640));
        const grades = Array.from({ length: ECHO_SPELL.glyphs }, () => echoGrade());
        const at = foeCore(j);
        await castAt(i, 'frost', at);
        const power = powerMult(g0.heroes[i].stats.mag);
        const r = spellHit(
          j,
          grades.reduce((a, gr) => a + ECHO_SPELL.damage * GRADE_MULT[gr], 0) * power,
          grades.reduce((a, gr) => a + ECHO_SPELL.brk * GRADE_BREAK[gr], 0),
        );
        flashFx(burstFx('frost', at), TICK * 3);
        const best: Grade = grades.includes('perfect') ? 'perfect' : grades.includes('good') ? 'good' : 'miss';
        const fb = g.foe(j);
        pop(best === 'perfect' ? 'PERFECT' : best === 'good' ? 'GOOD' : 'MISS', best === 'perfect' ? colors.butter : best === 'good' ? colors.mint : colors.lavender, fb.x - 12, g.above(fb, 52));
        if (best === 'perfect') doShake(2);
        await playHero(i, MAGE.recover);
        if (!r.dead) await playFoe(j, FOE.hurt.slice(1));
        setHeroPose(i, null);
        setFoePose(j, null);
        setFocus(null);
        return;
      }
      setLine(`The ${g0.heroes[i].name} strikes the ${g0.foes[j].name}!`);
      g0.heroes[i].z = g.f.foes[j].y + 0.5;
      await playHero(i, HERO.dash.slice(0, 1));
      moveHero(i, g.dashTo(i, j), TICK * 2);
      await playHero(i, HERO.dash.slice(1));
      await playHero(i, HERO.coil);
      for (let k = 0; k < ECHO_STRIKE.hits; k++) {
        if (!alive.current || g0.foes[j].out) break;
        const grade: Grade = echoGrade();
        const slash = playHero(i, grade === 'miss' ? HERO.weakSlash : HERO.slash);
        await wait(TICK);
        const r = dealDamage(j, ECHO_STRIKE.damage * GRADE_MULT[grade] * powerMult(g0.heroes[i].stats.str), ECHO_STRIKE.brk * GRADE_BREAK[grade]);
        const fb = g.foe(j);
        if (!r.dead) setFoePose(j, FOE.hurt[0][1]);
        if (grade === 'perfect') doShake(2);
        const label = grade === 'perfect' ? 'PERFECT' : grade === 'good' ? 'GOOD' : 'MISS';
        const tone = grade === 'perfect' ? colors.butter : grade === 'good' ? colors.mint : colors.lavender;
        pop(label, tone, fb.x - 12, g.above(fb, 52));
        pop(`-${r.real}`, colors.hpRose, fb.x + 6, g.above(fb, 38));
        if (r.justBroke) pop('BREAK!', colors.rose, fb.x + 4, g.above(fb, 60), { big: true });
        await slash;
        if (!r.dead) await playFoe(j, FOE.hurt.slice(1));
        await wait(rand(90, 200));
      }
      moveHero(i, { dx: 0, dy: 0 }, 260, Easing.inOut(Easing.quad));
      await playHero(i, HERO.back);
      setHeroPose(i, null);
      g0.heroes[i].z = undefined;
      setFoePose(j, null);
      setFocus(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dealDamage, doShake, geo, playAlly, playFoe, playHero, pop, setAllyPose, setFoePose, setHeroPose],
  );

  const tamedRef = useRef(0);

  const finish = useCallback((result: 'won' | 'tamed') => {
    setCheer(true);
    setFocus(null);
    setLine(result === 'tamed' ? 'The Shroomie wants to come home with you!' : encounter?.pack ? 'The last one goes down. Victory!' : copy.win);
    setPhase(result);
    haptic('success');
  }, []);

  // ---------- The rest of the round: allies, then every enemy ----------
  // acted: allies who already went this round because they are quicker than you.
  const restOfRound = useCallback(async (acted: number[] = []) => {
    const g0 = game.current;
    const done = () => finish('won');
    retarget();
    const order = standing(g0)
      .filter((i) => i > 0 && !acted.includes(i))
      .sort(bySpeed(g0));
    for (const i of order) {
      if (!alive.current) return;
      if (!active(g0).length) break;
      if (g0.heroes[i].hp <= 0) continue;
      await allyAct(i);
      retarget();
    }
    if (!active(g0).length) {
      done();
      return;
    }

    for (const j of active(g0)) {
      if (!alive.current) return;
      const f = g0.foes[j];
      if (f.broken) {
        const g = geo();
        setFocus(j);
        setHint('');
        setLine(`The ${f.name} is Broken and loses its turn.`);
        const p = g.foe(j);
        pop('STUNNED', colors.rose, p.x, g.above(p, 44));
        await playFoe(j, FOE.stagger);
        f.broken = false;
        f.brk = 0;
        setFoePose(j, null);
        setFocus(null);
        continue;
      }
      const targets = standing(g0);
      if (!targets.length) break;
      await foeAttack(j, pick(targets));
      if (g0.heroes[0].hp <= 0) break;
    }

    if (!alive.current) return;
    if (g0.heroes[0].hp <= 0) {
      setHeroPose(0, HERO.down);
      setLine('Your party rests... and tries again.');
      setPhase('lost');
      return;
    }
    if (!active(g0).length) {
      done();
      return;
    }
    retarget();
    setHint('');
    const anyBroken = active(g0).some((j) => g0.foes[j].broken);
    setLine(anyBroken ? copy.broken : copy.steady);
    setPhase('menu');
  }, [allyAct, finish, foeAttack, geo, playFoe, pop, retarget, setFoePose, setHeroPose]);

  // ---------- Your turn: a move with strike runes ----------
  const runMove = useCallback(
    async (move: Move, j: number) => {
      measureScene();
      const g = geo();
      const g0 = game.current;
      setPhase('acting');
      setFocus(j);
      setAp((a) => Math.min(AP_MAX, a - move.cost));
      setLine(`You use ${move.name}!`);
      setHint('Tap the rune as the ring closes on it.');
      setChain(0);

      g0.heroes[0].z = g.f.foes[j].y + 0.5;
      await playHero(0, HERO.dash.slice(0, 1));
      moveHero(0, g.dashTo(0, j), TICK * 2);
      await playHero(0, HERO.dash.slice(1));
      await playHero(0, HERO.coil);

      // Rune coordinates are authored inside the target's frame.
      const frame = foeFrame(g.f.foes[j]);
      const ox = frame.x + fdx[j].value;
      const oy = frame.y + fdy[j].value;
      let perfects = 0;
      let lastX = ox + move.runes[0].x;
      let lastY = oy + move.runes[0].y;
      for (let k = 0; k < move.runes.length; k++) {
        if (!alive.current) return;
        const r = move.runes[k];
        const rx = ox + r.x;
        const ry = oy + r.y;
        setHeroPose(0, HERO.coilHold);
        if (r.decoy) {
          rune.decoyX.value = ox + r.decoy[0];
          rune.decoyY.value = oy + r.decoy[1];
          rune.decoy.value = withSequence(withTiming(0.9, { duration: 60 }), withTiming(0.2, { duration: 90 }), withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 120 }));
          await wait(340);
        }
        if (r.dart && k > 0) {
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
        const slash = playHero(0, strong ? HERO.slash : HERO.weakSlash);
        await wait(TICK);
        lastGrade.current = grade;
        const res = dealDamage(j, move.damage * GRADE_MULT[grade] * powerMult(g0.heroes[0].stats.str), move.brk * GRADE_BREAK[grade]);
        lastGrade.current = null;
        if (!res.dead) setFoePose(j, FOE.hurt[0][1]);
        const fb = g.foe(j);
        const you = g.hero(0);
        if (grade === 'perfect') {
          perfects += 1;
          setChain(perfects);
          haptic('heavy');
          doShake(3);
          pop('PERFECT', colors.butter, fb.x - 14, g.above(fb, 52), { sub });
          gainAp(AP_PERFECT, you.x + 4, g.above(you, 46));
          await wait(80); // hit-stop
        } else if (grade === 'good') {
          setChain(0);
          haptic('light');
          doShake(2);
          pop('GOOD', colors.mint, fb.x - 14, g.above(fb, 52), { sub });
        } else {
          setChain(0);
          pop(grade === 'early' ? 'TOO EARLY' : 'MISS', colors.lavender, fb.x - 14, g.above(fb, 52), { sub });
        }
        pop(`-${res.real}`, colors.hpRose, fb.x + 6, g.above(fb, 38));
        if (res.justBroke) {
          pop('BREAK!', colors.rose, fb.x + 4, g.above(fb, 60), { big: true });
          haptic('heavy');
        }
        await slash;
        if (res.dead) break;
        await playFoe(j, FOE.hurt.slice(1));
        await wait(rand(120, 320));
      }

      if (move.finisher && perfects === move.runes.length && !g0.foes[j].out) {
        setHint('Chain x3: finisher!');
        const fin = playHero(0, HERO.finisher);
        await wait(TICK * 3);
        const res = dealDamage(j, FINISHER_DAMAGE * powerMult(g0.heroes[0].stats.str), FINISHER_BREAK);
        if (!res.dead) setFoePose(j, FOE.hurt[0][1]);
        haptic('heavy');
        doShake(5);
        const fb = g.foe(j);
        pop('CHAIN X3', colors.peach, fb.x - 26, g.above(fb, 54), { big: true });
        pop(`-${res.real}`, colors.hpRose, fb.x + 8, g.above(fb, 38));
        if (res.justBroke) pop('BREAK!', colors.rose, fb.x + 8, g.above(fb, 60), { big: true });
        await fin;
      }

      if (!g0.foes[j].out && g0.foes[j].broken) await playFoe(j, FOE.stagger.slice(0, 1));
      moveHero(0, { dx: 0, dy: 0 }, 260, Easing.inOut(Easing.quad));
      await playHero(0, HERO.back);
      setHeroPose(0, null);
      g0.heroes[0].z = undefined;
      setFoePose(j, null);
      setFocus(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [armRune, dealDamage, doShake, gainAp, geo, measureScene, playFoe, playHero, pop, rune, setFoePose, setHeroPose],
  );

  // ---------- Your turn as a mage: a spell cast with a glyph chain ----------
  const runSpell = useCallback(
    async (spell: Spell, j: number) => {
      measureScene();
      const g = geo();
      const g0 = game.current;
      const me = g0.heroes[0];
      const glow = SPELL_GLOW[spell.fx];
      const raise = !!spell.heal;
      const ally = spell.heal ? mostHurt(g0) : -1;
      // Arc Chain jumps to the nearest other foe still standing; alone, it stays on the one.
      const others = active(g0).filter((k) => k !== j);
      others.sort((a, b) => Math.abs(g.foe(a).y - g.foe(j).y) - Math.abs(g.foe(b).y - g.foe(j).y));
      const j2 = others[0] ?? j;
      setFocus(spell.heal ? null : j);
      setAp((a) => Math.min(AP_MAX, a - spell.cost));
      setLine(spell.heal ? `You cast Mend on ${ally === 0 ? 'yourself' : called(g0.heroes[ally])}!` : `You cast ${spell.name}!`);
      setHint('Tap each glyph in order as its ring closes.');
      setChain(0);

      await playHero(0, MAGE.windup(spell.windTicks, glow, raise));
      setHeroPose(0, MAGE.hold(glow, raise));

      // Glyphs are authored inside the target's frame: a foe's, or the healed ally's.
      const frameOf = (tj: number) => {
        if (spell.heal) {
          const fr = heroFrame(g.f.heroes[tj]);
          return { x: fr.x + hdx[tj].value, y: fr.y + hdy[tj].value };
        }
        const fr = foeFrame(g.f.foes[tj]);
        return { x: fr.x + fdx[tj].value, y: fr.y + fdy[tj].value };
      };
      const pts = spell.glyphs.slice(0, GLYPH_MAX).map((gs) => {
        const tj = spell.heal ? ally : gs.next ? j2 : j;
        const fr = frameOf(tj);
        const [x, y] = gs.next && j2 === j && gs.solo ? gs.solo : [gs.x, gs.y];
        return { x: fr.x + x, y: fr.y + y, tj };
      });
      pts.forEach((p, k) => {
        glyphs.x[k].value = p.x;
        glyphs.y[k].value = p.y;
        glyphs.state[k].value = G_NEXT;
      });
      await wait(360); // a beat to read the path before the first ring

      const grades: Grade[] = [];
      let perfects = 0;
      const you = g.hero(0);
      for (let k = 0; k < pts.length; k++) {
        if (!alive.current) return;
        const gs = spell.glyphs[k];
        const p = pts[k];
        glyphs.state[k].value = G_LIVE;
        glyphs.ringX.value = p.x;
        glyphs.ringY.value = p.y;
        glyphs.ring.value = 15;
        glyphs.ring.value = withTiming(6, { duration: gs.delay, easing: Easing.linear });
        glyphs.ringOn.value = 1;
        const v = await armRune(gs.delay, { ...g.toScreen(p.x, p.y), radius: GLYPH_RADIUS });
        glyphs.ringOn.value = 0;
        const grade = v.grade;
        grades.push(grade);
        const sub = v.dt != null ? `${v.dt > 0 ? '+' : ''}${Math.round(v.dt)} MS` : undefined;
        if (grade === 'perfect') {
          perfects += 1;
          setChain(perfects);
          glyphs.state[k].value = G_LIT;
          haptic('heavy');
          doShake(1);
          pop('PERFECT', colors.butter, p.x, p.y - 10, { sub });
          gainAp(AP_PERFECT, you.x + 4, g.above(you, 46));
          await wait(80); // hit-stop
        } else if (grade === 'good') {
          setChain(0);
          glyphs.state[k].value = G_LIT;
          haptic('light');
          pop('GOOD', colors.mint, p.x, p.y - 10, { sub });
        } else {
          setChain(0);
          glyphs.state[k].value = G_MISSED;
          pop(grade === 'early' ? 'TOO EARLY' : 'MISS', colors.lavender, p.x, p.y - 10, { sub });
        }
        await wait(rand(100, 200));
      }
      if (!alive.current) return;
      setHint('');

      // Each glyph adds its grade's share; MAG scales the lot.
      const power = powerMult(me.stats.mag);
      const sumOn = (tj: number, per: number, table: Record<Grade, number>) =>
        pts.reduce((a, p, k) => (p.tj === tj ? a + per * table[grades[k]] : a), 0);

      if (spell.heal) {
        const h = g0.heroes[ally];
        const hp = g.hero(ally);
        const heal = Math.max(1, Math.round(sumOn(ally, spell.damage, GRADE_MULT) * power));
        const cast = castAt(0, 'mend', hp);
        clearGlyphs();
        shotDx.value = 0;
        shotDy.value = 0;
        const key = showFx(motesFx({ x: hp.x, y: hp.y - 14 }), true);
        shotDy.value = withTiming(-6, { duration: TICK * 6, easing: Easing.linear });
        await cast;
        const gained = Math.min(h.maxHp, h.hp + heal) - h.hp;
        h.hp += gained;
        force();
        haptic('success');
        pop(gained > 0 ? `+${gained}` : 'FULL HP', colors.questGreen, hp.x, g.above(hp, 44), { big: true });
        if (ally !== 0) void playHero(0, MAGE.recover);
        await playHero(ally, MAGE.healed);
        dropFx(key);
        if (ally === 0) await playHero(0, MAGE.recover.slice(1));
        setHeroPose(ally, null);
      } else {
        const at = foeCore(j);
        clearGlyphs();
        await castAt(0, spell.fx, at);
        lastGrade.current = perfects === pts.length ? 'perfect' : 'good';
        let res = spellHit(j, sumOn(j, spell.damage, GRADE_MULT) * power, sumOn(j, spell.brk, GRADE_BREAK));
        lastGrade.current = null;
        flashFx(burstFx(spell.fx === 'ember' ? 'ember' : spell.fx === 'arc' ? 'arc' : 'frost', at), TICK * 3);
        doShake(perfects === pts.length ? 3 : 2);
        if (spell.fx === 'arc' && j2 !== j && !g0.foes[j2].out) {
          // The bolt leaps on to the second foe with the glyphs that sat on it.
          await wait(TICK);
          const at2 = foeCore(j2);
          const key = showFx(boltFx(at, at2, 7));
          await wait(TICK);
          dropFx(key);
          const r2 = spellHit(j2, sumOn(j2, spell.damage, GRADE_MULT) * power, sumOn(j2, spell.brk, GRADE_BREAK));
          flashFx(burstFx('arc', at2), TICK * 2);
          if (!r2.dead) void playFoe(j2, FOE.hurt.slice(1)).then(() => setFoePose(j2, null));
        }
        if (spell.shatter && perfects === pts.length && !g0.foes[j].out) {
          // Every glyph Perfect: the frost shatters for bonus Break.
          setHint('Every glyph Perfect: shatter!');
          await wait(TICK * 2);
          res = dealDamage(j, SHATTER_DAMAGE * power, SHATTER_BREAK);
          if (!res.dead) setFoePose(j, FOE.hurt[0][1]);
          haptic('heavy');
          doShake(5);
          flashFx(burstFx('shatter', at), TICK * 3);
          const fb = g.foe(j);
          pop('SHATTER', colors.manaBlue, fb.x - 20, g.above(fb, 54), { big: true });
          pop(`-${res.real}`, colors.hpRose, fb.x + 8, g.above(fb, 38));
          if (res.justBroke) pop('BREAK!', colors.rose, fb.x + 8, g.above(fb, 60), { big: true });
        }
        const rec = playHero(0, MAGE.recover);
        if (!g0.foes[j].out) await playFoe(j, FOE.hurt.slice(1));
        await rec;
        if (!g0.foes[j].out && g0.foes[j].broken) await playFoe(j, FOE.stagger.slice(0, 1));
      }
      clearGlyphs();
      setHeroPose(0, null);
      if (!spell.heal) setFoePose(j, null);
      setFocus(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [armRune, dealDamage, doShake, gainAp, geo, measureScene, playFoe, playHero, pop, setFoePose, setHeroPose, showFx, dropFx],
  );

  // ---------- Tame and flee ----------
  const tf = game.current.foes[target] ?? game.current.foes[0];
  const chance = tameChance(tf.hp, tf.broken, treat && treats > 0);

  const tryTame = useCallback(
    async (j: number) => {
      const g = geo();
      const g0 = game.current;
      setPhase('acting');
      setFocus(j);
      const usedTreat = treat && treats > 0;
      if (usedTreat) setTreats((n) => n - 1);
      setTreat(false);
      setHint('Fingers crossed...');
      setLine(usedTreat ? `You offer the ${g0.foes[j].name} a Dewberry...` : `You reach out a friendly hand to the ${g0.foes[j].name}...`);
      await playHero(0, HERO.cheer);
      const fp = g.foe(j);
      pop('...', colors.mint, fp.x, g.above(fp, 44));
      for (let k = 0; k < 3; k++) {
        await playFoe(j, [[3, { tilt: 2, capDy: 1 }], [3, { tilt: -2 }]]);
      }
      setHeroPose(0, null);
      if (Math.random() < chance) {
        haptic('success');
        pop('TAMED!', colors.mint, fp.x - 6, g.above(fp, 54), { big: true });
        await playFoe(j, FOE.happy);
        await playFoe(j, FOE.happy);
        g0.foes[j].out = 'tamed';
        g0.foes[j].pose = null;
        tamedRef.current += 1;
        setTamed(tamedRef.current);
        // One tame per battle: the rest of the pack scatters and the fight is over. In live co-op,
        // every player who picked TAME this round rolls before the pack flees, so several can be tamed.
        const rest = active(g0);
        rest.forEach((k) => {
          g0.foes[k].out = 'fled';
          moveFoe(k, { dx: g.f.w - g.f.foes[k].x + 30, dy: 0 }, 520 + k * 80, Easing.in(Easing.quad));
        });
        force();
        if (rest.length) {
          setLine('The rest of the pack scatters into the fog!');
          await wait(700);
        }
        setFocus(null);
        finish('tamed');
        return true;
      }
      pop('IT SHOOK FREE', colors.rose, fp.x - 6, g.above(fp, 54));
      setLine('It shook free!');
      setFoePose(j, null);
      await wait(500);
      setFocus(null);
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chance, finish, geo, playFoe, playHero, pop, setFoePose, setHeroPose, treat, treats],
  );

  // ---------- A round: quicker allies, then you, then everyone else ----------
  const targetRef = useRef(target);
  targetRef.current = target;
  const takeTurn = useCallback(
    async (act: (j: number) => Promise<boolean | void>) => {
      setPhase('acting');
      const g0 = game.current;
      const first = quicker(g0);
      for (const i of first) {
        if (!alive.current) return;
        if (!active(g0).length) break;
        await allyAct(i);
        retarget();
      }
      if (!alive.current) return;
      if (!active(g0).length) {
        finish('won');
        return;
      }
      // Your target may have gone down to a quicker ally: aim at the next one standing.
      const live = active(g0);
      const j = live.includes(targetRef.current) ? targetRef.current : live[0];
      const over = await act(j);
      if (over || !alive.current) return;
      await restOfRound(first);
    },
    [allyAct, finish, restOfRound, retarget],
  );

  const tryFlee = useCallback(async () => {
    const g = geo();
    const g0 = game.current;
    setPhase('acting');
    setHint('');
    if (Math.random() < FLEE_CHANCE) {
      setLine(g0.heroes.length > 1 ? 'Your party slips away into the fog.' : 'You slip away into the fog.');
      g0.heroes.forEach((h, i) => {
        if (h.hp > 0) setHeroPose(i, { ...HERO.ready, lean: -2, cape: 1 });
        moveHero(i, { dx: -g.f.heroes[i].x - 30, dy: 0 }, 500 + i * 60, Easing.in(Easing.quad));
      });
      await wait(700);
      setPhase('fled');
      return;
    }
    const you = g.hero(0);
    pop("CAN'T ESCAPE", colors.rose, you.x + 6, g.above(you, 48));
    setLine(copy.block);
    await wait(500);
    await restOfRound([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, pop, restOfRound, setHeroPose]);

  const reset = useCallback(
    (nextFull: boolean, nextCls: HeroClass | null = cls) => {
      disarm();
      [...hdx, ...hdy, ...fdx, ...fdy].forEach((v) => {
        v.value = 0;
      });
      rune.visible.value = 0;
      clearGlyphs();
      dropFx();
      setSel(0);
      game.current = newGame(nextFull, encounter, youAs(nextCls));
      tamedRef.current = 0;
      setTarget(0);
      setFocus(null);
      setAp(AP_START);
      setChain(0);
      setTreats(3);
      setTreat(false);
      setTamed(0);
      setPops([]);
      setLine(nextFull ? 'Your party of four meets a pack of Shroomies. Tap one to target it.' : 'Another Mossback Shroomie wanders out of the fog.');
      setHint('');
      setCheer(false);
      setPhase('menu');
      setGuarding(false);
      force();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disarm, cls],
  );

  const toggleParty = () => {
    const next = !full;
    setFull(next);
    reset(next);
  };
  const toggleClass = () => {
    const next: HeroClass = game.current.heroes[0].look.cls === 'mage' ? 'warrior' : 'mage';
    setCls(next);
    reset(full, next);
  };

  // ---------- The field ----------
  const g0 = game.current;
  const actors: Actor[] = [];
  if (field) {
    g0.heroes.forEach((h, i) => {
      const b = (beat + i) % 4;
      const idlePose: HeroPose =
        h.hp <= 0 ? HERO.down : cheer ? HERO.cheer[b % 2][1] : b % 2 === 0 ? HERO.ready : { ...HERO.ready, crouch: true, hy: 5 };
      if (h.npc) {
        const npcIdle: FoePose = h.hp <= 0 ? FOE.down : cheer ? FOE.happy[b % 2][1] : (h.fpose ?? FOE.idle[b][1]);
        actors.push({ kind: 'ally', key: `h${i}`, slot: field.heroes[i], z: h.z, pose: { ...npcIdle, kind: h.npc }, dx: hdx[i], dy: hdy[i] });
        return;
      }
      actors.push({ kind: 'hero', key: `h${i}`, slot: field.heroes[i], z: h.z, pose: { ...(h.pose ?? idlePose), hero: h.look }, dx: hdx[i], dy: hdy[i] });
    });
    g0.foes.forEach((f, j) => {
      const idlePose: FoePose =
        f.out === 'down' ? FOE.down : f.out === 'tamed' ? FOE.happy[beat % 2][1] : f.out === 'fled' ? { tilt: -2, x: 2 } : FOE.idle[(beat + j * 2) % 4][1];
      actors.push({ kind: 'foe', key: `f${j}`, slot: field.foes[j], z: f.z, pose: { ...(f.out ? idlePose : (f.pose ?? idlePose)), look: f.look, kind: f.kind }, dx: fdx[j], dy: fdy[j] });
    });
  }

  const mage = g0.heroes[0].look.cls === 'mage';
  const actions: Action[] = mage ? SPELLS : MOVES;
  const move = actions[sel] ?? actions[0];
  const canUse = (m: Action) => m.cost <= ap;
  const healFor = g0.heroes[mostHurt(g0)];
  const ended = phase === 'won' || phase === 'lost' || phase === 'tamed' || phase === 'fled';
  const choosing = phase === 'menu' || phase === 'moves' || phase === 'tame';
  const party = g0.heroes.length > 1;
  const shown = g0.foes[focus ?? target] ?? g0.foes[0];
  const caption =
    phase === 'moves'
      ? move.desc
      : phase === 'tame'
        ? party
          ? `Taming the ${tf.name}. Only one per battle: if it works, the rest of the pack flees. Lower HP, Break and a treat raise the chance.`
          : 'Lower HP and a Broken enemy raise the chance, and a treat adds more. If the roll fails, the enemies get their turn.'
        : phase === 'flee'
          ? "You keep the loot found so far, but lose this room's rewards. A failed flee costs your turn."
          : line;
  const tamedName = g0.foes.find((f) => f.out === 'tamed')?.name ?? 'Mossback Shroomie';
  const downed = g0.foes.filter((f) => f.out === 'down').length;
  const wonText = encounter?.won
    ? encounter.won
    : party
    ? `The pack is cleared. +40 XP each for the party, and ${3 * downed} wood for the base.`
    : kind === 'butcher'
      ? 'The old man lowers his cleaver and sits down hard. +40 XP.'
      : kind === 'boar'
        ? `The ${g0.foes[0].name} is down. +25 XP, and it dropped ${finalPerfect.current ? '2 boar meat' : '1 boar meat'}: pick it up in the woods.`
      : `The ${g0.foes[0].name} is defeated. +40 XP and 3 wood for the base.`;

  return (
    <GestureDetector gesture={gesture}>
      <View style={st.screen}>
        <View style={st.column}>
          {/* The scene fills everything above the dock. */}
          <View style={st.sceneBox} ref={sceneRef} onLayout={onSceneLayout}>
            {field ? (
              <Animated.View style={shakeStyle}>
                <BattleScene field={field} actors={actors} rune={rune} glyphs={glyphs} fx={fx} />
              </Animated.View>
            ) : null}

            {/* Party battles: HP under everyone, a target marker, and tap-to-target. */}
            {field && party
              ? g0.heroes.map((h, i) => <FieldBar key={`hb${i}`} field={field} slot={field.heroes[i]} dx={hdx[i]} dy={hdy[i]} value={h.hp} max={h.maxHp} />)
              : null}
            {field && party
              ? g0.foes.map((f, j) =>
                  f.out ? null : <FieldBar key={`fb${j}`} field={field} slot={field.foes[j]} dx={fdx[j]} dy={fdy[j]} value={f.hp} max={f.maxHp} />,
                )
              : null}
            {field && party && choosing && !g0.foes[target]?.out ? <TargetMarker field={field} slot={field.foes[target]} beat={beat} /> : null}
            {field && party && choosing
              ? g0.foes.map((f, j) =>
                  f.out ? null : (
                    <Pressable
                      key={`tap${j}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Target ${f.name}`}
                      accessibilityState={{ selected: j === target }}
                      onPress={() => {
                        setTarget(j);
                        haptic('light');
                      }}
                      style={{
                        position: 'absolute',
                        left: (field.foes[j].x - 14) * field.s,
                        top: (field.foes[j].y - 28) * field.s,
                        width: 28 * field.s,
                        height: 30 * field.s,
                      }}
                    />
                  ),
                )
              : null}

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
                      {shown.name}
                    </Text>
                    <Text style={t.statSoft}>{party ? `${active(g0).length} LEFT` : 'LV 6'}</Text>
                  </View>
                  <View style={st.barRow}>
                    <Text style={[t.stat, st.barLabel]}>HP</Text>
                    <SegBar value={shown.hp} max={shown.maxHp} segs={16} fill={colors.hpRose} height={6} />
                  </View>
                  <View style={st.barRow}>
                    <Text style={[t.stat, st.barLabel]}>BREAK</Text>
                    <SegBar value={shown.broken ? BREAK_MAX : shown.brk} max={BREAK_MAX} segs={10} fill={shown.broken ? colors.rose : colors.xpGold} height={4} />
                    {shown.broken ? <Chip label="BROKEN" fill={colors.rose} /> : null}
                  </View>
                </View>
              </Framed>
              <View style={{ gap: 6, alignItems: 'flex-end' }}>
                <Pressable accessibilityRole="switch" accessibilityState={{ checked: assist }} onPress={() => setAssist((a) => !a)} hitSlop={8}>
                  <Chip label={assist ? 'ASSIST ON' : 'ASSIST OFF'} fill={assist ? colors.mint : colors.vellum} />
                </Pressable>
                {!encounter ? (
                  <Pressable
                    accessibilityRole="switch"
                    accessibilityLabel="Your class"
                    accessibilityState={{ checked: mage, disabled: phase === 'acting' }}
                    disabled={phase === 'acting'}
                    onPress={toggleClass}
                    hitSlop={8}
                  >
                    <Chip label={mage ? 'MAGE' : 'WARRIOR'} fill={mage ? colors.lavender : colors.vellum} />
                  </Pressable>
                ) : null}
                {!encounter ? (
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
                ) : null}
                {onExit && phase !== 'acting' ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Back to base" onPress={onExit} hitSlop={8}>
                    <Chip label="‹ BASE" fill={colors.mint} />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {!ended ? (
              <View style={st.caption} pointerEvents="none">
                <Framed shadow={null} fill={colors.vellum}>
                  <View style={st.dialog}>
                    <FoeHead kind={kind} />
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
                <HeadSprite look={g0.heroes[0].look} />
                <View style={{ gap: 2 }}>
                  <Text style={t.stat}>YOU · HP {g0.heroes[0].hp}</Text>
                  <View style={{ width: 92, flexDirection: 'row' }}>
                    <SegBar value={g0.heroes[0].hp} max={g0.heroes[0].maxHp} segs={10} fill={colors.hpRose} height={4} />
                  </View>
                </View>
                {party ? (
                  <View style={{ flexDirection: 'row', gap: 4, marginLeft: 2 }}>
                    {g0.heroes.slice(1).map((h) => (
                      <View key={h.name} accessibilityLabel={`${h.name}: ${h.hp} HP`} style={{ opacity: h.hp > 0 ? 1 : 0.4 }}>
                        <HeadSprite look={h.look} npc={h.npc} small />
                      </View>
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
                  <PixelButton height={96} onPress={() => setPhase('moves')} accessibilityLabel={mage ? 'Cast' : 'Attack'}>
                    <View style={st.btnRow}>
                      <PixelIcon name={mage ? 'spark' : 'sword'} size={5} />
                      <View style={{ flex: 1 }}>
                        <Text style={[t.button, { fontSize: 28, lineHeight: 32 }]}>{mage ? 'CAST' : 'ATTACK'}</Text>
                        <Text style={t.caption} numberOfLines={1}>
                          {actions.filter(canUse).length} {mage ? 'spells' : 'moves'} ready{party ? ` · target: ${tf.name}` : ''}
                        </Text>
                      </View>
                    </View>
                  </PixelButton>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {kind === 'shroomie' ? (
                      <PixelButton style={{ flex: 1 }} height={84} fill={colors.mint} shadow={colors.questGreen} onPress={() => setPhase('tame')} accessibilityLabel="Tame">
                        <View style={st.btnRow}>
                          <PixelIcon name="heart" size={3} />
                          <View>
                            <Text style={[t.button, { fontSize: 20 }]}>TAME</Text>
                            <Text style={[t.caption, { fontSize: 12 }]}>{Math.round(tameChance(tf.hp, tf.broken, false) * 100)}% now</Text>
                          </View>
                        </View>
                      </PixelButton>
                    ) : null}
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
                    {actions.map((m, i) => {
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
                            {isSpell(m)
                              ? m.glyphs.map((_, k) => <View key={k} style={st.glyphDot} />)
                              : m.runes.map((_, k) => <View key={k} style={st.runeDot} />)}
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
                    <PixelButton
                      style={{ flex: 1 }}
                      height={52}
                      disabled={!canUse(move)}
                      onPress={() => takeTurn((j) => (isSpell(move) ? runSpell(move, j) : runMove(move, j)))}
                    >
                      <Text style={[t.buttonSmall, st.cta]} numberOfLines={1}>
                        {!canUse(move)
                          ? `Needs ${move.cost} AP`
                          : isSpell(move) && move.heal
                            ? `Mend ${healFor === g0.heroes[0] ? 'yourself' : healFor.name}`
                            : `${mage ? 'Cast' : 'Use'} ${move.name}`}
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
                    <PixelButton style={{ flex: 1 }} height={52} fill={colors.mint} shadow={colors.questGreen} onPress={() => takeTurn((j) => tryTame(j))}>
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
                    {guarding ? (
                      <Text style={[t.statSoft, { textAlign: 'center', marginTop: 6 }]}>TAP ANYWHERE TO PARRY · SWIPE TO DODGE</Text>
                    ) : !hint ? (
                      <Text style={[t.statSoft, { textAlign: 'center' }]}>{party ? 'THE BATTLE PLAYS OUT' : 'THE SHROOMIE IS ACTING'}</Text>
                    ) : null}
                  </View>
                </Framed>
              ) : null}

              {ended ? (
                <Framed style={{ flex: 1 }} fill={phase === 'lost' ? colors.vellum : phase === 'tamed' ? colors.mint : colors.butter}>
                  <View style={{ padding: 12, gap: 6, flex: 1 }}>
                    <Text style={[t.title, { fontSize: 24, lineHeight: 30 }]}>
                      {phase === 'won' ? 'Victory!' : phase === 'lost' ? 'Your party rests...' : phase === 'tamed' ? 'New critter!' : 'Got away!'}
                    </Text>
                    <Text style={[t.body, { fontSize: 14, lineHeight: 19 }]}>
                      {phase === 'won'
                        ? wonText
                        : phase === 'lost'
                          ? copy.lost
                          : phase === 'tamed'
                            ? `The ${tamedName} is heading to your base as your new critter. Tap it there to say hi!${party ? ' The rest of the pack fled.' : ''}`
                            : encounter
                              ? encounter.fled
                                ? encounter.fled
                                : kind === 'butcher'
                                ? `You backed off. The ${encounter.name} is still guarding his hut.`
                                : kind === 'boar'
                                ? `You backed off. The ${encounter.name} is still rooting around the woods.`
                                : `You backed off. The ${encounter.name} is still wandering your base.`
                              : 'You slipped away into the fog. No rewards from this room.'}
                    </Text>
                    <PixelButton height={52} onPress={() => (onDone ? onDone(phase as BattleResult, { perfect: finalPerfect.current }) : reset(full))} style={{ marginTop: 'auto' }}>
                      <Text style={[t.buttonSmall, st.cta]}>{onDone ? (kind === 'boar' ? 'Back to the woods' : 'Back to base') : 'Fight again'}</Text>
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

// A small HP bar under a sprite's feet that follows its dashes.
function FieldBar({ field, slot, dx, dy, value, max }: { field: Field; slot: { x: number; y: number }; dx: SharedValue<number>; dy: SharedValue<number>; value: number; max: number }) {
  const s = field.s;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: Math.round(slot.x - 9 + dx.value) * s }, { translateY: Math.round(slot.y + 2 + dy.value) * s }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[st.fieldBar, { width: 18 * s }, style]}>
      <View style={{ width: `${Math.max(0, value / max) * 100}%`, height: '100%', backgroundColor: colors.hpRose }} />
    </Animated.View>
  );
}

// A bobbing pixel arrow over the selected enemy.
const ARROW = ['XXXXX', '.XXX.', '..X..'];
function TargetMarker({ field, slot, beat }: { field: Field; slot: { x: number; y: number }; beat: number }) {
  const s = field.s;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: (slot.x - 3) * s, top: (slot.y - 25 - (beat % 2)) * s }}>
      {ARROW.map((row, j) => (
        <View key={j} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, i) => (
            <View key={i} style={{ width: s, height: s, backgroundColor: c === 'X' ? colors.xpGold : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}

function HeadSprite({ look, small, npc }: { look: HeroLook; small?: boolean; npc?: 'merchant' }) {
  const key = npc ?? `${look.cls}-${look.sex}-${look.skin}-${look.hair}-${look.hairColor}`;
  const pic = useMemo(() => gridPicture(`heroface-${key}`, npc ? merchantFace : () => heroFace(look), 2), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={[st.portrait, { width: small ? 34 : 38, height: small ? 28 : 32 }]}>
      <Canvas style={{ width: 32, height: 26 }}>
        <Picture picture={pic} />
      </Canvas>
    </View>
  );
}

function FoeHead({ kind }: { kind: FoePose['kind'] }) {
  const pic = useMemo(() => gridPicture(`foehead-${kind}`, foePortrait(kind), 2), [kind]);
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
  glyphDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sky, borderWidth: 1, borderColor: colors.ink },
  runeDot: { width: 7, height: 7, backgroundColor: colors.xpGold, borderWidth: 1, borderColor: colors.ink, transform: [{ rotate: '45deg' }] },
  card: { flex: 1, borderWidth: 2, borderColor: colors.ink, padding: 8, gap: 2 },
  note: { borderWidth: 2, borderColor: colors.ink, padding: 8, backgroundColor: colors.sky },
  cta: { textAlign: 'center', fontFamily: 'PixelifySans_700Bold', fontSize: 18 },
  fieldBar: { position: 'absolute', left: 0, top: 0, height: 6, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.scroll },
});
