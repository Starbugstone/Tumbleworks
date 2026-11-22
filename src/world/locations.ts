import themes from './village-themes.json' with { type: 'json' };
import { t } from '../i18n';

export interface WorldLocation {
  readonly name: string;
  readonly creation: string;
  readonly terrain: number;
  readonly backdropFocus: readonly [number,number];
  readonly roof: number;
  readonly accent: number;
  readonly kind: 'harbour' | 'garden' | 'mill' | 'clock' | 'bridge' | 'glass' | 'saltworks' | 'pottery';
}

export function worldLocation(chapter: number): WorldLocation {
  const theme = themes[chapter % themes.length]!;
  return {
    backdropFocus: [theme.backdropFocus?.[0] ?? 0, theme.backdropFocus?.[1] ?? 0],
    name: t(theme.name[0]!,theme.name[1]!), creation: t(theme.creation[0]!,theme.creation[1]!),
    terrain: parseInt(theme.terrain.slice(1),16), roof: parseInt(theme.roof.slice(1),16),
    accent: parseInt(theme.accent.slice(1),16), kind: theme.kind as WorldLocation['kind'],
  };
}

/** Let the lightweight loading screen and menus follow the same chapter as the live scene. */
export function showVillageTheme(chapter: number): void {
  const theme = themes[chapter % themes.length]!;
  document.documentElement.dataset.village = theme.id;
  window.dispatchEvent(new Event('village-theme'));
}
