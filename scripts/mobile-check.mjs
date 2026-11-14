import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
const artifactDir=process.env.QA_OUTPUT||'work/browser-qa';await mkdir(artifactDir,{recursive:true});
const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
const browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-webgl']});
const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
await page.route(/https:\/\/[^/]+\.supabase\.co\//,route=>route.abort('failed'));
const errors=[];page.on('pageerror',error=>errors.push(error.stack));
async function hold(selector,milliseconds){const box=await page.locator(selector).boundingBox();assert.ok(box,`Missing ${selector}`);await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(milliseconds);await page.mouse.up();}
const state=()=>page.evaluate(()=>{const s=window.__ERROR404__.game.scene.getScene('Game');return{x:s.player.x,y:s.player.y,state:s.state,patches:[...s.patches],elapsed:s.elapsedMs,speed:s.player.speed};});
try{
 await page.goto(process.env.QA_URL||'http://127.0.0.1:4173');await page.locator('[data-play]').waitFor({timeout:12000});assert.deepEqual(errors,[]);await page.screenshot({path:`${artifactDir}/mobile-menu.png`});
 await page.locator('[data-play]').click();await page.locator('#nickname').fill('Мобильный');await page.locator('[type=submit]').click();await page.locator('.hud').waitFor({timeout:5000});await page.waitForTimeout(500);
 await hold('[data-touch=interact]',180);await page.locator('.terminal-window').waitFor({timeout:4000});
 await page.screenshot({path:`${artifactDir}/mobile-terminal.png`});await page.locator('[name=speed]').selectOption('220');await page.locator('[data-apply]').click();await page.locator('[data-return]').click();await page.waitForTimeout(250);
 assert.deepEqual((await state()).patches,['1-main']);assert.equal((await state()).speed,220);assert.match(await page.locator('[data-tasks]').innerText(),/1\s*\/\s*3/);
 const before=await state();await hold('[data-touch=right]',700);const after=await state();assert.ok(after.x>before.x+40,'Screen movement button must move the player');
 await page.waitForTimeout(300);const grounded=await state();await hold('[data-touch=jump]',180);assert.ok((await state()).y<grounded.y-20,'Screen jump button must trigger physics');await page.waitForTimeout(1100);
 await page.screenshot({path:`${artifactDir}/mobile-game.png`});
 const bounds=await page.evaluate(()=>({canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),buttons:[...document.querySelectorAll('[data-touch]')].map(el=>el.getBoundingClientRect().toJSON())}));
 assert.ok(bounds.buttons.every(button=>button.y>=bounds.canvas.bottom-1),'Touch controls must have their own strip below the playable canvas');
 await page.locator('[data-pause]').click();const frozen=await state();await page.waitForTimeout(250);assert.equal((await state()).elapsed,frozen.elapsed,'Pause must freeze timer');
 await page.locator('[data-settings].secondary').click();await page.locator('[name=muted]').check();await page.locator('[name=reducedEffects]').check();await page.locator('[data-close]').click();await page.locator('[data-resume]').click();assert.equal((await state()).state,'playing');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('error404-settings')).muted),true);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);assert.ok(await page.locator('.rotate-hint').isVisible());await page.screenshot({path:`${artifactDir}/mobile-portrait.png`});
 assert.deepEqual(errors,[]);await writeFile(`${artifactDir}/mobile-report.json`,JSON.stringify({passed:true,landscape:{width:844,height:390},portrait:{width:390,height:844},movement:{from:before.x,to:after.x},canvasClearOfTouchControls:true,errors},null,2));console.log('MOBILE TOUCH MOVEMENT, JUMP, TERMINAL, SETTINGS, PAUSE AND PORTRAIT PASSED');
}catch(error){console.error('FAILED',error);console.log('STATE',await state().catch(()=>null));await page.screenshot({path:`${artifactDir}/mobile-failure.png`}).catch(()=>{});process.exitCode=1;}finally{await browser.close();}
