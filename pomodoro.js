/* =========================================================
   TÁO VÀNG — pomodoro.js v6
   Đồng hồ trơn (không hiệu ứng) 25/5, nghỉ dài sau N vòng,
   tự chỉnh thời gian; danh sách nhạc YouTube riêng (video trái,
   danh sách phải, link trên cùng).
   ========================================================= */
'use strict';

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
      beep();toast(long?`Xong ${cfg.pomo.rounds} vòng — nghỉ dài ${cfg.pomo.long} phút nhé.`:`Xong một phiên — nghỉ ${cfg.pomo.short} phút nhé.`);
    }else{
      st.phase='work';st.left=phaseSec('work');
      beep();toast('Nghỉ xong — quay lại '+cfg.pomo.subject+' thôi.');
    }
  }
  renderPomo();
}
function renderPomo(){
  const mm=String(st.left/60|0).padStart(2,'0'),ss=String(st.left%60).padStart(2,'0');
  $('pomoTime').textContent=mm+':'+ss;
  $('pomoPhase').textContent={work:'tập trung',short:'nghỉ ngắn',long:'nghỉ dài'}[st.phase];
  $('pomoInfo').textContent=`Đã xong ${st.round} vòng · nghỉ dài ${cfg.pomo.long} phút sau ${cfg.pomo.rounds} vòng · môn ${cfg.pomo.subject}`;
}

$('btnStart').onclick=()=>{
  st.running=!st.running;st.started=st.started||st.running;
  if(st.running){ensureAudio();st.timer=setInterval(pomoTick,1000)}
  else clearInterval(st.timer);
  $('btnStart').textContent=st.running?'Tạm dừng':(st.started?'Tiếp tục':'Bắt đầu');
};
$('btnResetPomo').onclick=()=>{
  st.running=false;clearInterval(st.timer);
  st.phase='work';st.left=phaseSec('work');st.round=0;st.started=false;
  $('btnStart').textContent='Bắt đầu';renderPomo();
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
   cfg.pomo.yt: {kind:'video'|'list', id, title}
   Phát qua iframe embed: video đơn nối các video còn lại thành chuỗi. */
function ytParse(url){
  const s=String(url).trim();
  let m=s.match(/(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/);
  if(m)return {kind:'video',id:m[1]};
  m=s.match(/[?&]list=([\w-]+)/);
  if(m)return {kind:'list',id:m[1]};
  return null;
}
function ytEmbed(item,rest){
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
    box.innerHTML='<li class="xrow xrow--empty">Chưa có link nào — dán lên trên nhé.</li>';
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
  ytTitle(item);
  toast('Đã thêm vào danh sách nhạc.');
});
$('ytList').addEventListener('click',e=>{
  const b=e.target.closest('button[data-yt]');if(!b)return;
  const i=+b.dataset.i;
  if(b.dataset.yt==='play')ytPlayAt(i);
  else{
    if(!$('ytFrameWrap').hidden)ytStop(); // dừng nhạc khi gỡ mục đang phát
    cfg.pomo.yt.splice(i,1);saveState();renderYt();toast('Đã xóa khỏi danh sách.');
  }
});
/* dừng phát: dùng nút pause ngay trên trình player của YouTube */

/* INIT */
renderPomoSubjects();
fillPomoSettings();
renderYt();
renderPomo();
