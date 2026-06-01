/* ═══════════════════════════════════════════════
   PAYMENTS
═══════════════════════════════════════════════ */

function openPayment(custId,date){
  var c=allCustomers.find(function(x){return x.id===custId});if(!c)return;
  var existing=allRecords.find(function(r){return r.customer_id===custId&&r.record_date===date});
  var due=interestDue(c);
  var br=allBranches.find(function(x){return x.id===c.branch_id});
  // ค่าปรับ: ถ้าแก้ไขใช้ค่าเดิม, ถ้าใหม่เติม default จากบ้าน
  var penDefault=existing?(existing.penalty||0):(br&&br.penalty_fee?br.penalty_fee:'');
  document.getElementById('modal-payment-title').textContent='💵 #'+c.seq+' '+c.full_name;
  document.getElementById('modal-payment-body').innerHTML=
    '<div class="field"><label>วันที่ชำระ'+(existing?' <span style="color:var(--green)">· มีบันทึกแล้ว (แก้ไข)</span>':'')+'</label><input class="inp" id="pay-date" type="date" max="'+todayISO()+'" value="'+date+'" onchange="openPayment(\''+custId+'\',this.value)"/></div>'+
    '<div style="display:flex;gap:10px;margin-bottom:14px">'+
      '<div class="stat" style="flex:1"><span class="label">เงินต้นคงเหลือ</span><span class="value" style="font-size:1.1rem">฿'+fmt(c.remaining_principal)+'</span></div>'+
      '<div class="stat" style="flex:1"><span class="label" style="color:var(--amber)">ดอกที่ต้องจ่าย</span><span class="value" style="font-size:1.1rem;color:var(--amber)">฿'+fmt(due)+'</span></div>'+
    '</div>'+
    '<div class="quick-btns">'+
      '<button class="quick-btn" onclick="setPayAmt(0)">ไม่จ่าย</button>'+
      '<button class="quick-btn" onclick="setPayAmt('+due+')">ดอก ฿'+fmt(due)+'</button>'+
    '</div>'+
    '<div class="field"><label>จำนวนที่จ่าย (บาท)</label><input class="inp mono" id="pay-amount" type="number" min="0" step="0.01" placeholder="0.00" value="'+(existing?existing.amount_paid:'')+'" oninput="updatePayCalc(\''+custId+'\')"/></div>'+
    '<div class="field"><label>ค่าปรับ (บาท) <span style="color:var(--muted);font-weight:400">· แยกจากดอก/ต้น</span></label><input class="inp mono" id="pay-penalty" type="number" min="0" step="0.01" placeholder="0.00" value="'+penDefault+'" oninput="updatePayCalc(\''+custId+'\')"/></div>'+
    '<div id="pay-calc"></div>'+
    '<div style="text-align:right;font-size:0.74rem;color:var(--muted);margin-top:10px">ยอดปิดสินเชื่อ: ฿'+fmt(closeAmount(c))+'</div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-payment\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" id="pay-save-btn" onclick="savePayment(\''+custId+'\',\''+date+'\','+(existing?'\''+existing.id+'\'':'null')+')">'+(existing?'แก้ไข':'บันทึก')+'</button>'+
    '</div>';
  openModal('modal-payment');
  updatePayCalc(custId);
}
function setPayAmt(v){document.getElementById('pay-amount').value=v;var id=document.getElementById('pay-save-btn').getAttribute('onclick').match(/'([^']+)'/)[1];updatePayCalc(id)}
function updatePayCalc(custId){
  var c=allCustomers.find(function(x){return x.id===custId});
  var amt=parseFloat(document.getElementById('pay-amount').value)||0;
  var pen=parseFloat(document.getElementById('pay-penalty').value)||0;
  var calc=calcPayment(c,amt);
  var lbl={unpaid:['ไม่จ่าย','var(--muted)'],partial:['จ่ายบางส่วน','var(--amber)'],exact:['จ่ายครบดอก','var(--green)'],overpaid:['จ่ายเกิน (หักต้น)','var(--cyan)']}[calc.payment_status];
  var h='<div class="calc-box"><div class="calc-title">🧮 ผลการคำนวณ</div>'+
    '<div class="calc-row"><span class="k">สถานะ</span><span class="v" style="color:'+lbl[1]+'">'+lbl[0]+'</span></div>'+
    '<div class="calc-row"><span class="k">ดอกที่เก็บได้</span><span class="v" style="color:var(--green)">฿'+fmt(calc.interest_collected)+'</span></div>';
  if(calc.principal_reduced>0)h+='<div class="calc-row"><span class="k">หักเงินต้น</span><span class="v" style="color:var(--cyan)">฿'+fmt(calc.principal_reduced)+'</span></div>';
  h+='<div class="calc-row"><span class="k">เงินต้นคงเหลือใหม่</span><span class="v">฿'+fmt(calc.remaining_principal)+'</span></div>'+
    '<div class="calc-row"><span class="k">ค่าแรง (20%)</span><span class="v" style="color:var(--purple)">฿'+fmt(calc.wage)+'</span></div>';
  if(pen>0)h+='<div class="calc-row"><span class="k">ค่าปรับ</span><span class="v" style="color:var(--red)">฿'+fmt(pen)+'</span></div>';
  h+='<div class="calc-row" style="border-top:1px solid var(--border2);margin-top:4px;padding-top:6px"><span class="k" style="font-weight:600">รวมรับเงินวันนี้</span><span class="v" style="font-weight:700;color:var(--gold)">฿'+fmt(amt+pen)+'</span></div></div>';
  document.getElementById('pay-calc').innerHTML=h;
}
async function savePayment(custId,date,recId){
  var c=allCustomers.find(function(x){return x.id===custId});
  var amt=parseFloat(document.getElementById('pay-amount').value)||0;
  var pen=parseFloat(document.getElementById('pay-penalty').value)||0;
  var btn=document.getElementById('pay-save-btn');btn.innerHTML='<span class="spin"></span>';btn.disabled=true;

  // base principal: ถ้าแก้ไข ใช้ principal ก่อนหักของ record เดิม
  var baseC=c;
  if(recId){
    var old=allRecords.find(function(r){return r.id===recId});
    baseC=Object.assign({},c,{remaining_principal:c.remaining_principal + (old?+old.principal_reduced:0)});
  }
  var calc=calcPayment(baseC,amt);
  var payload={loan_id:custId,record_date:date,interest_due:calc.interest_due,amount_paid:amt,
    interest_collected:calc.interest_collected,principal_reduced:calc.principal_reduced,
    remaining_principal:calc.remaining_principal,wage:calc.wage,payment_status:calc.payment_status,
    penalty:pen,recorded_by:currentUser.id};
  var res=recId?await _sb.from('daily_records').update(payload).eq('id',recId):await _sb.from('daily_records').insert(payload);
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');btn.disabled=false;btn.textContent='บันทึก';return}

  // update customer
  var upd={remaining_principal:calc.remaining_principal};
  if(amt>0){upd.last_collection_date=date;upd.status='normal';}
  // lost + จ่ายเงิน → ปิดสินเชื่อทันที (ตามที่ตกลง)
  if(c.status==='lost'&&amt>0){upd.status='closed';upd.close_amount=closeAmount(Object.assign({},c,{remaining_principal:calc.remaining_principal}));}
  await _sb.from('loans').update(upd).eq('id',custId);

  toast(recId?'✅ แก้ไขสำเร็จ':'✅ บันทึกสำเร็จ','ok');
  closeModal('modal-payment');
  await loadAll();
  // ถ้าเปิดหน้ารายละเอียดอยู่ ให้รีเฟรชเนื้อหา
  if(document.getElementById('modal-detail').classList.contains('open')&&currentDetailId)openDetail(currentDetailId);
}

