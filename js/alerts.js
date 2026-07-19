/* ═══════════════════════════════════════════════
   ALERTS — หน้าแจ้งเตือน Owner (กันลูกน้องโกง)
   เห็นเฉพาะ owner · โหลดจาก allAlerts (core.js loadAll)
═══════════════════════════════════════════════ */
var ALERT_TYPES={
  dup_lost    :{icon:'💀',label:'เปิดซ้ำคนตาย', cls:'al-danger'},
  dup_branch  :{icon:'⛔',label:'เปิดซ้ำบ้านเดียวกัน',cls:'al-danger'},
  maybe_dup   :{icon:'⚠️',label:'อาจเป็นลูกค้าซ้ำ',cls:'al-warn'},
  multi_branch:{icon:'🏠',label:'ลูกค้ามีหลายบ้าน',cls:'al-warn'}
};

// รีเฟรชหน้าแจ้งเตือน + badge บนเมนู หลังทุก mutation
function refreshAlertsUI(){renderAlerts();if(typeof renderNav==='function')renderNav()}

// เข้าหน้าแจ้งเตือน → วาดจากที่มีก่อน (ขึ้นทันที) แล้วโหลดลิสต์เต็มตามหลัง
// (ตอนเปิดแอปโหลดมาเฉพาะที่ยังไม่อ่าน เพื่อให้เปิดแอปไว — รายการที่อ่านแล้วมาครบตรงนี้)
async function loadFullAlerts(){
  renderAlerts();
  if(!isOwner())return;
  var r=await _sb.from('alerts').select('*').order('created_at',{ascending:false});
  if(!r.error&&r.data){allAlerts=r.data;refreshAlertsUI();}
}

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
  var readN=allAlerts.length-unread;
  var head=document.getElementById('alerts-head-actions');
  if(head)head.innerHTML=
    (unread?'<button class="btn btn-sm" onclick="markAllAlertsRead()">อ่านทั้งหมด ('+unread+')</button>':'')+
    (readN?'<button class="btn btn-sm btn-red" onclick="clearReadAlerts()">ลบที่อ่านแล้ว ('+readN+')</button>':'');
  if(!allAlerts.length){el.innerHTML='<div class="empty">ยังไม่มีการแจ้งเตือน 🎉</div>';return;}
  el.innerHTML=allAlerts.map(function(a){
    var t=ALERT_TYPES[a.type]||{icon:'🔔',label:a.type||'แจ้งเตือน',cls:''};
    var acts='';
    if(a.person_id&&loanIdForPerson(a.person_id))acts+='<button class="btn btn-sm" onclick="openAlertPerson(\''+a.person_id+'\')">ดูลูกค้า</button>';
    // maybe_dup: ปุ่มดูคนที่ระบบคิดว่าซ้ำ (คนแรก)
    var cand=a.meta&&a.meta.candidate_ids;
    if(cand&&cand.length&&loanIdForPerson(cand[0]))acts+='<button class="btn btn-sm btn-ghost" onclick="openAlertPerson(\''+cand[0]+'\')">ดูคนที่ซ้ำ</button>';
    if(!a.is_read)acts+='<button class="btn btn-sm btn-ghost" onclick="markAlertRead(\''+a.id+'\')">อ่านแล้ว</button>';
    acts+='<button class="btn btn-sm btn-ghost" onclick="deleteAlert(\''+a.id+'\')">ลบ</button>';
    return '<div class="alert-card '+t.cls+(a.is_read?' read':'')+'">'+
      '<div class="al-top">'+
        '<span class="al-tag">'+t.icon+' '+esc(t.label)+'</span>'+
        '<span class="al-time">'+alTime(a.created_at)+'</span>'+
      '</div>'+
      '<div class="al-msg">'+esc(a.message||'')+'</div>'+
      '<div class="al-meta">โดย: <b>'+esc(a.actor_name||'—')+'</b>'+
        (a.person_name?' · ลูกค้า: '+esc(a.person_name):'')+'</div>'+
      '<div class="al-act">'+acts+'</div>'+
    '</div>';
  }).join('');
}

// หาสัญญา (loan) ล่าสุดของ person — ใช้เปิดหน้ารายละเอียด
function loanIdForPerson(personId){
  var ls=allCustomers.filter(function(c){return c.person_id===personId});
  if(!ls.length)return null;
  var latest=ls.reduce(function(a,b){
    if((a.start_date||'')!==(b.start_date||''))return (a.start_date||'')>(b.start_date||'')?a:b;
    return (a.seq||0)>(b.seq||0)?a:b;
  });
  return latest.id;
}
function openAlertPerson(personId){
  var id=loanIdForPerson(personId);
  if(!id){toast('ไม่พบลูกค้ารายนี้แล้ว','err');return}
  openDetail(id);
}

async function markAlertRead(id){
  var res=await _sb.from('alerts').update({is_read:true}).eq('id',id);
  if(res.error){toast('อัปเดตล้มเหลว: '+res.error.message,'err');return}
  var a=allAlerts.find(function(x){return x.id===id});if(a)a.is_read=true;
  refreshAlertsUI();
}

async function markAllAlertsRead(){
  var ids=allAlerts.filter(function(a){return !a.is_read}).map(function(a){return a.id});
  if(!ids.length)return;
  var res=await _sb.from('alerts').update({is_read:true}).in('id',ids);
  if(res.error){toast('อัปเดตล้มเหลว: '+res.error.message,'err');return}
  allAlerts.forEach(function(a){a.is_read=true});
  refreshAlertsUI();
}

async function deleteAlert(id){
  var res=await _sb.from('alerts').delete().eq('id',id);
  if(res.error){toast('ลบล้มเหลว: '+res.error.message,'err');return}
  allAlerts=allAlerts.filter(function(a){return a.id!==id});
  refreshAlertsUI();
}

// ลบเฉพาะที่อ่านแล้ว — กันตารางบวม (ไม่แตะของที่ยังไม่ตรวจ)
async function clearReadAlerts(){
  var ids=allAlerts.filter(function(a){return a.is_read}).map(function(a){return a.id});
  if(!ids.length)return;
  var ok=await showConfirm({icon:'🗑️',title:'ลบการแจ้งเตือน',msg:'ลบที่อ่านแล้ว '+ids.length+' รายการ? (ที่ยังไม่อ่านจะไม่ถูกลบ)',okText:'ลบ',okClass:'btn-red'});
  if(!ok)return;
  var res=await _sb.from('alerts').delete().in('id',ids);
  if(res.error){toast('ลบล้มเหลว: '+res.error.message,'err');return}
  allAlerts=allAlerts.filter(function(a){return !a.is_read});
  toast('ลบแล้ว '+ids.length+' รายการ','ok');
  refreshAlertsUI();
}
