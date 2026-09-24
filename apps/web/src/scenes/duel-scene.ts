import Phaser from 'phaser';
import type { DuelController, DuelUiState } from '../duel/duel-controller';
import { formatDetail } from '../duel/detail-text';
import { computeLayout, staticRects, type Rect } from '../duel/layout';
import { present, type CardDetail, type RenderModel } from '../duel/presenter';
import { cardLookup } from '../duel/services';
import { strings } from '../duel/strings';
import { theme } from '../duel/theme';
import { createCardView } from './card-view';

export interface DuelSceneData {
  readonly controller: DuelController;
}

const LOG_LINES = 24;

/**
 * Draws a RenderModel and forwards clicks to the controller. Nothing here knows a game rule: what is on screen comes
 * from `present()`, what a button does comes from the action the server listed. The dynamic layer is rebuilt on every
 * state change (animation by event is task 2.9).
 */
export class DuelScene extends Phaser.Scene {
  private controller!: DuelController;
  private layout = computeLayout();
  private dynamic!: Phaser.GameObjects.Container;
  private detailText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super('Duel');
  }

  init(data: DuelSceneData): void {
    this.controller = data.controller;
  }

  create(): void {
    this.add.image(0, 0, 'board-bg').setOrigin(0, 0);
    for (const { name, rect } of staticRects(this.layout)) {
      if (/\.(monster|spellTrap|field|extraDeck|deck|graveyard)/.test(name)) {
        this.add.image(rect.x, rect.y, 'zone-slot').setOrigin(0, 0).setAlpha(0.9);
      }
    }

    const { detail, log } = this.layout;
    this.detailText = this.add.text(detail.x + 8, detail.y + 8, formatDetail(null), {
      fontFamily: theme.fonts.ui,
      fontSize: `${theme.fontSize.body}px`,
      color: theme.css.text,
      wordWrap: { width: detail.w - 16 },
      lineSpacing: 4,
    });
    this.add
      .text(log.x, log.y - 14, strings.logTitle, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.fontSize.small}px`,
        color: theme.css.textDim,
      })
      .setVisible(false);
    this.logText = this.add
      .text(log.x + 4, log.y + log.h, '', {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.fontSize.small}px`,
        color: theme.css.textDim,
        wordWrap: { width: log.w - 8 },
        lineSpacing: 2,
      })
      .setOrigin(0, 1);

    const back = this.add
      .text(16, 88, strings.back, {
        fontFamily: theme.fonts.mono,
        fontSize: '13px',
        color: theme.css.text,
        backgroundColor: '#2a2a3a',
        padding: { x: 8, y: 4 },
      })
      .setInteractive({ useHandCursor: true });
    back.on('pointerup', () => this.scene.start('Menu'));

    this.dynamic = this.add.container(0, 0);
    this.unsubscribe = this.controller.subscribe((s) => this.render(s));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });
    this.render(this.controller.getState());
  }

  private showDetail(detail: CardDetail | null): void {
    this.detailText.setText(formatDetail(detail, detail === null));
  }

  private render(state: DuelUiState): void {
    this.dynamic.removeAll(true);
    this.logText.setText(state.log.slice(-LOG_LINES).join('\n'));
    if (!state.view) return;

    const model = present(state.view, state.legalActions, {
      lookup: cardLookup,
      surrenderArmed: state.surrenderArmed,
      layout: this.layout,
    });
    this.drawPiles(model);
    this.drawLp(model);
    this.drawCards(model);
    this.drawPhase(model, state);
    this.drawButtons(model, state);
    if (model.banner) this.drawBanner(model);
  }

  private drawCards(model: RenderModel): void {
    for (const c of model.cards) {
      const view = createCardView(this, c);
      view.on('pointerover', () => this.showDetail(c.detail));
      view.on('pointerup', () => {
        this.showDetail(c.detail);
        if (c.action) void this.controller.submit(c.action);
      });
      this.dynamic.add(view);
    }
  }

  private drawPiles(model: RenderModel): void {
    for (const p of model.piles) {
      const r = p.rect;
      if (p.kind === 'deck' && p.count > 0) {
        this.dynamic.add(
          this.add.image(r.x + r.w / 2, r.y + r.h / 2, 'card-back').setDisplaySize(r.w, r.h),
        );
      }
      this.dynamic.add(
        this.add
          .text(r.x + r.w / 2, r.y + r.h / 2, `${p.count}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fontSize.lp - 4}px`,
            color: p.kind === 'deck' ? '#ffffff' : theme.css.text,
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5),
      );
      this.dynamic.add(
        this.add
          .text(r.x + r.w / 2, r.y + 4, p.caption, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fontSize.small}px`,
            color: theme.css.textDim,
          })
          .setOrigin(0.5, 0),
      );
    }
  }

  private drawLp(model: RenderModel): void {
    for (const lp of model.lp) {
      const r = lp.rect;
      this.dynamic.add(
        this.add
          .text(r.x, r.y, lp.caption, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fontSize.label}px`,
            color: theme.css.gold,
          })
          .setOrigin(0, 0),
      );
      const barY = r.y + 22;
      this.dynamic.add(
        this.add.rectangle(r.x, barY, r.w, 12, theme.colors.lpTrack).setOrigin(0, 0),
      );
      this.dynamic.add(
        this.add
          .rectangle(
            r.x,
            barY,
            Math.max(0, r.w * lp.ratio),
            12,
            lp.side === 'self' ? theme.colors.lpSelf : theme.colors.lpOpp,
          )
          .setOrigin(0, 0),
      );
      this.dynamic.add(
        this.add
          .text(r.x + r.w, r.y + 32, `LP ${lp.value}`, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fontSize.lp}px`,
            color: theme.css.text,
          })
          .setOrigin(1, 0),
      );
    }
  }

  private drawPhase(model: RenderModel, state: DuelUiState): void {
    const r = this.layout.phase;
    const mine = model.phase.turnOwner === 'self';
    this.dynamic.add(
      this.add
        .text(r.x + r.w / 2, r.y + 14, model.phase.text, {
          fontFamily: theme.fonts.title,
          fontSize: `${theme.fontSize.title}px`,
          color: mine ? theme.css.good : theme.css.danger,
        })
        .setOrigin(0.5, 0),
    );
    const note = state.busy
      ? state.thinking
        ? strings.thinking
        : strings.sending
      : (model.prompt?.text ?? state.error ?? '');
    if (note) {
      this.dynamic.add(
        this.add
          .text(r.x + r.w / 2, r.y + 46, note, {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fontSize.body}px`,
            color: state.error && !state.busy ? theme.css.danger : theme.css.gold,
            wordWrap: { width: r.w - 16 },
            align: 'center',
          })
          .setOrigin(0.5, 0),
      );
    }
  }

  private drawButtons(model: RenderModel, state: DuelUiState): void {
    for (const b of model.buttons) {
      const usable = b.enabled && !state.busy;
      const fill = !usable
        ? theme.colors.buttonDisabled
        : b.danger
          ? theme.colors.danger
          : theme.colors.button;
      const box = this.add.rectangle(b.rect.x, b.rect.y, b.rect.w, b.rect.h, fill).setOrigin(0, 0);
      box.setStrokeStyle(
        2,
        usable ? theme.colors.highlight : theme.colors.panelLine,
        usable ? 0.8 : 0.4,
      );
      const label = this.add
        .text(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2, b.label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.fontSize.label}px`,
          color: usable ? theme.css.text : theme.css.textDisabled,
        })
        .setOrigin(0.5);
      this.dynamic.add([box, label]);
      if (usable) {
        box.setInteractive({ useHandCursor: true });
        box.on('pointerover', () => box.setFillStyle(theme.colors.buttonHover));
        box.on('pointerout', () => box.setFillStyle(fill));
        box.on('pointerup', () => void this.controller.press(b.id));
      }
    }
  }

  private drawBanner(model: RenderModel): void {
    const banner = model.banner;
    if (!banner) return;
    const f = this.layout.frame;
    const dim = this.add.rectangle(f.x, f.y, f.w, f.h, 0x000000, 0.6).setOrigin(0, 0);
    dim.setInteractive(); // swallow clicks behind the banner
    const color =
      banner.kind === 'win'
        ? theme.css.good
        : banner.kind === 'lose'
          ? theme.css.danger
          : theme.css.gold;
    const title = this.add
      .text(f.w / 2, f.h / 2 - 30, banner.text, {
        fontFamily: theme.fonts.ui, // the serif fallback has no glyph for stacked Vietnamese accents (Ắ)
        fontStyle: 'bold',
        fontSize: '64px',
        color,
        stroke: '#000000',
        strokeThickness: 6,
        padding: { top: 16, bottom: 8 }, // accents on capitals would be clipped otherwise
      })
      .setOrigin(0.5);
    const menuRect: Rect = { x: f.w / 2 - 100, y: f.h / 2 + 40, w: 200, h: 52 };
    const btn = this.add
      .rectangle(menuRect.x, menuRect.y, menuRect.w, menuRect.h, theme.colors.button)
      .setOrigin(0, 0)
      .setStrokeStyle(2, theme.colors.highlight, 0.8)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerup', () => this.scene.start('Menu'));
    const label = this.add
      .text(f.w / 2, menuRect.y + menuRect.h / 2, strings.backToMenu, {
        fontFamily: theme.fonts.ui,
        fontSize: `${theme.fontSize.label}px`,
        color: theme.css.text,
      })
      .setOrigin(0.5);
    this.dynamic.add([dim, title, btn, label]);
  }
}
