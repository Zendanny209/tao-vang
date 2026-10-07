/* =========================================================
   TÁO VÀNG — lich.js v4 (trang Thời khóa biểu)
   Phần 1: buổi sáng — tiết học trên trường (CRUD)
   Phần 2: buổi chiều 13:30–18:30 — tự xếp (CRUD)
   Phần 3: buổi tối 19:00–01:00 hôm sau — tự xếp (CRUD)
   Toàn bộ lịch là THỦ CÔNG (bỏ tự phân bố theo yêu cầu)
   ========================================================= */
'use strict';

let editKind='self', editSec='chieu', editIdx=-1;

/* ---------------- RENDER ---------------- */
function renderSchoolGrid(){
  $('schoolGrid').innerHTML=[1,2,3,4,5,6,0].map(d=>{
    const list=cfg.school.filter(x=>x.day===d).sort((a,b)=>toMin(a.start)-toMin(b.start));
    return `<article class="day glass${d===TODAY_D?' day--today':''}">
      ${d===TODAY_D?'<span class="day__today">hôm nay</span>':''}
      <h3 class="day__name">${DAY_FULL[d]}</h3>
      ${list.map(x=>`<p class="evt"><i></i><span class="evt__t">${x.start}–${x.end}</span> ${esc(x.subject)}</p>`).join('')
        ||'<p class="day__empty">không học chính</p>'}
    </article>`;
  }).join('');
}

function renderSchoolList(){
  const box=$('schoolList');
  if(!cfg.school.length){
    box.innerHTML='<li class="xrow xrow--empty">Buổi sáng còn trống — thêm tiết đầu tiên nhé.</li>';
    return;
  }
  box.innerHTML=[...cfg.school]
    .map((x,i)=>({x,i}))
    .sort((a,b)=>(a.x.day-b.x.day)||(toMin(a.x.start)-toMin(b.x.start)))
    .map(({x,i})=>`<li class="xrow">
      <span class="xrow__day">${DAY_FULL[x.day]}</span>
      <span class="xrow__time">${x.start}–${x.end}</span>
      <b class="xrow__subj xrow__subj--dot">${esc(x.subject)}</b>
      <span class="xrow__acts">
        <button class="linklike" data-kind="school" data-act="edit" data-i="${i}" type="button">Sửa</button>
        <button class="linklike" data-kind="school" data-act="del" data-i="${i}" type="button">Xóa</button>
      </span>
    </li>`).join('');
}

/* lưới + danh sách cho một buổi ('chieu' | 'toi') */
function renderSec(sec){
  const evts=cfg.slots.filter(s=>s.sec===sec);
  const grid=$(sec+'Grid'), list=$(sec+'List');
  grid.innerHTML=[1,2,3,4,5,6,0].map(d=>{
    const day=evts.filter(x=>x.day===d).sort((a,b)=>toMin(a.start)-toMin(b.start));
    return `<article class="day glass${d===TODAY_D?' day--today':''}">
      ${d===TODAY_D?'<span class="day__today">hôm nay</span>':''}
      <h3 class="day__name">${DAY_FULL[d]}</h3>
      ${day.map(e=>`<p class="evt evt--${e.kind}"><i></i><span class="evt__t">${e.start}–${e.end}</span> ${esc(e.kind==='busy'?e.label:e.subject)}</p>`).join('')
        ||'<p class="day__empty">trống</p>'}
    </article>`;
  }).join('');
  const total=evts.filter(e=>e.kind!=='busy')
    .reduce((a,e)=>a+toMin(e.end)-toMin(e.start),0);
  $(sec+'Total').textContent=fmtHM(total);
  if(!evts.length){
    list.innerHTML='<li class="xrow xrow--empty">Chưa có mục nào — thêm cái đầu tiên nhé.</li>';
    return;
  }
  list.innerHTML=[...evts]
    .map((x,i)=>({x,i}))
    .sort((a,b)=>(a.x.day-b.x.day)||(toMin(a.x.start)-toMin(b.x.start)))
    .map(({x,i})=>{
      const chip=x.kind==='self'?'<span class="chip chip--self">tự học</span>'
        :x.kind==='extra'?'<span class="chip chip--extra">học thêm</span>'
        :'<span class="chip chip--busy">việc bận</span>';
      const warn=(x.kind==='extra'&&overlapsSchool(x))?'<small class="warn">⚠ trùng tiết sáng</small>':'';
      return `<li class="xrow">
        ${chip}
        <span class="xrow__day">${DAY_FULL[x.day]}</span>
        <span class="xrow__time">${x.start}–${x.end}</span>
        <b class="xrow__subj${x.kind!=='busy'?' xrow__subj--dot':''}">${esc(x.kind==='busy'?x.label:x.subject)}</b>
        ${x.note?`<small class="xrow__note">${esc(x.note)}</small>`:''}${warn}
        <span class="xrow__acts">
          <button class="linklike" data-kind="${x.kind}" data-sec="${sec}" data-act="edit" data-i="${i}" type="button">Sửa</button>
          <button class="linklike" data-kind="${x.kind}" data-sec="${sec}" data-act="del" data-i="${i}" type="button">Xóa</button>
        </span>
      </li>`;
    }).join('');
}

