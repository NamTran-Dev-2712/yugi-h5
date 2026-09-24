import Phaser from 'phaser';
import { TEXTURE_MANIFEST, type TextureAsset } from '../duel/asset-manifest';
import { theme } from '../duel/theme';

/** Draws every `generated` manifest entry into the texture cache. No image files, no copyrighted art. */

type Draw = (g: Phaser.GameObjects.Graphics, w: number, h: number) => void;

function frame(color: number): Draw {
  return (g, w, h) => {
    const r = theme.card.radius;
    g.fillStyle(color, 1).fillRoundedRect(0, 0, w, h, r);
    g.fillStyle(theme.colors.cardFace, 1).fillRoundedRect(3, 3, w - 6, h - 6, r - 2);
    g.fillStyle(color, 0.35).fillRect(6, 6, w - 12, 16); // name band
    g.fillStyle(0x000000, 0.18).fillRect(8, 24, w - 16, 48); // art placeholder
    g.lineStyle(1, color, 0.8).strokeRect(8, 24, w - 16, 48);
  };
}

const DRAWERS: Record<TextureAsset['key'], Draw> = {
  'board-bg': (g, w, h) => {
    g.fillStyle(theme.colors.boardBg, 1).fillRect(0, 0, w, h);
    g.lineStyle(2, theme.colors.boardLine, 0.6);
    g.lineBetween(260, h / 2, 1020, h / 2);
    g.fillStyle(theme.colors.panel, 1);
    g.fillRect(0, 0, 252, h);
    g.fillRect(1024, 0, w - 1024, h);
    g.lineStyle(2, theme.colors.panelLine, 0.8);
    g.lineBetween(252, 0, 252, h);
    g.lineBetween(1024, 0, 1024, h);
  },
  'card-frame-monster': frame(theme.colors.monsterFrame),
  'card-frame-spell': frame(theme.colors.spellFrame),
  'card-frame-trap': frame(theme.colors.trapFrame),
  'card-back': (g, w, h) => {
    const r = theme.card.radius;
    g.fillStyle(theme.colors.cardBack, 1).fillRoundedRect(0, 0, w, h, r);
    g.fillStyle(theme.colors.cardBackInner, 1).fillRoundedRect(5, 5, w - 10, h - 10, r - 2);
    g.lineStyle(2, theme.colors.cardBack, 1).strokeCircle(w / 2, h / 2, Math.min(w, h) * 0.22);
    g.fillStyle(theme.colors.cardBack, 1).fillCircle(w / 2, h / 2, Math.min(w, h) * 0.1);
  },
  'zone-slot': (g, w, h) => {
    g.fillStyle(theme.colors.zone, 0.55).fillRoundedRect(0, 0, w, h, theme.card.radius);
    g.lineStyle(1, theme.colors.boardLine, 0.9).strokeRoundedRect(
      0.5,
      0.5,
      w - 1,
      h - 1,
      theme.card.radius,
    );
  },
};

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  for (const asset of TEXTURE_MANIFEST) {
    if (asset.source !== 'generated' || scene.textures.exists(asset.key)) continue;
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    DRAWERS[asset.key](g, asset.width, asset.height);
    g.generateTexture(asset.key, asset.width, asset.height);
    g.destroy();
  }
}
