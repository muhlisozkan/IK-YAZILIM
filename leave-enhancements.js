const nationalHolidays = ['2026-01-01','2026-04-23','2026-05-01','2026-05-19','2026-07-15','2026-08-30','2026-10-29'];
function businessDays(start,end){let n=0,d=new Date(start),last=new Date(end);while(d<=last){const day=d.getDay(),iso=d.toISOString().slice(0,10);if(day!==0&&day!==6&&!nationalHolidays.includes(iso))n++;d.setDate(d.getDate()+1)}return n}
const leaveEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const leaveDate=value=>value?String(value).slice(0,10):'';
const leaveNumber=value=>Number(value||0).toLocaleString('tr-TR',{maximumFractionDigits:2});
let leaveSection='balances',annualYear=new Date().getFullYear(),annualDepartment='',annualLoadToken=0;

function leaveProgress(item){
  const route=Array.isArray(item.approval_route)?item.approval_route:[];
  const history=Array.isArray(item.approval_history)?item.approval_history:[];
  if(!route.length)return leaveEsc(item.current_approver||'Onay bekliyor');
  return route.map((step,index)=>{
    const done=history.find(entry=>Number(entry.step)===index+1);
    if(done)return `✓ ${leaveEsc(step)}: ${leaveEsc(done.user_name||done.role||'Onaylandı')}`;
    if(item.status==='Bekliyor'&&Number(item.approval_step||0)===index)return `● ${leaveEsc(step)} bekleniyor`;
    return `○ ${leaveEsc(step)}`;
  }).join(' → ');
}

async function leaveApi(path,options){const response=await fetch(path,options);if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'İşlem tamamlanamadı')}return response.status===204?null:response.json()}

async function loadLeaves(){
  const rows=await leaveApi('/api/leaves');
  state.leaves=Array.isArray(rows)?rows.map(item=>({...item,employee:item.employee_name,type:item.leave_type,start:leaveDate(item.start_date),end:leaveDate(item.end_date)})):[];
  if(state.view==='leave'&&leaveSection==='requests')leave();
}

function leaveTabs(){
  return `<div class="leave-tabs"><button class="btn ${leaveSection==='balances'?'':'secondary'}" data-leave-section="balances">Yıllık İzinler</button><button class="btn ${leaveSection==='requests'?'':'secondary'}" data-leave-section="requests">İzin Talepleri</button></div>`;
}
function bindLeaveTabs(){
  document.querySelectorAll('[data-leave-section]').forEach(button=>button.onclick=()=>{leaveSection=button.dataset.leaveSection;leave()});
}

function leave(){
  $('#page-title').textContent='İzin Yönetimi';
  if(leaveSection==='requests')renderLeaveRequests();else renderAnnualLeave();
}

async function renderAnnualLeave(){
  const token=++annualLoadToken;
  $('#app').innerHTML=`<div class="section-title"><div><h2>Yıllık izin yönetimi</h2><span class="muted">Hakedişler ve puantajdan gün gün kullanılan izinler</span></div>${leaveTabs()}</div><div class="card empty">Yıllık izin bilgileri yükleniyor…</div>`;
  bindLeaveTabs();
  try{
    const query=new URLSearchParams({year:String(annualYear)});if(annualDepartment)query.set('department',annualDepartment);
    const data=await leaveApi('/api/annual-leave-balances?'+query.toString());
    if(token!==annualLoadToken||state.view!=='leave'||leaveSection!=='balances')return;
    window.__ikAnnualLeaveBalances=data.rows;
    renderAnnualDashboard(data);
  }catch(error){if(token===annualLoadToken){$('#app').innerHTML=`<div class="section-title"><div><h2>Yıllık izin yönetimi</h2></div>${leaveTabs()}</div><div class="card empty">${leaveEsc(error.message)}</div>`;bindLeaveTabs()}}
}

