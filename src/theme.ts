// Design tokens from DESIGN.md. Screens never hardcode hex values.
export const colors = {
  ink: '#3B2A4A',
  inkSoft: '#6B5A7B',
  parchment: '#FFF6E9',
  vellum: '#FFFDF8',
  scroll: '#F3E6D2',
  lavender: '#C9B6F2',
  lavenderDeep: '#9C84D9',
  mint: '#B8E8D2',
  peach: '#FFC9B0',
  sky: '#B5D8F7',
  butter: '#FFE8A3',
  rose: '#F7B5CA',
  xpGold: '#F2C14E',
  hpRose: '#E8798F',
  manaBlue: '#7FA8E8',
  questGreen: '#5FB894',
  epicPurple: '#A77BE0',
  white: '#FFFFFF',
  // World scenery (DESIGN.md section 2, "World"): deeper tones so props stand out on the mint meadow.
  leaf: '#4E9E82',
  leafDeep: '#3A7A6A',
  bark: '#8C6B5E',
  barkDeep: '#6B4F4A',
  stone: '#DCD3E6',
  stoneDeep: '#B2A6C6',
} as const;

export const P = 4;

export const fonts = {
  display: 'PixelifySans_700Bold',
  heading: 'PixelifySans_600SemiBold',
  button: 'PixelifySans_500Medium',
  stat: 'Silkscreen_400Regular',
  body: 'Nunito_400Regular',
  bodyBold: 'Nunito_600SemiBold',
} as const;
