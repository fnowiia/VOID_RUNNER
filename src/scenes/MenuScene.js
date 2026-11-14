import Phaser from 'phaser';
export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    const ui = this.registry.get('services').ui;
    this.add.image(480, 270, 'bg1').setAlpha(0.5);
    ui.menu(this);
    this.events.once('shutdown', () => ui.hideAll());
  }
}
