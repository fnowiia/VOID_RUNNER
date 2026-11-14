export class Terminal {
  constructor(scene,config,index=0) {
    this.scene=scene;this.config=config;this.id=config.id;this.lessonId=config.lessonId;this.index=index;this.patched=false;
    this.sprite=scene.add.sprite(config.x,config.y,'terminal',0).setOrigin(.5,1).setDepth(14).play('terminal-idle');
    this.label=scene.add.text(config.x,config.y-66,`[ E ] ТЕРМИНАЛ ${index+1}/3`,{fontFamily:'monospace',fontSize:'10px',color:'#5BF1F6',backgroundColor:'#090b19d9',padding:{x:7,y:5}}).setOrigin(.5).setDepth(30);
    this.glow=scene.add.ellipse(config.x,config.y-20,84,80,0x5bf1f6,.07).setDepth(3);
  }
  near(player) {return Math.hypot(player.x-this.sprite.x,player.y-24-(this.sprite.y-24))<88;}
  setActive(active) {
    this.label.setText(this.patched?`✓ ПАТЧ ${this.index+1}/3` : active?`[ E ] ИСПРАВИТЬ ${this.index+1}/3`:`ТЕРМИНАЛ ${this.index+1}/3`);
    this.label.setAlpha(active||this.patched?1:.6);
  }
  repair() {
    this.patched=true;this.sprite.setTint(0x5bf1f6);this.glow.setFillStyle(0x5bf1f6,.18);
    if(this.config.groundY) {this.sprite.setY(this.config.groundY);this.label.setY(this.config.groundY-66);this.glow.setY(this.config.groundY-20);}
  }
}
export default Terminal;
