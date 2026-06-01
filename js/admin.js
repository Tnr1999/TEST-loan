/* ═══════════════════════════════════════════════
   BRANCHES
═══════════════════════════════════════════════ */
function renderBranches(){
  if(!allBranches.length){document.getElementById('branch-list').innerHTML='<div class="empty">ยังไม่มีบ้าน</div>';return}
  var renderCard=function(b){
    var custCount=allCustomers.filter(function(c){return c.branch_id===b.id}).length;
    return '<div class="card card-pad" style="display:flex;align-items:center;justify-content:space-between;gap:10px">'+
      '<div><div style="font-weight:600;font-size:0.95rem">'+esc(b.name)+'</div>'+
      '<div style="font-size:0.78rem;color:var(--muted);margin-top:3px">ค่าธรรมเนียม ฿'+fmt0(b.fee_per_person)+' / คน · ค่าปรับ ฿'+fmt0(b.penalty_fee)+' · ลูกค้า '+custCount+' ราย</div></div>'+
      '<div class="row-flex" style="gap:8px"><button class="btn btn-ghost btn-sm" onclick="openEditBranch(\''+b.id+'\')">แก้ไข</button>'+
      '<button class="btn btn-red btn-sm" onclick="doDeleteBranch(\''+b.id+'\')">ลบ</button></div></div>';
  };
  var html='';
  allGroups.forEach(function(g){
    var bs=allBranches.filter(function(b){return b.group_id===g.id});
    if(!bs.length)return;
    html+='<div class="section-label">🗂️ '+esc(g.name)+' ('+bs.length+' บ้าน)</div>'+bs.map(renderCard).join('');
  });
  var ungrouped=allBranches.filter(function(b){return !b.group_id});
  if(ungrouped.length)html+='<div class="section-label" style="color:var(--amber)">⚠️ ยังไม่ได้จัดเข้ากอง</div>'+ungrouped.map(renderCard).join('');
  document.getElementById('branch-list').innerHTML=html;
}
var editingBranchId=null;
function openAddBranch(){editingBranchId=null;branchForm('+ เพิ่มบ้าน','','','','')}
function openEditBranch(id){var b=allBranches.find(function(x){return x.id===id});editingBranchId=id;branchForm('✏️ แก้ไขบ้าน',b.name,b.fee_per_person,b.group_id||'',b.penalty_fee)}
function branchForm(title,name,fee,groupId,penalty){
  document.getElementById('modal-branch-title').textContent=title;
  document.getElementById('modal-branch-body').innerHTML=
    '<div class="field"><label>กอง <span class="req">*</span></label><select class="inp" id="b-group">'+
      '<option value="">— เลือกกอง —</option>'+
      allGroups.map(function(g){return '<option value="'+g.id+'" '+(g.id===groupId?'selected':'')+'>'+esc(g.name)+'</option>'}).join('')+'</select></div>'+
    '<div class="field"><label>ชื่อบ้าน <span class="req">*</span></label><input class="inp" id="b-name" value="'+esc(name)+'"/></div>'+
    '<div class="field"><label>ค่าธรรมเนียม (บาท/คน)</label><input class="inp mono" id="b-fee" type="number" min="0" value="'+(fee||'')+'"/></div>'+
    '<div class="field"><label>ค่าปรับมาตรฐาน (บาท)</label><input class="inp mono" id="b-penalty" type="number" min="0" value="'+(penalty||'')+'"/><div style="font-size:0.72rem;color:var(--muted);margin-top:4px">ใช้เติมอัตโนมัติตอนรับเงิน (แก้ได้ทีละครั้ง)</div></div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-branch\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" onclick="saveBranch()">บันทึก</button></div>';
  openModal('modal-branch');
}
async function saveBranch(){
  var name=document.getElementById('b-name').value.trim();
  if(!name){toast('กรุณากรอกชื่อบ้าน','err');return}
  var payload={name:name,fee_per_person:parseFloat(document.getElementById('b-fee').value)||0,penalty_fee:parseFloat(document.getElementById('b-penalty').value)||0,group_id:document.getElementById('b-group').value||null};
  var res=editingBranchId?await _sb.from('branches').update(payload).eq('id',editingBranchId):await _sb.from('branches').insert(payload);
  if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');return}
  toast(editingBranchId?'✅ แก้ไขสำเร็จ':'✅ เพิ่มบ้านสำเร็จ','ok');closeModal('modal-branch');await loadAll();
}
async function doDeleteBranch(id){
  var b=allBranches.find(function(x){return x.id===id});
  var n=allCustomers.filter(function(c){return c.branch_id===id&&c.status!=='closed'}).length;
  if(n){toast('ลบไม่ได้ มีลูกค้าใช้งานอยู่ '+n+' ราย','err');return}
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
      '<div><div style="font-weight:600;font-size:0.95rem">🗂️ '+esc(g.name)+'</div>'+
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
    '<table class="tbl"><thead><tr><th>ชื่อ</th><th>Username</th><th>Role</th><th>ขอบเขต</th><th>สถานะ</th><th></th></tr></thead><tbody>'+
    allUsers.map(function(u){
      var branches=u.role==='owner'?'ทุกกอง'
        :u.role==='staff'?('บ้าน: '+((ubByUser[u.id]||[]).map(bName).join(', ')||'—'))
        :('กอง: '+((ugByUser[u.id]||[]).map(gName).join(', ')||'— (เห็นทุกบ้าน)'));
      return '<tr style="'+(u.is_active?'':'opacity:0.5')+'">'+
        '<td style="font-weight:500">'+esc(u.full_name)+'</td>'+
        '<td class="mono" style="color:var(--text2)">'+esc(u.username)+'</td>'+
        '<td><span class="role-badge role-'+u.role+'">'+ROLE_LABEL[u.role]+'</span></td>'+
        '<td style="color:var(--text2);font-size:0.8rem">'+esc(branches)+'</td>'+
        '<td>'+(u.is_active?'<span class="st st-normal">ใช้งาน</span>':'<span class="st st-closed">ปิด</span>')+'</td>'+
        '<td><div class="row-flex" style="gap:7px"><span class="link-gold" style="font-size:0.78rem" onclick="openEditUser(\''+u.id+'\')">แก้ไข</span>'+
        '<span style="font-size:0.78rem;color:var(--muted);cursor:pointer" onclick="toggleUserActive(\''+u.id+'\')">'+(u.is_active?'ปิด':'เปิด')+'</span></div></td></tr>';
    }).join('')+'</tbody></table>';
}
var editingUserId=null;
function openAddUser(){editingUserId=null;userForm(null)}
function openEditUser(id){editingUserId=id;userForm(allUsers.find(function(x){return x.id===id}))}
function userForm(u){
  var ubByUser={};allUserBranches.forEach(function(ub){(ubByUser[ub.user_id]=ubByUser[ub.user_id]||[]).push(ub.branch_id)});
  var ugByUser={};allUserGroups.forEach(function(ug){(ugByUser[ug.user_id]=ugByUser[ug.user_id]||[]).push(ug.group_id)});
  var myBr=u?(ubByUser[u.id]||[]):[];
  var myGr=u?(ugByUser[u.id]||[]):[];
  var role0=u?(u.role==='manager'?'head':u.role):'staff';   // map manager เดิม → head
  document.getElementById('modal-user-title').textContent=u?'✏️ แก้ไขผู้ใช้':'+ เพิ่มผู้ใช้';
  document.getElementById('modal-user-body').innerHTML=
    (u?'':'<div class="field"><label>Username <span class="req">*</span></label><input class="inp" id="u-username"/></div>')+
    '<div class="field"><label>ชื่อ-สกุล <span class="req">*</span></label><input class="inp" id="u-name" value="'+esc(u?u.full_name:'')+'"/></div>'+
    '<div class="field"><label>'+(u?'เปลี่ยนรหัสผ่าน (เว้นว่างถ้าไม่เปลี่ยน)':'รหัสผ่าน *')+'</label><input class="inp" id="u-pass" type="text"/></div>'+
    '<div class="field"><label>Role</label><div class="seg" id="u-role">'+
      ['owner','head','staff'].map(function(r){return '<button data-v="'+r+'" class="'+(role0===r?'sel':'')+'" onclick="selRole(\''+r+'\')">'+ROLE_LABEL[r]+'</button>'}).join('')+'</div></div>'+
    '<div class="field" id="u-group-wrap" style="'+(role0==='head'?'':'display:none')+'"><label>กองที่รับผิดชอบ</label>'+
      (allGroups.length?allGroups.map(function(g){return '<label class="checkbox-row"><input type="checkbox" class="u-group" value="'+g.id+'" '+(myGr.indexOf(g.id)>=0?'checked':'')+'/> '+esc(g.name)+'</label>'}).join(''):'<div class="field-hint">ยังไม่มีกอง</div>')+'</div>'+
    '<div class="field" id="u-branch-wrap" style="'+(role0==='staff'?'':'display:none')+'"><label>บ้านที่รับผิดชอบ</label>'+
      allBranches.map(function(b){return '<label class="checkbox-row"><input type="checkbox" class="u-branch" value="'+b.id+'" '+(myBr.indexOf(b.id)>=0?'checked':'')+'/> '+esc(b.name)+' <span style="color:var(--muted)">('+esc(groupNameOfBranch(b.id))+')</span></label>'}).join('')+'</div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px;padding:16px 20px">'+
      '<button class="btn btn-ghost btn-block" onclick="closeModal(\'modal-user\')">ยกเลิก</button>'+
      '<button class="btn btn-gold btn-block" onclick="saveUser()">บันทึก</button></div>';
  document.getElementById('modal-user-body')._role=role0;
  openModal('modal-user');
}
function selRole(r){
  document.querySelectorAll('#u-role button').forEach(function(b){b.classList.toggle('sel',b.getAttribute('data-v')===r)});
  document.getElementById('modal-user-body')._role=r;
  document.getElementById('u-branch-wrap').style.display=r==='staff'?'':'none';
  document.getElementById('u-group-wrap').style.display=r==='head'?'':'none';
}
async function saveUser(){
  var name=document.getElementById('u-name').value.trim();
  var pass=document.getElementById('u-pass').value;
  var role=document.getElementById('modal-user-body')._role;
  var branchIds=Array.prototype.slice.call(document.querySelectorAll('.u-branch:checked')).map(function(el){return el.value});
  var groupIds=Array.prototype.slice.call(document.querySelectorAll('.u-group:checked')).map(function(el){return el.value});
  if(!name){toast('กรุณากรอกชื่อ','err');return}

  var uid;
  if(editingUserId){
    var payload={full_name:name,role:role};
    if(pass)payload.password=pass;
    var res=await _sb.from('users').update(payload).eq('id',editingUserId);
    if(res.error){toast('บันทึกล้มเหลว: '+res.error.message,'err');return}
    uid=editingUserId;
  } else {
    var username=document.getElementById('u-username').value.trim();
    if(!username||!pass){toast('กรุณากรอก Username และรหัสผ่าน','err');return}
    var res=await _sb.from('users').insert({username:username,password:pass,full_name:name,role:role,is_active:true}).select().single();
    if(res.error){toast(res.error.code==='23505'?'Username นี้มีอยู่แล้ว':'บันทึกล้มเหลว: '+res.error.message,'err');return}
    uid=res.data.id;
  }

  // sync user_branches (staff)
  await _sb.from('user_branches').delete().eq('user_id',uid);
  if(role==='staff'&&branchIds.length)
    await _sb.from('user_branches').insert(branchIds.map(function(b){return{user_id:uid,branch_id:b}}));

  // sync user_groups (head)
  await _sb.from('user_groups').delete().eq('user_id',uid);
  if(role==='head'&&groupIds.length)
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

