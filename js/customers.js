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
function setCustGroup(id){custGroupId=id;custBranchId='';custRenderLimit=CUST_CHUNK;renderCustGroupBtns();renderCustBranchBtns();renderCustomers();renderDashboard();}

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
function setCustBranch(id){custBranchId=id;custRenderLimit=CUST_CHUNK;renderCustBranchBtns();renderCustomers();renderDashboard();}

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
  // index รายการชำระของวันนั้นครั้งเดียว (O(records)) แทนสแกน allRecords ซ้ำต่อลูกค้า (O(customers×records))
  var vdate=selDate();
  var recsByCust={};
  allRecords.forEach(function(r){if(r.record_date===vdate)(recsByCust[r.customer_id]||(recsByCust[r.customer_id]=[])).push(r)});
  var stMap={};
  list.forEach(function(c){stMap[c.id]=custDayStatus(c,vdate,recsByCust[c.id]||[])});
  // เตรียม lookup กติกา "ปิดยอด" ครั้งเดียว — คิดแยกต่อ "คน+บ้าน" (รองรับลูกค้าหลายบ้าน):
  // ปิดที่บ้านนี้แต่ยังมีสัญญาค้างบ้านอื่น = ยังโชว์ในปิดยอดของบ้านนี้ · กู้ซ้ำบ้านเดิม = dedup เหลือรอบปิดล่าสุด
  var activeInBranch={},latestClosed={};
  allLoans.forEach(function(l){
    var k=l.person_id+'|'+l.branch_id;
    if(l.status==='normal'||l.status==='overdue')activeInBranch[k]=1;  // lost ไม่นับเป็นสัญญาเปิด (เหมือนกติกาเดิม)
    if(l.status!=='closed')return;
    var cur=latestClosed[k];
    if(!cur||(l.start_date||'')>(cur.start_date||'')||((l.start_date||'')===(cur.start_date||'')&&l.seq>cur.seq))latestClosed[k]=l;
  });
  // สัญญาปิดที่ควรโชว์ = คนนั้นไม่มีสัญญาเปิดค้าง "ในบ้านเดียวกัน" + เป็นรอบปิดล่าสุดของบ้านนั้น
  function closedVisible(c){var k=c.person_id+'|'+c.branch_id;return c.status==='closed'&&!activeInBranch[k]&&latestClosed[k]&&latestClosed[k].id===c.id}

  // ตรรกะแต่ละมุมมอง (ใช้ร่วมกันทั้งชิปและการกรองรายการ)
  function inView(c,v){
    var s=stMap[c.id];
    // "รอโอน" (ยังไม่ยืนยันโอนเงิน) = ชิปของตัวเอง — ไม่ปนกับลิสต์เก็บเงินและไม่ปนกับ "ปิดยอด"
    if(v==='pending')return s.pending;
    if(v==='today')return s.due&&!s.paid&&!s.pending;
    // "จ่ายล่วงหน้า" — วันครบกำหนดถูกเลื่อนเลยวันที่ดูไปแล้ว (จากสวิตช์จ่ายล่วงหน้า) · จ่ายตรงงวดปกติไม่นับ
    if(v==='advance')return s.ahead&&!s.pending;
    if(v==='overdue')return c.status==='overdue'&&!s.paid&&!s.pending;
    if(v==='new')return s.isNew&&!s.pending&&c.status!=='closed'&&c.status!=='lost';
    if(v==='old')return !s.isNew&&!s.pending&&c.status!=='closed'&&c.status!=='lost';
    if(v==='closed')return closedVisible(c);
    if(v==='dead')return c.status==='lost';
    return true;
  }

  // ชิปกรองด่วน — default = ที่ถึงกำหนดในวันที่ดู · กดแช่ (มือถือ) หรือลากเมาส์ เพื่อจัดลำดับเอง จำไว้ต่อเครื่อง
  var chips=sortChipsByPref([['today','ถึงกำหนด'],['pending','รอโอน'],['advance','จ่ายล่วงหน้า'],['overdue','ค้าง'],['new','ลูกค้าใหม่'],['old','ลูกค้าเก่า'],['closed','ปิดยอด'],['dead','ตาย']]);
  var chipWrap=document.getElementById('cust-summary');
  chipWrap.innerHTML=chips.map(function(v){
    var n=list.filter(function(c){return inView(c,v[0])}).length;
    return '<button class="vchip vc-'+v[0]+(custView===v[0]?' active':'')+'" data-vk="'+v[0]+'">'+v[1]+' <b>'+n+'</b></button>';
  }).join('');
  makeChipsSortable(chipWrap);

  // กรองตามมุมมองที่เลือก (ถ้ากำลังค้นหา → แสดงทุกผลลัพธ์ ไม่ตัดด้วยมุมมอง)
  // ตอนค้นหา → ข้ามตัวกรองมุมมอง แต่ยัง dedup สัญญา "ปิดแล้ว" ซ้ำของคนเดียวกัน (โชว์เฉพาะรอบล่าสุด กันรายการบาน)
  function searchVisible(c){return c.status!=='closed'||closedVisible(c);}
  var vlist=list.filter(function(c){return search?searchVisible(c):inView(c,custView)});
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
  // วาดเป็นช่วง — เกินลิมิตซ่อนไว้หลังปุ่ม "แสดงเพิ่ม" (ลูกค้าหลายร้อยรายไม่หน่วง)
  var totalN=vlist.length,shown=vlist.slice(0,custRenderLimit);
  var moreBtn=totalN>shown.length
    ?'<div style="text-align:center;padding:12px"><button class="btn btn-ghost btn-sm" onclick="custShowMore()">แสดงเพิ่ม (เหลืออีก '+(totalN-shown.length)+' รายการ)</button></div>':'';
  // ตาราง (จอใหญ่)
  document.getElementById('cust-list').innerHTML=
    '<table class="tbl"><thead><tr><th>รหัส</th><th>ชื่อ-สกุล</th><th class="tr-right">ต้นคงเหลือ</th><th class="tr-right">ดอก/งวด</th><th class="tr-right">ยอดปิด</th><th>สถานะ</th><th></th></tr></thead><tbody>'+
    shown.map(function(c){var s=stMap[c.id];
      var interest=interestPerCycle(c);      // คอลัมน์ "ดอก/งวด" = ต่องวดเสมอ (ยอดค้างสะสมดูตอนกดรับเงิน)
      var close=closeAmount(c,vdate);        // ยอดปิดรวมดอกค้างสะสม ณ วันที่ดู
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
      if(c.status==='closed')actBtn=canAddCustomer()?'<button class="btn btn-gold btn-sm" onclick="event.stopPropagation();openReloan(\''+c.id+'\')">เปิดใหม่</button>':viewBtn;
      else if(s.pending)actBtn='<div class="row-flex" style="gap:6px">'+(canTopupClose()?'<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openTopup(\''+c.id+'\')">+ เพิ่มยอด</button>':'')+(canDisburse()?'<button class="btn btn-green btn-sm" onclick="event.stopPropagation();setDisbursed(\''+c.id+'\')">เปิด</button>':'')+'</div>';
      else if(c.status==='lost')actBtn=canReturnCredit()?'<button class="btn btn-cyan btn-sm" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+vdate+'\')">คืนเครดิต</button>':viewBtn;
      else actBtn=canEdit()?'<button class="btn '+(s.paid?'btn-purple':'btn-gold')+' btn-sm" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+vdate+'\')">'+(s.paid?'จ่ายเพิ่ม':'รับเงิน')+'</button>':viewBtn;
      return '<tr style="cursor:pointer" onclick="openDetail(\''+c.id+'\')">'+
      '<td class="mono" style="color:var(--muted)">'+esc(custCode(c))+'</td>'+
      '<td><div style="font-weight:500">'+esc(c.full_name)+(c.principal_only?' <span style="font-size:0.62rem;font-weight:700;color:var(--cyan);border:1px solid var(--cyan);border-radius:99px;padding:1px 6px;vertical-align:middle">ผ่อนต้น</span>':'')+'</div>'+(c.phone?'<div style="font-size:0.72rem;color:var(--muted)">'+esc(c.phone)+'</div>':'')+'<div style="font-size:0.7rem;color:var(--muted)">'+esc(groupNameOfBranch(c.branch_id))+' · '+esc(branchName(c.branch_id))+'</div></td>'+
      '<td class="tr-right mono" style="font-weight:600">฿'+fmt(c.remaining_principal)+'</td>'+
      '<td class="tr-right mono" style="color:var(--green)">฿'+fmt(interest)+'</td>'+
      '<td class="tr-right mono" style="color:var(--gold);font-weight:600">฿'+fmt(close)+'</td>'+
      '<td><span class="st st-'+(s.pending?'pending':(s.ahead?'advance':c.status))+'" data-tip="'+esc(tip)+'">'+(s.pending?'รอเปิด':(s.ahead?'จ่ายล่วงหน้า':STATUS_LABEL[c.status]))+(daysOver>0?' +'+daysOver+'ว':'')+'</span></td>'+
      '<td>'+actBtn+'</td></tr>'}).join('')+
    '</tbody></table>'+moreBtn;
  // การ์ดกระชับ (มือถือ) — แตะแถวเพื่อดูรายละเอียด, ปุ่มขวาเพื่อรับเงิน
  document.getElementById('cust-list-cards').innerHTML=
    shown.map(function(c){return custCardHTML(c,vdate,stMap[c.id])}).join('')+moreBtn;
}
function setCustView(v){custView=v;custRenderLimit=CUST_CHUNK;renderCustomers()}

