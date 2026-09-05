const nationalHolidays = ['2026-01-01','2026-04-23','2026-05-01','2026-05-19','2026-07-15','2026-08-30','2026-10-29'];
function businessDays(start,end){let n=0,d=new Date(start),last=new Date(end);while(d<=last){const day=d.getDay(),iso=d.toISOString().slice(0,10);if(day!==0&&day!==6&&!nationalHolidays.includes(iso))n++;d.setDate(d.getDate()+1)}return n}
function leaveBalance(e){const total=annualEntitlement(e),used=usedLeave(e.name);return {total,used,left:Math.max(0,total-used)}}
const leaveEsc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const leaveDate=value=>value?String(value).slice(0,10):'';

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
  if(state.view==='leave')leave();
}

function leave(){
  const status=$('#leave-filter')?.value||'';
  const list=state.leaves.filter(item=>!status||item.status===status);
  const rows=list.map(item=>`<tr><td>${leaveEsc(item.employee_name||item.employee)}</td><td>${leaveEsc(item.leave_type||item.type)}</td><td>${leaveDate(item.start_date||item.start)} – ${leaveDate(item.end_date||item.end)}</td><td>${item.days} gün</td><td><span class="badge ${item.status==='Onaylandı'?'green':item.status==='Reddedildi'?'red':'orange'}">${leaveEsc(item.status)}</span><small class="muted" style="display:block;max-width:420px">${leaveProgress(item)}</small>${item.rejection_reason?`<small class="danger-text">${leaveEsc(item.rejection_reason)}</small>`:''}</td><td>${item.can_approve?`<button class="btn ghost" data-leave-decision="approve" data-id="${item.id}">Onayla</button><button class="btn ghost danger-text" data-leave-decision="reject" data-id="${item.id}">Reddet</button>`:''}${item.can_delete?`<button class="btn ghost danger-text" data-leave-delete="${item.id}">Sil</button>`:''}</td></tr>`).join('');
  const balances=state.employees.slice(0,6).map(e=>{const b=leaveBalance(e);return `<div style="margin:14px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span>${leaveEsc(e.name)}</span><span class="muted">${b.left}/${b.total} gün</span></div><div class="bar"><i style="width:${b.total?b.left/b.total*100:0}%;background:${b.left<5?'var(--orange)':'var(--green)'}"></i></div></div>`}).join('');
  const queue=list.filter(item=>item.can_approve).length;
  $('#app').innerHTML=`<div class="section-title"><div><h2>İzin yönetimi</h2><span class="muted">Sıralı onay ve yıllık izin takibi</span></div><button class="btn" id="add-leave">+ İzin talebi</button></div>${queue?`<div class="formula"><strong>${queue} izin talebi onayınızı bekliyor.</strong></div>`:''}<div class="grid two"><div class="card"><div class="card-head"><h2>İzin talepleri</h2><select class="select" id="leave-filter"><option value="">Tümü</option><option>Bekliyor</option><option>Onaylandı</option><option>Reddedildi</option></select></div><div style="overflow:auto"><table><thead><tr><th>ÇALIŞAN</th><th>İZİN TÜRÜ</th><th>TARİH</th><th>SÜRE</th><th>DURUM / ONAY AKIŞI</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Gösterilecek izin talebi yok</td></tr>'}</tbody></table></div></div><div class="card"><div class="card-head"><h2>Yıllık izin bakiyeleri</h2></div>${balances||'<div class="empty">Çalışan bulunmuyor</div>'}<div class="formula" style="margin-top:20px"><strong>Çalışma günü hesabı</strong><br>İzin süresi = Hafta içi günleri − resmî tatiller</div></div></div>`;
  $('#add-leave').onclick=leaveModal;
  $('#leave-filter').value=status;
  $('#leave-filter').onchange=leave;
  document.querySelectorAll('[data-leave-decision]').forEach(button=>button.onclick=()=>decideLeave(button.dataset.id,button.dataset.leaveDecision));
  document.querySelectorAll('[data-leave-delete]').forEach(button=>button.onclick=()=>deleteLeave(button.dataset.id));
}

