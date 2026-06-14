/* ═══════════════════════════════════════════════
   SETTINGS TABS
═══════════════════════════════════════════════ */
function showSettingsTab(tab){
  document.querySelectorAll('.stab').forEach(function(b){b.classList.remove('active')});
  document.querySelectorAll('.stab-pane').forEach(function(p){p.classList.remove('active')});
  var btn=document.getElementById('stab-btn-'+tab);
  var pane=document.getElementById('stab-'+tab);
  if(btn)btn.classList.add('active');
  if(pane)pane.classList.add('active');
}

/* ═══════════════════════════════════════════════
   BRANCHES
═══════════════════════════════════════════════ */
function renderBranches(){
  if(!allBranches.length){document.getElementById('branch-list').innerHTML='<div class="empty">ยังไม่มีบ้าน</div>';return}
  var renderCard=function(b){
    var custCount=allCustomers.filter(function(c){return c.branch_id===b.id}).length;
    var staff=b.staff_id&&allUsers.find(function(u){return u.id===b.staff_id});
    var lh=lineHeadOfBranch(b.id);
    return '<div class="card card-pad" style="display:flex;align-items:center;justify-content:space-between;gap:10px">'+
      '<div><div style="font-weight:600;font-size:0.95rem">'+esc(b.name)+'</div>'+
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:3px">ค่าธรรมเนียม ฿'+fmt0(b.fee_per_person)+' / คน · ลูกค้า '+custCount+' ราย'+(staff?' · พนักงาน: '+esc(staff.full_name):'')+(lh?' · หัวหน้าสาย: '+esc(lh.full_name):'')+'</div></div>'+
      '<div class="row-flex" style="gap:8px"><button class="btn btn-ghost btn-sm" onclick="openEditBranch(\''+b.id+'\')">แก้ไข</button>'+
      '<button class="btn btn-red btn-sm" onclick="doDeleteBranch(\''+b.id+'\')">ลบ</button></div></div>';
  };
  // หัวหน้ากอง (ไม่ใช่ owner) → เห็นเฉพาะกอง/บ้านของตัวเอง
  var gids=isOwner()?null:myGroupIds();
  var bids=isOwner()?null:myBranchIds();
  var inScope=function(b){return bids?bids.indexOf(b.id)>=0:true};
  var html='';
  allGroups.forEach(function(g){
    if(gids&&gids.indexOf(g.id)<0)return;
    var bs=allBranches.filter(function(b){return b.group_id===g.id&&inScope(b)});
    if(!bs.length)return;
    html+='<div class="section-label">'+esc(g.name)+' ('+bs.length+' บ้าน)</div>'+bs.map(renderCard).join('');
  });
  if(isOwner()){
    var ungrouped=allBranches.filter(function(b){return !b.group_id});
    if(ungrouped.length)html+='<div class="section-label" style="color:var(--amber)">⚠️ ยังไม่ได้จัดเข้ากอง</div>'+ungrouped.map(renderCard).join('');
  }
  document.getElementById('branch-list').innerHTML=html||'<div class="empty">ยังไม่มีบ้านในขอบเขตของคุณ</div>';
}
var editingBranchId=null;
function openAddBranch(){editingBranchId=null;branchForm('+ เพิ่มบ้าน','','','','','','')}
function openEditBranch(id){var b=allBranches.find(function(x){return x.id===id});editingBranchId=id;var lh=lineHeadOfBranch(id);branchForm('✏️ แก้ไขบ้าน',b.name,b.code||'',b.fee_per_person,b.group_id||'',b.staff_id||'',lh?lh.id:'')}
// ผู้ใช้ที่สังกัดกองนี้ (ผูกผ่าน user_groups) — owner ไม่ผูกกองจึงไม่ขึ้น
function usersInGroup(groupId){
  if(!groupId)return [];
  return allUsers.filter(function(u){
    return allUserGroups.some(function(ug){return ug.user_id===u.id&&ug.group_id===groupId});
  });
}
// ตัวเลือก dropdown พนักงานเจ้าของบ้าน (ทุก role ในกองนี้)
function branchStaffOptions(groupId,sel){
  return '<option value="">— ไม่กำหนด —</option>'+
    usersInGroup(groupId).map(function(u){return '<option value="'+u.id+'" '+(u.id===sel?'selected':'')+'>'+esc(u.full_name)+' ('+(ROLE_LABEL[u.role]||u.role)+')</option>'}).join('');
}
// ตัวเลือก dropdown หัวหน้าสาย (เฉพาะ role line/manager ในกองนี้)
function branchLineOptions(groupId,sel){
  return '<option value="">— ไม่กำหนด —</option>'+
    usersInGroup(groupId).filter(function(u){return u.role==='line'||u.role==='manager'}).map(function(u){return '<option value="'+u.id+'" '+(u.id===sel?'selected':'')+'>'+esc(u.full_name)+'</option>'}).join('');
}
// เปลี่ยนกอง → รีเฟรชตัวเลือกพนักงาน/หัวหน้าสายให้เหลือเฉพาะคนในกองใหม่
function refreshBranchAssignOptions(){
  var g=document.getElementById('b-group').value;
  var s=document.getElementById('b-staff');if(s)s.innerHTML=branchStaffOptions(g,null);
  var l=document.getElementById('b-linehead');if(l)l.innerHTML=branchLineOptions(g,null);
}
function branchForm(title,name,code,fee,groupId,staffId,lineHeadId){
  document.getElementById('modal-branch-title').textContent=title;
  var assignFields='';
  if(isOwner()){
    assignFields=
      '<div class="field"><label>พนักงานเจ้าของบ้าน</label><select class="inp" id="b-staff">'+
        branchStaffOptions(groupId,staffId)+'</select></div>'+
      '<div style="font-size:0.72rem;color:var(--muted);margin:-6px 0 12px">ค่าแรง 20% ของบ้านนี้เข้าคนนี้ · ได้สิทธิ์เห็นบ้านนี้อัตโนมัติ · 1 คนถือได้บ้านเดียว · แสดงเฉพาะคนในกองนี้</div>'+
      '<div class="field"><label>หัวหน้าสาย</label><select class="inp" id="b-linehead">'+
        branchLineOptions(groupId,lineHeadId)+'</select></div>'+
      '<div style="font-size:0.72rem;color:var(--muted);margin:-6px 0 12px">หัวหน้าสายของบ้านนี้ — รับค่าคอม 5% ของบ้านนี้ · เห็นบ้านนี้อัตโนมัติ · ยังไม่กำหนด = ไม่หักคอม · แสดงเฉพาะคนในกองนี้</div>';
  }
  document.getElementById('modal-branch-body').innerHTML=
    '<div class="field"><label>กอง <span class="req">*</span></label><select class="inp" id="b-group" onchange="refreshBranchAssignOptions()">'+
      '<option value="">— เลือกกอง —</option>'+
      allGroups.map(function(g){return '<option value="'+g.id+'" '+(g.id===groupId?'selected':'')+'>'+esc(g.name)+'</option>'}).join('')+'</select></div>'+
    '<div style="display:flex;gap:10px">'+
      '<div class="field" style="flex:1"><label>ชื่อบ้าน <span class="req">*</span></label><input class="inp" id="b-name" value="'+esc(name)+'"/></div>'+
      '<div class="field" style="width:110px"><label>รหัสบ้าน</label><input class="inp mono" id="b-code" maxlength="5" value="'+esc(code||'')+'" placeholder="AA" style="text-transform:uppercase"/></div>'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--muted);margin:-6px 0 12px">รหัสบ้านใช้ขึ้นต้นรหัสลูกค้า เช่น AA → ลูกค้าเป็น AA001, AA002…</div>'+
    '<div class="field"><label>ค่าธรรมเนียม (บาท/คน)</label><input class="inp mono" id="b-fee" type="number" min="0" value="'+(fee||'')+'"/></div>'+
    assignFields+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-branch\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" onclick="saveBranch()">บันทึก</button></div>';
  openModal('modal-branch');
}
async function saveBranch(){
  var name=document.getElementById('b-name').value.trim();
  if(!name){toast('กรุณากรอกชื่อบ้าน','err');return}
  var payload={name:name,code:(document.getElementById('b-code').value.trim().toUpperCase())||null,fee_per_person:parseFloat(document.getElementById('b-fee').value)||0,group_id:document.getElementById('b-group').value||null};
  var staffEl=document.getElementById('b-staff');
  var staffId=staffEl?(staffEl.value||null):null;
  if(staffEl)payload.staff_id=staffId;
  var lineEl=document.getElementById('b-linehead');
  var lineHeadId=lineEl?(lineEl.value||null):null;
  var bid=editingBranchId,res;
  if(editingBranchId){
    res=await _sb.from('branches').update(payload).eq('id',editingBranchId);
  } else {
    res=await _sb.from('branches').insert(payload).select().single();
    if(!res.error)bid=res.data.id;
  }
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');return}
  // ── พนักงานเจ้าของบ้าน (staff_id) ── กฎ 1 คน 1 บ้าน + ให้สิทธิ์เห็นบ้านนี้อัตโนมัติ
  if(staffId){
    var prevOwned=allBranches.filter(function(b){return b.staff_id===staffId&&b.id!==bid});
    for(var i=0;i<prevOwned.length;i++)await _sb.from('branches').update({staff_id:null}).eq('id',prevOwned[i].id);
    if(!allUserBranches.some(function(ub){return ub.user_id===staffId&&ub.branch_id===bid}))
      await _sb.from('user_branches').insert({user_id:staffId,branch_id:bid});
  }
  // ── หัวหน้าสายของบ้านนี้ ── บ้าน 1 หลัง = หัวหน้าสาย 1 คน (จัดการ user_branches ของ role line)
  var oldLineUB=allUserBranches.filter(function(ub){
    if(ub.branch_id!==bid||ub.user_id===lineHeadId||ub.user_id===staffId)return false;
    var u=allUsers.find(function(x){return x.id===ub.user_id});
    return u&&(u.role==='line'||u.role==='manager');
  });
  for(var j=0;j<oldLineUB.length;j++)await _sb.from('user_branches').delete().eq('user_id',oldLineUB[j].user_id).eq('branch_id',bid);
  if(lineHeadId&&!allUserBranches.some(function(ub){return ub.user_id===lineHeadId&&ub.branch_id===bid}))
    await _sb.from('user_branches').insert({user_id:lineHeadId,branch_id:bid});
  toast(editingBranchId?'✅ แก้ไขสำเร็จ':'✅ เพิ่มบ้านสำเร็จ','ok');closeModal('modal-branch');await loadAll();
}
async function doDeleteBranch(id){
  var b=allBranches.find(function(x){return x.id===id});
  // มีลูกค้า active → ห้ามลบ
  var active=allLoans.filter(function(l){return l.branch_id===id&&l.status!=='closed'}).length;
  if(active){toast('ลบไม่ได้ มีลูกค้าใช้งานอยู่ '+active+' ราย','err');return}
  // ยังมีประวัติสินเชื่อ (รวมที่ปิดแล้ว) อ้างถึงบ้านนี้ → DB มี FK กันลบ
  var total=allLoans.filter(function(l){return l.branch_id===id}).length;
  if(total){toast('ลบไม่ได้ บ้านนี้มีประวัติสินเชื่อที่ปิดแล้ว '+total+' รายการ','err');return}
  var ok=await showConfirm({icon:'🏠',title:'ลบบ้าน',msg:'ลบบ้าน "'+b.name+'"?',okText:'ลบ',okClass:'btn-red'});
  if(!ok)return;
  var res=await _sb.from('branches').delete().eq('id',id);
  if(res.error){toast('ลบล้มเหลว: '+res.error.message,'err');return}
  toast('✅ ลบบ้านแล้ว','ok');await loadAll();
}

