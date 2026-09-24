import type Phaser from 'phaser';
import { createDuelController } from '../duel/duel-controller';
import type { FixtureName } from '../duel/fixture-names';
import { cardLookup } from '../duel/services';

/**
 * Opens the duel screen on a fixed StateView, no server. Development only: the fixtures are imported dynamically
 * behind `import.meta.env.DEV`, so a production build contains neither this call path nor the fixture data.
 */
export async function launchFixture(scene: Phaser.Scene, name: FixtureName): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { loadFixture } = await import('../duel/fixtures');
  const controller = createDuelController({ lookup: cardLookup });
  const f = loadFixture(name);
  controller.showFixture(f.view, f.legalActions);
  scene.scene.start('Duel', { controller });
}
