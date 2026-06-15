/* ═══════════════════════════════════════════════
   PAGE NAV
═══════════════════════════════════════════════ */
// สลับหน้า (แสดงทีละหน้า) + อัปเดตเมนูที่ active
function showPage(name){
  document.querySelectorAll('.page').forEach(function(p){p.classList.toggle('active',p.id==='page-'+name)});
  document.querySelectorAll('.tab,.nav-item').forEach(function(t){t.classList.toggle('active',t.getAttribute('data-page')===name)});
  window.scrollTo({top:0,behavior:'smooth'});
  if(typeof renderDashboard==='function'&&allCustomers.length)renderDashboard(); // สรุปยอดตามหน้าที่เปิด
  if(name==='payout'&&typeof renderPayoutPage==='function')renderPayoutPage();
  if(name==='alerts'&&typeof renderAlerts==='function')renderAlerts();
}
// ไอคอนเส้น (stroke=currentColor → เปลี่ยนเป็นทองเมื่อ active)
var NAV_ICONS={
  customers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  reports:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/></svg>',
  payout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="13"/><line x1="4" y1="9" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="15"/><line x1="20" y1="11" x2="20" y2="3"/><line x1="1.5" y1="13" x2="6.5" y2="13"/><line x1="9.5" y1="8" x2="14.5" y2="8"/><line x1="17.5" y1="15" x2="22.5" y2="15"/></svg>',
  alerts:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
};
// เมนูตามสิทธิ์: ลูกค้า (ทุกคน) · รายงาน (owner/head) · ตั้งค่า (ผู้มีสิทธิ์)
function navItems(){
  var items=[{k:'customers',t:'ลูกค้า'}];
  if(canEdit())items.push({k:'reports',t:'รายงาน'});
  items.push({k:'payout',t:'ค่าแรง'});
  if(canManageBranches()||canManageGroups()||canManageUsers())items.push({k:'settings',t:'ตั้งค่า'});
  if(isOwner()){
    var un=allAlerts.filter(function(a){return !a.is_read}).length;
    items.push({k:'alerts',t:'แจ้งเตือน'+(un?' <span class="nav-badge">'+un+'</span>':'')});
  }
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
// ── ตัวกรอง "กอง" หน้ารายงาน (โชว์เมื่อมี ≥2 กอง) ──
function renderDashGroupBtns(){
  var el=document.getElementById('dash-group-btns');if(!el)return;
  var groups=accessibleGroups();
  if(groups.length<=1){el.innerHTML='';dashGroupId='';return;}
  var btns='<button class="branch-btn'+(dashGroupId===''?' active':'')+'" onclick="setDashGroup(\'\')">ทุกกอง</button>';
  groups.forEach(function(g){btns+='<button class="branch-btn'+(dashGroupId===g.id?' active':'')+'" onclick="setDashGroup(\''+g.id+'\')">'+esc(g.name)+'</button>';});
  el.innerHTML=btns;
}
function setDashGroup(id){dashGroupId=id;dashBranchId='';renderDashGroupBtns();renderDashBranchBtns();renderDashboard();}
// ── ตัวกรอง "บ้าน" — ถ้าเลือกกองแล้วโชว์เฉพาะบ้านในกองนั้น ──
function renderDashBranchBtns(){
  var el=document.getElementById('dash-branch-btns');if(!el)return;
  var bids=myBranchIds(),hasGroups=accessibleGroups().length>1;
  var branches=allBranches.filter(function(b){return bids.indexOf(b.id)>=0});
  if(hasGroups&&!dashGroupId){el.innerHTML='';return;}
  if(dashGroupId)branches=branches.filter(function(b){return b.group_id===dashGroupId});
  if(branches.length<=1){el.innerHTML='';return;}
  var btns='<button class="branch-btn'+(dashBranchId===''?' active':'')+'" onclick="setDashBranch(\'\')">ทั้งหมด</button>';
  allGroups.forEach(function(g){
    branches.filter(function(b){return b.group_id===g.id}).forEach(function(b){btns+='<button class="branch-btn'+(dashBranchId===b.id?' active':'')+'" onclick="setDashBranch(\''+b.id+'\')">'+esc(b.name)+'</button>';});
  });
  branches.filter(function(b){return !b.group_id}).forEach(function(b){btns+='<button class="branch-btn'+(dashBranchId===b.id?' active':'')+'" onclick="setDashBranch(\''+b.id+'\')">'+esc(b.name)+'</button>';});
  el.innerHTML=btns;
}
function setDashBranch(id){dashBranchId=id;renderDashBranchBtns();renderDashboard();}

// ขอบเขตของแถบสรุปยอด = ตัวกรองของ "หน้าที่เปิดอยู่"
// หน้าลูกค้า → กอง/บ้านที่เลือก · หน้ารายงาน → บ้านที่เลือก (dashBranchId)
function currentScopeBids(){
  var all=myBranchIds();
  var pc=document.getElementById('page-customers');
  if(pc&&pc.classList.contains('active')){
    if(custBranchId)return [custBranchId];
    if(custGroupId)return allBranches.filter(function(b){return b.group_id===custGroupId&&all.indexOf(b.id)>=0}).map(function(b){return b.id});
    return all;
  }
  if(dashBranchId)return [dashBranchId];
  if(dashGroupId)return allBranches.filter(function(b){return b.group_id===dashGroupId&&all.indexOf(b.id)>=0}).map(function(b){return b.id});
  return all;
}
function renderDashboard(){
  var date=document.getElementById('dash-date-picker').value||todayISO();
  var bids=currentScopeBids();

  var custs=allCustomers.filter(function(c){return bids.indexOf(c.branch_id)>=0});
  var recs=allRecords.filter(function(r){
    if(r.record_date!==date)return false;
    var c=allCustomers.find(function(x){return x.id===r.customer_id});
    return c&&bids.indexOf(c.branch_id)>=0;
  });

  var sum=recs.reduce(function(a,r){
    a.collected+=+r.amount_paid;a.interest+=+r.interest_collected;a.wage+=+r.wage;a.principal+=+r.principal_reduced;a.penalty+=+(r.penalty||0);
    a.fee+=Math.max(0,round2((+r.amount_paid)-(+r.interest_collected)-(+r.principal_reduced))); // ส่วนที่จ่ายเกินดอก+ต้น = ค่าธรรมเนียม (เก็บตอนปิดสัญญา)
    if(r.payment_status!=='unpaid')a.paid++;return a;
  },{collected:0,interest:0,wage:0,principal:0,penalty:0,fee:0,paid:0});
  // เงินต้นคงค้างในตลาด (ปัจจุบัน) = สัญญาที่ยังไม่ปิด
  var outstanding=custs.filter(function(c){return c.status!=='closed'}).reduce(function(s,c){return s+ +c.remaining_principal},0);
  // ยอดเบิก — เงินที่โอนให้ลูกค้าวันนี้ (เปิดใหม่ + เพิ่มยอด)
  var disbToday=allDisbursements.filter(function(d){return d.disburse_date===date&&bids.indexOf(d.branch_id)>=0});
  var disbTotal=disbToday.reduce(function(s,d){return s+ +d.amount},0);

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
    return{id:b.id,group_id:b.group_id,name:b.name,interest:br.reduce(function(s,r){return s+ +r.interest_collected},0),
      wage:br.reduce(function(s,r){return s+ +r.wage},0),
      penalty:br.reduce(function(s,r){return s+ +(r.penalty||0)},0),
      fee:br.reduce(function(s,r){return s+Math.max(0,round2((+r.amount_paid)-(+r.interest_collected)-(+(r.principal_reduced||0))))},0),
      principal:br.reduce(function(s,r){return s+ +(r.principal_reduced||0)},0),
      collected:br.reduce(function(s,r){return s+ +r.amount_paid + +(r.penalty||0)},0),
      disbursed:allDisbursements.filter(function(d){return d.branch_id===b.id&&d.disburse_date===date}).reduce(function(s,d){return s+ +d.amount},0),
      paid:br.filter(function(r){return r.payment_status!=='unpaid'}).length};
  });

  // ── สรุปยอดดำ-ทอง: "รวมรับวันนี้" เป็นพระเอก + ตัวเลขอื่นเงียบ (ไม่มีสีรุ้ง) ──
  var total=sum.collected+sum.penalty;
  var sub=function(k,v,ex){return '<div class="sub-item"><span class="sub-k">'+k+'</span><span class="sub-v'+(ex||'')+'">฿'+fmt0(v)+'</span></div>'};
  var subs=sub('ต้นเก็บคืน',sum.principal)+
    sub('ยอดเบิก',disbTotal,disbTotal>0?' is-out':'')+
    sub('ดอก',sum.interest)+
    sub('ค่าปรับ',sum.penalty,sum.penalty>0?' is-pen':'')+
    sub('ค่าธรรมเนียม',sum.fee)+
    sub('ต้นคงเหลือ',outstanding);
  var heroSub='';
  if(isStaff()){
    var dueN=dueToday.length;
    var doneN=dueToday.filter(function(c){return recordedAny[c.id]}).length;
    var pct=dueN?Math.round(doneN/dueN*100):100;
    heroSub='<div class="sbar-prog">'+(dueN?'เก็บแล้ว '+doneN+'/'+dueN+' ราย':'วันนี้ไม่มีใครถึงกำหนด')+'</div>';
  }
  document.getElementById('summary-bar').innerHTML=
    '<div class="sbar">'+
      '<div class="sbar-hero">'+
        '<div class="sbar-hero-lbl">รวมรับวันนี้ <span class="sbar-date">· '+thDate(date)+'</span></div>'+
        '<div class="sbar-hero-val"><span class="cur">฿</span>'+fmt0(total)+'</div>'+heroSub+
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

  // by branch (มุมมองผู้บริหาร) — รายละเอียดต่อบ้าน (จัดกลุ่ม กอง → บ้าน เมื่อมีหลายบ้าน)
  if(byBranch.length){
    var mrow=function(k,v,cls){return '<div class="br-m"><span class="br-mk">'+k+'</span><span class="br-mv'+(cls||'')+'">฿'+fmt0(v)+'</span></div>'};
    var brCard=function(b){
      return '<div class="card card-pad brbox">'+
        '<div class="brbox-head"><span class="brbox-name">'+esc(b.name)+'</span>'+
          '<span class="brbox-total">รวมรับ <b>฿'+fmt0(b.collected)+'</b></span></div>'+
        '<div class="brbox-grid">'+
          mrow('เงินต้นเก็บคืน',b.principal)+
          mrow('ยอดเบิก',b.disbursed,b.disbursed>0?' out':'')+
          mrow('ดอกที่เก็บได้',b.interest)+
          mrow('ค่าปรับ',b.penalty,b.penalty>0?' r':'')+
          mrow('ค่าธรรมเนียม',b.fee)+
          '<div class="br-m"><span class="br-mk">จ่ายแล้ว</span><span class="br-mv">'+b.paid+' ราย</span></div>'+
        '</div></div>';
    };
    if(byBranch.length===1){
      // เลือกบ้านเดียว → โชว์การ์ดบ้านนั้นเลย ไม่ต้องหัวกอง
      h+='<div class="section-label">รายละเอียดบ้าน</div>'+brCard(byBranch[0]);
    }else{
      // หลายบ้าน → จัดกลุ่ม กอง → บ้าน + ยอดรวมต่อกอง
      var grpBlock=function(title,list){
        if(!list.length)return '';
        var gTot=list.reduce(function(s,b){return s+b.collected},0);
        return '<div class="grp-head"><span class="grp-name">'+esc(title)+' <span class="grp-count">· '+list.length+' บ้าน</span></span>'+
          '<span class="grp-total">รวมรับ <b>฿'+fmt0(gTot)+'</b></span></div>'+
          list.map(brCard).join('');
      };
      h+='<div class="section-label">แยกตามบ้าน</div>';
      var done={};
      allGroups.forEach(function(g){
        var gb=byBranch.filter(function(b){return b.group_id===g.id});
        gb.forEach(function(b){done[b.id]=1});
        h+=grpBlock(g.name,gb);
      });
      var rest=byBranch.filter(function(b){return !done[b.id]});
      h+=grpBlock('ไม่มีกอง',rest);
    }
  }
  document.getElementById('dash-main').innerHTML=h;
}

