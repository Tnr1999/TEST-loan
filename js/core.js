/* ═══════════════════════════════════════════════
   CONFIG — แก้ 2 ค่านี้ให้ตรงกับ Supabase project
═══════════════════════════════════════════════ */
var SUPABASE_URL = 'https://ehtocpsupbbihikilton.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVodG9jcHN1cGJiaWhpa2lsdG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MzE5OTgsImV4cCI6MjA5NTAwNzk5OH0.xH7sRG4Qsg0SslP7_PCbsNIy_KDTVd7fC8JbxhjzdoI';

var _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
var SESSION_KEY = 'loan_session_v1';

/* ═══ STATE ═══ */
var currentUser = null;
var allBranches = [], allCustomers = [], allRecords = [], allUsers = [], allUserBranches = [];
var allGroups = [], allPersons = [], allLoans = [], allUserGroups = [], allDisbursements = [];
var allAlerts = []; // แจ้งเตือน Owner (กันโกง) — โหลดเฉพาะ owner
var currentDetailId = null;
var custView = 'today';
var custGroupId = '';
var custBranchId = '';
var dashGroupId = '';
var dashBranchId = '';

/* ═══ UTILS ═══ */
function toISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
// ── วันทำงานของระบบ: ตัดวันตอน "ตี 4" เวลาไทย ──
// 00:00–03:59 ยังนับเป็น "วันเดิม" (เก็บเงินรอบดึกไม่ข้ามวัน) · ตี 4 เป็นต้นไป = วันใหม่
// ล็อก Asia/Bangkok (UTC+7 คงที่) ไม่อิง timezone เครื่อง — เครื่องตั้งโซนเวลาผิดก็ไม่เพี้ยน
var DAY_CUTOFF_HOUR=4;
function todayISO(){
  var d=new Date(Date.now()+(7-DAY_CUTOFF_HOUR)*3600000);   // เลื่อนเป็นเวลาไทย แล้วถอยเท่าเวลาตัดวัน → อ่านวันที่แบบ UTC
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
}
function daysBetween(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/(86400000))}
function addDaysISO(iso,n){var d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+(+n||0));return toISO(d)}
function round2(n){return Math.round((+n||0)*100)/100}
function fmt(n){return (parseFloat(n)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmt0(n){return (parseFloat(n)||0).toLocaleString('th-TH')}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function thDate(iso){if(!iso)return'—';var d=new Date(iso+'T00:00:00');var m=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];return d.getDate()+' '+m[d.getMonth()]+' '+(d.getFullYear()+543)}

var STATUS_LABEL={normal:'ปกติ',overdue:'ค้างจ่าย',lost:'ตาย',closed:'ปิดแล้ว'};
var PSTATUS_LABEL={unpaid:'ไม่จ่าย',partial:'จ่ายบางส่วน',exact:'จ่ายครบดอก',overpaid:'จ่ายเกิน(หักต้น)',advance:'จ่ายล่วงหน้า'};
// รายชื่อธนาคาร (ดรอปดาวตอนเพิ่ม/แก้ลูกค้า) — เรียงตามที่กำหนด
var BANK_LIST=['กสิกร','SCB/ไทยพาณิชย์','ttb/ทหารไทย','กรุงไทย','ออมสิน','KKP/เกียรตินาคิน','กรุงศรี','กรุงเทพ','LH/แลนด์แอนด์เฮ้าส์','ธ.ก.ส.','ธนาคารอาคารสงเคราะห์','CIMB','UOB'];
// สร้าง <option> สำหรับดรอปดาวธนาคาร · เก็บค่าเดิมที่ไม่อยู่ในลิสต์ไว้ (กันข้อมูลเก่าหาย)
function bankOptions(sel){
  sel=sel||'';
  var opts='<option value="">— เลือกธนาคาร —</option>',found=false;
  BANK_LIST.forEach(function(b){if(b===sel)found=true;opts+='<option value="'+esc(b)+'"'+(b===sel?' selected':'')+'>'+esc(b)+'</option>';});
  if(sel&&!found)opts+='<option value="'+esc(sel)+'" selected>'+esc(sel)+' (เดิม)</option>';
  return opts;
}
var ROLE_LABEL={owner:'OWNER',head:'หัวหน้ากอง',line:'หัวหน้าสาย',manager:'หัวหน้าสาย',staff:'พนักงาน'};

/* ═══ PERMISSION ═══
   owner        = เห็น/จัดการทั้งระบบ
   head         = หัวหน้ากอง — เห็นทุกบ้านในกองตัวเอง (ผูกผ่าน user_groups) · ทำได้เกือบทุกอย่างเหมือน Owner เฉพาะในกองตัวเอง (ยืนยันโอน/คืนเครดิต/ลบ/ผ่อนต้น/ข้าม checksum) · ยกเว้น "หน้าตั้งค่า" (บ้าน/กอง/ผู้ใช้) = Owner เท่านั้น
   line/manager = หัวหน้าสาย — เห็นเฉพาะบ้านที่ดูแล (ผูกผ่าน user_branches) · แก้ไข/รับเงินได้
   staff        = พนักงาน — เห็นเฉพาะบ้านตัวเอง (user_branches) · สิทธิ์จำกัด
*/
function isOwner(){return currentUser&&currentUser.role==='owner'}
function isHead(){return currentUser&&currentUser.role==='head'}                                    // หัวหน้ากอง
function isLineHead(){return currentUser&&(currentUser.role==='line'||currentUser.role==='manager')} // หัวหน้าสาย
function isStaff(){return currentUser&&currentUser.role==='staff'}
function canEdit(){return isOwner()||isHead()||isLineHead()||isStaff()}   // รับเงิน/ปิดสินเชื่อ/เพิ่มยอด — ทุก role (ในขอบเขตที่เห็น)
function canDisburse(){return isOwner()||isHead()}             // ยืนยันโอนเงิน ("เปิด") — Owner + หัวหน้ากอง (ในกองตัวเอง)
function canReturnCredit(){return isOwner()||isHead()}         // คืนเครดิต (ลูกค้าตายจ่ายเต็มยอด) — Owner + หัวหน้ากอง
function canDelete(){return isOwner()||isHead()}               // ลบลูกค้า — Owner + หัวหน้ากอง
function canManageBranches(){return isOwner()}                 // จัดการโครงสร้าง กอง→บ้าน (หน้าตั้งค่า) — Owner เท่านั้น
function canAddCustomer(){return isOwner()||isHead()||isLineHead()||isStaff()} // เพิ่มลูกค้าใหม่/เปิดยอดใหม่ — ทุก role
function canEditCustomerInfo(){return isOwner()||isHead()||isLineHead()} // แก้ "ข้อมูลลูกค้า" (ชื่อ/เบอร์/บัญชี) — พนักงานแก้ไม่ได้
function canManageUsers(){return isOwner()}                    // จัดการผู้ใช้ (หน้าตั้งค่า) — Owner เท่านั้น
function canManageGroups(){return isOwner()}                   // จัดการกอง (หน้าตั้งค่า) — Owner เท่านั้น
function myGroupIds(){
  if(isOwner()) return allGroups.map(function(g){return g.id});
  return allUserGroups.filter(function(ug){return ug.user_id===currentUser.id}).map(function(ug){return ug.group_id});
}
function myBranchIds(){
  if(isOwner()) return allBranches.map(function(b){return b.id});
  if(isHead()){   // หัวหน้ากอง → ทุกบ้านในกองที่ผูกไว้
    var gids=myGroupIds();
    // หัวหน้ากองที่ยังไม่ถูกผูกกอง → เห็นทุกบ้าน (ช่วงเปลี่ยนผ่าน)
    if(!gids.length) return allBranches.map(function(b){return b.id});
    return allBranches.filter(function(b){return gids.indexOf(b.group_id)>=0}).map(function(b){return b.id});
  }
  // หัวหน้าสาย / พนักงาน → เฉพาะบ้านที่ผูกไว้
  return allUserBranches.filter(function(ub){return ub.user_id===currentUser.id}).map(function(ub){return ub.branch_id});
}
// ขอบเขต กอง/บ้าน ที่เลือกในตัวกรอง → รายการ branch id (ใช้ร่วม dashboard/ลูกค้า/ค่าแรง)
function scopeBids(groupId,branchId){
  var all=myBranchIds();
  if(branchId)return all.indexOf(branchId)>=0?[branchId]:all;
  if(groupId)return allBranches.filter(function(b){return b.group_id===groupId&&all.indexOf(b.id)>=0}).map(function(b){return b.id});
  return all;
}
// สร้าง lookup object จาก array (แทน .find ในลูป — กัน O(n×m) เมื่อข้อมูลโต)
function indexBy(arr,key){var m={};(arr||[]).forEach(function(x){m[x[key]]=x});return m}

/* ═══ กันโกง: ตรวจตัวตนลูกค้า / แจ้งเตือน Owner ═══ */
// normalize ก่อนเทียบ — กันพิมพ์เว้นวรรค/คำนำหน้า/อักขระแปลกปลอม
function normDigits(s){return String(s==null?'':s).replace(/\D/g,'')}
function normPhone(s){var d=normDigits(s);return d.length>9?d.slice(-9):d} // เทียบ 9 หลักท้าย
function normName(s){return String(s==null?'':s).replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.)\s*/,'').replace(/\s+/g,'').trim()}
// ระยะแก้ไข (Levenshtein) — ใช้จับ "ใกล้เคียง"
function levenshtein(a,b){
  a=String(a||'');b=String(b||'');
  if(a===b)return 0; if(!a.length)return b.length; if(!b.length)return a.length;
  var prev=[],cur=[],i,j;
  for(j=0;j<=b.length;j++)prev[j]=j;
  for(i=1;i<=a.length;i++){
    cur[0]=i;
    for(j=1;j<=b.length;j++){
      var cost=a.charAt(i-1)===b.charAt(j-1)?0:1;
      cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+cost);
    }
    for(j=0;j<=b.length;j++)prev[j]=cur[j];
  }
  return cur[b.length];
}
// checksum เลขบัตรประชาชนไทย 13 หลัก (mod 11) — เตือนเฉยๆ ไม่บล็อก
function validThaiId(s){
  var d=normDigits(s); if(d.length!==13)return false;
  var sum=0; for(var i=0;i<12;i++)sum+=parseInt(d.charAt(i),10)*(13-i);
  return ((11-(sum%11))%10)===parseInt(d.charAt(12),10);
}
// หา person เดิม "ตรงเป๊ะ" → ใช้บังคับลิมิตกู้หลายที่ (เลขบัตรตรง หรือ ชื่อ+เบอร์ตรง)
function findExistingPerson(o){
  o=o||{};
  var idc=normDigits(o.id_card);
  if(idc.length>=13){var byId=allPersons.find(function(p){return normDigits(p.id_card)===idc});if(byId)return byId;}
  var nm=normName(o.name),ph=normPhone(o.phone);
  if(nm&&ph&&ph.length>=9){var byNP=allPersons.find(function(p){return normName(p.full_name)===nm&&normPhone(p.phone)===ph});if(byNP)return byNP;}
  return null;
}
// หา person ที่ "ใกล้เคียง" → ไม่บล็อก แค่ส่งแจ้งเตือนให้ Owner ไล่ตรวจ
function findNearDuplicates(o,excludeId){
  o=o||{}; var out=[];
  var idc=normDigits(o.id_card),nm=normName(o.name),ph=normPhone(o.phone),ba=normDigits(o.bank_account);
  allPersons.forEach(function(p){
    if(excludeId&&p.id===excludeId)return;
    var pid=normDigits(p.id_card),pnm=normName(p.full_name),pph=normPhone(p.phone),pba=normDigits(p.bank_account);
    var reasons=[];
    if(idc.length>=13&&pid.length>=13&&idc!==pid&&levenshtein(idc,pid)<=1)reasons.push('เลขบัตรต่างกัน 1 หลัก');
    if(ph&&pph&&ph.length>=9&&ph===pph&&nm!==pnm)reasons.push('เบอร์เดียวกัน ชื่อต่าง');
    if(ba&&pba&&ba===pba)reasons.push('เลขบัญชีเดียวกัน');
    if(nm&&pnm&&nm!==pnm&&levenshtein(nm,pnm)<=2&&((ph&&ph===pph)||(ba&&ba===pba)))reasons.push('ชื่อใกล้เคียง');
    if(reasons.length)out.push({person:p,reasons:reasons});
  });
  return out;
}
// บันทึกแจ้งเตือน (fire-and-forget) — ทุก role insert ได้ (RLS ปิด) แต่เห็นเฉพาะ owner
async function logAlert(type,o){
  o=o||{};
  try{
    await _sb.from('alerts').insert({
      type:type,
      actor_user_id:currentUser?currentUser.id:null,
      actor_name:currentUser?(currentUser.full_name||currentUser.username):null,
      person_id:o.person_id||null, person_name:o.person_name||null,
      branch_id:o.branch_id||null, loan_id:o.loan_id||null,
      message:o.message||null, meta:o.meta||null
    });
  }catch(e){/* แจ้งเตือนล้มเหลวไม่ควรขัดการทำงานหลัก */}
}

