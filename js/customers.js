/* ═══════════════════════════════════════════════
   CUSTOMERS
═══════════════════════════════════════════════ */
// ── ตัวกรอง "กอง" (โชว์เมื่อมี ≥2 กองที่เข้าถึงได้) ──
function renderCustGroupBtns(){
  var el=document.getElementById('cust-group-btns');if(!el)return;
  var groups=accessibleGroups();
  if(groups.length<=1){el.innerHTML='';custGroupId='';return;}
  var btns='<button class="branch-btn'+(custGroupId===''?' active':'')+'" onclick="setCustGroup(\'\')">ทุกกอง</button>';
  groups.forEach(function(g){btns+='<button class="branch-btn'+(custGroupId===g.id?' active':'')+'" onclick="setCustGroup(\''+g.id+'\')">'+esc(g.name)+'</button>';});
  el.innerHTML=btns;
}
function setCustGroup(id){custGroupId=id;custBranchId='';renderCustGroupBtns();renderCustBranchBtns();renderCustomers();renderDashboard();}

// ── ตัวกรอง "บ้าน" — ถ้าเลือกกองแล้วโชว์เฉพาะบ้านในกองนั้น ──
function renderCustBranchBtns(){
  var el=document.getElementById('cust-branch-btns');if(!el)return;
  var bids=myBranchIds(),hasGroups=accessibleGroups().length>1;
  var branches=allBranches.filter(function(b){return bids.indexOf(b.id)>=0});
  // มีหลายกอง + ยังไม่เลือกกอง → ซ่อนแถวบ้าน (ให้เลือกกองก่อน)
  if(hasGroups&&!custGroupId){el.innerHTML='';return;}
  if(custGroupId)branches=branches.filter(function(b){return b.group_id===custGroupId});
  if(branches.length<=1){el.innerHTML='';return;}
  var btns='<button class="branch-btn'+(custBranchId===''?' active':'')+'" onclick="setCustBranch(\'\')">ทั้งหมด</button>';
  // เรียงตามกอง (กรณีไม่มีตัวกรองกอง) แล้วต่อด้วยบ้านนอกกอง
  allGroups.forEach(function(g){
    branches.filter(function(b){return b.group_id===g.id}).forEach(function(b){btns+='<button class="branch-btn'+(custBranchId===b.id?' active':'')+'" onclick="setCustBranch(\''+b.id+'\')">'+esc(b.name)+'</button>';});
  });
  branches.filter(function(b){return !b.group_id}).forEach(function(b){btns+='<button class="branch-btn'+(custBranchId===b.id?' active':'')+'" onclick="setCustBranch(\''+b.id+'\')">'+esc(b.name)+'</button>';});
  el.innerHTML=btns;
}
function setCustBranch(id){custBranchId=id;renderCustBranchBtns();renderCustomers();renderDashboard();}