/* ═══ วาดลิสต์เป็นช่วง — ลูกค้าหลายร้อยรายไม่หน่วง ═══ */
var CUST_CHUNK=80;                 // จำนวนที่วาดต่อรอบ (พอเต็มหลายจอ — ที่เหลือกด "แสดงเพิ่ม")
var custRenderLimit=CUST_CHUNK;
function custShowMore(){custRenderLimit+=200;renderCustomers()}
// ค้นหาแบบหน่วง — พิมพ์เสร็จค่อยวาด (เดิมวาดลิสต์ทั้งหมดใหม่ทุกตัวอักษร = หน่วงบนมือถือ)
var _custSearchT=null;
function custSearchInput(){
  clearTimeout(_custSearchT);
  _custSearchT=setTimeout(function(){custRenderLimit=CUST_CHUNK;renderCustomers()},250);
}

/* ═══ ชิปกรอง: ลากจัดลำดับได้ (จำต่อเครื่องด้วย localStorage) ═══
   มือถือ = กดแช่ ~0.35 วิแล้วลาก (ขยับก่อนครบเวลา = เลื่อนจอปกติ) · เมาส์ = ลากได้ทันที · คลิกธรรมดา = สลับมุมมองเหมือนเดิม */
var CHIP_ORDER_KEY='cust_chip_order';
function sortChipsByPref(chips){
  var ord=[];try{ord=JSON.parse(localStorage.getItem(CHIP_ORDER_KEY))||[]}catch(e){}
  if(!ord.length)return chips;
  return chips.slice().sort(function(a,b){
    var ia=ord.indexOf(a[0]),ib=ord.indexOf(b[0]);
    if(ia<0)ia=ord.length+chips.findIndex(function(c){return c[0]===a[0]});  // คีย์ใหม่ที่ยังไม่เคยจัด = ต่อท้ายตามลำดับ default
    if(ib<0)ib=ord.length+chips.findIndex(function(c){return c[0]===b[0]});
    return ia-ib;
  });
}
// หา chip ที่ควรวาง "ก่อนหน้า" ตามตำแหน่ง pointer — รองรับทั้งแถวเดียว (มือถือ) และหลายแถวแบบ wrap (PC)
function chipDragAfter(list,x,y){
  var els=[].slice.call(list.querySelectorAll('.vchip:not(.chip-dragging)'));
  for(var i=0;i<els.length;i++){
    var b=els[i].getBoundingClientRect();
    if(y<b.top-4)return els[i];                          // อยู่แถวถัดลงไป → วางก่อนตัวแรกของแถวนั้น
    if(y<=b.bottom+4&&x<b.left+b.width/2)return els[i];  // แถวเดียวกัน อยู่ก่อนกึ่งกลางชิปนี้
  }
  return null;
}
function makeChipsSortable(list){
  if(!list._chipWired){  // ผูกครั้งเดียวที่ container (innerHTML เปลี่ยนได้เรื่อยๆ)
    list._chipWired=true;
    list.addEventListener('click',function(e){
      if(Date.now()-(list._dragEndAt||0)<300)return;     // เพิ่งลากเสร็จ = ไม่ใช่คลิกเปลี่ยนมุมมอง
      var c=e.target.closest('.vchip');if(c)setCustView(c.getAttribute('data-vk'));
    });
    // ระหว่างลากบนจอทัช ต้องกันเบราว์เซอร์แย่งไป scroll (non-passive ถึง preventDefault ได้)
    list.addEventListener('touchmove',function(e){if(list._chipDragging)e.preventDefault()},{passive:false});
  }
  list.querySelectorAll('.vchip').forEach(function(chip){
    chip.addEventListener('pointerdown',function(e){
      var sx=e.clientX,sy=e.clientY,started=false;
      var timer=setTimeout(start,350);
      function start(){started=true;list._chipDragging=true;chip.classList.add('chip-dragging');}
      function move(ev){
        if(!started){
          var dx=Math.abs(ev.clientX-sx),dy=Math.abs(ev.clientY-sy);
          if(e.pointerType==='mouse'&&(dx>6||dy>6))start();  // เมาส์ = ลากได้ทันทีไม่ต้องกดแช่
          else if(dx>10||dy>10)end();                        // ทัชขยับก่อนครบเวลา = ตั้งใจเลื่อนจอ ยกเลิกลาก
          return;
        }
        var after=chipDragAfter(list,ev.clientX,ev.clientY);
        if(after==null)list.appendChild(chip);else list.insertBefore(chip,after);
      }
      function up(){
        if(started){
          list._dragEndAt=Date.now();
          var order=[].slice.call(list.querySelectorAll('.vchip')).map(function(x){return x.getAttribute('data-vk')});
          try{localStorage.setItem(CHIP_ORDER_KEY,JSON.stringify(order))}catch(e2){}
        }
        end();
      }
      function end(){
        clearTimeout(timer);list._chipDragging=false;chip.classList.remove('chip-dragging');
        document.removeEventListener('pointermove',move);
        document.removeEventListener('pointerup',up);
        document.removeEventListener('pointercancel',end);
      }
      document.addEventListener('pointermove',move);
      document.addEventListener('pointerup',up);
      document.addEventListener('pointercancel',end);
    });
  });
}

