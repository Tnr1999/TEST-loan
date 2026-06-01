/* ═══════════════════════════════════════════════
   CUSTOMERS
═══════════════════════════════════════════════ */
function renderCustomers(){
  var search=(document.getElementById('cust-search').value||'').toLowerCase();
  var fg=document.getElementById('cust-filter-group')?document.getElementById('cust-filter-group').value:'';
  var fb=document.getElementById('cust-filter-branch').value;
  var fs=document.getElementById('cust-filter-status').value;
  var grpBids=fg?allBranches.filter(function(b){return b.group_id===fg}).map(function(b){return b.id}):null;
  var list=allCustomers.filter(function(c){
    if(fb&&c.branch_id!==fb)return false;
    if(grpBids&&grpBids.indexOf(c.branch_id)<0)return false;
    if(fs&&c.status!==fs)return false;
    if(search){
      var hit=c.full_name.toLowerCase().indexOf(search)>=0
        || (c.phone||'').indexOf(search)>=0
        || String(c.seq).indexOf(search)>=0;
      if(!hit)return false;
    }
    return true;
  });

  // คำนวณสถานะ "วันนี้" ของลูกค้าแต่ละคน (ใช้ทั้งชิป/เรียง/แสดงผล)
  var today=todayISO();
  var stMap={};
  list.forEach(function(c){
    var rec=allRecords.find(function(r){return r.customer_id===c.id&&r.record_date===today});
    var paid=rec&&rec.payment_status!=='unpaid';
    var due=c.status!=='closed'&&isPaymentDueToday(c,today);
    var over=c.status==='overdue'||c.status==='lost';
    stMap[c.id]={rec:rec,paid:paid,due:due,over:over};
  });

  // ชิปกรองด่วน (ตามงานประจำวัน) — default = ที่ต้องเก็บวันนี้
  var nToday=list.filter(function(c){var s=stMap[c.id];return s.due&&!s.paid}).length;
  var nOver=list.filter(function(c){var s=stMap[c.id];return s.over&&!s.paid}).length;
  var nPaid=list.filter(function(c){return stMap[c.id].paid}).length;
  var chips=[['today','⏰ วันนี้',nToday],['overdue','🔴 ค้าง',nOver],['paid','✓ จ่ายแล้ว',nPaid],['all','ทั้งหมด',list.length]];
  document.getElementById('cust-summary').innerHTML=chips.map(function(v){
    return '<button class="vchip vc-'+v[0]+(custView===v[0]?' active':'')+'" onclick="setCustView(\''+v[0]+'\')">'+v[1]+' <b>'+v[2]+'</b></button>';
  }).join('');

  // กรองตามมุมมองที่เลือก (ถ้ากำลังค้นหา → แสดงทุกผลลัพธ์ ไม่ตัดด้วยมุมมอง)
  var vlist=list.filter(function(c){
    if(search)return true;
    var s=stMap[c.id];
    if(custView==='today')return s.due&&!s.paid;
    if(custView==='overdue')return s.over&&!s.paid;
    if(custView==='paid')return s.paid;
    return true;
  });
  // เรียง: ต้องเก็บวันนี้ ▸ ค้าง ▸ ปกติ ▸ จ่ายแล้ว ▸ ปิด แล้วตามลำดับเลข
  function prio(c){var s=stMap[c.id];if(c.status==='closed')return 4;if(s.paid)return 3;if(s.due)return 0;if(s.over)return 1;return 2}
  vlist.sort(function(a,b){var d=prio(a)-prio(b);return d!==0?d:a.seq-b.seq});

  if(!vlist.length){
    var msg=custView==='today'?'🎉 วันนี้เก็บครบแล้ว ไม่มีใครค้าง':'ไม่พบลูกค้า';
    var eh='<div class="empty">'+msg+(custView!=='all'?'<br><button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="setCustView(\'all\')">ดูทั้งหมด</button>':'')+'</div>';
    document.getElementById('cust-list').innerHTML=eh;
    document.getElementById('cust-list-cards').innerHTML=eh;
    return;
  }
  // ตาราง (จอใหญ่)
  document.getElementById('cust-list').innerHTML=
    '<table class="tbl"><thead><tr><th>#</th><th>ชื่อ-สกุล</th><th>กอง</th><th>บ้าน</th><th class="tr-right">ต้นคงเหลือ</th><th>วันนี้</th><th>สถานะ</th><th></th></tr></thead><tbody>'+
    vlist.map(function(c){var s=stMap[c.id];
      var td=s.paid?'<span class="crow-st t-paid">✓ จ่าย ฿'+fmt(s.rec.amount_paid)+'</span>':(s.due?'<span class="crow-st t-due">⏰ ต้องเก็บ</span>':'—');
      return '<tr style="cursor:pointer" onclick="openDetail(\''+c.id+'\')">'+
      '<td class="mono" style="color:var(--muted)">'+c.seq+'</td>'+
      '<td><div style="font-weight:500">'+esc(c.full_name)+'</div>'+(c.phone?'<div style="font-size:0.72rem;color:var(--muted)">'+esc(c.phone)+'</div>':'')+'</td>'+
      '<td style="color:var(--text2)">'+esc(groupNameOfBranch(c.branch_id))+'</td>'+
      '<td style="color:var(--text2)">'+esc(branchName(c.branch_id))+'</td>'+
      '<td class="tr-right mono" style="font-weight:600">฿'+fmt(c.remaining_principal)+'</td>'+
      '<td>'+td+'</td>'+
      '<td><span class="st st-'+c.status+'">'+STATUS_LABEL[c.status]+'</span></td>'+
      '<td>'+(c.status!=='closed'?'<button class="btn '+(s.paid?'btn-ghost':'btn-gold')+' btn-sm" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+today+'\')">'+(s.paid?'แก้ไข':'💵 รับเงิน')+'</button>':'<span class="link-gold" style="font-size:0.78rem">ดู ›</span>')+'</td></tr>'}).join('')+
    '</tbody></table>';
  // การ์ดกระชับ (มือถือ) — แตะแถวเพื่อดูรายละเอียด, ปุ่มขวาเพื่อรับเงิน
  document.getElementById('cust-list-cards').innerHTML=
    vlist.map(function(c){var s=stMap[c.id];
      var ival=c.collection_interval===1?'ทุกวัน':'ทุก '+c.collection_interval+'ว';
      var cls=s.paid?'paid':(s.due?'due':(s.over?'over':''));
      var chip=s.paid?'<span class="crow-st t-paid">จ่ายแล้ว ฿'+fmt(s.rec.amount_paid)+'</span>'
        :(s.due?'<span class="crow-st t-due">⏰ วันนี้</span>'
        :(s.over?'<span class="crow-st t-over">ค้าง</span>':''));
      var btn=c.status==='closed'?''
        :'<button class="crow-btn '+(s.paid?'cb-edit':'cb-pay')+'" onclick="event.stopPropagation();openPayment(\''+c.id+'\',\''+today+'\')">'+(s.paid?'✏️':'💵 รับ')+'</button>';
      return '<div class="crow '+cls+'" onclick="openDetail(\''+c.id+'\')">'+
        '<div class="crow-main">'+
          '<div class="crow-l1"><span class="crow-seq">#'+c.seq+'</span><span class="crow-name">'+esc(c.full_name)+'</span>'+chip+'</div>'+
          '<div class="crow-l2">คงเหลือ <b style="color:var(--text)">฿'+fmt(c.remaining_principal)+'</b> · '+esc(branchName(c.branch_id))+' · '+ival+'</div>'+
        '</div>'+btn+'</div>';
    }).join('');
}
function setCustView(v){custView=v;renderCustomers()}

