import { PATRONS, bartenderPortrait, patronPortrait, strangerPortrait, type BartenderMood, type Patron } from '../sprites/bar';
import { butcherPortrait, shroomiePortrait, type ButcherMood } from '../sprites/characters';
import { merchantPortrait, type MerchantMood } from '../sprites/merchant';
import { ownerPortrait, type OwnerMood } from '../sprites/town';
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
// 'hostile' until you beat him, 'ask' once he's offered the job, 'quest' / 'ready' while you gather
// the wood, 'building' while he rebuilds, 'opened' the first time you see the finished shack, and
// 'shop' after that. End tags: 'fight' starts the battle, 'accept' starts the hut quest, 'decline'
// leaves it open, 'handin' gives him the wood and starts the rebuild.
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
  ready: { say: "Ten logs! That'll do it.", mood: 'calm', name: 'Butcher', next: 'ready2' },
  ready2: { say: "Give me ten minutes with my hammer and she'll be standing again.", mood: 'calm', end: 'handin' },

  building: { say: "Can't stop now, I'm hammering! She'll be done before you know it.", mood: 'calm', name: 'Butcher' },

  // He buys meat at his shop (see butcherScript). The trips to town come later.
  opened: { say: "She's done! A proper butcher shack again. Thank you, friend.", mood: 'calm', name: 'Butcher', next: 'opened2' },
  opened2: { say: "Bring me any meat you find, and I'll pay you for it.", mood: 'calm', next: 'opened3' },
  opened3: { say: 'And when I take it into town to sell, half the profit is yours.', mood: 'calm', end: 'opened' },
  shop: { say: 'Got any meat for me? Boars root around in the woods past the east gap.', mood: 'calm', name: 'Butcher' },
};

// The butcher's script with his shop counter filled in: with boar meat in your inventory he offers
// to buy all of it. End tag 'sell' sells it.
export function butcherScript(meat: number, price: number): Script {
  if (meat < 1) return BUTCHER_SCRIPT;
  return {
    ...BUTCHER_SCRIPT,
    shop: {
      say: "Got any meat for me? I'll pay fair.",
      mood: 'calm',
      name: 'Butcher',
      choices: [
        { label: `Sell ${meat} boar meat (${meat * price} coins)`, next: 'sold' },
        { label: 'Not now', next: 'later' },
      ],
    },
    sold: { say: 'Fine meat. Bring me more!', mood: 'calm', end: 'sell' },
    later: { say: 'Suit yourself. My door is open.', mood: 'calm' },
  };
}

// ---------- Puul the merchant ----------
// He's "???" until he tells you his name after the rescue.
const merchantVoice = require('../../assets/sounds/merchant.wav');

export const MERCHANT_SPEAKER: Speaker = {
  key: 'merchant',
  name: '???',
  voice: merchantVoice,
  loop: true,
  portrait: (mood, talking) => merchantPortrait((mood as MerchantMood) ?? 'calm', talking),
};
// Once you know him.
export const PUUL_SPEAKER: Speaker = { ...MERCHANT_SPEAKER, key: 'puul', name: 'Puul' };

// How far you've got with Puul: 'lost' in the woods until you save him, 'escort' while he follows
// you home, 'home' once he's on your base (offering the stand job), 'stand' while you gather the
// wood, 'open' once it's built.
export type MerchantStage = 'lost' | 'escort' | 'home' | 'stand' | 'open';
export const STAND_WOOD = 20;

