import Phaser from 'phaser';
import type { DuelController, DuelUiState } from '../duel/duel-controller';
import {
  animationSpeedFromSearch,
  createAnimationPlayer,
  timerScheduler,
  type AnimationPlayer,
} from '../duel/animation-player';
import type { AnimationStep } from '../duel/animation-queue';
import { formatDetail } from '../duel/detail-text';
import type { SelectionPurpose } from '../duel/interaction';
import { createInteractionDriver, type InteractionDriver } from '../duel/interaction-driver';
import { computeLayout, staticRects, type Rect } from '../duel/layout';
import { filterEntries } from '../duel/log-entries';
import {
  loadLogPanel,
  logHitTest,
  logPanelRects,
  reduceLogPanel,
  saveLogPanel,
  type LogPanelAction,
  type LogPanelState,
  type LogStorage,
} from '../duel/log-panel';
import { present, type CardDetail, type RenderModel } from '../duel/presenter';
import { animatorHost, cardLookup } from '../duel/services';
import { strings } from '../duel/strings';
import { theme } from '../duel/theme';
import { createCardView } from './card-view';

export interface DuelSceneData {
  readonly controller: DuelController;
}

const LOG_LINES = 24;
const TOAST_MS = 2500;

/** Hint above Confirm, per what the card selection is for (read at draw time: the language may change). */
const CONFIRM_HINT: Record<SelectionPurpose, () => string> = {
  tribute: () => strings.pickTributeHint,
  discard: () => strings.pickDiscardHint,
  cost: () => strings.pickCostHint,
  target: () => strings.pickTargetHint,
};