/* ═══ CALCULATIONS (ตาม Spec) ═══ */
function interestDue(c){return c.principal_only?0:+(c.remaining_principal * c.daily_interest_rate * c.collection_interval).toFixed(2)}
function calcPayment(c, amountPaid, penalty){
  var due=interestDue(c), ic, pr, ps;
  amountPaid=+amountPaid||0;
  penalty=+penalty||0;
  if(amountPaid===0){ps='unpaid';ic=0;pr=0;}
  else if(amountPaid<due){ps='partial';ic=amountPaid;pr=0;}
  else if(amountPaid===due){ps='exact';ic=due;pr=0;}
  else{ps='overpaid';ic=due;pr=+(amountPaid-due).toFixed(2);}
  return{interest_due:due,interest_collected:ic,principal_reduced:pr,
    remaining_principal:+(c.remaining_principal-pr).toFixed(2),
    wage:+((ic+penalty)*0.20).toFixed(2),payment_status:ps};
}
function closeAmount(c){return c.principal_only?+(c.remaining_principal).toFixed(2):+(c.remaining_principal + interestDue(c) + (c.branch_fee||0)).toFixed(2)}
function isPaymentDueToday(c, iso){
  if(c.status==='closed') return false;
  var ref=c.last_collection_date||c.start_date;
  return daysBetween(ref, iso) >= c.collection_interval;
}
function isOverdue(c, iso){
  if(c.status==='closed'||c.status==='lost') return false;
  var ref=c.last_collection_date||c.start_date;
  return daysBetween(ref, iso) > c.collection_interval*7;
}
// ลูกค้าที่จ่ายล่วงหน้าไว้ (ใช้สวิตช์ "จ่ายล่วงหน้า" ตอนรับเงิน) — วันครบกำหนดถูกเลื่อนเลยวันที่ดูไปแล้ว
// จ่ายตรงงวดปกติ last_collection_date = วันนี้พอดี → ไม่นับ (ต้อง "เกิน" เท่านั้น)
function isPaidAhead(c,iso){return c.status==='normal'&&(c.last_collection_date||'')>(iso||todayISO())}

