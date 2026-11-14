import Phaser from 'phaser';
export class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }
  init(data) { this.result = data; }
  create() {
    const { ui, audio } = this.registry.get('services');
    this.add.image(480, 270, `bg${this.result.levelId}`).setAlpha(0.35);
    audio.play?.('victory');
    ui.results(this, this.result);
    this.events.once('shutdown', () => ui.hideAll());
  }
}
