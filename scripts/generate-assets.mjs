import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Original, deterministic pixel artwork. Every stroke is aligned to the pixel grid.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/assets');
const P = { ink:'#080b18', shadow:'#10152b', dark:'#151b38', metal:'#263451', mid:'#3e5372', edge:'#6b86a4', cyan:'#5bf1f6', pale:'#c9ffff', pink:'#f76bd9', purple:'#8b75ff', white:'#f3f6ff', red:'#ff526a', gold:'#f7ce75' };
function color(c) { if(Array.isArray(c))return c;const n=parseInt(c.slice(1),16);return[n>>16&255,n>>8&255,n&255,255]; }
class Art {
  constructor(w,h){this.w=w;this.h=h;this.png=new PNG({width:w,height:h});this.png.data.fill(0);}
  px(x,y,c){x=Math.round(x);y=Math.round(y);if(x<0||y<0||x>=this.w||y>=this.h)return;const rgba=color(c),i=(y*this.w+x)*4,a=rgba[3]/255,old=this.png.data[i+3]/255,na=a+old*(1-a);if(!na)return;for(let k=0;k<3;k++)this.png.data[i+k]=Math.round((rgba[k]*a+this.png.data[i+k]*old*(1-a))/na);this.png.data[i+3]=Math.round(na*255);}
  rect(x,y,w,h,c){for(let j=Math.floor(y);j<y+h;j++)for(let i=Math.floor(x);i<x+w;i++)this.px(i,j,c);}
  line(x1,y1,x2,y2,c,width=1){const n=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));for(let t=0;t<=n;t++){const k=n?t/n:0;this.rect(Math.round(x1+(x2-x1)*k),Math.round(y1+(y2-y1)*k),width,width,c);}}
  box(x,y,w,h,fill,stroke=P.metal){this.rect(x,y,w,h,stroke);this.rect(x+1,y+1,w-2,h-2,fill);}
  ellipse(cx,cy,rx,ry,c,thickness=0){for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){const d=((x-cx)/rx)**2+((y-cy)/ry)**2;if(d<=1&&(!thickness||d>=Math.max(0,1-thickness/Math.min(rx,ry))))this.px(x,y,c);}}
  glow(cx,cy,r,c,strength=.12){const rgb=color(c);for(let y=Math.floor(cy-r);y<cy+r;y++)for(let x=Math.floor(cx-r);x<cx+r;x++){const d=Math.hypot(x-cx,y-cy)/r;if(d<1)this.px(x,y,[...rgb.slice(0,3),Math.round((1-d)**2*255*strength)]);}}
  save(name){const dest=path.join(root,name);mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,PNG.sync.write(this.png));}
}
let seed=404;
function rand(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;}
function bolt(a,x,y){a.rect(x,y,2,2,P.ink);a.px(x,y,P.edge);}
function panel(a,x,y,w,h,accent=P.cyan){a.box(x,y,w,h,P.shadow,P.metal);a.line(x+2,y+2,x+w-3,y+2,P.mid);bolt(a,x+3,y+4);bolt(a,x+w-5,y+4);bolt(a,x+3,y+h-5);bolt(a,x+w-5,y+h-5);a.rect(x+8,y+h-4,w-16,1,accent);}