function leaveModal(){
  const user=window.__ikCurrentUser?.()||{},linked=window.__ikCurrentEmployee?.()||null,isAdmin=user.role==='Sistem yöneticisi';
  if(!isAdmin&&!linked)return toast('İzin talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin');
  const employeeField=isAdmin?`<select class="select" id="l-employee">${state.employees.filter(e=>e.status==='Aktif').map(e=>`<option value="${e.id}">${leaveEsc(e.name)} · ${leaveEsc(e.department)}</option>`).join('')}</select>`:`<input class="input" value="${leaveEsc(linked.name)} · ${leaveEsc(linked.department)}" disabled><input id="l-employee" type="hidden" value="${linked.id}">`;
  modal('İzin talebi',`<div class="form-grid"><div class="field"><label>Çalışan *</label>${employeeField}</div><div class="field"><label>İzin türü</label><select class="select" id="l-type"><option>Yıllık izin</option><option>Ücretsiz izin</option><option>Hastalık izni</option><option>Mazeret izni</option></select></div><div class="field"><label>Başlangıç *</label><input class="input" id="l-start" type="date"></div><div class="field"><label>Bitiş *</label><input class="input" id="l-end" type="date"></div></div><div id="leave-preview" class="formula" style="margin-top:14px">Tarihleri seçtiğinizde çalışma günü hesaplanır.</div>`,async()=>{
    const start=$('#l-start').value,end=$('#l-end').value,employee=state.employees.find(item=>String(item.id)===String($('#l-employee').value)),type=$('#l-type').value;
    if(type==='Yıllık izin'&&isLeaveSeniorityExempt(employee))return toast('Sezonluk personel yıllık izinden muaftır');
    if(!employee||!start||!end||end<start)return toast('Çalışan ve tarihleri kontrol edin');
    const days=businessDays(start,end);if(!days)return toast('Seçilen aralıkta çalışma günü yok');
    try{const created=await leaveApi('/api/leaves',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employee_id:employee.id,leave_type:type,start_date:start,end_date:end,days})});state.leaves.unshift({...created,employee:created.employee_name,type:created.leave_type,start:leaveDate(created.start_date),end:leaveDate(created.end_date)});closeModal();leave();toast(`İzin talebi ${created.current_approver} onayına gönderildi`)}catch(error){toast(error.message)}
  });
  const preview=()=>{const start=$('#l-start').value,end=$('#l-end').value,employee=state.employees.find(item=>String(item.id)===String($('#l-employee').value));if($('#l-type').value==='Yıllık izin'&&isLeaveSeniorityExempt(employee))return $('#leave-preview').innerHTML='<strong>Sezonluk personel:</strong> yıllık izin ve kıdem hesabından muaf.';if(start&&end&&end>=start)$('#leave-preview').innerHTML=`Hesaplanan izin süresi: <strong>${businessDays(start,end)} çalışma günü</strong>`};
  $('#l-start').onchange=preview;$('#l-end').onchange=preview;$('#l-employee').onchange=preview;$('#l-type').onchange=preview;
}

async function decideLeave(id,decision){
  const item=state.leaves.find(row=>String(row.id)===String(id));if(!item)return;
  let reason='';if(decision==='reject'){reason=prompt('Ret nedenini yazın:')||'';if(!reason)return toast('Ret nedeni zorunludur')}
  try{Object.assign(item,await leaveApi(`/api/leaves/${id}/decision`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}));leave();toast(decision==='approve'?(item.status==='Onaylandı'?'İzin tamamen onaylandı':`Talep ${item.current_approver} onayına gönderildi`):'İzin reddedildi')}catch(error){toast(error.message)}
}

async function deleteLeave(id){if(!confirm('İzin talebini silmek istediğinize emin misiniz?'))return;try{await leaveApi(`/api/leaves/${id}`,{method:'DELETE'});state.leaves=state.leaves.filter(item=>String(item.id)!==String(id));leave();toast('İzin talebi silindi')}catch(error){toast(error.message)}}

loadLeaves().catch(error=>console.error('İzin talepleri yüklenemedi',error));
shell();
