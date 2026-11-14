import test from 'node:test';
import assert from 'node:assert/strict';
import { levels } from '../src/config/levels.js';
import { lessons } from '../src/data/lessons.js';
import { PuzzleEngine } from '../src/core/PuzzleEngine.js';

const GRAVITY=700, HALF_BODY=9, BODY_HEIGHT=40;
const intersects=(a,b)=>a.right>b.left+.05&&a.left<b.right-.05&&a.bottom>b.top+.05&&a.top<b.bottom-.05;
const rectBounds=([x,y,w,h])=>({left:x,right:x+w,top:y,bottom:y+h});
const supports=(r,x,y)=>x>=r[0]+HALF_BODY&&x<=r[0]+r[2]-HALF_BODY&&Math.abs(r[1]-y)<8;

function solve(lessonId) {
  const lesson=lessons[lessonId];
  const combinations=lesson.fields.reduce((rows,field)=>rows.flatMap(row=>field.options.map(value=>({...row,[field.name]:value}))),[{}]);
  const match=combinations.map(values=>PuzzleEngine.check(lessonId,values)).find(result=>result.correct);
  assert.ok(match,`terminal ${lessonId} has a valid finite patch`);
  return match.effect;
}

/** Conservative body-sized arcs, including solid ceilings and closed repair gates. */
function reachable(level,{patches=new Set(),constructed=new Set(),items=0,speed=220,jump=410}={}) {
  const platforms=[...level.platforms,...Object.entries(level.constructions??{}).filter(([target])=>constructed.has(target)).flatMap(([,rectangles])=>rectangles)];
  const gates=(level.gates??[]).filter(g=>!g.requires.every(id=>patches.has(id))||(g.items&&items<g.items));
  const nodes=[];
  for(const [index,p] of platforms.entries()) {
    let intervals=[[p[0]+HALF_BODY+1,p[0]+p[2]-HALF_BODY-1]];
    for(const gate of gates) {
      if(gate.y>=p[1]||gate.y+gate.h<=p[1]-BODY_HEIGHT)continue;
      const left=gate.x-HALF_BODY-1,right=gate.x+gate.w+HALF_BODY+1;
      intervals=intervals.flatMap(([a,b])=>right<=a||left>=b?[[a,b]]:[[a,Math.min(b,left)],[Math.max(a,right),b]].filter(([x,y])=>y-x>2));
    }
    for(const [left,right] of intervals)nodes.push({left,right,y:p[1],platform:index});
  }
  const spawn=level.safeSpawn??level.spawn;
  const first=nodes.findIndex(n=>spawn.x>=n.left&&spawn.x<=n.right&&Math.abs(n.y-spawn.y)<8);
  assert.ok(first>=0,`level ${level.id}: safe spawn is supported outside a closed gate`);
  const solids=[...platforms.map(rectBounds),...gates.map(g=>({left:g.x,right:g.x+g.w,top:g.y,bottom:g.y+g.h}))];
  const maxRise=jump*jump/(2*GRAVITY);
  const samples=n=>{const points=new Set([n.left,n.right,(n.left+n.right)/2]);for(let x=n.left+64;x<n.right;x+=64)points.add(x);return [...points];};
  function canJump(a,b) {
    const rise=a.y-b.y;
    if(rise>maxRise-4)return false;
    const landingTime=(jump+Math.sqrt(jump*jump-2*GRAVITY*rise))/GRAVITY;
    const minGap=Math.max(0,b.left-a.right,a.left-b.right);
    if(minGap+10>speed*landingTime)return false;
    for(const fromX of samples(a))for(const toX of samples(b)) {
      const dx=toX-fromX;
      if(Math.abs(dx)+10>speed*landingTime)continue;
      let clear=true;
      const steps=Math.max(24,Math.ceil(landingTime*75));
      for(let step=1;step<steps;step++) {
        const fraction=step/steps,t=landingTime*fraction,x=fromX+dx*fraction,y=a.y-jump*t+GRAVITY*t*t/2;
        const body={left:x-HALF_BODY,right:x+HALF_BODY,top:y-BODY_HEIGHT,bottom:y};
        if(solids.some(r=>intersects(body,r))){clear=false;break;}
      }
      if(clear)return true;
    }
    return false;
  }
  const reached=new Set([first]),queue=[first];
  while(queue.length) {
    const index=queue.shift(),a=nodes[index];
    for(let j=0;j<nodes.length;j++)if(!reached.has(j)) {
      const b=nodes[j];
      const walking=a.platform===b.platform&&Math.abs(a.y-b.y)<1&&a.right>=b.left&&b.right>=a.left;
      if(walking||canJump(a,b)){reached.add(j);queue.push(j);}
    }
  }
  const hasPoint=(x,y,margin=7)=>[...reached].some(index=>{const n=nodes[index];return x>=n.left&&x<=n.right&&Math.abs(n.y-y)<=margin;});
  return{platforms,nodes,reached,hasPoint};
}

function restoreLevel(level,{omitConstruction}={}) {
  const state={patches:new Set(),constructed:new Set(),items:0,speed:level.speed,jump:level.jump};
  // The inverted-gravity terminal is checked separately; repairing it returns to safeSpawn.
  if(level.gravity<0){state.patches.add(level.mainPuzzleId);state.speed=220;}
  let last,changed=true;
  while(changed) {
    changed=false;last=reachable(level,state);
    for(const terminal of level.terminals) {
      if(state.patches.has(terminal.id)||!last.hasPoint(terminal.x,terminal.y))continue;
      state.patches.add(terminal.id);changed=true;
      const effect=solve(terminal.lessonId);
      if(effect.type==='speed')state.speed=effect.value;
      if(effect.type==='jump')state.jump=effect.value;
      if((effect.type==='platforms'||effect.type==='bridge')&&effect.target!==omitConstruction)state.constructed.add(effect.target??'bridge');
    }
    const collected=level.items.filter(item=>last.hasPoint(item.x,item.y+24,10)).length;
    if(collected>state.items){state.items=collected;changed=true;}
  }
  return{...state,map:last};
}