function renderCustomers(){
  var search=(document.getElementById('cust-search').value||'').toLowerCase();
  var fb=custBranchId;
  var list=allCustomers.filter(function(c){
    if(fb){if(c.branch_id!==fb)return false;}                 // เลือกบ้าน → กรองบ้าน
    else if(custGroupId){                                      // เลือกกอง (ยังไม่เลือกบ้าน) → กรองทั้งกอง
      var b=allBranches.find(function(x){return x.id===c.branch_id});
      if(!b||b.group_id!==custGroupId)return false;
    }
    if(search){
      var hit=c.full_name.toLowerCase().indexOf(search)>=0
        || (c.phone||'').indexOf(search)>=0
        || custCode(c).toLowerCase().indexOf(search)>=0
        || String(c.seq).indexOf(search)>=0;
      if(!hit)return false;
    }
    return true;
  });

  // คำนวณสถานะของลูกค้าแต่ละคน ณ "วันที่กำลังดู" (ร่วมกับ dashboard) — ใช้ทั้งชิป/เรียง/แสดงผล
  var vdate=selDate();
  var stMap={};
  list.forEach(function(c){stMap[c.id]=custDayStatus(c,vdate)});

  // ตรรกะแต่ละมุมมอง (ใช้ร่วมกันทั้งชิปและการกรองรายการ)
  function inView(c,v){
    var s=stMap[c.id];
    if(v==='today')return s.due&&!s.paid;
    if(v==='overdue')return c.status==='overdue'&&!s.paid;
    if(v==='new')return s.isNew&&c.status!=='closed'&&c.status!=='lost';
    if(v==='old')return !s.isNew&&c.status!=='closed'&&c.status!=='lost';
    if(v==='closed')return c.status==='closed'&&!personHasActiveLoan(c.person_id)&&isLatestClosedLoan(c);
    if(v==='dead')return c.status==='lost';
    return true;
  }

  // ชิปกรองด่วน — default = ที่ถึงกำหนดในวันที่ดู
  var chips=[['today','ถึงกำหนด'],['overdue','ค้าง'],['new','ลูกค้าใหม่'],['old','ลูกค้าเก่า'],['closed','ปิดยอด'],['dead','ตาย']];
  document.getElementById('cust-summary').innerHTML=chips.map(function(v){
    var n=list.filter(function(c){return inView(c,v[0])}).length;
    return '<button class="vchip vc-'+v[0]+(custView===v[0]?' active':'')+'" onclick="setCustView(\''+v[0]+'\')">'+v[1]+' <b>'+n+'</b></button>';
  }).join('');

  // กรองตามมุมมองที่เลือก (ถ้ากำลังค้นหา → แสดงทุกผลลัพธ์ ไม่ตัดด้วยมุมมอง)
  var vlist=list.filter(function(c){return search?true:inView(c,custView)});
  // เรียง: รอรับเงิน/ต้องเก็บวันนี้ ▸ ค้าง ▸ ปกติ ▸ จ่ายแล้ว ▸ ตาย ▸ ปิด แล้วตามลำดับเลข
  function prio(c){var s=stMap[c.id];if(c.status==='closed')return 5;if(c.status==='lost')return 4;if(s.pending||s.due)return 0;if(s.paid)return 3;if(c.status==='overdue')return 1;return 2}
  vlist.sort(function(a,b){var d=prio(a)-prio(b);return d!==0?d:a.seq-b.seq});

  if(!vlist.length){
    var isToday=vdate===todayISO();
    var msg=custView==='today'?(isToday?'🎉 วันนี้เก็บครบแล้ว ไม่มีใครค้าง':'🎉 '+thDate(vdate)+' ไม่มีใครถึงกำหนด'):'ไม่พบลูกค้าในมุมมองนี้';
    var eh='<div class="empty">'+msg+(custView!=='old'?'<br><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="setCustView(\'old\')">ดูลูกค้าเก่าทั้งหมด</button>':'')+'</div>';
    document.getElementById('cust-list').innerHTML=eh;
    document.getElementById('cust-list-cards').innerHTML=eh;
    return;
  }
  // ตาราง (จอใหญ่)
  document.getElementById('cust-list').innerHTML=
    '<table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th class="tr-right">ต้นคงเหลือ</th><th class="tr-right">ดอก/งวด</th><th class="tr-right">ยอดปิด</th><th>สถานะ</th><th></th></tr></thead><tbody>'+
    vlist.map(function(c){var s=stMap[c.id];
      var interest=interestDue(c);
      var close=closeAmount(c);
      var ref=c.last_collection_date||c.start_date;
      var daysSince=ref?daysBetween(ref,vdate):0;
      var daysOver=daysSince-c.collection_interval;
      var tipLines=[];
      tipLines.push('งวด '+c.collection_interval+' วัน · อัตรา '+(c.daily_interest_rate*100).toFixed(2)+'%/วัน');
      if(ref)tipLines.push('เก็บล่าสุด: '+thDate(ref)+' ('+daysSince+' วันที่แล้ว)');
      if(daysOver>0)tipLines.push('⚠️ ค้าง '+daysOver+' วัน');
      if(c.branch_fee)tipLines.push('ค่าธรรมเนียมบ้าน: ฿'+fmt(c.branch_fee));
      var tip=tipLines.join('\n');
      // ปุ่ม action ในคอลัมน์เดียว — ใช้ปุ่มทรงเดียวกันทุกสถานะ (ดู ›/เปิด/รับเงิน/แก้ไข) เพื่อความสม่ำเสมอ
      var viewBtn='<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openDetail(\''+c.id+'\')">ดู ›</button>';
      var actBtn;
      if(c.status==='closed')actBtn=canEdit()?'<button class="btn btn-gold btn-sm" onclick="event.stopPropagation();openReloan(\''+c.id+'\')">เปิดใหม่</button>':viewBtn;
      else if(s.pending)actBtn=canEdit()?'<div class="row-flex" style="gap:6px"><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTopup(\''+c.id+'\')">+ เพิ่มยอด</button><button class="btn btn-green btn-sm" onclick="event.stopPropagation();setDisbursed(\''+c.id+'\')">เปิด</button></div>':viewBtn;
      else actBtn='<button class="btn '+(s.paid?'btn-ghost':'btn-gold')+' btn-sm" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+vdate+'\')">'+(s.paid?'แก้ไข':'รับเงิน')+'</button>';
      return '<tr style="cursor:pointer" onclick="openDetail(\''+c.id+'\')">'+
      '<td class="mono" style="color:var(--muted)">'+esc(custCode(c))+'</td>'+
      '<td><div style="font-weight:500">'+esc(c.full_name)+'</div>'+(c.phone?'<div style="font-size:0.72rem;color:var(--muted)">'+esc(c.phone)+'</div>':'')+'<div style="font-size:0.7rem;color:var(--muted)">'+esc(groupNameOfBranch(c.branch_id))+' · '+esc(branchName(c.branch_id))+'</div></td>'+
      '<td class="tr-right mono" style="font-weight:600">฿'+fmt(c.remaining_principal)+'</td>'+
      '<td class="tr-right mono" style="color:var(--green)">฿'+fmt(interest)+'</td>'+
      '<td class="tr-right mono" style="color:var(--gold);font-weight:600">฿'+fmt(close)+'</td>'+
      '<td><span class="st st-'+(s.pending?'pending':c.status)+'" data-tip="'+esc(tip)+'">'+(s.pending?'รอเปิด':STATUS_LABEL[c.status])+(daysOver>0?' +'+daysOver+'ว':'')+'</span></td>'+
      '<td>'+actBtn+'</td></tr>'}).join('')+
    '</tbody></table>';
  // การ์ดกระชับ (มือถือ) — แตะแถวเพื่อดูรายละเอียด, ปุ่มขวาเพื่อรับเงิน
  document.getElementById('cust-list-cards').innerHTML=
    vlist.map(function(c){return custCardHTML(c,vdate,stMap[c.id])}).join('');
}
function setCustView(v){custView=v;renderCustomers()}