// End tags: 'fight' starts the rescue battle, 'follow' sets off for home, 'accept' starts the
// stand quest, 'decline' leaves it open, 'handin' gives him the wood.
export const MERCHANT_SCRIPT: Script = {
  help: { say: 'Gyahhh! Oh, hey, HEY! Please, you there, please help me!', mood: 'scared', end: 'fight' },
  again: { say: "You came back! Please, they won't let me go!", mood: 'scared', end: 'fight' },

  saved: { say: '...', mood: 'calm', silent: true, next: 'saved2' },
  saved2: { say: 'Phew! I thought I was boar food for sure. Thank you, friend. Truly!', mood: 'happy', next: 'name' },
  name: {
    say: "I'm a merchant. The name's Puul. Those brutes ran off with my cart and scattered my wares.",
    mood: 'calm',
    name: 'Puul',
    choices: [{ label: "I've got a base just west of here. You can stay there.", next: 'place' }],
  },
  place: { say: "Wow, you have a place? That's great! I'll move into your base and handle your trade.", mood: 'happy', next: 'lead' },
  lead: { say: "Lead the way, I'll stick right behind you. Away from the boars, please!", mood: 'calm', end: 'follow' },
  escort: { say: "I'm right behind you! Your base is out the west gap, yes?", mood: 'calm', name: 'Puul' },

  home: { say: 'So this is your place! Lovely. And plenty of room for a stand.', mood: 'happy', name: 'Puul', next: 'ask' },
  ask: {
    say: `I'll need a merchant stand to trade from. ${STAND_WOOD} wood should do it. Will you help me build it?`,
    mood: 'calm',
    name: 'Puul',
    choices: [
      { label: 'Yes', next: 'yes' },
      { label: 'Not yet', next: 'no' },
    ],
  },
  yes: { say: `Wonderful! Bring me ${STAND_WOOD} wood and we're in business.`, mood: 'happy', end: 'accept' },
  no: { say: "No rush. I'll be right here when you're ready.", mood: 'calm', end: 'decline' },

  quest: { say: `${STAND_WOOD} wood is all I need. The trees round here will do nicely.`, mood: 'calm', name: 'Puul' },
  ready: { say: `That's ${STAND_WOOD} wood! Stand back, I know just what to do.`, mood: 'happy', name: 'Puul', end: 'handin' },
  open: { say: "Puul's stand is open! When the trade caravans start coming by, I'll handle all your deals.", mood: 'happy', name: 'Puul' },
};

// ---------- The town ----------
// Mira runs the critter store with three little Shroomie helpers. She's "???" until she says her
// name. The store isn't open yet: what it sells comes later.
const shopkeeperVoice = require('../../assets/sounds/shopkeeper.wav');

export const OWNER_SPEAKER: Speaker = {
  key: 'shopkeeper',
  name: '???',
  voice: shopkeeperVoice,
  loop: true,
  portrait: (mood, talking) => ownerPortrait((mood as OwnerMood) ?? 'calm', talking),
};
export const HELPER_NAMES = ['Pip', 'Dot', 'Bun'];

// 'hi' the first time you meet her, 'again' after that.
export const OWNER_SCRIPT: Script = {
  hi: { say: "Oh! Hello there! You must be new in town. Welcome!", mood: 'happy', next: 'name' },
  name: { say: "I'm Mira, and this is my critter store. I look after all sorts of little creatures.", mood: 'calm', name: 'Mira', next: 'helpers' },
  helpers: { say: 'Those three are my helpers, Pip, Dot and Bun. Say hi, everyone!', mood: 'happy', next: 'soon' },
  soon: { say: "Everything in the store is for sale, for coins. We're still stocking the shelves, so come back soon!", mood: 'calm', end: 'met' },
  again: { say: "Welcome back! The shelves are still filling up. Everything's for sale for coins once they're stocked!", mood: 'happy', name: 'Mira' },
};

export function helperSpeaker(look: number): Speaker {
  return critterSpeaker(HELPER_NAMES[look] ?? 'Helper', look);
}
// Each helper squeaks something a little different.
export const HELPER_SCRIPT: Script = {
  hi0: { say: '...Weeiii! Weeiii-wi!' },
  hi1: { say: '...Wi? ...Wiiiiii!' },
  hi2: { say: '...WEEEI! Wi-wi-wi!' },
};

// ---------- The bar ----------
// Barley pours the drinks. He welcomes you to town and asks you to split his firewood: a log pile
// and a chopping block out back, round the right side of the bar.
const bartenderVoice = require('../../assets/sounds/bartender.wav');
const patronVoices = {
  low: require('../../assets/sounds/patron_low.wav'),
  high: require('../../assets/sounds/patron_high.wav'),
  old: require('../../assets/sounds/patron_old.wav'),
};