function renderAnnualDashboard(data){
  const rows=data.rows||[],totals=data.totals||{entitled:0,used:0,remaining:0};
  const positiveUsed=Math.max(0,Number(totals.used)||0),positiveRemaining=Math.max(0,Number(totals.remaining)||0),chartTotal=positiveUsed+positiveRemaining;
  const usedPercent=chartTotal?Math.min(100,positiveUsed/chartTotal*100):0;
  const maxRemaining=Math.max(1,...rows.map(row=>Math.max(0,Number(row.remaining_days)||0)));
  const bars=rows.map(row=>`<div class="leave-person-bar"><div><span>${leaveEsc(row.employee_name)}</span><strong>${leaveNumber(row.remaining_days)} gün</strong></div><small>${leaveEsc(row.department)}</small><div class="bar"><i style="width:${Math.max(0,Number(row.remaining_days)||0)/maxRemaining*100}%"></i></div></div>`).join('');
  const tableRows=rows.map(row=>`<tr><td><strong>${leaveEsc(row.employee_name)}</strong></td><td>${leaveEsc(row.department)}</td><td>${leaveNumber(row.entitled_days)}</td><td>${leaveNumber(row.current_year_days)}</td><td>${leaveNumber(row.used_days)}</td><td><strong>${leaveNumber(row.remaining_days)}</strong></td><td class="row-actions"><button class="btn ghost" data-annual-usage="${row.employee_id}">Kullanım detayı</button>${data.can_edit?`<button class="btn ghost" data-annual-edit="${row.employee_id}">Düzenle</button>`:''}</td></tr>`).join('');
  const years=[annualYear-2,annualYear-1,annualYear,annualYear+1].filter((year,index,array)=>array.indexOf(year)===index).sort();
  $('#app').innerHTML=`<div class="section-title"><div><h2>${annualYear} yıllık izinleri</h2><span class="muted">Kullanım yalnızca puantajda Y (Yıllık İzin) girilen ve tarihi gelmiş günlerden hesaplanır</span></div>${leaveTabs()}</div>
    <div class="card"><div class="toolbar" style="margin:0"><label class="muted" for="annual-year">Yıl</label><select class="select" id="annual-year">${years.map(year=>`<option value="${year}" ${year===annualYear?'selected':''}>${year}</option>`).join('')}</select><label class="muted" for="annual-department">Departman</label><select class="select" id="annual-department"><option value="">Tüm departmanlar</option>${(data.departments||[]).map(department=>`<option value="${leaveEsc(department)}" ${department===annualDepartment?'selected':''}>${leaveEsc(department)}</option>`).join('')}</select></div></div>
    <div class="dashboard-charts">
      <article class="card dashboard-chart"><div class="card-head"><div><h2>Departman izin özeti</h2><span class="muted">${leaveEsc(annualDepartment||'Tüm departmanlar')} · ${rows.length} çalışan</span></div></div><div class="chart-body"><div class="large-donut" style="background:${chartTotal?`conic-gradient(#e55261 0 ${usedPercent}%,#18a874 ${usedPercent}% 100%)`:'conic-gradient(#e9edf4 0 100%)'}"><div><strong>${leaveNumber(positiveRemaining)}</strong><span>kalan gün</span></div></div><ul class="chart-legend"><li><span class="legend-color" style="background:#4967f4"></span><span>Toplam hak</span><strong>${leaveNumber(totals.entitled)}</strong></li><li><span class="legend-color" style="background:#e55261"></span><span>Kullanılan</span><strong>${leaveNumber(totals.used)}</strong></li><li><span class="legend-color" style="background:#18a874"></span><span>Kalan</span><strong>${leaveNumber(totals.remaining)}</strong></li></ul></div></article>
      <article class="card"><div class="card-head"><div><h2>Kalan izne göre çalışanlar</h2><span class="muted">En çok izni kalandan aşağı doğru</span></div></div><div class="leave-bars">${bars||'<div class="empty">Gösterilecek çalışan yok</div>'}</div></article>
    </div>
    <div class="card" style="margin-top:18px"><div class="card-head"><div><h2>Çalışan yıllık izinleri</h2><span class="muted">Toplam hak edilen − kullanılan (çizelge + puantajdaki Y günleri)</span></div></div><div class="annual-leave-table"><table><thead><tr><th>ÇALIŞAN</th><th>DEPARTMAN</th><th>TOPLAM HAK EDİLEN</th><th>BU YIL HAK EDİLEN</th><th>KULLANILAN</th><th>KALAN</th><th></th></tr></thead><tbody>${tableRows||'<tr><td colspan="7" class="empty">Gösterilecek çalışan yok</td></tr>'}</tbody></table></div></div>`;
  bindLeaveTabs();
  $('#annual-year').onchange=event=>{annualYear=Number(event.target.value);renderAnnualLeave()};
  $('#annual-department').onchange=event=>{annualDepartment=event.target.value;renderAnnualLeave()};
  document.querySelectorAll('[data-annual-edit]').forEach(button=>button.onclick=()=>editAnnualLeave(rows.find(row=>String(row.employee_id)===button.dataset.annualEdit)));
  document.querySelectorAll('[data-annual-usage]').forEach(button=>button.onclick=()=>showLeaveUsage(button.dataset.annualUsage,rows.find(row=>String(row.employee_id)===button.dataset.annualUsage)));
}

async function showLeaveUsage(employeeId,row){
  const title=row?`${leaveEsc(row.employee_name)} · izin kullanım detayı`:'İzin kullanım detayı';
  modal(title,'<div class="empty" id="usage-slot">Kayıtlar yükleniyor…</div>',()=>closeModal());
  const submit=document.querySelector('.modal .submit');if(submit){submit.textContent='Kapat';submit.onclick=closeModal;}
  try{
    const data=await leaveApi(`/api/annual-leave-balances/${employeeId}/usage`);
    const recs=data.records||[];
    const body=recs.map(r=>`<tr><td>${leaveDate(r.start_date)||'—'}</td><td>${leaveDate(r.end_date)||'—'}</td><td style="text-align:right">${leaveNumber(r.week_rest_days)}</td><td style="text-align:right">${leaveNumber(r.official_holiday_days)}</td><td style="text-align:right"><strong>${leaveNumber(r.used_days)}</strong></td></tr>`).join('');
    const html=`<div class="formula" style="margin-bottom:12px">Yıllık İzin Takip Çizelgesi · İzin Kayıt · ${recs.length} kayıt · toplam <strong>${leaveNumber(data.total_used)}</strong> gün</div><div style="max-height:52vh;overflow:auto"><table><thead><tr><th>BAŞLAMA</th><th>BİTİŞ</th><th style="text-align:right">HAFTA T.</th><th style="text-align:right">RESMİ T.</th><th style="text-align:right">KULLANILAN</th></tr></thead><tbody>${body||'<tr><td colspan="5" class="empty">Bu çalışan için çizelgede izin kaydı bulunmuyor</td></tr>'}</tbody></table></div>`;
    const slot=document.querySelector('#usage-slot');if(slot)slot.outerHTML=html;
  }catch(error){
    const slot=document.querySelector('#usage-slot');if(slot)slot.textContent=error.message;
  }
}

function editAnnualLeave(row){
  if(!row)return;
  const attendanceUsed=leaveNumber(row.attendance_used_days||0);
  modal(`${leaveEsc(row.employee_name)} · ${row.year} yıllık izin`, `<div class="form-grid"><div class="field"><label>Hak edilen gün (kümülatif)</label><input class="input" id="annual-entitled" type="number" min="0" max="3650" step="0.5" value="${row.entitled_days}"></div><div class="field"><label>Kullanılan gün (çizelge)</label><input class="input" id="annual-used" type="number" min="0" max="3650" step="0.5" value="${row.manual_used_days||0}"></div><div class="field"><label>Manuel düzeltme (+ / −)</label><input class="input" id="annual-adjustment" type="number" min="-365" max="365" step="0.5" value="${row.manual_adjustment}"></div><div class="field" style="grid-column:1/-1"><label>Düzeltme açıklaması</label><input class="input" id="annual-note" maxlength="500" value="${leaveEsc(row.adjustment_note||'')}"></div></div><div class="formula" style="margin-top:14px">Toplam kullanılan = çizelge (${leaveNumber(row.manual_used_days||0)}) + ${row.year} puantajındaki Y günleri (${attendanceUsed}). Puantaj Y günleri burada değiştirilemez, otomatik eklenir.</div>`,async()=>{
    const entitled=Number($('#annual-entitled').value),adjustment=Number($('#annual-adjustment').value),manualUsed=Number($('#annual-used').value);
    if(!Number.isFinite(entitled)||entitled<0||!Number.isFinite(adjustment)||!Number.isFinite(manualUsed)||manualUsed<0)return toast('İzin değerlerini kontrol edin');
    try{await leaveApi(`/api/annual-leave-balances/${row.employee_id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({year:row.year,entitled_days:entitled,manual_used_days:manualUsed,manual_adjustment:adjustment,adjustment_note:$('#annual-note').value.trim()})});closeModal();renderAnnualLeave();toast('Yıllık izin bakiyesi güncellendi')}catch(error){toast(error.message)}
  });
}

