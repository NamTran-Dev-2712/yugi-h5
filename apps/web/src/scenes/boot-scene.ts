import Phaser from 'phaser';
import { checkHealth } from '../net/api-client';
import { viewStore } from '../state/view-store';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    checkHealth()
      .then(() => viewStore.getState().setConnectionStatus('connected'))
      .catch(() => viewStore.getState().setConnectionStatus('disconnected'));

    this.scene.start('Menu');
  }
}