// สถานะของลูกค้า ณ วันที่กำหนด (ใช้ร่วมหน้าลูกค้า + หน้าเก็บเงินของ staff)
function custDayStatus(c,date){
  var rec=allRecords.find(function(r){return r.customer_id===c.id&&r.record_date===date});
  return {
    rec:rec,
    paid:!!(rec&&rec.payment_status!=='unpaid'),
    due:c.status!=='closed'&&c.status!=='lost'&&isPaymentDueToday(c,date),
    isNew:c.start_date===date,   // ลูกค้าที่เข้ามาในวันนี้
    pending:!c.disbursed         // รอเปิด — รอแอดมินโอนเงินให้
  };
}
// การ์ดลูกค้าแบบลิสต์ (มือถือ + หน้าเก็บเงิน staff) — แตะดูรายละเอียด, ปุ่มขวารับเงิน
function custCardHTML(c,date,s){
  s=s||custDayStatus(c,date);
  var ival=c.collection_interval===1?'ทุกวัน':'ทุก '+c.collection_interval+'ว';
  // วันค้าง (เดิมซ่อนใน tooltip ของตาราง — มือถือเข้าไม่ถึง จึงโชว์บนการ์ดด้วย)
  var ref=c.last_collection_date||c.start_date;
  var daysOver=ref?(daysBetween(ref,date)-c.collection_interval):0;
  var cls=s.pending?'pending':(s.paid?'paid':(s.due?'due':((c.status==='overdue'||c.status==='lost')?'over':'')));
  var chip=s.pending?'<span class="crow-st t-pending">รอเปิด</span>'
    :(s.paid?'<span class="crow-st t-paid">จ่ายแล้ว ฿'+fmt(s.rec.amount_paid)+'</span>'
    :(s.due?'<span class="crow-st t-due">ถึงกำหนด'+(daysOver>0?' +'+daysOver+'ว':'')+'</span>'
    :(c.status==='overdue'?'<span class="crow-st t-over">ค้าง'+(daysOver>0?' '+daysOver+'ว':'')+'</span>'
    :(c.status==='lost'?'<span class="crow-st t-dead">ตาย</span>'
    :(c.status==='closed'?'<span class="crow-st t-paid">ปิดยอด</span>':'')))));
  // ส่วนหัวการ์ด (avatar + ชื่อ + รายละเอียด) — ใช้ร่วมทุกแบบ
  var head='<div class="crow-ava">'+esc(custCode(c))+'</div>'+
    '<div class="crow-main">'+
      '<div class="crow-l1"><span class="crow-name">'+esc(c.full_name)+'</span>'+chip+'</div>'+
      '<div class="crow-l2">คงเหลือ <b>฿'+fmt(c.remaining_principal)+'</b> · '+esc(branchName(c.branch_id))+' · '+ival+'</div>'+
    '</div>';

  // ★ ต้องเก็บวันนี้ (ยังไม่จ่าย) = การ์ดพระเอก: โชว์ยอดดอกที่ต้องเก็บตัวโต + ปุ่มรับเงินเด่น
  if(s.due&&!s.pending){
    return '<div class="crow due big" onclick="openDetail(\''+c.id+'\')">'+
      '<div class="crow-top">'+head+'</div>'+
      '<div class="crow-act" onclick="event.stopPropagation()">'+
        '<div class="crow-due"><span>ดอกที่ต้องเก็บวันนี้</span><b><span class="cur">฿</span>'+fmt(interestDue(c))+'</b></div>'+
        '<button class="crow-btn cb-pay" onclick="openPayment(\''+c.id+'\',\''+date+'\')">รับเงิน</button>'+
      '</div></div>';
  }

  // อื่นๆ = แถวกระชับ
  var btn;
  if(c.status==='closed')btn=canEdit()?'<button class="crow-btn cb-pay" onclick="event.stopPropagation();openReloan(\''+c.id+'\')">เปิดใหม่</button>':'';
  else if(s.pending)btn=canEdit()?'<button class="crow-btn cb-edit" onclick="event.stopPropagation();openTopup(\''+c.id+'\')">+ เพิ่มยอด</button><button class="crow-btn cb-confirm" onclick="event.stopPropagation();setDisbursed(\''+c.id+'\')">เปิด</button>':'';
  else if(s.paid)btn='<button class="crow-btn cb-edit" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+date+'\')">แก้</button>';
  else btn='<button class="crow-btn cb-pay" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+date+'\')">รับ</button>';
  return '<div class="crow '+cls+'" onclick="openDetail(\''+c.id+'\')">'+head+btn+'</div>';
}

