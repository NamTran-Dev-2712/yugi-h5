import Phaser from 'phaser';

const ZONE_SIZE = 90;
const ZONE_GAP = 12;
const ZONE_COUNT = 5;

/**
 * Placeholder duel board: 5 monster zones + 5 spell/trap zones per player,
 * drawn as plain rectangles. Real CardSprite/ZoneView rendering + drag-drop
 * lands in M4, driven by GameEvent replay — never by client-side game logic.
 */
export class DuelScene extends Phaser.Scene {
  constructor() {
    super('Duel');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#123024');

    const centerX = this.scale.width / 2;
    const rowWidth = ZONE_COUNT * ZONE_SIZE + (ZONE_COUNT - 1) * ZONE_GAP;
    const startX = centerX - rowWidth / 2;

    // Opponent rows (top), local player rows (bottom), mirrored around the middle.
    this.drawZoneRow(startX, 60, '#5b3a3a', 'S/T');
    this.drawZoneRow(startX, 60 + ZONE_SIZE + ZONE_GAP, '#3a3a5b', 'MON');
    this.drawZoneRow(startX, this.scale.height - 60 - ZONE_SIZE * 2 - ZONE_GAP, '#3a3a5b', 'MON');
    this.drawZoneRow(startX, this.scale.height - 60 - ZONE_SIZE, '#5b3a3a', 'S/T');

    this.add
      .text(centerX, this.scale.height / 2, 'Duel scene placeholder', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#889988',
      })
      .setOrigin(0.5);

    const backButton = this.add
      .text(16, 16, '< Menu', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#2a2a3a',
        padding: { x: 8, y: 4 },
      })
      .setInteractive({ useHandCursor: true });
    backButton.on('pointerup', () => this.scene.start('Menu'));
  }

  private drawZoneRow(startX: number, y: number, color: string, label: string): void {
    for (let i = 0; i < ZONE_COUNT; i++) {
      const x = startX + i * (ZONE_SIZE + ZONE_GAP);
      const rect = this.add.rectangle(
        x,
        y,
        ZONE_SIZE,
        ZONE_SIZE,
        Phaser.Display.Color.HexStringToColor(color).color,
      );
      rect.setStrokeStyle(2, 0xffffff, 0.3);
      rect.setOrigin(0, 0);
      this.add
        .text(x + ZONE_SIZE / 2, y + ZONE_SIZE / 2, label, {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
        })
        .setOrigin(0.5)
        .setAlpha(0.5);
    }
  }
}