// How far you've got with Barley: 'new' until you take the job, 'quest' while you split the logs,
// 'done' once you've told him.
export type BartenderStage = 'new' | 'quest' | 'done';
export const FIREWOOD_NEED = 5;
export const FIREWOOD_REWARD = 15; // coins

export const BARTENDER_SPEAKER: Speaker = {
  key: 'bartender',
  name: '???',
  voice: bartenderVoice,
  loop: true,
  portrait: (mood, talking) => bartenderPortrait((mood as BartenderMood) ?? 'calm', talking),
};

// Where he starts: 'hi' the first time, 'ask' if you turned the job down, 'quest' / 'ready' while
// you're on it, 'done' after. End tags: 'accept' starts the job, 'decline' leaves it open,
// 'handin' tells him the firewood's split.
export function bartenderScript(have: number): Script {
  return {
    hi: { say: "Well now! A new face. You're new in town, aren't you?", mood: 'happy', next: 'name' },
    name: { say: "Name's Barley. I pour the drinks round here. Glad to have you, friend!", mood: 'happy', name: 'Barley', next: 'fire' },
    fire: { say: "Say... could I ask you a favor? My fire's burning low and I'm clean out of firewood.", mood: 'calm', next: 'ask' },
    ask: {
      say: `There's a pile of logs out back, round the right side. Would you split some on the block for me? ${FIREWOOD_NEED} logs should be enough.`,
      mood: 'calm',
      name: 'Barley',
      choices: [
        { label: 'Sure thing', next: 'yes' },
        { label: 'Not now', next: 'no' },
      ],
    },
    yes: { say: "You're a lifesaver! Out the door and round the right side. Mind your toes.", mood: 'happy', end: 'accept' },
    no: { say: 'No trouble. The offer stands... and so does the fire, barely.', mood: 'calm', end: 'decline' },
    quest: {
      say: have > 0 ? `${have} split so far! ${FIREWOOD_NEED} logs should be enough. The block's out back, round the right side.` : `The log pile's out back, round the right side. ${FIREWOOD_NEED} logs should be enough.`,
      mood: 'calm',
      name: 'Barley',
    },
    ready: { say: 'Is that the sound of firewood stacking up? All five! That will keep her roaring for a week.', mood: 'happy', name: 'Barley', next: 'pay' },
    pay: { say: "Here, for your trouble. And from now on you're one of the regulars.", mood: 'happy', end: 'handin' },
    done: { say: "Fire's roaring, thanks to you. Pull up a stool any time, friend.", mood: 'happy', name: 'Barley' },
  };
}

export function patronSpeaker(i: number): Speaker {
  const p: Patron = PATRONS[i];
  return { key: `patron-${i}`, name: p.name, voice: patronVoices[p.voice], loop: true, portrait: (_m, talking) => patronPortrait(p, talking) };
}
// Three tables of two. Each talks about the friend across the table. 'warm' once the fire's lit.
export const PATRON_SCRIPTS: Script[] = [
  { hi: { say: "Marigold says that's her lucky chair. She's lost every game of cards she's played in it." } },
  { hi: { say: "Don't listen to Hob. The chair is lucky. I'm just terrible at cards." } },
  { hi: { say: 'Boars are getting bolder out in the woods. Wendel swears he fought one off with a spoon.' } },
  {
    hi: { say: 'A soup spoon, mind. Back in my day we... hm? Where was I? Oh, my knees ache in this cold.' },
    warm: { say: 'Ahh, a proper fire at last. My old knees thank you, young one.' },
  },
  { hi: { say: "Mira's little helpers waved at me this morning! Fen says I'm too old to squeal about it. I'm not." } },
  { hi: { say: "Don't stare at the one in the corner. Been sitting there for days and never ordered a drop." } },
];

// The hooded stranger in the dark corner. Never a word.
export const STRANGER_SPEAKER: Speaker = { key: 'stranger', name: '???', voice: bartenderVoice, portrait: () => strangerPortrait() };
export const STRANGER_SCRIPT: Script = {
  hi: { say: '...', silent: true, next: 'hi2' },
  hi2: { say: '...', silent: true },
};
