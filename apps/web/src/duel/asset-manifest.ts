import { theme } from './theme';

/**
 * Every texture the duel screen uses, under a stable key. Today all of them are placeholders drawn in code by the
 * Boot scene (`source: 'generated'`); replacing one with a real image means changing its entry to
 * `{ source: 'file', file: 'ui/...' }` and loading it in Boot — scenes only ever use the key.
 * See docs/plan/asset-list-vertical-slice.md for sizes and file names.
 */

export type TextureKey =
  | 'board-bg'
  | 'card-frame-monster'
  | 'card-frame-spell'
  | 'card-frame-trap'
  | 'card-back'
  | 'zone-slot';

export interface TextureAsset {
  readonly key: TextureKey;
  readonly width: number;
  readonly height: number;
  readonly source: 'generated' | 'file';
  /** Path under `assets/` (or the public folder) when `source` is 'file'. */
  readonly file?: string;
}

const { zoneW, zoneH } = theme.card;

export const TEXTURE_MANIFEST: readonly TextureAsset[] = [
  { key: 'board-bg', width: theme.frame.width, height: theme.frame.height, source: 'generated' },
  { key: 'card-frame-monster', width: zoneW, height: zoneH, source: 'generated' },
  { key: 'card-frame-spell', width: zoneW, height: zoneH, source: 'generated' },
  { key: 'card-frame-trap', width: zoneW, height: zoneH, source: 'generated' },
  { key: 'card-back', width: zoneW, height: zoneH, source: 'generated' },
  { key: 'zone-slot', width: zoneW, height: zoneH, source: 'generated' },
];

export const frameKey = {
  monster: 'card-frame-monster',
  spell: 'card-frame-spell',
  trap: 'card-frame-trap',
} as const satisfies Record<string, TextureKey>;