function openDetail(id){
  currentDetailId=id;
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  var b=allBranches.find(function(x){return x.id===c.branch_id});
  var recs=allRecords.filter(function(r){return r.customer_id===id}).sort(function(a,b){return b.record_date.localeCompare(a.record_date)});
  var ca=closeAmount(c);

  var h='<div class="page-head" style="margin-bottom:14px"><div>'+
    '<div class="row-flex" style="gap:8px;flex-wrap:wrap"><span class="mono" style="color:var(--muted)">'+esc(custCode(c))+'</span>'+
    '<span class="page-title" style="font-size:1.3rem">'+esc(c.full_name)+'</span>'+
    '<span class="st st-'+c.status+'">'+STATUS_LABEL[c.status]+'</span>'+
    (!c.disbursed?'<span class="st st-pending">รอเปิด</span>':'')+'</div>'+
    '<div class="page-sub">'+esc(groupNameOfBranch(c.branch_id))+' · '+esc(b?b.name:'—')+'</div></div>';
  if(canEdit()&&c.status!=='closed')h+='<button class="btn btn-ghost btn-sm" onclick="openEditCustomer(\''+id+'\')">แก้ แก้ไข</button>';
  h+='</div>';

  // stats
  h+='<div class="stat-grid cols-4">'+
    stat('เงินต้นเริ่ม','฿'+fmt0(c.principal),'')+
    stat('ต้นคงเหลือ','฿'+fmt0(c.remaining_principal),'accent-cyan')+
    stat('อัตราดอก/วัน',(c.daily_interest_rate*100).toFixed(0)+'%','')+
    stat('ระยะเก็บดอก',c.collection_interval===1?'ทุกวัน':'ทุก '+c.collection_interval+' วัน','')+
    '</div>';

  // contact
  h+='<div class="card card-pad" style="margin-bottom:14px"><div class="detail-grid">';
  h+=dt('เบอร์โทร',c.phone?esc(c.phone):'—');
  h+=dt('Facebook',c.facebook_url?'<a class="link-gold" href="'+esc(c.facebook_url)+'" target="_blank">เปิดลิงก์ ›</a>':'—');
  h+=dt('เลขบัตรประชาชน',c.id_card?esc(c.id_card):'—');
  h+=dt('ธนาคาร',c.bank_name?esc(c.bank_name):'—');
  h+=dt('เลขบัญชี',c.bank_account?'<span class="mono copy-btn" onclick="copyText(\''+esc(c.bank_account)+'\')" title="กดเพื่อคัดลอก">'+esc(c.bank_account)+'</span>':'—');
  h+=dt('วันปล่อยสินเชื่อ',thDate(c.start_date));
  h+=dt('เก็บล่าสุด',c.last_collection_date?thDate(c.last_collection_date):'—');
  h+=dt('ค่าธรรมเนียมบ้าน','฿'+fmt0(c.branch_fee));
  h+='</div></div>';

  // สถานะการโอนเงินให้ลูกค้า (ลูกค้าใหม่ที่ยังรอรับเงิน)
  if(!c.disbursed){
    h+='<div class="card card-pad" style="margin-bottom:14px;border:1px solid rgba(249,115,22,0.3);background:var(--amber-dim)">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">'+
      '<div><div style="font-size:0.9rem;font-weight:600;color:var(--amber)">รอเปิด</div>'+
      '<div style="font-size:0.74rem;color:var(--text2)">ลูกค้าใหม่ — เมื่อโอนเงินให้ลูกค้าแล้ว กดเปิดเพื่อเปลี่ยนเป็น "เปิดแล้ว"</div></div>'+
      (canEdit()?'<button class="btn btn-green btn-sm" style="flex-shrink:0" onclick="setDisbursed(\''+id+'\')">เปิด</button>':'')+
      '</div></div>';
  }

  // close amount
  if(c.status!=='closed'){
    h+='<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">'+
      '<div><div style="font-size:0.84rem;font-weight:500">ยอดปิดสินเชื่อ</div><div style="font-size:0.72rem;color:var(--muted)">ต้น + ดอกวันนี้ + ค่าธรรมเนียม</div></div>'+
      '<div style="font-size:1.3rem;font-weight:700;font-family:var(--font-mono);color:var(--gold)">฿'+fmt(ca)+'</div></div>';
  } else if(c.close_amount){
    h+='<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between"><div style="font-size:0.84rem;font-weight:500">ปิดสินเชื่อแล้ว</div><div style="font-size:1.2rem;font-weight:700;font-family:var(--font-mono);color:var(--muted)">฿'+fmt(c.close_amount)+'</div></div>';
  }

  // actions (manager/owner)
  if(canEdit()&&c.status!=='closed'){
    h+='<div class="card card-pad" style="margin-bottom:14px"><div class="section-label" style="margin:0 0 10px">การดำเนินการ</div><div class="row-flex" style="flex-wrap:wrap;gap:8px">';
    if(c.status==='normal'||c.status==='overdue')h+='<button class="btn btn-amber btn-sm" onclick="changeStatus(\''+id+'\',\'lost\')">เปลี่ยนเป็น "ตาย"</button>';
    h+='<button class="btn btn-gold btn-sm" onclick="openTopup(\''+id+'\')">+ เพิ่มยอด</button>';
    h+='<button class="btn btn-green btn-sm" onclick="doCloseLoan(\''+id+'\')">✓ ปิดสินเชื่อ</button>';
    h+='<button class="btn btn-red btn-sm" onclick="doDeleteCustomer(\''+id+'\')">🗑 ลบลูกค้า</button>';
    h+='</div></div>';
  }
  // ปิดยอดแล้ว → เปิดยอดใหม่ (ปล่อยกู้รอบใหม่ให้คนเดิม) — เฉพาะ owner/head
  if(canEdit()&&c.status==='closed'){
    h+='<div class="card card-pad" style="margin-bottom:14px"><div class="section-label" style="margin:0 0 10px">การดำเนินการ</div>'+
      '<button class="btn btn-gold btn-sm" onclick="openReloan(\''+id+'\')">เปิดยอดใหม่ (ปล่อยกู้รอบใหม่)</button>'+
      '<div class="field-hint" style="margin-top:8px">สร้างสัญญาใหม่ให้ลูกค้าคนนี้ — ประวัติสัญญาเดิมยังเก็บไว้</div></div>';
  }

  // history
  h+='<div class="card"><div class="card-head"><h3>ประวัติการชำระ ('+recs.length+' รายการ)</h3></div>';
  if(!recs.length)h+='<div class="empty">ยังไม่มีประวัติการชำระ</div>';
  else{
    h+='<div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th class="tr-right">ดอกต้องจ่าย</th><th class="tr-right">จ่ายจริง</th><th class="tr-right">ดอกเก็บ</th><th class="tr-right">หักต้น</th><th class="tr-right">ต้นคงเหลือ</th><th class="tr-right">ค่าปรับ</th><th>สถานะ</th></tr></thead><tbody>'+
      recs.map(function(r){return '<tr><td>'+thDate(r.record_date)+'</td>'+
        '<td class="tr-right mono">฿'+fmt(r.interest_due)+'</td>'+
        '<td class="tr-right mono" style="font-weight:600">'+(r.amount_paid>0?'฿'+fmt(r.amount_paid):'—')+'</td>'+
        '<td class="tr-right mono" style="color:var(--green)">'+(r.interest_collected>0?'฿'+fmt(r.interest_collected):'—')+'</td>'+
        '<td class="tr-right mono" style="color:var(--cyan)">'+(r.principal_reduced>0?'฿'+fmt(r.principal_reduced):'—')+'</td>'+
        '<td class="tr-right mono">฿'+fmt(r.remaining_principal)+'</td>'+
        '<td class="tr-right mono" style="color:var(--red)">'+(r.penalty>0?'฿'+fmt(r.penalty):'—')+'</td>'+
        '<td><span class="pst pst-'+r.payment_status+'">'+PSTATUS_LABEL[r.payment_status]+'</span></td></tr>'}).join('')+
      '</tbody></table></div>';
  }
  h+='</div>';

  document.getElementById('detail-content').innerHTML=h;
  openModal('modal-detail');
}
function dt(k,v){return '<div class="dt-item"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>'}

