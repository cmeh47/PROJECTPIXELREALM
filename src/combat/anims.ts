import type { FoePose, HeroPose } from '../sprites/characters';

// Frame tables from the combat storyboards. Each frame: [ticks at 12 fps, pose].
export const TICK = 1000 / 12;
export type Frames<P> = [number, P][];

export const HERO = {
  idle: [
    [3, {}],
    [3, { cape: 1 }],
    [3, { crouch: true, hy: 5, cape: 1 }],
    [3, { crouch: true, hy: 5 }],
  ] as Frames<HeroPose>,
  ready: { legs: 'stride', sw: -60 } as HeroPose,
  dash: [
    [1, { crouch: true, legs: 'stride', lean: -1, sw: -70 }],
    [2, { legs: 'lunge', lean: 2, hx: 4, hy: 3, sw: 5, ghosts: [[-8, 0], [-4, 0]] }],
  ] as Frames<HeroPose>,
  coil: [
    [2, { crouch: true, legs: 'stride', lean: -1, hx: -1, hy: -2, sw: -120, cape: 1 }],
    [3, { crouch: true, legs: 'stride', lean: -2, x: -1, hx: -3, hy: -4, sw: -150, cape: 1 }],
  ] as Frames<HeroPose>,
  coilHold: { crouch: true, legs: 'stride', lean: -2, x: -1, hx: -3, hy: -4, sw: -150, cape: 1 } as HeroPose,
  slash: [
    [1, { x: 4, legs: 'lunge', lean: 2, hx: 5, hy: 3, sw: 25, cape: -1, smear: [-150, 25, 6, 13] }],
    [1, { x: 5, legs: 'lunge', lean: 2, hx: 5, hy: 5, sw: 50, cape: -1, smear: [-30, 50, 9, 13, 0.6], spark: 3 }],
    [2, { x: 4, legs: 'lunge', crouch: true, lean: 1, hx: 4, hy: 5, sw: 60 }],
  ] as Frames<HeroPose>,
  weakSlash: [
    [1, { x: 3, legs: 'lunge', lean: 1, hx: 5, hy: 3, sw: 25, smear: [-120, 25, 9, 12, 0.5] }],
    [2, { x: 3, legs: 'lunge', crouch: true, hx: 4, hy: 5, sw: 55 }],
  ] as Frames<HeroPose>,
  finisher: [
    [1, { crouch: true, legs: 'stride', lean: -2, hx: -3, hy: 3, sw: 160 }],
    [1, { x: 8, legs: 'lunge', lean: 2, hx: 4, hy: 3, sw: 5, ghosts: [[0, 0], [4, 0]] }],
    [1, { x: 10, legs: 'lunge', lean: 2, hx: 2, hy: -4, sw: -80, smear: [-80, 150, 7, 14] }],
    [1, { x: 10, y: -1, legs: 'lunge', lean: 1, hx: 2, hy: -5, sw: -95, spark: 4, smear: [-95, 0, 10, 14, 0.5] }],
    [3, { x: 9, legs: 'stride', hx: 2, hy: -5, sw: -100 }],
  ] as Frames<HeroPose>,
  back: [
    [2, { x: 1, legs: 'stride', hx: 3, hy: 4, sw: -40 }],
    [2, { legs: 'stride', sw: -60 }],
  ] as Frames<HeroPose>,
  guard: { legs: 'stride', hx: 4, hy: 2, sw: -70 } as HeroPose,
  parry: [
    [1, { legs: 'stride', x: -1, hx: 5, hy: -1, sw: -85, clang: true }],
    [2, { legs: 'stride', x: -1, hx: 5, hy: -1, sw: -85, spark: 2 }],
    [1, { legs: 'stride', hx: 4, hy: 2, sw: -65 }],
  ] as Frames<HeroPose>,
  early: [[3, { legs: 'stride', crouch: true, lean: -1, hx: 5, hy: -1, sw: -85 }]] as Frames<HeroPose>,
  dodge: [
    [1, { x: -5, y: -3, legs: 'air', lean: -2, sw: -100, ghosts: [[0, 0], [-3, -2]] }],
    [1, { x: -8, y: -2, legs: 'air', lean: -1, sw: -90, ghosts: [[-3, -2], [-6, -3]] }],
    [1, { x: -9, crouch: true, legs: 'stride', sw: -70, dust: true }],
    [2, { x: -9, sw: -60 }],
    [2, { x: -4, legs: 'stride', sw: -60 }],
  ] as Frames<HeroPose>,
  counter: [
    [1, { crouch: true, legs: 'stride', lean: -2, hx: -3, hy: 3, sw: 160 }],
    [1, { x: 8, legs: 'lunge', lean: 2, hx: 4, hy: 3, sw: 5, ghosts: [[0, 0], [4, 0]] }],
    [1, { x: 10, legs: 'lunge', lean: 2, hx: 2, hy: -4, sw: -80, smear: [-80, 150, 7, 14] }],
    [1, { x: 10, y: -1, legs: 'lunge', lean: 1, hx: 2, hy: -5, sw: -95, spark: 4, smear: [-95, 0, 10, 14, 0.5] }],
    [3, { x: 9, legs: 'stride', hx: 2, hy: -5, sw: -100 }],
    [2, { x: 3, legs: 'stride', sw: -60 }],
  ] as Frames<HeroPose>,
  hurt: [
    [1, { flash: true, x: -1, lean: -2, sw: -70 }],
    [2, { x: -3, lean: -2, crouch: true, legs: 'stride', hx: -1, hy: 2, sw: -130 }],
    [3, { x: -1, sw: -65 }],
  ] as Frames<HeroPose>,
  cheer: [
    [2, { y: -2, legs: 'air', hx: 2, hy: -5, sw: -95 }],
    [3, { hx: 2, hy: -5, sw: -95 }],
  ] as Frames<HeroPose>,
  down: { crouch: true, legs: 'stride', lean: -2, hx: 2, hy: 6, sw: 80 } as HeroPose,
};

