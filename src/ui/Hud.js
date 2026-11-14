import { escapeHTML } from './Interface.js';
import { formatTime } from '../utils/score.js';
export class Hud {
  constructor(ui,scene,level) {
    this.ui=ui;this.scene=scene;
    const layer=document.createElement('div');layer.className='hud';layer.innerHTML=`<header class="hud-top"><div class="hud-level"><span class="hud-number">0${level.id}</span><div><small>МОДУЛЬ / ${escapeHTML(level.topic||'JAVASCRIPT')}</small><strong>${escapeHTML(level.name)}</strong></div></div><div class="hud-status"><span data-patch-status>● МОДУЛЬ ПОВРЕЖДЁН</span><div class="hud-counter task-counter"><small>ТЕРМИНАЛЫ</small><b data-tasks>0 / 3</b></div><div class="hud-counter death-counter"><small>ГИБЕЛЬ</small><b data-deaths>0</b></div><div class="hud-counter"><small>ВРЕМЯ</small><b data-timer>00:00</b></div><div class="hud-counter"><small>ОШИБКИ</small><b data-mistakes>0</b></div><button class="icon-button" data-pause aria-label="Пауза">Ⅱ</button></div></header><div class="objective"><span>◇</span><p data-objective>Найди терминал и восстанови модуль.</p><strong data-items></strong></div><div class="interact-prompt hidden"><kbd>E</kbd><span data-interaction>ВЗАИМОДЕЙСТВОВАТЬ</span></div><div class="hud-bottom"><span class="connection" data-status></span><div class="keyboard-help ${ui.settings.showControls?'':'hidden'}"><kbd>A</kbd><kbd>D</kbd> ДВИЖЕНИЕ <kbd>SPACE</kbd> ПРЫЖОК <kbd>E</kbd> ДЕЙСТВИЕ <kbd>ESC</kbd> ПАУЗА</div></div><div class="touch-controls"><div><button data-touch="left" aria-label="Влево">◀</button><button data-touch="right" aria-label="Вправо">▶</button></div><div><button data-touch="interact" aria-label="Взаимодействовать">E</button><button data-touch="jump" aria-label="Прыжок">↑</button></div></div><div class="rotate-hint">↻ Удобнее играть горизонтально</div>`;
    ui.root.append(layer);this.element=layer;ui.updateStatus();
    layer.querySelector('[data-pause]').onclick=()=>scene.pauseGame();
    layer.querySelectorAll('[data-touch]').forEach(button=>{const name=button.dataset.touch;button.onpointerdown=e=>{e.preventDefault();button.setPointerCapture(e.pointerId);scene.touch[name]=true;};for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>scene.touch[name]=false);});
  }
  update(data) {
    if(!this.element)return;
    const text=(q,v)=>{const el=this.element.querySelector(q);if(v!==undefined&&el.textContent!==String(v))el.textContent=v;};
    text('[data-timer]',formatTime(data.elapsedMs||0));text('[data-mistakes]',data.mistakes??0);text('[data-objective]',data.objective);
    text('[data-tasks]',`${data.tasksDone??0} / ${data.tasksTotal??3}`);text('[data-deaths]',data.deaths??0);
    text('[data-patch-status]',data.patched?'✓ СЕКТОР ВОССТАНОВЛЕН':'● ИЩИ НЕИСПРАВНОСТИ');
    this.element.querySelector('[data-patch-status]').classList.toggle('repaired',!!data.patched);
    if(data.items!==undefined)text('[data-items]',typeof data.items==='string'?data.items:'');
    const prompt=this.element.querySelector('.interact-prompt');prompt.classList.toggle('hidden',!data.interaction);text('[data-interaction]',typeof data.interaction==='string'?data.interaction.replace(/^E\s*·\s*/,''):data.interaction);
  }
  destroy(){for(const key of Object.keys(this.scene.touch||{}))this.scene.touch[key]=false;this.element?.remove();this.element=null;}
}