// หน้า "ค่าแรง" (แท็บแยก) — รายวันตามวันที่ที่เลือก, ขอบเขต = บ้านที่ตัวเองเข้าถึง
// พนักงานเห็นแค่ของตัวเอง · owner/หัวหน้าสาย เห็นสรุปทั้งทีม
// ช่วงเวลาค่าแรง: 'day' (วันที่เลือก) | 'week' (จันทร์–อาทิตย์ของสัปดาห์นั้น)
var payoutPeriod='day';
function weekRange(iso){
  var d=new Date(iso+'T00:00:00'),dow=d.getDay();
  var mon=new Date(d);mon.setDate(d.getDate()+(dow===0?-6:1-dow)); // เริ่มวันจันทร์
  var sun=new Date(mon);sun.setDate(mon.getDate()+6);
  return [toISO(mon),toISO(sun)];
}
function setPayoutPeriod(p){payoutPeriod=p;renderPayoutPage();}
function renderPayoutPage(){
  var el=document.getElementById('payout-main');if(!el)return;
  var bids=myBranchIds(),from,to;
  if(payoutPeriod==='week'){var wr=weekRange(selDate());from=wr[0];to=wr[1];}
  else{from=to=selDate();}
  var recs=allRecords.filter(function(r){
    if(r.record_date<from||r.record_date>to)return false;
    var c=allCustomers.find(function(x){return x.id===r.customer_id});
    return c&&bids.indexOf(c.branch_id)>=0;
  });
  var seg='<div class="seg" style="margin-bottom:14px">'+
    '<button class="'+(payoutPeriod==='day'?'sel':'')+'" onclick="setPayoutPeriod(\'day\')">รายวัน</button>'+
    '<button class="'+(payoutPeriod==='week'?'sel':'')+'" onclick="setPayoutPeriod(\'week\')">รายสัปดาห์</button>'+
    '</div>';
  var rangeLabel=payoutPeriod==='week'?'<div class="section-label" style="margin:0 0 12px">ช่วง '+thDate(from)+' – '+thDate(to)+'</div>':'';
  var body=isStaff()?renderPayoutSelf(recs):renderPayout(recs);
  el.innerHTML=seg+rangeLabel+(body||'<div class="empty">'+(payoutPeriod==='week'?'สัปดาห์นี้':'วันนี้')+'ยังไม่มีการเก็บเงิน — ยังไม่มีค่าแรง</div>');
}

