import Phaser from 'phaser';

/**
 * A readable environmental threat: patrol bounds are authored on safe surfaces.
 * Enemies never chase the player, so every route can be learned and timed.
 * `period` is one complete vertical oscillation in milliseconds.
 */
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, config) {
    const enemyType = config.type === 'flyer' ? 'flyer' : 'crawler';
    super(scene, config.x, config.y, 'enemy', enemyType === 'flyer' ? 4 : 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.enemyId = config.id;
    this.enemyType = enemyType;
    this.baseY = config.y;
    const firstBound = Number.isFinite(config.minX) ? config.minX : config.x - 64;
    const secondBound = Number.isFinite(config.maxX) ? config.maxX : config.x + 64;
    this.patrol = {
      minX: Math.min(firstBound, secondBound),
      maxX: Math.max(firstBound, secondBound),
      speed: Math.max(0, Number.isFinite(config.speed) ? config.speed : 72),
      direction: config.direction === -1 ? -1 : 1,
    };
    this.amplitude = Number.isFinite(config.amplitude) ? Math.max(0, config.amplitude) : 24;
    this.period = Number.isFinite(config.period) ? Math.max(400, config.period) : 2200;
    this.frozen = false;
    this.phaseStart = null;
    this.setOrigin(0.5, enemyType === 'flyer' ? 0.5 : 1);
    this.setDepth(16).setTint(0xff526a);
    this.body.setAllowGravity(false);
    this.setImmovable(true);
    this.body.setSize(enemyType === 'flyer' ? 20 : 22, enemyType === 'flyer' ? 18 : 22);
    this.body.setOffset(enemyType === 'flyer' ? 6 : 5, enemyType === 'flyer' ? 7 : 10);
    this.body.setMaxVelocity(Math.max(1, this.patrol.speed), 600);
    this.play(enemyType === 'flyer' ? 'enemy-fly' : 'enemy-crawl');
    this.setVelocity(0, 0);
  }

  updatePatrol(time, delta) {
    if (!this.active || !this.body?.enable || this.frozen) return;
    if (this.phaseStart === null) this.phaseStart = time;
    let nextX = this.x + this.patrol.direction * this.patrol.speed * Math.max(0, Math.min(delta, 100)) / 1000;
    if (nextX <= this.patrol.minX) {
      nextX = this.patrol.minX;
      this.patrol.direction = 1;
    } else if (nextX >= this.patrol.maxX) {
      nextX = this.patrol.maxX;
      this.patrol.direction = -1;
    }
    const nextY = this.enemyType === 'flyer'
      ? this.baseY + Math.sin((time - this.phaseStart) * Math.PI * 2 / this.period) * this.amplitude
      : this.baseY;
    // Arcade integrates before Scene.update and copies body deltas to the sprite
    // afterward. Authored patrols move here, then synchronize every body history
    // position so POST_UPDATE cannot undo the movement or apply offset drift.
    this.body.reset(nextX, nextY);
    this.body.updateFromGameObject();
    this.body.prev.copy(this.body.position);
    this.body.prevFrame.copy(this.body.position);
    this.body.autoFrame.copy(this.body.position);
    this.setVelocity(0, 0);
    this.setFlipX(this.patrol.direction < 0);
    this.anims.timeScale = this.enemyType === 'flyer' ? 1 : Math.max(0.55, Math.min(1.5, this.patrol.speed / 72));
  }

  freeze() {
    if (this.frozen) return;
    this.frozen = true;
    this.setVelocity(0, 0);
    this.anims.pause();
  }

  unfreeze() {
    if (!this.frozen) return;
    this.frozen = false;
    this.anims.resume();
    this.setVelocity(0, 0);
  }
}

export default Enemy;
