/* =========================================================
   TÁO VÀNG — ocr.js (trang Thời khóa biểu)
   Nhập nhanh lịch buổi sáng từ ẢNH thời khóa biểu:
   1. Tải Tesseract.js từ CDN (lần đầu) — OCR tiếng Việt chạy trong trình duyệt.
   2. Dò cấu trúc bảng: cột (hoặc hàng) là thứ T2–T7, hàng (cột) là tiết 1–5.
   3. Hiện bảng kết quả CHỈNH SỬA ĐƯỢC — người dùng rà lại rồi mới áp dụng.
   Giờ từng tiết là cố định theo quy ước của người dùng (mảng TIET_TIMES).
   ========================================================= */
'use strict';

/* giờ cố định: tiết 1 bắt đầu 7:00, tiết 1→2 nghỉ 10', các tiết sau nghỉ 5' */
const TIET_TIMES=[
  {n:1,start:'07:00',end:'07:45'},
  {n:2,start:'07:55',end:'08:40'},
  {n:3,start:'08:45',end:'09:30'},
  {n:4,start:'09:35',end:'10:20'},
  {n:5,start:'10:25',end:'11:10'},
];
const OCR_DAYS=[1,2,3,4,5,6,0]; // T2 → CN
const OCR_DAY_SHORT={0:'CN',1:'T2',2:'T3',3:'T4',4:'T5',5:'T6',6:'T7'};

/* ---- tiện ích chữ ---- */
const deacc=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D');
const ocrNorm=s=>deacc(s).toLowerCase().replace(/[^a-z0-9:]/g,'');

/* tên môn chuẩn hóa: gốc không dấu không khoảng trắng → tên hiển thị */
const OCR_SUBJECTS={
  toan:'Toán', van:'Ngữ văn', nguvan:'Ngữ văn', vanhoc:'Văn học',
  ly:'Vật lý', vatly:'Vật lý', lylythuyet:'Vật lý',
  hoa:'Hóa học', hoahoc:'Hóa học',
  anh:'Tiếng Anh', tienganh:'Tiếng Anh', ngoaingu:'Ngoại ngữ',
  su:'Lịch sử', lichsu:'Lịch sử',
  dia:'Địa lí', diali:'Địa lí', dialy:'Địa lí', dulich:'Du lịch',
  sinh:'Sinh học', sinhhoc:'Sinh học',
  gdcd:'GDCD', gdtc:'GDTC', congdan:'GDCD', gdqp:'GDQP',
  tin:'Tin học', tinhoc:'Tin học', congnghe:'Công nghệ', cn:'Công nghệ',
  theduc:'Thể dục', thduc:'Thể dục', nhac:'Âm nhạc', amnhac:'Âm nhạc', mythuat:'Mĩ thuật', mt:'Mĩ thuật',
  chaoco:'Chào cờ', saolop:'Sinh hoạt lớp',
  hodat:'Hoạt động trải nghiệm', hdtm:'Hoạt động trải nghiệm', trghiem:'Trải nghiệm', trainghiem:'Trải nghiệm', hndhn:'Trải nghiệm — hướng nghiệp',
  shgd:'Giáo dục kinh tế & pháp luật', gdktepl:'Giáo dục kinh tế & pháp luật', kinhtephapluat:'Giáo dục kinh tế & pháp luật',
};
function ocrSubject(raw){
  const n=ocrNorm(raw);
  if(!n)return '';
  if(OCR_SUBJECTS[n])return OCR_SUBJECTS[n];
  /* OCR hay sai vài chữ cái — khớp theo tiền tố (vd "sinhhooc" → Sinh học) */
  const keys=Object.keys(OCR_SUBJECTS).sort((a,b)=>b.length-a.length);
  for(const k of keys){
    if(k.length>=3&&n.startsWith(k))return OCR_SUBJECTS[k];
  }
  return raw.trim().replace(/[_]+/g,' ').replace(/\s+/g,' ').replace(/^./,c=>c.toUpperCase());
}

