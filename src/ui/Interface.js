import { levels } from '../config/levels.js';
import { lessons } from '../data/lessons.js';
import { formatTime, calculateStars } from '../utils/score.js';
import { validateNickname } from '../utils/validators.js';
import { TerminalOverlay } from './TerminalOverlay.js';
import { Hud } from './Hud.js';
import { SettingsModal } from './SettingsModal.js';
import { StatsPanel } from './StatsPanel.js';
import { sitePath } from '../utils/assetPaths.js';

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const allLevels = () => Array.isArray(levels) ? levels : Object.values(levels);
export const getLevel = id => allLevels().find(l => l.id === Number(id));
const stars = n => `<span class="stars" aria-label="${n} из 3 звёзд">${[1,2,3].map(i=>`<span class="${i<=n?'earned':''}">★</span>`).join('')}</span>`;
export class Interface {
  constructor(root, progress, audio) {
    this.root=root; this.progress=progress; this.audio=audio;
    try { this.settings={volume:0.4,muted:false,reducedEffects:false,showControls:true,...JSON.parse(localStorage.getItem('error404-settings')||'{}')}; } catch { this.settings={volume:0.4,muted:false,reducedEffects:false,showControls:true}; }
    this.applySettings();
    this.progress.subscribe(()=>this.updateStatus());
    this.root.addEventListener('click', e=>{ if(e.target.closest('button')) { this.audio.unlock?.(); this.audio.play?.('click'); } });
  }
  applySettings() {
    document.documentElement.classList.toggle('reduced-effects',!!this.settings.reducedEffects);
    this.audio.setVolume?.(this.settings.volume); this.audio.setMuted?.(this.settings.muted);
    this.audio.configure?.(this.settings);
    this.audio.setSettings?.(this.settings);
    try { localStorage.setItem('error404-settings',JSON.stringify(this.settings)); } catch {}
  }
  loading(value) { this.root.innerHTML=`<div class="boot"><span class="tiny-tag">E S C A P E &nbsp; T H E &nbsp; S Y S T E M</span><strong>ERROR<span>404</span></strong><div class="load-track"><i style="width:${value*100}%"></i></div><p>ЗАГРУЗКА МОДУЛЕЙ <b>${Math.round(value*100)}%</b></p></div>`; }
  loadingError(message) { this.root.innerHTML=`<div class="boot"><h1>Ошибка загрузки</h1><p>${escapeHTML(message)}</p><button onclick="location.reload()">Повторить</button></div>`; }
  hideAll() { this.closeModal(); this.closeTerminal(); this.hud?.destroy(); this.hud=null; this.root.replaceChildren(); clearTimeout(this.toastTimer); clearTimeout(this.dialogueTimer); }
  chrome(scene, active='') {
    const state=this.progress.getState();
    this.root.innerHTML=`<div class="screen ${active==='menu'?'menu-screen':''}"><header class="topbar"><button class="brand" data-home><span class="brand-symbol">[ / ]</span> ERROR<span>404</span><small>ESCAPE THE SYSTEM</small></button><div class="top-right"><span class="connection" data-status></span><button class="profile-link" data-profile><span class="avatar">▣</span><span data-nickname>${escapeHTML(state.nickname||'НОВЫЙ ИГРОК')}</span><span class="chevron">⌄</span></button><button class="icon-button" data-settings aria-label="Настройки">⚙</button></div></header><main class="screen-main"></main><footer class="site-footer"><span><i class="online-dot"></i> EDUCATIONAL PLATFORMER <b> / </b> JAVASCRIPT</span><span><a href="${sitePath('downloads/ERROR404.zip')}" download="ERROR404.zip" style="color:#5bf1f6;text-decoration:none">↓ СКАЧАТЬ ПРОЕКТ</a> <b> / </b> <a href="${sitePath('help.html')}" style="color:#a7b9d8;text-decoration:none">КАК ЗАПУСТИТЬ И ПОДКЛЮЧИТЬ БД</a></span></footer></div>`;
    this.root.querySelector('[data-home]').onclick=()=>scene.scene.start('Menu');
    this.root.querySelector('[data-profile]').onclick=()=>this.nickname(()=>this.chromeRefresh?.(),true);
    this.root.querySelector('[data-settings]').onclick=()=>this.showSettings();
    this.updateStatus();
    return this.root.querySelector('.screen-main');
  }
  updateStatus() {
    const s=this.progress.getState();
    this.root.querySelectorAll('[data-status]').forEach(el=>{el.textContent=s.status==='cloud'?'● ОБЛАКО':s.status==='syncing'?'◌ СИНХРОНИЗАЦИЯ':'● ЛОКАЛЬНЫЙ РЕЖИМ';el.title=s.message;el.dataset.mode=s.status;});
    this.root.querySelectorAll('[data-nickname]').forEach(el=>el.textContent=s.nickname||'НОВЫЙ ИГРОК');
    const save=this.root.querySelector('[data-save-message]'); if(save)save.textContent=s.message;
  }
  menu(scene) {
    const main=this.chrome(scene,'menu');
    this.chromeRefresh=()=>this.menu(scene);
    const state=this.progress.getState(); const count=Object.keys(state.progress).length;
    main.innerHTML=`<div class="hero-art" role="img" aria-label="Пиксельный исследователь у портала в повреждённой системе"></div><div class="hero-vignette"></div><section class="hero"><div class="eyebrow"><span class="live-square"></span> СОЕДИНЕНИЕ ПРЕРВАНО <span class="tag-outline">JS</span></div><h1><span class="error-title">ERROR</span><span class="number-title" data-text="404">404<span class="title-cursor">_</span></span></h1><p class="hero-subtitle">ESCAPE THE SYSTEM</p><p class="hero-copy">Система сломана. Выхода нет.<br>Но у тебя есть код.</p><div class="hero-actions"><button class="primary play" data-play><span>▶</span> ${count?'ПРОДОЛЖИТЬ':'ИГРАТЬ'} <span class="button-arrow">↗</span></button><button class="secondary" data-levels>ВЫБОР УРОВНЕЙ <span>→</span></button></div><div class="hero-meta"><span>01—05 МОДУЛЕЙ</span><i></i><span>15 УЯЗВИМОСТЕЙ</span><i></i><span>ПАРКУР · ПОИСК · ВЫЖИВАНИЕ</span></div></section><aside class="patch-note"><div class="patch-portrait" role="img" aria-label="PATCH"></div><div><span>PATCH <b> / </b> СИСТЕМНЫЙ ПОМОЩНИК</span><p>«Ищи повреждённые модули.<br>Они охраняют свои ошибки.»</p></div></aside><button class="stats-link" data-stats>▥ <span>ТВОЙ ПРОГРЕСС</span><b>${String(count).padStart(2,'0')} / 05</b> ↗</button><div class="module-strip">${allLevels().map(l=>`<button data-module="${l.id}" class="module-chip ${state.progress[l.id]?'done':''}"><span>${String(l.id).padStart(2,'0')}</span><div><small>МОДУЛЬ ${l.id}</small><strong>${escapeHTML(l.name)}</strong></div><b>${state.progress[l.id]?'✓':this.progress.isUnlocked(l.id)?'↗':'⊘'}</b></button>`).join('')}</div>`;
    main.querySelector('[data-play]').onclick=()=>this.ensureNickname(()=>{const next=allLevels().find(l=>!this.progress.getState().progress[l.id]);scene.scene.start('Game',{levelId:next?.id||1});});
    main.querySelector('[data-levels]').onclick=()=>scene.scene.start('LevelSelect');
    main.querySelector('[data-stats]').onclick=()=>this.showStats();
    main.querySelectorAll('[data-module]').forEach(el=>el.onclick=()=>{const id=Number(el.dataset.module);if(!this.progress.isUnlocked(id))return this.toast('Сначала восстанови предыдущий модуль.');this.ensureNickname(()=>scene.scene.start('Game',{levelId:id}));});
  }
  ensureNickname(next) { if(this.progress.getState().nickname)next(); else this.nickname(next); }
  modal(content, {onClose, className=''}={}) {
    this.closeModal();
    const layer=document.createElement('div');layer.className=`modal-layer ${className}`;layer.innerHTML=`<section class="modal" role="dialog" aria-modal="true">${content}</section>`;this.root.append(layer);this.modalLayer=layer;this.modalOnClose=onClose;
    const close=()=>this.closeModal();layer.querySelectorAll('[data-close]').forEach(el=>el.onclick=close);
    this.modalKey=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}};
    document.addEventListener('keydown',this.modalKey,true);
    setTimeout(()=>layer.querySelector('input, button, select')?.focus(),30);
    return layer;
  }
  closeModal() { if(this.modalLayer){this.modalLayer.remove();this.modalLayer=null;document.removeEventListener('keydown',this.modalKey,true);const cb=this.modalOnClose;this.modalOnClose=null;cb?.();} }
  nickname(next,editing=false) {
    const current=this.progress.getState().nickname||'';
    const layer=this.modal(`<div class="modal-top"><span>USER / IDENTIFICATION</span><button class="icon-button" data-close aria-label="Закрыть">×</button></div><span class="large-symbol">[ _ ]</span><h2>${editing?'Твой позывной':'Как тебя называть?'}</h2><p class="muted">PATCH нужен твой позывной. От 2 до 16 символов.</p><form><label for="nickname">НИК ИГРОКА</label><input id="nickname" name="nickname" maxlength="16" minlength="2" value="${escapeHTML(current)}" autocomplete="nickname" required placeholder="Например, Neon"/><p class="form-error" role="alert"></p><button class="primary" type="submit">${editing?'СОХРАНИТЬ':'ВОЙТИ В СИСТЕМУ'} →</button></form><p class="fine-print">${this.progress.getState().cloudConfigured?'Вход анонимный — без почты и пароля.':'Демонстрационный режим. Прогресс хранится в этом браузере.'}</p>`);
    layer.querySelector('form').onsubmit=async e=>{e.preventDefault();const name=layer.querySelector('input').value.trim();const r=validateNickname(name);if(!r.valid){layer.querySelector('.form-error').textContent=r.error;return;}const button=layer.querySelector('[type=submit]');button.disabled=true;try{await this.progress.setNickname(name);this.closeModal();this.updateStatus();next?.();}catch(error){layer.querySelector('.form-error').textContent=error.message;button.disabled=false;}};
  }
  levelSelect(scene) {
    const main=this.chrome(scene);this.chromeRefresh=()=>this.levelSelect(scene);const state=this.progress.getState();
    main.innerHTML=`<section class="page-content"><button class="text-button" data-back>← ГЛАВНОЕ МЕНЮ</button><div class="page-heading"><div><div class="eyebrow">СИСТЕМА / КАРТА МОДУЛЕЙ</div><h2>Пятнадцать ошибок.<br><span>Один выход.</span></h2></div><p>Три скрытых терминала в каждом секторе.<br>Остерегайся монстров: столкновение перезапускает уровень.</p></div><div class="level-grid">${allLevels().map(l=>{const p=state.progress[l.id];const unlocked=this.progress.isUnlocked(l.id);return `<button class="level-card ${unlocked?'':'locked'}" data-level="${l.id}" ${unlocked?'':'disabled'}><div class="level-art" style="background-image:url('${sitePath(`assets/backgrounds/level${l.id}.png`)}')"><span class="level-number">0${l.id}</span><span class="level-state">${p?'✓ ВОССТАНОВЛЕН':unlocked?'● ДОСТУПЕН':'⊘ ЗАБЛОКИРОВАН'}</span></div><div class="level-info"><small>МОДУЛЬ 0${l.id} · 3 ЗАГАДКИ</small><h3>${escapeHTML(l.name)}</h3><p>${escapeHTML(lessons[l.id]?.topic||l.topic)}</p><div class="level-score">${stars(p?.best_stars||0)}<span>${p?formatTime(p.best_time_ms):'—:—'}</span></div><span class="level-go">${unlocked?'ВОЙТИ В МОДУЛЬ →':'ПРОЙДИ ПРЕДЫДУЩИЙ УРОВЕНЬ'}</span></div></button>`;}).join('')}</div><p class="hint-line">◇ 3 звезды: без ошибок и подсказок. 2 звезды: до 2 ошибок и 1 подсказки.</p></section>`;
    main.querySelector('[data-back]').onclick=()=>scene.scene.start('Menu');
    main.querySelectorAll('[data-level]').forEach(el=>el.onclick=()=>this.ensureNickname(()=>scene.scene.start('Game',{levelId:Number(el.dataset.level)})));
  }
  showHud(scene,level) { this.hideAll();this.hud=new Hud(this,scene,level); return this.hud; }
  updateHud(data) { this.hud?.update(data); }
  openTerminal(scene,lesson,callbacks,context={}) { this.closeTerminal();this.terminal=new TerminalOverlay(this,scene,lesson,callbacks,context); }
  closeTerminal() { const terminal=this.terminal;this.terminal=null;terminal?.destroy(); }
  showPause(scene) {
    const layer=this.modal(`<div class="modal-top"><span>SYSTEM / PAUSED</span><button class="icon-button" data-close aria-label="Продолжить">×</button></div><h2>Система ждёт.</h2><p class="muted">Твой код никуда не исчезнет.</p><div class="stack-actions"><button class="primary" data-resume>ПРОДОЛЖИТЬ →</button><button class="secondary" data-settings>НАСТРОЙКИ</button><button class="secondary" data-restart>НАЧАТЬ УРОВЕНЬ ЗАНОВО</button><button class="text-button" data-menu>В ГЛАВНОЕ МЕНЮ</button></div>`,{onClose:()=>scene.resumeGame()});
    layer.querySelector('[data-resume]').onclick=()=>this.closeModal();
    layer.querySelector('[data-settings]').onclick=()=>{this.modalOnClose=null;this.closeModal();this.showSettings(()=>this.showPause(scene));};
    layer.querySelector('[data-restart]').onclick=()=>{this.modalOnClose=null;this.closeModal();scene.restartLevel();};
    layer.querySelector('[data-menu]').onclick=()=>{this.modalOnClose=null;this.closeModal();scene.goMenu();};
  }
  showDeath(scene, details={}) {
    this.root.querySelector('.death-screen')?.remove();
    const layer=document.createElement('div');layer.className='death-screen';
    layer.innerHTML=`<div class="death-window"><span class="death-code">FATAL ERROR / PROCESS TERMINATED</span><h2>Система тебя обнаружила.</h2><p>${escapeHTML(details.message||details.reason||'Повреждённый процесс уничтожил оболочку. Уровень запускается заново.')}</p><div class="death-info"><b>ПЕРЕЗАГРУЗКА УРОВНЯ 0${scene.levelId}</b><span>Терминалы и предметы сброшены. Пройденные уровни сохранены.</span></div><div class="death-progress"><i></i></div></div>`;
    this.root.append(layer);
  }
  closeDeath(){this.root.querySelector('.death-screen')?.remove();}
  closePause() { this.modalOnClose=null;this.closeModal(); }
  showSettings(onClose) { new SettingsModal(this,onClose); }
  showStats() { new StatsPanel(this,stars); }
  results(scene,data) {
    const level=getLevel(data.levelId),run=data.run||{};const duration=data.durationMs??run.duration_ms??0;const mistakes=data.mistakes??run.mistakes??0;const hints=data.hintsUsed??run.hints_used??0;const reward=data.stars||run.stars||calculateStars(mistakes,hints);
    const main=this.chrome(scene);this.chromeRefresh=null;
    main.innerHTML=`<section class="result-page"><div class="success-code">✓ PATCH APPLIED SUCCESSFULLY</div><div class="eyebrow">МОДУЛЬ 0${data.levelId} / ${escapeHTML(level.name)}</div><h2>Ошибка исправлена.<br><span>Путь открыт.</span></h2><div class="result-stars">${stars(reward)}</div><p class="lesson-summary">${escapeHTML(lessons[data.levelId].summary)}</p><div class="result-metrics"><div><small>ВРЕМЯ</small><strong>${formatTime(duration)}</strong></div><div><small>ОШИБКИ</small><strong>${mistakes}</strong></div><div><small>ПОДСКАЗКИ</small><strong>${hints}</strong></div></div><p class="fine-print">Звёзды зависят только от ошибок и подсказок. Время сохраняется отдельно. Монстры перезапускают попытку.</p><div class="result-actions"><button class="primary" data-next>${data.levelId===5?'ВОЙТИ В ПОРТАЛ':'СЛЕДУЮЩИЙ МОДУЛЬ'} →</button><button class="secondary" data-retry>ПОВТОРИТЬ</button><button class="text-button" data-menu>В МЕНЮ</button></div><p class="save-message" data-save-message>${escapeHTML(this.progress.getState().message)}</p></section>`;
    main.querySelector('[data-next]').onclick=()=>scene.scene.start(data.levelId===5?'Final':'Game',data.levelId===5?{}:{levelId:data.levelId+1});
    main.querySelector('[data-retry]').onclick=()=>scene.scene.start('Game',{levelId:data.levelId});
    main.querySelector('[data-menu]').onclick=()=>scene.scene.start('Menu');
  }
  final(scene) {
    this.hideAll();this.root.innerHTML=`<div class="final-screen"><div class="eyebrow">SYSTEM STATUS / ONLINE</div><h1>Выход найден<span>_</span></h1><p>Ты восстановил систему.<br>И научился менять её правила.</p><div class="final-patch"><b>PATCH</b> «Спасибо. Теперь ты знаешь: ошибка — это начало решения.»</div><div class="mastered">ПЕРЕМЕННЫЕ <span>✓</span> ЧИСЛА <span>✓</span> УСЛОВИЯ <span>✓</span> ЦИКЛЫ <span>✓</span> ЛОГИКА <span>✓</span></div><button class="primary" data-stats>МОЯ СТАТИСТИКА ↗</button><button class="text-button" data-menu>В ГЛАВНОЕ МЕНЮ →</button><p class="hidden-bug">[ log 0x405 ] Один процесс всё ещё не отвечает…</p></div>`;
    this.root.querySelector('[data-stats]').onclick=()=>this.showStats();this.root.querySelector('[data-menu]').onclick=()=>scene.scene.start('Menu');
  }
  toast(message) { this.root.querySelector('.toast')?.remove();const el=document.createElement('div');el.className='toast';el.textContent=message;el.setAttribute('role','status');this.root.append(el);clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>el.remove(),4500); }
  dialogue(message) { this.root.querySelector('.patch-dialogue')?.remove();const el=document.createElement('div');el.className='patch-dialogue';el.innerHTML=`<div class="patch-portrait"></div><div><b>PATCH <span>СИСТЕМНЫЙ ПОМОЩНИК</span></b><p></p></div><button aria-label="Закрыть реплику">×</button>`;el.querySelector('p').textContent=typeof message==='string'?message:message?.text||'';el.querySelector('button').onclick=()=>el.remove();this.root.append(el);clearTimeout(this.dialogueTimer);this.dialogueTimer=setTimeout(()=>el.remove(),8500); }
}