function openDetail(id){
  currentDetailId=id;
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  var b=allBranches.find(function(x){return x.id===c.branch_id});
  var recs=allRecords.filter(function(r){return r.customer_id===id}).sort(function(a,b){return b.record_date.localeCompare(a.record_date)});
  var ca=closeAmount(c);

  var h='<div class="page-head" style="margin-bottom:14px"><div>'+
    '<div class="row-flex" style="gap:8px;flex-wrap:wrap"><span class="mono" style="color:var(--muted)">#'+c.seq+'</span>'+
    '<span class="page-title" style="font-size:1.3rem">'+esc(c.full_name)+'</span>'+
    '<span class="st st-'+c.status+'">'+STATUS_LABEL[c.status]+'</span></div>'+
    '<div class="page-sub">'+esc(groupNameOfBranch(c.branch_id))+' · '+esc(b?b.name:'—')+'</div></div>';
  if(canEdit()&&c.status!=='closed')h+='<button class="btn btn-ghost btn-sm" onclick="openEditCustomer(\''+id+'\')">✏️ แก้ไข</button>';
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
  h+=dt('วันปล่อยสินเชื่อ',thDate(c.start_date));
  h+=dt('เก็บล่าสุด',c.last_collection_date?thDate(c.last_collection_date):'—');
  h+=dt('ค่าธรรมเนียมบ้าน','฿'+fmt0(c.branch_fee));
  h+=dt('ค่าปรับมาตรฐานบ้าน','฿'+fmt0(b?b.penalty_fee:0));
  h+='</div></div>';

  // QR code (ดึงรูปแบบ on-demand เฉพาะตอนเปิดดู)
  h+='<div id="detail-qr"></div>';

  // close amount
  if(c.status!=='closed'){
    h+='<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;gap:10px">'+
      '<div><div style="font-size:0.84rem;font-weight:500">ยอดปิดสินเชื่อ</div><div style="font-size:0.72rem;color:var(--muted)">ต้น + ดอกวันนี้ + ค่าธรรมเนียม</div></div>'+
      '<div style="font-size:1.3rem;font-weight:700;font-family:var(--font-mono);color:var(--gold)">฿'+fmt(ca)+'</div></div>';
  } else if(c.close_amount){
    h+='<div class="card card-pad" style="margin-bottom:14px;display:flex;align-items:center;justify-content:space-between"><div style="font-size:0.84rem;font-weight:500">ปิดสินเชื่อแล้ว</div><div style="font-size:1.2rem;font-weight:700;font-family:var(--font-mono);color:var(--muted)">฿'+fmt(c.close_amount)+'</div></div>';
  }

  // บันทึกการชำระ (รับเงิน / จ่ายย้อนวัน)
  if(c.status!=='closed'){
    h+='<button class="btn btn-gold btn-block" style="margin-bottom:14px" onclick="openPayment(\''+id+'\',todayISO())">💵 บันทึกการชำระ / จ่ายย้อนวัน</button>';
  }

  // actions (manager/owner)
  if(canEdit()&&c.status!=='closed'){
    h+='<div class="card card-pad" style="margin-bottom:14px"><div class="section-label" style="margin:0 0 10px">การดำเนินการ</div><div class="row-flex" style="flex-wrap:wrap;gap:8px">';
    if(c.status==='overdue')h+='<button class="btn btn-amber btn-sm" onclick="changeStatus(\''+id+'\',\'lost\')">เปลี่ยนเป็น "หายติดต่อ"</button>';
    h+='<button class="btn btn-green btn-sm" onclick="doCloseLoan(\''+id+'\')">✓ ปิดสินเชื่อ</button>';
    h+='<button class="btn btn-red btn-sm" onclick="doDeleteCustomer(\''+id+'\')">🗑 ลบลูกค้า</button>';
    h+='</div></div>';
  }

  // history
  h+='<div class="card"><div class="card-head"><h3>📜 ประวัติการชำระ ('+recs.length+' รายการ)</h3></div>';
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
  loadDetailQr(c.person_id);
}
function dt(k,v){return '<div class="dt-item"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>'}
// ดึงรูป QR ของลูกค้า (เฉพาะตอนเปิดดู) แล้วแสดงในหน้ารายละเอียด
function loadDetailQr(personId){
  if(!personId)return;
  _sb.from('persons').select('qr_image').eq('id',personId).single().then(function(r){
    var el=document.getElementById('detail-qr');if(!el)return;
    if(r.data&&r.data.qr_image)
      el.innerHTML='<div class="section-label">QR code</div><div class="card card-pad" style="text-align:center"><img src="'+r.data.qr_image+'" style="max-width:240px;width:100%;border-radius:10px"/></div>';
  });
}

