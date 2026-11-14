import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, speed = 220) {
    super(scene, x, y, 'player', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(20);
    this.body.setSize(18, 40).setOffset(7, 8);
    this.body.setMaxVelocity(500, 650);
    this.speed = speed;
    this.jumpVelocity = -410;
    this.coyoteUntil = 0;
    this.jumpBufferUntil = 0;
    this.wasGrounded = false;
    this.hurtUntil = 0;
    this.repairUntil = 0;
    this.play('player-idle');
  }
  setSpeed(speed) { this.speed = Phaser.Math.Clamp(speed, 40, 220); }
  setJump(strength) { this.jumpVelocity=-Phaser.Math.Clamp(Math.abs(strength),300,480); }
  resetAt(x,y) {
    this.body.reset(x,y);
    this.setPosition(x,y).setVelocity(0,0).setAlpha(1);
    this.jumpBufferUntil = 0;
    this.coyoteUntil = 0;
  }
  move({left,right,jumpPressed}, time, delta, enabled=true) {
    if (!enabled) { this.setVelocityX(0); return; }
    const grounded = this.body.blocked.down || this.body.touching.down;
    if (grounded) this.coyoteUntil = time + 95;
    if (jumpPressed) this.jumpBufferUntil = time + 110;
    const target = ((right ? 1 : 0) - (left ? 1 : 0)) * this.speed;
    const acceleration = grounded ? 1550 : 1000;
    this.setVelocityX(Phaser.Math.Linear(this.body.velocity.x,target,Math.min(1,delta/1000*acceleration/Math.max(1,this.speed))));
    if (!left && !right && Math.abs(this.body.velocity.x)<3) this.setVelocityX(0);
    if (target) this.setFlipX(target < 0);
    if (this.jumpBufferUntil > time && this.coyoteUntil >= time && this.scene.physics.world.gravity.y > 0) {
      this.setVelocityY(this.jumpVelocity);
      this.jumpBufferUntil = 0;
      this.coyoteUntil = 0;
      this.scene.audio?.play('jump');
    }
    if (grounded && !this.wasGrounded && this.body.velocity.y >= 0) {
      this.scene.audio?.play('land');
      if (!this.scene.reducedEffects) {
        this.setScale(1.08,0.92);
        this.scene.tweens.add({targets:this,scaleX:1,scaleY:1,duration:110});
      }
    }
    this.wasGrounded = grounded;
    let anim = 'player-idle';
    if (time < this.hurtUntil) anim='player-hurt';
    else if (time < this.repairUntil) anim='player-repair';
    else if (!grounded && this.body.velocity.y < -50) anim='player-jump';
    else if (!grounded && this.body.velocity.y > 70) anim='player-fall';
    else if (Math.abs(this.body.velocity.x) > 8) anim='player-run';
    if (this.anims.currentAnim?.key !== anim) this.play(anim,true);
    this.anims.timeScale = anim==='player-run' ? Math.max(0.35,Math.abs(this.body.velocity.x)/220) : 1;
    this.setAlpha(time < this.hurtUntil && Math.floor(time/90)%2===0 ? 0.45 : 1);
  }
}
export default Player;
