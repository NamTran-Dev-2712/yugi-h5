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
      // [GUESS] layout (task 3.7): the current value is the number shown, green above / red below the printed one;
      // the printed values are in the detail panel.
      const color = (printed: number, eff: number | null): string =>
        eff === null || eff === printed
          ? theme.css.cardText
          : eff > printed
            ? theme.css.statUp
            : theme.css.statDown;
      const atk = text(
        scene,
        left + 6,
        top + 88,
        `${l.effAtk ?? l.atk}`,
        10,
        color(l.atk, l.effAtk),
      );
      const slash = text(scene, atk.x + atk.width, top + 88, '/', 10);
      const def = text(
        scene,
        slash.x + slash.width,
        top + 88,
        `${l.effDef ?? l.def}`,
        10,
        color(l.def, l.effDef),
      );
      parts.push(atk, slash, def);
    }
  }

  // Task 4.3b [GUESS] G21 (drawn in code, no asset): a face-up card in the Field Zone gets a green inner border and a
  // small diamond; a Field / Continuous card in force gets a glowing outline and a dot in its top-right corner.
  if (c.zone === 'field' && !c.faceDown) {
    const border = scene.add.rectangle(0, 0, NATURAL_W - 6, NATURAL_H - 6);
    border.setStrokeStyle(2, theme.colors.fieldFrame, 1);
    const diamond = scene.add
      .rectangle(-NATURAL_W / 2 + 12, NATURAL_H / 2 - 12, 9, 9, theme.colors.fieldFrame, 1)
      .setAngle(45);
    parts.push(border, diamond);
  }
  if (c.active) {
    const glow = scene.add.rectangle(0, 0, NATURAL_W + 4, NATURAL_H + 4);
    glow.setStrokeStyle(2, theme.colors.activeMark, 0.95);
    const dot = scene.add.circle(
      NATURAL_W / 2 - 10,
      -NATURAL_H / 2 + 10,
      6,
      theme.colors.activeMark,
    );
    dot.setStrokeStyle(2, theme.colors.panel, 1);
    parts.push(glow, dot);
  }

  if (c.highlight || c.activatable) {
    const outline = scene.add.rectangle(0, 0, NATURAL_W + 2, NATURAL_H + 2);
    outline.setStrokeStyle(3, c.activatable ? theme.colors.activatable : theme.colors.highlight, 1);
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