// Explorer: layered hood, visor, backpack, boots and opposing limb cycles.
const player=new Art(32*20,48);
for(let f=0;f<20;f++){
  const x=f*32;const run=f>=4&&f<10;const phase=run?(f-4)/6*Math.PI*2:0;
  const air=f>=10&&f<14;const hurt=f>=14&&f<16;const repair=f>=16;
  const bob=run?Math.round(Math.abs(Math.sin(phase))*2):(f%4===1?1:0);
  const y=run?-bob:bob;const leg=run?Math.round(Math.sin(phase)*4):air?2:0;
  const accent=hurt?P.red:P.cyan;
  player.rect(x+8,y+18,17,19,P.ink);player.rect(x+23,y+20,4,13,P.metal);player.rect(x+24,y+22,2,4,P.purple);
  player.rect(x+10,y+33,6,11-leg,P.ink);player.rect(x+17,y+33,6,11+leg,P.ink);
  player.rect(x+11,y+34,4,7-leg,P.metal);player.rect(x+18,y+34,4,7+leg,P.shadow);
  player.rect(x+8,y+41-leg,8,4,P.ink);player.rect(x+17,y+41+leg,8,4,P.ink);
  player.rect(x+8,y+42-leg,6,1,P.mid);player.rect(x+17,y+42+leg,7,1,P.mid);
  player.rect(x+9,y+44-leg,6,1,accent);player.rect(x+18,y+44+leg,6,1,accent);
  player.rect(x+10,y+20,13,16,P.dark);player.rect(x+11,y+21,3,13,P.mid);player.rect(x+15,y+21,7,14,P.shadow);
  player.rect(x+14,y+25,7,2,accent);player.rect(x+16,y+24,2,5,accent);player.px(x+17,y+25,P.pale);
  player.rect(x+10,y+34,13,2,P.ink);player.rect(x+15,y+34,4,2,P.edge);
  if(repair){player.rect(x+22,y+23,6,4,P.ink);player.rect(x+26,y+19,4,7,P.metal);player.rect(x+27,y+17,3,4,accent);player.px(x+30,y+15-(f%2),P.white);}
  else{const arm=run?-Math.round(Math.sin(phase)*3):0;player.rect(x+6,y+21+arm,5,12,P.ink);player.rect(x+7,y+22+arm,3,8,P.metal);player.rect(x+7,y+30+arm,3,3,accent);player.rect(x+22,y+21-arm,4,11,P.ink);player.rect(x+23,y+23-arm,2,7,P.metal);player.rect(x+23,y+30-arm,2,3,accent);}
  player.rect(x+8,y+4,16,17,P.ink);player.rect(x+10,y+2,12,4,P.ink);player.rect(x+10,y+4,12,14,P.metal);player.rect(x+8,y+7,2,10,P.shadow);
  player.rect(x+11,y+5,10,2,P.mid);player.rect(x+9,y+9,14,8,P.ink);player.rect(x+11,y+10,12,5,accent);player.rect(x+12,y+10,8,1,P.pale);player.rect(x+12,y+11,2,3,P.white);player.rect(x+21,y+11,2,2,P.mid);
  player.rect(x+11,y+17,11,3,P.shadow);player.rect(x+15,y+18,4,2,P.purple);player.px(x+9,y+5,P.edge);
  if(hurt)for(let j=0;j<4;j++)player.rect(x+Math.floor(rand()*29),Math.floor(rand()*40),2,1,P.pink);
}
player.save('sprites/player.png');

// PATCH is a floating cursor-shaped robot with five distinct expressions.
const patch=new Art(24*20,24);
for(let f=0;f<20;f++){
 const x=f*24,b=f%4===1?1:0,state=Math.floor(f/4),c=state===4?P.red:state===3?P.pink:P.cyan;
 patch.glow(x+12,12,12,c,.2);patch.line(x+5,4+b,x+5,17+b,P.ink,2);patch.line(x+6,4+b,x+18,14+b,P.ink,2);patch.rect(x+7,7+b,7,10,P.shadow);patch.rect(x+6,5+b,3,12,P.metal);patch.line(x+8,6+b,x+17,14+b,c);patch.rect(x+7,9+b,9,7,c);patch.rect(x+8,10+b,7,5,P.ink);patch.rect(x+9,11+b,2,state===3?1:2,P.pale);patch.rect(x+13,11+b,1,state===4?3:2,P.pale);patch.rect(x+10,14+b,state===2?3:2,1,state===3?P.pink:c);patch.rect(x+7,17+b,3,2,P.purple);patch.rect(x+9,19+b,3,2,c);patch.rect(x+10,21+b,2,1,P.pale);
 if(f%4===0)patch.rect(x+18,8,3,1,P.purple);if(state===3)patch.px(x+20,3,c);if(state===4)patch.rect(x+19,4,2,5,P.red);
}
patch.save('sprites/patch.png');

const term=new Art(32*4,48);
for(let f=0;f<4;f++){const x=f*32,c=f===3?P.pink:P.cyan;term.glow(x+16,17,16,c,.3);term.box(x+7,35,18,10,P.dark,P.ink);term.rect(x+10,32,12,7,P.metal);term.box(x+4,5,24,27,P.dark,P.ink);term.line(x+6,7,x+25,7,P.edge);term.box(x+7,9,18,17,P.ink,P.metal);term.rect(x+9,11,14,11,'#102b3b');for(let j=0;j<3;j++){term.rect(x+10,12+j*3,4+(j+f)%3*3,1,c);term.px(x+21,12+j*3,P.purple);}term.rect(x+8,28,15,1,P.mid);term.rect(x+10,36,12,2,P.cyan);term.rect(x+8,42,16,2,P.mid);term.px(x+25,29,f%2?c:P.metal);term.rect(x+2,16,2,10,P.purple);}
term.save('sprites/terminal.png');

