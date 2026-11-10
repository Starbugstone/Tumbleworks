import { t } from '../i18n';

export interface WorldLocation {
  readonly name: string;
  readonly creation: string;
  readonly terrain: number;
  readonly roof: number;
  readonly accent: number;
  readonly kind: 'harbour' | 'garden' | 'mill' | 'clock' | 'bridge' | 'glass';
}

/** Locations follow geography, independently of the colours used by their puzzle boards. */
export function worldLocation(chapter: number): WorldLocation {
  const locations: readonly WorldLocation[] = [
    { name: t('Little Harbour', 'Le petit port'), creation: t('The harbour relay', 'Le relais du port'), terrain: 0x71958a, roof: 0xc66c4b, accent: 0xffca6d, kind: 'harbour' },
    { name: t('Glasshouse Gardens', 'Les jardins de verre'), creation: t('The watering chain', 'La cascade des arrosoirs'), terrain: 0x789773, roof: 0x528b86, accent: 0xf0c478, kind: 'garden' },
    { name: t('Willow Mill', 'Le moulin des saules'), creation: t('The bucket lift', 'L’ascenseur à godets'), terrain: 0x88956c, roof: 0xb76545, accent: 0xe8b86e, kind: 'mill' },
    { name: t('Clockmaker’s Hill', 'La colline de l’horloger'), creation: t('The spiral clock', 'L’horloge en spirale'), terrain: 0x82918b, roof: 0x68769e, accent: 0xf5c872, kind: 'clock' },
    { name: t('Cloud Bridge', 'Le pont des nuages'), creation: t('The swinging crossing', 'La traversée suspendue'), terrain: 0x8a9aa0, roof: 0x587980, accent: 0xf1c68a, kind: 'bridge' },
    { name: t('High Glassworks', 'La verrerie des hauteurs'), creation: t('The great release', 'Le grand départ'), terrain: 0x999f8f, roof: 0x6c8990, accent: 0xffcc85, kind: 'glass' },
    { name: t('Orchard Steps', 'Les terrasses du verger'), creation: t('The seesaw orchard', 'Le verger à bascules'), terrain: 0x8b9d76, roof: 0xb16b52, accent: 0xf0c477, kind: 'garden' },
    { name: t('Copper Village', 'Le village de cuivre'), creation: t('The counterweight dance', 'La danse des contrepoids'), terrain: 0x82978a, roof: 0xb78261, accent: 0xf3c77c, kind: 'mill' },
    { name: t('Windward Ridge', 'La crête des vents'), creation: t('The wind chimes', 'Les carillons du vent'), terrain: 0x92a2a1, roof: 0x688594, accent: 0xf1d29b, kind: 'bridge' },
    { name: t('Starwatch Terrace', 'La terrasse des étoiles'), creation: t('The turning sky', 'Le ciel tournant'), terrain: 0x89949f, roof: 0x636d99, accent: 0xffd78a, kind: 'clock' },
    { name: t('Summit Workshop', 'L’atelier du sommet'), creation: t('The twin paths', 'Les chemins jumeaux'), terrain: 0x9ba8a1, roof: 0x789598, accent: 0xf7d3a0, kind: 'glass' },
    { name: t('Valley Crown', 'La couronne de la vallée'), creation: t('One valley, one machine', 'Une vallée, une machine'), terrain: 0x8d9f91, roof: 0x637f89, accent: 0xffd489, kind: 'glass' },
  ];
  return locations[chapter % locations.length]!;
}