/* ═══ ค่าปรับอัตโนมัติ (PENALTY) ═══
   เส้นตายของรอบ = 16:00 ของวันครบกำหนด (ref + collection_interval)
   16:00–22:00 → คิดชั่วโมงละ penalty_per_hour (ปัดขึ้นทีละชั่วโมง)
   ตั้งแต่ 22:00 เป็นต้นไป → เปลี่ยนเป็นเต็มวัน penalty_per_day
   ทุกวันถัดไปที่ยังค้าง → +penalty_per_day อีกวันละครั้ง
   ใช้เวลาจริงโซนไทย · บันทึกย้อนหลัง = คิดเป็นเต็มวัน (ไม่คิดชั่วโมง) */
var PENALTY_DEADLINE_HOUR = 16;   // เส้นตาย 16:00
var PENALTY_HOURLY_SPAN   = 6;    // 16:00→22:00 = 6 ชั่วโมง แล้วเปลี่ยนเป็นเต็มวัน

// เวลาปัจจุบันโซนไทย (Asia/Bangkok) แยกเป็นส่วน ๆ
function bkkParts(){
  var p={};
  try{
    new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
      .formatToParts(new Date()).forEach(function(x){p[x.type]=x.value});
  }catch(e){var d=new Date();p={year:d.getFullYear(),month:('0'+(d.getMonth()+1)).slice(-2),day:('0'+d.getDate()).slice(-2),hour:('0'+d.getHours()).slice(-2),minute:('0'+d.getMinutes()).slice(-2)};}
  var hh=+p.hour; if(hh>=24)hh-=24;   // กัน '24' ตอนเที่ยงคืนในบางเครื่อง
  return {iso:p.year+'-'+p.month+'-'+p.day, hourFloat:hh + (+p.minute)/60};
}
function bkkTodayISO(){return bkkParts().iso}
// วันครบกำหนดของรอบปัจจุบัน (ISO)
function dueDateOf(c){
  var ref=c.last_collection_date||c.start_date;
  if(!ref) return null;
  var d=new Date(ref+'T00:00:00');
  d.setDate(d.getDate() + (+c.collection_interval||1));
  return toISO(d);
}
function penaltyRates(c){
  var b=allBranches.find(function(x){return x.id===c.branch_id})||{};
  return {ph:+(b.penalty_per_hour||0), pd:+(b.penalty_per_day||0)};
}
// ค่าปรับ ณ วันที่ payDateISO (ใช้ตอนรับเงิน) — คืนเป็นบาท
function computePenalty(c, payDateISO){
  if(!c||c.status==='closed') return 0;
  var r=penaltyRates(c);
  if(!r.ph && !r.pd) return 0;
  var dueISO=dueDateOf(c); if(!dueISO) return 0;
  var bkkToday=bkkTodayISO();
  var elapsedH;
  if(payDateISO===bkkToday){
    // วันนี้ → ใช้เวลาจริง (ชั่วโมง+วัน)
    elapsedH = daysBetween(dueISO, bkkToday)*24 + (bkkParts().hourFloat - PENALTY_DEADLINE_HOUR);
  }else{
    // ย้อนหลัง/วันอื่น → คิดเป็นเต็มวัน (ยึดช่วงหลัง 22:00 ของวันนั้น)
    elapsedH = daysBetween(dueISO, payDateISO)*24 + (PENALTY_HOURLY_SPAN + 1);
  }
  if(elapsedH<=0) return 0;            // ยังไม่ถึงเส้นตาย / จ่ายก่อนกำหนด
  var k=Math.floor(elapsedH/24);       // จำนวนวันเต็มที่ผ่านมา (แต่ละวัน = pd)
  var into=elapsedH - k*24;            // ชั่วโมงในวันปัจจุบัน (0..24)
  var current;
  if(into<=0) current=0;
  else if(into<PENALTY_HOURLY_SPAN) current=Math.ceil(into)*r.ph;  // 16:00–22:00
  else current=r.pd;                                                // 22:00 เป็นต้นไป
  return +(k*r.pd + current).toFixed(2);
}