const portal=new Art(96*8,128);
for(let f=0;f<8;f++){const x=f*96;portal.glow(x+48,61,48,P.purple,.25);portal.ellipse(x+48,61,33,52,P.ink,7);portal.ellipse(x+48,61,30,49,P.mid,5);portal.ellipse(x+48,61,27,46,P.dark,5);portal.ellipse(x+48,61,24,43,P.purple,3);portal.ellipse(x+48,61,21,40,'#10203a');for(let j=0;j<5;j++){portal.ellipse(x+48,61,19-j*3,37-j*6,[91,241,246,55+j*15],1);}for(let j=0;j<12;j++){const t=j/12*Math.PI*2+f*.14;portal.rect(x+48+Math.cos(t)*28-2,61+Math.sin(t)*47-2,4,4,j%3?P.cyan:P.pink);}for(let j=0;j<10;j++){const yy=25+j*8,xx=Math.sin(j*1.7+f*.7)*12;portal.rect(x+44+xx,yy,6,1,P.cyan);}portal.box(x+13,112,70,12,P.metal,P.ink);portal.rect(x+20,114,56,2,P.cyan);portal.rect(x+26,120,44,2,P.mid);portal.rect(x+5,51,8,24,P.metal);portal.rect(x+83,51,8,24,P.metal);portal.rect(x+7,55,3,16,P.pink);portal.rect(x+86,55,3,16,P.pink);}
portal.save('sprites/portal.png');

