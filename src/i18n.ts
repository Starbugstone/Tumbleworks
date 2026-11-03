import { locale } from './preferences';
import type { Color } from './sim/types';
import type { Difficulty } from './engine/contracts';

/** Both languages live at each call site, so new player-facing copy cannot silently omit French. */
export const t = (english: string, french: string): string => locale() === 'fr' ? french : english;
export const colorName = (color: Color): string => ({ red: t('red', 'rouge'), blue: t('blue', 'bleu'), green: t('green', 'vert'), yellow: t('yellow', 'jaune'), orange: t('orange', 'orange') })[color];
export const patternName = (color: Color): string => ({ red: t('Ring', 'Anneau'), blue: t('Diamond', 'Losange'), green: t('Triangle', 'Triangle'), yellow: t('Star', 'Étoile'), orange: t('Cross', 'Croix') })[color];
export const difficultyName = (difficulty: Difficulty): string => ({ 'Getting started': t('Getting started', 'Premiers pas'), 'Finding a rhythm': t('Finding a rhythm', 'Trouver le rythme'), 'Thinking ahead': t('Thinking ahead', 'Anticiper'), 'Full spectrum': t('Full spectrum', 'Toutes les couleurs') })[difficulty];
const frenchTitles: Record<string, string> = {
  'board-1': 'Faire de la place', 'board-2': 'Une couleur d’avance', 'board-3': 'Derrière les lignes', 'board-4': 'Deux erreurs', 'board-5': 'Le grand détour',
  'board-6': 'Le premier pont', 'board-7': 'La grande traversée', 'board-8': 'L’orange arrive', 'board-9': 'Petits versements', 'board-10': 'Cinq couleurs en huit',
  'board-11': 'Le grand tour', 'board-12': 'Deux hautes piles', 'board-13': 'Tapis serré', 'board-14': 'Piles inégales', 'board-15': 'Court et doux',
  'board-16': 'Petite traversée', 'board-17': 'Goulot étroit', 'board-18': 'Large et serré', 'board-19': 'Trois sur quatre', 'board-20': 'Mesures mélangées',
  'board-21': 'Paires de couleurs', 'board-22': 'La compression', 'board-23': 'Treize plateaux', 'board-24': 'Maison pleine', 'board-25': 'Huit en petit',
  'board-26': 'Piles profondes', 'board-27': 'Trois quais, cinq couleurs', 'board-28': 'Quatorze plateaux', 'board-29': 'Petites mesures, grand tapis', 'board-30': 'Grand final',
  'loop-1': 'Le premier échange', 'loop-2': 'Trois couleurs en route', 'loop-3': 'Trois voies', 'loop-4': 'Trafic dense', 'loop-5': 'Embouteillage',
  'loop-6': 'Le pont des camions', 'loop-7': 'Huit en mouvement', 'loop-8': 'L’orange arrive', 'loop-9': 'Cinq voies', 'loop-10': 'Le pont orange',
  'loop-11': 'Heure de pointe', 'loop-12': 'Deux voies, longues files', 'loop-13': 'Trois couleurs à l’étroit', 'loop-14': 'Triples charges', 'loop-15': 'Cinq voies, un camion',
  'loop-16': 'Neuf sur le pont', 'loop-17': 'Demi-charges', 'loop-18': 'Dix camions', 'loop-19': 'Anneau étroit', 'loop-20': 'Grande traversée, trois de fond',
  'loop-21': 'Départ encombré', 'loop-22': 'Trois voies, trois de fond', 'loop-23': 'Huit serré', 'loop-24': 'Trois voies, quatre couleurs', 'loop-25': 'Cinq voies, neuf camions',
  'loop-26': 'Grande traversée serrée', 'loop-27': 'Dix sur l’ovale', 'loop-28': 'Trois couleurs, trois charges', 'loop-29': 'Heure de pointe en huit', 'loop-30': 'Grand final',
  // BEGIN first stretch
  'board-31': 'Deux par deux', 'board-32': 'Une troisième colonne', 'board-33': 'Le mauvais plateau', 'board-34': 'Deux quais', 'board-35': 'Un peu d’air', 'board-36': 'Le jaune s’invite', 'board-37': 'Quatre couleurs, trois quais', 'board-38': 'Chacun son tour', 'board-39': 'Huit plateaux', 'loop-32': 'Un derrière', 'loop-33': 'Deux files', 'loop-34': 'Cinq en route', 'loop-35': 'Du jaune sur l’anneau', 'loop-36': 'Six camions', 'loop-37': 'Un départ dégagé', 'loop-38': 'Trois en un', 'loop-39': 'Charges profondes', 'loop-40': 'Tout en douceur', 'tube-31': 'Petit mélange', 'tube-32': 'Aller-retour', 'tube-33': 'Plus mélangé', 'tube-34': 'À dix coups', 'tube-35': 'Quatre bien mêlées', 'tube-36': 'Long démêlage', 'tube-37': 'La voie étroite', 'board-40': 'Moins de quais que de couleurs', 'board-41': 'Du jaune, sans quai libre', 'board-42': 'Un quai chacun', 'board-43': 'L’orange arrive', 'board-44': 'Colonnes profondes', 'board-46': 'Le premier huit', 'board-47': 'Neuf plateaux', 'loop-41': 'Creuser jusqu’à la cabine', 'loop-42': 'Toutes les files pleines', 'loop-43': 'Petites charges', 'loop-44': 'De l’orange sur la route', 'loop-45': 'Quatre quais', 'loop-46': 'Cinq couleurs, six camions', 'loop-47': 'Deux tronçons chacun', 'loop-48': 'L’heure de pointe', 'tube-38': 'Un seul tube libre', 'tube-39': 'Attention au tube libre', 'tube-40': 'Quatre couleurs, un tube libre', 'tube-41': 'Pas de seconde chance', 'tube-42': 'Prévoir le tube vide', 'tube-43': 'Cinq de haut', 'tube-44': 'De l’orange dans les tubes', 'tube-46': 'Le dernier tube libre',
// END first stretch
  'loop-31': 'Moitié-moitié',
  'tube-1': 'Un peu de place', 'tube-2': 'Courants croisés', 'tube-3': 'Une place libre', 'tube-4': 'Tubes plus hauts', 'tube-5': 'Une place, cinq de haut',
  'tube-6': 'Une cinquième couleur', 'tube-7': 'Cinq sur cinq', 'tube-8': 'Remplissage lâche', 'tube-9': 'Quatre, cinq, deux', 'tube-10': 'Six de haut',
  'tube-11': 'Sans marge', 'tube-12': 'Éparpillé', 'tube-13': 'Trois couleurs, six de haut', 'tube-14': 'Cinq couleurs, une place', 'tube-15': 'Quatre couleurs, six de haut',
  'tube-16': 'Étalé', 'tube-17': 'Quatre, cinq, un', 'tube-18': 'Trente billes', 'tube-19': 'Cinq et cinq', 'tube-20': 'Six tubes, cinq couleurs',
  'tube-21': 'Une place, six de haut', 'tube-22': 'Longue route', 'tube-23': 'Largement étalé', 'tube-24': 'Cinq couleurs, quatre de haut', 'tube-25': 'Grand et lâche',
  'tube-26': 'Trois couleurs, long chemin', 'tube-27': 'Cinq de haut, sans marge', 'tube-28': 'Une place, cinq couleurs, six de haut', 'tube-29': 'Trente, deux places', 'tube-30': 'Grand final',
};
export const levelTitle = (id: string, english: string): string => t(english, frenchTitles[id] ?? english);