// สถานะของลูกค้า ณ วันที่กำหนด (ใช้ร่วมหน้าลูกค้า + หน้าเก็บเงินของ staff)
function custDayStatus(c,date,preRecs){
  // วันหนึ่งอาจมีหลายรายการ (จ่ายเพิ่ม) — รวมยอด · preRecs = index ที่เตรียมไว้แล้ว (กันสแกน allRecords ซ้ำต่อลูกค้า)
  var recs=preRecs||allRecords.filter(function(r){return r.customer_id===c.id&&r.record_date===date});
  var paidAmount=recs.reduce(function(s,r){return s+ +(r.amount_paid||0)},0);
  return {
    recs:recs,
    paidAmount:round2(paidAmount),
    recCount:recs.length,
    paid:paidAmount>0,
    due:c.status!=='closed'&&c.status!=='lost'&&isPaymentDueToday(c,date),
    ahead:isPaidAhead(c,date),   // จ่ายล่วงหน้าไว้ — วันครบกำหนดเลื่อนเลยวันที่ดูไปแล้ว
    isNew:c.start_date===date,   // ลูกค้าที่เข้ามาในวันนี้
    pending:!c.disbursed&&c.status!=='closed'  // รอเปิด — รอยืนยันโอนเงิน · สัญญาที่ปิดแล้วไม่นับ (เคสเปิด-ปิดวันเดียวโดยไม่เคยกดเปิด จะได้ไม่ค้างในชิป "รอโอน")
  };
}
// การ์ดลูกค้าแบบลิสต์ (มือถือ + หน้าเก็บเงิน staff) — แตะดูรายละเอียด, ปุ่มขวารับเงิน
function custCardHTML(c,date,s){
  s=s||custDayStatus(c,date);
  var ival=c.collection_interval===1?'ทุกวัน':'ทุก '+c.collection_interval+'ว';
  // วันค้าง (เดิมซ่อนใน tooltip ของตาราง — มือถือเข้าไม่ถึง จึงโชว์บนการ์ดด้วย)
  var ref=c.last_collection_date||c.start_date;
  var daysOver=ref?(daysBetween(ref,date)-c.collection_interval):0;
  // "ค้าง" (สีแดง) ต้องชนะ "ถึงกำหนด" (สีเหลือง) — คนเลยกำหนดแล้วให้เห็นเป็นค้างชัดๆ ไม่ใช่ถึงกำหนดธรรมดา
  var isOver=c.status==='overdue'&&!s.paid&&!s.pending;
  var cls=s.pending?'pending':(s.paid?'paid':(isOver?'over':(s.due?'due':(c.status==='lost'?'over':''))));
  var chip=s.pending?'<span class="crow-st t-pending">รอเปิด</span>'
    :(s.paid?'<span class="crow-st t-paid">จ่ายแล้ว ฿'+fmt(s.paidAmount)+(s.recCount>1?' ('+s.recCount+')':'')+'</span>'
    :(isOver?'<span class="crow-st t-over">ค้าง'+(daysOver>0?' '+daysOver+'ว':'')+'</span>'
    :(s.due?'<span class="crow-st t-due">ถึงกำหนด'+(daysOver>0?' +'+daysOver+'ว':'')+'</span>'
    :(c.status==='lost'?'<span class="crow-st t-dead">ตาย</span>'
    :(c.status==='closed'?'<span class="crow-st t-paid">'+(c.was_lost?'คืนเครดิต':'ปิดยอด')+'</span>'
    :(s.ahead?'<span class="crow-st t-advance">จ่ายล่วงหน้า</span>':''))))));
  // ส่วนหัวการ์ด (avatar + ชื่อ + รายละเอียด) — ใช้ร่วมทุกแบบ
  var head='<div class="crow-ava">'+esc(custCode(c))+'</div>'+
    '<div class="crow-main">'+
      '<div class="crow-l1"><span class="crow-name">'+esc(c.full_name)+'</span>'+chip+'</div>'+
      '<div class="crow-l2">คงเหลือ <b>฿'+fmt(c.remaining_principal)+'</b> · '+esc(branchName(c.branch_id))+' · '+(c.principal_only?'<span style="color:var(--cyan)">ผ่อนต้น</span>':ival)+'</div>'+
    '</div>';

  // ★ ต้องเก็บวันนี้ (ยังไม่จ่าย) = การ์ดพระเอก: โชว์ยอดดอกที่ต้องเก็บตัวโต + ปุ่มรับเงินเด่น
  if(s.due&&!s.pending){
    return '<div class="crow due big" onclick="openDetail(\''+c.id+'\')">'+
      '<div class="crow-top">'+head+'</div>'+
      '<div class="crow-act" onclick="event.stopPropagation()">'+
        '<div class="crow-due"><span>'+(c.principal_only?'ผ่อนต้น (เหลือ)':'ดอกที่ต้องเก็บวันนี้')+'</span><b><span class="cur">฿</span>'+fmt(c.principal_only?c.remaining_principal:interestDue(c,date))+'</b></div>'+
        '<button class="crow-btn cb-pay" onclick="openPayment(\''+c.id+'\',\''+date+'\')">'+(c.principal_only?'ผ่อนต้น':'รับเงิน')+'</button>'+
      '</div></div>';
  }

  // อื่นๆ = แถวกระชับ
  var btn;
  if(c.status==='closed')btn=canAddCustomer()?'<button class="crow-btn cb-pay" onclick="event.stopPropagation();openReloan(\''+c.id+'\')">เปิดใหม่</button>':'';
  else if(s.pending)btn=(canTopupClose()?'<button class="crow-btn cb-edit" onclick="event.stopPropagation();openTopup(\''+c.id+'\')">+ เพิ่มยอด</button>':'')+(canDisburse()?'<button class="crow-btn cb-confirm" onclick="event.stopPropagation();setDisbursed(\''+c.id+'\')">เปิด</button>':'');
  else if(c.status==='lost')btn=canReturnCredit()?'<button class="crow-btn cb-credit" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+date+'\')">คืนเครดิต</button>':'';
  else if(s.paid)btn='<button class="crow-btn cb-pay-extra" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+date+'\')">จ่ายเพิ่ม</button>';
  else btn='<button class="crow-btn cb-pay" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+date+'\')">รับ</button>';
  return '<div class="crow '+cls+'" onclick="openDetail(\''+c.id+'\')">'+head+btn+'</div>';
}

