import { Enemy } from './Enemy.js';

export class LevelBuilder {
  constructor(scene,level) {
    this.scene=scene;this.level=level;this.bridgePlatforms=[];this.constructed=new Set();this.pendingConstruction=new Set();this.disabledLaserGroups=new Set();this.laserSprites=[];this.gateObjects=[];
  }
  build() {
    const s=this.scene,l=this.level;
    s.cameras.main.setBackgroundColor('#090B19');
    this.background=s.add.tileSprite(0,0,960,540,l.background).setOrigin(0).setScrollFactor(0).setDepth(-30);
    for(let x=128;x<l.width;x+=352) for(const y of [300,660,900]) {
      s.add.image(x,y,'objects',8).setScale(2).setAlpha(.2).setScrollFactor(.7).setDepth(-19);
      s.add.image(x+90,y+70,'objects',9).setScale(2,3).setAlpha(.25).setDepth(-18);
      s.add.text(x,y+70,`NODE_${l.id}.${Math.round(x/32)}\n${y<500?'UPPER':'LOWER'} BUS`,{fontFamily:'monospace',fontSize:'9px',lineSpacing:4,color:l.accent}).setAlpha(.23).setDepth(-17);
    }
    for(const room of l.rooms??[]) s.add.text(room.x,room.y,room.text,{fontFamily:'monospace',fontSize:'20px',color:l.accent,fontStyle:'bold'}).setAlpha(.22).setDepth(-5);
    this.platforms=s.physics.add.staticGroup();
    for(const rect of l.platforms) this.addPlatform(rect,0);
    this.hazards=s.physics.add.staticGroup();
    for(const hazard of l.hazards) {
      const sprite=s.add.tileSprite(hazard.x,hazard.y,hazard.w,hazard.h,'objects',hazard.type==='spikes'?5:6).setOrigin(0).setDepth(12);
      s.physics.add.existing(sprite,true);this.hazards.add(sprite);
      sprite.body.setSize(Math.max(8,hazard.w-4),Math.max(10,hazard.h-3)).setOffset(2,3);
      sprite.hazardConfig=hazard;
      if(hazard.type==='laser') {
        this.laserSprites.push(sprite);
        sprite.warning=s.add.text(hazard.x+9,hazard.y-16,hazard.period?'ПУЛЬС':'ПОЛЕ',{fontFamily:'monospace',fontSize:'9px',color:'#ff526a',backgroundColor:'#090b19bb',padding:{x:4,y:3}}).setOrigin(.5).setDepth(14);
      }
      s.add.ellipse(hazard.x+hazard.w/2,hazard.y+hazard.h/2,hazard.w+24,hazard.h+10,0xff526a,.055).setDepth(2);
    }
    this.items=s.physics.add.staticGroup();
    for(const item of l.items) {
      const sprite=this.items.create(item.x,item.y,'objects',item.type==='key'?0:1).setDepth(13);sprite.itemType=item.type;
      sprite.body.setSize(24,28).setOffset(4,2);
      s.tweens.add({targets:sprite,y:item.y-5,duration:850,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
      s.add.ellipse(item.x,item.y,50,50,0x5bf1f6,.08).setDepth(3);
    }
    this.checkpoints=l.checkpoints.map(c=>({...c,active:false,sprite:s.add.image(c.x,c.y,'objects',4).setOrigin(.5,1).setAlpha(.45).setDepth(11)}));
    if(l.lever) {
      this.lever=s.add.image(l.lever.x,l.lever.y,'objects',2).setOrigin(.5,1).setDepth(13);
      this.leverLabel=s.add.text(l.lever.x,l.lever.y-52,'[ E ]  РУБИЛЬНИК',{fontFamily:'monospace',fontSize:'10px',color:'#F76BD9',backgroundColor:'#090b19cc',padding:{x:6,y:4}}).setOrigin(.5).setDepth(25);
    }
    this.gates=s.physics.add.staticGroup();
    for(const gate of l.gates??[]) {
      const sprite=s.add.tileSprite(gate.x,gate.y,gate.w,gate.h,'objects',6).setOrigin(0).setTint(0x8b75ff).setDepth(17);
      s.physics.add.existing(sprite,true);this.gates.add(sprite);
      const label=s.add.text(gate.x+gate.w/2,gate.y-18,`LOCK / ${gate.id.toUpperCase()}`,{fontFamily:'monospace',fontSize:'9px',color:'#8b75ff',backgroundColor:'#090b19cc',padding:{x:5,y:4}}).setOrigin(.5).setDepth(18);
      this.gateObjects.push({config:gate,sprite,label,open:false});
    }
    this.door=this.gateObjects[0]?.sprite;
    this.exit=s.add.sprite(l.exit.x,l.exit.y,'portal',0).setOrigin(.5,1).setDepth(10).setAlpha(.28).setTint(l.id===5?0xf76bd9:0x8b75ff).play('portal-spin');
    this.exitLabel=s.add.text(l.exit.x,l.exit.y-146,l.id===5?'ПОРТАЛ ЯДРА':'ВЫХОД ИЗ СЕКТОРА',{fontFamily:'monospace',fontSize:'10px',color:'#8B75FF',padding:{x:6,y:5},backgroundColor:'#090b19bb'}).setOrigin(.5).setDepth(19);
    for(const [target,rectangles] of Object.entries(l.constructions??{})) rectangles.forEach((r,index)=>{
      s.add.tileSprite(r[0],r[1],r[2],r[3],'tiles',3).setOrigin(0).setTint(0x5bf1f6).setAlpha(.1).setDepth(3);
      s.add.text(r[0]+r[2]/2,r[1]+38,`${target.toUpperCase()} [${index}]`,{fontFamily:'monospace',fontSize:'10px',color:'#5bf1f6'}).setOrigin(.5).setAlpha(.32);
    });
    this.crates=s.physics.add.group();
    for(const crate of l.crates??[]) this.crates.create(crate.x,crate.y,'objects',7).setBounce(.12).setCollideWorldBounds(true).setDepth(10).body.setMaxVelocity(20,550);
    s.physics.add.collider(this.crates,this.platforms);
    this.enemies=s.physics.add.group({allowGravity:false,immovable:true});
    for(const config of l.enemies??[]) {
      const enemy=new Enemy(s,config);this.enemies.add(enemy);enemy.body.setAllowGravity(false);enemy.setVelocity(0,0);
    }
    return this;
  }
  addPlatform(rect,frame=0) {
    const [x,y,w,h]=rect,s=this.scene;
    const sprite=s.add.tileSprite(x,y,w,h,'tiles',frame).setOrigin(0).setDepth(9);s.physics.add.existing(sprite,true);this.platforms.add(sprite);
    s.add.tileSprite(x,y,w,5,'tiles',4).setOrigin(0).setDepth(10).setAlpha(.8);
    if(h>32) for(let px=x+24;px<x+w-8;px+=96) s.add.image(px,y+24,'tiles',2).setOrigin(.5,0).setAlpha(.7).setDepth(10);
    return sprite;
  }
  constructPlatforms(target,done) {
    if(this.constructed.has(target)||this.pendingConstruction.has(target)) return;
    const rectangles=this.level.constructions?.[target]??(target==='bridge'?this.level.bridge:[])??[];
    this.pendingConstruction.add(target);
    if(target==='bridge') this.bridgePlatforms=[];
    rectangles.forEach((rect,index)=>this.scene.time.delayedCall(index*260,()=>{
      if(!this.scene.sys.isActive()) return;
      const platform=this.addPlatform(rect,3);platform.setAlpha(.15);platform.body.enable=false;
      if(target==='bridge') this.bridgePlatforms.push(platform);
      this.scene.tweens.add({targets:platform,alpha:1,duration:this.scene.reducedEffects?40:240,onComplete:()=>{if(platform.body)platform.body.enable=true;}});
      this.scene.burst(rect[0]+rect[2]/2,rect[1],0x5bf1f6,10);this.scene.audio?.play('success');
      if(index===rectangles.length-1) this.scene.time.delayedCall(270,()=>{this.constructed.add(target);this.pendingConstruction.delete(target);if(target==='bridge')this.scene.bridgeReady=true;done?.();});
    }));
    if(!rectangles.length) {this.constructed.add(target);this.pendingConstruction.delete(target);done?.();}
  }
  constructBridge(done) { this.constructPlatforms('bridge',done); }
  disableLasers(target) {
    this.disabledLaserGroups.add(target);this.updateHazards(this.scene.elapsedMs);
    this.scene.audio?.play('door');
  }
  updateHazards(time) {
    for(const sprite of this.laserSprites) {
      const config=sprite.hazardConfig;
      const disabled=this.disabledLaserGroups.has(config.group);
      const phase=config.period?((time+(config.phase??0))%config.period)/config.period:0;
      const active=!disabled&&(!config.period||phase<(config.duty??.5));
      sprite.body.enable=active;
      sprite.setAlpha(disabled ? .1 : active ? 1 : .16);
      sprite.warning.setText(disabled?'OFF':config.period?active?'ОПАСНО':'ПАУЗА':'ПОЛЕ');
      sprite.warning.setColor(disabled?'#5bf1f6':active?'#ff526a':'#f6cb77');
    }
  }
  evaluateGates(patches,itemCount) {
    for(const gate of this.gateObjects) {
      if(gate.open||!gate.config.requires.every(id=>patches.has(id))||(gate.config.items&&itemCount<gate.config.items)) continue;
      gate.open=true;gate.sprite.body.enable=false;gate.label.setText('ДОСТУП ОТКРЫТ').setColor('#5bf1f6');
      this.scene.audio?.play('door');this.scene.burst(gate.sprite.x,gate.sprite.y+80,0x8b75ff,12);
      this.scene.tweens.add({targets:gate.sprite,alpha:0,scaleY:.02,duration:this.scene.reducedEffects?40:420});
    }
  }
  openDoor() { this.evaluateGates(this.scene.patches,this.scene.itemCount); }
  activateExit(active) {
    this.exit.setAlpha(active?1:.28).setTint(active?0x5bf1f6:this.level.id===5?0xf76bd9:0x8b75ff);this.exitLabel.setColor(active?'#5BF1F6':'#8B75FF');
    if(active&&!this.exitReady) {this.exitReady=true;this.scene.burst(this.exit.x,this.exit.y-64,0x5bf1f6,24);}
  }
  updateParallax(scrollX,scrollY=0) {this.background.tilePositionX=scrollX*.14;this.background.tilePositionY=scrollY*.12;}
}
export default LevelBuilder;
