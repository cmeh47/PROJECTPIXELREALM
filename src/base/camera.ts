// The overworld camera. Sideways it stays locked on the hero; up and down it has a dead zone, so
// short steps up or down don't scroll the whole (tall, portrait) screen. Once the hero walks out
// of the zone the camera eases after them instead of snapping, and it lands on whole screen pixels.

const DEAD_ZONE = 0.1; // the hero can drift this share of the view height above or below centre
const EASE_MS = 140; // how quickly the camera catches up once it starts moving
const LIFT = 10; // the hero's feet sit a little below centre so their body reads as centred

export type VCam = { y: number; ready: boolean; viewH: number };

export const newVCam = (): VCam => ({ y: 0, ready: false, viewH: 0 });

// Returns camY (art px) for this frame. s is the screen scale, so the result rounds to device pixels.
export function followY(cam: VCam, heroY: number, viewH: number, mapH: number, dt: number, s: number): number {
  const lo = 0;
  const hi = Math.max(0, mapH - viewH);
  const want = heroY - LIFT - viewH / 2; // where a fully locked camera would sit
  const zone = viewH * DEAD_ZONE;
  // Arriving, the screen size changed, or the hero jumped (scene change, respawn): snap.
  if (!cam.ready || cam.viewH !== viewH || Math.abs(want - cam.y) > viewH * 0.6) {
    cam.y = want;
    cam.ready = true;
    cam.viewH = viewH;
  } else {
    let goal = cam.y;
    if (want > cam.y + zone) goal = want - zone;
    else if (want < cam.y - zone) goal = want + zone;
    cam.y += (goal - cam.y) * (1 - Math.exp(-dt / EASE_MS));
  }
  cam.y = Math.max(lo, Math.min(hi, cam.y));
  return Math.round(cam.y * s) / s;
}