function renderLeaveRequests(){
  const status=$('#leave-filter')?.value||'';
  const list=state.leaves.filter(item=>!status||item.status===status);
  const rows=list.map(item=>`<tr><td>${leaveEsc(item.employee_name||item.employee)}</td><td>${leaveEsc(item.leave_type||item.type)}</td><td>${leaveDate(item.start_date||item.start)} – ${leaveDate(item.end_date||item.end)}</td><td>${item.days} gün</td><td><span class="badge ${item.status==='Onaylandı'?'green':item.status==='Reddedildi'?'red':'orange'}">${leaveEsc(item.status)}</span><small class="muted" style="display:block;max-width:420px">${leaveProgress(item)}</small>${item.rejection_reason?`<small class="danger-text">${leaveEsc(item.rejection_reason)}</small>`:''}</td><td>${item.can_approve?`<button class="btn ghost" data-leave-decision="approve" data-id="${item.id}">Onayla</button><button class="btn ghost danger-text" data-leave-decision="reject" data-id="${item.id}">Reddet</button>`:''}${item.can_delete?`<button class="btn ghost danger-text" data-leave-delete="${item.id}">Sil</button>`:''}</td></tr>`).join('');
  const queue=list.filter(item=>item.can_approve).length;
  $('#app').innerHTML=`<div class="section-title"><div><h2>İzin talepleri</h2><span class="muted">Sıralı onay süreci ve talep sonuçları</span></div>${leaveTabs()}</div>${queue?`<div class="formula"><strong>${queue} izin talebi onayınızı bekliyor.</strong></div>`:''}<div class="card" style="margin-top:18px"><div class="card-head"><h2>İzin talepleri</h2><div class="toolbar" style="margin:0"><select class="select" id="leave-filter"><option value="">Tümü</option><option>Bekliyor</option><option>Onaylandı</option><option>Reddedildi</option></select><button class="btn" id="add-leave">+ İzin talebi</button></div></div><div style="overflow:auto"><table><thead><tr><th>ÇALIŞAN</th><th>İZİN TÜRÜ</th><th>TARİH</th><th>SÜRE</th><th>DURUM / ONAY AKIŞI</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Gösterilecek izin talebi yok</td></tr>'}</tbody></table></div></div>`;
  bindLeaveTabs();
  $('#add-leave').onclick=leaveModal;
  $('#leave-filter').value=status;
  $('#leave-filter').onchange=renderLeaveRequests;
  document.querySelectorAll('[data-leave-decision]').forEach(button=>button.onclick=()=>decideLeave(button.dataset.id,button.dataset.leaveDecision));
  document.querySelectorAll('[data-leave-delete]').forEach(button=>button.onclick=()=>deleteLeave(button.dataset.leaveDelete));
}

