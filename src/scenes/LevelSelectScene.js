import Phaser from 'phaser';
export class LevelSelectScene extends Phaser.Scene {
  constructor() { super('LevelSelect'); }
  create() {
    const ui = this.registry.get('services').ui;
    this.add.image(480, 270, 'bg4').setAlpha(0.3);
    ui.levelSelect(this);
    this.events.once('shutdown', () => ui.hideAll());
  }
}
