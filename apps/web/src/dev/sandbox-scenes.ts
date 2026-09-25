import Phaser from 'phaser';
import type { DuelController } from '../duel/duel-controller';
import { generatePlaceholderTextures } from '../scenes/placeholder-textures';

/**
 * The two tiny scenes the Sandbox needs around the REAL `DuelScene` (which is reused untouched): Boot draws the
 * placeholder textures and opens the duel on an already-loaded controller; Menu is what `DuelScene`'s back / result
 * buttons jump to (`scene.start('Menu')`), which in the Sandbox means "close the game, show the loader again".
 */
export class SandboxBootScene extends Phaser.Scene {
  constructor(private readonly controller: DuelController) {
    super('Boot');
  }

  create(): void {
    generatePlaceholderTextures(this);
    this.scene.start('Duel', { controller: this.controller });
  }
}

export class SandboxMenuScene extends Phaser.Scene {
  constructor(private readonly onExit: () => void) {
    super('Menu');
  }

  create(): void {
    this.onExit();
  }
}
