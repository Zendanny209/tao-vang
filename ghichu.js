/* =========================================================
   TÁO VÀNG — ghichu.js (trang Ghi chú)
   Sticky notes: thêm · tick hoàn thành · gỡ · lưu localStorage
   ========================================================= */
'use strict';

const noteHTML=(n,i)=>`<div class="note${n.done?' done':''}"
  style="background:hsl(${n.h} 92% ${n.l}%);transform:rotate(${n.r}deg)">
  <button class="note__txt" type="button" data-i="${i}"><span>${esc(n.text)}</span></button>
  <button class="note__x" type="button" data-x="${i}" aria-label="Gỡ ghi chú">✕</button>
</div>`;
const renderNotes=()=>{$('noteWall').innerHTML=cfg.todo.map(noteHTML).join('')};

$('noteWall').addEventListener('click',e=>{
  const x=e.target.closest('[data-x]');
  if(x){cfg.todo.splice(+x.dataset.x,1);saveState();renderNotes();toast('Đã gỡ ghi chú.');return}
  const t=e.target.closest('.note__txt');
  if(t){const n=cfg.todo[+t.dataset.i];n.done=!n.done;saveState();renderNotes();}
});
$('noteForm').addEventListener('submit',e=>{
  e.preventDefault();
  const text=$('noteInput').value.trim();if(!text)return;
  const n={text:text.slice(0,90),done:false};
  normalizeNote(n);cfg.todo.push(n);saveState();renderNotes();
  $('noteInput').value='';
});

renderNotes();
