import type { Dir } from '../sprites/overworld';
import type { Pt } from './map';

// Someone walking behind you (Puul on the way home). He follows the trail of spots you walked
// through rather than a straight line to you, so he goes round trees the way you did.

export type Follower = { x: number; y: number; dir: Dir; frame: number; walkMs: number; trail: Pt[] };

const GAP = 16; // he stops this far behind you
const CRUMB = 3; // a new trail point every 3 px you walk
const STEP_MS = 1000 / 8;

export const newFollower = (at: Pt, dir: Dir = 'down'): Follower => ({ x: at.x, y: at.y, dir, frame: 0, walkMs: 0, trail: [] });

// Moves the follower one frame toward you. Returns true when his sprite changed.
export function stepFollower(f: Follower, hero: Pt, speed: number, dt: number): boolean {
  const last = f.trail[f.trail.length - 1];
  if (!last || Math.hypot(hero.x - last.x, hero.y - last.y) >= CRUMB) f.trail.push({ x: hero.x, y: hero.y });
  if (f.trail.length > 400) f.trail.splice(0, f.trail.length - 400);
  let moving = false;
  let dir = f.dir;
  if (Math.hypot(hero.x - f.x, hero.y - f.y) > GAP) {
    let budget = (speed * dt) / 1000;
    while (budget > 0 && f.trail.length) {
      const to = f.trail[0];
      const dx = to.x - f.x;
      const dy = to.y - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.5) {
        f.trail.shift();
        continue;
      }
      const step = Math.min(d, budget);
      f.x += (dx / d) * step;
      f.y += (dy / d) * step;
      budget -= step;
      moving = true;
      dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (step === d) f.trail.shift();
      if (Math.hypot(hero.x - f.x, hero.y - f.y) <= GAP) break;
    }
  }
  let changed = dir !== f.dir;
  f.dir = dir;
  if (moving) {
    f.walkMs += dt;
    const fr = Math.floor(f.walkMs / STEP_MS) % 4;
    if (fr !== f.frame) {
      f.frame = fr;
      changed = true;
    }
  } else if (f.frame !== 0) {
    f.frame = 0;
    f.walkMs = 0;
    changed = true;
  }
  return changed;
}

// Turns him to face a spot (you, when you stop to talk).
export function faceToward(f: Follower, p: Pt) {
  const dx = p.x - f.x;
  const dy = p.y - f.y;
  f.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
}
