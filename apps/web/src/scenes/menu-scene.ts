import Phaser from 'phaser';
import type { DuelController } from '../duel/duel-controller';
import { FIXTURE_NAMES } from '../duel/fixture-names';
import { t } from '../i18n/i18n';
import { createAppController } from '../duel/services';
import { strings } from '../duel/strings';
import { theme } from '../duel/theme';
import { viewStore } from '../state/view-store';
import { launchFixture } from './fixture-launch';

export class MenuScene extends Phaser.Scene {
  private statusText!: Phaser.GameObjects.Text;
  private messageText!: Phaser.GameObjects.Text;
  private controller: DuelController | null = null;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0a0a0f');
    const cx = this.scale.width / 2;

    this.add
      .text(cx, 150, strings.menuTitle, {
        fontFamily: theme.fonts.title,
        fontSize: '48px',
        color: theme.css.gold,
      })
      .setOrigin(0.5);

    this.statusText = this.add
      .text(cx, 215, '', { fontFamily: theme.fonts.mono, fontSize: '16px', color: '#aaaaaa' })
      .setOrigin(0.5);

    this.button(cx, 320, strings.playVsAi, () => void this.startVsAi());

    this.messageText = this.add
      .text(cx, 385, '', {
        fontFamily: theme.fonts.ui,
        fontSize: '15px',
        color: theme.css.danger,
        wordWrap: { width: 600 },
        align: 'center',
      })
      .setOrigin(0.5, 0);

    if (import.meta.env.DEV) this.devFixtureButtons(cx);

    this.updateStatusText();
    this.time.addEvent({ delay: 300, loop: true, callback: () => this.updateStatusText() });
  }

  private async startVsAi(): Promise<void> {
    if (this.controller) return;
    const controller = createAppController();
    this.controller = controller;
    this.messageText.setColor(theme.css.gold).setText(strings.starting);
    await controller.start();
    this.controller = null;
    if (controller.getState().duelId === null) {
      this.messageText
        .setColor(theme.css.danger)
        .setText(`${strings.startFailed}\n${controller.getState().error ?? ''}`);
      return;
    }
    this.scene.start('Duel', { controller });
  }

  /** Dev only: look at the duel screen without a server. Also reachable as `?fixture=<name>`. */
  private devFixtureButtons(cx: number): void {
    this.add
      .text(cx, 500, 'DEV — fixtures (không cần server)', {
        fontFamily: theme.fonts.mono,
        fontSize: '13px',
        color: theme.css.textDim,
      })
      .setOrigin(0.5);
    FIXTURE_NAMES.forEach((name, i) => {
      // Two rows of four so all fixtures stay inside the frame.
      this.button(
        cx - 345 + (i % 4) * 230,
        545 + Math.floor(i / 4) * 50,
        name,
        () => void launchFixture(this, name),
        14,
      );
    });
  }

  private button(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    size = 22,
  ): Phaser.GameObjects.Text {
    const b = this.add
      .text(x, y, `[ ${label} ]`, {
        fontFamily: theme.fonts.mono,
        fontSize: `${size}px`,
        color: '#ffffff',
        backgroundColor: '#2a2a3a',
        padding: { x: 16, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    b.on('pointerup', onClick);
    return b;
  }

  private updateStatusText(): void {
    const status = viewStore.getState().connectionStatus;
    const label =
      status === 'connected'
        ? t('duel.apiConnected')
        : status === 'disconnected'
          ? t('duel.apiDisconnected')
          : t('duel.apiChecking');
    const color =
      status === 'connected' ? '#7fd07f' : status === 'disconnected' ? '#d07f7f' : '#aaaaaa';
    this.statusText.setText(label);
    this.statusText.setColor(color);
  }
}
