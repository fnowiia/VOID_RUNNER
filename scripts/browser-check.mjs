import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';

const artifactDir=process.env.QA_OUTPUT||'work/browser-qa';
await mkdir(artifactDir,{recursive:true});
const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-webgl']});
const page=await browser.newPage({viewport:{width:1280,height:800}});
// Traversal intentionally verifies offline fallback. A separate cloud acceptance
// check uses real Supabase sessions and RLS; this suite never creates test users.
await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.abort('failed'));
const errors=[],report=[],visitedPuzzles=new Set();
page.on('pageerror',error=>errors.push(error.stack));
page.on('response',response=>{if(response.status()>=400&&!response.url().includes('.supabase.co/'))errors.push(`${response.status()} ${response.url()}`);});
const answers={
 '1-main':{speed:220},'1-jump':{strength:460},'1-laser':{maintenance:'true'},
 '2-main':{gravity:700},'2-lift':{operator:'/'},'2-shield':{operator:'+',divisor:2},
 '3-main':{operator:'>='},'3-route':{index:1},'3-permission':{logical:'&&'},
 '4-main':{count:3},'4-step':{limit:4,step:1},'4-power':{operator:'+='},
 '5-reactor':{negation:'!',logical:'&&'},'5-checksum':{operator:'==='},'5-main':{comparison:'>=',logical:'&&'},
};
const readState=()=>page.evaluate(()=>{
 const game=window.__ERROR404__.game,scene=game.scene.getScene('Game'),body=scene.player?.body;
 return{level:scene.levelId,x:Math.round((scene.player?.x||0)*10)/10,y:Math.round((scene.player?.y||0)*10)/10,vx:Math.round(body?.velocity.x||0),vy:Math.round(body?.velocity.y||0),grounded:!!body?.blocked.down,state:scene.state,items:scene.itemCount,patches:[...(scene.patches||[])],hints:scene.hintsUsed,mistakes:scene.mistakes,deaths:scene.deaths,ready:scene.exitReady,activeTerminal:scene.activeTerminal?.id,scenes:game.scene.getScenes(true).map(s=>s.scene.key)};
});
const tick=(frames=1)=>page.evaluate(frames=>{
 const game=window.__ERROR404__.game;
 for(let i=0;i<frames;i++){window.qaTime+=1000/60;game.headlessStep(window.qaTime,1000/60);}
},frames);
async function key(name){await page.keyboard.down(name);await tick(2);await page.keyboard.up(name);await tick(1);}
async function render(path){await page.evaluate(()=>{if(Number.isFinite(window.qaTime)){const game=window.__ERROR404__.game,s=game.scene.getScene('Game');const camera=s.sys.isActive()?s.cameras.main:null;const old=camera?{x:camera.lerp.x,y:camera.lerp.y}:null;if(camera)camera.setLerp(1,1);window.qaTime+=1000/60;game.step(window.qaTime,1000/60);if(camera)camera.setLerp(old.x,old.y);}});await page.screenshot({path:`${artifactDir}/${path}.png`});}
async function waitEnemy(id,{xAtMost,xAtLeast,direction}={}){
 assert.ok(Math.abs((await readState()).vx)<5,`Wait for ${id} from a stationary safe ledge`);
 const result=await page.evaluate(({id,xAtMost,xAtLeast,direction})=>{
  const game=window.__ERROR404__.game,s=game.scene.getScene('Game');let frame=0;
  const enemy=s.builder.enemies.getChildren().find(e=>e.enemyId===id);
  if(!enemy)throw new Error(`Missing enemy ${id}`);
  const ready=()=> (xAtMost===undefined||enemy.x<=xAtMost)&&(xAtLeast===undefined||enemy.x>=xAtLeast)&&(direction===undefined||enemy.patrol.direction===direction);
  while(!ready()&&frame<1200&&s.state==='playing'){window.qaTime+=1000/60;game.headlessStep(window.qaTime,1000/60);frame++;}
  return{ready:ready(),frame,x:enemy.x,direction:enemy.patrol.direction,state:s.state};
 },{id,xAtMost,xAtLeast,direction});
 assert.ok(result.ready,`Enemy timing window ${id}: ${JSON.stringify(result)}`);
}
/** Release before the target according to the real player's deceleration.
 * This only sends keyboard input; it never changes positions or physics. */
