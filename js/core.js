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
var allGroups = [], allPersons = [], allLoans = [], allUserGroups = [];
var currentDetailId = null;
var custView = 'today';

/* ═══ UTILS ═══ */
function toISO(d){return d.toISOString().split('T')[0]}
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
function calcPayment(c, amountPaid){
  var due=interestDue(c), ic, pr, ps;
  amountPaid=+amountPaid||0;
  if(amountPaid===0){ps='unpaid';ic=0;pr=0;}
  else if(amountPaid<due){ps='partial';ic=amountPaid;pr=0;}
  else if(amountPaid===due){ps='exact';ic=due;pr=0;}
  else{ps='overpaid';ic=due;pr=+(amountPaid-due).toFixed(2);}
  return{interest_due:due,interest_collected:ic,principal_reduced:pr,
    remaining_principal:+(c.remaining_principal-pr).toFixed(2),
    wage:+(ic*0.20).toFixed(2),payment_status:ps};
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
['modal-customer','modal-payment','modal-branch','modal-group','modal-user','modal-detail','confirm-overlay'].forEach(function(id){
  document.getElementById(id).addEventListener('click',function(e){if(e.target===this){this.classList.remove('open');if(id==='confirm-overlay'&&_confirmResolve){_confirmResolve(false);_confirmResolve=null}}});
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')['modal-customer','modal-payment','modal-branch','modal-group','modal-user','modal-detail','confirm-overlay'].forEach(function(id){document.getElementById(id).classList.remove('open')})});

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
  allGroups=[];allPersons=[];allLoans=[];allUserGroups=[];
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
  // ปรับคำโปรยหน้าแรกตามบทบาท
  var dsub={owner:'ภาพรวมทั้งระบบ',head:'ภาพรวมกองของคุณ',manager:'ภาพรวมกองของคุณ',staff:'งานเก็บเงินวันนี้'};
  var de=document.getElementById('dash-sub');if(de)de.textContent=dsub[currentUser.role]||'สรุปการดำเนินงานรายวัน';
  // permission-based UI (แสดง/ซ่อนทั้งส่วน)
  document.getElementById('page-groups').style.display=canManageGroups()?'':'none';
  document.getElementById('page-branches').style.display=canEdit()?'':'none';
  document.getElementById('page-users').style.display=canManageUsers()?'':'none';
  var t=todayISO();
  document.getElementById('dash-date-picker').value=t;
  initCalendar();
  // ปุ่มเลื่อนขึ้นบนสุด — โผล่เมื่อเลื่อนลงเกิน 400px
  window.addEventListener('scroll',function(){
    var f=document.getElementById('scroll-top');if(f)f.classList.toggle('show',window.scrollY>400);
  },{passive:true});
  loadAll();
}

/* ═══ LOAD DATA ═══ */
async function loadAll(){
  var q=[
    _sb.from('groups').select('*').order('created_at'),
    _sb.from('branches').select('*').order('created_at'),
    _sb.from('persons').select('id,full_name,phone,id_card,facebook_url'),
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
      phone:p.phone||null,id_card:p.id_card||null,facebook_url:p.facebook_url||null
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
  var groups=accessibleGroups();
  var gopts='<option value="">ทุกกอง</option>'+groups.map(function(g){return '<option value="'+g.id+'">'+esc(g.name)+'</option>'}).join('');
  ['dash-filter-group','cust-filter-group'].forEach(function(id){
    var el=document.getElementById(id);if(!el)return;var v=el.value;el.innerHTML=gopts;if(groups.some(function(g){return g.id===v}))el.value=v;
  });
  // ซ่อนตัวกรองกองถ้ามี ≤1 กอง
  var hideG=groups.length<=1;
  var pg=document.getElementById('dash-group-wrap');if(pg)pg.style.display=hideG?'none':'';
  populateBranchOptions('dash-filter-group','dash-filter-branch');
  populateBranchOptions('cust-filter-group','cust-filter-branch');
  // ซ่อนตัวกรองบ้านบนแดชบอร์ดถ้ามี ≤1 บ้าน
  var nb=allBranches.filter(function(b){return canAccessBranch(b.id)}).length;
  var bw=document.getElementById('dash-branch-wrap');if(bw)bw.style.display=nb<=1?'none':'';
}
// เติม dropdown บ้าน ตามกองที่เลือก
function populateBranchOptions(groupSelId,branchSelId){
  var bsel=document.getElementById(branchSelId);if(!bsel)return;
  var gEl=document.getElementById(groupSelId),gid=gEl?gEl.value:'';
  var bids=myBranchIds();
  var bs=allBranches.filter(function(b){return bids.indexOf(b.id)>=0&&(!gid||b.group_id===gid)});
  var v=bsel.value;
  bsel.innerHTML='<option value="">ทุกบ้าน</option>'+bs.map(function(b){return '<option value="'+b.id+'">'+esc(b.name)+'</option>'}).join('');
  if(bs.some(function(b){return b.id===v}))bsel.value=v;else bsel.value='';
}
function onDashGroup(){populateBranchOptions('dash-filter-group','dash-filter-branch');renderDashboard()}
function onCustGroup(){populateBranchOptions('cust-filter-group','cust-filter-branch');renderCustomers()}
// แปลง branch_id → ชื่อกอง / ชื่อบ้าน
function branchName(id){var b=allBranches.find(function(x){return x.id===id});return b?b.name:'—'}
function groupNameOfBranch(id){var b=allBranches.find(function(x){return x.id===id});if(!b||!b.group_id)return '—';var g=allGroups.find(function(x){return x.id===b.group_id});return g?g.name:'—'}

