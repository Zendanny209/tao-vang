/* =========================================================
   TÁO VÀNG — script.js v4 (CORE dùng chung mọi trang)
   1. Tài khoản cục bộ (đăng ký/đăng nhập, hash SHA-256, không server)
   2. Data model v3 — lịch thủ công: sáng (học trên trường),
      chiều 13:30–18:30, tối 19:00–01:00; dữ liệu RIÊNG theo tài khoản
   3. Chuyển trang mượt · 4. Widget chung (toast/modal/reset/reveal)
   Trang riêng: landing.js · lich.js · pomodoro.js · ghichu.js · taikhoan.js
   ========================================================= */
'use strict';

const $=id=>document.getElementById(id);

/* ---------------- 1. TÀI KHOẢN CỤC BỘ ----------------
   Mọi thứ nằm trong localStorage của máy bạn: mật khẩu chỉ lưu
   dưới dạng băm SHA-256 kèm salt ngẫu nhiên, không gửi đi đâu. */
const SESSION_KEY='surreal-study.session';
const USERS_KEY='surreal-study.users';
const LEGACY_KEY='surreal-study.v1';           // dữ liệu trước thời kỳ có tài khoản
const dataKey=()=>'surreal-study.v3:'+(localStorage.getItem(SESSION_KEY)||'guest');

const readJSON=(k,fb)=>{try{return JSON.parse(localStorage.getItem(k)||'null')??fb}catch(e){return fb}};
const users=()=>readJSON(USERS_KEY,{});
const sessionUser=()=>{
  const u=localStorage.getItem(SESSION_KEY);
  return (u&&users()[u])?u:null;               // phiên hỏng → xem như khách
};
async function hashPw(pw,salt){
  try{
    if(window.crypto&&crypto.subtle){
      const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+'::'+pw));
      return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
    }
  }catch(e){/* rơi xuống fallback */}
  let h=2166136261;const s=salt+'::'+pw;       // fallback cho trình duyệt rất cũ
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return 'f'+(h>>>0).toString(16)+s.length.toString(16);
}
const randSalt=()=>((window.crypto&&crypto.getRandomValues)
  ?[...crypto.getRandomValues(new Uint8Array(8))]
  :Array.from({length:8},()=>Math.random()*256|0)
).map(b=>b.toString(16).padStart(2,'0')).join('');

/* đăng ký → tạo mục users + chọn phiên; dữ liệu cũ (trước khi có tài khoản)
   sẽ được bộ loadState kế thừa một lần cho tài khoản đầu tiên */
async function registerUser(name,pw){
  name=name.trim();
  const db=users();
  if(db[name])return {ok:false,msg:'Tên đăng nhập đã có người dùng.'};
  const salt=randSalt();
  db[name]={salt,hash:await hashPw(pw,salt),created:Date.now()};
  localStorage.setItem(USERS_KEY,JSON.stringify(db));
  localStorage.setItem(SESSION_KEY,name);
  return {ok:true};
}
async function loginUser(name,pw){
  const db=users(),rec=db[name.trim()];
  if(!rec)return {ok:false,msg:'Không tìm thấy tài khoản này.'};
  if(await hashPw(pw,rec.salt)!==rec.hash)return {ok:false,msg:'Mật khẩu chưa đúng.'};
  localStorage.setItem(SESSION_KEY,name.trim());
  return {ok:true};
}
function logoutUser(){localStorage.removeItem(SESSION_KEY)}

/* vẽ khu tài khoản trên nav (mọi trang) + đổi tên thương hiệu theo phiên */
function renderNavUser(){
  const el=$('navUser');if(!el)return;
  const u=sessionUser();
  /* khi có tài khoản: góc trái thành "<tên>'s Schedule" thay cho "Táo Vàng" */
  const brand=document.querySelector('.nav__brandName');
  if(brand)brand.textContent=u?u+"'s Schedule":'Táo Vàng';
  el.innerHTML=u
    ?`<a class="nav__me" href="taikhoan.html" title="Tài khoản của ${esc(u)}">
        <span class="nav__meAva" aria-hidden="true">${esc(u[0].toUpperCase())}</span>${esc(u)}</a>`
    :`<a class="pill pill--small nav__login" href="taikhoan.html">Đăng nhập</a>`;
}

/* ---------------- 2. DATA MODEL v3 ----------------
   Người dùng tự xếp lịch (không còn tự phân bố):
   · school — buổi sáng, học trên trường (từng tiết một mục)
   · slots  — buổi chiều (13:30–18:30) & buổi tối (19:00–01:00 hôm sau)
              kind: 'self' tự học | 'extra' học thêm | 'busy' việc bận
              sec : 'chieu' | 'toi' */
const CHIEU={from:'13:30',to:'18:30'};
const TOI={from:'19:00',to:'01:00'};

