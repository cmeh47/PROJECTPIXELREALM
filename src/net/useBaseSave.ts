import { useCallback, useEffect, useRef, useState } from 'react';

import { ensureSignedIn, supabase } from './supabase';

// The player's base as the server stores it (supabase/migrations/*_save_base.sql).
export type ShroomieStatus = 'wild' | 'gone' | 'critter';
export type ServerButcher = 'hostile' | 'spared' | 'quest' | 'building' | 'shop';
export type SavedBase = {
  wood: number;
  shroomies: ShroomieStatus[];
  butcher: ServerButcher;
  buildStartedAt: number | null; // on this device's clock
  buildDone: boolean;
};

// offline: no Supabase project configured; loading: signing in and fetching; saved: in step with the
// server; saving: changes on their way; error: the last change was refused or the network failed
// (the base is reloaded from the server, which is always right).
export type SaveStatus = 'offline' | 'loading' | 'saved' | 'saving' | 'error';

// The calls the base makes. Each one is a server function that checks its own rules.
export type BaseCall =
  | { fn: 'chop' }
  | { fn: 'shroomie_battle'; idx: number; result: 'won' | 'tamed' }
  | { fn: 'reset_base' }
  | { fn: 'butcher_step'; step: 'beaten' | 'accept' | 'handin' | 'opened' };

type Raw = { wood: number; shroomies: ShroomieStatus[]; butcher: ServerButcher; build_started_at: string | null; build_done: boolean; server_now: string };

function fromRaw(r: Raw): SavedBase {
  // The server's clock decides the rebuild; shift its start onto this device's clock.
  const offset = Date.parse(r.server_now) - Date.now();
  return {
    wood: r.wood,
    shroomies: r.shroomies,
    butcher: r.butcher,
    buildStartedAt: r.build_started_at ? Date.parse(r.build_started_at) - offset : null,
    buildDone: r.build_done,
  };
}

const args = (c: BaseCall) => {
  if (c.fn === 'shroomie_battle') return { idx: c.idx, result: c.result };
  if (c.fn === 'butcher_step') return { step: c.step };
  return undefined;
};

// Loads the base when the screen opens, then sends each change in order. The game changes its own
// state right away; once every call in flight has answered, the server's copy is applied on top, so
// a refused change quietly rolls back. apply is called with the server's base.
export function useBaseSave(apply: (b: SavedBase) => void) {
  const [status, setStatus] = useState<SaveStatus>(supabase ? 'loading' : 'offline');
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(0);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  const run = useCallback((job: () => Promise<Raw>) => {
    pending.current += 1;
    queue.current = queue.current.then(async () => {
      let latest: Raw | null = null;
      let failed = false;
      try {
        latest = await job();
      } catch (e) {
        failed = true;
        console.warn('Save failed', e);
        try {
          latest = await rpc('get_base');
        } catch {
          // Still unreachable; the game keeps its own state until the next call gets through.
        }
      }
      pending.current -= 1;
      if (pending.current === 0) {
        if (latest) applyRef.current(fromRaw(latest));
        setStatus(failed ? 'error' : 'saved');
      }
    });
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    run(async () => {
      await ensureSignedIn(client);
      return rpc('get_base');
    });
  }, [run]);

  const send = useCallback(
    (c: BaseCall) => {
      if (!supabase) return;
      setStatus('saving');
      run(() => rpc(c.fn, args(c)));
    },
    [run],
  );

  return { status, send };
}

async function rpc(fn: string, params?: Record<string, unknown>): Promise<Raw> {
  const { data, error } = await supabase!.rpc(fn, params);
  if (error) throw error;
  return data as Raw;
}