async function changeStatus(id,status){
  var c=allCustomers.find(function(x){return x.id===id});
  var ok=await showConfirm({icon:'👻',title:'เปลี่ยนสถานะ',msg:'เปลี่ยน "'+c.full_name+'" เป็น "หายติดต่อไม่ได้"?',okText:'ยืนยัน',okClass:'btn-amber'});
  if(!ok)return;
  var res=await _sb.from('loans').update({status:status}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  toast('✅ อัปเดตสถานะแล้ว','ok');await loadAll();openDetail(id);
}
async function doCloseLoan(id){
  var c=allCustomers.find(function(x){return x.id===id});var ca=closeAmount(c);
  var ok=await showConfirm({icon:'✓',title:'ปิดสินเชื่อ',msg:'ยอดปิดสินเชื่อ ฿'+fmt(ca)+'\nการปิดไม่สามารถยกเลิกได้',okText:'ปิดสินเชื่อ',okClass:'btn-green'});
  if(!ok)return;
  var res=await _sb.from('loans').update({status:'closed',close_amount:ca}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  toast('✅ ปิดสินเชื่อสำเร็จ ยอด ฿'+fmt(ca),'ok');await loadAll();openDetail(id);
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
function openAddCustomer(){
  editingCustId=null;
  var groups=accessibleGroups();
  if(!groups.length){toast('กรุณาสร้างกองและผูกบ้านเข้ากองก่อน','err');return}
  document.getElementById('modal-customer-title').textContent='+ เพิ่มลูกค้า';
  document.getElementById('modal-customer-body').innerHTML=
    '<div class="field"><label>กอง <span class="req">*</span></label><select class="inp" id="f-group" onchange="custFormBranches()">'+
      groups.map(function(g){return '<option value="'+g.id+'">'+esc(g.name)+'</option>'}).join('')+'</select></div>'+
    '<div class="field"><label>บ้าน <span class="req">*</span></label><select class="inp" id="f-branch"></select></div>'+
    '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="inp" id="f-name"/><div class="field-err"></div></div>'+
    '<div class="field"><label>วงเงินที่ปล่อย (บาท) <span class="req">*</span></label><div class="seg" id="f-principal">'+
      [300,500,1000,1500,2000,2500,3000,3500,4000,4500,5000].map(function(a){return '<button type="button" data-v="'+a+'" onclick="selPrincipal('+a+')">'+fmt0(a)+'</button>'}).join('')+
      '</div><div class="field-err"></div></div>'+
    '<div class="field"><label>อัตราดอกรายวัน</label><input class="inp" value="10% (คงที่)" disabled style="opacity:0.7"/></div>'+
    '<div class="field"><label>ระยะเก็บดอก</label><div class="seg" id="f-interval">'+
      '<button class="sel" data-v="1" onclick="selInterval(1)">ทุกวัน</button>'+
      '<button data-v="2" onclick="selInterval(2)">ทุก 2 วัน</button>'+
      '<button data-v="3" onclick="selInterval(3)">ทุก 3 วัน</button></div></div>'+
    '<div class="field"><label>วันที่ปล่อยสินเชื่อ</label><input class="inp" value="'+thDate(todayISO())+'" disabled style="opacity:0.7"/></div>'+
    '<hr style="border:none;border-top:1px solid var(--border);margin:18px 0"/>'+
    '<div class="field"><label>เบอร์โทรศัพท์</label><input class="inp" id="f-phone" placeholder="08x-xxx-xxxx"/></div>'+
    '<div class="field"><label>Facebook URL</label><input class="inp" id="f-fb" placeholder="https://facebook.com/..."/></div>'+
    '<div class="field"><label>เลขบัตรประชาชน</label><input class="inp" id="f-idcard" maxlength="13"/></div>'+
    '<div class="field"><label>QR code (พร้อมเพย์/โอนเงิน)</label><input class="inp" type="file" accept="image/*" id="f-qr" onchange="readQrFile(this)"/><div id="f-qr-preview"></div></div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-customer\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" id="cust-save-btn" onclick="saveCustomer()">เพิ่มลูกค้า</button></div>';
  var body=document.getElementById('modal-customer-body');body._interval=1;body._principal=null;body._qr=null;
  custFormBranches();
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
  editingCustId=id;
  var c=allCustomers.find(function(x){return x.id===id});if(!c)return;
  document.getElementById('modal-customer-title').textContent='✏️ แก้ไขลูกค้า';
  document.getElementById('modal-customer-body').innerHTML=
    '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="inp" id="f-name" value="'+esc(c.full_name)+'"/></div>'+
    '<div class="field"><label>เบอร์โทรศัพท์</label><input class="inp" id="f-phone" value="'+esc(c.phone||'')+'"/></div>'+
    '<div class="field"><label>Facebook URL</label><input class="inp" id="f-fb" value="'+esc(c.facebook_url||'')+'"/></div>'+
    '<div class="field"><label>เลขบัตรประชาชน</label><input class="inp" id="f-idcard" maxlength="13" value="'+esc(c.id_card||'')+'"/></div>'+
    '<div class="field"><label>QR code (พร้อมเพย์/โอนเงิน)</label><input class="inp" type="file" accept="image/*" id="f-qr" onchange="readQrFile(this)"/><div id="f-qr-preview"></div></div>'+
    '<div class="field-hint" style="background:var(--surface);padding:10px;border-radius:8px">หมายเหตุ: ไม่สามารถแก้ไข วงเงิน/อัตราดอก/ระยะเก็บดอก ได้หลังสร้างแล้ว</div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-customer\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" onclick="saveCustomer()">บันทึก</button></div>';
  document.getElementById('modal-customer-body')._qr=undefined; // undefined = ไม่เปลี่ยนรูปเดิม
  // โหลดรูป QR เดิมมาแสดงตัวอย่าง
  _sb.from('persons').select('qr_image').eq('id',c.person_id).single().then(function(r){
    if(r.data&&r.data.qr_image)document.getElementById('f-qr-preview').innerHTML='<img src="'+r.data.qr_image+'" style="max-width:160px;border-radius:8px;margin-top:8px"/>';
  });
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
// อ่านไฟล์ QR → ย่อขนาด (กว้าง/สูงสุด 500px) → เก็บเป็น base64 + พรีวิว
function readQrFile(input){
  var f=input.files&&input.files[0];if(!f)return;
  var rd=new FileReader();
  rd.onload=function(e){
    var img=new Image();
    img.onload=function(){
      var max=500,w=img.width,h=img.height;
      if(w>h&&w>max){h=Math.round(h*max/w);w=max;}else if(h>=w&&h>max){w=Math.round(w*max/h);h=max;}
      var cv=document.createElement('canvas');cv.width=w;cv.height=h;
      cv.getContext('2d').drawImage(img,0,0,w,h);
      var data=cv.toDataURL('image/jpeg',0.85);
      document.getElementById('modal-customer-body')._qr=data;
      document.getElementById('f-qr-preview').innerHTML='<img src="'+data+'" style="max-width:160px;border-radius:8px;margin-top:8px"/>';
    };
    img.src=e.target.result;
  };
  rd.readAsDataURL(f);
}
async function saveCustomer(){
  var name=document.getElementById('f-name').value.trim();
  if(!name){toast('กรุณากรอกชื่อ','err');return}
  var btn=document.getElementById('cust-save-btn');
  var phone=document.getElementById('f-phone').value.trim()||null;
  var fb=document.getElementById('f-fb').value.trim()||null;
  var idcard=document.getElementById('f-idcard').value.trim()||null;
  var qr=document.getElementById('modal-customer-body')._qr; // undefined=ไม่เปลี่ยน, null/dataURL=ตั้งค่า

  // โหมดแก้ไข → แก้ที่ตาราง persons (ตัวตนของคน)
  if(editingCustId){
    var cc=allCustomers.find(function(x){return x.id===editingCustId});
    var upd={full_name:name,phone:phone,facebook_url:fb,id_card:idcard};
    if(qr!==undefined)upd.qr_image=qr; // อัปเดตรูปเฉพาะเมื่อเลือกไฟล์ใหม่
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

  // หา person เดิมจากเลขบัตร (ถ้ากรอก) เพื่อบังคับกฎกู้หลายที่
  var existing=idcard?allPersons.find(function(p){return p.id_card===idcard}):null;
  var ruleErr=loanRuleError(existing?existing.id:null,branchId);
  if(ruleErr){toast(ruleErr,'err');return}

  if(btn){btn.innerHTML='<span class="spin"></span>';btn.disabled=true}

  // ใช้ person เดิม หรือสร้างใหม่
  var personId;
  if(existing){
    personId=existing.id;
    if(qr)await _sb.from('persons').update({qr_image:qr}).eq('id',personId); // อัปเดต QR ให้คนเดิมถ้าอัปโหลดใหม่
  }
  else{
    var pres=await _sb.from('persons').insert({full_name:name,phone:phone,id_card:idcard,facebook_url:fb,qr_image:qr||null}).select().single();
    if(pres.error){toast('บันทึกล้มเหลว: '+pres.error.message,'err');if(btn){btn.disabled=false;btn.textContent='เพิ่มลูกค้า'}return}
    personId=pres.data.id;
  }

  // สร้างสัญญา — seq ให้ฐานข้อมูลกำหนดเอง (รันต่อเนื่องทั้งระบบ)
  var res=await _sb.from('loans').insert({
    person_id:personId,branch_id:branchId,
    principal:principal,daily_interest_rate:0.10,
    collection_interval:interval,start_date:todayISO(),
    status:'normal',remaining_principal:principal,branch_fee:branch?branch.fee_per_person:0
  }).select().single();
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');if(btn){btn.disabled=false;btn.textContent='เพิ่มลูกค้า'}return}
  toast('✅ เพิ่มลูกค้าสำเร็จ','ok');closeModal('modal-customer');await loadAll();openDetail(res.data.id);
}

