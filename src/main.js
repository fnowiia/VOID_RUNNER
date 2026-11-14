import Phaser from 'phaser';
import './styles.css';
import { BootScene } from './scenes/BootScene.js';
import { MenuScene } from './scenes/MenuScene.js';
import { LevelSelectScene } from './scenes/LevelSelectScene.js';
import { GameScene } from './scenes/GameScene.js';
import { ResultsScene } from './scenes/ResultsScene.js';
import { FinalScene } from './scenes/FinalScene.js';
import { AudioManager } from './core/AudioManager.js';
import { progressService } from './services/progressService.js';
import { Interface } from './ui/Interface.js';

const audio = new AudioManager();
const ui = new Interface(document.querySelector('#ui'), progressService, audio);
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 960, height: 540,
  backgroundColor: '#090b19', pixelArt: true, roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { gravity: { y: 700 }, debug: false } },
  scene: [BootScene, MenuScene, LevelSelectScene, GameScene, ResultsScene, FinalScene],
  callbacks: { preBoot: g => g.registry.set('services', { ui, audio, progress: progressService }) }
});
ui.game = game;
// Access to the running game for diagnostics and automated QA.
window.__ERROR404__ = { game, progress: progressService };
progressService.init().catch(() => {});

