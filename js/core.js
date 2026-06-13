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
var currentDetailId = null;
var custView = 'today';
var custGroupId = '';
var custBranchId = '';
var dashGroupId = '';
var dashBranchId = '';

/* ═══ UTILS ═══ */
function toISO(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function todayISO(){return toISO(new Date())}
function daysBetween(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/(86400000))}
function fmt(n){return (parseFloat(n)||0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmt0(n){return (parseFloat(n)||0).toLocaleString('th-TH')}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function thDate(iso){if(!iso)return'—';var d=new Date(iso+'T00:00:00');var m=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];return d.getDate()+' '+m[d.getMonth()]+' '+(d.getFullYear()+543)}

var STATUS_LABEL={normal:'ปกติ',overdue:'ค้างจ่าย',lost:'ตาย',closed:'ปิดแล้ว'};
var PSTATUS_LABEL={unpaid:'ไม่จ่าย',partial:'จ่ายบางส่วน',exact:'จ่ายครบดอก',overpaid:'จ่ายเกิน(หักต้น)'};
var ROLE_LABEL={owner:'OWNER',head:'หัวหน้ากอง',manager:'หัวหน้ากอง',staff:'STAFF'};

/* ═══ PERMISSION ═══ */
function isOwner(){return currentUser&&currentUser.role==='owner'}
function isHead(){return currentUser&&(currentUser.role==='head'||currentUser.role==='manager')}
function isStaff(){return currentUser&&currentUser.role==='staff'}
function canEdit(){return isOwner()||isHead()}      // แก้/ลบลูกค้า, ปิดสินเชื่อ, จัดการบ้าน
function canAddCustomer(){return isOwner()||isHead()||isStaff()} // เพิ่มลูกค้า (staff เพิ่มได้ แต่แก้ไขไม่ได้)
function canManageUsers(){return isOwner()}
function canManageGroups(){return isOwner()}
function myGroupIds(){
  if(isOwner()) return allGroups.map(function(g){return g.id});
  return allUserGroups.filter(function(ug){return ug.user_id===currentUser.id}).map(function(ug){return ug.group_id});
}
function myBranchIds(){
  if(isOwner()) return allBranches.map(function(b){return b.id});
  if(isHead()){
    var gids=myGroupIds();
    // หัวหน้ากองที่ยังไม่ถูกผูกกอง → เห็นทุกบ้าน (ช่วงเปลี่ยนผ่าน)
    if(!gids.length) return allBranches.map(function(b){return b.id});
    return allBranches.filter(function(b){return gids.indexOf(b.group_id)>=0}).map(function(b){return b.id});
  }
  return allUserBranches.filter(function(ub){return ub.user_id===currentUser.id}).map(function(ub){return ub.branch_id});
}
function canAccessBranch(bid){return myBranchIds().indexOf(bid)>=0}

/* ═══ CALCULATIONS (ตาม Spec) ═══ */
function interestDue(c){return +(c.remaining_principal * c.daily_interest_rate * c.collection_interval).toFixed(2)}
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
function closeAmount(c){return +(c.remaining_principal + interestDue(c) + (c.branch_fee||0)).toFixed(2)}
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
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
['modal-customer','modal-payment','modal-branch','modal-group','modal-user','modal-detail','modal-topup','confirm-overlay'].forEach(function(id){
  document.getElementById(id).addEventListener('click',function(e){if(e.target===this){this.classList.remove('open');if(id==='confirm-overlay'&&_confirmResolve){_confirmResolve(false);_confirmResolve=null}}});
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')['modal-customer','modal-payment','modal-branch','modal-group','modal-user','modal-detail','modal-topup','confirm-overlay'].forEach(function(id){document.getElementById(id).classList.remove('open')})});

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

/* ═══ START ═══ */
function startApp(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('app').style.display='block';
  document.getElementById('hdr-name').textContent=currentUser.full_name;
  var rb=document.getElementById('hdr-role');
  rb.textContent=ROLE_LABEL[currentUser.role];rb.className='role-badge role-'+currentUser.role;
  // role class ที่ body → ใช้สลับ UX/UI ตามบทบาท (CSS/JS)
  document.body.className='role-'+(currentUser.role==='manager'?'head':currentUser.role);
  // permission-based UI: แท็บย่อยในหน้าตั้งค่า
  var sgb=document.getElementById('stab-btn-groups');if(sgb)sgb.style.display=canManageGroups()?'':'none';
  var sbb=document.getElementById('stab-btn-branches');if(sbb)sbb.style.display=canEdit()?'':'none';
  var sub=document.getElementById('stab-btn-users');if(sub)sub.style.display=canManageUsers()?'':'none';
  if(typeof showSettingsTab==='function'){
    if(canEdit()) showSettingsTab('branches');
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
    _sb.from('persons').select('id,full_name,phone,id_card,facebook_url,bank_name,bank_account'),
    _sb.from('loans').select('*').order('seq'),
    _sb.from('daily_records').select('*').order('record_date'),
    _sb.from('user_branches').select('*'),
    _sb.from('user_groups').select('*')
  ];
  if(canManageUsers()) q.push(_sb.from('users').select('id,username,full_name,role,is_active,created_at').order('created_at'));
  var r=await Promise.all(q);
  for(var i=0;i<r.length;i++){if(r[i].error){toast('โหลดข้อมูลล้มเหลว: '+r[i].error.message,'err');return}}
  allGroups=r[0].data||[];
  allBranches=r[1].data||[];
  allPersons=r[2].data||[];
  allLoans=r[3].data||[];
  allRecords=r[4].data||[];
  allUserBranches=r[5].data||[];
  allUserGroups=r[6].data||[];
  if(canManageUsers()&&r[7]) allUsers=r[7].data||[];

  // ยอดเบิก — โหลดแยก กันแอปพังถ้ายังไม่รัน migration phase4-disbursements
  var dres=await _sb.from('disbursements').select('*');
  allDisbursements=dres.error?[]:(dres.data||[]);

  // ผู้ใช้ — owner โหลดในชุดหลักแล้ว · หัวหน้ากองโหลดแยกแบบ fail-safe (ใช้โชว์ชื่อทีมในหน้าจ่ายเงิน)
  if(canEdit()&&!isOwner()){
    var ures=await _sb.from('users').select('id,username,full_name,role,is_active').order('created_at');
    if(!ures.error)allUsers=ures.data||[];
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
  if(canEdit()) renderBranches();
  if(canManageUsers()) renderUsers();
}

// ประกอบ "ลูกค้า" รูปแบบเดิม (1 แถว/สัญญา) จาก loans + persons
function buildCustomers(){
  allCustomers=allLoans.map(function(l){
    var p=allPersons.find(function(x){return x.id===l.person_id})||{};
    return Object.assign({},l,{
      person_id:l.person_id,
      full_name:p.full_name||'(ไม่ทราบชื่อ)',
      phone:p.phone||null,id_card:p.id_card||null,facebook_url:p.facebook_url||null,
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