// Corrupted maintenance machines: articulated crawler, winged watcher and rupture.
// A shared 32×32 frame keeps the collision silhouette legible at small scales.
const enemy = new Art(32 * 12, 32);
for (let f = 0; f < 12; f++) {
  const x = f * 32;
  const step = f % 4;
  if (f < 4) {
    const bob = step % 2;
    enemy.glow(x + 17, 17, 13, P.red, .14);
    // Three opposing leg pairs are individually jointed and change their stride.
    for (let pair = 0; pair < 3; pair++) {
      const hip = x + 9 + pair * 6;
      const stride = (step + pair) % 2 ? 2 : -2;
      enemy.line(hip, 19 + bob, hip - 5 - stride, 23, P.ink, 3);
      enemy.line(hip - 5 - stride, 23, hip - 3 - stride, 28, P.ink, 3);
      enemy.line(hip, 19 + bob, hip - 4 - stride, 23, '#894166');
      enemy.line(hip - 4 - stride, 23, hip - 2 - stride, 27, '#c05279');
      enemy.line(hip, 20 + bob, hip + 3 + stride, 24, P.ink, 3);
      enemy.line(hip + 3 + stride, 24, hip + 2 + stride, 29, P.ink, 2);
      enemy.line(hip, 20 + bob, hip + 4 + stride, 24, P.pink);
      enemy.px(hip + 3 + stride, 28, P.red);
    }
    enemy.ellipse(x + 15, 16 + bob, 11, 8, P.ink);
    enemy.ellipse(x + 15, 15 + bob, 9, 6, '#39253f');
    enemy.ellipse(x + 14, 13 + bob, 7, 4, '#643354');
    enemy.line(x + 9, 11 + bob, x + 17, 10 + bob, '#ba5b87');
    enemy.line(x + 12, 10 + bob, x + 14, 20 + bob, P.ink, 2);
    enemy.rect(x + 15, 14 + bob, 7, 2, '#a74665');
    enemy.rect(x + 19, 12 + bob, 9, 9, P.ink);
    enemy.rect(x + 21, 13 + bob, 6, 7, '#542941');
    enemy.rect(x + 23, 14 + bob, 5, 3, P.red);
    enemy.rect(x + 25, 14 + bob, 2, 1, P.white);
    enemy.rect(x + 22, 19 + bob, 6, 2, '#b55177');
    enemy.line(x + 24, 11 + bob, x + 27, 7 + bob, P.ink, 2);
    enemy.line(x + 24, 11 + bob, x + 27, 7 + bob, P.red);
    enemy.rect(x + 26, 6 + bob, 3, 2, P.pink);
    enemy.rect(x + 6, 15 + bob, 3, 3, P.purple);
    enemy.px(x + 7, 15 + bob, P.white);
    enemy.rect(x + 26, 21 + bob, 3, 3, P.ink);
    enemy.rect(x + 28, 20 + bob, 2, 3, P.red);
  } else if (f < 8) {
    const bob = step % 2;
    const wingY = [7, 11, 18, 11][step];
    enemy.glow(x + 16, 15 + bob, 13, P.pink, .18);
    // Hinged wings visibly flap above and below the central lens.
    for (const side of [-1, 1]) {
      enemy.line(x + 16 + side * 6, 15 + bob, x + 16 + side * 13, wingY, P.ink, 3);
      enemy.line(x + 16 + side * 6, 15 + bob, x + 16 + side * 13, wingY, '#a14d7a');
      enemy.line(x + 16 + side * 12, wingY + 1, x + 16 + side * 12, wingY + 6, P.ink, 3);
      enemy.rect(x + 15 + side * 12, wingY + 2, 3, 4, '#633652');
      enemy.px(x + 16 + side * 12, wingY + 2, P.pink);
    }
    enemy.ellipse(x + 16, 14 + bob, 9, 8, P.ink);
    enemy.ellipse(x + 16, 13 + bob, 7, 6, '#572b49');
    enemy.line(x + 12, 8 + bob, x + 19, 8 + bob, '#c15c8d');
    enemy.ellipse(x + 17, 14 + bob, 5, 5, '#a83960');
    enemy.ellipse(x + 17, 14 + bob, 4, 4, P.red);
    enemy.ellipse(x + 18, 14 + bob, 2, 3, '#37132d');
    enemy.rect(x + 17, 11 + bob, 2, 2, P.white);
    enemy.line(x + 12, 8 + bob, x + 10, 4 + bob, P.ink, 2);
    enemy.line(x + 20, 8 + bob, x + 23, 4 + bob, P.ink, 2);
    enemy.px(x + 10, 4 + bob, P.pink);
    enemy.px(x + 24, 4 + bob, P.pink);
    enemy.rect(x + 13, 21 + bob, 6, 3, P.ink);
    enemy.rect(x + 14, 22 + bob, 4, 2, P.purple);
    enemy.rect(x + 15, 25 + bob, 2, 3 - bob, step % 2 ? P.red : P.pink);
    enemy.rect(x + 12, 28, 2, 1, [247, 107, 217, 90]);
    enemy.rect(x + 21, 27, 2, 1, [247, 107, 217, 90]);
  } else {
    const k = f - 8;
    const radius = 5 + k * 3;
    enemy.glow(x + 16, 16, 15, k < 2 ? P.red : P.purple, .32 - k * .07);
    enemy.ellipse(x + 16, 16, radius, radius, [255, 82, 106, 230 - k * 46], 2);
    if (k < 3) {
      enemy.ellipse(x + 16, 16, 5 - k, 5 - k, k === 0 ? P.white : P.pink);
      enemy.rect(x + 12 + k, 15, 8 - k * 2, 2, P.pale);
    }
    for (let shard = 0; shard < 8; shard++) {
      const angle = shard / 8 * Math.PI * 2 + .18;
      const sx = x + 15 + Math.round(Math.cos(angle) * (7 + k * 2));
      const sy = 15 + Math.round(Math.sin(angle) * (7 + k * 2));
      enemy.rect(sx, sy, k === 3 ? 1 : 3, k === 3 ? 1 : 2,
        [...color(shard % 2 ? P.purple : P.pink).slice(0, 3), 245 - k * 45]);
    }
    enemy.rect(x + 6 - k, 8 + k * 5, 5, 1, [255, 82, 106, 195 - k * 35]);
    enemy.rect(x + 21, 23 - k * 4, 6, 1, [247, 107, 217, 195 - k * 35]);
  }
}
enemy.save('sprites/enemy.png');

