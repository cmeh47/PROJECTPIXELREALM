import type { Pt } from './map';

// A walking route round whatever's in the way, for tap-to-walk: a breadth-first search over a
// coarse grid of cells (8 directions, no cutting corners), then smoothed so the hero walks straight
// wherever nothing blocks the line. Returns the waypoints after `from`, ending exactly at `to`, or
// null if `to` can't be reached. Cheap enough to run on each tap: a 416 x 560 map is 14,560 cells.
export function route(from: Pt, to: Pt, blocked: (x: number, y: number) => boolean, w: number, h: number, cell = 4): Pt[] | null {
  if (blocked(to.x, to.y)) return null;
  if (clear(from, to, blocked)) return [to];
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const at = (p: Pt) => Math.min(rows - 1, Math.max(0, Math.floor(p.y / cell))) * cols + Math.min(cols - 1, Math.max(0, Math.floor(p.x / cell)));
  const mid = (i: number): Pt => ({ x: (i % cols) * cell + cell / 2, y: Math.floor(i / cols) * cell + cell / 2 });
  // Each cell is checked once: 0 unknown, 1 open, 2 blocked.
  const seen = new Uint8Array(cols * rows);
  const open = (i: number) => {
    if (!seen[i]) seen[i] = blocked(mid(i).x, mid(i).y) ? 2 : 1;
    return seen[i] === 1;
  };
  const start = at(from);
  const goal = at(to);
  const prev = new Int32Array(cols * rows).fill(-1);
  prev[start] = start;
  const queue = [start];
  const steps = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = start === goal;
  for (let q = 0; q < queue.length && !found; q++) {
    const i = queue[q];
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    for (const [dx, dy] of steps) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (prev[j] !== -1 || (j !== goal && !open(j))) continue;
      // Diagonals only where both sides are open, so the route never squeezes past a corner.
      if (dx && dy && (!open(cy * cols + nx) || !open(ny * cols + cx))) continue;
      prev[j] = i;
      if (j === goal) {
        found = true;
        break;
      }
      queue.push(j);
    }
  }
  if (!found) return null;
  const cells: Pt[] = [];
  for (let i = goal; i !== start; i = prev[i]) cells.unshift(mid(i));
  cells.push(to);
  // Smooth: from each point, head for the furthest waypoint in a clear straight line.
  const out: Pt[] = [];
  let here = from;
  let k = 0;
  while (k < cells.length) {
    let far = k;
    for (let j = cells.length - 1; j > k; j--) {
      if (clear(here, cells[j], blocked)) {
        far = j;
        break;
      }
    }
    out.push(cells[far]);
    here = cells[far];
    k = far + 1;
  }
  return out;
}

// Whether a straight walk from a to b stays clear, checked every pixel.
function clear(a: Pt, b: Pt, blocked: (x: number, y: number) => boolean) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    if (blocked(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u)) return false;
  }
  return true;
}