// ── ค่าแรงของตัวเอง (พนักงาน) ──
// แสดงเฉพาะของ currentUser · ค่าแรงเข้า "พนักงานเจ้าของบ้าน" (branches.staff_id) เสมอ ถึงคนอื่นจะเป็นคนกดรับเงิน — ไม่กำหนด = เข้าคนที่กดรับเงิน (recorded_by)
// หักคอม 5% ของยอดเข้า เฉพาะบ้านที่มีหัวหน้าสาย (เหมือนสรุปทีม)
function renderPayoutSelf(recs){
  var COMM=0.05, round2=function(n){return Math.round(n*100)/100};
  var PW=(typeof payoutPeriod!=='undefined'&&payoutPeriod==='week')?'สัปดาห์นี้':'วันนี้';
  var wage=0,comm=0,interest=0,penalty=0,fee=0,heads={},items=[];
  recs.forEach(function(r){
    if(!(+r.wage))return;
    var c=allCustomers.find(function(x){return x.id===r.customer_id});if(!c)return;
    var b=allBranches.find(function(x){return x.id===c.branch_id});
    var uid=(b&&b.staff_id)||r.recorded_by;
    if(uid!==currentUser.id)return;
    var w=round2(+r.wage), rIn=round2(w*5);
    var rInt=+r.interest_collected||0, rPen=+r.penalty||0, rFee=round2(rIn-rInt-rPen); // ส่วนที่เหลือ = ค่าธรรมเนียมตอนปิด
    wage+=w; interest+=rInt; penalty+=rPen; fee+=rFee;
    var lh=b&&lineHeadOfBranch(b.id);
    if(lh){comm+=round2(w*5*COMM);heads[lh.id]=lh.full_name;}
    items.push({c:c,interest:rInt,penalty:rPen,fee:rFee,wage:w});
  });
  if(!wage)return '';
  wage=round2(wage);comm=round2(comm);interest=round2(interest);penalty=round2(penalty);fee=round2(fee);
  var keep=round2(wage-comm);
  var basein=round2(wage*5);                        // ยอดเข้า (ฐานค่าแรง)
  var pct=basein>0?Math.round(keep/basein*100):20;  // 15% เมื่อมีหัวหน้าสาย (หักคอมแล้ว) · 20% เมื่อไม่มี
  var money=function(k,v,cls){return '<div class="pay-line'+(cls||'')+'"><span class="k">'+k+'</span><span class="v"><span class="cur">฿</span>'+fmt(v)+'</span></div>'};
  var sub=function(k,v){return '<div class="pay-src-row"><span>'+k+'</span><span class="v">฿'+fmt(v)+'</span></div>'};

  // กล่องแตกรายละเอียด "ยอดเข้า" → ดอก + ค่าปรับ + ค่าธรรมเนียม
  var breakdown='<div class="pay-src"><div class="pay-src-h">ยอดเข้าประกอบด้วย</div>'+
    sub('ดอกที่เก็บได้',interest)+
    (penalty>0?sub('ค่าปรับ',penalty):'')+
    (fee>0?sub('ค่าธรรมเนียม (ปิดยอด)',fee):'')+'</div>';

  // รายการที่เก็บวันนี้ รายคน
  var rows=items.map(function(it){
    var parts=['ดอก ฿'+fmt(it.interest)];
    if(it.penalty>0)parts.push('ค่าปรับ ฿'+fmt(it.penalty));
    if(it.fee>0)parts.push('ค่าธรรมเนียม ฿'+fmt(it.fee));
    return '<div class="pay-src-row"><span>'+esc(custCode(it.c))+' '+esc(it.c.full_name)+
      '<br><span style="color:var(--muted);font-size:0.72rem">'+parts.join(' · ')+'</span></span>'+
      '<span class="v">ค่าแรง ฿'+fmt(it.wage)+'</span></div>';
  }).join('');

  return '<div class="section-label" style="margin-top:24px">ค่าแรงของฉัน</div>'+
    '<div class="pay-person">'+
      '<div class="pay-ph"><span class="pay-name">'+esc(currentUser.full_name)+'</span>'+
        '<span class="pay-net"><span class="cur">฿</span>'+fmt(keep)+'</span></div>'+
      '<div class="pay-lines">'+money('ยอดเข้า'+PW+' (ฐานค่าแรง)',basein)+'</div>'+
      breakdown+
      '<div class="pay-lines">'+money('ค่าแรง '+pct+'%',keep,' total')+'</div></div>'+
    '<div class="section-label" style="margin-top:20px">รายการที่เก็บ'+PW+' · '+items.length+' รายการ</div>'+
    '<div class="pay-person"><div class="pay-src" style="margin-top:0">'+rows+'</div></div>';
}