const o=new Art(32*11,32);
// energy key
o.glow(16,16,15,P.gold,.28);o.ellipse(13,11,7,7,P.ink);o.ellipse(13,11,5,5,P.gold);o.ellipse(13,11,2,2,P.ink);o.line(17,15,25,23,P.ink,4);o.line(17,15,24,22,P.gold,2);o.rect(21,21,3,5,P.gold);o.rect(24,20,3,3,P.gold);o.px(10,7,P.white);
// fuse
{const x=32;o.glow(x+16,16,15,P.cyan,.25);o.box(x+10,5,12,22,P.metal,P.ink);o.rect(x+11,5,10,4,P.edge);o.rect(x+11,23,10,4,P.edge);o.box(x+12,10,8,12,'#164153',P.cyan);o.rect(x+15,10,2,12,P.pale);o.rect(x+13,4,6,2,P.white);}
// levers
for(let f=2;f<4;f++){const x=f*32;o.box(x+7,13,19,16,P.metal,P.ink);o.rect(x+9,15,15,2,P.edge);o.ellipse(x+16,22,5,5,P.ink);o.ellipse(x+16,22,3,3,P.mid);o.line(x+15,21,x+(f===2?10:22),8,P.ink,3);o.line(x+16,21,x+(f===2?11:23),8,P.edge,1);o.box(x+(f===2?5:19),4,8,6,f===2?P.red:P.cyan,P.ink);o.rect(x+23,24,2,2,f===2?P.red:P.cyan);}
// checkpoint
{const x=4*32;o.rect(x+7,26,20,4,P.ink);o.rect(x+9,24,16,3,P.mid);o.rect(x+12,5,3,20,P.metal);o.rect(x+13,5,1,18,P.edge);o.rect(x+15,5,12,10,P.ink);o.rect(x+16,6,9,7,P.cyan);o.rect(x+17,8,5,1,P.pale);o.rect(x+17,10,3,1,P.pale);}
// spikes
{const x=5*32;for(let j=0;j<4;j++){const xx=x+j*8;for(let yy=0;yy<13;yy++)o.rect(xx+4-Math.floor(yy/3),17+yy,Math.max(1,Math.floor(yy/3)*2),1,yy<3?P.red:P.metal);o.line(xx+4,18,xx+1,29,P.edge);}o.rect(x,29,32,3,P.ink);o.rect(x,30,32,1,P.red);}
// laser unit
{const x=6*32;o.box(x+8,1,16,8,P.metal,P.ink);o.box(x+8,23,16,8,P.metal,P.ink);o.rect(x+13,8,6,16,[255,82,106,70]);o.rect(x+15,8,2,16,P.red);o.rect(x+15,9,1,14,P.white);o.rect(x+11,4,10,2,P.red);o.rect(x+11,26,10,2,P.red);}
// crate
{const x=7*32;panel(o,x+2,3,28,27,P.purple);o.box(x+6,7,20,18,P.dark,P.ink);o.line(x+7,8,x+24,23,P.mid,2);o.line(x+24,8,x+7,23,P.mid,2);o.rect(x+11,14,10,4,P.metal);o.rect(x+14,15,4,2,P.purple);}
// display
{const x=8*32;panel(o,x+1,3,30,24,P.cyan);o.box(x+5,7,22,15,P.ink,P.mid);for(let j=0;j<4;j++){o.rect(x+7,9+j*3,5+(j*7)%14,1,j%2?P.purple:P.cyan);}o.rect(x+13,27,6,3,P.metal);}
// cable
{const x=9*32;o.line(x+3,0,x+3,12,P.ink,4);o.line(x+4,1,x+4,12,P.mid,2);o.line(x+3,12,x+22,12,P.ink,4);o.line(x+4,13,x+22,13,P.purple,2);o.line(x+22,12,x+22,32,P.ink,4);o.line(x+23,14,x+23,32,P.mid,2);o.rect(x+1,5,7,3,P.metal);o.rect(x+20,24,7,3,P.metal);}
// hologram glitch
{const x=10*32;o.glow(x+16,16,16,P.purple,.2);for(let j=0;j<9;j++){o.rect(x+4+(j*7)%11,3+j*3,7+(j*3)%13,1,j%3===0?P.pink:P.purple);}o.rect(x+5,27,22,3,P.metal);o.rect(x+8,27,16,1,P.cyan);}
o.save('sprites/objects.png');

