import Phaser from 'phaser';
import { theme } from './duel/theme';
import { BootScene } from './scenes/boot-scene';
import { MenuScene } from './scenes/menu-scene';
import { DuelScene } from './scenes/duel-scene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: theme.frame.width,
  height: theme.frame.height,
  backgroundColor: '#0a0a0f',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, MenuScene, DuelScene],
});
