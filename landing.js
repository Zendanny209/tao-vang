/* =========================================================
   TÁO VÀNG — landing.js (chỉ trang chính)
   "Ước lượng tuần này" = cộng thẳng các mục bạn tự xếp (v3: thủ công)
   ========================================================= */
'use strict';

(function(){
  const study=cfg.slots.filter(s=>s.kind!=='busy');

  $('heroRows').innerHTML=cfg.subjects.map(s=>{
    const min=study.reduce((a,x)=>a+(x.subject===s.name?toMin(x.end)-toMin(x.start):0),0);
    return `<div class="wrow"><span>${esc(s.name)}</span><b>${fmtHM(min)}</b></div>`;
  }).join('');

  const total=study.reduce((a,x)=>a+toMin(x.end)-toMin(x.start),0);
  $('heroTotal').textContent=fmtHM(total);
})();