const tiles=new Art(32*6,32);
for(let f=0;f<6;f++){
const x=f*32;tiles.rect(x,0,32,32,P.ink);tiles.rect(x+1,1,30,30,P.dark);tiles.line(x+1,1,x+30,1,P.mid);tiles.line(x+1,2,x+30,2,P.metal);tiles.line(x+1,30,x+30,30,'#0e1329');
if(f===0||f===1||f===3){tiles.rect(x,0,32,4,P.metal);tiles.rect(x,0,32,1,f===3?P.purple:P.cyan);tiles.rect(x+2,5,28,1,P.ink);tiles.rect(x+2,7,28,1,P.mid);tiles.box(x+3,10,26,16,P.shadow,P.metal);for(let j=0;j<6;j++)tiles.line(x+5+j*4,13,x+5+j*4,22,P.metal);bolt(tiles,x+2,3);bolt(tiles,x+27,3);if(f===1){tiles.rect(x,4,3,28,P.mid);tiles.rect(x,4,1,28,P.cyan);}if(f===3){tiles.rect(x+4,28,24,2,P.purple);}}
if(f===2){tiles.box(x+3,4,26,24,P.shadow,P.metal);tiles.line(x+5,6,x+26,6,P.mid);tiles.rect(x+7,10,4,13,P.metal);tiles.rect(x+14,10,4,13,P.metal);tiles.rect(x+21,10,3,13,P.metal);bolt(tiles,x+4,25);bolt(tiles,x+26,25);}
if(f===4){for(let j=0;j<4;j++){tiles.line(x+j*8,2,x+j*8+8,10,P.gold,3);}tiles.rect(x,12,32,2,P.mid);tiles.rect(x+4,19,24,5,P.ink);tiles.rect(x+7,21,18,1,P.purple);}
if(f===5){tiles.rect(x,27,32,5,P.metal);tiles.rect(x,31,32,1,P.cyan);for(let j=0;j<5;j++)tiles.rect(x+3+j*6,7,2,14,P.mid);}
}
tiles.save('tiles/tileset.png');

