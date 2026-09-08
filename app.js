(()=>{
const root=document.getElementById('app');
const PROGRAM=window.PROGRAM_116;
if(!PROGRAM) throw new Error('PROGRAM_116 is missing');
const P=PROGRAM.routines;


// --- Audio overlay mode v1.6 ---
// On supporting iOS/WebKit builds, "transient" lets a short app sound mix with
// music from another app instead of taking over the phone's playback session.
const restAudio = new Audio('rest-whistle-v13.wav');
restAudio.preload = 'auto';

let previousAudioSessionType = null;

function enterTransientAudioSession() {
  try {
    if ('audioSession' in navigator && navigator.audioSession) {
      previousAudioSessionType = navigator.audioSession.type || 'auto';
      navigator.audioSession.type = 'transient';
    }
  } catch (e) {}
}

function leaveTransientAudioSession() {
  try {
    if ('audioSession' in navigator && navigator.audioSession) {
      navigator.audioSession.type = previousAudioSessionType || 'auto';
    }
  } catch (e) {}
  previousAudioSessionType = null;
}

async function playRestSignal(){
  if (!soundEnabled) return;
  try{
    enterTransientAudioSession();
    restAudio.currentTime = 0;
    await restAudio.play();
  }catch(e){
    leaveTransientAudioSession();
  }
}

restAudio.addEventListener('ended', leaveTransientAudioSession);
restAudio.addEventListener('pause', () => {
  if (restAudio.currentTime === 0 || restAudio.ended) leaveTransientAudioSession();
});

const STORAGE='tracker116-state-v1', HISTORY='tracker116-history-v1', SOUND_PREF='tracker116-sound-v1', PENDING='tracker116-pending-finish-v1';
function mk(k){return{ex:0,set:0,edit:false,items:P[k].map(x=>({rir:'',tech:'',note:'',sets:Array.from({length:x.sets},(_,i)=>({weight:i===0?(x.w||''):'',reps:String(x.t[i]??''),done:false}))}))}}
function fresh(){return{S:{A:mk('A'),B:mk('B'),C:mk('C')},R:(PROGRAM.nextRoutine||'A'),started:null,finished:null,restEnd:null,programVersion:PROGRAM.version}}
function load(){try{const x=JSON.parse(localStorage.getItem(STORAGE));if(!x||x.programVersion!==PROGRAM.version)return fresh();return x}catch(e){return fresh()}}
let state=load(),S=state.S,R=state.R,started=state.started,finished=state.finished,restEnd=state.restEnd;
let pendingFinish=null;
try{pendingFinish=JSON.parse(localStorage.getItem(PENDING))||null}catch(e){pendingFinish=null}
let timer=null,restSec=120,restRun=!!(restEnd&&restEnd>Date.now()),signaled=false;
let soundEnabled=localStorage.getItem(SOUND_PREF)!=='off';
let soundUnlocked=false;
const $=s=>root.querySelector(s),soundBtn=$('#soundBtn'),startWorkoutBtn=$('#startWorkout'),weightLabel=$('#weightLabel'),clock=$('#clock'),rclock=$('#restClock'),rlabel=$('#restLabel'),meta=$('#meta'),name=$('#name'),plan=$('#plan'),warm=$('#warm'),tabs=$('#tabs'),weight=$('#weight'),reps=$('#reps'),repLabel=$('#repLabel'),rir=$('#rir'),tech=$('#tech'),note=$('#note'),done=$('#done'),finalPanel=$('#finalPanel'),summaryPanel=$('#summaryPanel'),summary=$('#summary'),status=$('#status'),historyPanel=$('#historyPanel'),historyList=$('#historyList'),restControls=$('#restControls');
$('#version').textContent='Программа '+PROGRAM.version;

function updateSoundButton(){
  if(!soundBtn)return;
  soundBtn.textContent=soundEnabled?'🔊 Звук':'🔇 Звук';
  soundBtn.setAttribute('aria-pressed',soundEnabled?'true':'false');
}
function unlockSound(){
  if(soundUnlocked||!soundEnabled)return;
  try{
    enterTransientAudioSession();
    const oldVol=restAudio.volume;
    restAudio.volume=0;
    restAudio.currentTime=0;
    const p=restAudio.play();
    if(p&&typeof p.then==='function')p.then(()=>{
      restAudio.pause();restAudio.currentTime=0;restAudio.volume=oldVol;
      soundUnlocked=true;leaveTransientAudioSession();
    }).catch(()=>{
      restAudio.volume=oldVol;leaveTransientAudioSession();
    });
    else{
      restAudio.pause();restAudio.currentTime=0;restAudio.volume=oldVol;
      soundUnlocked=true;leaveTransientAudioSession();
    }
  }catch(e){leaveTransientAudioSession();}
}
function playRestSound(){playRestSignal();}

function persist(){try{localStorage.setItem(STORAGE,JSON.stringify({S,R,started,finished,restEnd,programVersion:PROGRAM.version}))}catch(e){}}
function clearTimerLoop(){if(timer){clearInterval(timer);timer=null}}
function syncLifecycleUI(){
  const active=!!(started&&!finished);
  if(startWorkoutBtn) startWorkoutBtn.style.display=active?'none':'inline-flex';
  const finishBtn=$('#finish');
  if(finishBtn){
    finishBtn.disabled=!active;
    finishBtn.classList.toggle('disabled',!active);
    finishBtn.setAttribute('aria-disabled',active?'false':'true');
  }
  if(restControls) restControls.style.display=restRun?'flex':'none';
  if(!restRun){
    if(restSec===0){
      rclock.textContent='00:00';
      rlabel.textContent='Отдых закончен';
    }else{
      rclock.textContent='02:00';
      rlabel.textContent='Отдых 2:00';
    }
  }
}

function resetLiveWorkout(preserveRoutine=true){
  const keepR=preserveRoutine?R:'C';
  S={A:mk('A'),B:mk('B'),C:mk('C')};
  R=keepR;
  started=null;finished=null;restEnd=null;restSec=120;restRun=false;signaled=false;
  clearTimerLoop();
  clock.textContent='00:00:00';
  rclock.textContent='02:00';
  rlabel.textContent='Отдых 2:00';
  $('#difficulty').value='';$('#hardest').value='';$('#pain').value='';
  finalPanel.classList.add('hidden');
  persist();
  syncLifecycleUI();
}
function beginWorkout(){
  if(started&&!finished){
    if(!confirm('Текущая тренировка уже идёт. Сбросить её и начать заново?'))return;
    resetLiveWorkout(true);
  }else if(finished){
    resetLiveWorkout(true);
  }
  started=Date.now();
  finished=null;
  restRun=false;restEnd=null;restSec=120;signaled=false;
  clearTimerLoop();
  timer=setInterval(tick,250);
  persist();
  syncLifecycleUI();
  status.textContent=`Тренировка ${R} начата`;
  tick();
  render();
}

function fmt(s){s=Math.max(0,Math.floor(s||0));return[Math.floor(s/3600),Math.floor((s%3600)/60),s%60].map(v=>String(v).padStart(2,'0')).join(':')}
function fmtR(s){s=Math.max(0,Math.ceil(s||0));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')}
function cur(){const r=S[R],p=P[R][r.ex],item=r.items[r.ex];return{r,p,item,set:item.sets[r.set]}}
function saveFields(){const c=cur();c.set.weight=weight.value.trim().replace(',','.');c.set.reps=reps.value.trim();c.item.rir=rir.value;c.item.tech=tech.value;c.item.note=note.value.trim();persist()}
function startClock(){if(started&&!finished)return;started=Date.now();finished=null;if(!timer)timer=setInterval(tick,250);persist()}
function tick(){if(started)clock.textContent=fmt(((finished||Date.now())-started)/1000);if(restRun&&restEnd){const left=Math.max(0,(restEnd-Date.now())/1000);restSec=Math.ceil(left);rclock.textContent=fmtR(restSec);rlabel.textContent='Отдых '+fmtR(restSec).replace(/^00:/,'');if(left<=0){restRun=false;restEnd=null;restSec=0;rclock.textContent='00:00';rlabel.textContent='Отдых закончен';if(restControls)restControls.style.display='none';if(!signaled){signaled=true;status.textContent='Отдых закончен';playRestSound()}persist()}}}
function startRest(){restSec=120;restEnd=Date.now()+120000;restRun=true;signaled=false;if(restControls)restControls.style.display='flex';if(!timer)timer=setInterval(tick,250);tick();persist()}
function adjust(d){if(!restRun||!restEnd)return;restEnd=Math.max(Date.now(),restEnd+d*1000);tick();persist()}
function skip(){if(!restRun)return;restRun=false;restEnd=null;restSec=0;rclock.textContent='00:00';rlabel.textContent='Отдых закончен';if(restControls)restControls.style.display='none';persist()}
function render(){const r=S[R],p=P[R][r.ex],item=r.items[r.ex],s=item.sets[r.set];root.querySelectorAll('[data-routine]').forEach(b=>b.classList.toggle('active',b.dataset.routine===R));meta.textContent=`${r.ex+1}/${P[R].length} · подход ${r.set+1}/${p.sets}`;name.textContent=p.name;plan.textContent=p.plan;warm.textContent=p.warm||'';warm.style.display=p.warm?'block':'none';repLabel.textContent=p.label||'Повторы';weightLabel.textContent=(p.unit==='divisions')?'Деления':'Вес, кг';tabs.innerHTML='';item.sets.forEach((st,i)=>{const b=document.createElement('button');b.type='button';b.className='setbtn'+(i===r.set?' active':'');b.textContent=(st.done?'✓':'')+(i+1);b.addEventListener('click',()=>{saveFields();r.set=i;r.edit=st.done;persist();render()});tabs.appendChild(b)});weight.value=s.weight||'';reps.value=s.reps||'';rir.value=item.rir||'';tech.value=item.tech||'';note.value=item.note||'';done.textContent=r.edit?'Сохранить':'✓ Готово';$('#prev').disabled=r.ex===0;$('#next').disabled=r.ex===P[R].length-1;$('#prev').classList.toggle('disabled',r.ex===0);$('#next').classList.toggle('disabled',r.ex===P[R].length-1);tick();syncLifecycleUI();syncEditedBadge();}
$('#setForm').addEventListener('submit',e=>{e.preventDefault();unlockSound();const r=S[R],c=cur(),w=weight.value.trim().replace(',','.'),rp=reps.value.trim();if(w&&(!Number.isFinite(Number(w))||Number(w)<0)){status.textContent='Проверь вес';weight.focus();return}if(rp&&(!Number.isFinite(Number(rp))||Number(rp)<0)){status.textContent='Проверь значение';reps.focus();return}c.set.weight=w;c.set.reps=rp;c.item.rir=rir.value;c.item.tech=tech.value;c.item.note=note.value.trim();if(r.edit){c.set.done=true;r.edit=false;status.textContent='Подход сохранён';persist();render();return}if(!started||finished){status.textContent='Сначала нажми «Начать тренировку»';return}c.set.done=true;startRest();if(r.set+1<c.item.sets.length){const n=c.item.sets[r.set+1];if(!n.done){n.weight=w;n.reps=rp}r.set++}status.textContent='Подход выполнен';persist();render()});
root.querySelectorAll('[data-routine]').forEach(b=>b.addEventListener('click',()=>{
  const nextR=b.dataset.routine;
  if(nextR===R)return;
  if(started&&!finished){
    const ok=confirm(`Сейчас идёт тренировка ${R}. Переключиться на ${nextR}? Текущая тренировка останется незавершённой.`);
    if(!ok)return;
  }
  saveFields();R=nextR;summaryPanel.classList.add('hidden');finalPanel.classList.add('hidden');historyPanel.classList.add('hidden');persist();render();
}));
$('#minus').addEventListener('click',()=>adjust(-30));$('#plus').addEventListener('click',()=>adjust(30));$('#skip').addEventListener('click',skip);
$('#prev').addEventListener('click',()=>{saveFields();const r=S[R];if(r.ex>0){r.ex--;r.set=0;r.edit=false;persist();render()}});
$('#next').addEventListener('click',()=>{saveFields();const r=S[R];if(r.ex<P[R].length-1){r.ex++;r.set=0;r.edit=false;persist();render()}});
$('#finish').addEventListener('click',()=>{
  if(!started||finished){
    status.textContent='Сначала начни тренировку';
    syncLifecycleUI();
    return;
  }
  if(!confirm(`Завершить тренировку ${R}?`))return;
  saveFields();
  const ended=Date.now();
  const effectiveStart=started||ended;
  pendingFinish={S:JSON.parse(JSON.stringify(S)),R,started:effectiveStart,finished:ended,programVersion:PROGRAM.version};
  try{localStorage.setItem(PENDING,JSON.stringify(pendingFinish))}catch(e){}
  restRun=false;restEnd=null;restSec=120;signaled=false;clearTimerLoop();
  resetLiveWorkout(true);
  clock.textContent='00:00:00';rclock.textContent='02:00';rlabel.textContent='Отдых 2:00';
  finalPanel.classList.remove('hidden');
  summaryPanel.classList.add('hidden');
  status.textContent='Тренировка завершена · таймер и рабочие поля сброшены';
  syncLifecycleUI();
  render();
});
function makeSummary(){
  const snap=pendingFinish||{S,R,started,finished,programVersion:PROGRAM.version};
  const rr=snap.R,r=snap.S[rr],date=new Date(snap.finished||Date.now()).toLocaleDateString('ru-RU');
  const elapsed=snap.started?((snap.finished||Date.now())-snap.started)/1000:0;
  let total=0,out=[`ТРЕНИРОВКА ${rr} — ${date}`,`Время: ${fmt(elapsed)}`,''];
  P[rr].forEach((p,ei)=>{
    const item=r.items[ei],d=item.sets.map((s,i)=>({s,i})).filter(x=>x.s.done);
    if(!d.length)return;
    out.push(p.name);
    out.push(d.map(({s,i})=>{total++;if(s.weight!==''&&s.reps!=='')return`${i+1}) ${s.weight} кг × ${s.reps}`;return`${i+1}) ${s.reps||'—'}`}).join(' · '));
    const details=[];
    if(item.rir)details.push(`RIR последнего: ${item.rir}`);
    if(item.tech)details.push(`техника: ${item.tech}`);
    if(item.note)details.push(`комментарий: ${item.note}`);
    if(details.length)out.push(details.join(' · '));
    out.push('');
  });
  out.push(`Всего рабочих подходов: ${total}`);
  const diff=$('#difficulty').value.trim(),hard=$('#hardest').value.trim(),pain=$('#pain').value.trim();
  if(diff)out.push(`Общая тяжесть: ${diff}/10`);
  if(hard)out.push(`Самое тяжёлое упражнение: ${hard}`);
  if(pain)out.push(`Боль/дискомфорт: ${pain}`);
  out.push('');
  out.push('Проанализируй эту тренировку в контексте программы «116 дней»: сравни с предыдущими результатами, оцени прогрессию и скажи, что менять в следующей тренировке.');
  return out.join('\n');
}
function history(){try{return JSON.parse(localStorage.getItem(HISTORY))||[]}catch(e){return[]}}
function storeHistory(text){
  const h=history(),snap=pendingFinish||{S,R,started,finished:Date.now(),programVersion:PROGRAM.version};
  const raw={
    routine:snap.R,
    started:snap.started||null,
    finished:snap.finished||Date.now(),
    programVersion:snap.programVersion||PROGRAM.version,
    exercises:P[snap.R].map((p,ei)=>{
      const item=snap.S[snap.R].items[ei];
      return {
        name:p.name,
        plan:p.plan||'',
        rir:item.rir||'',
        technique:item.tech||'',
        note:item.note||'',
        sets:item.sets.map((s,i)=>({set:i+1,weight:s.weight,reps:s.reps,done:!!s.done}))
      };
    })
  };
  h.unshift({id:Date.now(),routine:snap.R,date:new Date(snap.finished||Date.now()).toISOString(),programVersion:snap.programVersion||PROGRAM.version,text,data:raw});
  localStorage.setItem(HISTORY,JSON.stringify(h.slice(0,100)));
}
function deleteHistoryItem(id){
  const h=history().filter(x=>x.id!==id);
  localStorage.setItem(HISTORY,JSON.stringify(h));
  renderHistory();
  status.textContent='Запись удалена из истории';
}
function renderHistory(){
  const h=history();historyList.innerHTML='';
  if(!h.length){historyList.textContent='Пока нет завершённых тренировок.';return}
  h.forEach(x=>{
    const d=document.createElement('div');d.className='history-item';
    const title=document.createElement('div');
    title.innerHTML=`<b>Тренировка ${x.routine}</b><div class="history-meta">${new Date(x.date).toLocaleString('ru-RU')} · программа ${x.programVersion}</div>`;
    const actions=document.createElement('div');actions.className='history-actions';
    const openBtn=document.createElement('button');openBtn.type='button';openBtn.textContent='Открыть сводку';
    openBtn.addEventListener('click',()=>{summary.value=x.text;summaryPanel.classList.remove('hidden');historyPanel.classList.add('hidden')});
    const delBtn=document.createElement('button');delBtn.type='button';delBtn.className='history-delete';delBtn.textContent='Удалить';
    delBtn.addEventListener('click',()=>{if(confirm(`Удалить тренировку ${x.routine} от ${new Date(x.date).toLocaleString('ru-RU')}?`))deleteHistoryItem(x.id)});
    actions.append(openBtn,delBtn);d.append(title,actions);historyList.appendChild(d);
  });
}

function exportHistory(){
  try{
    const payload={
      exportedAt:new Date().toISOString(),
      app:'116 дней',
      appVersion:'1.7.1',
      programVersion:PROGRAM.version,
      history:history()
    };
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`tracker-116-history-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    status.textContent='История экспортирована';
  }catch(e){
    status.textContent='Не удалось экспортировать историю';
  }
}

$('#makeSummary').addEventListener('click',()=>{
  const text=makeSummary();
  summary.value=text;summaryPanel.classList.remove('hidden');storeHistory(text);
  pendingFinish=null;try{localStorage.removeItem(PENDING)}catch(e){}
  finalPanel.classList.add('hidden');
  $('#difficulty').value='';$('#hardest').value='';$('#pain').value='';
  status.textContent='Сводка сохранена в истории · трекер готов к новой тренировке';
});
$('#selectText').addEventListener('click',()=>{summary.focus();summary.select();summary.setSelectionRange(0,summary.value.length)});
soundBtn.addEventListener('click',()=>{soundEnabled=!soundEnabled;localStorage.setItem(SOUND_PREF,soundEnabled?'on':'off');updateSoundButton();if(soundEnabled){soundUnlocked=false;unlockSound();status.textContent='Звук отдыха включён'}else{restAudio.pause();restAudio.currentTime=0;leaveTransientAudioSession();status.textContent='Звук отдыха выключен'}});
$('#historyBtn').addEventListener('click',()=>{renderHistory();historyPanel.classList.remove('hidden');summaryPanel.classList.add('hidden');finalPanel.classList.add('hidden')});
$('#closeHistory').addEventListener('click',()=>historyPanel.classList.add('hidden'));
$('#exportHistoryBtn').addEventListener('click',exportHistory);
startWorkoutBtn.addEventListener('click',beginWorkout);
window.addEventListener('pagehide',saveFields);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')saveFields()});
if(started&&!finished&&!timer)timer=setInterval(tick,250);
if(restRun&&!timer)timer=setInterval(tick,250);
if(pendingFinish){finalPanel.classList.remove('hidden');clock.textContent='00:00:00';rclock.textContent='02:00';rlabel.textContent='Отдых 2:00'}
updateSoundButton();syncLifecycleUI();render();

// --- v1.8 local plan editor ---
const PLAN_OVERRIDES='tracker116-plan-overrides-v1';
let editorRoutine=null, editorExercise=null;

function getOverrides(){
  try{return JSON.parse(localStorage.getItem(PLAN_OVERRIDES)||'{}')||{}}
  catch(e){return{}}
}
function setOverrides(v){localStorage.setItem(PLAN_OVERRIDES,JSON.stringify(v))}
function overrideFor(r,ei){
  const o=getOverrides();
  return o?.[r]?.[ei]||null;
}
function effectiveExercise(r,ei){
  const base=P[r][ei];
  const ov=overrideFor(r,ei);
  return ov ? {...base,...ov} : base;
}
function applyOverrideToProgram(){
  const o=getOverrides();
  ['A','B','C'].forEach(r=>{
    if(!o[r])return;
    Object.keys(o[r]).forEach(k=>{
      const i=Number(k);
      if(P[r] && P[r][i]) P[r][i]={...P[r][i],...o[r][k]};
    });
  });
}
applyOverrideToProgram();

function openPlanEditor(r,ei){
  editorRoutine=r; editorExercise=ei;
  const p=effectiveExercise(r,ei);
  document.getElementById('planEditorName').textContent=`${r}: ${p.name}`;
  document.getElementById('editPlanText').value=p.plan||'';
  document.getElementById('editWeight').value=p.w??'';
  document.getElementById('editSetsCount').value=p.sets||((p.t||[]).length||1);
  document.getElementById('editTargets').value=(p.t||[]).join(',');
  document.getElementById('editWarmText').value=p.warm||'';
  document.getElementById('planEditorModal').classList.remove('hidden');
}
function closePlanEditor(){document.getElementById('planEditorModal').classList.add('hidden')}
function syncEditedBadge(){
  const badge=$('#editedBadge');
  if(!badge)return;
  const edited=!!overrideFor(R,S[R].ex);
  badge.classList.toggle('hidden',!edited);
}







function exportPlanOverridesFile(){
  const payload={
    type:'tracker116-local-plan-overrides',
    schemaVersion:1,
    exportedAt:new Date().toISOString(),
    baseProgramVersion:PROGRAM.version||null,
    overrides:getOverrides()
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const stamp=new Date().toISOString().slice(0,10);
  a.href=url;
  a.download=`tracker116-plan-overrides-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function validatePlanOverridePayload(data){
  if(!data || typeof data!=='object') throw new Error('Файл не содержит JSON-объект.');
  if(data.type!=='tracker116-local-plan-overrides') throw new Error('Это не файл локальных изменений трекера 116.');
  if(data.schemaVersion!==1) throw new Error('Неподдерживаемая версия файла.');
  if(!data.overrides || typeof data.overrides!=='object' || Array.isArray(data.overrides)) throw new Error('В файле нет корректного блока overrides.');
  const clean={};
  for(const r of ['A','B','C']){
    if(!data.overrides[r]) continue;
    if(typeof data.overrides[r]!=='object' || Array.isArray(data.overrides[r])) throw new Error(`Некорректный раздел ${r}.`);
    clean[r]={};
    for(const [k,v] of Object.entries(data.overrides[r])){
      const i=Number(k);
      if(!Number.isInteger(i) || i<0 || !P[r] || !P[r][i]) throw new Error(`Некорректный индекс упражнения в ${r}: ${k}`);
      if(!v || typeof v!=='object' || Array.isArray(v)) throw new Error(`Некорректные данные упражнения ${r}/${k}.`);
      const allowed={};
      if('plan' in v) allowed.plan=String(v.plan ?? '');
      if('sets' in v){
        const sets=Number(v.sets);
        if(!Number.isInteger(sets) || sets<1 || sets>12) throw new Error(`Некорректное количество подходов в ${r}/${k}.`);
        allowed.sets=sets;
      }
      if('t' in v){
        if(!Array.isArray(v.t) || v.t.length<1 || v.t.length>12 || v.t.some(x=>!Number.isFinite(Number(x)))) throw new Error(`Некорректные повторы/секунды в ${r}/${k}.`);
        allowed.t=v.t.map(Number);
      }
      if('w' in v) allowed.w=String(v.w ?? '');
      if('warm' in v) allowed.warm=String(v.warm ?? '');
      clean[r][i]=allowed;
    }
    if(!Object.keys(clean[r]).length) delete clean[r];
  }
  return clean;
}

function applyImportedOverrides(clean){
  setOverrides(clean);
  for(const r of ['A','B','C']){
    if(!clean[r]) continue;
    for(const [k,ov] of Object.entries(clean[r])){
      const i=Number(k);
      P[r][i]={...P[r][i],...ov};
      const item=S[r]?.items?.[i];
      if(item){
        const sets=ov.sets || P[r][i].sets || ov.t?.length || item.sets.length || 1;
        const targets=ov.t || P[r][i].t || [];
        const oldSets=Array.isArray(item.sets)?item.sets:[];
        const rebuilt=[];
        for(let si=0;si<sets;si++){
          const old=oldSets[si];
          if(old && old.done){
            rebuilt.push({...old});
          }else{
            rebuilt.push({
              weight: ('w' in ov) ? ov.w : (old?.weight ?? P[r][i].w ?? ''),
              reps: targets[si] ?? old?.reps ?? 0,
              done:false
            });
          }
        }
        item.sets=rebuilt;
        if(item.set>=sets)item.set=Math.max(0,sets-1);
      }
    }
  }
  persist();
  render();
}

async function importPlanOverridesFile(file){
  if(!file) return;
  const text=await file.text();
  const data=JSON.parse(text);
  const clean=validatePlanOverridePayload(data);
  applyImportedOverrides(clean);
  status.textContent='Локальные изменения плана импортированы';
}

document.addEventListener('click',function(e){
  const edit=e.target.closest('#editPlanBtn');
  if(edit){
    e.preventDefault();
    e.stopPropagation();
    openPlanEditor(R,S[R].ex);
    return;
  }
  if(e.target.closest('#closePlanEditor')){
    e.preventDefault(); closePlanEditor(); return;
  }
  if(e.target===document.getElementById('planEditorModal')){
    closePlanEditor(); return;
  }
  if(e.target.closest('#savePlanEdit')){
    e.preventDefault();
    if(editorRoutine==null||editorExercise==null)return;
    const q=id=>document.getElementById(id);
    const sets=Math.max(1,Math.min(12,Number(q('editSetsCount').value)||1));
    let targets=q('editTargets').value.split(',').map(x=>x.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
    if(!targets.length) targets=Array.from({length:sets},()=>0);
    if(targets.length<sets) targets=targets.concat(Array.from({length:sets-targets.length},()=>targets[targets.length-1]||0));
    if(targets.length>sets) targets=targets.slice(0,sets);
    const ov={plan:q('editPlanText').value.trim(),sets,t:targets,warm:q('editWarmText').value.trim()};
    const weight=q('editWeight').value.trim();
    if(weight!=='')ov.w=weight;
    const all=getOverrides();
    all[editorRoutine]=all[editorRoutine]||{};
    all[editorRoutine][editorExercise]=ov;
    setOverrides(all);
    P[editorRoutine][editorExercise]={...P[editorRoutine][editorExercise],...ov};
    {
      const item=S[editorRoutine].items[editorExercise];
      const oldSets=Array.isArray(item.sets)?item.sets:[];
      const rebuilt=[];
      for(let i=0;i<sets;i++){
        const old=oldSets[i];
        // Уже выполненные подходы сохраняем как факт тренировки.
        if(old && old.done){
          rebuilt.push({...old});
        }else{
          rebuilt.push({
            weight: weight!=='' ? weight : (old?.weight ?? ''),
            reps: targets[i] ?? (old?.reps ?? 0),
            done:false
          });
        }
      }
      item.sets=rebuilt;
      // Если текущий индекс оказался за пределами после уменьшения числа подходов —
      // переносим его на последний доступный подход.
      if(item.set>=sets)item.set=Math.max(0,sets-1);
    }
    persist(); closePlanEditor(); render();
    status.textContent='План упражнения обновлён локально';
    return;
  }
  if(e.target.closest('#exportPlanOverrides')){
    e.preventDefault();
    exportPlanOverridesFile();
    status.textContent='Файл локальных изменений подготовлен';
    return;
  }
  if(e.target.closest('#importPlanOverrides')){
    e.preventDefault();
    const input=document.getElementById('importPlanFile');
    if(input){ input.value=''; input.click(); }
    return;
  }
  if(e.target.closest('#resetAllPlanOverrides')){
    e.preventDefault();
    if(confirm('Сбросить все локальные изменения плана A/B/C? Каноническая программа program.js останется без изменений.')){
      localStorage.removeItem(PLAN_OVERRIDES);
      location.reload();
    }
    return;
  }
  if(e.target.closest('#resetPlanEdit')){
    e.preventDefault();
    if(editorRoutine==null||editorExercise==null)return;
    const all=getOverrides();
    if(all[editorRoutine])delete all[editorRoutine][editorExercise];
    if(all[editorRoutine]&&!Object.keys(all[editorRoutine]).length)delete all[editorRoutine];
    setOverrides(all);
    location.reload();
  }
},true);

})();


// --- PWA update controls v1.3 ---
const TRACKER_APP_VERSION = '1.9';

async function forceTrackerUpdate() {
  const btn = document.getElementById('trackerUpdateBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Проверяю…'; }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
      }
    }
    // Reload from the server; SW v1.3 uses network-first for navigation/assets.
    window.location.reload();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = 'Обновить';
    }
    alert('Не удалось проверить обновление. Проверь интернет и попробуй ещё раз.');
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!sessionStorage.getItem('tracker116-reloaded-v19')) {
      sessionStorage.setItem('tracker116-reloaded-v19', '1');
      window.location.reload();
    }
  });
}



window.addEventListener('DOMContentLoaded',()=>{
  const input=document.getElementById('importPlanFile');
  if(input){
    input.addEventListener('change',async()=>{
      try{
        await importPlanOverridesFile(input.files?.[0]);
        document.getElementById('planDataDetails')?.removeAttribute('open');
      }catch(err){
        alert('Не удалось импортировать файл: '+(err?.message||err));
      }finally{
        input.value='';
      }
    });
  }
});

window.addEventListener('DOMContentLoaded',()=>{
  const v=document.getElementById('appVersionLabel');
  if(v)v.textContent='v'+TRACKER_APP_VERSION;
  const b=document.getElementById('trackerUpdateBtn');
  if(b)b.addEventListener('click',forceTrackerUpdate);
});