/* ═══════════════════════════════════════════════
   GROUPS (กอง) — owner only
═══════════════════════════════════════════════ */
function renderGroups(){
  var el=document.getElementById('group-list');if(!el)return;
  if(!allGroups.length){el.innerHTML='<div class="empty">ยังไม่มีกอง</div>';return}
  el.innerHTML=allGroups.map(function(g){
    var nBranch=allBranches.filter(function(b){return b.group_id===g.id}).length;
    var nCust=allCustomers.filter(function(c){var b=allBranches.find(function(x){return x.id===c.branch_id});return b&&b.group_id===g.id}).length;
    return '<div class="card card-pad" style="display:flex;align-items:center;justify-content:space-between;gap:10px">'+
      '<div><div style="font-weight:600;font-size:0.95rem">'+esc(g.name)+'</div>'+
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:3px">'+nBranch+' บ้าน · ลูกค้า '+nCust+' ราย</div></div>'+
      '<div class="row-flex" style="gap:8px"><button class="btn btn-ghost btn-sm" onclick="openEditGroup(\''+g.id+'\')">แก้ไข</button>'+
      '<button class="btn btn-red btn-sm" onclick="doDeleteGroup(\''+g.id+'\')">ลบ</button></div></div>';
  }).join('');
}
var editingGroupId=null;
function openAddGroup(){editingGroupId=null;groupForm('+ เพิ่มกอง','')}
function openEditGroup(id){var g=allGroups.find(function(x){return x.id===id});editingGroupId=id;groupForm('✏️ แก้ไขกอง',g.name)}
function groupForm(title,name){
  document.getElementById('modal-group-title').textContent=title;
  document.getElementById('modal-group-body').innerHTML=
    '<div class="field"><label>ชื่อกอง <span class="req">*</span></label><input class="inp" id="g-name" value="'+esc(name)+'"/></div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-group\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" onclick="saveGroup()">บันทึก</button></div>';
  openModal('modal-group');
}
async function saveGroup(){
  var name=document.getElementById('g-name').value.trim();
  if(!name){toast('กรุณากรอกชื่อกอง','err');return}
  var res=editingGroupId?await _sb.from('groups').update({name:name}).eq('id',editingGroupId):await _sb.from('groups').insert({name:name});
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');return}
  toast(editingGroupId?'✅ แก้ไขสำเร็จ':'✅ เพิ่มกองสำเร็จ','ok');closeModal('modal-group');await loadAll();
}
async function doDeleteGroup(id){
  var g=allGroups.find(function(x){return x.id===id});
  var n=allBranches.filter(function(b){return b.group_id===id}).length;
  if(n){toast('ลบไม่ได้ มีบ้านอยู่ในกองนี้ '+n+' บ้าน (ย้ายบ้านออกก่อน)','err');return}
  var ok=await showConfirm({icon:'🗂️',title:'ลบกอง',msg:'ลบกอง "'+g.name+'"?',okText:'ลบ',okClass:'btn-red'});
  if(!ok)return;
  var res=await _sb.from('groups').delete().eq('id',id);
  if(res.error){toast('ลบล้มเหลว: '+res.error.message,'err');return}
  toast('✅ ลบกองแล้ว','ok');await loadAll();
}

