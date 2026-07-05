/* ═══ INIT ═══ */
window.addEventListener('DOMContentLoaded',function(){
  var cached=null;
  try{cached=JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch(e){}
  if(cached&&cached.id)resumeSession(cached);   // ตรวจสถานะบัญชีกับ DB ก่อนเข้า (บัญชีถูกปิด = เด้งออก)
  else showLoginScreen();
});
