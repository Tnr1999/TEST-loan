/* ═══════════════════════════════════════════════
   PAYMENTS
   — 1 ครั้งที่จ่าย = 1 รายการ (daily_records) แยกกัน
   — ดอกคิด "รอบเดียว" ต่อวัน · แต่ละรายการเก็บ "ส่วนต่าง" (delta)
     ของ ดอกเก็บได้/หักต้น/ค่าแรง → รวมทุกรายการ = ยอดจริงของวัน
═══════════════════════════════════════════════ */

var _payCtx=null; // {custId,date,recId} — recId มีค่า = โหมดแก้ไขรายการนั้น

// รายการชำระของลูกค้าคนหนึ่งในวันหนึ่ง (เรียงตามเวลา)
function dayRecords(custId,date){
  return allRecords.filter(function(r){return r.customer_id===custId&&r.record_date===date})
    .sort(function(a,b){return (a.created_at||'').localeCompare(b.created_at||'')});
}
// เงินต้น ณ "ต้นวัน" (ก่อนการชำระของวันนี้) = ต้นคงเหลือปัจจุบัน + ต้นที่หักไปแล้ววันนี้
function dayBaseCustomer(c,recs){
  var prin=recs.reduce(function(s,r){return s+ +(r.principal_reduced||0)},0);
  return Object.assign({},c,{remaining_principal:round2(c.remaining_principal+prin)});
}
function hhmm(ts){if(!ts)return'';try{return new Date(ts).toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'})}catch(e){return''}}

// คำนวณ "ส่วนต่าง" ของแต่ละรายการแบบสะสม (ดอกคิดรอบเดียว)
function computeDayDeltas(baseC0,entries){
  var prevInt=0,prevPrin=0,prevWage=0,cumPaid=0,cumPen=0,out=[],closing=false,remaining=baseC0.remaining_principal;
  entries.forEach(function(e){
    cumPaid=round2(cumPaid+(+e.amount_paid||0));
    cumPen=round2(cumPen+(+e.penalty||0));
    var cum=payCalc(baseC0,cumPaid,cumPen);
    out.push({
      interest_due:cum.interest_due,
      interest_collected:round2(cum.interest_collected-prevInt),
      principal_reduced:round2(cum.principal_reduced-prevPrin),
      remaining_principal:cum.remaining_principal,
      wage:round2(cum.wage-prevWage),
      payment_status:cum.payment_status
    });
    prevInt=cum.interest_collected;prevPrin=cum.principal_reduced;prevWage=cum.wage;
    closing=!!cum.closing;remaining=cum.remaining_principal;
  });
  return{deltas:out,closing:closing,remaining:remaining};
}

function openPayment(custId,date,editId){
  if(!canEdit()){toast('คุณไม่มีสิทธิ์รับเงิน','err');return}
  var c=allCustomers.find(function(x){return x.id===custId});if(!c)return;
  if(c.status==='lost'&&!canReturnCredit()){toast('คืนเครดิต (ลูกค้าตาย) ได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
  var recs=dayRecords(custId,date);
  var editRec=editId?recs.find(function(r){return r.id===editId}):null;
  var mode=editRec?'edit':(recs.length?'add':'new');
  _payCtx={custId:custId,date:date,recId:editRec?editId:null};

  var baseC0=dayBaseCustomer(c,recs);
  var due=interestDue(baseC0),close=closeAmount(baseC0);          // ดอก/ยอดปิดของรอบ (ฐานต้นวัน)
  var prevPaid=recs.reduce(function(s,r){return s+ +(r.amount_paid||0)},0);
  var prevInt=recs.reduce(function(s,r){return s+ +(r.interest_collected||0)},0);
  var prevPen=recs.reduce(function(s,r){return s+ +(r.penalty||0)},0);
  var remInt=round2(due-prevInt), remClose=round2(close-prevPaid); // ส่วนที่เหลือเพื่อจ่ายให้ครบ

  document.getElementById('modal-payment-title').textContent=custCode(c)+' '+c.full_name;

  // ── บล็อกรายการที่จ่ายไปแล้ววันนี้ ──
  var listHtml='';
  if(recs.length){
    listHtml='<div class="paid-today"><div class="paid-today-head"><span>จ่ายไปแล้ววันนี้</span>'+
      '<b>฿'+fmt(prevPaid)+(prevPen>0?' <span style="color:var(--red);font-weight:500">+ปรับ ฿'+fmt(prevPen)+'</span>':'')+'</b></div>';
    recs.forEach(function(r,i){
      var editing=editRec&&r.id===editId;
      listHtml+='<div class="paid-today-row'+(editing?' editing':'')+'">'+
        '<span class="pt-i">#'+(i+1)+(r.created_at?' · '+hhmm(r.created_at):'')+'</span>'+
        '<span class="pt-amt mono">฿'+fmt(r.amount_paid)+(r.penalty>0?' <span style="color:var(--red)">+'+fmt(r.penalty)+'</span>':'')+'</span>'+
        (editing?'<span class="pt-edit" style="color:var(--gold)">กำลังแก้</span>'
                :'<button class="pt-edit" onclick="openPayment(\''+custId+'\',\''+date+'\',\''+r.id+'\')">แก้</button>')+
        '</div>';
    });
    listHtml+='</div>';
  }

  // ── ปุ่มลัด ──
  var quick='<button class="quick-btn" onclick="setPayAmt(0)">↺ รีเซ็ต</button>';
  if(mode==='new'){
    if(!c.principal_only)quick+='<button class="quick-btn" onclick="setPayAmt('+due+')">ดอก ฿'+fmt(due)+'</button>';
    quick+='<button class="quick-btn" onclick="setPayAmt('+close+')">'+(c.principal_only?'ผ่อนหมด':'ปิดยอด')+' ฿'+fmt(close)+'</button>';
  }else if(mode==='add'){
    if(remInt>0)quick+='<button class="quick-btn" onclick="setPayAmt('+remInt+')">ดอกที่เหลือ ฿'+fmt(remInt)+'</button>';
    if(remClose>0)quick+='<button class="quick-btn" onclick="setPayAmt('+remClose+')">ปิดยอด ฿'+fmt(remClose)+'</button>';
  }

  var amtLabel=mode==='edit'?'แก้ไขจำนวนรายการนี้ (บาท)':(c.principal_only?(mode==='add'?'ผ่อนต้นเพิ่ม (บาท)':'ผ่อนต้น (บาท)'):(mode==='add'?'จ่ายเพิ่ม (บาท)':'จำนวนที่จ่าย (บาท)'));
  var amtVal=editRec?editRec.amount_paid:'';
  var penVal=editRec&&editRec.penalty>0?editRec.penalty:'';
  var saveLabel=mode==='edit'?'บันทึกการแก้ไข':(mode==='add'?'จ่ายเพิ่ม':'บันทึก');
  var dateTag=mode==='edit'?' <span style="color:var(--gold)">· แก้ไขรายการ</span>'
    :(recs.length?' <span style="color:var(--green)">· จ่ายเพิ่ม ('+recs.length+' รายการแล้ว)</span>':'');

  document.getElementById('modal-payment-body').innerHTML=
    '<div class="field"><label>วันที่ชำระ'+dateTag+'</label><input class="inp" id="pay-date" type="date" max="'+todayISO()+'" value="'+date+'" onchange="openPayment(\''+custId+'\',this.value)"/></div>'+
    listHtml+
    '<div style="display:flex;gap:10px;margin-bottom:14px">'+
      '<div class="stat" style="flex:1"><span class="label">เงินต้นคงเหลือ</span><span class="value" style="font-size:1.1rem">฿'+fmt(c.remaining_principal)+'</span></div>'+
      (c.principal_only
        ?'<div class="stat" style="flex:1"><span class="label" style="color:var(--cyan)">โหมดผ่อนต้น</span><span class="value" style="font-size:1.05rem;color:var(--cyan)">ไม่คิดดอก</span></div>'
        :'<div class="stat" style="flex:1"><span class="label" style="color:var(--amber)">'+(mode==='add'&&remInt>0?'ดอกที่เหลือ':'ดอกที่ต้องจ่าย')+'</span><span class="value" style="font-size:1.1rem;color:var(--amber)">฿'+fmt(mode==='add'?Math.max(0,remInt):due)+'</span></div>')+
    '</div>'+
    '<div class="quick-btns">'+quick+'</div>'+
    '<div class="field"><label>'+amtLabel+'</label><input class="inp mono" id="pay-amount" type="number" min="0" step="0.01" placeholder="0.00" value="'+amtVal+'" oninput="updatePayCalc()"/></div>'+
    '<div class="field"><label>ค่าปรับ (บาท)'+(mode==='add'?' · เพิ่มรอบนี้':'')+'</label><input class="inp mono" id="pay-penalty" type="number" min="0" step="0.01" placeholder="0.00" value="'+penVal+'" oninput="updatePayCalc()"/></div>'+
    '<div id="pay-calc"></div>'+
    '<div style="text-align:right;font-size:0.74rem;color:var(--muted);margin-top:10px">ยอดปิดสินเชื่อ: ฿'+fmt(close)+'</div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-payment\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" id="pay-save-btn" onclick="savePayment()">'+saveLabel+'</button>'+
    '</div>';
  openModal('modal-payment');
  updatePayCalc();
}
function setPayAmt(v){document.getElementById('pay-amount').value=v;updatePayCalc()}

// คำนวณการชำระ (รายการเดียว/สะสม) + ตรวจ "ปิดสัญญา" และกันเงินต้นติดลบ
// ค่าแรง = (ดอกที่เก็บได้ + ค่าปรับ + ค่าธรรมเนียมบ้าน[เฉพาะวันปิดสัญญา]) × 20%
function payCalc(c,amt,pen){
  pen=+pen||0;
  var close=closeAmount(c),due=interestDue(c);
  if(c.principal_only){
    // โหมดผ่อนต้น: ไม่คิดดอก · เงินทั้งหมดลดต้น · ปิดเมื่อต้นหมด · ผ่อนต้นไม่นับเป็นรายได้ (ไม่มีค่าแรง)
    var pr=Math.min(round2(amt),c.remaining_principal);
    var rem=round2(c.remaining_principal-pr);
    var closing=rem<=0&&amt>0;
    return{interest_due:0,interest_collected:0,principal_reduced:pr,remaining_principal:rem,
      wage:round2(pen*0.20),payment_status:pr>0?(closing?'overpaid':'partial'):'unpaid',closing:closing};
  }
  if(close>0&&amt>=close){
    // จ่ายครบยอดปิด → ปิดสัญญา: เก็บดอกรอบนี้ + คืนต้นทั้งหมด + ค่าธรรมเนียมบ้าน
    return{interest_due:due,interest_collected:due,principal_reduced:+c.remaining_principal,
      remaining_principal:0,wage:round2((due+pen+(c.branch_fee||0))*0.20),payment_status:'overpaid',closing:true};
  }
  var calc=calcPayment(c,amt,pen);
  // กันต้นติดลบ: หักต้นได้ไม่เกินต้นคงเหลือ
  if(calc.principal_reduced>c.remaining_principal){
    calc.principal_reduced=+c.remaining_principal;
    calc.remaining_principal=0;
  }
  calc.closing=false;
  return calc;
}
function updatePayCalc(){
  if(!_payCtx)return;
  var c=allCustomers.find(function(x){return x.id===_payCtx.custId});if(!c)return;
  var recs=dayRecords(_payCtx.custId,_payCtx.date);
  var baseC0=dayBaseCustomer(c,recs);
  var amt=Math.max(0,parseFloat(document.getElementById('pay-amount').value)||0);
  var penEl=document.getElementById('pay-penalty');
  var pen=penEl?Math.max(0,parseFloat(penEl.value)||0):0;

  // ยอดสะสมทั้งวันหลังรายการนี้
  var entries=_payCtx.recId
    ?recs.map(function(r){return r.id===_payCtx.recId?Object.assign({},r,{amount_paid:amt,penalty:pen}):r})
    :recs.concat([{amount_paid:amt,penalty:pen}]);
  var cumPaid=entries.reduce(function(s,e){return s+ +(e.amount_paid||0)},0);
  var cumPen=entries.reduce(function(s,e){return s+ +(e.penalty||0)},0);
  var calc=payCalc(baseC0,cumPaid,cumPen);

  var lbl=calc.closing?['✓ ปิดสัญญา','var(--green)']:{unpaid:['ไม่จ่าย','var(--muted)'],partial:['จ่ายบางส่วน','var(--amber)'],exact:['จ่ายครบดอก','var(--green)'],overpaid:['จ่ายเกิน (หักต้น)','var(--cyan)']}[calc.payment_status];
  var multi=recs.length>0;
  var h='<div class="calc-box"><div class="calc-title">ผลการคำนวณ'+(multi?' (รวมทั้งวัน)':'')+'</div>'+
    '<div class="calc-row"><span class="k">สถานะ</span><span class="v" style="color:'+lbl[1]+'">'+lbl[0]+'</span></div>'+
    '<div class="calc-row"><span class="k">ดอกที่เก็บได้'+(multi?'รวม':'')+'</span><span class="v" style="color:var(--green)">฿'+fmt(calc.interest_collected)+'</span></div>';
  if(calc.principal_reduced>0)h+='<div class="calc-row"><span class="k">'+(calc.closing?'คืนเงินต้น':'หักเงินต้น'+(multi?'รวม':''))+'</span><span class="v" style="color:var(--cyan)">฿'+fmt(calc.principal_reduced)+'</span></div>';
  if(calc.closing&&c.branch_fee>0)h+='<div class="calc-row"><span class="k">ค่าธรรมเนียมบ้าน</span><span class="v">฿'+fmt(c.branch_fee)+'</span></div>';
  h+='<div class="calc-row"><span class="k">เงินต้นคงเหลือใหม่</span><span class="v">฿'+fmt(calc.remaining_principal)+'</span></div>';
  if(cumPen>0)h+='<div class="calc-row"><span class="k">ค่าปรับ'+(multi?'รวม':'')+'</span><span class="v" style="color:var(--red)">฿'+fmt(cumPen)+'</span></div>';
  if(multi&&!_payCtx.recId)h+='<div class="calc-row"><span class="k" style="color:var(--gold)">เก็บเพิ่มรอบนี้</span><span class="v" style="color:var(--gold)">฿'+fmt(amt+pen)+'</span></div>';
  h+='<div class="calc-row" style="border-top:1px solid var(--border2);margin-top:4px;padding-top:6px"><span class="k" style="font-weight:600">รวมรับเงิน'+(multi?'ทั้งวัน':'วันนี้')+'</span><span class="v" style="font-weight:700;color:var(--gold)">฿'+fmt(cumPaid+cumPen)+'</span></div></div>';
  document.getElementById('pay-calc').innerHTML=h;
}
async function savePayment(){
  if(!_payCtx)return;
  if(!canEdit()){toast('คุณไม่มีสิทธิ์รับเงิน','err');return}
  var custId=_payCtx.custId,date=_payCtx.date,recId=_payCtx.recId;
  var c=allCustomers.find(function(x){return x.id===custId});
  if(c&&c.status==='lost'&&!canReturnCredit()){toast('คืนเครดิต (ลูกค้าตาย) ได้เฉพาะ Owner หรือหัวหน้ากอง','err');return}
  if(date>todayISO()){toast('บันทึกได้เฉพาะวันนี้หรือย้อนหลัง','err');return;}
  var amt=Math.max(0,parseFloat(document.getElementById('pay-amount').value)||0);
  var penEl=document.getElementById('pay-penalty');
  var pen=penEl?Math.max(0,parseFloat(penEl.value)||0):0;

  var recs=dayRecords(custId,date);
  var baseC0=dayBaseCustomer(c,recs);
  // entries (chronological) — แก้ไข = แทนค่ารายการนั้น · จ่ายเพิ่ม/ครั้งแรก = ต่อท้าย
  var entries=recId
    ?recs.map(function(r){return r.id===recId?Object.assign({},r,{amount_paid:amt,penalty:pen}):r})
    :recs.concat([{amount_paid:amt,penalty:pen,_new:true,recorded_by:currentUser.id}]);
  var R=computeDayDeltas(baseC0,entries);
  var totalPaid=entries.reduce(function(s,e){return s+ +(e.amount_paid||0)},0);

  // ยืนยันก่อน "ปิดสัญญา"
  if(R.closing){
    var okClose=await showConfirm({icon:'✓',title:'ปิดสัญญา',msg:'ยอดนี้จะปิดสัญญาของ "'+c.full_name+'"\nปิดแล้วลูกค้าจะหายจากรายการเก็บ — ยืนยัน?',okText:'ปิดสัญญา',okClass:'btn-green'});
    if(!okClose)return;
  }
  var btn=document.getElementById('pay-save-btn');btn.innerHTML='<span class="spin"></span>';btn.disabled=true;

  // เขียนทุกรายการของวัน (delta อาจเปลี่ยนเมื่อแก้ไขรายการกลางวัน) + insert รายการใหม่
  for(var i=0;i<entries.length;i++){
    var e=entries[i],d=R.deltas[i];
    var payload={loan_id:custId,record_date:date,interest_due:d.interest_due,amount_paid:+e.amount_paid||0,
      interest_collected:d.interest_collected,principal_reduced:d.principal_reduced,
      remaining_principal:d.remaining_principal,wage:d.wage,payment_status:d.payment_status,
      penalty:+e.penalty||0,recorded_by:e.recorded_by||currentUser.id};
    var res=e._new?await _sb.from('daily_records').insert(payload):await _sb.from('daily_records').update(payload).eq('id',e.id);
    if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');btn.disabled=false;btn.textContent='บันทึก';return}
  }

  // update customer
  var upd={remaining_principal:R.remaining};
  if(totalPaid>0)upd.last_collection_date=date;
  if(R.closing){
    upd.status='closed';upd.close_amount=closeAmount(baseC0);
  }else if(c.status!=='lost'&&totalPaid>0){
    upd.status='normal';
  }
  await _sb.from('loans').update(upd).eq('id',custId);

  toast(recId?'✅ แก้ไขสำเร็จ':'✅ บันทึกสำเร็จ','ok');
  closeModal('modal-payment');
  await loadAll();
  if(document.getElementById('modal-detail').classList.contains('open')&&currentDetailId)openDetail(currentDetailId);
}

/* ═══════════════════════════════════════════════
   จ่ายล่วงหน้า (ADVANCE PAYMENT)
   — จ่ายครั้งเดียวครอบคลุมหลายงวดล่วงหน้า (เช่น จ่าย 300 = ดอกวันนี้ + ล่วงหน้าอีก 2 งวด)
   — จำนวนงวดคำนวณจากยอดที่จ่าย ÷ ดอก 1 งวด (ปัดลง) · ส่วนเกิน → ลดต้น
   — เลื่อน last_collection_date ไปข้างหน้าตามจำนวนงวดที่จ่าย (ข้ามงวดที่จ่ายล่วงหน้าไปแล้ว)
   — ไม่รองรับ: โหมดผ่อนต้น (ไม่มีดอก) · วันที่มีรายการรับเงินอยู่แล้ว (ใช้ "จ่ายเพิ่ม" แทน) · ยอดที่จะปิดสัญญาพอดี (ใช้ "รับเงิน" ปกติ)
═══════════════════════════════════════════════ */
var _advCtx=null; // {custId,date,perCycle,interval}

function openAdvance(custId,date){
  if(!canEdit()){toast('คุณไม่มีสิทธิ์รับเงิน','err');return}
  var c=allCustomers.find(function(x){return x.id===custId});if(!c)return;
  if(c.status==='closed'){toast('ปิดสัญญาแล้ว — ใช้ปุ่ม "เปิดใหม่" แทน','err');return}
  if(c.status==='lost'){toast('ลูกค้าสถานะตาย — ใช้ปุ่ม "คืนเครดิต" แทน','err');return}
  if(!c.disbursed){toast('ลูกค้ายังไม่ยืนยันโอนเงิน','err');return}
  if(c.principal_only){toast('โหมดผ่อนต้นไม่มีดอก — จ่ายล่วงหน้าไม่ได้','err');return}
  var recs=dayRecords(custId,date);
  if(recs.length){toast('มีรายการรับเงินวันนี้อยู่แล้ว — ใช้ปุ่ม "จ่ายเพิ่ม" แทน','err');return}
  var perCycle=interestDue(c);
  if(perCycle<=0){toast('ไม่มีดอกให้จ่ายล่วงหน้า','err');return}
  closeModal('modal-detail'); // กัน modal ซ้อนกัน
  _advCtx={custId:custId,date:date,perCycle:perCycle,interval:c.collection_interval};
  document.getElementById('modal-advance-title').textContent='จ่ายล่วงหน้า — '+esc(c.full_name);
  document.getElementById('modal-advance-body').innerHTML=
    '<div class="field-hint" style="background:var(--surface);padding:10px;border-radius:8px;margin-bottom:14px">1 งวด (ทุก '+c.collection_interval+' วัน) = <b style="color:var(--gold)">฿'+fmt(perCycle)+'</b> ต่องวด</div>'+
    '<div class="field"><label>จำนวนเงินที่จ่าย (บาท)</label><input class="inp mono" id="adv-amount" type="number" min="0" step="0.01" placeholder="0.00" oninput="updateAdvanceCalc()" autofocus/></div>'+
    '<div id="adv-calc"></div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-advance\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" id="adv-save-btn" onclick="saveAdvancePayment()" disabled>บันทึก</button></div>';
  openModal('modal-advance');
  updateAdvanceCalc();
}
function updateAdvanceCalc(){
  if(!_advCtx)return;
  var amt=Math.max(0,parseFloat(document.getElementById('adv-amount').value)||0);
  var perCycle=_advCtx.perCycle,interval=_advCtx.interval;
  var cycles=perCycle>0?Math.floor((amt+1e-9)/perCycle):0;
  cycles=Math.min(cycles,60); // กันกรอกเลขมโหฬารจนวันที่ล้น
  var box=document.getElementById('adv-calc'),saveBtn=document.getElementById('adv-save-btn');
  if(cycles<1){
    box.innerHTML='<div class="field-hint">กรอกอย่างน้อย ฿'+fmt(perCycle)+' เพื่อจ่ายล่วงหน้าได้ตั้งแต่ 1 งวดขึ้นไป</div>';
    if(saveBtn)saveBtn.disabled=true;
    return;
  }
  var interestCollected=round2(perCycle*cycles);
  var remainder=round2(amt-interestCollected);
  var newRef=addDaysISO(_advCtx.date,interval*(cycles-1));
  var nextDue=addDaysISO(newRef,interval);
  box.innerHTML='<div class="calc-box">'+
    '<div class="calc-row"><span class="k">ครอบคลุม</span><span class="v" style="color:var(--gold)">'+cycles+' งวด</span></div>'+
    '<div class="calc-row"><span class="k">ดอกที่เก็บได้</span><span class="v" style="color:var(--green)">฿'+fmt(interestCollected)+'</span></div>'+
    (remainder>0?'<div class="calc-row"><span class="k">ส่วนเกิน (ลดต้น)</span><span class="v" style="color:var(--cyan)">฿'+fmt(remainder)+'</span></div>':'')+
    '<div class="calc-row" style="border-top:1px solid var(--border2);margin-top:4px;padding-top:6px"><span class="k" style="font-weight:600">ครบกำหนดงวดถัดไป</span><span class="v" style="font-weight:700;color:var(--gold)">'+thDate(nextDue)+'</span></div></div>';
  if(saveBtn)saveBtn.disabled=false;
}
async function saveAdvancePayment(){
  if(!_advCtx)return;
  if(!canEdit()){toast('คุณไม่มีสิทธิ์รับเงิน','err');return}
  var custId=_advCtx.custId,date=_advCtx.date,interval=_advCtx.interval,perCycle=_advCtx.perCycle;
  var c=allCustomers.find(function(x){return x.id===custId});if(!c)return;
  if(date>todayISO()){toast('บันทึกได้เฉพาะวันนี้หรือย้อนหลัง','err');return}
  var amt=Math.max(0,parseFloat(document.getElementById('adv-amount').value)||0);
  var cycles=perCycle>0?Math.floor((amt+1e-9)/perCycle):0;
  cycles=Math.min(cycles,60);
  if(cycles<1){toast('จำนวนเงินไม่พอสำหรับจ่ายล่วงหน้าอย่างน้อย 1 งวด (฿'+fmt(perCycle)+')','err');return}
  var interestCollected=round2(perCycle*cycles);
  var remainder=round2(amt-interestCollected);
  var principalReduced=Math.min(Math.max(0,remainder),c.remaining_principal);
  var remainingNew=round2(c.remaining_principal-principalReduced);
  if(remainingNew<=0){toast('ยอดนี้จะปิดสัญญาพอดี — กรุณาใช้ปุ่ม "รับเงิน" ปกติเพื่อปิดสัญญาแทน','err');return}
  var wage=round2(interestCollected*0.20);
  var newRef=addDaysISO(date,interval*(cycles-1));

  var btn=document.getElementById('adv-save-btn');btn.innerHTML='<span class="spin"></span>';btn.disabled=true;

  var payload={loan_id:custId,record_date:date,interest_due:interestCollected,amount_paid:amt,
    interest_collected:interestCollected,principal_reduced:principalReduced,remaining_principal:remainingNew,
    wage:wage,payment_status:remainder>0?'overpaid':'exact',penalty:0,recorded_by:currentUser.id,advance_cycles:cycles};
  var res=await _sb.from('daily_records').insert(payload);
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message+' — ต้องรัน migration phase13-advance-payment ก่อน','err');btn.disabled=false;btn.textContent='บันทึก';return}

  var upd={remaining_principal:remainingNew,last_collection_date:newRef};
  if(c.status!=='lost')upd.status='normal';
  await _sb.from('loans').update(upd).eq('id',custId);

  toast('✅ จ่ายล่วงหน้า '+cycles+' งวดสำเร็จ','ok');
  closeModal('modal-advance');
  await loadAll();
  if(document.getElementById('modal-detail').classList.contains('open')&&currentDetailId)openDetail(currentDetailId);
}