/* ═══ COPY ═══ */
function copyText(t){navigator.clipboard.writeText(t).then(function(){toast('คัดลอกแล้ว: '+t,'ok')}).catch(function(){toast('ไม่สามารถคัดลอกได้','err')})}

/* ═══ TOAST ═══ */
function toast(msg,type){
  var t=document.getElementById('toast');
  t.textContent=msg;t.className=type||'info';t.style.display='flex';
  clearTimeout(t._to);t._to=setTimeout(function(){t.style.display='none'},3000);
}

/* ═══ CONFIRM ═══ */
var _confirmResolve=null;
function showConfirm(o){
  return new Promise(function(res){
    _confirmResolve=res;
    document.getElementById('confirm-icon').textContent=o.icon||'⚠️';
    document.getElementById('confirm-title').textContent=o.title||'ยืนยัน';
    document.getElementById('confirm-msg').textContent=o.msg||'';
    var ok=document.getElementById('confirm-ok-btn');
    ok.textContent=o.okText||'ยืนยัน';ok.className='btn btn-block '+(o.okClass||'btn-red');
    document.getElementById('confirm-overlay').classList.add('open');
  });
}
document.getElementById('confirm-ok-btn').onclick=function(){document.getElementById('confirm-overlay').classList.remove('open');if(_confirmResolve){_confirmResolve(true);_confirmResolve=null}};
document.getElementById('confirm-cancel-btn').onclick=function(){document.getElementById('confirm-overlay').classList.remove('open');if(_confirmResolve){_confirmResolve(false);_confirmResolve=null}};