const freshState=()=>({
  v:3,
  subjects:[
    {name:'Toán',      weight:2.0},
    {name:'Vật lý',    weight:1.5},
    {name:'Hóa học',   weight:1.5},
    {name:'Tiếng Anh', weight:1.0},
  ],
  school:[
    {day:1,start:'07:00',end:'11:30',subject:'Học trên trường'},
    {day:2,start:'07:00',end:'11:30',subject:'Học trên trường'},
    {day:3,start:'07:00',end:'11:30',subject:'Học trên trường'},
    {day:4,start:'07:00',end:'11:30',subject:'Học trên trường'},
    {day:5,start:'07:00',end:'11:30',subject:'Học trên trường'},
  ],
  slots:[ // vài mục mẫu để thấy dáng lịch — sửa/xóa thoải mái
    {sec:'chieu',day:2,start:'15:00',end:'16:30',kind:'self',subject:'Vật lý'},
    {sec:'chieu',day:4,start:'15:00',end:'16:30',kind:'self',subject:'Hóa học'},
    {sec:'chieu',day:0,start:'15:00',end:'16:15',kind:'self',subject:'Toán'},
    {sec:'toi',day:2,start:'19:30',end:'21:30',kind:'extra',subject:'Toán',note:'Thầy A'},
    {sec:'toi',day:4,start:'19:30',end:'21:30',kind:'extra',subject:'Toán',note:'Thầy A'},
    {sec:'toi',day:1,start:'21:45',end:'22:45',kind:'self',subject:'Tiếng Anh'},
  ],
  pomo:{work:25,short:5,long:15,rounds:4,subject:'Toán'},
  todo:[
    {text:'Ôn định lí Vi-et — làm 5 bài', done:false},
    {text:'Vẽ lại sơ đồ mạch + định luật Ôm', done:false},
    {text:'Học 20 từ mới Unit 3 — Tiếng Anh', done:false},
    {text:'Cân bằng 10 phương trình oxi-hóa', done:true},
  ],
});

/* mỗi note có màu/nghiêng riêng, lưu lại để reload không nhảy */
function normalizeNote(n){
  if(typeof n.h!=='number') n.h=46+Math.random()*10;
  if(typeof n.l!=='number') n.l=76+Math.random()*8;
  if(typeof n.r!=='number') n.r=+(Math.random()*6-3).toFixed(1);
  n.done=!!n.done; n.text=String(n.text||'').slice(0,90);
}

/* dữ liệu cũ (v1: tự phân bố, v2: buổi chiều tự phân bố) → v3 thủ công */
function migrateLegacy(s){
  const st=freshState();
  try{
    if(Array.isArray(s.subjects)&&s.subjects.length)st.subjects=s.subjects;
    if(Array.isArray(s.school)){
      const out=[];
      s.school.forEach(sc=>{
        if(Array.isArray(sc.days))
          sc.days.forEach(d=>out.push({day:d,start:sc.start,end:sc.end,subject:'Học trên trường'}));
        else if(sc.day!==undefined)
          out.push({day:sc.day,start:sc.start,end:sc.end,subject:sc.subject||'Học trên trường'});
      });
      if(out.length)st.school=out;
    }
    const slots=[];
    (s.extra||[]).forEach(x=>slots.push({
      sec:classifySec(x.start),day:x.day,start:x.start,end:x.end,
      kind:'extra',subject:x.subject,note:x.note||''}));
    (s.busy||[]).forEach(x=>{
      if(String(x.label).includes('Ăn'))return; // bữa ăn không thuộc 2 buổi mới — bỏ
      slots.push({sec:classifySec(x.start),day:x.day,start:x.start,end:x.end,kind:'busy',label:x.label||'Việc bận'});
    });
    (s.selfSlots||[]).forEach(()=>{}); // lịch tự sinh cũ không mang sang (v3 là thủ công)
    if(slots.length)st.slots=slots;
    if(s.pomo)st.pomo={...st.pomo,...s.pomo};
    if(Array.isArray(s.todo)&&s.todo.length)st.todo=s.todo;
  }catch(e){/* giữ mặc định */}
  return st;
}
const classifySec=start=>{const m=toMin(start);return (m>=1140||m<60)?'toi':'chieu'};

function loadState(){
  const own=readJSON(dataKey(),null);
  if(own&&own.v===3){
    const base=freshState();
    const st={...base,...own,pomo:{...base.pomo,...(own.pomo||{})}};
    st.slots=Array.isArray(st.slots)?st.slots:base.slots;
    st.school=Array.isArray(st.school)?st.school:base.school;
    st.todo=Array.isArray(st.todo)?st.todo:base.todo;
    st.todo.forEach(normalizeNote);
    return st;
  }
  /* chưa có dữ liệu riêng → kế thừa dữ liệu cũ (một lần) rồi gỡ bản cũ */
  const legacy=readJSON(LEGACY_KEY,null);
  if(legacy){
    const st=migrateLegacy(legacy);
    st.todo.forEach(normalizeNote);
    saveStateTo(st);
    localStorage.removeItem(LEGACY_KEY);
    return st;
  }
  const st=freshState();
  st.todo.forEach(normalizeNote);
  saveStateTo(st);
  return st;
}
function saveStateTo(st){localStorage.setItem(dataKey(),JSON.stringify(st))}
let cfg=loadState();
const saveState=()=>saveStateTo(cfg);

