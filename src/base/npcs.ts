import { butcherPortrait, shroomiePortrait, type ButcherMood } from '../sprites/characters';
import type { Script, Speaker } from './Conversation';

// Who you can talk to on the base, and what they say.

const shroomieVoice = require('../../assets/sounds/shroomie.wav');
const oldManVoice = require('../../assets/sounds/oldman.wav');

export function critterSpeaker(name: string, look: number): Speaker {
  return { key: `critter-${look}`, name, voice: shroomieVoice, portrait: (_mood, talking) => shroomiePortrait(look, talking) };
}

// A zero-width space lets the line wrap after the first long "Weeeeeiiiie" on a narrow phone.
export const CRITTER_SCRIPT: Script = {
  hi: { say: '...Weeeeeiiiie​WeWeWeeeiiiiii...' },
};

export const BUTCHER_SPEAKER: Speaker = {
  key: 'butcher',
  name: 'Old Man',
  voice: oldManVoice,
  loop: true,
  portrait: (mood, talking) => butcherPortrait((mood as ButcherMood) ?? 'calm', talking),
};

// The old butcher's story. Where he starts depends on how far you've got with him (see BaseScreen):
// 'hostile' until you beat him, 'ask' once he's offered the job, 'quest' after you take it on.
// End tags: 'fight' starts the battle, 'accept' starts the hut quest, 'decline' leaves it open.
export const BUTCHER_SCRIPT: Script = {
  hostile: {
    say: 'Whoa! Get back! Who are you?',
    mood: 'angry',
    choices: [
      { label: "Calm down, I'm here to help. Just bought this land.", next: 'threat' },
      { label: 'Stand down! This is my land now.', next: 'threat' },
    ],
  },
  threat: { say: "I've dealt with the Imperial Marshals before. You won't destroy my home again!", mood: 'angry', end: 'fight' },

  spared: { say: '...', mood: 'quiet', silent: true, next: 'spared2' },
  spared2: { say: '...', mood: 'quiet', silent: true, next: 'sorry' },
  sorry: { say: "You're strong... but you spared me. Sorry for being hostile.", mood: 'calm', next: 'trade' },
  trade: { say: "I'm a butcher. A good one too.", mood: 'calm', name: 'Butcher', next: 'meat' },
  meat: { say: 'Bring me anything, lowest level boar, to dragon meat.', mood: 'calm', next: 'heh' },
  heh: { say: 'As if you could get any... heh heh...', mood: 'calm', next: 'ask' },
  ask: {
    say: 'Only... I need my hut rebuilt. Could you help me?',
    mood: 'calm',
    name: 'Butcher',
    choices: [
      { label: 'Yes', next: 'yes' },
      { label: 'No', next: 'no' },
    ],
  },
  yes: { say: "Thanks a million!! About 10 wood logs should do it... I promise I'll repay you!", mood: 'calm', end: 'accept' },
  no: { say: 'Oh... okay. Maybe later.', mood: 'quiet', end: 'decline' },

  quest: { say: 'About 10 wood logs should do it. The trees around here will give you plenty.', mood: 'calm', name: 'Butcher' },
  // Placeholder until the hand-in and rebuild are designed.
  ready: { say: "That's plenty of wood! Give an old man a moment, and we'll get building.", mood: 'calm', name: 'Butcher' },
};
