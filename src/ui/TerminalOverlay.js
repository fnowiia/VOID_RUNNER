import { escapeHTML } from './Interface.js';
export class TerminalOverlay {
  constructor(ui,scene,lesson,callbacks,context={}) {
    const repaired=context.patched??scene.patched;
    const applied=context.appliedValues??scene.appliedValues;
    const usedHints=context.hintsUsed??scene.hintsUsed??0;
    const sector=lesson.levelId||Number(String(lesson.id).split('-')[0])||scene.levelId;
    const fileId=String(lesson.id).replace(/[^a-zA-Z0-9-]/g,'');
    this.ui=ui;this.callbacks=callbacks;this.values={...Object.fromEntries(lesson.fields.map(f=>[f.name,f.initial])),...(repaired?applied:{})};
    const layer=document.createElement('div');layer.className='terminal-layer';
    const code=lesson.codeTemplate.split(/(\{\{\w+\}\})/g).map(part=>{const field=lesson.fields.find(f=>part===`{{${f.name}}}`);return field?`<select name="${field.name}" aria-label="${escapeHTML(field.label)}">${field.options.map(v=>`<option value="${escapeHTML(v)}" ${v===this.values[field.name]?'selected':''}>${escapeHTML(v)}</option>`).join('')}</select>`:escapeHTML(part);}).join('');
    layer.innerHTML=`<section class="terminal-window" role="dialog" aria-modal="true" aria-label="Редактор исправлений"><header class="terminal-top"><div><i></i><i></i><i></i><span>PATCH TERMINAL <b>/</b> SECTOR_0${sector} / ${escapeHTML(fileId)}.js</span></div><button class="icon-button" data-close aria-label="Закрыть терминал">×</button></header><div class="terminal-body"><div class="eyebrow">СЕКТОР 0${sector} <span>/</span> ${escapeHTML(lesson.topic)}</div><h2>${escapeHTML(lesson.title)}</h2><p class="terminal-description">${escapeHTML(lesson.description)}</p><div class="code-editor"><div class="file-tab"><span>JS</span> ${escapeHTML(fileId)}.js <b>●</b></div><div class="code-lines"><span class="line-numbers">${Array.from({length:lesson.codeTemplate.split('\n').length+1},(_,i)=>String(i+1).padStart(2,'0')).join('<br>')}</span><pre><span class="code-comment">// Исправь выделенные значения</span>\n${code}</pre></div></div><div class="terminal-explanation"><span>◇</span><p>${escapeHTML(lesson.concept)}</p></div><div class="system-message" role="status">Внеси изменение и примени патч к системе.</div><div class="hint-output" aria-live="polite"></div><div class="terminal-actions"><button class="primary" data-apply>▶ ПРИМЕНИТЬ ИСПРАВЛЕНИЕ</button><button class="secondary" data-hint>◇ ПОДСКАЗКА <span>0 / 2</span></button><button class="primary hidden" data-return>ВЕРНУТЬСЯ В МИР →</button></div><p class="fine-print">Изменяются только разрешённые параметры. ESC — закрыть терминал.</p></div></section>`;
    ui.root.append(layer);this.element=layer;this.hintCount=usedHints;
    layer.querySelector('[data-hint] span').textContent=`${this.hintCount} / 2`;
    layer.querySelector('[data-hint]').disabled=this.hintCount>=2;
    if(repaired){layer.querySelector('.system-message').textContent=lesson.success;layer.querySelector('.system-message').classList.add('success');layer.querySelector('[data-apply]').classList.add('hidden');layer.querySelector('[data-hint]').classList.add('hidden');layer.querySelector('[data-return]').classList.remove('hidden');layer.querySelectorAll('select').forEach(s=>s.disabled=true);}
    layer.querySelectorAll('select').forEach(select=>select.onchange=()=>{const field=lesson.fields.find(f=>f.name===select.name);this.values[select.name]=typeof field.initial==='number'?Number(select.value):select.value;});
    layer.querySelector('[data-close]').onclick=()=>callbacks.onClose();
    layer.querySelector('[data-return]').onclick=()=>callbacks.onClose();
    layer.querySelector('[data-apply]').onclick=()=>{const result=callbacks.onApply({...this.values});const el=layer.querySelector('.system-message');el.textContent=result.message;el.className=`system-message ${result.correct?'success':'error'}`;if(result.correct){layer.querySelector('[data-apply]').classList.add('hidden');layer.querySelector('[data-hint]').classList.add('hidden');layer.querySelector('[data-return]').classList.remove('hidden');layer.querySelectorAll('select').forEach(s=>s.disabled=true);}};
    layer.querySelector('[data-hint]').onclick=()=>{const hint=callbacks.onHint();this.hintCount=Math.min(2,this.hintCount+1);layer.querySelector('.hint-output').textContent=`Подсказка ${this.hintCount}: ${hint}`;layer.querySelector('[data-hint] span').textContent=`${this.hintCount} / 2`;if(this.hintCount===2)layer.querySelector('[data-hint]').disabled=true;};
    // Do not let game keys steal focus from a native select or activate a second action.
    this.keyHandler=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();callbacks.onClose();}else if(e.target.matches('select'))e.stopPropagation();};
    layer.addEventListener('keydown',this.keyHandler);
    layer.querySelector('select')?.focus();
  }
  destroy(){this.element?.remove();this.element=null;}
}