async function move(x,{jump=false,runThrough=false,settle=100,feet}={}){
 const before=await readState(),direction=x>=before.x?1:-1,button=direction>0?'d':'a';
 await page.keyboard.down(button);if(jump)await key('Space');
 const outcome=await page.evaluate(({target,direction,runThrough})=>{
  const game=window.__ERROR404__.game,s=game.scene.getScene('Game');let frame=0;
  while(s.state==='playing'&&frame<1100){
   const body=s.player.body,grounded=body.blocked.down||body.touching.down;
   const projected=s.player.x+(runThrough?0:body.velocity.x/(grounded?1550/s.player.speed:1000/s.player.speed));
   if(direction*(projected-target)>=0)break;
   window.qaTime+=1000/60;game.headlessStep(window.qaTime,1000/60);frame++;
  }
  return{frame,state:s.state};
 },{target:x,direction,runThrough});
 if(!runThrough)await page.keyboard.up(button);
 if(!runThrough&&settle)await tick(settle);
 const after=await readState();console.log('MOVE',x,jump?'J':'-',after);
 assert.ok(outcome.frame<1100,`Cannot reach x=${x}: ${JSON.stringify(after)}`);
 assert.notEqual(after.state,'dead',`Enemy killed traversal at x=${x}: ${JSON.stringify(after)}`);
 assert.equal(after.deaths,0,`Unexpected restart during traversal: ${JSON.stringify(after)}`);
 if(feet!==undefined&&after.state==='playing')assert.ok(Math.abs(after.y-feet)<4,`Wrong landing at x=${x}; expected feet ${feet}: ${JSON.stringify(after)}`);
 return after;
}
async function stopKeys(){await page.keyboard.up('d');await page.keyboard.up('a');await page.keyboard.up('Space');}
async function puzzle(id,{wrong=false,hint=false,reopen=false}={}){
 await stopKeys();await key('e');
 await page.locator('.terminal-window').waitFor({timeout:4000});
 assert.equal((await readState()).activeTerminal,id,`Wrong terminal instead of ${id}`);
 const elapsed=await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').elapsedMs);await tick(60);
 assert.equal(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').elapsedMs),elapsed,'Terminal must freeze level timer');
 if(hint){await page.locator('[data-hint]').click();assert.match(await page.locator('[data-hint] span').innerText(),/1\s*\/\s*2/);await page.locator('[data-close]').click();await key('e');assert.match(await page.locator('[data-hint] span').innerText(),/1\s*\/\s*2/);}
 else assert.match(await page.locator('[data-hint] span').innerText(),/0\s*\/\s*2/,'Hints must belong to this terminal only');
 if(wrong){await page.locator('[data-apply]').click();assert.ok((await page.locator('.system-message').getAttribute('class')).includes('error'));}
 for(const[field,value]of Object.entries(answers[id]))await page.locator(`[name="${field}"]`).selectOption(String(value));
 await page.locator('[data-apply]').click();assert.ok((await page.locator('.system-message').getAttribute('class')).includes('success'));
 visitedPuzzles.add(id);
 if(id==='1-main')await render('terminal');
 await page.locator('[data-return]').click();await tick(100);
 const constructionTargets={'2-lift':'lift','4-main':'bridge','4-step':'stairs'};
 if(constructionTargets[id]){
  // Phaser's tween scheduler reads wall time. Fast physics frames deliberately
  // wait for the real materialisation animation before using its collider.
  let ready=false;
  for(let attempt=0;attempt<30&&!ready;attempt++){
   await page.waitForTimeout(50);await tick(5);
   ready=await page.evaluate(target=>{const s=window.__ERROR404__.game.scene.getScene('Game'),rectangles=s.level.constructions[target];return rectangles.every(rect=>s.builder.platforms.getChildren().some(p=>p.x===rect[0]&&p.y===rect[1]&&p.body?.enable));},constructionTargets[id]);
  }
  assert.ok(ready,`Materialised construction ${constructionTargets[id]} must have enabled colliders`);
 }
 assert.ok((await readState()).patches.includes(id),`Patch ${id} not applied`);
 if(reopen){await key('e');await page.locator('.terminal-window').waitFor();for(const[field,value]of Object.entries(answers[id])){assert.equal(await page.locator(`[name="${field}"]`).inputValue(),String(value));assert.ok(await page.locator(`[name="${field}"]`).isDisabled());}await page.locator('[data-return]').click();await tick(5);}
 console.log('PATCH',id,await readState());
}
async function result(id){
 await stopKeys();await tick(90);await page.locator('[data-next]').waitFor({timeout:4000});
 const progress=await page.evaluate(()=>window.__ERROR404__.progress.getState());
 assert.ok(progress.progress[id]);assert.equal(progress.progress[id].best_stars,id===1?2:3);
 report.push({level:id,progress:progress.progress[id]});await render(`result${id}`);console.log('PASS LEVEL',id);
 await page.locator('[data-next]').click();await tick(8);
}
async function firstTower({x=1104,secondTerminal}={}){
 await move(340,{runThrough:true});await move(496,{jump:true,feet:816});await move(688,{jump:true,feet:736});
 if(secondTerminal)await puzzle(secondTerminal);
 await move(880,{jump:true,feet:656});await move(x,{jump:true,feet:624});
}
async function levelOne(){
 await puzzle('1-main',{wrong:true,hint:true,reopen:true});
 assert.equal(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').player.speed),220);
 await firstTower();await puzzle('1-jump');
 assert.equal(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').player.jumpVelocity),-460);
 await move(1190,{runThrough:true});await move(1408,{jump:true,feet:488});await move(1640,{jump:true,feet:488});
 await waitEnemy('boot-f1',{xAtLeast:1960,direction:1});await move(1880,{jump:true,feet:560});
 await waitEnemy('boot-f1',{xAtMost:1830,direction:-1});await move(2144,{jump:true,feet:512});await puzzle('1-laser');
 assert.ok(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').builder.disabledLaserGroups.has('boot')));
 await move(2448,{jump:true,feet:592});await move(2688,{jump:true,feet:672});await move(2912,{jump:true,feet:752});await move(3152,{jump:true,feet:816});
 await move(3208,{runThrough:true});await move(3420,{jump:true,feet:896});await move(3696,{jump:true,feet:896});await move(3904);await result(1);
}
async function levelTwo(){
 await move(145,{settle:30});await puzzle('2-main');assert.equal(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').physics.world.gravity.y),700);
 await move(340,{runThrough:true});await move(496,{jump:true,feet:816});await move(688,{jump:true,feet:736});await move(896,{jump:true,feet:704});await puzzle('2-lift');
 assert.equal(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').builder.constructed.has('lift')),true);
 await move(1000,{runThrough:true});await move(1184,{jump:true,feet:624});await move(1384,{jump:true,feet:544});await move(1592,{jump:true,feet:464});
 await waitEnemy('gravity-f1',{xAtMost:1510,direction:-1});await move(1840,{jump:true,feet:464});await puzzle('2-shield');
 await move(2144,{jump:true,feet:544});await move(2384,{jump:true,feet:624});await move(2608,{jump:true,feet:704});await move(2848,{jump:true,feet:784});
 await move(2920,{runThrough:true});await move(3216,{jump:true,feet:800});await move(3210,{settle:10});await move(3472,{jump:true,feet:896});await move(3740,{jump:true,feet:896});await move(3904);await result(2);
}
async function securityEntrance(){await move(304);await puzzle('3-main');await firstTower({secondTerminal:'3-route'});assert.equal((await readState()).items,1);}
async function verifyMonsterRestart(){
 const before=await readState();assert.equal(before.level,3);assert.equal(before.items,1);assert.equal(before.patches.length,2);
 const savedBefore=await page.evaluate(()=>window.__ERROR404__.progress.getState().progress);
 await move(976,{feet:896});await waitEnemy('security-c1',{xAtMost:1140,direction:-1});
 await page.keyboard.down('d');
 const death=await page.evaluate(()=>{const game=window.__ERROR404__.game,s=game.scene.getScene('Game');let n=0;while(s.state==='playing'&&n<600){window.qaTime+=1000/60;game.headlessStep(window.qaTime,1000/60);n++;}return{state:s.state,deaths:s.deaths,items:s.itemCount,patches:[...s.patches]};});
 await stopKeys();assert.equal(death.state,'dead','Actual enemy overlap must kill the player');assert.equal(death.deaths,1);assert.equal(death.items,1);assert.equal(death.patches.length,2);assert.ok(await page.locator('.death-screen').isVisible());await render('monster-death');
 await tick(61);const restarted=await readState();assert.equal(restarted.level,3);assert.equal(restarted.state,'playing');assert.deepEqual(restarted.patches,[]);assert.equal(restarted.items,0);assert.equal(restarted.hints,0);assert.equal(restarted.mistakes,0);assert.equal(restarted.deaths,1);
 assert.deepEqual(await page.evaluate(()=>window.__ERROR404__.progress.getState().progress),savedBefore,'Enemy restart must preserve completed levels');
 report.push({check:'monster full restart',before:death,after:restarted,preservedCompletedLevels:Object.keys(savedBefore)});
 // Restarting an attempt carries the death counter by design. No subsequent
 // traversal assertion treats this intentional death as an unexpected restart.
 await page.evaluate(()=>{window.qaExpectedDeaths=1;});
}
async function levelThree(){
 await securityEntrance();
 // Death reset is exercised in a separate page after the complete route; the
 // traversal itself keeps strict no-death assertions for every movement.
 await waitEnemy('security-f1',{xAtLeast:1530,direction:1});await move(1190,{runThrough:true});await move(1424,{jump:true,feet:560});
 await waitEnemy('security-f1',{xAtMost:1350,direction:-1});await move(1664,{jump:true,feet:512});await move(1920,{jump:true,feet:480});await puzzle('3-permission');
 await move(2160,{jump:true,feet:560});await waitEnemy('security-f2',{xAtLeast:2650,direction:1});await move(2368,{jump:true,feet:624});
 await waitEnemy('security-f2',{xAtLeast:2650,direction:1});await move(2608,{jump:true,feet:624});await move(2688,{feet:624});assert.equal((await readState()).items,2);
 await move(2896,{feet:704});await move(3152,{jump:true,feet:816});await move(3208,{runThrough:true});await move(3472,{jump:true,feet:896});await move(3730,{jump:true,feet:896});await move(3968);await result(3);
}
async function levelFour(){
 await move(230,{runThrough:true});await move(432,{jump:true,feet:896});await move(552);await puzzle('4-main');assert.equal(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').builder.bridgePlatforms.length),3);
 await move(625,{runThrough:true});await move(832,{jump:true,feet:864});await move(1024,{jump:true,feet:832});await move(1216,{jump:true,feet:864});
 await move(1260,{runThrough:true});await move(1520,{jump:true,feet:816});await move(1760,{jump:true,feet:736});await puzzle('4-step');
 await move(1952,{jump:true,feet:656});await move(2144,{jump:true,feet:576});
 await move(2200,{feet:576});await waitEnemy('constructor-f1',{xAtMost:2140,direction:-1});await move(2370,{jump:true,runThrough:true,feet:496});await move(2528,{jump:true,feet:416});await move(2720,{jump:true,feet:416});await puzzle('4-power');
 await move(3000,{feet:576});await move(3208,{feet:656});await move(3400,{feet:736});await move(3592,{feet:816});await move(3800,{feet:896});await move(3968);await result(4);
}
async function levelFive(){
 await firstTower({x:1088});await puzzle('5-reactor');await move(1296,{jump:true,feet:544});await move(1488,{jump:true,feet:488});assert.equal((await readState()).items,1);
 await move(1728,{jump:true,feet:488});await waitEnemy('core-f1',{xAtMost:1680,direction:-1});await move(1936,{jump:true,feet:416});await move(2208,{jump:true,feet:416});await puzzle('5-checksum');
 await move(2480,{feet:512});await waitEnemy('core-f2',{xAtLeast:2750,direction:1});await move(2688,{feet:624});assert.equal((await readState()).items,2);await move(2896,{feet:704});await move(3040,{feet:896});await key('e');assert.equal(await page.evaluate(()=>window.__ERROR404__.game.scene.getScene('Game').leverOn),true);
 await move(3152,{jump:true,feet:816});await move(3208,{runThrough:true});await move(3400,{jump:true,feet:896});await waitEnemy('core-c2',{xAtLeast:3540,direction:1});await move(3420,{runThrough:true});await move(3612,{jump:true,feet:896});await move(3600,{feet:896});await puzzle('5-main');assert.equal((await readState()).ready,true);
 await move(3840,{jump:true,feet:896});await move(3968);await result(5);
}
try{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:4173');
 await page.locator('[data-play]').waitFor({timeout:12000});await render('menu');await page.locator('[data-play]').click();await page.locator('#nickname').fill('Сквозной тест');await page.locator('[type=submit]').click();
 await page.locator('.hud').waitFor({timeout:5000});assert.deepEqual(errors,[],'Boot must have no errors');
 await page.evaluate(()=>{const game=window.__ERROR404__.game;game.loop.stop();window.qaTime=performance.now();});await tick(8);
 await levelOne();await levelTwo();await levelThree();await levelFour();await levelFive();
 await tick(200);await page.locator('.final-screen').waitFor();assert.match(await page.locator('.final-screen').innerText(),/Выход найден/);await render('final');
 assert.equal(visitedPuzzles.size,15);assert.deepEqual([...visitedPuzzles].sort(),Object.keys(answers).sort());
 await page.reload();await page.locator('[data-play]').waitFor();assert.equal(await page.evaluate(()=>Object.keys(window.__ERROR404__.progress.getState().progress).length),5);
 await page.locator('[data-levels]').click();await page.locator('[data-level="3"]').click();await page.locator('.hud').waitFor();
 await page.evaluate(()=>{window.__ERROR404__.game.loop.stop();window.qaTime=performance.now();});await tick(8);await securityEntrance();await verifyMonsterRestart();await render('monster-restart');
 assert.deepEqual(errors,[]);console.log('ALL FIVE LEVELS + FIFTEEN PUZZLES + FINAL + RELOAD + PHYSICAL MONSTER RESTART PASSED');
 await writeFile(`${artifactDir}/report.json`,JSON.stringify({passed:true,method:'Real Phaser physics advanced with keyboard input; no teleportation, forced completion or disabled enemies.',cloudRequestsIntercepted:true,puzzles:[...visitedPuzzles],report,errors},null,2));
}catch(error){console.error('FAILED',error);console.log('STATE',await readState().catch(()=>null));console.log('UI',await page.locator('body').innerText().catch(()=>''));await render('failure').catch(()=>{});await writeFile(`${artifactDir}/failure.json`,JSON.stringify({passed:false,error:String(error),state:await readState().catch(()=>null),errors,report},null,2));process.exitCode=1;}finally{await browser.close();}
