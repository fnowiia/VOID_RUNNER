import Phaser from 'phaser';
import { sitePath } from '../utils/assetPaths.js';
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    const { ui } = this.registry.get('services');
    ui.loading(0);
    const sheet = (key, path, w, h) => this.load.spritesheet(key, sitePath(`assets/${path}`), { frameWidth: w, frameHeight: h });
    sheet('player', 'sprites/player.png', 32, 48);
    sheet('patch', 'sprites/patch.png', 24, 24);
    sheet('terminal', 'sprites/terminal.png', 32, 48);
    sheet('portal', 'sprites/portal.png', 96, 128);
    sheet('objects', 'sprites/objects.png', 32, 32);
    sheet('tiles', 'tiles/tileset.png', 32, 32);
    sheet('icons', 'ui/icons.png', 16, 16);
    sheet('enemy','sprites/enemy.png',32,32);
    for (let i = 1; i <= 5; i++) this.load.image(`bg${i}`, sitePath(`assets/backgrounds/level${i}.png`));
    this.load.on('progress', value => ui.loading(value));
    this.load.on('loaderror', file => ui.loadingError(`Не удалось загрузить ${file.key}. Проверьте папку public/assets.`));
  }
  create() {
    const make = (key, texture, start, end, frameRate, repeat = -1) => this.anims.create({ key, frames: this.anims.generateFrameNumbers(texture, { start, end }), frameRate, repeat });
    make('player-idle', 'player', 0, 3, 5);
    make('player-run', 'player', 4, 9, 10);
    make('player-jump', 'player', 10, 11, 5);
    make('player-fall', 'player', 12, 13, 5);
    make('player-hurt', 'player', 14, 15, 8);
    make('player-repair', 'player', 16, 19, 8);
    for (const [name, start] of [['idle',0],['float',4],['talk',8],['joy',12],['warning',16]]) make(`patch-${name}`, 'patch', start, start + 3, 7);
    make('terminal-idle', 'terminal', 0, 3, 5);
    make('portal-spin', 'portal', 0, 7, 9);
    make('enemy-crawl','enemy',0,3,9);
    make('enemy-fly','enemy',4,7,10);
    make('enemy-rupture','enemy',8,11,14,0);
    this.scene.start('Menu');
  }
}