export const FOE = {
  idle: [
    [3, {}],
    [3, { capDy: 1 }],
    [3, { crouch: true }],
    [3, { crouch: true, capDy: -1 }],
  ] as Frames<FoePose>,
  windup: [
    [2, { tilt: 2, crouch: true, ca: -75, hx: 0, hy: -2 }],
    [2, { tilt: 3, x: 1, ca: -50, hx: 1, hy: -4 }],
  ] as Frames<FoePose>,
  tellHold: { tilt: 3, x: 1, ca: -50, hx: 1, hy: -4, glint: true } as FoePose,
  feint: [
    [1, { x: -2, tilt: -1, ca: -100 }],
    [2, { tilt: 3, x: 1, ca: -45, hx: 1, hy: -4 }],
  ] as Frames<FoePose>,
  swing: [[1, { x: -6, tilt: -2, ca: 165, hx: -4, hy: 2, smear: [-190, -50, 8, 15] }]] as Frames<FoePose>,
  impact: { x: -7, tilt: -2, ca: 150, hx: -4, hy: 3, spark: 3 } as FoePose,
  recover: [
    [2, { x: -5, crouch: true, tilt: -1, ca: 145, hx: -3, hy: 3 }],
    [2, { x: -1, ca: -110 }],
  ] as Frames<FoePose>,
  rewind: [[2, { tilt: 2, ca: -70, hx: 0, hy: -2 }]] as Frames<FoePose>,
  recoil: [[2, { x: 3, tilt: 2, ca: -100 }]] as Frames<FoePose>,
  hurt: [
    [1, { flash: true, x: 2, tilt: 2 }],
    [2, { x: 1, tilt: 1 }],
  ] as Frames<FoePose>,
  stagger: [
    [3, { x: 2, crouch: true, tilt: -2, ca: 170, hx: -3, hy: 4, stars: 0 }],
    [3, { x: 2, crouch: true, tilt: 2, ca: 170, hx: -3, hy: 4, stars: 1 }],
    [3, { x: 2, crouch: true, tilt: -1, ca: 170, hx: -3, hy: 4, stars: 2 }],
  ] as Frames<FoePose>,
  down: { x: 2, crouch: true, tilt: -3, ca: 175, hx: -3, hy: 5 } as FoePose,
  happy: [
    [3, { capDy: -1, ca: -120 }],
    [3, { crouch: true, ca: -120 }],
  ] as Frames<FoePose>,
};
