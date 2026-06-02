/* ═══════════════════════════════════════════════
   PAGE NAV
═══════════════════════════════════════════════ */
// ทุกส่วนอยู่หน้าเดียว — showPage = เลื่อนไปยังส่วนนั้น
function showPage(name){
  var el=document.getElementById('page-'+name);
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
}

/* ═══════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════ */
function renderDashboard(){
  var date=document.getElementById('dash-date-picker').value||todayISO();
  var fg=document.getElementById('dash-filter-group')?document.getElementById('dash-filter-group').value:'';
  var fb=document.getElementById('dash-filter-branch').value;
  var bids=myBranchIds();
  if(fg) bids=allBranches.filter(function(b){return b.group_id===fg&&bids.indexOf(b.id)>=0}).map(function(b){return b.id});
  if(fb) bids=[fb];

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

  // สรุปยอด 6 ตัว → แถบกระชับติดใต้ header (เลื่อนแนวนอน) — ทุก role เห็นยอดของขอบเขตตัวเอง
  var sb=function(k,v,cls){return '<div class="sbar-item"><span class="sbar-k">'+k+'</span><span class="sbar-v '+cls+'">฿'+fmt0(v)+'</span></div>'};
  document.getElementById('summary-bar').innerHTML='<div class="sbar-scroll">'+
    '<div class="sbar-item sbar-date"><span class="sbar-k">📊 สรุปยอด</span><span class="sbar-v">'+thDate(date)+'</span></div>'+
    sb('รวมรับ',sum.collected+sum.penalty,'gold')+
    sb('ดอก',sum.interest,'green')+
    sb('ค่าปรับ',sum.penalty,'red')+
    sb('ค่าแรง',sum.wage,'purple')+
    sb('ต้นเก็บคืน',sum.principal,'cyan')+
    sb('ต้นคงค้าง',outstanding,'cyan')+
    '</div>';

  // ── หน้าแรกของ staff = โหมดเก็บเงิน (การ์ดคนที่ต้องเก็บวันนี้ กดรับเงินได้เลย) ──
  if(isStaff()){
    document.getElementById('dash-main').innerHTML=staffCollectHTML(date,dueToday,unpaidToday,overdueList,sum);
    return;
  }

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

  // by branch (มุมมองผู้บริหาร)
  if(byBranch.length>1){
    h+='<div class="section-label">แยกตามบ้าน</div><div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>บ้าน</th><th class="tr-right">ดอกที่เก็บได้</th><th class="tr-right">ค่าปรับ</th><th class="tr-right">ค่าแรง</th><th class="tr-right">จ่ายแล้ว</th></tr></thead><tbody>'+
      byBranch.map(function(b){return '<tr><td style="font-weight:500">'+esc(b.name)+'</td><td class="tr-right" style="color:var(--green)">฿'+fmt(b.interest)+'</td><td class="tr-right" style="color:var(--red)">฿'+fmt(b.penalty)+'</td><td class="tr-right" style="color:var(--purple)">฿'+fmt(b.wage)+'</td><td class="tr-right">'+b.paid+' ราย</td></tr>'}).join('')+
      '</tbody></table></div></div>';
  }
  document.getElementById('dash-main').innerHTML=h;
}

// หน้าเก็บเงินของ staff: การ์ดสรุปความคืบหน้า + รายชื่อต้องเก็บ/ค้าง/เก็บแล้ว
function staffCollectHTML(date,dueToday,unpaidToday,overdueList,sum){
  var done=dueToday.length-unpaidToday.length;if(done<0)done=0;
  var pct=dueToday.length?Math.round(done/dueToday.length*100):100;
  var got=sum.collected+sum.penalty;
  var bySeq=function(a,b){return a.seq-b.seq};

  var h='<div class="collect-hero">'+
    '<div class="ch-top"><span class="ch-title">🧰 เก็บเงินวันนี้</span><span class="ch-date">'+thDate(date)+'</span></div>'+
    '<div class="ch-mid"><div class="ch-count">'+done+'<span>/ '+dueToday.length+' ราย</span></div>'+
    '<div class="ch-amt"><span>เก็บได้แล้ว</span><b>฿'+fmt0(got)+'</b></div></div>'+
    '<div class="ch-bar"><i style="width:'+pct+'%"></i></div></div>';

  var todo=unpaidToday.slice().sort(bySeq);
  var inTodo={};todo.forEach(function(c){inTodo[c.id]=1});
  var over=overdueList.filter(function(c){return !inTodo[c.id]&&!custDayStatus(c,date).paid}).sort(bySeq);
  var doneList=dueToday.filter(function(c){return custDayStatus(c,date).paid}).sort(bySeq);

  if(todo.length)
    h+='<div class="section-label">⏰ ต้องเก็บ ('+todo.length+')</div><div class="crow-list">'+
      todo.map(function(c){return custCardHTML(c,date)}).join('')+'</div>';
  if(over.length)
    h+='<div class="section-label" style="color:var(--red)">🔴 ค้างจ่าย ('+over.length+')</div><div class="crow-list">'+
      over.map(function(c){return custCardHTML(c,date)}).join('')+'</div>';
  if(!todo.length&&!over.length)
    h+='<div class="collect-done"><div>🎉</div><div>เยี่ยมมาก! วันนี้เก็บครบแล้ว<br>ไม่มีใครค้าง</div></div>';
  if(doneList.length)
    h+='<div class="section-label">✅ เก็บแล้ววันนี้ ('+doneList.length+')</div><div class="crow-list">'+
      doneList.map(function(c){return custCardHTML(c,date)}).join('')+'</div>';
  return h;
}
function stat(label,value,accent,sub){
  return '<div class="stat '+(accent||'')+'"><span class="label">'+label+'</span><span class="value">'+value+'</span>'+(sub?'<span class="sub">'+sub+'</span>':'')+'</div>';
}