/* nhận diện một từ có phải tên thứ không (kể cả "Thứ"+"2" tách 2 từ) */
function ocrDayOf(n,nextDigit){
  let m;
  /* Thứ d → ngày d−1 (Thứ 2=1 … Thứ 7=6, Chủ nhật=0) */
  if(m=n.match(/^th[a-z]*([2-7])$/))return +m[1]-1; // "thu2","thit2","thur2"… (OCR sai chính tả)
  if(nextDigit!==null&&nextDigit>=2&&nextDigit<=7)return nextDigit-1; // "Thứ"(sai chính tả)+"2"
  if(n==='thuhai')return 1; if(n==='thuba')return 2; if(n==='thutu')return 3;
  if(n==='thunam')return 4; if(n==='thusau')return 5; if(n==='thubay')return 6;
  if(n==='cn'||n==='chunhat')return 0;
  return null;
}
function ocrPeriodOf(n){
  const m=n.match(/^tiet([1-9])$/);
  return m?+m[1]:null;
}
const OCR_START_TO_PERIOD={'7:00':1,'700':1,'7h00':1,'7:55':2,'755':2,'7h55':2,'8:45':3,'845':3,'8h45':3,'9:35':4,'935':4,'9h35':4,'10:25':5,'1025':5,'10h25':5};

/* ---- tải Tesseract.js từ CDN (lười, lần đầu) ---- */
let ocrLibLoading=null;
function loadTesseract(){
  if(window.Tesseract)return Promise.resolve();
  if(ocrLibLoading)return ocrLibLoading;
  ocrLibLoading=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload=res;
    s.onerror=()=>rej(new Error('Không tải được bộ đọc chữ từ CDN — kiểm tra mạng.'));
    document.head.appendChild(s);
  });
  return ocrLibLoading;
}

/* ---- tiền xử lý: phóng to + xám + ngưỡng Otsu tự tính + tự đảo màu ảnh nền tối ---- */
function ocrPreprocess(file){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{
      const scale=Math.min(2,Math.max(1,1600/img.width));
      const c=document.createElement('canvas');
      c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);
      const ctx=c.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
      ctx.drawImage(img,0,0,c.width,c.height);
      const d=ctx.getImageData(0,0,c.width,c.height);
      const px=d.data,n=px.length/4;
      /* xám */
      const gray=new Float32Array(n);
      let mean=0;
      for(let i=0;i<n;i++){
        const g=px[i*4]*.299+px[i*4+1]*.587+px[i*4+2]*.114;
        gray[i]=g;mean+=g;
      }
      mean/=n;
      /* ngưỡng Otsu — tự thích ứng từng ảnh */
      const hist=new Array(256).fill(0);
      for(let i=0;i<n;i++)hist[Math.min(255,Math.round(gray[i]))]++;
      let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
      let sumB=0,wB=0,maxVar=0,thr=170;
      for(let t=0;t<256;t++){
        wB+=hist[t];if(!wB)continue;
        const wF=n-wB;if(!wF)break;
        sumB+=t*hist[t];
        const mB=sumB/wB,mF=(sum-sumB)/wF;
        const v=wB*wF*(mB-mF)*(mB-mF);
        if(v>maxVar){maxVar=v;thr=t}
      }
      const invert=mean<115; // nền tối (ảnh chụp màn hình dark mode) → đảo màu
      for(let i=0;i<n;i++){
        let v=gray[i]>thr?255:0;
        if(invert)v=255-v;
        px[i*4]=px[i*4+1]=px[i*4+2]=v;
      }
      ctx.putImageData(d,0,0);
      /* dải header màu (thường trên TKB: chữ TRẮNG trên nền CYAN) sau nhị phân thành
         băng TỐI — lật từng dòng đang tối thành sáng để chữ đen trên trắng, OCR đọc được */
      const W=c.width,H=c.height;
      for(let y=0;y<H;y++){
        let dark=0;
        for(let x=0;x<W;x++)if(px[(y*W+x)*4]===0)dark++;
        if(dark>W*0.55){
          for(let x=0;x<W;x++){const i=(y*W+x)*4;px[i]=255-px[i];px[i+1]=255-px[i+1];px[i+2]=255-px[i+2]}
        }
      }
      ctx.putImageData(d,0,0);
      res(c.toDataURL('image/png'));
    };
    img.onerror=()=>rej(new Error('Không đọc được file ảnh.'));
    img.src=URL.createObjectURL(file);
  });
}