/** localStorage may be missing or throw (private window); the panel then just uses its defaults. */
function browserStorage(): LogStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

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
  /** Header band of the log panel (title, collapse button, filter chips), or just the small tab while hidden. */
  private logUi!: Phaser.GameObjects.Container;
  private logPanel!: LogPanelState;
  private unsubscribe: (() => void) | null = null;
  private driver!: InteractionDriver;
  private overlay!: Phaser.GameObjects.Container;
  /** Transient effects of the animation step being played (drawn over the OLD board, gone at the snap). */
  private fx!: Phaser.GameObjects.Container;
  private player: AnimationPlayer | null = null;
  private lastModel: RenderModel | null = null;
  private toastSeen = 0;
  private toastUntil = 0;

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

    this.logPanel = loadLogPanel(browserStorage());
    this.logUi = this.add.container(0, 0).setDepth(2);
    this.drawLogUi();

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
    this.fx = this.add.container(0, 0).setDepth(5);
    this.overlay = this.add.container(0, 0).setDepth(10);
    this.player = createAnimationPlayer({
      schedule: timerScheduler,
      onStep: (step) => this.playStep(step),
      onSkip: () => this.fx.removeAll(true),
      speed: animationSpeedFromSearch(window.location.search),
    });
    animatorHost.attach(this.player);
    const skip = (): void => this.controller.skipAnimation();
    const toggleLog = (): void => this.dispatchLog({ type: 'toggleVisible' });
    this.input.keyboard?.on('keydown-SPACE', skip);
    this.input.keyboard?.on('keydown-L', toggleLog);
    this.input.keyboard?.on('keydown-ENTER', skip);
    this.driver = createInteractionDriver(this.controller, {
      lookup: cardLookup,
      layout: this.layout,
    });
    const stopController = this.controller.subscribe((s) => this.render(s));
    const stopDriver = this.driver.subscribe(() => this.renderOverlay());
    this.unsubscribe = () => {
      stopController();
      stopDriver();
    };
    this.wireInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
      animatorHost.attach(null);
      this.player = null;
      this.input.keyboard?.off('keydown-SPACE', skip);
      this.input.keyboard?.off('keydown-L', toggleLog);
      this.input.keyboard?.off('keydown-ENTER', skip);
      this.input.off('pointerdown');
      this.input.off('pointermove');
      this.input.off('pointerup');
      this.input.off('pointerupoutside');
    });
    this.render(this.controller.getState());
  }

  private dispatchLog(action: LogPanelAction): void {
    this.logPanel = reduceLogPanel(this.logPanel, action);
    saveLogPanel(browserStorage(), this.logPanel);
    this.drawLogUi();
    this.renderLogText(this.controller.getState());
  }

  private renderLogText(state: DuelUiState): void {
    const lines = filterEntries(state.entries, this.logPanel.enabled)
      .slice(-LOG_LINES)
      .map((e) => e.text);
    this.logText.setVisible(this.logPanel.visible).setText(lines.join('\n'));
  }

  /** Header (title, collapse button, chips) while shown; only a small tab at the same corner while hidden. */
  private drawLogUi(): void {
    this.logUi.removeAll(true);
    const r = logPanelRects(this.layout);
    const c = theme.colors;
    const size = theme.fontSize.small;
    const box = (rect: Rect, label: string, on: boolean): void => {
      const bg = this.add
        .rectangle(rect.x, rect.y, rect.w, rect.h, on ? c.button : c.buttonDisabled)
        .setOrigin(0, 0)
        .setStrokeStyle(1, on ? c.highlight : c.panelLine, on ? 0.9 : 0.4);
      const text = this.add
        .text(rect.x + rect.w / 2, rect.y + rect.h / 2, label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${size}px`,
          color: on ? theme.css.text : theme.css.textDisabled,
        })
        .setOrigin(0.5);
      this.logUi.add([bg, text]);
    };
    if (!this.logPanel.visible) {
      box(r.toggleTab, strings.logShow, true);
      return;
    }
    const { header } = r;
    this.logUi.add(
      this.add.rectangle(header.x, header.y, header.w, header.h, c.panel, 1).setOrigin(0, 0),
    );
    this.logUi.add(
      this.add.text(header.x + 2, header.y + 4, strings.logTitle, {
        fontFamily: theme.fonts.ui,
        fontSize: `${size}px`,
        color: theme.css.textDim,
      }),
    );
    box(r.toggleButton, strings.logHide, true);
    const entries = Object.entries(r.chips) as [keyof typeof r.chips, Rect][];
    box(r.showAll, strings.logAll, this.logPanel.enabled.size < entries.length);
    for (const [category, rect] of entries) {
      box(rect, strings.logCategory[category], this.logPanel.enabled.has(category));
    }
  }

  /** Mouse and touch both arrive as Phaser pointers; everything below is coordinates in the logical frame. */
  private wireInput(): void {
    const at = (p: Phaser.Input.Pointer) => ({ x: p.x, y: p.y });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // The log panel is plain UI, not part of a gesture: it never reaches the interaction machine.
      const logAction = logHitTest(this.layout, this.logPanel, at(p));
      if (logAction) {
        this.dispatchLog(logAction);
        return;
      }
      if (p.rightButtonDown()) void this.driver.dispatch({ type: 'cancel' });
      else void this.driver.dispatch({ type: 'pointerDown', point: at(p) });
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      void this.driver.dispatch({ type: 'pointerMove', point: at(p) });
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      void this.driver.dispatch({ type: 'pointerUp', point: at(p) });
    });
    this.input.on('pointerupoutside', () => void this.driver.dispatch({ type: 'cancel' }));
    this.input.keyboard?.on('keydown-ESC', () => void this.driver.dispatch({ type: 'cancel' }));
  }

  /** Drop zones / targets / arrow / ghost / menus / tribute bar / toast, redrawn from the driver on every change. */
  private renderOverlay(): void {
    this.overlay.removeAll(true);
    const ctx = this.driver.getContext();
    const o = this.driver.getOverlay();
    if (!ctx || !o) return;
    const c = theme.colors;
    const outline = (r: Rect, color: number, width = 3, fillAlpha = 0.12): void => {
      const box = this.add.rectangle(r.x, r.y, r.w, r.h, color, fillAlpha).setOrigin(0, 0);
      box.setStrokeStyle(width, color, 1);
      this.overlay.add(box);
    };
    const cardRect = (id: string): Rect | undefined =>
      ctx.model.cards.find((x) => x.id === id)?.rect;

    for (const z of o.zones) outline(z, c.validZone);
    for (const t of o.targets) outline(t, c.target);
    if (o.lpTarget) outline(o.lpTarget, c.target);
    for (const id of o.candidates) {
      const r = cardRect(id);
      if (r)
        outline(
          r,
          o.selected.includes(id) ? c.selected : c.highlight,
          4,
          o.selected.includes(id) ? 0.3 : 0.1,
        );
    }

    if (o.ghost) {
      const card = ctx.model.cards.find((x) => x.id === o.ghost!.cardId);
      if (card) {
        const r = card.rect;
        this.overlay.add(this.add.rectangle(r.x, r.y, r.w, r.h, c.dim, 0.5).setOrigin(0, 0));
        const at = o.ghost.at;
        const ghost = createCardView(this, {
          ...card,
          action: null,
          highlight: false,
          rect: { x: at.x - r.w / 2, y: at.y - r.h / 2, w: r.w, h: r.h },
        });
        ghost.disableInteractive().setAlpha(0.85);
        this.overlay.add(ghost);
      }
    }

    if (o.arrow) this.drawArrow(o.arrow.from, o.arrow.to);

    if (o.menu) {
      o.menu.rects.forEach((r, i) => {
        const box = this.add.rectangle(r.x, r.y, r.w, r.h, c.menuBg, 0.96).setOrigin(0, 0);
        box.setStrokeStyle(2, c.highlight, 0.9);
        const label = this.add
          .text(r.x + r.w / 2, r.y + r.h / 2, o.menu!.labels[i] ?? '', {
            fontFamily: theme.fonts.ui,
            fontSize: `${theme.fontSize.label}px`,
            color: theme.css.text,
          })
          .setOrigin(0.5);
        this.overlay.add([box, label]);
      });
    }

    if (o.confirm) this.drawConfirmBar(o.confirm.enabled, o.confirm.showCancel, o.confirm.purpose);

    this.drawToast();
  }

  private drawArrow(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const g = this.add.graphics();
    g.lineStyle(6, theme.colors.arrow, 0.9);
    g.lineBetween(from.x, from.y, to.x, to.y);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const head = 22;
    g.fillStyle(theme.colors.arrow, 0.95);
    g.fillTriangle(
      to.x,
      to.y,
      to.x - head * Math.cos(angle - 0.45),
      to.y - head * Math.sin(angle - 0.45),
      to.x - head * Math.cos(angle + 0.45),
      to.y - head * Math.sin(angle + 0.45),
    );
    this.overlay.add(g);
  }

  private drawConfirmBar(enabled: boolean, showCancel: boolean, purpose: SelectionPurpose): void {
    const { hint, confirm, cancel } = this.layout.overlay;
    const c = theme.colors;
    this.overlay.add(this.add.rectangle(hint.x, hint.y, hint.w, 80, c.dim, 0.55).setOrigin(0, 0));
    this.overlay.add(
      this.add
        .text(hint.x + hint.w / 2, hint.y + 4, CONFIRM_HINT[purpose](), {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.fontSize.body}px`,
          color: theme.css.gold,
        })
        .setOrigin(0.5, 0),
    );
    const button = (r: Rect, label: string, on: boolean): void => {
      const box = this.add
        .rectangle(r.x, r.y, r.w, r.h, on ? c.button : c.buttonDisabled)
        .setOrigin(0, 0);
      box.setStrokeStyle(2, on ? c.highlight : c.panelLine, on ? 0.9 : 0.4);
      const text = this.add
        .text(r.x + r.w / 2, r.y + r.h / 2, label, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.fontSize.label}px`,
          color: on ? theme.css.text : theme.css.textDisabled,
        })
        .setOrigin(0.5);
      this.overlay.add([box, text]);
    };
    button(confirm, strings.confirm, enabled);
    if (showCancel) button(cancel, strings.cancel, true);
  }

  private drawToast(): void {
    const toast = this.driver.getToast();
    if (!toast) return;
    if (toast.seq !== this.toastSeen) {
      this.toastSeen = toast.seq;
      this.toastUntil = this.time.now + TOAST_MS;
      this.time.delayedCall(TOAST_MS + 50, () => this.renderOverlay());
    }
    if (this.time.now >= this.toastUntil) return;
    const w = 520;
    const x = this.layout.frame.w / 2 - w / 2;
    const y = 250;
    this.overlay.add(
      this.add
        .rectangle(x, y, w, 48, theme.colors.toastBg, 0.95)
        .setOrigin(0, 0)
        .setStrokeStyle(2, theme.colors.target, 0.9),
    );
    this.overlay.add(
      this.add
        .text(x + w / 2, y + 24, toast.text, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.fontSize.label}px`,
          color: theme.css.text,
        })
        .setOrigin(0.5),
    );
  }

  private showDetail(detail: CardDetail | null): void {
    this.detailText.setText(formatDetail(detail, detail === null));
  }

  private render(state: DuelUiState): void {
    this.dynamic.removeAll(true);
    if (!state.animating) this.fx.removeAll(true);
    this.renderLogText(state);
    if (!state.view) return;

    const model = present(state.view, state.legalActions, {
      lookup: cardLookup,
      surrenderArmed: state.surrenderArmed,
      layout: this.layout,
    });
    this.lastModel = model;
    this.drawPiles(model);
    this.drawLp(model);
    this.drawCards(model);
    this.drawPhase(model, state);
    this.drawButtons(model, state);
    if (model.banner) this.drawBanner(model);
  }

  /**
   * One animation step = a caption (the log sentence) plus a small effect on the spot the event names. Everything is
   * read from the step; the board underneath is still the previous state and only changes at the snap.
   */
  private playStep(step: AnimationStep): void {
    this.fx.removeAll(true);
    const viewer = this.controller.getState().view?.viewerIndex ?? 0;
    const sideOf = (playerIndex: number): 'self' | 'opp' =>
      playerIndex === viewer ? 'self' : 'opp';
    const cardRect = (id: string): Rect | undefined =>
      this.lastModel?.cards.find((c) => c.id === id)?.rect;
    const zoneRect = (playerIndex: number, zone: number): Rect | undefined =>
      this.layout[sideOf(playerIndex)].monsterZones[zone];
    const spellZoneRect = (playerIndex: number, zone: number): Rect | undefined =>
      this.layout[sideOf(playerIndex)].spellTrapZones[zone];
    const centre = (r: Rect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const c = theme.colors;

    const flash = (r: Rect | undefined, color: number): void => {
      if (!r) return;
      const box = this.add.rectangle(r.x, r.y, r.w, r.h, color, 0.35).setOrigin(0, 0);
      box.setStrokeStyle(3, color, 1);
      this.fx.add(box);
      this.tweens.add({ targets: box, alpha: 0, duration: step.durationMs, ease: 'Quad.easeIn' });
    };
    const pop = (r: Rect | undefined, texture: string): void => {
      if (!r) return;
      const p = centre(r);
      const img = this.add.image(p.x, p.y, texture).setDisplaySize(r.w, r.h).setScale(0.3);
      this.fx.add(img);
      this.tweens.add({
        targets: img,
        scale: 1,
        duration: step.durationMs * 0.6,
        ease: 'Back.easeOut',
      });
    };

    switch (step.kind) {
      case 'draw':
        flash(this.layout[sideOf(step.playerIndex)].handBand, c.highlight);
        break;
      case 'summon':
        flash(zoneRect(step.playerIndex, step.zoneIndex), c.validZone);
        pop(zoneRect(step.playerIndex, step.zoneIndex), 'card-frame-monster');
        break;
      case 'set':
        flash(zoneRect(step.playerIndex, step.zoneIndex), c.dim);
        pop(zoneRect(step.playerIndex, step.zoneIndex), 'card-back');
        break;
      case 'flip':
      case 'changePosition':
        flash(cardRect(step.instanceId) ?? zoneRect(step.playerIndex, step.zoneIndex), c.highlight);
        break;
      case 'tribute':
      case 'destroy':
        flash(cardRect(step.instanceId) ?? zoneRect(step.playerIndex, step.zoneIndex), c.danger);
        break;
      case 'attack': {
        const from = cardRect(step.instanceId);
        const target = step.targetInstanceId ? cardRect(step.targetInstanceId) : undefined;
        const to = target ?? this.layout[sideOf(step.playerIndex) === 'self' ? 'opp' : 'self'].lp;
        if (from) {
          flash(from, c.arrow);
          this.drawFxArrow(centre(from), centre(to), step.durationMs);
        }
        break;
      }
      case 'damage':
      case 'lpPay':
        this.floatLpNumber(sideOf(step.playerIndex), `-${step.amount}`, theme.css.danger, step);
        break;
      case 'lpGain':
        this.floatLpNumber(sideOf(step.playerIndex), `+${step.amount}`, theme.css.gold, step);
        break;
      case 'spellSet':
        flash(spellZoneRect(step.playerIndex, step.zoneIndex), c.dim);
        pop(spellZoneRect(step.playerIndex, step.zoneIndex), 'card-back');
        break;
      case 'spellDestroy':
        flash(
          cardRect(step.instanceId) ?? spellZoneRect(step.playerIndex, step.zoneIndex),
          c.danger,
        );
        break;
      case 'activate': {
        // A large Spell frame in the middle of the board; the caption names the (now public) card.
        const r = this.layout.frame;
        const w = 180;
        const h = 262;
        pop({ x: r.w / 2 - w / 2, y: r.h / 2 - h / 2 - 40, w, h }, 'card-frame-spell');
        flash(cardRect(step.instanceId), c.highlight);
        break;
      }
      case 'resolve':
      case 'toGraveyard':
        flash(cardRect(step.instanceId), c.dim);
        break;
      case 'discard':
      case 'deckOut':
      case 'phase':
      case 'turn':
      case 'duelEnd':
      case 'aiLabel':
        break; // the caption below is the whole effect
    }

    const w = 640;
    const x = this.layout.frame.w / 2 - w / 2;
    const y = 300;
    this.fx.add(this.add.rectangle(x, y, w, 40, theme.colors.toastBg, 0.9).setOrigin(0, 0));
    this.fx.add(
      this.add
        .text(x + w / 2, y + 20, step.text, {
          fontFamily: theme.fonts.ui,
          fontSize: `${theme.fontSize.label}px`,
          color: step.kind === 'aiLabel' ? theme.css.gold : theme.css.text,
        })
        .setOrigin(0.5),
    );
  }

  /** A number that floats up from a side's LP box and fades (damage, LP paid or gained). */
  private floatLpNumber(
    side: 'self' | 'opp',
    text: string,
    color: string,
    step: AnimationStep,
  ): void {
    const lp = this.layout[side].lp;
    const t = this.add
      .text(lp.x + lp.w / 2, lp.y + lp.h / 2, text, {
        fontFamily: theme.fonts.ui,
        fontStyle: 'bold',
        fontSize: '40px',
        color,
        stroke: '#000000',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.fx.add(t);
    this.tweens.add({
      targets: t,
      y: t.y - 50,
      alpha: 0,
      duration: step.durationMs,
      ease: 'Quad.easeOut',
    });
  }

  private drawFxArrow(
    from: { x: number; y: number },
    to: { x: number; y: number },
    durationMs: number,
  ): void {
    const g = this.add.graphics();
    g.lineStyle(6, theme.colors.arrow, 0.9);
    g.lineBetween(from.x, from.y, to.x, to.y);
    this.fx.add(g);
    this.tweens.add({ targets: g, alpha: 0, duration: durationMs, ease: 'Quad.easeIn' });
  }

  private drawCards(model: RenderModel): void {
    for (const c of model.cards) {
      const view = createCardView(this, c);
      // Only the detail panel is handled per object; clicks and drags go through the interaction driver.
      view.on('pointerover', () => this.showDetail(c.detail));
      view.on('pointerup', () => this.showDetail(c.detail));
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
    const note = state.animating
      ? strings.animating
      : state.busy
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
        // The press itself is handled by the interaction driver (hit-test on the button rect).
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
