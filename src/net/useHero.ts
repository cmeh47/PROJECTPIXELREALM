import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { HeroClass, HeroLook, HeroSex } from '../sprites/hero';
import { ensureSignedIn, supabase } from './supabase';

// The player's hero: their name and look (supabase/migrations/*_heroes.sql).
export type Hero = { name: string; look: HeroLook };

// loading: signing in and asking the server; none: first launch, show character creation;
// ready: the hero exists; error: the server couldn't be reached and this device has no copy of the
// hero (retry asks again; playOffline makes and keeps the hero on this device only).
export type HeroStatus = 'loading' | 'none' | 'ready' | 'error';

type Raw = { name: string; class: HeroClass; sex: HeroSex; skin: number; hair: number; hair_color: number };

const fromRaw = (r: Raw): Hero => ({ name: r.name, look: { cls: r.class, sex: r.sex, skin: r.skin, hair: r.hair, hairColor: r.hair_color } });
const toRaw = (h: Hero): Raw => ({ name: h.name, class: h.look.cls, sex: h.look.sex, skin: h.look.skin, hair: h.look.hair, hair_color: h.look.hairColor });

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
    (async () => {
      let raw: Raw | null;
      if (supabase && !offline) {
        try {
          await ensureSignedIn(supabase);
          const { data, error } = await supabase.rpc('get_hero');
          if (error) throw error;
          raw = data as Raw | null;
          if (raw) writeLocal(raw);
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
    let raw = toRaw(h);
    if (supabase && !offline) {
      await ensureSignedIn(supabase);
      const { data, error } = await supabase.rpc('create_hero', raw);
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
