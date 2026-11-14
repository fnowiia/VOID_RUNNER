import Phaser from 'phaser';
import { getLevel } from '../config/levels.js';
import { lessons } from '../data/lessons.js';
import { dialogues } from '../data/dialogues.js';
import { Player } from '../core/Player.js';
import { Terminal } from '../core/Terminal.js';
import { LevelBuilder } from '../core/LevelBuilder.js';
import { PuzzleEngine } from '../core/PuzzleEngine.js';

export class GameScene extends Phaser.Scene {
  constructor() {super('Game');}
  init(data={}) {
    this.levelId=Number(data.levelId)||1;this.level=getLevel(this.levelId);
    this.elapsedMs=0;this.mistakes=0;this.hintsUsed=0;this.itemCount=0;this.deaths=Math.max(0,Number(data.deaths)||0);
    this.patches=new Set();this.terminalStates=Object.fromEntries(this.level.terminals.map(t=>[t.id,{patched:false,hintsUsed:0,appliedValues:null}]));
    this.patched=false;this.mainPatched=false;this.leverOn=false;this.bridgeReady=false;this.exitReady=false;this.pendingRepair=false;this.appliedValues=null;
    this.state='playing';this.completing=false;this.respawnUntil=0;this.activeTerminal=null;this.nearestTerminal=null;
    this.touch={left:false,right:false,jump:false,interact:false};this.touchPrevious={jump:false,interact:false};
    this.checkpoint={...(this.level.safeSpawn??this.level.spawn)};this.hudLastUpdate=0;
  }
  create() {
    const services=this.game.registry.get('services')??{};this.ui=services.ui;this.audio=services.audio;this.progress=services.progress;
    this.reducedEffects=Boolean(this.ui?.settings?.reducedEffects);
    this.physics.world.setBounds(0,0,this.level.width,this.level.height+256);this.physics.world.gravity.y=this.level.gravity;
    this.builder=new LevelBuilder(this,this.level).build();
    this.player=new Player(this,this.level.spawn.x,this.level.spawn.y,this.level.speed);this.player.setJump(this.level.jump??410);this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player,this.builder.platforms);this.physics.add.collider(this.player,this.builder.gates);
    this.physics.add.overlap(this.player,this.builder.hazards,()=>this.respawn());
    this.physics.add.overlap(this.player,this.builder.items,(_player,item)=>this.collect(item));
    this.physics.add.overlap(this.player,this.builder.enemies,(_player,enemy)=>this.killByEnemy(enemy));
    this.terminals=this.level.terminals.map((config,index)=>new Terminal(this,config,index));this.terminal=this.terminals[0];
    this.patch=this.add.sprite(this.player.x-44,this.player.y-70,'patch',4).setDepth(24).play('patch-talk');
    this.time.delayedCall(1400,()=>this.patch?.active&&this.patch.play('patch-float'));
    this.cameras.main.setBounds(0,0,this.level.width,this.level.height);this.cameras.main.startFollow(this.player,true,.1,.1,-75,45);this.cameras.main.setDeadzone(100,60);
    if(!this.reducedEffects) this.cameras.main.fadeIn(300,9,11,25);
    this.keys=this.input.keyboard.addKeys({left:'LEFT',right:'RIGHT',up:'UP',a:'A',d:'D',w:'W',space:'SPACE',e:'E',r:'R'},false);
    this.escapeHandler=event=>{event.preventDefault();if(this.state==='terminal')this.closeTerminal();else if(this.state==='paused')this.resumeGame();else if(this.state==='playing')this.pauseGame();};
    this.input.keyboard.on('keydown-ESC',this.escapeHandler);
    this.blurHandler=()=>{if(this.state==='playing')this.pauseGame();};this.game.events.on(Phaser.Core.Events.BLUR,this.blurHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.cleanup());
    this.ui?.hideAll();this.ui?.showHud(this,this.level);
    this.ui?.dialogue(this.deaths?`PATCH // Новый запуск сектора. Столкновения с монстрами стирают все патчи этой попытки. Смертей: ${this.deaths}.`:(dialogues[this.levelId]?.intro??this.level.objective));
    this.updateHud();
  }
  update(time,delta) {
    if(!this.player?.body)return;
    this.reducedEffects=Boolean(this.ui?.settings?.reducedEffects);this.builder.updateParallax(this.cameras.main.scrollX,this.cameras.main.scrollY);
    if(this.state!=='playing')return;
    this.elapsedMs+=Math.min(delta,100);this.builder.updateHazards(this.elapsedMs);
    for(const enemy of this.builder.enemies.getChildren())enemy.updatePatrol(this.elapsedMs,delta);
    const jumpPressed=Phaser.Input.Keyboard.JustDown(this.keys.space)||Phaser.Input.Keyboard.JustDown(this.keys.up)||Phaser.Input.Keyboard.JustDown(this.keys.w)||(this.touch.jump&&!this.touchPrevious.jump);
    const interactPressed=Phaser.Input.Keyboard.JustDown(this.keys.e)||(this.touch.interact&&!this.touchPrevious.interact);
    this.touchPrevious.jump=this.touch.jump;this.touchPrevious.interact=this.touch.interact;
    this.player.move({left:this.keys.left.isDown||this.keys.a.isDown||this.touch.left,right:this.keys.right.isDown||this.keys.d.isDown||this.touch.right,jumpPressed},this.time.now,delta);
    if(Phaser.Input.Keyboard.JustDown(this.keys.r)){this.restartLevel();return;}
    if(this.player.y>this.level.height+100)this.respawn();
    const patchX=this.player.x+(this.player.flipX?44:-44),patchY=this.player.y-65+Math.sin(time/500)*5;
    this.patch.x=Phaser.Math.Linear(this.patch.x,patchX,Math.min(1,delta/130));this.patch.y=Phaser.Math.Linear(this.patch.y,patchY,Math.min(1,delta/180));this.patch.setFlipX(this.player.flipX);
    this.nearestTerminal=null;
    for(const terminal of this.terminals){const near=terminal.near(this.player);terminal.setActive(near);if(near&&(!this.nearestTerminal||Math.abs(terminal.sprite.x-this.player.x)<Math.abs(this.nearestTerminal.sprite.x-this.player.x)))this.nearestTerminal=terminal;}
    if(this.nearestTerminal)this.terminal=this.nearestTerminal;
    const leverNear=this.builder.lever&&Math.abs(this.player.x-this.builder.lever.x)<64&&Math.abs(this.player.y-this.builder.lever.y)<70;
    this.builder.leverLabel?.setAlpha(leverNear?1:.5);
    if(interactPressed){if(this.nearestTerminal)this.openTerminal(this.nearestTerminal);else if(leverNear)this.activateLever();else if(Math.abs(this.player.x-this.level.exit.x)<90&&!this.exitReady)this.ui?.toast(this.remainingRequirements());}
    if(this.state!=='playing')return;
    if(this.physics.world.gravity.y>0)for(const checkpoint of this.builder.checkpoints){
      if(!checkpoint.active&&Math.abs(this.player.x-checkpoint.x)<32&&Math.abs(this.player.y-checkpoint.y)<46){
        checkpoint.active=true;checkpoint.sprite.setAlpha(1).setTint(0x5bf1f6);this.checkpoint={x:checkpoint.x,y:checkpoint.y-2};this.burst(checkpoint.x,checkpoint.y-20,0x5bf1f6,7);this.ui?.toast('Контрольная точка: падения сохраняют патчи, монстры перезапускают весь сектор.');
      }
    }
    this.evaluateWorld();
    if(this.exitReady&&Math.abs(this.player.x-this.level.exit.x)<40&&Math.abs(this.player.y-this.level.exit.y)<60)this.completeLevel();
    if(time-this.hudLastUpdate>120){this.hudLastUpdate=time;this.updateHud();}
  }
  terminalContext(terminal=this.activeTerminal??this.terminal) {
    if(!terminal)return null;
    const state=this.terminalStates[terminal.id];
    return{id:terminal.id,patched:state.patched,appliedValues:state.appliedValues,hintsUsed:state.hintsUsed,title:`Терминал ${terminal.index+1} / ${this.terminals.length}`};
  }
  updateHud() {
    const itemName=this.levelId===3?'Ключи':this.levelId===5?'Предохранители':'';
    const interaction=this.nearestTerminal?`E · терминал ${this.nearestTerminal.index+1}/3${this.nearestTerminal.patched?' ✓':''}`:(this.builder?.lever&&Math.abs(this.player.x-this.builder.lever.x)<64&&Math.abs(this.player.y-this.builder.lever.y)<70?'E · рубильник':'');
    this.ui?.updateHud({level:this.level,elapsedMs:this.elapsedMs,mistakes:this.mistakes,hintsUsed:this.hintsUsed,patched:this.patched,tasksDone:this.patches.size,tasksTotal:this.level.terminals.length,deaths:this.deaths,
      items:itemName?`${itemName}: ${this.itemCount}/2${this.levelId===5?` · Рубильник ${this.leverOn?'вкл.':'выкл.'}`:''}`:'',itemCount:this.itemCount,leverOn:this.leverOn,
      objective:this.exitReady?'Все системы восстановлены. Войдите в портал.':this.patched?this.level.patchedObjective:this.level.objective,interaction});
  }
  freezeWorld() {
    this.physics.pause();this.time.paused=true;this.tweens.pauseAll();this.player.setVelocityX(0);this.player.anims.pause();this.patch.anims.pause();
    for(const enemy of this.builder.enemies.getChildren())enemy.freeze();
    this.touch.left=false;this.touch.right=false;this.touch.jump=false;this.touch.interact=false;
  }
  thawWorld() {
    this.physics.resume();this.time.paused=false;this.tweens.resumeAll();this.player.anims.resume();this.patch.anims.resume();
    for(const enemy of this.builder.enemies.getChildren())enemy.unfreeze();
    this.input.keyboard.resetKeys();this.touchPrevious.jump=false;this.touchPrevious.interact=false;this.player.coyoteUntil=0;this.player.jumpBufferUntil=0;
  }
  openTerminal(terminal=this.nearestTerminal??this.terminal) {
    if(this.state!=='playing'||!terminal)return;
    if(typeof terminal==='string')terminal=this.terminals.find(t=>t.id===terminal);
    if(!terminal||!terminal.near(this.player))return;
    this.activeTerminal=terminal;this.terminal=terminal;this.appliedValues=this.terminalStates[terminal.id].appliedValues;
    this.state='terminal';this.freezeWorld();this.audio?.play('interact');
    this.ui?.openTerminal(this,lessons[terminal.lessonId],{onApply:values=>this.applyPatch(values),onHint:()=>this.revealHint(),onClose:()=>this.closeTerminal()},this.terminalContext(terminal));
  }
  closeTerminal() {
    if(this.state!=='terminal')return;
    this.state='playing';this.ui?.closeTerminal();this.activeTerminal=null;this.thawWorld();
    if(this.pendingRepair){this.player.repairUntil=this.time.now+600;this.pendingRepair=false;}this.updateHud();
  }
  revealHint() {
    const terminal=this.activeTerminal;if(!terminal)return '';
    const state=this.terminalStates[terminal.id],lesson=lessons[terminal.lessonId],index=Math.min(state.hintsUsed,1);
    if(state.hintsUsed<2){state.hintsUsed++;this.hintsUsed++;}this.updateHud();return lesson.hints[index];
  }
  applyPatch(values) {
    if(this.state!=='terminal'||!this.activeTerminal)return{correct:false,message:'Откройте терминал, чтобы применить исправление.'};
    const terminal=this.activeTerminal,state=this.terminalStates[terminal.id],lesson=lessons[terminal.lessonId];
    if(state.patched)return{correct:true,message:`Этот терминал уже восстановлен. ${lesson.success}`,effect:null};
    const result=PuzzleEngine.check(terminal.lessonId,values);
    if(!result.correct){this.mistakes++;this.audio?.play('error');this.patch.play('patch-warning');this.updateHud();if(!this.reducedEffects)this.cameras.main.shake(90,.002);return result;}
    state.patched=true;state.appliedValues={...values};this.appliedValues=state.appliedValues;this.patches.add(terminal.id);terminal.repair();
    this.patched=this.patches.size===this.level.terminals.length;this.mainPatched=this.patches.has(this.level.mainPuzzleId);this.audio?.play('success');this.patch.play('patch-joy');
    this.time.delayedCall(1000,()=>this.patch?.active&&this.patch.play('patch-float'));this.pendingRepair=true;
    const effect=result.effect;
    if(effect.type==='speed')this.player.setSpeed(effect.value);
    if(effect.type==='jump')this.player.setJump(effect.value);
    if(effect.type==='gravity'){
      this.physics.world.gravity.y=effect.value;this.checkpoint={...this.level.safeSpawn};this.player.resetAt(this.checkpoint.x,this.checkpoint.y);
      for(const crate of this.builder.crates.getChildren())crate.setVelocity(0,0);this.patch.setPosition(this.player.x-44,this.player.y-65);
    }
    if(effect.type==='laser')this.builder.disableLasers(effect.target);
    if(effect.type==='platforms'||effect.type==='bridge')this.builder.constructPlatforms(effect.target??'bridge',()=>this.evaluateWorld());
    this.burst(terminal.sprite.x,terminal.sprite.y-30,0x5bf1f6,20);if(!this.reducedEffects)this.cameras.main.flash(130,25,75,80,false);
    this.ui?.dialogue(`PATCH // Патч ${this.patches.size}/3 установлен. ${this.patched?'Теперь найдём выход.':'Другие терминалы находятся на разных ярусах сектора.'}`);
    this.evaluateWorld();this.updateHud();return result;
  }
  collect(item) {
    if(this.state!=='playing'||!item.active||item.collected)return;
    item.collected=true;item.body.enable=false;this.itemCount++;this.audio?.play('collect');this.tweens.killTweensOf(item);this.burst(item.x,item.y,0x5bf1f6,9);
    this.tweens.add({targets:item,y:item.y-32,alpha:0,scale:1.5,duration:250,onComplete:()=>item.destroy()});this.ui?.toast(`${item.itemType==='key'?'Энергетический ключ':'Предохранитель'} ${this.itemCount}/2`);this.evaluateWorld();this.updateHud();
  }
  activateLever() {
    if(this.leverOn){this.ui?.toast('Рубильник уже включён');return;}
    this.leverOn=true;this.builder.lever.setFrame(3).setTint(0x5bf1f6);this.builder.leverLabel.setText('ПИТАНИЕ ВКЛЮЧЕНО').setColor('#5bf1f6');this.audio?.play('interact');this.burst(this.builder.lever.x,this.builder.lever.y-20,0xf76bd9,9);this.ui?.toast('Рубильник включён. Питание подано на портал.');this.evaluateWorld();this.updateHud();
  }
  evaluateWorld() {
    this.builder.evaluateGates(this.patches,this.itemCount);
    const ready=this.patches.size===this.level.terminals.length&&this.builder.pendingConstruction.size===0&&(this.levelId!==3||this.itemCount>=2)&&(this.levelId!==5||(this.itemCount>=2&&this.leverOn));
    if(ready&&!this.exitReady){this.exitReady=true;this.builder.activateExit(true);this.ui?.dialogue(dialogues[this.levelId]?.exit??'PATCH // Все три терминала восстановлены. Выход открыт.');}
  }
  remainingRequirements() {
    if(this.patches.size<this.level.terminals.length)return`Восстановлено ${this.patches.size}/3 терминалов. Исследуйте верхние ярусы.`;
    if(this.builder.pendingConstruction.size)return'Дождитесь материализации построенных платформ.';
    if(this.levelId===3&&this.itemCount<2)return'Для последней двери нужны оба ключа.';
    if(this.levelId===5)return'Порталу нужны два предохранителя И включённый рубильник.';
    return'Все системы восстановлены. Войдите в портал.';
  }
  respawn() {
    if(this.state!=='playing'||this.time.now<this.respawnUntil)return;
    this.respawnUntil=this.time.now+750;const safe=this.physics.world.gravity.y<0?this.level.spawn:this.checkpoint;this.player.resetAt(safe.x,safe.y);this.player.hurtUntil=this.time.now+700;this.patch.setPosition(safe.x-42,safe.y-68);this.audio?.play('hurt');
    if(!this.reducedEffects)this.cameras.main.shake(100,.003);this.ui?.toast('PATCH: вернул к контрольной точке. Патчи и предметы сохранены.');
  }
  killByEnemy(enemy) {
    if(this.state!=='playing'||this.time.now<this.respawnUntil)return;
    this.state='dead';this.deaths++;this.freezeWorld();this.audio?.play('hurt');this.player.setTint(0xff526a).play('player-hurt');this.patch.play('patch-warning');
    this.ui?.showDeath?.(this,{deaths:this.deaths,reason:enemy?.enemyType==='flyer'?'ЛЕТАЮЩИЙ НАБЛЮДАТЕЛЬ':'ЗАРАЖЁННЫЙ БОТ',resetInMs:950});
    if(!this.ui?.showDeath)this.ui?.toast(`Смерть ${this.deaths}. Монстр перезапускает весь уровень. Все патчи этой попытки сброшены.`);
    if(!this.reducedEffects)this.cameras.main.shake(200,.006);this.updateHud();
    this.time.paused=false;this.time.delayedCall(950,()=>this.restartLevel());
  }
  pauseGame(){if(this.state!=='playing')return;this.state='paused';this.freezeWorld();this.ui?.showPause(this);}
  resumeGame(){if(this.state!=='paused')return;this.state='playing';this.ui?.closePause?.();this.thawWorld();}
  restartLevel(){this.ui?.closeTerminal();this.ui?.hideAll();this.scene.restart({levelId:this.levelId,deaths:this.deaths});}
  goMenu(){this.ui?.hideAll();this.scene.start('Menu');}
  async completeLevel() {
    if(this.completing||!this.exitReady)return;
    this.completing=true;this.state='complete';this.freezeWorld();this.audio?.play('win');
    const result={levelId:this.levelId,durationMs:Math.max(1,Math.round(this.elapsedMs)),mistakes:this.mistakes,hintsUsed:this.hintsUsed};
    const stars=this.mistakes===0&&this.hintsUsed===0?3:this.mistakes<=2&&this.hintsUsed<=1?2:1;
    let run={level_id:this.levelId,duration_ms:result.durationMs,mistakes:this.mistakes,hints_used:this.hintsUsed,stars};
    try{const saved=await this.progress?.completeLevel(result);if(saved)run=saved;}catch(error){console.error('Не удалось сохранить прохождение',error);this.ui?.toast('Не удалось сохранить результат. Проверьте хранилище.');}
    if(!this.sys.isActive())return;this.ui?.hideAll();this.cameras.main.fadeOut(this.reducedEffects?50:320,9,11,25);this.time.paused=false;
    this.time.delayedCall(this.reducedEffects?70:350,()=>this.scene.start('Results',{...result,run,stars,deaths:this.deaths,tasksDone:this.patches.size}));
  }
  burst(x,y,tint=0x5bf1f6,count=12) {
    if(this.reducedEffects)return;
    for(let i=0;i<Math.min(count,24);i++){const particle=this.add.image(x,y,'objects',10).setScale(.18).setTint(tint).setDepth(32);this.tweens.add({targets:particle,x:x+Phaser.Math.Between(-60,60),y:y+Phaser.Math.Between(-64,20),alpha:0,scale:0,duration:Phaser.Math.Between(300,650),onComplete:()=>particle.destroy()});}
  }
  cleanup(){this.input?.keyboard?.off('keydown-ESC',this.escapeHandler);this.game?.events?.off(Phaser.Core.Events.BLUR,this.blurHandler);if(this.time)this.time.paused=false;this.ui?.closeTerminal();this.touch={left:false,right:false,jump:false,interact:false};}
}
export default GameScene;