/* ---- gom chữ thành dòng (theo tung độ) ---- */
function ocrCollectWords(data){
  let words=[];
  if(Array.isArray(data.words)&&data.words.length)words=data.words;
  else (data.blocks||[]).forEach(b=>(b.paragraphs||[]).forEach(p=>(p.lines||[]).forEach(l=>(l.words||[]).forEach(w=>words.push(w)))));
  return words.map(w=>({
    t:w.text||'', n:ocrNorm(w.text||''),
    x0:w.bbox.x0,x1:w.bbox.x1,y0:w.bbox.y0,y1:w.bbox.y1,
    x:(w.bbox.x0+w.bbox.x1)/2,y:(w.bbox.y0+w.bbox.y1)/2,
  })).filter(w=>w.n);
}
function ocrGroupLines(words){
  const sorted=[...words].sort((a,b)=>a.y-b.y);
  const lines=[];
  sorted.forEach(w=>{
    const line=lines.find(L=>Math.abs(L.y-w.y)<(w.y1-w.y0)*0.7+6);
    if(line){line.words.push(w);line.y=(line.y*(line.words.length-1)+w.y)/line.words.length;}
    else lines.push({y:w.y,words:[w]});
  });
  lines.forEach(L=>L.words.sort((a,b)=>a.x-b.x));
  return lines;
}

/* ---- quét token từ một dòng: tên thứ (kể cả cặp "Thứ"+"2") và nhãn tiết (cặp "Tiết"+"1") ---- */
function ocrScanLine(line){
  const out=[];const W=line.words;
  for(let i=0;i<W.length;i++){
    const w=W[i],nxt=W[i+1];
    const nd=(nxt&&/^\d$/.test(nxt.n))?+nxt.n:null;
    const d=ocrDayOf(w.n,nd);
    if(d!==null){
      out.push({type:'day',day:d,x:(nd!==null&&nxt)?(w.x+nxt.x)/2:w.x,y:w.y,words:[w].concat(nd!==null?[nxt]:[])});
      if(nd!==null)i++;
      continue;
    }
    const p=ocrPeriodOf(w.n);
    if(p){out.push({type:'period',p,x:w.x,y:w.y,words:[w]});continue;}
    if(w.n==='tiet'&&nxt&&/^[1-9]$/.test(nxt.n)){
      out.push({type:'period',p:+nxt.n,x:(w.x+nxt.x)/2,y:w.y,words:[w,nxt]});
      i++;continue;
    }
    /* TKB kiểu cột số: ô trái chỉ ghi 1..5 (không chữ "Tiết") */
    if(/^[1-5]$/.test(w.n)){out.push({type:'period',p:+w.n,x:w.x,y:w.y,words:[w]});continue;}
  }
  return out;
}

/* ---- dò cấu trúc bảng ---- */
function ocrDetect(lines){
  const dayTokens=[],periodTokens=[],consumed=new Set();
  lines.forEach((L,li)=>ocrScanLine(L).forEach(t=>{
    t.line=li;t.words.forEach(w=>consumed.add(w));
    dayTokens.push(t);periodTokens.push(t);
  }));
  const days=dayTokens.filter(t=>t.type==='day');
  const periods=periodTokens.filter(t=>t.type==='period');

  const spread=(arr,k)=>arr.length?Math.max(...arr.map(o=>o[k]))-Math.min(...arr.map(o=>o[k])):0;

  /* ngày: một dòng chứa ≥3 tên thứ → ngày là CỘT;否则 nếu dàn DỌC → ngày là HÀNG */
  let dayCols=null,dayRows=null,headerY=null,headerX=null;
  const byLine={};
  days.forEach(t=>{(byLine[t.line]=byLine[t.line]||[]).push(t)});
  let bestLi=null,bestN=0;
  Object.keys(byLine).forEach(li=>{if(byLine[li].length>bestN){bestN=byLine[li].length;bestLi=li}});
  if(bestN>=3){
    dayCols=byLine[bestLi].map(t=>({day:t.day,x:t.x}));
    headerY=days.find(t=>t.line==bestLi).y;
  }else if(days.length>=3&&spread(days,'y')>spread(days,'x')){
    dayRows=days.map(t=>({day:t.day,y:t.y}));
    headerX=days.reduce((a,t)=>a+t.x,0)/days.length;
  }

  /* tiết: token dàn DỌC → tiết là HÀNG; dàn NGANG → tiết là CỘT */
  let periodRows=null,periodCols=null;
  if(periods.length>=2){
    if(spread(periods,'y')>spread(periods,'x'))periodRows=periods.map(t=>({p:t.p,y:t.y}));
    else periodCols=periods.map(t=>({p:t.p,x:t.x}));
  }
  return {dayCols,dayRows,periodRows,periodCols,headerY,headerX,consumed};
}

