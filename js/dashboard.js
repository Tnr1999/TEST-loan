/* ═══════════════════════════════════════════════
   PAGE NAV
═══════════════════════════════════════════════ */
// สลับหน้า (แสดงทีละหน้า) + อัปเดตเมนูที่ active
function showPage(name){
  document.querySelectorAll('.page').forEach(function(p){p.classList.toggle('active',p.id==='page-'+name)});
  document.querySelectorAll('.tab,.nav-item').forEach(function(t){t.classList.toggle('active',t.getAttribute('data-page')===name)});
  window.scrollTo({top:0,behavior:'smooth'});
}
// ไอคอนเส้น (stroke=currentColor → เปลี่ยนเป็นทองเมื่อ active)
var NAV_ICONS={
  customers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  reports:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="13"/><line x1="4" y1="9" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="15"/><line x1="20" y1="11" x2="20" y2="3"/><line x1="1.5" y1="13" x2="6.5" y2="13"/><line x1="9.5" y1="8" x2="14.5" y2="8"/><line x1="17.5" y1="15" x2="22.5" y2="15"/></svg>'
};
// เมนูตามสิทธิ์: ลูกค้า (ทุกคน) · รายงาน (owner/head) · ตั้งค่า (ผู้มีสิทธิ์)
function navItems(){
  var items=[{k:'customers',t:'ลูกค้า'}];
  if(canEdit())items.push({k:'reports',t:'รายงาน'});
  if(canEdit()||canManageGroups()||canManageUsers())items.push({k:'settings',t:'ตั้งค่า'});
  return items;
}
function renderNav(){
  var items=navItems();
  var hc=document.getElementById('header-center'),bn=document.getElementById('bottom-nav');
  if(items.length<=1){if(hc)hc.innerHTML='';if(bn){bn.innerHTML='';bn.style.display='none';}return;}
  if(hc)hc.innerHTML='<div class="tab-bar">'+items.map(function(it){
    return '<button class="tab" data-page="'+it.k+'" onclick="showPage(\''+it.k+'\')">'+NAV_ICONS[it.k]+it.t+'</button>';
  }).join('')+'</div>';
  if(bn)bn.innerHTML=items.map(function(it){
    return '<button class="nav-item" data-page="'+it.k+'" onclick="showPage(\''+it.k+'\')"><span class="nav-ic">'+NAV_ICONS[it.k]+'</span>'+it.t+'</button>';
  }).join('');
}

/* ═══════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════ */
// ปุ่มเลือกบ้านบน dashboard — "ทั้งหมด" + รายบ้าน (เรียงตามกอง)
function renderDashBranchBtns(){
  var el=document.getElementById('dash-branch-btns');if(!el)return;
  var bids=myBranchIds();
  var branches=allBranches.filter(function(b){return bids.indexOf(b.id)>=0});
  if(branches.length<=1){el.innerHTML='';return;}
  var btns='<button class="branch-btn'+(dashBranchId===''?' active':'')+'" onclick="setDashBranch(\'\')">ทั้งหมด</button>';
  allGroups.forEach(function(g){
    branches.filter(function(b){return b.group_id===g.id}).forEach(function(b){btns+='<button class="branch-btn'+(dashBranchId===b.id?' active':'')+'" onclick="setDashBranch(\''+b.id+'\')">'+esc(b.name)+'</button>';});
  });
  branches.filter(function(b){return !b.group_id}).forEach(function(b){btns+='<button class="branch-btn'+(dashBranchId===b.id?' active':'')+'" onclick="setDashBranch(\''+b.id+'\')">'+esc(b.name)+'</button>';});
  el.innerHTML=btns;
}
function setDashBranch(id){dashBranchId=id;renderDashBranchBtns();renderDashboard();}