/* ---------------- helpers ---------------- */
const toMin=t=>{const[h,m]=t.split(':').map(Number);return h*60+m};
const fmtMin=m=>{const x=((m%1440)+1440)%1440;
  return String(x/60|0).padStart(2,'0')+':'+String(x%60).padStart(2,'0')};
const fmtHM=m=>(Math.round(m/6)/10).toString().replace('.',',')+' giờ';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DAY_FULL=['Chủ nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
const TODAY_D=new Date().getDay();
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;
const SLOT_KIND_NAME={self:'tự học',extra:'học thêm',busy:'việc bận'};

/* ---------------- 3. CHUYỂN TRANG MƯỢT ----------------
   Bấm link nội bộ → cả trang mờ dần + trượt nhẹ lên rồi mới sang trang;
   trang mớifade-in (pageIn). Tôn trọng prefers-reduced-motion. */
if(!REDUCED){
  document.documentElement.classList.add('page-anim');
  document.addEventListener('click',e=>{
    if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    const a=e.target.closest('a[href]');if(!a)return;
    if(a.target==='_blank'||a.hasAttribute('download'))return;
    const href=a.getAttribute('href');
    if(!href||href.startsWith('#')||href.startsWith('data:'))return;
    const url=new URL(a.href,location.href);
    if(url.origin!==location.origin)return;
    e.preventDefault();
    document.documentElement.classList.add('page-leaving');
    setTimeout(()=>{location.href=url.href},240);
  });
}

/* ---------------- 4. WIDGET CHUNG ---------------- */
let toastT=null;
function toast(msg){
  const t=$('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600);
}
function showMsg(title,text){
  if(!$('modalMsg'))return;
  $('msgTitle').textContent=title;$('msgText').textContent=text;
  $('modalMsg').hidden=false;
}
let confirmCb=null;
function askConfirm(msg,cb){
  if(!$('modalConfirm')){cb&&cb();return}
  confirmCb=cb;$('confirmMsg').textContent=msg;$('modalConfirm').hidden=false;
}
if($('btnYes'))$('btnYes').onclick=()=>{$('modalConfirm').hidden=true;if(confirmCb)confirmCb();confirmCb=null};
if($('btnNo')) $('btnNo').onclick =()=>{$('modalConfirm').hidden=true;confirmCb=null};

/* đóng modal: nút data-close · bấm nền · phím Esc */
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-close]');
  if(c){const m=$(c.dataset.close);if(m)m.hidden=true}
});
document.querySelectorAll('.overlay').forEach(o=>
  o.addEventListener('click',e=>{if(e.target===o)o.hidden=true}));
addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.overlay').forEach(o=>o.hidden=true);
});

/* reset dữ liệu CỦA TÀI KHOẢN HIỆN TẠI về lịch mẫu */
if($('btnReset'))$('btnReset').onclick=()=>askConfirm(
  'Xóa toàn bộ dữ liệu đã lưu của '+(sessionUser()||'khách')+' (lịch, ghi chú, Pomodoro) và trở về lịch mẫu?',
  ()=>{localStorage.removeItem(dataKey());location.reload()});
if($('btnHelp'))$('btnHelp').onclick=()=>{
  if($('modalWelcome'))$('modalWelcome').hidden=false;
  else showMsg('Táo Vàng','Mỗi mục có nút Thêm / Sửa / Xóa riêng — dữ liệu lưu ngay trong máy bạn, gắn với tài khoản đang đăng nhập.');
};

/* ngày trên trang bìa */
if($('heroDate')){
  const s=new Date().toLocaleDateString('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric'});
  $('heroDate').textContent=s.charAt(0).toUpperCase()+s.slice(1);
}

/* vẽ khu tài khoản trên nav */
renderNavUser();

/* fade-in khi load, so le 90ms — không phụ thuộc sự kiện cuộn nên luôn hiện */
document.documentElement.classList.add('js');
if(!REDUCED){
  document.querySelectorAll('.reveal').forEach((el,i)=>{
    el.style.transitionDelay=Math.min(i*90,450)+'ms';
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('in')));
  });
  setTimeout(()=>document.querySelectorAll('.reveal')
    .forEach(el=>el.style.transitionDelay=''),1600);
}else{
  document.querySelectorAll('.reveal').forEach(el=>el.classList.add('in'));
}

/* modal chào mừng — chỉ trang chính, lần đầu tiên */
if($('modalWelcome')&&!localStorage.getItem('surreal-study.seen')){
  $('modalWelcome').hidden=false;
  localStorage.setItem('surreal-study.seen','1');
}
