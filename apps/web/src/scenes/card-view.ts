import Phaser from 'phaser';
import { frameKey } from '../duel/asset-manifest';
import type { CardRender } from '../duel/presenter';
import { theme } from '../duel/theme';

/** One card as a Phaser Container, drawn from a `CardRender` (no game logic). Text only for face-up cards. */

const NATURAL_W = theme.card.zoneW;
const NATURAL_H = theme.card.zoneH;

function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size: number,
  color: string = theme.css.cardText,
  wrap?: number,
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, {
    fontFamily: theme.fonts.ui,
    fontSize: `${size}px`,
    color,
    ...(wrap ? { wordWrap: { width: wrap } } : {}),
  });
}

export function createCardView(scene: Phaser.Scene, c: CardRender): Phaser.GameObjects.Container {
  const texture = c.faceDown || c.frame === null ? 'card-back' : frameKey[c.frame];
  const image = scene.add.image(0, 0, texture);
  const parts: Phaser.GameObjects.GameObject[] = [image];

  if (!c.faceDown && c.label) {
    const l = c.label;
    const left = -NATURAL_W / 2;
    const top = -NATURAL_H / 2;
    parts.push(text(scene, left + 6, top + 6, l.name, 9, theme.css.cardText, NATURAL_W - 12));
    if (l.level !== null) parts.push(text(scene, left + 8, top + 74, `★${l.level}`, 10));
    if (l.atk !== null && l.def !== null) {
      parts.push(text(scene, left + 6, top + 88, `${l.atk}/${l.def}`, 10));
    }
  }

  if (c.highlight) {
    const outline = scene.add.rectangle(0, 0, NATURAL_W + 2, NATURAL_H + 2);
    outline.setStrokeStyle(3, theme.colors.highlight, 1);
    parts.push(outline);
  }

  const scale = Math.min(c.rect.w / NATURAL_W, c.rect.h / NATURAL_H);
  const container = scene.add.container(c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2, parts);
  if (c.defense) {
    // Sideways cards would be wider than their zone, so they are also drawn smaller.
    container.setAngle(90);
    container.setScale(Math.min(scale, (c.rect.w / NATURAL_H) * 0.95));
  } else {
    container.setScale(scale);
  }
  container.setSize(NATURAL_W, NATURAL_H);
  container.setInteractive({ useHandCursor: c.action !== null });
  return container;
}
