/* ═══════════════════════════════════════════════
   ALERTS — หน้าแจ้งเตือน Owner (กันลูกน้องโกง)
   เห็นเฉพาะ owner · โหลดจาก allAlerts (core.js loadAll)
═══════════════════════════════════════════════ */
var ALERT_TYPES={
  dup_lost :{icon:'💀',label:'เปิดซ้ำคนตาย', cls:'al-danger'},
  maybe_dup:{icon:'⚠️',label:'อาจเป็นลูกค้าซ้ำ',cls:'al-warn'}
};

// เวลาแบบไทยอ่านง่าย
function alTime(ts){
  if(!ts)return'';
  var d=new Date(ts);
  return d.toLocaleString('th-TH',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
}

function renderAlerts(){
  var el=document.getElementById('alerts-list');
  if(!el)return;
  if(!isOwner()){el.innerHTML='';return;}
  var unread=allAlerts.filter(function(a){return !a.is_read}).length;
  var head=document.getElementById('alerts-head-actions');
  if(head)head.innerHTML=unread?'<button class="btn btn-sm" onclick="markAllAlertsRead()">อ่านทั้งหมด ('+unread+')</button>':'';
  if(!allAlerts.length){el.innerHTML='<div class="empty">ยังไม่มีการแจ้งเตือน 🎉</div>';return;}
  el.innerHTML=allAlerts.map(function(a){
    var t=ALERT_TYPES[a.type]||{icon:'🔔',label:a.type||'แจ้งเตือน',cls:''};
    return '<div class="alert-card '+t.cls+(a.is_read?' read':'')+'">'+
      '<div class="al-top">'+
        '<span class="al-tag">'+t.icon+' '+esc(t.label)+'</span>'+
        '<span class="al-time">'+alTime(a.created_at)+'</span>'+
      '</div>'+
      '<div class="al-msg">'+esc(a.message||'')+'</div>'+
      '<div class="al-meta">โดย: <b>'+esc(a.actor_name||'—')+'</b>'+
        (a.person_name?' · ลูกค้า: '+esc(a.person_name):'')+'</div>'+
      (a.is_read?'':'<div class="al-act"><button class="btn btn-sm" onclick="markAlertRead(\''+a.id+'\')">อ่านแล้ว</button></div>')+
    '</div>';
  }).join('');
}

async function markAlertRead(id){
  var res=await _sb.from('alerts').update({is_read:true}).eq('id',id);
  if(res.error){toast('อัปเดตล้มเหลว: '+res.error.message,'err');return}
  var a=allAlerts.find(function(x){return x.id===id});if(a)a.is_read=true;
  renderAlerts();if(typeof renderNav==='function')renderNav();
}

async function markAllAlertsRead(){
  var ids=allAlerts.filter(function(a){return !a.is_read}).map(function(a){return a.id});
  if(!ids.length)return;
  var res=await _sb.from('alerts').update({is_read:true}).in('id',ids);
  if(res.error){toast('อัปเดตล้มเหลว: '+res.error.message,'err');return}
  allAlerts.forEach(function(a){a.is_read=true});
  renderAlerts();if(typeof renderNav==='function')renderNav();
}