/* ═══════════════════════════════════════════════
   USERS (owner only)
═══════════════════════════════════════════════ */
function renderUsers(){
  if(!allUsers.length){document.getElementById('user-list').innerHTML='<div class="empty">ยังไม่มีผู้ใช้</div>';return}
  var ubByUser={};allUserBranches.forEach(function(ub){(ubByUser[ub.user_id]=ubByUser[ub.user_id]||[]).push(ub.branch_id)});
  var ugByUser={};allUserGroups.forEach(function(ug){(ugByUser[ug.user_id]=ugByUser[ug.user_id]||[]).push(ug.group_id)});
  var bName=function(id){var b=allBranches.find(function(x){return x.id===id});return b?b.name:'?'};
  var gName=function(id){var g=allGroups.find(function(x){return x.id===id});return g?g.name:'?'};
  document.getElementById('user-list').innerHTML=
    '<div class="table-wrap"><table class="tbl"><thead><tr><th>ชื่อ</th><th>Username</th><th>Role</th><th>ขอบเขต</th><th>สถานะ</th><th></th></tr></thead><tbody>'+
    allUsers.map(function(u){
      var branches=u.role==='owner'?'ทุกกอง'
        :u.role==='head'?('กอง: '+((ugByUser[u.id]||[]).map(gName).join(', ')||'— (เห็นทุกบ้าน)'))
        :('บ้าน: '+((ubByUser[u.id]||[]).map(bName).join(', ')||'—'));
      return '<tr style="'+(u.is_active?'':'opacity:0.5')+'">'+
        '<td style="font-weight:500">'+esc(u.full_name)+'</td>'+
        '<td class="mono" style="color:var(--text2)">'+esc(u.username)+'</td>'+
        '<td><span class="role-badge role-'+u.role+'">'+ROLE_LABEL[u.role]+'</span></td>'+
        '<td style="color:var(--text2);font-size:0.8rem">'+esc(branches)+'</td>'+
        '<td>'+(u.is_active?'<span class="st st-normal">ใช้งาน</span>':'<span class="st st-closed">ปิด</span>')+'</td>'+
        '<td><div class="row-flex" style="gap:7px"><button class="btn btn-ghost btn-xs" onclick="openEditUser(\''+u.id+'\')">แก้ไข</button>'+
        '<button class="btn btn-ghost btn-xs" onclick="toggleUserActive(\''+u.id+'\')">'+(u.is_active?'ปิด':'เปิด')+'</button></div></td></tr>';
    }).join('')+'</tbody></table></div>';
}
var editingUserId=null;
function openAddUser(){editingUserId=null;userForm(null)}
function openEditUser(id){editingUserId=id;userForm(allUsers.find(function(x){return x.id===id}))}
function userForm(u){
  var ubByUser={};allUserBranches.forEach(function(ub){(ubByUser[ub.user_id]=ubByUser[ub.user_id]||[]).push(ub.branch_id)});
  var ugByUser={};allUserGroups.forEach(function(ug){(ugByUser[ug.user_id]=ugByUser[ug.user_id]||[]).push(ug.group_id)});
  var myBr=u?(ubByUser[u.id]||[]):[];
  var myGr=u?(ugByUser[u.id]||[]):[];
  var role0=u?(u.role==='manager'?'line':u.role):'staff';   // map manager เดิม → หัวหน้าสาย (line)
  document.getElementById('modal-user-title').textContent=u?'✏️ แก้ไขผู้ใช้':'+ เพิ่มผู้ใช้';
  document.getElementById('modal-user-body').innerHTML=
    '<div class="field"><label>Username <span class="req">*</span></label><input class="inp" id="u-username" value="'+esc(u?u.username:'')+'"/></div>'+
    '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="inp" id="u-name" value="'+esc(u?u.full_name:'')+'"/></div>'+
    '<div class="field"><label>'+(u?'เปลี่ยนรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)':'รหัสผ่าน *')+'</label><input class="inp" id="u-pass" type="text"/></div>'+
    '<div class="field"><label>Role</label><div class="seg" id="u-role">'+
      ['owner','head','line','staff'].map(function(r){return '<button data-v="'+r+'" class="'+(role0===r?'sel':'')+'" onclick="selRole(\''+r+'\')">'+ROLE_LABEL[r]+'</button>'}).join('')+'</div></div>'+
    '<div class="field" id="u-group-wrap" style="'+(role0!=='owner'?'':'display:none')+'"><label>กอง</label>'+
      (allGroups.length?allGroups.map(function(g){return '<label class="checkbox-row"><input type="checkbox" class="u-group" value="'+g.id+'" '+(myGr.indexOf(g.id)>=0?'checked':'')+'/> '+esc(g.name)+'</label>'}).join(''):'<div class="field-hint">ยังไม่มีกอง</div>')+'</div>'+
    '<div id="u-scope-hint" style="'+(role0==='line'||role0==='staff'?'':'display:none')+';font-size:0.78rem;color:var(--muted);background:var(--surface);border-radius:10px;padding:10px 12px;margin-top:4px">📍 เลือก<b>กอง</b>ที่สังกัด แล้วไปจัดเข้าบ้านที่หน้า <b>ตั้งค่า → บ้าน</b> — เลือกคนนี้เป็น "พนักงานเจ้าของบ้าน" หรือ "หัวหน้าสาย" ของบ้านในกองนั้น ระบบจะให้สิทธิ์เห็นบ้านอัตโนมัติ</div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-user\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" onclick="saveUser()">บันทึก</button></div>';
  document.getElementById('modal-user-body')._role=role0;
  openModal('modal-user');
}
function selRole(r){
  document.querySelectorAll('#u-role button').forEach(function(b){b.classList.toggle('sel',b.getAttribute('data-v')===r)});
  document.getElementById('modal-user-body')._role=r;
  var elGroup=document.getElementById('u-group-wrap');if(elGroup)elGroup.style.display=r!=='owner'?'':'none';
  var elHint=document.getElementById('u-scope-hint');if(elHint)elHint.style.display=(r==='line'||r==='staff')?'':'none';
}
async function saveUser(){
  var name=document.getElementById('u-name').value.trim();
  var username=document.getElementById('u-username').value.trim();
  var pass=document.getElementById('u-pass').value;
  var role=document.getElementById('modal-user-body')._role;
  // DB enum user_role ไม่มีค่า 'line' (มีแต่ 'manager' เดิม) → เก็บเป็น 'manager' · ตอนแสดงผลโค้ดแปลงกลับเป็น 'line' ให้เอง
  var roleDb=(role==='line')?'manager':role;
  var groupIds=Array.prototype.slice.call(document.querySelectorAll('.u-group:checked')).map(function(el){return el.value});
  if(!name){toast('กรุณากรอกชื่อ','err');return}
  if(!username){toast('กรุณากรอก Username','err');return}

  var uid;
  if(editingUserId){
    var payload={full_name:name,username:username,role:roleDb};
    if(pass)payload.password=pass;
    var res=await _sb.from('users').update(payload).eq('id',editingUserId);
    if(res.error){toast(res.error.code==='23505'?'Username นี้มีอยู่แล้ว':'บันทึกล้มเหลว: '+res.error.message,'err');return}
    uid=editingUserId;
  } else {
    if(!pass){toast('กรุณากรอกรหัสผ่าน','err');return}
    var res=await _sb.from('users').insert({username:username,password:pass,full_name:name,role:roleDb,is_active:true}).select().single();
    if(res.error){toast(res.error.code==='23505'?'Username นี้มีอยู่แล้ว':'บันทึกล้มเหลว: '+res.error.message,'err');return}
    uid=res.data.id;
  }

  // sync user_groups (กองที่สังกัด ทุก role ยกเว้น owner) · user_branches (สิทธิ์เห็นบ้าน/สาย) จัดการที่หน้า "บ้าน" ไม่ยุ่งที่นี่
  await _sb.from('user_groups').delete().eq('user_id',uid);
  if(role!=='owner'&&groupIds.length)
    await _sb.from('user_groups').insert(groupIds.map(function(g){return{user_id:uid,group_id:g}}));

  toast(editingUserId?'✅ แก้ไขสำเร็จ':'✅ เพิ่มผู้ใช้สำเร็จ','ok');closeModal('modal-user');await loadAll();
}
async function toggleUserActive(id){
  var u=allUsers.find(function(x){return x.id===id});
  if(id===currentUser.id){toast('ไม่สามารถปิดบัญชีตัวเองได้','err');return}
  var res=await _sb.from('users').update({is_active:!u.is_active}).eq('id',id);
  if(res.error){toast('ล้มเหลว: '+res.error.message,'err');return}
  toast(u.is_active?'ปิดบัญชีแล้ว':'เปิดบัญชีแล้ว','ok');await loadAll();
}

