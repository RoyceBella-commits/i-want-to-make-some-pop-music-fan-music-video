import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

export const FONT_SERIF = 'NotoSerifSC';
export const FONT_SANS = 'NotoSansSC';

export const fontsReady = Promise.all([
  loadFont({family: FONT_SERIF, url: staticFile('fonts/NotoSerifSC-subset.woff2'), weight: '200 900'}),
  loadFont({family: FONT_SANS, url: staticFile('fonts/NotoSansSC-subset.woff2'), weight: '100 900'}),
]);

/** Riso spot inks (same values as art/plate.py). Order matters: it is the plate channel order. */
export const INK = {
  yellow: '#FFB511',
  teal: '#00838A',
  cornflower: '#62A8E5',
  pink: '#FF48B0',
  brown: '#925F52',
} as const;
export type InkName = keyof typeof INK;
export const INK_ORDER: InkName[] = ['yellow', 'teal', 'cornflower', 'pink', 'brown'];
export const PAPER = '#F3ECDD';

export const hexRgb = (hex: string): [number, number, number] => {
  const p = parseInt(hex.slice(1), 16);
  return [((p >> 16) & 255) / 255, ((p >> 8) & 255) / 255, (p & 255) / 255];
};