function leaveModal(){
  const user=window.__ikCurrentUser?.()||{},linked=window.__ikCurrentEmployee?.()||null,isAdmin=user.role==='Sistem yöneticisi';
  if(!isAdmin&&!linked)return toast('İzin talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin');
  const employeeField=isAdmin?`<select class="select" id="l-employee">${state.employees.filter(e=>e.status==='Aktif').sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr')).map(e=>`<option value="${e.id}">${leaveEsc(e.name)} · ${leaveEsc(e.department)}</option>`).join('')}</select>`:`<input class="input" value="${leaveEsc(linked.name)} · ${leaveEsc(linked.department)}" disabled><input id="l-employee" type="hidden" value="${linked.id}">`;
  modal('İzin talebi',`<div class="form-grid"><div class="field"><label>Çalışan *</label>${employeeField}</div><div class="field"><label>İzin türü</label><select class="select" id="l-type"><option>Yıllık izin</option><option>Ücretsiz izin</option><option>Hastalık izni</option><option>Mazeret izni</option></select></div><div class="field"><label>Başlangıç *</label><input class="input" id="l-start" type="date"></div><div class="field"><label>Bitiş *</label><input class="input" id="l-end" type="date"></div></div><div id="leave-preview" class="formula" style="margin-top:14px">Tarihleri seçtiğinizde çalışma günü hesaplanır.</div>`,async()=>{
    const start=$('#l-start').value,end=$('#l-end').value,employee=state.employees.find(item=>String(item.id)===String($('#l-employee').value)),type=$('#l-type').value;
    if(!employee||!start||!end||end<start)return toast('Çalışan ve tarihleri kontrol edin');
    const days=businessDays(start,end);if(!days)return toast('Seçilen aralıkta çalışma günü yok');
    try{const created=await leaveApi('/api/leaves',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employee_id:employee.id,leave_type:type,start_date:start,end_date:end,days})});state.leaves.unshift({...created,employee:created.employee_name,type:created.leave_type,start:leaveDate(created.start_date),end:leaveDate(created.end_date)});closeModal();renderLeaveRequests();toast(`İzin talebi ${created.current_approver} onayına gönderildi`)}catch(error){toast(error.message)}
  });
  const preview=()=>{const start=$('#l-start').value,end=$('#l-end').value;if(start&&end&&end>=start)$('#leave-preview').innerHTML=`Hesaplanan izin süresi: <strong>${businessDays(start,end)} çalışma günü</strong>`};
  $('#l-start').onchange=preview;$('#l-end').onchange=preview;$('#l-type').onchange=preview;
}

async function decideLeave(id,decision){
  const item=state.leaves.find(row=>String(row.id)===String(id));if(!item)return;
  let reason='';if(decision==='reject'){reason=prompt('Ret nedenini yazın:')||'';if(!reason)return toast('Ret nedeni zorunludur')}
  try{Object.assign(item,await leaveApi(`/api/leaves/${id}/decision`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}));renderLeaveRequests();toast(decision==='approve'?(item.status==='Onaylandı'?'İzin tamamen onaylandı':`Talep ${item.current_approver} onayına gönderildi`):'İzin reddedildi')}catch(error){toast(error.message)}
}

async function deleteLeave(id){if(!confirm('İzin talebini silmek istediğinize emin misiniz?'))return;try{await leaveApi(`/api/leaves/${id}`,{method:'DELETE'});state.leaves=state.leaves.filter(item=>String(item.id)!==String(id));renderLeaveRequests();toast('İzin talebi silindi')}catch(error){toast(error.message)}}

loadLeaves().catch(error=>console.error('İzin talepleri yüklenemedi',error));
shell();
