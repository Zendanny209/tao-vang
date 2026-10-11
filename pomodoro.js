/* =========================================================
   TÁO VÀNG — pomodoro.js v5
   Nước dâng theo tiến độ phiên tập trung:
   p = 0 → vòm trống; p → 1 nước dâng gần đầy ô; về 00:00 nước ngập tròn.
   Đặt lại → nước rút xuống (animation). Kèm danh sách nhạc YouTube riêng.
   ========================================================= */
'use strict';

const SVGNS='http://www.w3.org/2000/svg';

/* ---------- sao đêm (nền vòm) ---------- */
function buildStars(){
  const stars=$('stars');
  const cols=['#f4e6c0','#cfdcec','#e8d9a8'];
  for(let i=0;i<46;i++){
    let x,y,tries=0;
    do{x=Math.random()*300;y=Math.random()*300;tries++}
    while(Math.hypot(x-150,y-150)<92&&tries<20);
    const c=document.createElementNS(SVGNS,'circle');
    c.setAttribute('cx',x.toFixed(1));c.setAttribute('cy',y.toFixed(1));
    c.setAttribute('r',(.6+Math.random()*1.1).toFixed(2));
    c.setAttribute('fill',cols[i%3]);
    c.setAttribute('opacity',(.18+Math.random()*.5).toFixed(2));
    c.setAttribute('class','star');
    c.style.animationDelay=(Math.random()*3.4).toFixed(2)+'s';
    stars.appendChild(c);
  }
}

/* ---------- nước dâng ---------- */
function setWater(p,drainMs){
  const w=$('water');
  if(!w)return;
  p=Math.max(0,Math.min(1,p));
  w.style.transition=drainMs?`height ${drainMs}ms ease`:'';
  w.style.height=(p*100).toFixed(1)+'%';
  $('garden').classList.toggle('full',p>=0.999);
}
const waterP=()=>st.phase==='work'?1-st.left/phaseSec('work'):1;

/* ---------- đồng hồ ---------- */
let st={phase:'work',left:cfg.pomo.work*60,round:0,running:false,started:false,timer:null};
let audio=null;
const ensureAudio=()=>{
  if(!audio)audio=new (window.AudioContext||window.webkitAudioContext)();
  if(audio.state==='suspended')audio.resume();
};
function beep(){
  if(!audio)return;
  const t=audio.currentTime;
  [660,880].forEach((f,i)=>{
    const o=audio.createOscillator(),g=audio.createGain();
    o.type='sine';o.frequency.value=f;
    g.gain.setValueAtTime(0,t+i*.18);
    g.gain.linearRampToValueAtTime(.06,t+i*.18+.02);
    g.gain.exponentialRampToValueAtTime(.0001,t+i*.18+.3);
    o.connect(g);g.connect(audio.destination);
    o.start(t+i*.18);o.stop(t+i*.18+.32);
  });
}
const phaseSec=ph=>(ph==='work'?cfg.pomo.work:ph==='short'?cfg.pomo.short:cfg.pomo.long)*60;

function pomoTick(){
  st.left--;
  if(st.left<=0){
    if(st.phase==='work'){
      st.round++;
      const long=st.round%cfg.pomo.rounds===0;
      st.phase=long?'long':'short';
      st.left=phaseSec(st.phase);
      beep();toast(long?`Xong ${cfg.pomo.rounds} vòng — nước dâng đầy, nghỉ dài ${cfg.pomo.long} phút nhé.`:`Xong một phiên — nước ngập tròn, nghỉ ${cfg.pomo.short} phút nhé.`);
    }else{
      st.phase='work';st.left=phaseSec('work');
      beep();toast('Nghỉ xong — quay lại '+cfg.pomo.subject+' thôi, nước bắt đầu dâng lại.');
    }
  }
  renderPomo();
}
function renderPomo(){
  const mm=String(st.left/60|0).padStart(2,'0'),ss=String(st.left%60).padStart(2,'0');
  $('pomoTime').textContent=mm+':'+ss;
  setWater(waterP());
  const ph={work:'Tập trung',short:'Nghỉ ngắn',long:'Nghỉ dài'}[st.phase];
  $('pomoInfo').textContent=`${ph} · đã xong ${st.round} vòng · nghỉ dài ${cfg.pomo.long} phút sau ${cfg.pomo.rounds} vòng · môn ${cfg.pomo.subject}`;
}

$('btnStart').onclick=()=>{
  st.running=!st.running;st.started=st.started||st.running;
  if(st.running){ensureAudio();st.timer=setInterval(pomoTick,1000)}
  else clearInterval(st.timer);
  $('garden').classList.toggle('breathing',st.running);
  $('btnStart').textContent=st.running?'Tạm dừng':(st.started?'Tiếp tục':'Bắt đầu');
};
$('btnResetPomo').onclick=()=>{
  st.running=false;clearInterval(st.timer);
  st.phase='work';st.left=phaseSec('work');st.round=0;st.started=false;
  $('garden').classList.remove('breathing');
  $('btnStart').textContent='Bắt đầu';
  renderPomo();
  setWater(0,1200); // nước rút xuống
};