function overlapsSchool(x){
  const s=toMin(x.start), e=s<toMin(x.end)?toMin(x.end):toMin(x.end)+1440;
  return cfg.school.some(sc=>sc.day===x.day
    && toMin(sc.start)<e && toMin(sc.end)>s);
}

/* ---------------- RENDER FLOW ---------------- */
function renderAll(){
  renderSchoolGrid();renderSchoolList();
  renderSec('chieu');renderSec('toi');
}
const commit=()=>{saveState();renderAll()};

/* ---------------- MODAL CRUD ----------------
   kind: school | self | extra | busy · sec: 'chieu' | 'toi' */
const TITLES={school:'tiết buổi sáng',self:'tự học',extra:'học thêm',busy:'việc bận'};

function openEntry(kind,sec,i){
  editKind=kind;editSec=sec||'';editIdx=i;
  $('formError').textContent='';
  $('formTitle').textContent=(i>=0?'Sửa ':'Thêm ')+TITLES[kind]+(sec?` — buổi ${sec==='chieu'?'chiều':'tối'}`:'');
  /* hiện/ẩn đúng trường theo loại */
  $('fKindRow').hidden = kind==='school';
  $('fSubjectSelWrap').hidden = !(kind==='self'||kind==='extra');
  $('fSubjectTextWrap').hidden = kind!=='school';
  $('fLabelWrap').hidden = kind!=='busy';
  $('fNoteWrap').hidden = kind!=='extra';
  $('fSubject').innerHTML=cfg.subjects.map(s=>
    `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
  const rec=i>=0?(kind==='school'?cfg.school[i]:cfg.slots[i]):null;
  $('fKind').value=(kind==='self'||kind==='extra'||kind==='busy')?kind:'self';
  $('fDay').value=String(rec?rec.day:(TODAY_D||1));
  $('fStart').value=rec?rec.start:(kind==='school'?'07:00':sec==='toi'?'19:30':'15:00');
  $('fEnd').value=rec?rec.end:(kind==='school'?'08:30':sec==='toi'?'21:00':'16:30');
  $('fSubjectText').value=rec?(rec.subject||''):'';
  $('fSubject').value=(rec&&rec.subject)||cfg.subjects[0].name;
  $('fLabel').value=rec?(rec.label||''):'';
  $('fNote').value=rec?(rec.note||''):'';
  $('modalForm').hidden=false;
}

/* đổi Loại ngay trong form → đổi trường tương ứng */
$('fKind').addEventListener('change',()=>{
  const k=$('fKind').value;
  $('fSubjectSelWrap').hidden=!(k==='self'||k==='extra');
  $('fLabelWrap').hidden=k!=='busy';
  $('fNoteWrap').hidden=k!=='extra';
});

$('entryForm').addEventListener('submit',e=>{
  e.preventDefault();
  const day=+$('fDay').value,start=$('fStart').value,end=$('fEnd').value;
  const err=$('formError');
  if(!start||!end){err.textContent='Chưa chọn giờ bắt đầu / kết thúc.';return}
  if(toMin(end)===toMin(start)){err.textContent='Giờ kết thúc phải khác giờ bắt đầu.';return}
  if(editKind==='school'&&toMin(end)<toMin(start)){
    err.textContent='Tiết buổi sáng kết thúc trong cùng ngày nhé.';return}
  if(editKind==='school'){
    const rec={day,start,end,subject:$('fSubjectText').value.trim()||'Học trên trường'};
    if(editIdx>=0)cfg.school[editIdx]=rec;else cfg.school.push(rec);
  }else{
    const kind=$('fKind').value;
    let rec;
    if(kind==='busy')rec={sec:editSec,day,start,end,kind,label:$('fLabel').value.trim()||'Việc bận'};
    else rec={sec:editSec,day,start,end,kind,subject:$('fSubject').value,note:$('fNote').value.trim()};
    if(editIdx>=0)cfg.slots[editIdx]=rec;else cfg.slots.push(rec);
  }
  $('modalForm').hidden=true;commit();
  toast(`Đã lưu ${TITLES[editKind]} — lịch của bạn vừa được cập nhật.`);
});

/* nút Thêm của từng buổi */
$('btnAddSchool').onclick=()=>openEntry('school','',-1);
$('btnAddChieu').onclick=()=>openEntry('self','chieu',-1);
$('btnAddToi').onclick=()=>openEntry('self','toi',-1);

/* Sửa/Xóa (uỷ quyền trên mọi danh sách) */
document.querySelectorAll('#schoolList,#chieuList,#toiList').forEach(list=>
  list.addEventListener('click',e=>{
    const b=e.target.closest('button[data-act]');if(!b)return;
    const kind=b.dataset.kind,sec=b.dataset.sec||'',i=+b.dataset.i;
    if(b.dataset.act==='edit'){openEntry(kind,sec,i);return}
    const x=kind==='school'?cfg.school[i]:cfg.slots[i];
    const name=kind==='busy'?x.label:(x.subject||x.label);
    askConfirm(`Gỡ ${TITLES[kind]} "${name}" — ${DAY_FULL[x.day]} ${x.start}–${x.end}?`,()=>{
      if(kind==='school')cfg.school.splice(i,1);else cfg.slots.splice(i,1);
      commit();toast(`Đã gỡ ${TITLES[kind]}.`);
    });
  }));

/* INIT */
renderAll();
