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
}
// ไอคอนเส้น (stroke=currentColor → เปลี่ยนเป็นทองเมื่อ active)
var NAV_ICONS={
  customers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  reports:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="9"/></svg>',
  payout:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>',
  settings:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="13"/><line x1="4" y1="9" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="15"/><line x1="20" y1="11" x2="20" y2="3"/><line x1="1.5" y1="13" x2="6.5" y2="13"/><line x1="9.5" y1="8" x2="14.5" y2="8"/><line x1="17.5" y1="15" x2="22.5" y2="15"/></svg>'
};
// เมนูตามสิทธิ์: ลูกค้า (ทุกคน) · รายงาน (owner/head) · ตั้งค่า (ผู้มีสิทธิ์)
function navItems(){
  var items=[{k:'customers',t:'ลูกค้า'}];
  if(canEdit())items.push({k:'reports',t:'รายงาน'});
  if(canEdit())items.push({k:'payout',t:'ค่าแรง'});
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
    if(r.payment_status!=='unpaid')a.paid++;return a;
  },{collected:0,interest:0,wage:0,principal:0,penalty:0,paid:0});
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
      principal:br.reduce(function(s,r){return s+ +(r.principal_reduced||0)},0),
      collected:br.reduce(function(s,r){return s+ +r.amount_paid + +(r.penalty||0)},0),
      disbursed:allDisbursements.filter(function(d){return d.branch_id===b.id&&d.disburse_date===date}).reduce(function(s,d){return s+ +d.amount},0),
      paid:br.filter(function(r){return r.payment_status!=='unpaid'}).length};
  });

  // ── สรุปยอดดำ-ทอง: "รวมรับวันนี้" เป็นพระเอก + ตัวเลขอื่นเงียบ (ไม่มีสีรุ้ง) ──
  var total=sum.collected+sum.penalty;
  var sub=function(k,v,ex){return '<div class="sub-item"><span class="sub-k">'+k+'</span><span class="sub-v'+(ex||'')+'">฿'+fmt0(v)+'</span></div>'};
  var subs=sub('ดอก',sum.interest)+sub('ค่าปรับ',sum.penalty,sum.penalty>0?' is-pen':'')+
    sub('ยอดเบิก',disbTotal,disbTotal>0?' is-out':'')+
    sub('ต้นเก็บคืน',sum.principal)+sub('ต้นคงค้าง',outstanding);
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
          mrow('ดอกที่เก็บได้',b.interest)+
          mrow('ค่าปรับ',b.penalty,b.penalty>0?' r':'')+
          mrow('ยอดเบิก',b.disbursed,b.disbursed>0?' out':'')+
          mrow('เงินต้นเก็บคืน',b.principal)+
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
function renderPayoutPage(){
  var el=document.getElementById('payout-main');if(!el)return;
  if(isStaff()){el.innerHTML='';return;}
  var date=selDate(), bids=myBranchIds();
  var recs=allRecords.filter(function(r){
    if(r.record_date!==date)return false;
    var c=allCustomers.find(function(x){return x.id===r.customer_id});
    return c&&bids.indexOf(c.branch_id)>=0;
  });
  el.innerHTML=renderPayout(recs)||'<div class="empty">วันนี้ยังไม่มีการเก็บเงิน — ยังไม่มีค่าแรง</div>';
}

// หัวหน้าของกอง (กติกา: 1 กอง = หัวหน้า 1 คน) — ผู้รับค่าคอมของกองนั้น
function groupHeadUser(gid){
  if(!gid)return null;
  var uids=allUserGroups.filter(function(ug){return ug.group_id===gid}).map(function(ug){return ug.user_id});
  return allUsers.find(function(u){return uids.indexOf(u.id)>=0&&(u.role==='head'||u.role==='manager')})||null;
}