/* môn + thiết lập thời gian */
function renderPomoSubjects(){
  const sel=$('pomoSubject');
  if(!cfg.subjects.some(s=>s.name===cfg.pomo.subject))cfg.pomo.subject=cfg.subjects[0].name;
  sel.innerHTML=cfg.subjects.map(s=>
    `<option value="${esc(s.name)}"${s.name===cfg.pomo.subject?' selected':''}>${esc(s.name)}</option>`).join('');
}
$('pomoSubject').addEventListener('change',e=>{cfg.pomo.subject=e.target.value;saveState();renderPomo()});

function fillPomoSettings(){
  $('pWork').value=cfg.pomo.work;
  $('pShort').value=cfg.pomo.short;
  $('pLong').value=cfg.pomo.long;
  $('pRounds').value=cfg.pomo.rounds;
}
[['pWork','work',5,120],['pShort','short',1,60],['pLong','long',5,90],['pRounds','rounds',2,8]]
.forEach(([id,key,min,max])=>{
  $(id).addEventListener('change',e=>{
    let v=Math.round(+e.target.value||cfg.pomo[key]);
    cfg.pomo[key]=Math.max(min,Math.min(max,v));
    saveState();fillPomoSettings();
    if(!st.running){st.left=phaseSec(st.phase)}
    renderPomo();toast('Đã lưu thiết lập Pomodoro.');
  });
});

/* ---------------- DANH SÁCH NHẠC YOUTUBE ----------------
   Lưu trong cfg.pomo.yt: {kind:'video'|'list', id, title}
   Phát qua iframe embed: video đơn hoặc chuỗi playlist. */
function ytParse(url){
  const s=String(url).trim();
  let m=s.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/);
  if(m)return {kind:'video',id:m[1]};
  m=s.match(/[?&]list=([\w-]+)/);
  if(m)return {kind:'list',id:m[1]};
  return null;
}
function ytEmbed(item,rest){ // rest: các id video còn lại để nối thành playlist
  if(item.kind==='list')
    return `https://www.youtube.com/embed/videoseries?list=${item.id}&autoplay=1&rel=0`;
  const tail=rest.length?`&playlist=${rest.join(',')}`:'';
  return `https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0${tail}`;
}
function ytStop(){
  $('ytPlayer').src='';
  $('ytFrameWrap').hidden=true;
}
function ytPlayAt(i){
  const list=cfg.pomo.yt||[];
  const item=list[i];if(!item)return;
  if(item.kind==='video'){
    const rest=list.filter((x,j)=>j!==i&&x.kind==='video').map(x=>x.id);
    $('ytPlayer').src=ytEmbed(item,rest);
  }else{
    $('ytPlayer').src=ytEmbed(item,[]);
  }
  $('ytFrameWrap').hidden=false;
  toast('Đang phát — vừa học vừa nghe nhé.');
}
function ytTitle(item){
  /* thử lấy tên qua oEmbed (nếu không được thì dùng ID) */
  const url=item.kind==='video'
    ?`https://www.youtube.com/watch?v=${item.id}`
    :`https://www.youtube.com/playlist?list=${item.id}`;
  fetch('https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(url))
    .then(r=>r.ok?r.json():null)
    .then(j=>{
      if(!j||!j.title)return;
      item.title=j.title;
      saveState();renderYt();
    }).catch(()=>{});
}
function renderYt(){
  const list=cfg.pomo.yt||[];
  const box=$('ytList');
  if(!list.length){
    box.innerHTML='<li class="xrow xrow--empty">Chưa có link nào — dán link đầu tiên lên trên nhé.</li>';
    return;
  }
  box.innerHTML=list.map((x,i)=>`<li class="xrow">
    <span class="chip ${x.kind==='list'?'chip--extra':'chip--self'}">${x.kind==='list'?'playlist':'video'}</span>
    <b class="xrow__subj">${esc(x.title||x.id)}</b>
    <span class="xrow__acts">
      <button class="linklike" data-yt="play" data-i="${i}" type="button">Phát</button>
      <button class="linklike" data-yt="del" data-i="${i}" type="button">Xóa</button>
    </span>
  </li>`).join('');
}
$('ytForm').addEventListener('submit',e=>{
  e.preventDefault();
  const url=$('ytUrl').value.trim();
  const item=url&&ytParse(url);
  if(!item){toast('Link YouTube không nhận diện được — kiểm tra lại nhé.');return}
  cfg.pomo.yt=cfg.pomo.yt||[];
  item.title=item.id;
  cfg.pomo.yt.push(item);
  saveState();renderYt();
  $('ytUrl').value='';
  ytTitle(item); // lấy tên thật bất đồng bộ
  toast('Đã thêm vào danh sách nhạc.');
});
$('ytList').addEventListener('click',e=>{
  const b=e.target.closest('button[data-yt]');if(!b)return;
  const i=+b.dataset.i;
  if(b.dataset.yt==='play')ytPlayAt(i);
  else{
    if(!$('ytFrameWrap').hidden)ytStop();
    cfg.pomo.yt.splice(i,1);saveState();renderYt();toast('Đã xóa khỏi danh sách.');
  }
});
$('btnYtStop').onclick=ytStop;

/* INIT */
buildStars();
renderPomoSubjects();
fillPomoSettings();
renderYt();
renderPomo();
setWater(0);