// Five original, multi-depth rooms. Empty foreground is reserved for gameplay.
function room(level){const a=new Art(960,540),accent=[P.cyan,P.purple,P.gold,P.pink,P.cyan][level-1];seed=404+level*733;
 for(let y=0;y<540;y++){const t=y/540;a.rect(0,y,960,1,[Math.round(7+t*3),Math.round(10+t*4),Math.round(23+t*10),255]);}
 // distant architectural grid, niches and floor perspective
 for(let x=-40;x<1000;x+=160){a.box(x,56,145,369,'#0c1225','#18223b');a.rect(x+4,60,137,2,'#1b2943');a.rect(x+15,80,115,290,'#0b1021');for(let y=90;y<380;y+=27){a.line(x+15,y,x+129,y,'#111a30');}a.rect(x+2,59,3,365,'#202c46');}
 a.rect(0,415,960,125,'#0b1021');a.line(0,417,960,417,'#26314a');for(let y=430;y<540;y+=22)a.line(0,y,960,y,'#15223a');for(let x=-960;x<1900;x+=100)a.line(480,415,x,540,'#18253d');
 // cable conduits and suspended beams
 a.rect(0,35,960,16,'#111a2e');a.rect(0,35,960,2,'#30425f');a.rect(0,48,960,3,'#070c18');for(let x=0;x<960;x+=48){a.rect(x,38,2,8,'#3c4961');a.rect(x+20,38,7,1,accent);}
 for(let x=34;x<960;x+=241){a.rect(x,51,8,358,'#080c19');a.rect(x+1,51,2,358,'#2d3654');a.rect(x+4,51,1,358,'#645293');a.rect(x-3,113,14,5,'#25304b');a.rect(x-3,305,14,5,'#25304b');}
 // deep servers / display racks
 for(let i=0;i<7;i++){const x=34+i*143,y=134+(i%3)*19;panel(a,x,y,95,216,accent);a.rect(x+5,y+8,85,198,'#0c1224');for(let j=0;j<5;j++){const yy=y+12+j*37;a.box(x+9,yy,77,30,'#18223a','#26334f');a.line(x+12,yy+3,x+82,yy+3,'#3a4b68');a.rect(x+13,yy+8,49,13,'#0a1223');for(let k=0;k<9;k++){a.rect(x+15+k*5,yy+10,2,8,'#273b58');}a.rect(x+68,yy+8,5,2,j%2?accent:'#426277');a.rect(x+77,yy+8,3,2,P.pink);a.rect(x+68,yy+14,11,1,'#445978');a.rect(x+13,yy+24,64,1,'#30435b');}a.rect(x+11,y+206,72,1,accent);}
 // room-specific machine silhouettes / light wells
 if(level===1){for(let x=0;x<960;x+=320){a.glow(x+170,235,130,P.cyan,.1);a.box(x+135,155,94,72,'#101e33','#3e5470');a.box(x+141,161,82,56,'#071420','#273e55');for(let j=0;j<9;j++){a.rect(x+147,167+j*5,18+(j*19)%54,2,j%3?P.cyan:P.purple);}a.rect(x+144,221,75,2,'#345a72');}a.rect(45,84,83,3,P.red);a.rect(51,91,54,1,'#853b62');}
 if(level===2){for(let i=0;i<3;i++){let x=150+i*320;a.glow(x,240,150,P.purple,.17);a.ellipse(x,240,59,120,'#0c1023');a.ellipse(x,240,57,118,'#293859',5);a.ellipse(x,240,46,100,'#705cba',2);for(let j=0;j<7;j++){a.ellipse(x,160+j*27,37,8,'#3d3b6b',2);a.rect(x-3,151+j*27,6,18,j%2?P.purple:P.cyan);}a.rect(x-67,114,134,14,'#25334f');a.rect(x-67,351,134,14,'#25334f');a.rect(x-48,118,96,2,P.purple);}}
 if(level===3){for(let i=0;i<3;i++){const x=123+i*320;a.glow(x+20,240,115,P.gold,.08);panel(a,x-37,109,116,273,P.gold);a.box(x-25,122,92,242,'#0a1325','#3d4350');for(let y=133;y<351;y+=17){a.rect(x-21,y,84,2,'#2c3750');a.rect(x-17,y+4,30,1,'#253750');a.rect(x+46,y+4,8,2,P.gold);}a.rect(x+13,210,16,37,'#374563');a.rect(x+18,216,6,22,P.gold);}}
 if(level===4){for(let i=0;i<8;i++){const x=65+i*128,y=175+(i%3)*52;a.glow(x,y,60,P.pink,.08);for(let k=0;k<5;k++){a.line(x-33,y+k*15,x+33,y+k*15,'#3b2e63');}a.line(x-33,y,x-33,y+60,'#5b426d');a.line(x+33,y,x+33,y+60,'#5b426d');a.line(x-33,y,x,y-18,'#5b426d');a.line(x+33,y,x,y-18,'#5b426d');a.rect(x-15,y+23,30,3,P.purple);}a.rect(0,387,960,3,'#683b78');}
 if(level===5){a.glow(480,230,255,P.purple,.14);a.ellipse(480,247,147,176,'#11152d');a.ellipse(480,247,143,172,'#293354',10);a.ellipse(480,247,126,153,'#4e4687',4);a.ellipse(480,247,115,141,'#1c2647',3);for(let i=0;i<24;i++){const t=i/24*Math.PI*2;const x=480+Math.cos(t)*135,y=247+Math.sin(t)*162;a.rect(x-3,y-4,6,8,i%3?P.purple:P.cyan);}for(let i=0;i<4;i++){const x=246+i*156;a.rect(x,87,8,321,'#121d35');a.rect(x+2,87,2,321,'#3b4966');a.rect(x+3,130,1,190,P.cyan);}a.rect(293,414,374,10,'#2b3158');a.rect(320,415,320,2,P.purple);}
 // foreground structural ribs, scattered warning marks and material texture
 for(let x=0;x<=960;x+=320){a.rect(x-10,0,25,418,'#0a0f20');a.rect(x-8,0,4,418,'#24324a');a.rect(x+7,0,6,418,'#12192f');for(let y=75;y<410;y+=83){a.rect(x-10,y,25,13,'#1b2940');a.rect(x-7,y+2,18,2,'#33415a');bolt(a,x-7,y+7);}a.rect(x-4,95,3,39,accent);}
 for(let i=0;i<240;i++){const x=Math.floor(rand()*960),y=Math.floor(rand()*417);a.px(x,y,[70,94,127,Math.floor(rand()*65)+15]);}
 for(let i=0;i<18;i++){const x=Math.floor(rand()*960),y=60+Math.floor(rand()*320);a.rect(x,y,2+Math.floor(rand()*8),1,i%3?accent:P.pink);}
 a.save(`backgrounds/level${level}.png`);
}
for(let i=1;i<=5;i++)room(i);