function openDetail(id){
  currentDetailId=id;
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  // ประวัติข้ามสัญญา — รวมรายการชำระของทุกสัญญาของคนเดียวกัน (เปิดยอดใหม่/หลายบ้าน ประวัติอยู่ที่เดียว)
  // ป้ายกำกับแถว: หลายบ้าน = ชื่อบ้าน · กู้ซ้ำบ้านเดิมหลายรอบ = "รอบ N" · ผสมกัน = "บ้าน · รอบ N"
  var personLoans=allCustomers.filter(function(x){return x.person_id===c.person_id}).slice()
    .sort(function(a,b){return (a.start_date||'').localeCompare(b.start_date||'')||(a.seq-b.seq)});
  var branchLoanCount={};personLoans.forEach(function(l){branchLoanCount[l.branch_id]=(branchLoanCount[l.branch_id]||0)+1;});
  var multiBranch=Object.keys(branchLoanCount).length>1;
  var recTag={};                                    // loan id → ป้ายที่โชว์ใต้วันที่ ('' = ไม่ต้องมี)
  var perBranchRound={};
  personLoans.forEach(function(l){
    perBranchRound[l.branch_id]=(perBranchRound[l.branch_id]||0)+1;
    var parts=[];
    if(multiBranch)parts.push(branchName(l.branch_id));
    if(branchLoanCount[l.branch_id]>1)parts.push('รอบ '+perBranchRound[l.branch_id]);
    recTag[l.id]=parts.join(' · ');
  });
  var loanIds=personLoans.map(function(l){return l.id});
  var recs=allRecords.filter(function(r){return loanIds.indexOf(r.customer_id)>=0}).sort(function(a,b){return b.record_date.localeCompare(a.record_date)||(b.created_at||'').localeCompare(a.created_at||'')});
  var ca=closeAmount(c);

  var h='<div class="page-head" style="margin-bottom:14px"><div>'+
    '<div class="row-flex" style="gap:8px;flex-wrap:wrap"><span class="mono" style="color:var(--muted)">'+esc(custCode(c))+'</span>'+
    '<span class="page-title" style="font-size:1.3rem">'+esc(c.full_name)+'</span>'+
    '<span class="st st-'+(isPaidAhead(c)?'advance':c.status)+'">'+(isPaidAhead(c)?'จ่ายล่วงหน้า':STATUS_LABEL[c.status])+'</span>'+
    (c.principal_only&&c.status!=='closed'?'<span class="st" style="background:rgba(34,211,238,0.15);color:var(--cyan)">ผ่อนต้น · ไม่คิดดอก</span>':'')+
    (c.was_lost&&c.status==='closed'?'<span class="st" style="background:rgba(34,197,94,0.15);color:var(--green)">คืนเครดิต (เคยตาย)</span>':'')+
    (!c.disbursed?'<span class="st st-pending">รอเปิด</span>':'')+'</div>'+
    '<div class="page-sub">'+esc(groupNameOfBranch(c.branch_id))+' · '+esc(branchName(c.branch_id))+'</div></div>';
  if(canEditCustomerInfo()&&c.status!=='closed')h+='<button class="btn btn-ghost btn-sm" onclick="openEditCustomer(\''+id+'\')">แก้ไข</button>';
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
  h+=dt('ลิงก์กลุ่มเฟส',c.fb_group_url?'<a class="link-gold" href="'+esc(c.fb_group_url)+'" target="_blank">เปิดกลุ่ม ›</a>':'—');
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
      (canDisburse()?'<button class="btn btn-green btn-sm" style="flex-shrink:0" onclick="setDisbursed(\''+id+'\')">เปิด</button>':'')+
      '</div></div>';
  }

  // close amount
  if(c.status!=='closed'){
    h+='<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">'+
      '<div><div style="font-size:0.84rem;font-weight:500">'+(c.principal_only?'เหลือผ่อนต้น':'ยอดปิดสินเชื่อ')+'</div><div style="font-size:0.72rem;color:var(--muted)">'+(c.principal_only?'เงินต้นคงเหลือ (ไม่คิดดอก)':'ต้น + ดอกวันนี้ + ค่าธรรมเนียม')+'</div></div>'+
      '<div style="font-size:1.3rem;font-weight:700;font-family:var(--font-mono);color:var(--gold)">฿'+fmt(ca)+'</div></div>';
  } else if(c.close_amount){
    h+='<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between"><div style="font-size:0.84rem;font-weight:500">ปิดสินเชื่อแล้ว'+(c.was_lost?' <span style="color:var(--green)">· คืนเครดิต (เคยตาย)</span>':'')+'</div><div style="font-size:1.2rem;font-weight:700;font-family:var(--font-mono);color:var(--muted)">฿'+fmt(c.close_amount)+'</div></div>';
  }

  // actions — พนักงานกดได้เฉพาะปุ่ม "ตาย" · คืนเครดิต/เพิ่มยอด/ปิด/ลบ เฉพาะ owner/หัวหน้ากอง/หัวหน้าสาย
  // จัดกลุ่ม: ปุ่มหลัก (คืนเครดิต/เพิ่มยอด/ปิด) แยกจากโซนอันตราย (ตาย/ลบ) ด้วยเส้นคั่น
  if(c.status!=='closed'){
    var ops='',danger='',hint='';
    // กลุ่มหลัก — คืนเครดิต (รับเงินเต็มยอดลูกค้าตาย) = Owner + หัวหน้ากอง
    if(c.status==='lost'&&canReturnCredit()){
      ops+='<button class="btn btn-cyan btn-sm" onclick="openPayment(\''+id+'\',\''+todayISO()+'\')">💳 คืนเครดิต (รับเงินเต็ม)</button>';
      hint='<div class="field-hint" style="margin-top:8px">คืนเครดิต = ลูกค้าจ่าย <b>ต้น + ดอก + ค่าปรับ</b> ครบยอดปิด → ปิดสัญญา (ระบบเก็บประวัติว่าเคยตาย) · จ่ายไม่ครบจะยังคงสถานะตาย</div>';
    }
    // ปิดสัญญาโดยไม่ได้รับเงิน (ตัดหนี้สูญ) — เฉพาะ Owner เท่านั้น ต่างจากคืนเครดิตที่ต้องจ่ายเต็มยอด
    if(c.status==='lost'&&isOwner()){
      ops+='<button class="btn btn-ghost btn-sm" onclick="closeLostLoan(\''+id+'\')">✕ ปิดสัญญา (ตัดหนี้สูญ)</button>';
      hint+='<div class="field-hint" style="margin-top:8px">ปิดสัญญา (ตัดหนี้สูญ) = ปิดสัญญาทันทีโดย<b>ไม่ได้รับเงินคืน</b> ใช้เมื่อแน่ใจว่าเรียกเก็บไม่ได้แล้ว</div>';
    }
    if(c.status!=='lost'){
      // เพิ่มยอด/ปิดสินเชื่อ — เฉพาะ owner/หัวหน้ากอง (ปิดสัญญาผ่านการรับเงินครบยอดปิดยังทำได้ตามปกติทุก role)
      if(canTopupClose())ops+='<button class="btn btn-purple btn-sm" onclick="openTopup(\''+id+'\')">+ เพิ่มยอด</button>';
      if(canTopupClose())ops+='<button class="btn btn-green btn-sm" onclick="doCloseLoan(\''+id+'\')">✓ ปิดสินเชื่อ</button>';
      // พลาดกดเปิด (ยืนยันโอน) ก่อนโอนจริง → ย้อนกลับเป็น "รอโอน" ได้ ตราบใดที่ยังไม่มีประวัติรับเงิน
      if(canDisburse()&&c.disbursed&&!allRecords.some(function(r){return r.customer_id===id})){
        ops+='<button class="btn btn-ghost btn-sm" onclick="undoDisburse(\''+id+'\')">↩️ ยกเลิกเปิด (กลับเป็นรอโอน)</button>';
      }
      // โหมดผ่อนต้น (หยุดคิดดอก) — Owner + หัวหน้ากอง (ในกองตัวเอง)
      if(isOwner()||isHead()){
        if(c.principal_only){ops+='<button class="btn btn-ghost btn-sm" onclick="setPrincipalOnly(\''+id+'\',false)">↩️ ยกเลิกผ่อนต้น (คิดดอกปกติ)</button>';
          hint='<div class="field-hint" style="margin-top:8px"><b style="color:var(--cyan)">โหมดผ่อนต้น</b> = หยุดคิดดอก · เงินที่จ่ายลดต้นทั้งหมด · ปิดสัญญาอัตโนมัติเมื่อต้นหมด</div>';}
        else ops+='<button class="btn btn-cyan btn-sm" onclick="setPrincipalOnly(\''+id+'\',true)">📉 เปลี่ยนเป็นผ่อนต้น</button>';
      }
    }
    // โซนอันตราย — "ตาย" ทุก role กดได้ · "ลบลูกค้า" = Owner + หัวหน้ากอง
    if(c.status==='normal'||c.status==='overdue')danger+='<button class="btn btn-amber btn-sm" onclick="changeStatus(\''+id+'\',\'lost\')">เปลี่ยนเป็น "ตาย"</button>';
    if(canDelete())danger+='<button class="btn btn-red btn-sm" onclick="doDeleteCustomer(\''+id+'\')">🗑 ลบลูกค้า</button>';
    if(ops||danger){
      h+='<div class="card card-pad" style="margin-bottom:14px"><div class="section-label" style="margin:0 0 10px">การดำเนินการ</div>';
      if(ops)h+='<div class="row-flex" style="flex-wrap:wrap;gap:8px">'+ops+'</div>'+hint;
      if(danger)h+='<div class="row-flex" style="flex-wrap:wrap;gap:8px'+(ops?';margin-top:10px;padding-top:10px;border-top:1px solid var(--border)':'')+'">'+danger+'</div>';
      h+='</div>';
    }
  }
  // ปิดยอดแล้ว → เปิดยอดใหม่ (ปล่อยกู้รอบใหม่ให้คนเดิม) — ทุก role (Owner ค่อยยืนยันโอนทีหลัง)
  if(canAddCustomer()&&c.status==='closed'){
    h+='<div class="card card-pad" style="margin-bottom:14px"><div class="section-label" style="margin:0 0 10px">การดำเนินการ</div>'+
      '<button class="btn btn-gold btn-sm" onclick="openReloan(\''+id+'\')">เปิดยอดใหม่ (ปล่อยกู้รอบใหม่)</button>'+
      '<div class="field-hint" style="margin-top:8px">สร้างสัญญาใหม่ให้ลูกค้าคนนี้ — ประวัติสัญญาเดิมยังเก็บไว้</div></div>';
  }

  // history
  h+='<div class="card"><div class="card-head"><h3>ประวัติการชำระ ('+recs.length+' รายการ) <span style="font-size:0.7rem;font-weight:400;color:var(--muted)">· เก็บย้อนหลัง '+RETENTION_MONTHS+' เดือน</span></h3></div>';
  if(!recs.length)h+='<div class="empty">ยังไม่มีประวัติการชำระ</div>';
  else{
    h+='<div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th class="tr-right">ดอกต้องจ่าย</th><th class="tr-right">จ่ายจริง</th><th class="tr-right">ดอกเก็บ</th><th class="tr-right">หักต้น</th><th class="tr-right">ต้นคงเหลือ</th><th class="tr-right">ค่าปรับ</th><th>สถานะ</th></tr></thead><tbody>'+
      recs.map(function(r){return '<tr><td>'+thDate(r.record_date)+(r.created_at?'<div style="font-size:0.68rem;color:var(--muted)">'+hhmm(r.created_at)+'</div>':'')+(recTag[r.customer_id]?'<div style="font-size:0.66rem;color:var(--gold)">'+esc(recTag[r.customer_id])+'</div>':'')+'</td>'+
        '<td class="tr-right mono">฿'+fmt(r.interest_due)+'</td>'+
        '<td class="tr-right mono" style="font-weight:600">'+(r.amount_paid>0?'฿'+fmt(r.amount_paid):'—')+'</td>'+
        '<td class="tr-right mono" style="color:var(--green)">'+(r.interest_collected>0?'฿'+fmt(r.interest_collected):'—')+'</td>'+
        '<td class="tr-right mono" style="color:var(--cyan)">'+(r.principal_reduced>0?'฿'+fmt(r.principal_reduced):'—')+'</td>'+
        '<td class="tr-right mono">฿'+fmt(r.remaining_principal)+'</td>'+
        '<td class="tr-right mono" style="color:var(--red)">'+(r.penalty>0?'฿'+fmt(r.penalty):'—')+'</td>'+
        '<td>'+(function(){
          // record เก่าก่อนแก้บั๊ก: ตอนปิดสัญญาเก็บ 'overpaid' + ต้นเหลือ 0 → แสดง "ปิดสัญญา" ให้ตรงความจริง
          var ps=(r.payment_status==='overpaid'&&+r.remaining_principal===0)?'closed':r.payment_status;
          var lbl=ps==='advance'&&r.advance_cycles>0?'ล่วงหน้า +'+r.advance_cycles+' งวด':PSTATUS_LABEL[ps];
          return '<span class="pst pst-'+ps+'">'+lbl+'</span>';
        })()+'</td></tr>'}).join('')+
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
  // เก็บประวัติ "เคยตาย" ไว้ถาวร (ใช้โชว์ป้ายคืนเครดิตหลังปิด) — แยก update แบบ fail-safe เผื่อยังไม่รัน migration phase7
  if(status==='lost')await _sb.from('loans').update({was_lost:true}).eq('id',id);
  // วันที่เปลี่ยนเป็น "ตาย" — ใช้แช่แข็งดอกไม่ให้วิ่งต่อ (cyclesDue) · แยก update fail-safe เผื่อยังไม่รัน migration phase17
  if(status==='lost')await _sb.from('loans').update({lost_date:todayISO()}).eq('id',id);
  toast('✅ อัปเดตสถานะแล้ว','ok');await refreshLoan(id);openDetail(id);
}
// สลับโหมด "ผ่อนต้น" (หยุดคิดดอก) — Owner + หัวหน้ากอง
async function setPrincipalOnly(id,on){
  if(!isOwner()&&!isHead()){toast('ปรับโหมดผ่อนต้นได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  var ok=await showConfirm({icon:on?'📉':'↩️',title:on?'เปลี่ยนเป็นผ่อนต้น':'ยกเลิกผ่อนต้น',
    msg:on?'"'+c.full_name+'" จะ "หยุดคิดดอก" ตั้งแต่นี้ไป — เงินที่จ่ายจะลดต้นทั้งหมด จนต้นหมดแล้วปิดสัญญาอัตโนมัติ\n\nยืนยัน?'
          :'กลับมาคิดดอกตามปกติให้ "'+c.full_name+'" — ยืนยัน?',
    okText:'ยืนยัน',okClass:on?'btn-cyan':'btn-gold'});
  if(!ok)return;
  var res=await _sb.from('loans').update({principal_only:on}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message+' — รัน migration phase10 หรือยัง?','err');return}
  toast('✅ '+(on?'เปลี่ยนเป็นผ่อนต้นแล้ว':'ยกเลิกผ่อนต้นแล้ว'),'ok');await refreshLoan(id);openDetail(id);
}
// ยืนยันว่าโอนเงินให้ลูกค้าใหม่แล้ว (รอเปิด → เปิดแล้ว)
async function setDisbursed(id){
  if(!canDisburse()){toast('เปิดยอด (ยืนยันโอนเงิน) ได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
  var c=allCustomers.find(function(x){return x.id===id});
  var ok=await showConfirm({icon:'✅',title:'ยืนยันการโอนเงิน',msg:'ยืนยันว่าได้โอนเงินให้ "'+c.full_name+'" แล้ว?',okText:'เปิด',okClass:'btn-green'});
  if(!ok)return;
  var res=await _sb.from('loans').update({disbursed:true}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  // บันทึก "ยอดเบิก" — เงินที่โอนให้ลูกค้าตอนเปิดสัญญา
  await _sb.from('disbursements').insert({loan_id:id,branch_id:c.branch_id,amount:c.principal,disburse_date:todayISO(),kind:'new',recorded_by:currentUser.id});
  await refreshLoan(id);
  // ไม่สลับหน้า (ไล่กดเปิดหลายคนติดกันได้) — ใช้ toast บอกแทนว่าลูกค้าย้ายไปอยู่ชิปไหน
  var c2=allCustomers.find(function(x){return x.id===id});
  if(c2){
    var vd=document.getElementById('dash-date-picker').value||todayISO();
    var s2=custDayStatus(c2,vd);
    var chipName=s2.due&&!s2.paid?'ถึงกำหนด':(c2.start_date===vd?'ลูกค้าใหม่':'ลูกค้าเก่า');
    toast('✅ เปิดแล้ว — ลูกค้าย้ายไปชิป "'+chipName+'"','ok');
  }else toast('✅ เปลี่ยนเป็น "เปิดแล้ว"','ok');
  if(document.getElementById('modal-detail').classList.contains('open')&&currentDetailId===id)openDetail(id);
}
// ย้อน "เปิดแล้ว" กลับเป็น "รอโอน" (พลาดกดเปิดก่อนโอนจริง) — Owner/หัวหน้ากอง · เฉพาะสัญญาที่ยังไม่มีประวัติรับเงิน
async function undoDisburse(id){
  if(!canDisburse()){toast('ยกเลิกเปิดได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  if(allRecords.some(function(r){return r.customer_id===id})){toast('ลูกค้ามีประวัติรับเงินแล้ว — ยกเลิกเปิดไม่ได้','err');return}
  var ok=await showConfirm({icon:'↩️',title:'ยกเลิกเปิด',msg:'เปลี่ยน "'+c.full_name+'" กลับเป็น "รอโอน"?\nยอดเบิกที่บันทึกไว้ตอนกดเปิดจะถูกลบออกจากสรุปยอด',okText:'ยกเลิกเปิด',okClass:'btn-amber'});
  if(!ok)return;
  var res=await _sb.from('loans').update({disbursed:false}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  await _sb.from('disbursements').delete().eq('loan_id',id).eq('kind','new');  // ลบเฉพาะยอดเบิกตอนเปิดสัญญา
  toast('↩️ กลับเป็น "รอโอน" แล้ว','ok');
  await refreshLoan(id);
  if(document.getElementById('modal-detail').classList.contains('open')&&currentDetailId===id)openDetail(id);
}
async function doCloseLoan(id){
  if(!canTopupClose()){toast('กดปิดสินเชื่อได้เฉพาะ Owner หรือหัวหน้ากอง — รับเงินครบยอดปิดจะปิดให้เองอัตโนมัติ','err');return}
  var c=allCustomers.find(function(x){return x.id===id});var ca=closeAmount(c);
  var ok=await showConfirm({icon:'✓',title:'ปิดสินเชื่อ',msg:'ยอดปิดสินเชื่อ ฿'+fmt(ca)+'\nการปิดไม่สามารถยกเลิกได้',okText:'ปิดสินเชื่อ',okClass:'btn-green'});
  if(!ok)return;
  var res=await _sb.from('loans').update({status:'closed',close_amount:ca}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  toast('✅ ปิดสินเชื่อสำเร็จ ยอด ฿'+fmt(ca),'ok');await refreshLoan(id);openDetail(id);
}
// ปิดสัญญาลูกค้าตายโดยไม่ได้รับเงินคืน (ตัดหนี้สูญ) — Owner เท่านั้น ต่างจาก "คืนเครดิต" ที่ต้องจ่ายเต็มยอดก่อนปิด
async function closeLostLoan(id){
  if(!isOwner()){toast('ปิดสัญญา (ตัดหนี้สูญ) ได้เฉพาะ Owner เท่านั้น','err');return}
  var c=allCustomers.find(function(x){return x.id===id});if(!c||c.status!=='lost')return;
  var ca=closeAmount(c);
  var ok=await showConfirm({icon:'✕',title:'ปิดสัญญา (ตัดหนี้สูญ)',
    msg:'ปิดสัญญาของ "'+c.full_name+'" โดยไม่ได้รับเงินคืน (ยอดค้าง ฿'+fmt(ca)+')\nใช้เมื่อแน่ใจว่าเรียกเก็บไม่ได้แล้ว\n\nการปิดไม่สามารถยกเลิกได้',
    okText:'ปิดสัญญา',okClass:'btn-red'});
  if(!ok)return;
  var res=await _sb.from('loans').update({status:'closed',close_amount:ca}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  toast('ปิดสัญญาแล้ว (ตัดหนี้สูญ ฿'+fmt(ca)+')','ok');await refreshLoan(id);openDetail(id);
}
// เพิ่มยอด — ลูกค้าเดิมขอยอดเพิ่ม (เช่น เปิด 1000 ขอเพิ่มเป็น 2000 → โอนเพิ่ม 1000)
// บันทึกเป็น "ยอดเบิก" (kind=topup) + เพิ่มเข้าเงินต้น/เงินต้นคงเหลือ
function openTopup(id){
  if(!canTopupClose()){toast('เพิ่มยอดได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
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
  if(!canTopupClose()){toast('เพิ่มยอดได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  var amt=Math.max(0,parseFloat(document.getElementById('topup-amount').value)||0);
  if(amt<=0){toast('กรุณากรอกยอดที่จะเพิ่ม','err');return}
  var btn=document.getElementById('topup-save-btn');btn.innerHTML='<span class="spin"></span>';btn.disabled=true;
  var res=await _sb.from('loans').update({principal:+c.principal+amt,remaining_principal:+c.remaining_principal+amt}).eq('id',id);
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');btn.disabled=false;btn.textContent='โอนเพิ่ม';return}
  await _sb.from('disbursements').insert({loan_id:id,branch_id:c.branch_id,amount:amt,disburse_date:todayISO(),kind:'topup',recorded_by:currentUser.id});
  toast('✅ เพิ่มยอดสำเร็จ ฿'+fmt(amt),'ok');closeModal('modal-topup');await refreshLoan(id);openDetail(id);
}
async function doDeleteCustomer(id){
  if(!canDelete()){toast('ลบลูกค้าได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
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
  if(!canAddCustomer()){toast('คุณไม่มีสิทธิ์เปิดยอดใหม่','err');return}
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  openAddCustomer(c);
}
function openAddCustomer(reloanCust){
  if(!canAddCustomer()){toast('คุณไม่มีสิทธิ์เพิ่มลูกค้า','err');return}
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
      '<div class="field"><label>ลิงก์กลุ่มเฟส</label><input class="inp" id="f-fbgroup" placeholder="https://facebook.com/groups/..."/></div>'+
      '<div class="field"><label>เลขบัตรประชาชน <span class="req">*</span></label><input class="inp" id="f-idcard" maxlength="13" inputmode="numeric" placeholder="13 หลัก"/><div class="field-err"></div></div>'+
      '<div class="field"><label>ชื่อธนาคาร</label><select class="inp" id="f-bank-name">'+bankOptions('')+'</select></div>'+
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
      '<div class="field"><label>วันที่ปล่อยสินเชื่อ</label><input class="inp" id="f-start" type="date" max="'+addDaysISO(todayISO(),30)+'" value="'+todayISO()+'"/>'+
        '<div class="field-hint">เลือกย้อนหลัง หรือล่วงหน้าได้ไม่เกิน 30 วัน (นัดโอน) — งวดเก็บนับจากวันที่เลือก</div></div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-customer\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" id="cust-save-btn" onclick="saveCustomer()">เพิ่มลูกค้า</button></div>';
  var body=document.getElementById('modal-customer-body');body._interval=1;body._principal=null;
  custFormBranches();
  // โหมดเปิดยอดใหม่ → เติมข้อมูลคนเดิม + เปลี่ยนหัวข้อ/ปุ่ม
  if(reloanCust){
    var pp=allPersons.find(function(x){return x.id===reloanCust.person_id})||{};
    var set=function(idn,v){var e=document.getElementById(idn);if(e)e.value=v||''};
    set('f-name',pp.full_name||reloanCust.full_name);set('f-phone',pp.phone);set('f-fb',pp.facebook_url);
    set('f-fbgroup',reloanCust.fb_group_url||pp.fb_group_url);  // ลิงก์กลุ่มของสัญญา/บ้านเดิม ไม่ใช่ของบ้านอื่น
    set('f-idcard',pp.id_card);set('f-bank-name',pp.bank_name);set('f-bank-account',pp.bank_account);
    document.getElementById('modal-customer-title').textContent='เปิดยอดใหม่ — '+esc(pp.full_name||reloanCust.full_name||'');
    var sbtn=document.getElementById('cust-save-btn');if(sbtn)sbtn.textContent='เปิดยอดใหม่';
    presetCustFormBranch(reloanCust.branch_id);            // ตั้ง กอง/บ้าน ตามสัญญาเดิม — เดิมค้างที่บ้านแรกในลิสต์ ทำให้เปิดยอดใหม่หลุดไปบ้านอื่น
  }
  else if(custBranchId)presetCustFormBranch(custBranchId); // เพิ่มลูกค้าใหม่ระหว่างกรองดูบ้านไหนอยู่ → default บ้านนั้น
  else if(custGroupId){var ge0=document.getElementById('f-group');if(ge0){ge0.value=custGroupId;if(ge0.value===custGroupId)custFormBranches();}}
  openModal('modal-customer');
}
// ตั้งค่า dropdown กอง+บ้าน ในฟอร์มลูกค้าให้ตรงกับบ้านที่กำหนด (บ้านไม่อยู่ในสิทธิ์/ลิสต์ = คงค่า default เดิม)
function presetCustFormBranch(branchId){
  var b=allBranches.find(function(x){return x.id===branchId});if(!b)return;
  var ge=document.getElementById('f-group'),be=document.getElementById('f-branch');
  if(ge&&b.group_id){ge.value=b.group_id;if(ge.value===b.group_id)custFormBranches();}
  if(be)be.value=branchId;
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
// ตรวจกฎกู้หลายที่: ≤2 กอง และ 1 บ้านต่อกอง
// ลูกค้าเปิดสัญญาได้ทุกบ้าน (ไม่บล็อกลิมิตแล้ว) — แต่ถ้ามีสัญญาค้างอยู่บ้านอื่น ยิงแจ้งเตือนให้ Owner รู้ว่าอยู่บ้านไหนบ้าง
function notifyMultiBranch(personId,personName,newBranchId){
  if(!personId)return; // คนใหม่ ยังไม่มีสัญญาที่ไหน
  var active=allLoans.filter(function(l){return l.person_id===personId&&l.status!=='closed'});
  if(!active.length)return;
  var places=active.map(function(l){
    return branchName(l.branch_id)+' ('+groupNameOfBranch(l.branch_id)+')';
  });
  logAlert('multi_branch',{person_id:personId,person_name:personName,branch_id:newBranchId,
    message:'เปิดสัญญาเพิ่มที่ '+branchName(newBranchId)+' — มีสัญญาค้างอยู่แล้วที่: '+places.join(' · ')+' (รวมเป็น '+(active.length+1)+' สัญญา)'});
  toast('ℹ️ ลูกค้ามีสัญญาอยู่แล้วที่ '+places.join(', ')+' — แจ้ง Owner แล้ว','info');
}
function openEditCustomer(id){
  if(!canEditCustomerInfo()){toast('คุณไม่มีสิทธิ์แก้ไขลูกค้า','err');return}
  closeModal('modal-detail'); // กัน modal ซ้อนกัน
  editingCustId=id;reloanPersonId=null;
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  document.getElementById('modal-customer-title').textContent='แก้ไขลูกค้า';
  document.getElementById('modal-customer-body').innerHTML=
    '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="inp" id="f-name" value="'+esc(c.full_name)+'"/></div>'+
    '<div class="field"><label>เบอร์โทรศัพท์</label><input class="inp" id="f-phone" value="'+esc(c.phone||'')+'"/></div>'+
    '<div class="field"><label>Facebook URL</label><input class="inp" id="f-fb" value="'+esc(c.facebook_url||'')+'"/></div>'+
    '<div class="field"><label>ลิงก์กลุ่มเฟส</label><input class="inp" id="f-fbgroup" value="'+esc(c.fb_group_url||'')+'"/></div>'+
    '<div class="field"><label>เลขบัตรประชาชน</label><input class="inp" id="f-idcard" maxlength="13" value="'+esc(c.id_card||'')+'"/></div>'+
    '<div class="field"><label>ชื่อธนาคาร</label><select class="inp" id="f-bank-name">'+bankOptions(c.bank_name)+'</select></div>'+
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
  var fbGroupEl=document.getElementById('f-fbgroup');
  var fbGroup=fbGroupEl?fbGroupEl.value.trim()||null:null;
  var idcard=document.getElementById('f-idcard').value.trim()||null;
  var bankName=document.getElementById('f-bank-name').value.trim()||null;
  var bankAccount=document.getElementById('f-bank-account').value.trim()||null;

  // โหมดแก้ไข → แก้ที่ตาราง persons (ตัวตนของคน)
  if(editingCustId){
    if(!canEditCustomerInfo()){toast('คุณไม่มีสิทธิ์แก้ไขลูกค้า','err');return}
    var cc=allCustomers.find(function(x){return x.id===editingCustId});
    if(idcard&&!validThaiId(idcard)){
      if(!isOwner()&&!isHead()){toast('เลขบัตรประชาชนไม่ถูกต้อง (ตรวจสอบหลักไม่ผ่าน) — แก้ไขก่อนบันทึก','err');return}
      toast('⚠️ เลขบัตร checksum ไม่ผ่าน — บันทึกด้วยสิทธิ์ '+(isOwner()?'Owner':'หัวหน้ากอง'),'err');
    }
    var upd={full_name:name,phone:phone,facebook_url:fb,id_card:idcard,bank_name:bankName,bank_account:bankAccount};
    var res=await _sb.from('persons').update(upd).eq('id',cc.person_id);
    if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');return}
    // ลิงก์กลุ่มเฟสเก็บที่ "สัญญาใบนี้" (ต่อบ้าน — คนเดียวกู้หลายบ้านไม่ทับกัน) · ยังไม่รัน phase16 → เก็บที่คนแบบเดิม
    var fg=await _sb.from('loans').update({fb_group_url:fbGroup}).eq('id',editingCustId);
    if(fg.error)await _sb.from('persons').update({fb_group_url:fbGroup}).eq('id',cc.person_id);
    // กันแก้ข้อมูลให้ไป "ชนคนอื่น" — log ให้ Owner ตรวจ (ไม่บล็อก)
    var nd=findNearDuplicates({id_card:idcard,name:name,phone:phone,bank_account:bankAccount},cc.person_id);
    if(nd.length){
      var cd=nd.slice(0,3).map(function(x){return (x.person.full_name||'(ไม่ทราบชื่อ)')+' ['+x.reasons.join(', ')+']'}).join(' · ');
      logAlert('maybe_dup',{person_id:cc.person_id,person_name:name,branch_id:cc.branch_id,loan_id:cc.id,
        message:'แก้ไขข้อมูลลูกค้าแล้วใกล้เคียงกับคนอื่น: '+cd,meta:{candidate_ids:nd.map(function(x){return x.person.id}),edited:true}});
    }
    toast('✅ แก้ไขสำเร็จ','ok');closeModal('modal-customer');await loadAll();openDetail(editingCustId);return;
  }

  if(!canAddCustomer()){toast('คุณไม่มีสิทธิ์เพิ่มลูกค้า','err');return}
  var principal=document.getElementById('modal-customer-body')._principal;
  if(!principal||principal<=0){toast('กรุณาเลือกวงเงิน','err');return}
  var branchId=document.getElementById('f-branch').value;
  if(!branchId){toast('กรุณาเลือกบ้าน','err');return}
  var branch=allBranches.find(function(b){return b.id===branchId});
  var interval=document.getElementById('modal-customer-body')._interval||1;

  // บังคับกรอกเลขบัตร 13 หลัก — จุดยึดของระบบกันโกง (ทุก role รวม Owner)
  if(normDigits(idcard).length!==13){toast('ต้องกรอกเลขบัตรประชาชนให้ครบ 13 หลัก','err');return}
  // บล็อก checksum เลขบัตร — กรอกผิดบันทึกไม่ได้ (Owner + หัวหน้ากอง ข้ามได้)
  if(!validThaiId(idcard)){
    if(!isOwner()&&!isHead()){toast('เลขบัตรประชาชนไม่ถูกต้อง (ตรวจสอบหลักไม่ผ่าน) — แก้ไขก่อนบันทึก','err');return}
    toast('⚠️ เลขบัตร checksum ไม่ผ่าน — บันทึกด้วยสิทธิ์ '+(isOwner()?'Owner':'หัวหน้ากอง'),'err');
  }

  // โหมดเปิดยอดใหม่ = ใช้ person เดิม · ปกติ = หาคนเดิม (เลขบัตรตรง หรือ ชื่อ+เบอร์ตรง) เพื่อบังคับกฎกู้หลายที่
  var existing=reloanPersonId?{id:reloanPersonId}:findExistingPerson({id_card:idcard,name:name,phone:phone});
  var exId=existing?existing.id:null;

  // บล็อก + แจ้ง Owner: เปิดสัญญาใหม่ให้คนที่มีสัญญาสถานะ "ตาย" ค้างอยู่ (ต้องผ่าน Owner คืนเครดิตเท่านั้น)
  if(exId&&!reloanPersonId&&allLoans.some(function(l){return l.person_id===exId&&l.status==='lost'})){
    var lp=allPersons.find(function(p){return p.id===exId})||{};
    logAlert('dup_lost',{person_id:exId,person_name:lp.full_name||name,branch_id:branchId,
      message:'พยายามเปิดสัญญาใหม่ให้ลูกค้าที่มีสถานะ "ตาย" ค้างอยู่'});
    toast('ลูกค้ารายนี้มีสัญญาสถานะ "ตาย" ค้างอยู่ — เปิดสัญญาใหม่ไม่ได้ (แจ้ง Owner แล้ว)','err');
    return;
  }

  // บล็อกแข็ง (ทุก role รวม Owner): มีสัญญาที่ยังไม่ปิด (ปกติ/ค้าง) อยู่แล้วในบ้านเดียวกัน — 1 บ้านต่อคน 1 สัญญาเปิดพร้อมกันเท่านั้น
  // (ตายในบ้านนี้ถูกจับโดยบล็อกด้านบนแล้ว) — ต้องการเพิ่มยอด ใช้ปุ่ม "+ เพิ่มยอด" แทน ไม่ใช่เปิดสัญญาใหม่ซ้อน
  if(exId&&!reloanPersonId&&allLoans.some(function(l){return l.person_id===exId&&l.branch_id===branchId&&(l.status==='normal'||l.status==='overdue')})){
    var lpb=allPersons.find(function(p){return p.id===exId})||{};
    logAlert('dup_branch',{person_id:exId,person_name:lpb.full_name||name,branch_id:branchId,
      message:'พยายามเปิดสัญญาใหม่ซ้ำในบ้านเดียวกัน ทั้งที่มีสัญญาเปิดอยู่แล้ว'});
    toast('ลูกค้ารายนี้มีสัญญาเปิดอยู่แล้วในบ้านนี้ — ปิดสัญญาเดิมก่อน หรือใช้ปุ่ม "+ เพิ่มยอด" แทน','err');
    return;
  }

  // อยู่ได้ทุกบ้าน (คนละบ้าน) — ไม่บล็อก แต่แจ้ง Owner ว่าลูกค้าคนนี้มีสัญญาอยู่บ้านไหนบ้าง
  notifyMultiBranch(exId,name,branchId);

  var saveLabel=reloanPersonId?'เปิดยอดใหม่':'เพิ่มลูกค้า';
  if(btn){btn.innerHTML='<span class="spin"></span>';btn.disabled=true}

  // หา/สร้าง person
  var personId=reloanPersonId||(existing?existing.id:null);
  // ยืนยันกับ DB ว่าคนนี้ยังมีอยู่จริง — ข้อมูลในเครื่องอาจค้าง (คนถูกลบจากเครื่องอื่น/เคลียร์ใน Supabase)
  // ถ้าใช้ id ค้างจะชน FK "loans_person_id_fkey" ตอนสร้างสัญญา
  if(personId){
    var chk=await _sb.from('persons').select('id').eq('id',personId).maybeSingle();
    if(!chk.data)personId=null;   // คนใน memory ไม่อยู่ใน DB แล้ว → สร้างใหม่แทน
  }
  if(personId&&reloanPersonId){
    await _sb.from('persons').update({full_name:name,phone:phone,facebook_url:fb,id_card:idcard,bank_name:bankName,bank_account:bankAccount}).eq('id',personId);
  }
  else if(personId){
    if(bankName||bankAccount)await _sb.from('persons').update({bank_name:bankName,bank_account:bankAccount}).eq('id',personId);
  }
  else{
    var pres=await _sb.from('persons').insert({full_name:name,phone:phone,id_card:idcard,facebook_url:fb,bank_name:bankName||null,bank_account:bankAccount||null}).select().single();
    if(pres.error){
      // เลขบัตรชนกับคนใน DB ที่เครื่องนี้ยังไม่เห็น (unique index phase9) → ใช้คนเดิมใน DB แทน
      var dup=idcard?await _sb.from('persons').select('id').eq('id_card',idcard).maybeSingle():{data:null};
      if(dup.data)personId=dup.data.id;
      else{toast('บันทึกล้มเหลว: '+pres.error.message,'err');if(btn){btn.disabled=false;btn.textContent=saveLabel}return}
    }
    else personId=pres.data.id;
  }

  // วันที่ปล่อยสินเชื่อ — ย้อนหลังได้ · ล่วงหน้าได้ไม่เกิน 30 วัน (กันพิมพ์ปีผิด · เช็คซ้ำเผื่อเบราว์เซอร์ไม่บังคับ max)
  var startDate=(document.getElementById('f-start')||{}).value||todayISO();
  var maxStart=addDaysISO(todayISO(),30);
  if(startDate>maxStart)startDate=maxStart;

  // สร้างสัญญา — seq ให้ฐานข้อมูลกำหนดเอง (รันต่อเนื่องทั้งระบบ) · เลขลูกค้าถามจาก DB จริงกันซ้ำ
  var res=await _sb.from('loans').insert({
    person_id:personId,branch_id:branchId,cust_no:await nextCustNoDB(branchId,personId),
    principal:principal,daily_interest_rate:0.10,
    collection_interval:interval,start_date:startDate,
    status:'normal',remaining_principal:principal,branch_fee:branch?branch.fee_per_person:0,
    disbursed:false
  }).select().single();
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');if(btn){btn.disabled=false;btn.textContent=saveLabel}return}

  // ลิงก์กลุ่มเฟสของสัญญาใบนี้ (ต่อบ้าน) — ยังไม่รัน phase16 → เก็บที่ตัวคนแบบเดิม (fail-safe)
  if(fbGroup){
    var fg2=await _sb.from('loans').update({fb_group_url:fbGroup}).eq('id',res.data.id);
    if(fg2.error)await _sb.from('persons').update({fb_group_url:fbGroup}).eq('id',personId);
  }

  // กันโกง (เงียบๆ): สร้างลูกค้า "ใหม่" ที่ใกล้เคียงคนเดิม → แจ้ง Owner ไว้ตรวจย้อนหลัง
  if(!existing&&!reloanPersonId){
    var near=findNearDuplicates({id_card:idcard,name:name,phone:phone,bank_account:bankAccount},personId);
    if(near.length){
      var cand=near.slice(0,3).map(function(x){return (x.person.full_name||'(ไม่ทราบชื่อ)')+' ['+x.reasons.join(', ')+']'}).join(' · ');
      logAlert('maybe_dup',{person_id:personId,person_name:name,branch_id:branchId,loan_id:res.data.id,
        message:'ลูกค้าใหม่คล้ายกับที่มีอยู่: '+cand,
        meta:{candidate_ids:near.map(function(x){return x.person.id})}});
    }
  }

  var okMsg=reloanPersonId?'เปิดยอดใหม่สำเร็จ':'✅ เพิ่มลูกค้าสำเร็จ';
  reloanPersonId=null;
  custView='pending';   // สลับลิสต์ไปชิป "รอโอน" ให้เห็นคนที่เพิ่งเพิ่มทันที (ลูกค้าใหม่เริ่มที่สถานะรอยืนยันโอน ไม่อยู่ในลิสต์เก็บเงิน)
  toast(okMsg,'ok');closeModal('modal-customer');await loadAll();openDetail(res.data.id);
}

