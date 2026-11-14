import Phaser from 'phaser';
export class FinalScene extends Phaser.Scene {
  constructor() { super('Final'); }
  create() {
    const { ui } = this.registry.get('services');
    this.add.image(480, 270, 'bg5');
    const portal = this.add.sprite(700, 260, 'portal').setScale(2).play('portal-spin');
    const player = this.add.sprite(520, 350, 'player').setScale(2).play('player-idle');
    this.tweens.add({ targets: player, x: 690, alpha: 0, duration: 2200, delay: 600 });
    this.tweens.add({ targets: portal, alpha: 0.45, yoyo: true, repeat: -1, duration: 1000 });
    this.cameras.main.fadeIn(600);
    ui.final(this);
    this.events.once('shutdown', () => ui.hideAll());
  }
}
