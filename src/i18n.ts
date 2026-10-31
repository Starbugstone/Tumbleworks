import { locale } from './preferences';
import type { Color } from './sim/types';
import type { Difficulty } from './engine/contracts';

/** Both languages live at each call site, so new player-facing copy cannot silently omit French. */
export const t = (english: string, french: string): string => locale() === 'fr' ? french : english;
export const colorName = (color: Color): string => ({ red: t('red', 'rouge'), blue: t('blue', 'bleu'), green: t('green', 'vert'), yellow: t('yellow', 'jaune') })[color];
export const patternName = (color: Color): string => ({ red: t('Ring', 'Anneau'), blue: t('Diamond', 'Losange'), green: t('Triangle', 'Triangle'), yellow: t('Star', 'Étoile') })[color];
export const difficultyName = (difficulty: Difficulty): string => ({ 'Getting started': t('Getting started', 'Premiers pas'), 'Finding a rhythm': t('Finding a rhythm', 'Trouver le rythme'), 'Thinking ahead': t('Thinking ahead', 'Anticiper') })[difficulty];
const frenchTitles: Record<string, string> = {
  'board-1': 'Faire de la place', 'board-2': 'Une couleur d’avance', 'board-3': 'Derrière les lignes', 'board-4': 'Deux erreurs', 'board-5': 'Le grand détour',
  'loop-1': 'Le premier échange', 'loop-2': 'Trois couleurs en route', 'loop-3': 'Trois voies', 'loop-4': 'Trafic dense', 'loop-5': 'Embouteillage',
  'tube-1': 'Un peu de place', 'tube-2': 'Courants croisés', 'tube-3': 'Une place libre',
  'board-6': 'Le premier pont', 'board-7': 'La grande traversée', 'loop-6': 'Le pont des camions', 'loop-7': 'Huit en mouvement',
};
export const levelTitle = (id: string, english: string): string => t(english, frenchTitles[id] ?? english);
