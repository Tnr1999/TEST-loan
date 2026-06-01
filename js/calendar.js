/* ═══════════════════════════════════════════════
   CALENDAR (inline)
═══════════════════════════════════════════════ */
var _calY=0,_calM=0;
function initCalendar(){var d=new Date(document.getElementById('dash-date-picker').value+'T00:00:00');_calY=d.getFullYear();_calM=d.getMonth();updateCalLabel(document.getElementById('dash-date-picker').value);renderCalendar()}
function calNavMonth(dir){_calM+=dir;if(_calM<0){_calM=11;_calY--}if(_calM>11){_calM=0;_calY++}renderCalendar()}
function renderCalendar(){
  var months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  document.getElementById('cal-month-label').textContent=months[_calM]+' '+(_calY+543);
  var sel=document.getElementById('dash-date-picker').value,today=todayISO();
  var first=new Date(_calY,_calM,1).getDay(),dim=new Date(_calY,_calM+1,0).getDate();
  var cells='';for(var i=0;i<first;i++)cells+='<div></div>';
  for(var d=1;d<=dim;d++){
    var iso=_calY+'-'+String(_calM+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var isS=iso===sel,isT=iso===today;
    var bg=isS?'var(--gold)':isT?'var(--gold-dim)':'transparent',col=isS?'#fff':isT?'var(--gold)':'var(--text)';
    var bord=isS?'1px solid var(--gold)':isT?'1px solid var(--gold-dim)':'1px solid transparent';
    cells+='<button onclick="calPick(\''+iso+'\')" style="aspect-ratio:1;border-radius:8px;border:'+bord+';background:'+bg+';color:'+col+';font-weight:'+(isS?'700':'400')+';cursor:pointer;font-size:0.78rem;display:flex;align-items:center;justify-content:center">'+d+'</button>';
  }
  document.getElementById('cal-days-grid').innerHTML=cells;
}
function calPick(iso){document.getElementById('dash-date-picker').value=iso;updateCalLabel(iso);renderCalendar();renderDashboard()}
function calSelectToday(){var t=todayISO();_calY=new Date().getFullYear();_calM=new Date().getMonth();calPick(t)}
function updateCalLabel(iso){document.getElementById('dash-cal-label').textContent=thDate(iso)}