async function changeStatus(id,status){
  var c=allCustomers.find(function(x){return x.id===id});
  var ok=await showConfirm({icon:'✝️',title:'เปลี่ยนสถานะ',msg:'เปลี่ยน "'+c.full_name+'" เป็น "ตาย" (หายติดต่อ)?',okText:'ยืนยัน',okClass:'btn-amber'});
  if(!ok)return;
  var res=await _sb.from('loans').update({status:status}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  toast('✅ อัปเดตสถานะแล้ว','ok');await loadAll();openDetail(id);
}
// ยืนยันว่าโอนเงินให้ลูกค้าใหม่แล้ว (รอเปิด → เปิดแล้ว)
async function setDisbursed(id){
  var c=allCustomers.find(function(x){return x.id===id});
  var ok=await showConfirm({icon:'✅',title:'ยืนยันการโอนเงิน',msg:'ยืนยันว่าได้โอนเงินให้ "'+c.full_name+'" แล้ว?',okText:'เปิด',okClass:'btn-green'});
  if(!ok)return;
  var res=await _sb.from('loans').update({disbursed:true}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  // บันทึก "ยอดเบิก" — เงินที่โอนให้ลูกค้าตอนเปิดสัญญา
  await _sb.from('disbursements').insert({loan_id:id,branch_id:c.branch_id,amount:c.principal,disburse_date:todayISO(),kind:'new',recorded_by:currentUser.id});
  toast('✅ เปลี่ยนเป็น "เปิดแล้ว"','ok');await loadAll();
  if(document.getElementById('modal-detail').classList.contains('open')&&currentDetailId===id)openDetail(id);
}
async function doCloseLoan(id){
  var c=allCustomers.find(function(x){return x.id===id});var ca=closeAmount(c);
  var ok=await showConfirm({icon:'✓',title:'ปิดสินเชื่อ',msg:'ยอดปิดสินเชื่อ ฿'+fmt(ca)+'\nการปิดไม่สามารถยกเลิกได้',okText:'ปิดสินเชื่อ',okClass:'btn-green'});
  if(!ok)return;
  var res=await _sb.from('loans').update({status:'closed',close_amount:ca}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  toast('✅ ปิดสินเชื่อสำเร็จ ยอด ฿'+fmt(ca),'ok');await loadAll();openDetail(id);
}
// เพิ่มยอด — ลูกค้าเดิมขอยอดเพิ่ม (เช่น เปิด 1000 ขอเพิ่มเป็น 2000 → โอนเพิ่ม 1000)
// บันทึกเป็น "ยอดเบิก" (kind=topup) + เพิ่มเข้าเงินต้น/เงินต้นคงเหลือ
function openTopup(id){
  if(!canEdit()){toast('คุณไม่มีสิทธิ์ทำรายการนี้','err');return}
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  closeModal('modal-detail'); // กัน modal ซ้อนกัน
  document.getElementById('modal-topup-body').innerHTML=
    '<div class="field"><label>ยอดที่โอนเพิ่มให้ลูกค้า (บาท)</label><input class="inp mono" id="topup-amount" type="number" min="0" step="0.01" placeholder="0.00" autofocus/></div>'+
    '<div class="field-hint">ยอดนี้จะถูกเพิ่มเข้าเงินต้นของ "'+esc(c.full_name)+'" (ปัจจุบัน ฿'+fmt(c.remaining_principal)+') และนับเป็นยอดเบิกวันนี้</div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-topup\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" id="topup-save-btn" onclick="saveTopup(\''+id+'\')">โอนเพิ่ม</button></div>';
  openModal('modal-topup');
}
async function saveTopup(id){
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  var amt=Math.max(0,parseFloat(document.getElementById('topup-amount').value)||0);
  if(amt<=0){toast('กรุณากรอกยอดที่จะเพิ่ม','err');return}
  var btn=document.getElementById('topup-save-btn');btn.innerHTML='<span class="spin"></span>';btn.disabled=true;
  var res=await _sb.from('loans').update({principal:+c.principal+amt,remaining_principal:+c.remaining_principal+amt}).eq('id',id);
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');btn.disabled=false;btn.textContent='โอนเพิ่ม';return}
  await _sb.from('disbursements').insert({loan_id:id,branch_id:c.branch_id,amount:amt,disburse_date:todayISO(),kind:'topup',recorded_by:currentUser.id});
  toast('✅ เพิ่มยอดสำเร็จ ฿'+fmt(amt),'ok');closeModal('modal-topup');await loadAll();openDetail(id);
}
async function doDeleteCustomer(id){
  var c=allCustomers.find(function(x){return x.id===id});
  var ok=await showConfirm({icon:'🗑',title:'ลบลูกค้า',msg:'ลบ "'+c.full_name+'" และประวัติทั้งหมด?\nไม่สามารถกู้คืนได้',okText:'ลบ',okClass:'btn-red'});
  if(!ok)return;
  var personId=c.person_id;
  var res=await _sb.from('loans').delete().eq('id',id);
  if(res.error){toast('ลบล้มเหลว: '+res.error.message,'err');return}
  // ถ้าคนนี้ไม่มีสัญญาอื่นเหลือแล้ว → ลบข้อมูลคนทิ้งด้วย
  if(personId&&!allLoans.some(function(l){return l.person_id===personId&&l.id!==id})){
    await _sb.from('persons').delete().eq('id',personId);
  }
  toast('✅ ลบลูกค้าแล้ว','ok');closeModal('modal-detail');await loadAll();
}

/* ── customer form ── */
var editingCustId=null;
var reloanPersonId=null; // โหมด "เปิดยอดใหม่" = ปล่อยกู้รอบใหม่ให้ person เดิม
// เปิดยอดใหม่ให้ลูกค้าที่ปิดสินเชื่อแล้ว (เฉพาะ owner/head) — สร้างสัญญาใหม่ เก็บประวัติเดิมไว้
function openReloan(id){
  if(!canEdit()){toast('คุณไม่มีสิทธิ์เปิดยอดใหม่','err');return}
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  openAddCustomer(c);
}
function openAddCustomer(reloanCust){
  if(reloanCust?!canEdit():!canAddCustomer()){toast('คุณไม่มีสิทธิ์ทำรายการนี้','err');return}
  closeModal('modal-detail'); // กัน modal ซ้อนกัน (เปิดยอดใหม่จากหน้ารายละเอียด)
  editingCustId=null;
  reloanPersonId=reloanCust?reloanCust.person_id:null;
  var groups=accessibleGroups();
  if(!groups.length){toast('กรุณาสร้างกองและผูกบ้านเข้ากองก่อน','err');return}
  document.getElementById('modal-customer-title').textContent='+ เพิ่มลูกค้า';
  document.getElementById('modal-customer-body').innerHTML=
      '<div class="form-col-title">ข้อมูลลูกค้า</div>'+
      '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="inp" id="f-name"/><div class="field-err"></div></div>'+
      '<div class="field"><label>เบอร์โทรศัพท์</label><input class="inp" id="f-phone" placeholder="08x-xxx-xxxx"/></div>'+
      '<div class="field"><label>Facebook URL</label><input class="inp" id="f-fb" placeholder="https://facebook.com/..."/></div>'+
      '<div class="field"><label>เลขบัตรประชาชน</label><input class="inp" id="f-idcard" maxlength="13"/></div>'+
      '<div class="field"><label>ชื่อธนาคาร</label><input class="inp" id="f-bank-name" placeholder="เช่น กสิกรไทย, ไทยพาณิชย์..."/></div>'+
      '<div class="field"><label>เลขบัญชี</label><input class="inp mono" id="f-bank-account" placeholder="xxx-x-xxxxx-x"/></div>'+
      '<div class="form-col-title" style="margin-top:20px">ข้อมูลสัญญา</div>'+
      '<div class="field"><label>กอง <span class="req">*</span></label><select class="inp" id="f-group" onchange="custFormBranches()">'+
        groups.map(function(g){return '<option value="'+g.id+'">'+esc(g.name)+'</option>'}).join('')+'</select></div>'+
      '<div class="field"><label>บ้าน <span class="req">*</span></label><select class="inp" id="f-branch"></select></div>'+
      '<div class="field"><label>วงเงินที่ปล่อย (บาท) <span class="req">*</span></label><div class="seg" id="f-principal">'+
        [300,500,1000,1500,2000,2500,3000,3500,4000,4500,5000].map(function(a){return '<button type="button" data-v="'+a+'" onclick="selPrincipal('+a+')">'+fmt0(a)+'</button>'}).join('')+
        '</div><div class="field-err"></div></div>'+
      '<div class="field"><label>อัตราดอกรายวัน</label><input class="inp" value="10% (คงที่)" disabled style="opacity:0.7"/></div>'+
      '<div class="field"><label>ระยะเก็บดอก</label><div class="seg" id="f-interval">'+
        '<button class="sel" data-v="1" onclick="selInterval(1)">ทุกวัน</button>'+
        '<button data-v="2" onclick="selInterval(2)">ทุก 2 วัน</button>'+
        '<button data-v="3" onclick="selInterval(3)">ทุก 3 วัน</button></div></div>'+
      '<div class="field"><label>วันที่ปล่อยสินเชื่อ</label><input class="inp" value="'+thDate(todayISO())+'" disabled style="opacity:0.7"/></div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-customer\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" id="cust-save-btn" onclick="saveCustomer()">เพิ่มลูกค้า</button></div>';
  var mw=document.querySelector('#modal-customer .modal');if(mw)mw.classList.remove('modal-wide');
  var body=document.getElementById('modal-customer-body');body._interval=1;body._principal=null;
  custFormBranches();
  // โหมดเปิดยอดใหม่ → เติมข้อมูลคนเดิม + เปลี่ยนหัวข้อ/ปุ่ม
  if(reloanCust){
    var pp=allPersons.find(function(x){return x.id===reloanCust.person_id})||{};
    var set=function(idn,v){var e=document.getElementById(idn);if(e)e.value=v||''};
    set('f-name',pp.full_name||reloanCust.full_name);set('f-phone',pp.phone);set('f-fb',pp.facebook_url);
    set('f-idcard',pp.id_card);set('f-bank-name',pp.bank_name);set('f-bank-account',pp.bank_account);
    document.getElementById('modal-customer-title').textContent='เปิดยอดใหม่ — '+esc(pp.full_name||reloanCust.full_name||'');
    var sbtn=document.getElementById('cust-save-btn');if(sbtn)sbtn.textContent='เปิดยอดใหม่';
  }
  openModal('modal-customer');
}
// เติมรายการบ้านในฟอร์มเพิ่มลูกค้า ตามกองที่เลือก
function custFormBranches(){
  var gEl=document.getElementById('f-group');if(!gEl)return;
  var gid=gEl.value,bids=myBranchIds();
  var bs=allBranches.filter(function(b){return bids.indexOf(b.id)>=0&&b.group_id===gid});
  document.getElementById('f-branch').innerHTML=bs.length
    ?bs.map(function(b){return '<option value="'+b.id+'">'+esc(b.name)+'</option>'}).join('')
    :'<option value="">— ยังไม่มีบ้านในกองนี้ —</option>';
}
// คนนี้มีสัญญาที่ยังเก็บอยู่ (เปิดใหม่ไปแล้ว) หรือไม่ — ใช้ซ่อนสัญญาเก่าที่ปิดแล้วออกจากแท็บ "ปิดยอด"
function personHasActiveLoan(personId){
  return allLoans.some(function(l){return l.person_id===personId&&(l.status==='normal'||l.status==='overdue')});
}
// คนเดียวกันอาจมีสัญญาที่ปิดแล้วหลายรอบ — โชว์ในแท็บ "ปิดยอด" แค่รอบล่าสุด (กันซ้ำ)
function isLatestClosedLoan(c){
  var sameClosed=allLoans.filter(function(l){return l.person_id===c.person_id&&l.status==='closed'});
  if(sameClosed.length<=1)return true;
  var latest=sameClosed.reduce(function(a,b){
    if(a.start_date!==b.start_date)return a.start_date>b.start_date?a:b;
    return a.seq>b.seq?a:b;
  });
  return latest.id===c.id;
}
// ตรวจกฎกู้หลายที่: ≤2 กอง และ 1 บ้านต่อกอง
function loanRuleError(personId,branchId){
  if(!personId)return null; // คนใหม่ ยังไม่มีสัญญา
  var nb=allBranches.find(function(b){return b.id===branchId}),ng=nb?nb.group_id:null;
  var active=allLoans.filter(function(l){return l.person_id===personId&&l.status!=='closed'});
  var gset={};
  for(var i=0;i<active.length;i++){
    var br=allBranches.find(function(b){return b.id===active[i].branch_id});
    var g=br?br.group_id:null;
    if(g)gset[g]=true;
    if(g&&ng&&g===ng)return 'ลูกค้านี้มีสัญญาที่ยังไม่ปิดในกองนี้อยู่แล้ว (1 กอง กู้ได้ 1 บ้าน)';
  }
  if(ng&&!gset[ng]&&Object.keys(gset).length>=2)return 'ลูกค้านี้กู้ครบ 2 กองแล้ว กู้เพิ่มไม่ได้';
  return null;
}
function openEditCustomer(id){
  if(!canEdit()){toast('คุณไม่มีสิทธิ์แก้ไขลูกค้า','err');return}
  closeModal('modal-detail'); // กัน modal ซ้อนกัน
  editingCustId=id;reloanPersonId=null;
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  var mw=document.querySelector('#modal-customer .modal');if(mw)mw.classList.remove('modal-wide');
  document.getElementById('modal-customer-title').textContent='แก้ แก้ไขลูกค้า';
  document.getElementById('modal-customer-body').innerHTML=
    '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="inp" id="f-name" value="'+esc(c.full_name)+'"/></div>'+
    '<div class="field"><label>เบอร์โทรศัพท์</label><input class="inp" id="f-phone" value="'+esc(c.phone||'')+'"/></div>'+
    '<div class="field"><label>Facebook URL</label><input class="inp" id="f-fb" value="'+esc(c.facebook_url||'')+'"/></div>'+
    '<div class="field"><label>เลขบัตรประชาชน</label><input class="inp" id="f-idcard" maxlength="13" value="'+esc(c.id_card||'')+'"/></div>'+
    '<div class="field"><label>ชื่อธนาคาร</label><input class="inp" id="f-bank-name" value="'+esc(c.bank_name||'')+'"/></div>'+
    '<div class="field"><label>เลขบัญชี</label><input class="inp mono" id="f-bank-account" value="'+esc(c.bank_account||'')+'"/></div>'+
    '<div class="field-hint" style="background:var(--surface);padding:10px;border-radius:8px">หมายเหตุ: ไม่สามารถแก้ไข วงเงิน/อัตราดอก/ระยะเก็บดอก ได้หลังสร้างแล้ว</div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-customer\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" onclick="saveCustomer()">บันทึก</button></div>';
  openModal('modal-customer');
}
function selInterval(v){
  document.querySelectorAll('#f-interval button').forEach(function(b){b.classList.toggle('sel',+b.getAttribute('data-v')===v)});
  document.getElementById('modal-customer-body')._interval=v;
}
function selPrincipal(v){
  document.querySelectorAll('#f-principal button').forEach(function(b){b.classList.toggle('sel',+b.getAttribute('data-v')===v)});
  document.getElementById('modal-customer-body')._principal=v;
}
async function saveCustomer(){
  var name=document.getElementById('f-name').value.trim();
  if(!name){toast('กรุณากรอกชื่อ','err');return}
  var btn=document.getElementById('cust-save-btn');
  var phone=document.getElementById('f-phone').value.trim()||null;
  var fb=document.getElementById('f-fb').value.trim()||null;
  var idcard=document.getElementById('f-idcard').value.trim()||null;
  var bankName=document.getElementById('f-bank-name').value.trim()||null;
  var bankAccount=document.getElementById('f-bank-account').value.trim()||null;

  // โหมดแก้ไข → แก้ที่ตาราง persons (ตัวตนของคน)
  if(editingCustId){
    var cc=allCustomers.find(function(x){return x.id===editingCustId});
    var upd={full_name:name,phone:phone,facebook_url:fb,id_card:idcard,bank_name:bankName,bank_account:bankAccount};
    var res=await _sb.from('persons').update(upd).eq('id',cc.person_id);
    if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');return}
    toast('✅ แก้ไขสำเร็จ','ok');closeModal('modal-customer');await loadAll();openDetail(editingCustId);return;
  }

  var principal=document.getElementById('modal-customer-body')._principal;
  if(!principal||principal<=0){toast('กรุณาเลือกวงเงิน','err');return}
  var branchId=document.getElementById('f-branch').value;
  if(!branchId){toast('กรุณาเลือกบ้าน','err');return}
  var branch=allBranches.find(function(b){return b.id===branchId});
  var interval=document.getElementById('modal-customer-body')._interval||1;

  // โหมดเปิดยอดใหม่ = ใช้ person เดิม · ปกติ = หาจากเลขบัตร เพื่อบังคับกฎกู้หลายที่
  var existing=reloanPersonId?{id:reloanPersonId}:(idcard?allPersons.find(function(p){return p.id_card===idcard}):null);
  var ruleErr=loanRuleError(existing?existing.id:null,branchId);
  if(ruleErr){toast(ruleErr,'err');return}

  var saveLabel=reloanPersonId?'เปิดยอดใหม่':'เพิ่มลูกค้า';
  if(btn){btn.innerHTML='<span class="spin"></span>';btn.disabled=true}

  // หา/สร้าง person
  var personId;
  if(reloanPersonId){
    personId=reloanPersonId;
    await _sb.from('persons').update({full_name:name,phone:phone,facebook_url:fb,id_card:idcard,bank_name:bankName,bank_account:bankAccount}).eq('id',personId);
  }
  else if(existing){
    personId=existing.id;
    if(bankName||bankAccount)await _sb.from('persons').update({bank_name:bankName,bank_account:bankAccount}).eq('id',personId);
  }
  else{
    var pres=await _sb.from('persons').insert({full_name:name,phone:phone,id_card:idcard,facebook_url:fb,bank_name:bankName||null,bank_account:bankAccount||null}).select().single();
    if(pres.error){toast('บันทึกล้มเหลว: '+pres.error.message,'err');if(btn){btn.disabled=false;btn.textContent=saveLabel}return}
    personId=pres.data.id;
  }

  // สร้างสัญญา — seq ให้ฐานข้อมูลกำหนดเอง (รันต่อเนื่องทั้งระบบ)
  var res=await _sb.from('loans').insert({
    person_id:personId,branch_id:branchId,cust_no:nextCustNo(branchId,personId),
    principal:principal,daily_interest_rate:0.10,
    collection_interval:interval,start_date:todayISO(),
    status:'normal',remaining_principal:principal,branch_fee:branch?branch.fee_per_person:0,
    disbursed:false
  }).select().single();
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');if(btn){btn.disabled=false;btn.textContent=saveLabel}return}
  var okMsg=reloanPersonId?'เปิดยอดใหม่สำเร็จ':'✅ เพิ่มลูกค้าสำเร็จ';
  reloanPersonId=null;
  toast(okMsg,'ok');closeModal('modal-customer');await loadAll();openDetail(res.data.id);
}

