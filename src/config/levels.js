/** Authored rooms, traversal surfaces and repair gates. All y coordinates are world pixels. */
const p=(x,y,w,h=24)=>[x,y,w,h];
const spikes=(x,y,w=64)=>({x,y:y-18,w,h:18,type:'spikes'});
const laser=(x,y,h,group,period=0,phase=0)=>({x,y,w:18,h,type:'laser',group,period,duty:.48,phase});
const terminal=(id,x,y,extra={})=>({id,lessonId:id,x,y,...extra});
const gate=(id,x,y,h,requires,extra={})=>({id,x,y,w:28,h,requires,...extra});
const crawler=(id,x,y,minX,maxX,speed=62)=>({id,type:'crawler',x,y,minX,maxX,speed});
const flyer=(id,x,y,minX,maxX,speed=74,amplitude=20)=>({id,type:'flyer',x,y,minX,maxX,speed,amplitude,period:2600});
const rooms=[{x:110,y:772,text:'ЗОНА ВХОДА'},{x:1010,y:500,text:'ВЕРХНИЙ КОНТУР'},{x:2040,y:332,text:'ТЕХНИЧЕСКИЙ ЯРУС'},{x:3300,y:768,text:'ВЫХОДНОЙ ШЛЮЗ'}];
export const levels=[
  {
    id:1,name:'SYSTEM BOOT',topic:'Переменные',subtitle:'Загрузочный сектор',accent:'#5BF1F6',background:'bg1',width:4096,height:1024,
    spawn:{x:104,y:894},gravity:700,speed:40,jump:410,
    platforms:[p(0,896,640,128),p(1088,896,704,128),p(1984,896,704,128),p(2880,896,1216,128),p(416,816,160),p(608,736,160),p(800,656,160),p(992,624,224),p(1328,488,192),p(1568,488,192),p(1792,560,192),p(2032,512,256),p(2368,592,160),p(2592,672,192),p(2816,752,192),p(3072,816,160),p(960,816,128),p(736,736,224)],
    terminals:[terminal('1-main',184,896),terminal('1-jump',1104,624),terminal('1-laser',2144,512)],mainPuzzleId:'1-main',
    gates:[gate('boot-lock',352,656,240,['1-main']),gate('jump-lock',1280,264,632,['1-jump'])],
    hazards:[spikes(1216,896),spikes(3040,896,80),spikes(3504,896,80),laser(2368,352,240,'boot'),laser(3376,832,64,'timed',2100,200)],
    checkpoints:[{x:1120,y:896},{x:2240,y:896},{x:2912,y:896}],items:[],
    enemies:[crawler('boot-c1',1504,896,1408,1696,58),flyer('boot-f1',1880,436,1760,1990,64,18),crawler('boot-c2',3264,896,3184,3328,66)],
    exit:{x:3904,y:896},rooms,
    objective:'Восстановите три терминала. Поднимитесь на верхние ярусы и избегайте заражённых ботов.',
    patchedObjective:'Все три патча установлены. Доберитесь до выходного портала.',
  },
  {
    id:2,name:'GRAVITY FAILURE',topic:'Числа и физика',subtitle:'Гравитационный модуль',accent:'#8B75FF',background:'bg2',width:4096,height:1024,
    spawn:{x:104,y:560},safeSpawn:{x:128,y:894},gravity:-450,speed:220,jump:410,
    platforms:[p(0,480,448,32),p(0,896,672,128),p(864,896,928,128),p(1984,896,704,128),p(2880,896,1216,128),p(416,816,160),p(608,736,160),p(800,704,224),p(1712,464,256),p(2048,544,192),p(2304,624,160),p(2528,704,160),p(2752,784,192),p(3136,800,160),p(736,816,128),p(544,736,160)],
    terminals:[terminal('2-main',192,560,{groundY:896}),terminal('2-lift',896,704),terminal('2-shield',1840,464)],mainPuzzleId:'2-main',
    constructions:{lift:[p(1120,624,128),p(1320,544,128),p(1520,464,144)]},
    gates:[gate('gravity-lock',352,656,240,['2-main'])],
    hazards:[spikes(1472,896,80),spikes(3072,896,64),spikes(3568,896,80),laser(2080,256,288,'unstable'),laser(3376,832,64,'timed',2300,900)],
    checkpoints:[{x:928,y:896},{x:2080,y:896},{x:2912,y:896}],items:[],crates:[{x:304,y:600},{x:384,y:650}],
    enemies:[crawler('gravity-c1',1408,896,1216,1664,72),flyer('gravity-f1',1600,358,1472,1728,78,28),crawler('gravity-c2',3264,896,3168,3328,70)],
    exit:{x:3904,y:896},rooms,
    objective:'Верните притяжение, соберите подъёмник и отключите нестабильное поле.',
    patchedObjective:'Все модули физики исправлены. Найдите выход через нижний шлюз.',
  },
  {
    id:3,name:'ACCESS DENIED',topic:'Условия и доступ',subtitle:'Сектор безопасности',accent:'#F76BD9',background:'bg3',width:4160,height:1024,
    spawn:{x:104,y:894},gravity:700,speed:220,jump:410,
    platforms:[p(0,896,640,128),p(832,896,960,128),p(1984,896,704,128),p(2880,896,1280,128),p(416,816,160),p(608,736,160),p(800,656,160),p(992,624,224),p(1328,560,192),p(1568,512,192),p(1792,480,256),p(2080,560,160),p(2304,624,128),p(2496,624,224),p(2304,800,128),p(2496,720,128),p(2624,624,160),p(2816,704,160),p(3072,816,160),p(736,816,128),p(544,736,160),p(1920,816,128),p(1728,704,160),p(1536,656,128)],
    terminals:[terminal('3-main',304,896),terminal('3-route',688,736),terminal('3-permission',1920,480)],mainPuzzleId:'3-main',
    gates:[gate('vault',768,400,496,['3-route']),gate('firewall',2256,272,624,['3-permission']),gate('security',3712,640,256,['3-main'],{items:2})],
    hazards:[spikes(1440,896,80),spikes(3104,896,64),spikes(3504,896,80),laser(3264,832,64,'timed',2200,0)],
    checkpoints:[{x:896,y:896},{x:2080,y:896},{x:2912,y:896}],
    items:[{x:1104,y:600,type:'key'},{x:2688,y:600,type:'key'}],
    enemies:[crawler('security-c1',1232,896,1088,1360,76),flyer('security-f1',1460,450,1328,1584,82,22),flyer('security-f2',2450,502,2368,2704,84,20),crawler('security-c2',3392,896,3328,3440,70)],
    exit:{x:3968,y:896},rooms,
    objective:'Найдите два ключа в верхних хранилищах и исправьте три проверки доступа.',
    patchedObjective:'Три проверки исправлены. С двумя ключами последний шлюз откроется.',
  },
  {
    id:4,name:'INFINITE LOOP',topic:'Циклы и построение',subtitle:'Модуль конструирования',accent:'#5BF1F6',background:'bg4',width:4160,height:1024,
    spawn:{x:104,y:894},gravity:700,speed:220,jump:410,
    platforms:[p(0,896,672,128),p(1376,896,736,128),p(2304,896,512,128),p(3008,896,1152,128),p(1440,816,160),p(1632,736,224),p(2624,416,192),p(2752,496,144),p(2944,576,144),p(3136,656,144),p(3328,736,144),p(3520,816,144),p(2176,816,128),p(1984,736,128)],
    terminals:[terminal('4-main',552,896),terminal('4-step',1760,736),terminal('4-power',2720,416)],mainPuzzleId:'4-main',
    bridge:[p(768,864,128),p(960,832,128),p(1152,864,128)],
    constructions:{bridge:[p(768,864,128),p(960,832,128),p(1152,864,128)],stairs:[p(1888,656,128),p(2080,576,128),p(2272,496,128),p(2464,416,128)]},
    gates:[gate('constructor',2816,240,656,['4-power'])],
    hazards:[spikes(304,896,64),spikes(1568,896,64),spikes(3616,896,80),laser(3376,816,80,'timed',2400,600)],
    checkpoints:[{x:592,y:896},{x:1408,y:896},{x:3040,y:896}],items:[],
    enemies:[crawler('constructor-c1',1856,896,1792,2032,74),flyer('constructor-f1',2192,458,2112,2392,86,22),crawler('constructor-c2',3296,896,3200,3344,80)],
    exit:{x:3968,y:896},rooms,
    objective:'Постройте мост, восстановите лестницу и запитайте конструктор.',
    patchedObjective:'Конструктор восстановлен. Пройдите последний участок паркура.',
  },
  {
    id:5,name:'FINAL PATCH',topic:'Логика и система',subtitle:'Центральное ядро',accent:'#F76BD9',background:'bg5',width:4160,height:1024,
    spawn:{x:104,y:894},gravity:700,speed:220,jump:410,
    platforms:[p(0,896,640,128),p(832,896,960,128),p(1984,896,704,128),p(2880,896,1280,128),p(416,816,160),p(608,736,160),p(800,656,160),p(992,624,192),p(1216,544,160),p(1408,488,192),p(1632,488,192),p(1856,416,160),p(2080,416,256),p(2400,512,160),p(2592,624,192),p(2816,704,160),p(3072,816,160),p(736,816,128),p(544,736,160),p(1920,816,128),p(1728,704,160),p(1536,656,128)],
    terminals:[terminal('5-reactor',1088,624),terminal('5-checksum',2208,416),terminal('5-main',3520,896)],mainPuzzleId:'5-main',
    gates:[gate('power',1280,224,672,['5-reactor'])],
    hazards:[spikes(1440,896,80),spikes(3264,896,80),spikes(3664,896,64),laser(2464,288,224,'core-heat'),laser(3360,832,64,'timed',2100,900)],
    checkpoints:[{x:896,y:896},{x:2080,y:896},{x:2912,y:896}],
    items:[{x:1488,y:464,type:'fuse'},{x:2688,y:600,type:'fuse'}],lever:{x:3040,y:896},
    enemies:[crawler('core-c1',1216,896,1088,1360,82),flyer('core-f1',1776,352,1664,1872,90,24),flyer('core-f2',2630,518,2544,2784,94,24),crawler('core-c2',3488,896,3424,3568,84)],
    exit:{x:3968,y:896},rooms,
    objective:'Верхние ярусы скрывают два предохранителя. Восстановите три системы и рубильник.',
    patchedObjective:'Ядро исправлено. Два предохранителя И питание стабилизируют портал.',
  },
];
for(const level of levels) {
  level.terminal=level.terminals[0]; // legacy diagnostic access; gameplay uses all terminals.
  level.puzzleId=level.mainPuzzleId;
  level.patchedObjective??='Все терминалы восстановлены. Доберитесь до портала.';
}
export const getLevel=id=>levels.find(level=>level.id===Number(id))??levels[0];
export default levels;
