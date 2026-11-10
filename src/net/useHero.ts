import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { CLASS_OUTFIT, type HeroClass, type HeroLook, type HeroSex } from '../sprites/hero';
import { ensureSignedIn, supabase } from './supabase';

// The player's hero: their name and look (supabase/migrations/*_heroes.sql).
export type Hero = { name: string; look: HeroLook };

// loading: signing in and asking the server; none: first launch, show character creation;
// ready: the hero exists; error: the server couldn't be reached and this device has no copy of the
// hero (retry asks again; playOffline makes and keeps the hero on this device only).
export type HeroStatus = 'loading' | 'none' | 'ready' | 'error';

// eye_color and outfit_color came later (the *_hero_eyes_outfit.sql migration): a server that
// hasn't had it yet leaves them out, and the hero then has ink eyes and the class's own colors.
type Raw = { name: string; class: HeroClass; sex: HeroSex; skin: number; hair: number; hair_color: number; eye_color?: number; outfit_color?: number };

const fromRaw = (r: Raw): Hero => ({
  name: r.name,
  look: { cls: r.class, sex: r.sex, skin: r.skin, hair: r.hair, hairColor: r.hair_color, eyes: r.eye_color ?? 0, outfit: r.outfit_color ?? CLASS_OUTFIT[r.class] },
});
const toRaw = (h: Hero): Required<Raw> => ({
  name: h.name,
  class: h.look.cls,
  sex: h.look.sex,
  skin: h.look.skin,
  hair: h.look.hair,
  hair_color: h.look.hairColor,
  eye_color: h.look.eyes ?? 0,
  outfit_color: h.look.outfit ?? CLASS_OUTFIT[h.look.cls],
});

// EXPO_PUBLIC_PREVIEW_CREATION=1 in .env opens character creation on every launch, for trying the
// screens on a device that already has a hero. The hero made lasts until the app closes and is
// never saved, so the real one is untouched.
const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW_CREATION === '1';

// A copy of the hero on this device: the only copy without a Supabase project, and a fallback when
// the server can't be reached (the server's copy wins whenever it answers).
const LOCAL_KEY = 'pixelrealm.hero';

async function readLocal(): Promise<Raw | null> {
  try {
    const saved = await AsyncStorage.getItem(LOCAL_KEY);
    return saved ? (JSON.parse(saved) as Raw) : null;
  } catch {
    return null;
  }
}
const writeLocal = (r: Raw) => AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(r)).catch(() => undefined);

export function useHero() {
  const [status, setStatus] = useState<HeroStatus>('loading');
  const [hero, setHero] = useState<Hero | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [offline, setOffline] = useState(!supabase);

  useEffect(() => {
    let live = true;
    if (PREVIEW) {
      setStatus('none');
      return;
    }
    (async () => {
      let raw: Raw | null;
      if (supabase && !offline) {
        try {
          await ensureSignedIn(supabase);
          const { data, error } = await supabase.rpc('get_hero');
          if (error) throw error;
          raw = data as Raw | null;
          if (raw) {
            // Until the server stores eyes and clothes, this device's copy remembers them.
            const mine = await readLocal();
            if (mine && mine.name === raw.name) raw = { eye_color: mine.eye_color, outfit_color: mine.outfit_color, ...raw };
            writeLocal(raw);
          }
        } catch (e) {
          console.warn('Loading the hero failed', e);
          raw = await readLocal();
          if (!raw) {
            if (live) setStatus('error');
            return;
          }
        }
      } else {
        raw = await readLocal();
      }
      if (!live) return;
      setHero(raw ? fromRaw(raw) : null);
      setStatus(raw ? 'ready' : 'none');
    })();
    return () => {
      live = false;
    };
  }, [attempt, offline]);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((a) => a + 1);
  }, []);

  const playOffline = useCallback(() => {
    setStatus('loading');
    setOffline(true);
  }, []);

  // Makes the hero on the server, which checks the name and every choice. Throws the server's
  // message if it refuses, so the creation screen can show it.
  const create = useCallback(async (h: Hero) => {
    let raw: Raw = toRaw(h);
    if (PREVIEW) {
      setHero(fromRaw(raw));
      setStatus('ready');
      return fromRaw(raw);
    }
    if (supabase && !offline) {
      await ensureSignedIn(supabase);
      let { data, error } = await supabase.rpc('create_hero', raw);
      if (error?.code === 'PGRST202') {
        // The server is still on the first create_hero (no eyes or clothes): make the hero with
        // what it knows and keep the rest on this device.
        const { eye_color, outfit_color, ...first } = toRaw(h);
        ({ data, error } = await supabase.rpc('create_hero', first));
        if (data) data = { eye_color, outfit_color, ...(data as Raw) };
      }
      if (error) throw new Error(error.message);
      raw = data as Raw;
    }
    await writeLocal(raw);
    const made = fromRaw(raw);
    setHero(made);
    setStatus('ready');
    return made;
  }, [offline]);

  return { status, hero, create, retry, playOffline };
}
