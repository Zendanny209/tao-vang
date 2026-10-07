/* =========================================================
   TÁO VÀNG — pomodoro.js
   Hoa thuỷ tinh nở dần theo tiến độ phiên tập trung:
   p = 0 → chồi khép; p = 1 → nở hoàn chỉnh (đồng hồ về 00:00).
   ========================================================= */
'use strict';

const SVGNS='http://www.w3.org/2000/svg';

/* ---------- dựng hoa 3 vòng cánh + sao đêm ---------- */
const RINGS=[
  {n:5,len:52, w:26,k0:0,  k1:.18,grad:'petInner',vein:'rgba(150,110,50,.5)'},
  {n:7,len:80, w:38,k0:.18,k1:.45,grad:'petMid',  vein:'rgba(90,110,150,.45)'},
  {n:9,len:112,w:52,k0:.4, k1:.88,grad:'petOuter',vein:'rgba(70,95,140,.5)'},
];
const petals=[];
function petalPath(len,w){
  return `M0 8 C ${-w/2} -${(len*.32).toFixed(1)}, ${(-w*.34).toFixed(1)} -${(len*.8).toFixed(1)}, 0 -${len} `
       + `C ${(w*.34).toFixed(1)} -${(len*.8).toFixed(1)}, ${(w/2).toFixed(1)} -${(len*.32).toFixed(1)}, 0 8 Z`;
}
function buildFlower(){
  const host=$('petals');
  RINGS.forEach((r,ri)=>{
    const off=360/(2*r.n)*(ri%2?1:-1);
    for(let i=0;i<r.n;i++){
      const g=document.createElementNS(SVGNS,'g');
      const p=document.createElementNS(SVGNS,'path');
      p.setAttribute('d',petalPath(r.len,r.w));
      p.setAttribute('fill',`url(#${r.grad})`);
      p.setAttribute('stroke','rgba(255,255,255,.5)');
      p.setAttribute('stroke-width','1');
      g.appendChild(p);
      /* gân cánh hoa */
      const vg=document.createElementNS(SVGNS,'g');
      vg.setAttribute('stroke',r.vein);
      vg.setAttribute('stroke-width','.9');
      vg.setAttribute('fill','none');
      vg.setAttribute('opacity','.8');
      const mk=d=>{const v=document.createElementNS(SVGNS,'path');v.setAttribute('d',d);vg.appendChild(v)};
      mk(`M0 -2 L 0 -${(r.len*.82).toFixed(1)}`);
      [.3,.52,.72].forEach(f=>{
        const y=(r.len*f).toFixed(1), y2=(r.len*(f+.1)).toFixed(1);
        mk(`M0 -${y} C ${(r.w*.14).toFixed(1)} -${y2}, ${(r.w*.22).toFixed(1)} -${(r.len*(f+.16)).toFixed(1)}, ${(r.w*.3).toFixed(1)} -${(r.len*(f+.2)).toFixed(1)}`);
        mk(`M0 -${y} C -${(r.w*.14).toFixed(1)} -${y2}, -${(r.w*.22).toFixed(1)} -${(r.len*(f+.16)).toFixed(1)}, -${(r.w*.3).toFixed(1)} -${(r.len*(f+.2)).toFixed(1)}`);
      });
      g.appendChild(vg);
      host.appendChild(g);
      petals.push({
        g,
        base:i*360/r.n+off,
        jit:(i*53%9-4),
        k:r.k0+(r.k1-r.k0)*(i/r.n),
      });
      g.setAttribute('transform','rotate(0) scale(.28)');
      g.setAttribute('opacity','.3');
    }
  });
  /* sao đêm */
  const stars=$('stars');
  const starCols=['#f4e6c0','#cfdcec','#e8d9a8'];
  for(let i=0;i<46;i++){
    let x,y,tries=0;
    do{x=Math.random()*300;y=Math.random()*300;tries++}
    while(Math.hypot(x-150,y-150)<88&&tries<20);
    const c=document.createElementNS(SVGNS,'circle');
    c.setAttribute('cx',x.toFixed(1));c.setAttribute('cy',y.toFixed(1));
    c.setAttribute('r',(.6+Math.random()*1.1).toFixed(2));
    c.setAttribute('fill',starCols[i%3]);
    c.setAttribute('opacity',(.18+Math.random()*.5).toFixed(2));
    c.setAttribute('class','star');
    c.style.animationDelay=(Math.random()*3.4).toFixed(2)+'s';
    stars.appendChild(c);
  }
}
function bloom(p){
  p=Math.max(0,Math.min(1,p));
  for(const pt of petals){
    const local=Math.max(0,Math.min(1,(p-pt.k)/((1-pt.k)||1)));
    const e=1-Math.pow(1-local,3);
    pt.g.setAttribute('transform',`rotate(${(pt.base*e+pt.jit*e).toFixed(2)}) scale(${(.38+.62*e).toFixed(3)})`);
    pt.g.setAttribute('opacity',(.45+.55*e).toFixed(3));
  }
  $('coreGlow').setAttribute('opacity',(.25+.75*p).toFixed(3));
}

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
const bloomP=()=>st.phase==='work'?1-st.left/phaseSec('work'):1;

function pomoTick(){
  st.left--;
  if(st.left<=0){
    if(st.phase==='work'){
      st.round++;
      const long=st.round%cfg.pomo.rounds===0;
      st.phase=long?'long':'short';
      st.left=phaseSec(st.phase);
      spawnPetals(8);
      beep();toast(long?`Xong ${cfg.pomo.rounds} vòng — nghỉ dài ${cfg.pomo.long} phút nhé.`:`Xong một phiên — nghỉ ${cfg.pomo.short} phút nhé.`);
    }else{
      st.phase='work';st.left=phaseSec('work');
      beep();toast('Nghỉ xong — quay lại '+cfg.pomo.subject+' thôi, hoa lại bắt đầu nở.');
    }
  }
  renderPomo();
}

/* vài cánh hoa rơi nhẹ khi kết thúc phiên tập trung */
function spawnPetals(n){
  if(REDUCED)return;
  const garden=$('garden');
  for(let i=0;i<n;i++){
    const p=document.createElement('i');
    p.className='petal-fall';
    p.style.left=(8+Math.random()*84)+'%';
    p.style.setProperty('--dx',(Math.random()*90-45).toFixed(0)+'px');
    p.style.animationDuration=(3.4+Math.random()*2.8).toFixed(2)+'s';
    p.style.animationDelay=(Math.random()*1.4).toFixed(2)+'s';
    p.style.transform='scale('+(0.7+Math.random()*0.7).toFixed(2)+')';
    garden.appendChild(p);
    setTimeout(()=>p.remove(),8200);
  }
}
function renderPomo(){
  const mm=String(st.left/60|0).padStart(2,'0'),ss=String(st.left%60).padStart(2,'0');
  $('pomoTime').textContent=mm+':'+ss;
  bloom(bloomP());
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

/* INIT */
buildFlower();
renderPomoSubjects();
fillPomoSettings();
renderPomo();