/* ═══ MODAL HELPERS ═══ */
function openModal(id){
  // ปิด modal หลักอื่นที่เปิดอยู่ก่อน กันซ้อนกัน (confirm-overlay เป็นเลเยอร์แยก ซ้อนทับได้)
  document.querySelectorAll('.modal-overlay.open').forEach(function(m){if(m.id!==id&&m.id!=='confirm-overlay')m.classList.remove('open')});
  document.getElementById(id).classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open')}
// wiring ปิด modal — อิง class .modal-overlay (modal ใหม่ใน HTML ได้พฤติกรรมนี้อัตโนมัติ ไม่ต้องลงทะเบียน)
document.querySelectorAll('.modal-overlay').forEach(function(m){
  m.addEventListener('click',function(e){if(e.target===this){this.classList.remove('open');if(this.id==='confirm-overlay'&&_confirmResolve){_confirmResolve(false);_confirmResolve=null}}});
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(function(m){m.classList.remove('open');if(m.id==='confirm-overlay'&&_confirmResolve){_confirmResolve(false);_confirmResolve=null}})});

/* ═══ LOGIN ═══ */
function showLoginScreen(){document.getElementById('login-screen').style.display='flex';document.getElementById('app').style.display='none'}
async function doLogin(){
  var u=document.getElementById('login-user').value.trim();
  var p=document.getElementById('login-pass').value;
  var err=document.getElementById('login-err'),errt=document.getElementById('login-err-txt');
  err.classList.remove('show');
  if(!u||!p){errt.textContent='กรุณากรอก Username และรหัสผ่าน';err.classList.add('show');return}
  var btn=document.getElementById('login-btn');btn.innerHTML='<span class="spin"></span> กำลังตรวจสอบ...';btn.disabled=true;
  var res=await _sb.from('users').select('*').eq('username',u).eq('password',p).eq('is_active',true).maybeSingle();
  btn.innerHTML='เข้าสู่ระบบ';btn.disabled=false;
  if(res.error||!res.data){errt.textContent='ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ';err.classList.add('show');return}
  currentUser=res.data;
  localStorage.setItem(SESSION_KEY,JSON.stringify(currentUser));
  startApp();
}
function doLogout(){
  localStorage.removeItem(SESSION_KEY);currentUser=null;
  allBranches=[];allCustomers=[];allRecords=[];allUsers=[];allUserBranches=[];
  allGroups=[];allPersons=[];allLoans=[];allUserGroups=[];allDisbursements=[];
  showLoginScreen();
}
// เด้งออกจากระบบพร้อมข้อความบนหน้า login (ใช้ตอนบัญชีถูกปิด/ถูกลบ)
function forceLogout(msg){
  doLogout();
  var err=document.getElementById('login-err'),errt=document.getElementById('login-err-txt');
  if(err&&errt&&msg){errt.textContent=msg;err.classList.add('show');}
}
// ตรวจ session ที่จำไว้กับ DB ก่อนเข้าแอป — บัญชีถูกปิด/ถูกลบ = ไม่ให้เข้า (ล็อกอินค้างไว้ก็โดนเด้ง)
async function resumeSession(cached){
  var res=await _sb.from('users').select('*').eq('id',cached.id).eq('is_active',true).maybeSingle();
  if(res.error){currentUser=cached;startApp();return;}  // เน็ตล่ม/ผิดพลาดชั่วคราว — ใช้ session เดิมไปก่อน ไม่ล็อกคนทำงานภาคสนาม
  if(!res.data){forceLogout('บัญชีของคุณถูกระงับหรือถูกลบ — ติดต่อเจ้าของระบบ');return;}
  currentUser=res.data;                                  // ใช้ข้อมูลล่าสุดจาก DB (role/ชื่อ อัปเดตแล้วมีผลทันที)
  localStorage.setItem(SESSION_KEY,JSON.stringify(currentUser));
  startApp();
}

/* ═══ START ═══ */
function startApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('hdr-name').textContent=currentUser.full_name;
  var rb=document.getElementById('hdr-role');
  rb.textContent=ROLE_LABEL[currentUser.role];rb.className='role-badge role-'+currentUser.role;
  // role class ที่ body → ใช้สลับ UX/UI ตามบทบาท (CSS/JS) · เฉพาะ role-staff มี CSS ซ่อนตัวกรองบ้าน
  document.body.className='role-'+currentUser.role;
  // permission-based UI: แท็บย่อยในหน้าตั้งค่า
  var sgb=document.getElementById('stab-btn-groups');if(sgb)sgb.style.display=canManageGroups()?'':'none';
  var sbb=document.getElementById('stab-btn-branches');if(sbb)sbb.style.display=canManageBranches()?'':'none';
  var sub=document.getElementById('stab-btn-users');if(sub)sub.style.display=canManageUsers()?'':'none';
  if(typeof showSettingsTab==='function'){
    if(canManageBranches()) showSettingsTab('branches');
    else if(canManageGroups()) showSettingsTab('groups');
    else if(canManageUsers()) showSettingsTab('users');
  }
  // เมนูตามสิทธิ์ + เปิด "หน้าลูกค้า" เป็นหน้าหลัก (owner/head เหมือน staff)
  renderNav();
  showPage('customers');
  var t=todayISO();
  document.getElementById('dash-date-picker').value=t;
  initCalendar();
  // ปุ่มเลื่อนขึ้นบนสุด — โผล่เมื่อเลื่อนลงเกิน 400px
  window.addEventListener('scroll',function(){
    var f=document.getElementById('scroll-top');if(f)f.classList.toggle('show',window.scrollY>400);
  },{passive:true});
  showInitialSkeleton();
  loadAll();
}
// โครงโหลด (skeleton) ระหว่างดึงข้อมูลครั้งแรก — กันจอว่าง/ดูเหมือนค้าง
function showInitialSkeleton(){
  var sb=document.getElementById('summary-bar');
  if(sb)sb.innerHTML='<div class="sbar"><div class="skel" style="height:46px;width:150px"></div><div class="skel" style="height:30px;flex:1;max-width:320px"></div></div>';
  var cards='';for(var i=0;i<5;i++)cards+='<div class="skel skel-card"></div>';
  var cc=document.getElementById('cust-list-cards');if(cc)cc.innerHTML=cards;
  var cl=document.getElementById('cust-list');if(cl)cl.innerHTML='<div style="padding:16px">'+cards+'</div>';
}

