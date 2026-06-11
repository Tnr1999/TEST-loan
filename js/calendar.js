/* ═══════════════════════════════════════════════
   CALENDAR — dashboard + หน้าลูกค้า ใช้ "วันที่เลือก" ร่วมกัน
   แหล่งความจริงเดียว = #dash-date-picker.value (ค่าเริ่ม = วันนี้)
═══════════════════════════════════════════════ */
var _calY=0,_calM=0;
var TH_MONTHS=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
var TH_DOW=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

// วันที่กำลังดู (ร่วมทั้ง dashboard + หน้าลูกค้า)
function selDate(){var p=document.getElementById('dash-date-picker');return (p&&p.value)||todayISO();}

function initCalendar(){var d=new Date(selDate()+'T00:00:00');_calY=d.getFullYear();_calM=d.getMonth();syncCalLabels();renderCalendar();}
function calNavMonth(dir){_calM+=dir;if(_calM<0){_calM=11;_calY--}if(_calM>11){_calM=0;_calY++}renderCalendar();}

// สร้าง HTML ของกริดวัน (ใช้ร่วมทั้ง 2 ปฏิทิน — เดือน/วันที่เลือกเหมือนกัน)
function buildCalGrid(){
  var sel=selDate(),today=todayISO();
  var first=new Date(_calY,_calM,1).getDay(),dim=new Date(_calY,_calM+1,0).getDate();
  var cells='';for(var i=0;i<first;i++)cells+='<div></div>';
  for(var d=1;d<=dim;d++){
    var iso=_calY+'-'+String(_calM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var isS=iso===sel,isT=iso===today;
    var bg=isS?'var(--gold)':isT?'var(--gold-dim)':'transparent',col=isS?'#fff':isT?'var(--gold)':'var(--text)';
    var bord=isS?'1px solid var(--gold)':isT?'1px solid var(--gold-dim)':'1px solid transparent';
    cells+='<button onclick="calPick(\''+iso+'\')" style="aspect-ratio:1;border-radius:8px;border:'+bord+';background:'+bg+';color:'+col+';font-weight:'+(isS?'700':'400')+';cursor:pointer;font-size:0.78rem;display:flex;align-items:center;justify-content:center">'+d+'</button>';
  }
  return cells;
}
function renderCalendar(){
  var label=TH_MONTHS[_calM]+' '+(_calY+543),cells=buildCalGrid();
  // dashboard
  var ml=document.getElementById('cal-month-label');if(ml)ml.textContent=label;
  var dg=document.getElementById('cal-days-grid');if(dg)dg.innerHTML=cells;
  // หน้าลูกค้า (popover)
  var ml2=document.getElementById('cust-cal-month-label');if(ml2)ml2.textContent=label;
  var dg2=document.getElementById('cust-cal-days-grid');if(dg2)dg2.innerHTML=cells;
}

// เลือกวัน → อัปเดตวันร่วม + ปฏิทินทั้งหมด + render ทั้ง dashboard และหน้าลูกค้า
function calPick(iso){
  var p=document.getElementById('dash-date-picker');if(p)p.value=iso;
  var d=new Date(iso+'T00:00:00');_calY=d.getFullYear();_calM=d.getMonth();
  syncCalLabels();renderCalendar();closeCustCal();
  if(typeof renderDashboard==='function')renderDashboard();
  if(typeof renderCustomers==='function')renderCustomers();
}
function calSelectToday(){calPick(todayISO());}
// ปุ่ม ‹ › บนแถบวันที่หน้าลูกค้า — เลื่อนทีละวัน
function calStepDay(dir){var d=new Date(selDate()+'T00:00:00');d.setDate(d.getDate()+dir);calPick(toISO(d));}

// ป้ายวันที่ (dashboard + แถบหน้าลูกค้า) + ไฮไลต์เมื่อไม่ใช่ "วันนี้"
function syncCalLabels(){
  var iso=selDate(),today=todayISO();
  var l=document.getElementById('dash-cal-label');if(l)l.textContent=thDate(iso);
  var cl=document.getElementById('cust-date-label');
  if(cl){var d=new Date(iso+'T00:00:00');cl.textContent=TH_DOW[d.getDay()]+' '+thDate(iso);}
  var bar=document.getElementById('cust-datebar');if(bar)bar.classList.toggle('not-today',iso!==today);
}

// popover ปฏิทินหน้าลูกค้า
function toggleCustCal(){var p=document.getElementById('cust-cal-pop');if(!p)return;if(p.hidden){initCalendar();p.hidden=false;}else{p.hidden=true;}}
function closeCustCal(){var p=document.getElementById('cust-cal-pop');if(p)p.hidden=true;}
// ปิด popover เมื่อคลิกนอกแถบวันที่
document.addEventListener('click',function(e){
  var bar=document.getElementById('cust-datebar');
  if(bar&&!bar.contains(e.target))closeCustCal();
});