// หัวหน้าสายของบ้าน (role line/manager ที่ผูกบ้านนี้ผ่าน user_branches) — ผู้รับค่าคอมของสายนั้น
function lineHeadOfBranch(bid){
  if(!bid)return null;
  var uids=allUserBranches.filter(function(ub){return ub.branch_id===bid}).map(function(ub){return ub.user_id});
  return allUsers.find(function(u){return uids.indexOf(u.id)>=0&&(u.role==='line'||u.role==='manager')})||null;
}

// ── สรุปจ่ายเงินทีมรายวัน ──
// ค่าแรง = 20% ของ "ยอดเข้า" (ดอกเก็บได้+ค่าปรับ+ค่าธรรมเนียมตอนปิด, เก็บใน daily_records.wage)
// คอม = 5% ของ "ยอดเข้า" (= ค่าแรง × 5) หักจากค่าแรงของแต่ละคน → รวมเป็น "คอมของสาย" → จ่ายให้หัวหน้าสาย (รวมส่วนของหัวหน้าเองด้วย)
// แยกตามสาย (หัวหน้าสายของบ้าน = lineHeadOfBranch) → รายคน (พนักงานเจ้าของบ้าน = branches.staff_id ถ้ามี ไม่งั้น fallback เป็นคนกดรับเงิน recorded_by) · บ้านไหนไม่มีหัวหน้าสาย = ไม่หักคอม
function renderPayout(recs){
  var COMM=0.05, round2=function(n){return Math.round(n*100)/100};
  var PW=(typeof payoutPeriod!=='undefined'&&payoutPeriod==='week')?'สัปดาห์นี้':'วันนี้';
  // จัดกลุ่ม: สาย (หัวหน้าสาย) → คน → ค่าแรงรวมวันนี้
  var lines={};
  recs.forEach(function(r){
    if(!(+r.wage))return;
    var c=allCustomers.find(function(x){return x.id===r.customer_id});if(!c)return;
    var b=allBranches.find(function(x){return x.id===c.branch_id});
    var uid=(b&&b.staff_id)||r.recorded_by||'__unknown';
    // owner + หัวหน้ากอง (head) ไม่คิดค่าแรง/คอม — นับเฉพาะหัวหน้าสาย + พนักงาน
    var ru=allUsers.find(function(x){return x.id===uid});
    if(ru&&(ru.role==='owner'||ru.role==='head'))return;
    var lh=b?lineHeadOfBranch(b.id):null;
    var lid=lh?lh.id:'__none';
    var g=lines[lid]||(lines[lid]={persons:{},head:lh});
    g.persons[uid]=(g.persons[uid]||0)+ +r.wage;
  });
  if(!Object.keys(lines).length)return '';

  var money=function(k,v,cls){return '<div class="pay-line'+(cls||'')+'"><span class="k">'+k+'</span><span class="v"><span class="cur">฿</span>'+fmt(v)+'</span></div>'};
  var uName=function(uid){var u=allUsers.find(function(x){return x.id===uid});return u?u.full_name:'(ไม่ทราบชื่อ)'};
  var uRole=function(uid){var u=allUsers.find(function(x){return x.id===uid});return u?u.role:'staff'};

  var html='<div class="section-label" style="margin-top:24px">จ่ายเงินทีม · ค่าแรง 20% − คอม 5%</div>';
  // เรียงสายตามชื่อหัวหน้าสาย แล้วต่อด้วย "ไม่มีหัวหน้าสาย"
  var orderLids=Object.keys(lines).filter(function(id){return id!=='__none'});
  orderLids.sort(function(a,b){return (lines[a].head.full_name||'').localeCompare(lines[b].head.full_name||'','th')});
  if(lines['__none'])orderLids.push('__none');

  orderLids.forEach(function(lid){
    var g=lines[lid];
    var head=g.head, hasHead=!!head;
    var persons=Object.keys(g.persons).map(function(uid){
      var wage=round2(g.persons[uid]), comm=hasHead?round2(wage*5*COMM):0;
      return {uid:uid,wage:wage,comm:comm,keep:round2(wage-comm)};
    });
    // ให้มีแถวหัวหน้าสายเสมอ แม้วันนี้ไม่ได้เก็บเอง
    if(hasHead&&!persons.some(function(p){return p.uid===head.id}))persons.push({uid:head.id,wage:0,comm:0,keep:0});
    var pool=round2(persons.reduce(function(s,p){return s+p.comm},0));
    var baseTotal=round2(persons.reduce(function(s,p){return s+p.wage*5},0));
    var lname=hasHead?('สาย '+esc(head.full_name)):'ไม่มีหัวหน้าสาย (ไม่หักคอม)';

    html+='<div class="grp-head"><span class="grp-name">'+lname+'</span>'+
      '<span class="grp-total">ยอดเข้า <b><span class="cur">฿</span>'+fmt(baseTotal)+'</b></span></div>';

    // พนักงานก่อน → หัวหน้าสายท้ายสุด (อ่านเป็นสรุป)
    var staff=persons.filter(function(p){return !hasHead||p.uid!==head.id});
    var ordered=staff.concat(hasHead?persons.filter(function(p){return p.uid===head.id}):[]);

    ordered.forEach(function(p){
      var isHead=hasHead&&p.uid===head.id;
      var net=isHead?round2(p.keep+pool):p.keep;
      var commLabel=!hasHead?'หักคอม 5% (ของยอดเข้า)':(isHead?'หักคอม 5% (เข้าสายตัวเอง)':('หักคอม 5% → '+esc(uName(head.id))));
      html+='<div class="pay-person'+(isHead?' is-head':'')+'">'+
        '<div class="pay-ph"><span class="pay-name">'+esc(uName(p.uid))+
          '<span class="role-badge role-'+uRole(p.uid)+'">'+(ROLE_LABEL[uRole(p.uid)]||'')+'</span></span>'+
          '<span class="pay-net"><span class="cur">฿</span>'+fmt(net)+'</span></div>'+
        '<div class="pay-lines">'+
          money('ยอดเข้า'+PW+' (ฐานค่าแรง)',p.wage*5)+
          money('ค่าแรง 20%',p.wage)+
          (p.comm>0?money(commLabel,p.comm,' minus'):'')+
          money('คงเหลือ',p.keep,(isHead&&pool>0)?'':' total')+
        '</div>';
      if(isHead&&pool>0){
        var srcRows=persons.filter(function(x){return x.comm>0}).map(function(x){
          return '<div class="pay-src-row"><span>'+esc(uName(x.uid))+(x.uid===head.id?' · ตัวเอง':'')+'</span><span class="v">฿'+fmt(x.comm)+'</span></div>';
        }).join('');
        html+='<div class="pay-src"><div class="pay-src-h">+ ค่าคอมที่เก็บได้จากทั้งสาย · ฿'+fmt(pool)+'</div>'+srcRows+'</div>'+
          '<div class="pay-lines"><div class="pay-line total"><span class="k">ได้รับสุทธิ</span><span class="v" style="color:var(--gold);font-weight:700"><span class="cur">฿</span>'+fmt(net)+'</span></div></div>';
      }
      html+='</div>';
    });
  });
  return html;
}

function stat(label,value,accent,sub){
  return '<div class="stat '+(accent||'')+'"><span class="label">'+label+'</span><span class="value">'+value+'</span>'+(sub?'<span class="sub">'+sub+'</span>':'')+'</div>';
}