const ui=new Art(16*16,16);
for(let f=0;f<16;f++){
const x=f*16,c=f===0?P.red:f===1?P.cyan:P.purple;ui.box(x+1,1,14,14,P.shadow,P.metal);
if(f===0){ui.line(x+5,5,x+10,10,c,2);ui.line(x+10,5,x+5,10,c,2);}
if(f===1){ui.line(x+4,8,x+7,11,c,2);ui.line(x+7,11,x+12,5,c,2);}
if(f===2){ui.rect(x+7,6,2,6,P.cyan);ui.rect(x+7,3,2,2,P.cyan);}
if(f===3){ui.ellipse(x+8,8,5,5,P.purple);ui.ellipse(x+8,8,2,2,P.ink);for(let j=0;j<4;j++){const t=j/4*Math.PI*2;ui.rect(x+7+Math.cos(t)*5,7+Math.sin(t)*5,2,2,P.purple);}}
if(f===4||f===5){ui.rect(x+4,6,3,5,P.cyan);ui.line(x+7,6,x+10,3,P.cyan);ui.line(x+10,3,x+10,12,P.cyan);ui.line(x+7,10,x+10,12,P.cyan);if(f===5)ui.line(x+3,12,x+13,3,P.red);}
if(f>=6&&f<=8){const cc=f===6?P.metal:f===7?P.purple:P.gold;const pts=[[8,2],[10,6],[14,7],[11,10],[12,14],[8,12],[4,14],[5,10],[2,7],[6,6],[8,2]];for(let j=0;j<pts.length-1;j++)ui.line(x+pts[j][0],pts[j][1],x+pts[j+1][0],pts[j+1][1],cc);for(let y=6;y<12;y++)ui.rect(x+6,y,5,1,cc);}
if(f===9){ui.ellipse(x+8,8,5,5,P.metal,2);ui.rect(x+7,2,3,3,P.cyan);}
if(f===10){ui.ellipse(x+8,5,5,3,P.cyan);ui.rect(x+3,5,10,6,P.cyan);ui.ellipse(x+8,11,5,3,P.cyan);ui.ellipse(x+8,5,3,1,P.ink);ui.rect(x+4,9,8,1,P.ink);}
if(f===11){ui.rect(x+4,4,3,8,P.cyan);ui.rect(x+9,4,3,8,P.cyan);}
if(f===12){ui.line(x+4,5,x+11,5,P.cyan);ui.line(x+4,5,x+4,11,P.cyan);ui.line(x+11,11,x+5,11,P.cyan);ui.rect(x+10,4,3,3,P.cyan);}
if(f===13){ui.rect(x+4,4,8,8,P.cyan);ui.rect(x+6,7,4,5,P.ink);ui.rect(x+7,2,2,4,P.cyan);}
if(f===14){ui.ellipse(x+8,7,3,3,P.cyan);ui.rect(x+4,11,8,3,P.cyan);}
if(f===15){ui.line(x+3,8,x+12,8,P.pink,2);ui.line(x+8,3,x+12,8,P.pink,2);ui.line(x+12,8,x+8,13,P.pink,2);}
}
ui.save('ui/icons.png');

const button=new Art(192,48);panel(button,0,0,192,48);button.rect(3,3,3,42,P.cyan);button.rect(186,3,3,42,P.purple);button.save('ui/button.png');
const frame=new Art(64,64);frame.box(0,0,64,64,[9,11,25,230],P.mid);frame.line(0,0,25,0,P.cyan,2);frame.line(0,0,0,25,P.cyan,2);frame.line(38,62,62,62,P.purple,2);frame.line(62,38,62,62,P.purple,2);frame.save('ui/terminal-frame.png');
const particle=new Art(8,8);particle.rect(2,2,4,4,P.white);particle.rect(0,3,8,2,[91,241,246,90]);particle.rect(3,0,2,8,[91,241,246,90]);particle.save('sprites/particle.png');

writeFileSync(path.join(root,'manifest.json'),JSON.stringify({license:'Original procedural artwork, included under the project MIT license.',player:{frameWidth:32,frameHeight:48,frames:20,animations:{idle:[0,3],run:[4,9],jump:[10,11],fall:[12,13],hurt:[14,15],repair:[16,19]}},patch:{frameWidth:24,frameHeight:24,frames:20,animations:{idle:[0,3],float:[4,7],talk:[8,11],joy:[12,15],warning:[16,19]}},terminal:{frameWidth:32,frameHeight:48,frames:4},portal:{frameWidth:96,frameHeight:128,frames:8},enemy:{frameWidth:32,frameHeight:32,frames:12,animations:{crawl:[0,3],fly:[4,7],rupture:[8,11]}},objects:{frameWidth:32,frameHeight:32,frames:['key','fuse','leverOff','leverOn','checkpoint','spikes','laser','crate','screen','cable','glitch']},tileset:{frameWidth:32,frameHeight:32,frames:['floor','edge','wall','bridge','trim','ceiling']},backgrounds:{width:960,height:540,count:5},icons:{frameWidth:16,frameHeight:16,frames:['error','success','info','settings','sound','muted','starEmpty','starHalf','starFull','loading','database','pause','retry','fullscreen','profile','arrow']}},null,2));
console.log('Generated 16 original PNG assets, including five room backgrounds and sprite metadata.');
