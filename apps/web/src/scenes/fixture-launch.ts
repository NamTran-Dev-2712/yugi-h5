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
  const { loadFixture, FIXTURE_CARDS } = await import('../duel/fixtures');
  // The chain fixtures (task 3.7) use test-only cards that exist only in the fixture module.
  const testCards = new Map(FIXTURE_CARDS.map((c) => [c.id, c]));
  const controller = createDuelController({
    lookup: (id) => cardLookup(id) ?? testCards.get(id),
  });
  const f = loadFixture(name);
  controller.showFixture(f.view, f.legalActions);
  scene.scene.start('Duel', { controller });
}
