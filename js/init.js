/* ═══ INIT ═══ */
window.addEventListener('DOMContentLoaded',function(){
  var saved=localStorage.getItem(SESSION_KEY);
  if(saved){try{currentUser=JSON.parse(saved);startApp();}catch(e){showLoginScreen();}}
  else showLoginScreen();
});
