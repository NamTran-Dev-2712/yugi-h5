/** Names only (no data), so the menu can list them without pulling the fixtures into the production bundle. */
export const FIXTURE_NAMES = ['midgame', 'handfull', 'gameover'] as const;
export type FixtureName = (typeof FIXTURE_NAMES)[number];

export function isFixtureName(value: string | null | undefined): value is FixtureName {
  return (FIXTURE_NAMES as readonly string[]).includes(value ?? '');
}
