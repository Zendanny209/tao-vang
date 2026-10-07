/* =========================================================
   TÁO VÀNG — taikhoan.js (trang Tài khoản)
   Đăng nhập · Đăng ký · Đăng xuất · Xóa tài khoản
   (hash/salt và phiên do script.js đảm nhiệm)
   ========================================================= */
'use strict';

const cur=sessionUser();

/* nếu đã đăng nhập → hiện trạng thái, ẩn form */
if(cur){
  $('authGuest').hidden=true;
  $('authMe').hidden=false;
  $('meName').textContent=cur;
  const rec=users()[cur];
  if(rec&&rec.created)
    $('meSince').textContent='Tạo tài khoản ngày '+new Date(rec.created).toLocaleDateString('vi-VN');
}

/* ---- chuyển tab Đăng nhập / Tạo tài khoản ---- */
function switchTab(login){
  $('tabLogin').classList.toggle('active',login);
  $('tabRegister').classList.toggle('active',!login);
  $('formLogin').hidden=!login;
  $('formRegister').hidden=login;
  $('liErr').textContent='';$('rgErr').textContent='';
}
$('tabLogin').onclick=()=>switchTab(true);
$('tabRegister').onclick=()=>switchTab(false);

/* ---- đăng nhập ---- */
$('formLogin').addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('liName').value.trim(),pw=$('liPw').value;
  const err=$('liErr');
  if(!name||!pw){err.textContent='Nhập tên đăng nhập và mật khẩu nhé.';return}
  err.textContent='Đang kiểm tra…';
  const res=await loginUser(name,pw);
  if(!res.ok){err.textContent=res.msg;return}
  err.textContent='';
  toast('Chào mừng trở lại, '+name+'!');
  setTimeout(()=>{location.href='index.html'},500);
});

/* ---- đăng ký ---- */
$('formRegister').addEventListener('submit',async e=>{
  e.preventDefault();
  const name=$('rgName').value.trim(),pw=$('rgPw').value,pw2=$('rgPw2').value;
  const err=$('rgErr');
  if(name.length<3||name.length>20){err.textContent='Tên đăng nhập cần 3–20 ký tự.';return}
  if(!/^[\w .-]+$/.test(name)){err.textContent='Tên chỉ gồm chữ, số, dấu chấm, gạch dưới hoặc khoảng trắng.';return}
  if(pw.length<4){err.textContent='Mật khẩu cần ít nhất 4 ký tự.';return}
  if(pw!==pw2){err.textContent='Mật khẩu nhập lại chưa khớp.';return}
  err.textContent='Đang tạo tài khoản…';
  const res=await registerUser(name,pw);
  if(!res.ok){err.textContent=res.msg;return}
  err.textContent='';
  toast('Đã tạo tài khoản — lịch của bạn bắt đầu từ đây!');
  setTimeout(()=>{location.href='index.html'},500);
});

/* ---- đăng xuất ---- */
$('btnLogout').onclick=()=>{
  logoutUser();
  toast('Đã đăng xuất — hẹn gặp lại!');
  setTimeout(()=>{location.href='index.html'},500);
};

/* ---- xóa tài khoản (kèm toàn bộ dữ liệu của nó) ---- */
$('btnDelMe').onclick=()=>askConfirm(
  `Xóa tài khoản "${cur}" cùng TOÀN BỘ lịch, ghi chú đã lưu? Không thể hoàn tác.`,
  ()=>{
    const db=users();
    delete db[cur];
    localStorage.setItem(USERS_KEY,JSON.stringify(db));
    localStorage.removeItem(dataKey());
    logoutUser();
    toast('Đã xóa tài khoản.');
    setTimeout(()=>{location.href='index.html'},500);
  });
