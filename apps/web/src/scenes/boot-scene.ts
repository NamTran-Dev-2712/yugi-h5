import Phaser from 'phaser';
import { isFixtureName } from '../duel/fixture-names';
import { checkHealth } from '../net/api-client';
import { viewStore } from '../state/view-store';
import { launchFixture } from './fixture-launch';
import { generatePlaceholderTextures } from './placeholder-textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generatePlaceholderTextures(this);

    checkHealth()
      .then(() => viewStore.getState().setConnectionStatus('connected'))
      .catch(() => viewStore.getState().setConnectionStatus('disconnected'));

    // Dev only: index.html?fixture=midgame|handfull|gameover opens the duel screen without a server.
    if (import.meta.env.DEV) {
      const fixture = new URLSearchParams(window.location.search).get('fixture');
      if (isFixtureName(fixture)) {
        void launchFixture(this, fixture);
        return;
      }
    }

    this.scene.start('Menu');
  }
}