for(const level of levels) {
  test(`level ${level.id}: all three terminals and resources are reachable in repair order`,()=>{
    assert.equal(level.terminals.length,3);
    assert.equal(new Set(level.terminals.map(t=>t.id)).size,3);
    const restored=restoreLevel(level);
    assert.equal(restored.patches.size,3,`unreachable terminals: ${level.terminals.filter(t=>!restored.patches.has(t.id)).map(t=>t.id).join(', ')}`);
    assert.equal(restored.items,level.items.length,'all required collectibles have reachable supporting surfaces');
    assert.ok(restored.map.hasPoint(level.exit.x,level.exit.y),'exit is reachable after repairing its prerequisites');
    if(level.lever)assert.ok(restored.map.hasPoint(level.lever.x,level.lever.y),'power lever is reachable');
  });
  test(`level ${level.id}: checkpoints are supported and do not intersect hazards or gates`,()=>{
    for(const point of [...level.checkpoints,level.safeSpawn??level.spawn]) {
      assert.ok(level.platforms.some(p=>supports(p,point.x,point.y)),`checkpoint ${point.x},${point.y} has solid support`);
      const body={left:point.x-HALF_BODY,right:point.x+HALF_BODY,top:point.y-BODY_HEIGHT,bottom:point.y-2};
      for(const p of level.platforms)assert.equal(intersects(body,rectBounds(p)),false,`checkpoint is inside platform ${p}`);
      for(const hazard of level.hazards)assert.equal(intersects(body,{left:hazard.x,right:hazard.x+hazard.w,top:hazard.y,bottom:hazard.y+hazard.h}),false,'checkpoint is inside a hazard');
      for(const gate of level.gates??[])assert.equal(intersects(body,{left:gate.x,right:gate.x+gate.w,top:gate.y,bottom:gate.y+gate.h}),false,'checkpoint is inside a repair gate');
    }
  });
  test(`level ${level.id}: patrols stay on their authored surfaces and clear initial spawn`,()=>{
    const spawn=level.safeSpawn??level.spawn;
    assert.ok(level.enemies.length>=3,'large maps contain multiple readable threats');
    for(const enemy of level.enemies) {
      assert.ok(enemy.minX<=enemy.x&&enemy.x<=enemy.maxX);
      assert.ok(enemy.minX>=16&&enemy.maxX<=level.width-16);
      assert.ok(enemy.speed>0&&enemy.speed<150,'patrol speed allows planning and evasion');
      if(enemy.type==='crawler')assert.ok(level.platforms.some(p=>enemy.minX-11>=p[0]&&enemy.maxX+11<=p[0]+p[2]&&p[1]===enemy.y),`crawler ${enemy.id} stays above a continuous platform`);
      else assert.ok(enemy.y-(enemy.amplitude??24)>40&&enemy.y+(enemy.amplitude??24)<level.height-40);
      assert.ok(Math.hypot(enemy.x-spawn.x,enemy.y-spawn.y)>180,'no enemy starts inside the safe spawn');
    }
  });
  test(`level ${level.id}: jumps clear traversable hazards; repair fields have a matching patch`,()=>{
    const maxRise=410*410/(2*GRAVITY);
    for(const hazard of level.hazards) {
      if(hazard.type==='laser'&&!hazard.period)assert.ok(level.terminals.some(t=>{const effect=solve(t.lessonId);return effect.type==='laser'&&effect.target===hazard.group;}),`field ${hazard.group} has an accessible repair control`);
      else assert.ok(hazard.h+20<maxRise,`${hazard.type} has a feasible jump budget`);
    }
  });
}

test('the first sector requires its jump repair for the 136-pixel upper rise',()=>{
  const level=levels[0],initial=reachable(level,{patches:new Set(['1-main']),speed:220,jump:410});
  assert.equal(initial.hasPoint(2144,512),false,'last upper terminal cannot be reached before jump repair');
  assert.ok(460*460/(2*GRAVITY)>136);
});

test('the construction sector requires its three-section bridge and four-step staircase',()=>{
  const level=levels[3];
  assert.equal(level.constructions.bridge.length,3);
  assert.equal(level.constructions.stairs.length,4);
  assert.equal(restoreLevel(level,{omitConstruction:'bridge'}).patches.has('4-step'),false,'second constructor is beyond the bridge gap');
  assert.equal(restoreLevel(level,{omitConstruction:'stairs'}).patches.has('4-power'),false,'power terminal requires the built staircase and cannot be reached behind its own gate');
});

test('reverse-gravity terminal is accessible under the ceiling before restoring gravity',()=>{
  const level=levels[1],main=level.terminals.find(t=>t.id===level.mainPuzzleId);
  const ceiling=level.platforms.find(p=>level.spawn.x>=p[0]&&level.spawn.x<=p[0]+p[2]&&p[1]<level.spawn.y);
  const feetUnderCeiling=ceiling[1]+ceiling[3]+BODY_HEIGHT;
  assert.ok(Math.hypot(level.spawn.x-main.x,feetUnderCeiling-main.y)<91);
  assert.ok(level.platforms.some(p=>supports(p,level.safeSpawn.x,level.safeSpawn.y)));
});