/* ---- gán chữ còn lại vào ô (ngày, tiết) ---- */
function ocrBuildGrid(words,det){
  const grid={};
  OCR_DAYS.forEach(d=>grid[d]={});
  const isLabel=w=>det.consumed.has(w)||                                   // từ nhãn đã quét
    ocrPeriodOf(w.n)||w.n==='tiet'||OCR_START_TO_PERIOD[w.n]!==undefined|| // nhãn "Tiết n" / giờ
    (det.headerY!==null&&det.headerY!==undefined&&Math.abs(w.y-det.headerY)<32); // dòng tiêu đề thứ
  const body=words.filter(w=>w.n&&!isLabel(w));

  if(det.dayCols&&det.periodRows){
    const cols=[...det.dayCols].sort((a,b)=>a.x-b.x);
    const rows=[...det.periodRows].sort((a,b)=>a.y-b.y);
    const colGap=cols.length>1?(cols[cols.length-1].x-cols[0].x)/(cols.length-1):160;
    const rowGap=rows.length>1?(rows[rows.length-1].y-rows[0].y)/(rows.length-1):90;
    body.forEach(w=>{
      let bc=null,bdx=1e9;
      cols.forEach(o=>{const dx=Math.abs(w.x-o.x);if(dx<bdx){bdx=dx;bc=o}});
      let br=null,bdy=1e9;
      rows.forEach(o=>{const dy=Math.abs(w.y-o.y);if(dy<bdy){bdy=dy;br=o}});
      if(bc&&br&&bdx<=Math.max(70,colGap*0.5)&&bdy<=Math.max(60,rowGap*0.6)){
        grid[bc.day]=grid[bc.day]||{};
        grid[bc.day][br.p]=(grid[bc.day][br.p]?grid[bc.day][br.p]+' ':'')+w.t;
      }
    });
  }else if(det.dayRows&&det.periodCols){
    const rows=[...det.dayRows].sort((a,b)=>a.y-b.y);
    const cols=[...det.periodCols].sort((a,b)=>a.x-b.x);
    const rowGap=rows.length>1?(rows[rows.length-1].y-rows[0].y)/(rows.length-1):90;
    const colGap=cols.length>1?(cols[cols.length-1].x-cols[0].x)/(cols.length-1):160;
    body.forEach(w=>{
      let br=null,bdy=1e9;
      rows.forEach(o=>{const dy=Math.abs(w.y-o.y);if(dy<bdy){bdy=dy;br=o}});
      let bc=null,bdx=1e9;
      cols.forEach(o=>{const dx=Math.abs(w.x-o.x);if(dx<bdx){bdx=dx;bc=o}});
      if(bc&&br&&bdx<=Math.max(70,colGap*0.5)&&bdy<=Math.max(60,rowGap*0.6)){
        grid[br.day]=grid[br.day]||{};
        grid[br.day][bc.p]=(grid[br.day][bc.p]?grid[br.day][bc.p]+' ':'')+w.t;
      }
    });
  }else return null;

  /* chuẩn hóa tên môn */
  OCR_DAYS.forEach(d=>{for(const p in grid[d])grid[d][p]=ocrSubject(grid[d][p]);});
  return grid;
}