// ── สรุปจ่ายเงินทีมรายวัน ──
// ค่าแรง 20% (จาก daily_records.wage) − หักคอม 5% ของแต่ละคน → รวมเป็น "คอมของกอง" → จ่ายให้หัวหน้ากอง (รวมส่วนของหัวหน้าเองด้วย)
// แยกตามกอง → รายคน (recorded_by = คนที่กดรับเงิน) · กองไหนไม่มีหัวหน้า = ไม่หักคอม
function renderPayout(recs){
  var COMM=0.05, round2=function(n){return Math.round(n*100)/100};
  // จัดกลุ่ม: กอง → คน → ค่าแรงรวมวันนี้
  var groups={};
  recs.forEach(function(r){
    if(!(+r.wage))return;
    // เจ้าของระบบ (owner) ไม่คิดค่าแรง/คอม — นับเฉพาะหัวหน้ากอง + สตาฟ
    var ru=allUsers.find(function(x){return x.id===r.recorded_by});
    if(ru&&ru.role==='owner')return;
    var c=allCustomers.find(function(x){return x.id===r.customer_id});if(!c)return;
    var b=allBranches.find(function(x){return x.id===c.branch_id});
    var gid=(b&&b.group_id)||'__none';
    var g=groups[gid]||(groups[gid]={persons:{}});
    var uid=r.recorded_by||'__unknown';
    g.persons[uid]=(g.persons[uid]||0)+ +r.wage;
  });
  if(!Object.keys(groups).length)return '';

  var money=function(k,v,cls){return '<div class="pay-line'+(cls||'')+'"><span class="k">'+k+'</span><span class="v"><span class="cur">฿</span>'+fmt(v)+'</span></div>'};
  var uName=function(uid){var u=allUsers.find(function(x){return x.id===uid});return u?u.full_name:'(ไม่ทราบชื่อ)'};
  var uRole=function(uid){var u=allUsers.find(function(x){return x.id===uid});return u?u.role:'staff'};

  var html='<div class="section-label" style="margin-top:24px">จ่ายเงินทีม · ค่าแรง 20% − คอม 5%</div>';
  // เรียงกองตาม allGroups แล้วต่อด้วย "ไม่มีกอง"
  var orderGids=allGroups.map(function(g){return g.id}).filter(function(id){return groups[id]});
  if(groups['__none'])orderGids.push('__none');

  orderGids.forEach(function(gid){
    var g=groups[gid];
    var head=gid==='__none'?null:groupHeadUser(gid), hasHead=!!head;
    var persons=Object.keys(g.persons).map(function(uid){
      var wage=round2(g.persons[uid]), comm=hasHead?round2(wage*COMM):0;
      return {uid:uid,wage:wage,comm:comm,keep:round2(wage-comm)};
    });
    // ให้มีแถวหัวหน้าเสมอ แม้วันนี้ไม่ได้เก็บเอง
    if(hasHead&&!persons.some(function(p){return p.uid===head.id}))persons.push({uid:head.id,wage:0,comm:0,keep:0});
    var pool=round2(persons.reduce(function(s,p){return s+p.comm},0));
    var baseTotal=round2(persons.reduce(function(s,p){return s+p.wage*5},0));
    var gname=gid==='__none'?'ไม่มีกอง':((allGroups.find(function(x){return x.id===gid})||{}).name||'กอง');

    html+='<div class="grp-head"><span class="grp-name">'+esc(gname)+
      '<span class="grp-count">· '+(hasHead?'หัวหน้า: '+esc(head.full_name):'ไม่มีหัวหน้ากอง (ไม่หักคอม)')+'</span></span>'+
      '<span class="grp-total">ยอดเข้า <b><span class="cur">฿</span>'+fmt(baseTotal)+'</b></span></div>';

    // พนักงานก่อน → หัวหน้าท้ายสุด (อ่านเป็นสรุป)
    var staff=persons.filter(function(p){return !hasHead||p.uid!==head.id});
    var ordered=staff.concat(hasHead?persons.filter(function(p){return p.uid===head.id}):[]);

    ordered.forEach(function(p){
      var isHead=hasHead&&p.uid===head.id;
      var net=isHead?round2(p.keep+pool):p.keep;
      html+='<div class="pay-person'+(isHead?' is-head':'')+'">'+
        '<div class="pay-ph"><span class="pay-name">'+esc(uName(p.uid))+
          '<span class="role-badge role-'+uRole(p.uid)+'">'+(ROLE_LABEL[uRole(p.uid)]||'')+'</span></span>'+
          '<span class="pay-net"><span class="cur">฿</span>'+fmt(net)+'</span></div>'+
        '<div class="pay-lines">'+
          money('ยอดเข้าวันนี้ (ฐานค่าแรง)',p.wage*5)+
          money('ค่าแรง 20%',p.wage)+
          (p.comm>0?money('หักคอม 5%',p.comm,' minus'):'')+
          money('คงเหลือ',p.keep,(isHead&&pool>0)?'':' total')+
        '</div>';
      if(isHead&&pool>0){
        var srcRows=persons.filter(function(x){return x.comm>0}).map(function(x){
          return '<div class="pay-src-row"><span>'+esc(uName(x.uid))+(x.uid===head.id?' · ตัวเอง':'')+'</span><span class="v">฿'+fmt(x.comm)+'</span></div>';
        }).join('');
        html+='<div class="pay-src"><div class="pay-src-h">+ ค่าคอมที่เก็บได้จากทั้งกอง · ฿'+fmt(pool)+'</div>'+srcRows+'</div>'+
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