/* ═══ LOAD DATA ═══ */
async function loadAll(){
  var q=[
    _sb.from('groups').select('*').order('created_at'),
    _sb.from('branches').select('*').order('created_at'),
    _sb.from('persons').select('id,full_name,phone,id_card,facebook_url,fb_group_url,bank_name,bank_account'),
    _sb.from('loans').select('*').order('seq'),
    _sb.from('daily_records').select('*').order('record_date').order('created_at'),
    _sb.from('user_branches').select('*'),
    _sb.from('user_groups').select('*')
  ];
  if(canManageUsers()) q.push(_sb.from('users').select('id,username,full_name,role,is_active,created_at').order('created_at'));
  var r=await Promise.all(q);
  for(var i=0;i<r.length;i++){if(r[i].error){toast('โหลดข้อมูลล้มเหลว: '+r[i].error.message,'err');return}}
  allGroups=r[0].data||[];
  allBranches=r[1].data||[];
  // เรียงบ้านตามลำดับที่ลากจัดไว้ (sort_order) — fail-safe: ถ้ายังไม่มีคอลัมน์ = คงลำดับ created_at เดิม
  allBranches.sort(function(a,b){var av=(a.sort_order==null?9e9:a.sort_order),bv=(b.sort_order==null?9e9:b.sort_order);return av-bv||(a.created_at||'').localeCompare(b.created_at||'');});
  allPersons=r[2].data||[];
  allLoans=r[3].data||[];
  allRecords=r[4].data||[];
  allUserBranches=r[5].data||[];
  allUserGroups=r[6].data||[];
  if(canManageUsers()&&r[7]) allUsers=r[7].data||[];

  // ชุดเสริม (fail-safe แยกจากชุดหลัก กันแอปพังถ้ายังไม่รัน migration) — ยิงขนานกันในรอบเดียว
  // ① ยอดเบิก (phase4) · ② แจ้งเตือนกันโกง เฉพาะ owner (phase8) · ③ ผู้ใช้ สำหรับ role อื่น (owner โหลดในชุดหลักแล้ว · พนักงานต้องใช้หาหัวหน้าสาย/คอมหน้าค่าแรง)
  var extra=await Promise.all([
    _sb.from('disbursements').select('*'),
    isOwner()?_sb.from('alerts').select('*').order('created_at',{ascending:false}):null,
    !isOwner()?_sb.from('users').select('id,username,full_name,role,is_active').order('created_at'):null
  ]);
  allDisbursements=(extra[0]&&!extra[0].error&&extra[0].data)||[];
  allAlerts=(extra[1]&&!extra[1].error&&extra[1].data)||[];
  if(extra[2]&&!extra[2].error)allUsers=extra[2].data||[];

  // บัญชีถูกปิด/ถูกลบระหว่างใช้งาน → เด้งออกทันที (เช็คจากรายชื่อผู้ใช้ที่โหลดมาแล้ว ไม่มี query เพิ่ม)
  if(allUsers.length){
    var me=allUsers.find(function(u){return u.id===currentUser.id});
    if(!me||me.is_active===false){forceLogout('บัญชีของคุณถูกระงับหรือถูกลบ — ติดต่อเจ้าของระบบ');return;}
  }

  // daily_records ใช้ loan_id — alias เป็น customer_id เพื่อความเข้ากันได้กับโค้ดเดิม
  allRecords.forEach(function(rec){rec.customer_id=rec.loan_id});
  // ประกอบ allCustomers = สัญญา (loan) + ข้อมูลคน (person)
  buildCustomers();

  // filter customers by branch access (staff/head)
  if(!isOwner()){
    var bids=myBranchIds();
    allCustomers=allCustomers.filter(function(c){return bids.indexOf(c.branch_id)>=0});
  }

  await autoUpdateOverdue();
  populateFilters();
  renderDashboard();
  renderCustomers();
  if(typeof renderPayoutPage==='function') renderPayoutPage();
  if(canManageGroups()) renderGroups();
  if(canManageBranches()) renderBranches();
  if(canManageUsers()) renderUsers();
  if(typeof renderNav==='function') renderNav();        // อัปเดต badge แจ้งเตือน
  if(typeof renderAlerts==='function') renderAlerts();
}