/* ---- UI ---- */
let ocrGridData=null;
function ocrSetStatus(t){$('ocrStatus').textContent=t||''}
function ocrProgress(p){
  const el=$('ocrProgress');
  if(p===null){el.hidden=true;return}
  el.hidden=false;
  el.firstElementChild.style.width=Math.round(p*100)+'%';
}
function ocrRenderPreview(grid){
  ocrGridData=grid;
  const tbl=$('ocrGrid');
  let html='<tr><th></th>'+OCR_DAYS.map(d=>`<th>${OCR_DAY_SHORT[d]}</th>`).join('')+'</tr>';
  TIET_TIMES.forEach(t=>{
    html+=`<tr><td>Tiết ${t.n}<br><small>${t.start}–${t.end}</small></td>`+
      OCR_DAYS.map(d=>`<td><input class="ocr__cell" data-day="${d}" data-p="${t.n}" value="${(grid[d]&&grid[d][t.n]||'').replace(/"/g,'&quot;')}" placeholder="—"></td>`).join('')+'</tr>';
  });
  tbl.innerHTML=html;
  $('ocrPreview').hidden=false;
}
function ocrReadPreview(){
  const grid={};
  OCR_DAYS.forEach(d=>grid[d]={});
  document.querySelectorAll('.ocr__cell').forEach(inp=>{
    const v=inp.value.trim();
    if(v){grid[+inp.dataset.day]=grid[+inp.dataset.day]||{};grid[+inp.dataset.day][+inp.dataset.p]=v}
  });
  return grid;
}
function ocrApply(){
  const grid=ocrReadPreview();
  const entries=[];
  let days=0;
  OCR_DAYS.forEach(d=>{
    let has=false;
    TIET_TIMES.forEach(t=>{
      const s=grid[d]&&grid[d][t.n];
      if(s){entries.push({day:d,start:t.start,end:t.end,subject:s});has=true}
    });
    if(has)days++;
  });
  cfg.school=entries;
  commit();
  toast(`Đã điền lịch buổi sáng của ${days} ngày từ ảnh — rà lại danh sách bên dưới nhé.`);
  $('ocrPreview').hidden=true;
  ocrSetStatus('');
}

async function ocrRun(file){
  const btn=$('btnOcrPick');
  btn.disabled=true;
  try{
    ocrSetStatus('Tải bộ đọc chữ tiếng Việt (lần đầu ~ vài MB)…');
    ocrProgress(0.05);
    await loadTesseract();
    ocrSetStatus('Đang xử lý ảnh…');
    const image=await ocrPreprocess(file);
    ocrProgress(0.15);
    const worker=await Tesseract.createWorker('vie',1,{
      logger:m=>{
        if(m.status==='recognizing text')ocrProgress(0.2+m.progress*0.75);
        else if(m.status&&m.progress)ocrProgress(Math.min(0.2,m.progress*0.15));
      },
    });
    ocrSetStatus('Đang đọc chữ…');
    const {data}=await worker.recognize(image,{}, {text:true,blocks:true});
    await worker.terminate();
    ocrProgress(null);
    const words=ocrCollectWords(data);
    if(words.length<6){ocrSetStatus('Không đọc được đủ chữ từ ảnh — thử ảnh sáng, rõ hơn nhé.');return}
    const lines=ocrGroupLines(words);
    const det=ocrDetect(lines);
    window.__ocrDebug={words,lines,det}; // phục vụ gỡ lỗi
    const grid=ocrBuildGrid(words,det);
    if(!grid){ocrSetStatus('Không nhận ra cấu trúc bảng (thiếu tiêu đề Thứ/Tiết) — điền tay giúp web nhé, hoặc chụp ảnh thẳng hơn.');return}
    const filled=OCR_DAYS.reduce((a,d)=>a+Object.keys(grid[d]||{}).filter(p=>grid[d][p]).length,0);
    if(!filled){ocrSetStatus('Đọc được chữ nhưng không khớp ô nào — thử chụp ảnh thẳng, đủ khung bảng.');return}
    ocrSetStatus(`Đọc được ${filled} ô — rà lại trước khi áp dụng:`);
    ocrRenderPreview(grid);
  }catch(e){
    ocrProgress(null);
    ocrSetStatus(e.message||'Có lỗi khi đọc ảnh.');
  }finally{
    btn.disabled=false;
  }
}

/* ---- nối sự kiện ---- */
$('btnOcrPick').onclick=()=> $('ocrFile').click();
$('ocrFile').addEventListener('change',e=>{
  const f=e.target.files[0];
  if(f)ocrRun(f);
  e.target.value='';
});
$('btnOcrApply').onclick=ocrApply;
$('btnOcrCancel').onclick=()=>{$('ocrPreview').hidden=true;ocrSetStatus('')};
