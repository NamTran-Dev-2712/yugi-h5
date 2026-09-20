import Phaser from 'phaser';
import { BootScene } from './scenes/boot-scene';
import { MenuScene } from './scenes/menu-scene';
import { DuelScene } from './scenes/duel-scene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 640,
  backgroundColor: '#0a0a0f',
  scene: [BootScene, MenuScene, DuelScene],
});