// ประกอบ "ลูกค้า" รูปแบบเดิม (1 แถว/สัญญา) จาก loans + persons
function buildCustomers(){
  var personById=indexBy(allPersons,'id');
  allCustomers=allLoans.map(function(l){
    var p=personById[l.person_id]||{};
    return Object.assign({},l,{
      person_id:l.person_id,
      full_name:p.full_name||'(ไม่ทราบชื่อ)',
      phone:p.phone||null,id_card:p.id_card||null,facebook_url:p.facebook_url||null,fb_group_url:p.fb_group_url||null,
      bank_name:p.bank_name||null,bank_account:p.bank_account||null
    });
  });
}

/* ═══ AUTO OVERDUE ═══ */
async function autoUpdateOverdue(){
  var t=todayISO(), toFlag=[];
  allCustomers.forEach(function(c){
    if(c.status==='normal'&&isOverdue(c,t)){c.status='overdue';toFlag.push(c.id);}
  });
  if(toFlag.length){
    await _sb.from('loans').update({status:'overdue'}).in('id',toFlag);
  }
}

// กองที่เข้าถึงได้ = กองที่มีบ้านที่เราเห็น
function accessibleGroups(){
  var bids=myBranchIds(),gset={};
  allBranches.forEach(function(b){if(bids.indexOf(b.id)>=0&&b.group_id)gset[b.group_id]=true});
  return allGroups.filter(function(g){return gset[g.id]});
}
function populateFilters(){
  // ปุ่มกรองบ้าน: dashboard + หน้าลูกค้า
  if(typeof renderDashGroupBtns==='function') renderDashGroupBtns();
  if(typeof renderDashBranchBtns==='function') renderDashBranchBtns();
  if(typeof renderCustGroupBtns==='function') renderCustGroupBtns();
  if(typeof renderCustBranchBtns==='function') renderCustBranchBtns();
}
// แปลง branch_id → ชื่อกอง / ชื่อบ้าน
function branchName(id){var b=allBranches.find(function(x){return x.id===id});return b?b.name:'—'}
function groupNameOfBranch(id){var b=allBranches.find(function(x){return x.id===id});if(!b||!b.group_id)return '—';var g=allGroups.find(function(x){return x.id===b.group_id});return g?g.name:'—'}

// รหัสลูกค้า = รหัสบ้าน + เลขลำดับในบ้าน (เช่น AA01) — ตั้งรหัสบ้านที่หน้าตั้งค่า
function padNo(n){return String(+n||0).padStart(3,'0')}
function custCode(c){
  var b=allBranches.find(function(x){return x.id===c.branch_id});
  var code=b&&b.code?b.code:'';
  if(code)return code+(c.cust_no?padNo(c.cust_no):'');
  return '#'+(c.cust_no||c.seq); // ยังไม่ตั้งรหัสบ้าน → ใช้เลขสำรอง
}
// เลขลูกค้าถัดไปของบ้าน — ต่อคน (คนเดิมในบ้านเดิม = เลขเดิม) · ไม่ reuse ของคนอื่น
function nextCustNo(branchId,personId){
  var ex=allLoans.find(function(l){return l.branch_id===branchId&&l.person_id===personId&&l.cust_no});
  if(ex)return ex.cust_no;
  var max=0;allLoans.forEach(function(l){if(l.branch_id===branchId&&+l.cust_no>max)max=+l.cust_no});
  return max+1;
}

