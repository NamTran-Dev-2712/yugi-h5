import Phaser from 'phaser';
import { viewStore } from '../state/view-store';

export class MenuScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0a0f');

    this.add
      .text(this.scale.width / 2, 120, 'YUGI H5 RECREATE', {
        fontFamily: 'Georgia, serif',
        fontSize: '40px',
        color: '#e8c96f',
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(this.scale.width / 2, 180, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);

    const duelButton = this.add
      .text(this.scale.width / 2, 280, '[ Duel (placeholder) ]', {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#ffffff',
        backgroundColor: '#2a2a3a',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    duelButton.on('pointerup', () => this.scene.start('Duel'));

    this.updateStatusText();
    this.time.addEvent({ delay: 300, loop: true, callback: () => this.updateStatusText() });
  }

  private updateStatusText(): void {
    const status = viewStore.getState().connectionStatus;
    const label =
      status === 'connected'
        ? 'API: Connected'
        : status === 'disconnected'
          ? 'API: Disconnected'
          : 'API: Checking...';
    const color =
      status === 'connected' ? '#7fd07f' : status === 'disconnected' ? '#d07f7f' : '#aaaaaa';
    this.statusText.setText(label);
    this.statusText.setColor(color);
  }
}