function renderDashboard(){
  var date=document.getElementById('dash-date-picker').value||todayISO();
  var bids=myBranchIds();
  if(dashBranchId) bids=[dashBranchId];

  var custs=allCustomers.filter(function(c){return bids.indexOf(c.branch_id)>=0});
  var recs=allRecords.filter(function(r){
    if(r.record_date!==date)return false;
    var c=allCustomers.find(function(x){return x.id===r.customer_id});
    return c&&bids.indexOf(c.branch_id)>=0;
  });

  var sum=recs.reduce(function(a,r){
    a.collected+=+r.amount_paid;a.interest+=+r.interest_collected;a.wage+=+r.wage;a.principal+=+r.principal_reduced;a.penalty+=+(r.penalty||0);
    if(r.payment_status!=='unpaid')a.paid++;return a;
  },{collected:0,interest:0,wage:0,principal:0,penalty:0,paid:0});
  // เงินต้นคงค้างในตลาด (ปัจจุบัน) = สัญญาที่ยังไม่ปิด
  var outstanding=custs.filter(function(c){return c.status!=='closed'}).reduce(function(s,c){return s+ +c.remaining_principal},0);

  // due today & alerts
  var activeCusts=custs.filter(function(c){return c.status==='normal'||c.status==='overdue'});
  var dueToday=activeCusts.filter(function(c){return isPaymentDueToday(c,date)});
  var recordedAny={};recs.forEach(function(r){if(r.payment_status!=='unpaid')recordedAny[r.customer_id]=1});
  var unpaidToday=dueToday.filter(function(c){return !recordedAny[c.id]});
  var overdueList=custs.filter(function(c){return c.status==='overdue'});
  var lostList=custs.filter(function(c){return c.status==='lost'});

  // by branch
  var byBranch=allBranches.filter(function(b){return bids.indexOf(b.id)>=0}).map(function(b){
    var br=recs.filter(function(r){var c=allCustomers.find(function(x){return x.id===r.customer_id});return c&&c.branch_id===b.id});
    return{name:b.name,interest:br.reduce(function(s,r){return s+ +r.interest_collected},0),
      wage:br.reduce(function(s,r){return s+ +r.wage},0),
      penalty:br.reduce(function(s,r){return s+ +(r.penalty||0)},0),
      paid:br.filter(function(r){return r.payment_status!=='unpaid'}).length};
  });

  // ── สรุปยอดดำ-ทอง: "รวมรับวันนี้" เป็นพระเอก + ตัวเลขอื่นเงียบ (ไม่มีสีรุ้ง) ──
  var total=sum.collected+sum.penalty;
  var sub=function(k,v,ex){return '<div class="sub-item"><span class="sub-k">'+k+'</span><span class="sub-v'+(ex||'')+'">฿'+fmt0(v)+'</span></div>'};
  var subs=sub('ดอก',sum.interest)+sub('ค่าปรับ',sum.penalty,sum.penalty>0?' is-pen':'')+
    sub('ค่าแรง',sum.wage)+sub('ต้นเก็บคืน',sum.principal)+sub('ต้นคงค้าง',outstanding);
  var heroSub='';
  if(isStaff()){
    var dueN=dueToday.length;
    var doneN=dueToday.filter(function(c){return recordedAny[c.id]}).length;
    var pct=dueN?Math.round(doneN/dueN*100):100;
    heroSub='<div class="sbar-prog">'+(dueN?'เก็บแล้ว '+doneN+'/'+dueN+' ราย':'วันนี้ไม่มีใครถึงกำหนด')+'</div>'+
      '<div class="prog" style="margin-top:6px;max-width:220px"><div class="prog-fill" style="width:'+pct+'%"></div></div>';
  }
  document.getElementById('summary-bar').innerHTML=
    '<div class="sbar">'+
      '<div class="sbar-hero">'+
        '<div class="sbar-hero-lbl">รวมรับวันนี้ <span class="sbar-date">· '+thDate(date)+'</span></div>'+
        '<div class="sbar-hero-val">฿'+fmt0(total)+'</div>'+heroSub+
      '</div>'+
      '<div class="sbar-sub">'+subs+'</div>'+
    '</div>';

  // ── staff ไม่ใช้หน้าแรก (ซ่อนทั้งส่วนใน core.js) — แถบสรุปด้านบนพอแล้ว ใช้หน้า "ลูกค้า" เก็บเงิน ──
  if(isStaff())return;

  var h='';
  // alerts
  if(unpaidToday.length){
    h+='<div class="alert alert-amber"><div class="alert-title">⚠️ ต้องจ่ายวันนี้แต่ยังไม่จ่าย ('+unpaidToday.length+' ราย)</div><div class="chip-list">'+
      unpaidToday.slice(0,12).map(function(c){return '<span class="chip" onclick="openDetail(\''+c.id+'\')">'+esc(c.full_name)+'</span>'}).join('')+
      (unpaidToday.length>12?'<span class="chip">+'+(unpaidToday.length-12)+'</span>':'')+'</div></div>';
  }
  if(overdueList.length){
    h+='<div class="alert alert-red"><div class="alert-title">🔴 ค้างจ่าย ('+overdueList.length+' ราย)</div><div class="chip-list">'+
      overdueList.slice(0,12).map(function(c){return '<span class="chip" onclick="openDetail(\''+c.id+'\')">'+esc(c.full_name)+'</span>'}).join('')+
      (overdueList.length>12?'<span class="chip">+'+(overdueList.length-12)+'</span>':'')+'</div></div>';
  }
  if(lostList.length){
    h+='<div class="alert alert-gray"><div class="alert-title">👻 หายติดต่อไม่ได้ ('+lostList.length+' ราย)</div><div class="chip-list">'+
      lostList.slice(0,12).map(function(c){return '<span class="chip" onclick="openDetail(\''+c.id+'\')">'+esc(c.full_name)+'</span>'}).join('')+'</div></div>';
  }

  // by branch (มุมมองผู้บริหาร) — กราฟแท่งทอง วัดจาก "ดอกที่เก็บได้"
  if(byBranch.length>1){
    var maxI=byBranch.reduce(function(m,b){return Math.max(m,b.interest)},0)||1;
    h+='<div class="section-label">ดอกที่เก็บได้ · แยกตามบ้าน</div><div class="card card-pad bar-card">'+
      byBranch.map(function(b){
        var pct=Math.max(2,Math.round(b.interest/maxI*100));
        return '<div class="bar-row">'+
          '<div class="bar-top"><span class="bar-name">'+esc(b.name)+'</span><span class="bar-val">฿'+fmt0(b.interest)+'</span></div>'+
          '<div class="bar-track"><div class="bar-fill" style="width:'+(b.interest>0?pct:0)+'%"></div></div>'+
          '<div class="bar-sub">ค่าปรับ ฿'+fmt0(b.penalty)+' · ค่าแรง ฿'+fmt0(b.wage)+' · จ่าย '+b.paid+' ราย</div>'+
        '</div>';
      }).join('')+'</div>';
  }
  document.getElementById('dash-main').innerHTML=h;
}

function stat(label,value,accent,sub){
  return '<div class="stat '+(accent||'')+'"><span class="label">'+label+'</span><span class="value">'+value+'</span>'+(sub?'<span class="sub">'+sub+'</span>':'')+'</div>';
}

