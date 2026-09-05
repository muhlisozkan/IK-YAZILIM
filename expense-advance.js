(function () {
  const categories=['Ulaşım','Konaklama','Yemek','Temsil ve ağırlama','Ofis','Eğitim','Diğer'];
  state.expenses=[];state.advances=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>v?new Date(`${String(v).slice(0,10)}T00:00:00`).toLocaleDateString('tr-TR'):'-';
  const color=s=>['Onaylandı','Ödendi','Mahsup Edildi'].includes(s)?'green':s==='Reddedildi'?'red':'orange';
  const can=action=>typeof window.__ikCan!=='function'||window.__ikCan(state.view,action);
  const currentUser=()=>window.__ikCurrentUser?.()||{};
  const currentEmployee=()=>window.__ikCurrentEmployee?.()||null;
  const employeeOptions=(selected='')=>state.employees.filter(e=>e.status==='Aktif').map(e=>`<option value="${e.id}" ${String(e.id)===String(selected)?'selected':''}>${esc(e.name)} · ${esc(e.department)}</option>`).join('');
  async function api(path,options){const response=await fetch(path,options);if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Sunucu işlemi tamamlanamadı')}return response.status===204?null:response.json()}

  function stats(items,dateField){
    const pending=items.filter(x=>['Bekliyor','Onay Sürecinde'].includes(x.status));
    const done=items.filter(x=>['Onaylandı','Ödendi','Mahsup Edildi'].includes(x.status));
    const month=new Date().toISOString().slice(0,7);
    const monthTotal=items.filter(x=>String(x[dateField]||'').startsWith(month)).reduce((sum,x)=>sum+Number(x.amount||0),0);
    return `<div class="grid stats finance-stats"><div class="card stat"><span class="label">Görünen kayıt</span><div class="value">${items.length}</div></div><div class="card stat"><span class="label">Onay sürecinde</span><div class="value">${pending.length}</div><span class="trend warn">${fmt(pending.reduce((sum,x)=>sum+Number(x.amount||0),0))}</span></div><div class="card stat"><span class="label">Onaylanan / tamamlanan</span><div class="value">${done.length}</div></div><div class="card stat"><span class="label">Bu ay</span><div class="value">${fmt(monthTotal)}</div></div></div>`;
  }

  function approvalProgress(item){
    const route=Array.isArray(item.approval_route)?item.approval_route:[];
    const history=Array.isArray(item.approval_history)?item.approval_history:[];
    if(item.status==='Reddedildi')return `Reddeden: ${esc(item.rejected_by||'-')}${item.rejection_reason?` · ${esc(item.rejection_reason)}`:''}`;
    if(!route.length)return esc(item.current_approver||item.status);
    return route.map((step,index)=>{
      const done=history.find(entry=>Number(entry.step)===index+1);
      if(done)return `✓ ${esc(step)}: ${esc(done.user_name||done.role||'Onaylandı')}`;
      if(['Bekliyor','Onay Sürecinde'].includes(item.status)&&Number(item.approval_step||0)===index)return `● ${esc(step)} bekleniyor`;
      return `○ ${esc(step)}`;
    }).join(' → ');
  }

  function expenseActions(item){
    let html='';
    if(item.can_approve)html+=`<button class="btn ghost" data-expense-decision="approve" data-id="${item.id}">Onayla</button><button class="btn ghost danger-text" data-expense-decision="reject" data-id="${item.id}">Reddet</button>`;
    if(item.can_mark_paid)html+=`<button class="btn ghost" data-expense-paid="${item.id}">Ödendi</button>`;
    if(item.can_delete)html+=`<button class="btn ghost danger-text" data-expense-delete="${item.id}">Sil</button>`;
    return html;
  }

  function isOwn(item){const user=currentUser(),employee=currentEmployee();return String(item.employee_id)===String(employee?.id)||String(item.requester_user_id)===String(user.id)||user.role==='Sistem yöneticisi'}
  function advanceActions(item){
    let html='';
    if(item.can_approve)html+=`<button class="btn ghost" data-advance-decision="approve" data-id="${item.id}">Onayla</button><button class="btn ghost danger-text" data-advance-decision="reject" data-id="${item.id}">Reddet</button>`;
    if(item.status==='Onaylandı'&&isOwn(item))html+=`<button class="btn secondary" data-advance-print="${item.id}">Onaylı form</button>`;
    if(item.can_delete)html+=`<button class="btn ghost danger-text" data-advance-delete="${item.id}">Sil</button>`;
    return html;
  }

  function filter(type){const query=$(`#${type}-search`),status=$(`#${type}-status`),table=$(`#${type}-table`);const run=()=>table.querySelectorAll('tbody tr').forEach(row=>row.style.display=(!query.value||row.textContent.toLocaleLowerCase('tr-TR').includes(query.value.toLocaleLowerCase('tr-TR')))&&(!status.value||row.textContent.includes(status.value))?'':'none');query.oninput=run;status.onchange=run}

  function renderExpenses(){
    document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view==='expenses'));$('#page-title').textContent='Masraf Yönetimi';
    const rows=state.expenses.map(item=>`<tr><td><strong>${esc(item.employee_name)}</strong><small class="muted" style="display:block">${esc(item.department||'-')} · ${esc(item.category)}</small></td><td>${date(item.expense_date)}</td><td>${esc(item.receipt_no||'-')}</td><td><strong>${fmt(item.amount)}</strong><small class="muted" style="display:block">${esc(item.description||'')}</small></td><td><span class="badge ${color(item.status)}">${esc(item.status)}</span><small class="muted" style="display:block;max-width:480px">${approvalProgress(item)}</small></td><td class="row-actions">${expenseActions(item)}</td></tr>`).join('');
    const queue=state.expenses.filter(item=>item.can_approve).length;
    $('#app').innerHTML=`<div class="section-title"><div><h2>Masraf talepleri</h2><span class="muted">Sıralı onay ve ödeme takibi</span></div>${can('create')?'<button class="btn" id="add-expense">+ Masraf talebi</button>':''}</div>${stats(state.expenses,'expense_date')}${queue?`<div class="formula"><strong>${queue} masraf talebi onayınızı bekliyor.</strong></div>`:''}<div class="card finance-list"><div class="toolbar"><input class="input" id="expense-search" placeholder="Çalışan, kategori veya açıklama ara…"><select class="select" id="expense-status"><option value="">Tüm durumlar</option><option>Bekliyor</option><option>Onaylandı</option><option>Reddedildi</option><option>Ödendi</option></select></div><div style="overflow:auto"><table id="expense-table"><thead><tr><th>ÇALIŞAN / KATEGORİ</th><th>TARİH</th><th>BELGE NO</th><th>TUTAR / AÇIKLAMA</th><th>DURUM / ONAY AKIŞI</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Gösterilecek masraf talebi yok</td></tr>'}</tbody></table></div></div>`;
    if($('#add-expense'))$('#add-expense').onclick=expenseModal;filter('expense');
    document.querySelectorAll('[data-expense-decision]').forEach(button=>button.onclick=()=>decideExpense(button.dataset.id,button.dataset.expenseDecision));
    document.querySelectorAll('[data-expense-paid]').forEach(button=>button.onclick=()=>markExpensePaid(button.dataset.expensePaid));
    document.querySelectorAll('[data-expense-delete]').forEach(button=>button.onclick=()=>remove('expenses',button.dataset.expenseDelete));
  }

  function renderAdvances(){
    document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view==='advances'));$('#page-title').textContent='Avans Yönetimi';
    const rows=state.advances.map(item=>`<tr><td><strong>${esc(item.employee_name)}</strong><small class="muted" style="display:block">${esc(item.department||'-')} · ${esc(item.reason||'-')}</small></td><td>${date(item.requested_date)}</td><td><strong>${fmt(item.amount)}</strong></td><td>${date(item.deduction_month)}<small class="muted" style="display:block">Mahsup ayı</small></td><td><span class="badge ${color(item.status)}">${esc(item.status)}</span><small class="muted" style="display:block;max-width:480px">${approvalProgress(item)}</small></td><td class="row-actions">${advanceActions(item)}</td></tr>`).join('');
    const queue=state.advances.filter(item=>item.can_approve).length;
    $('#app').innerHTML=`<div class="section-title"><div><h2>Avans talepleri</h2><span class="muted">Departman yöneticisi → İnsan Kaynakları → Mali İşler sıralı onay akışı</span></div>${can('create')?'<button class="btn" id="add-advance">+ Avans talebi</button>':''}</div>${stats(state.advances,'requested_date')}${queue?`<div class="formula"><strong>${queue} avans talebi onayınızı bekliyor.</strong></div>`:''}<div class="card finance-list"><div class="toolbar"><input class="input" id="advance-search" placeholder="Çalışan, departman veya açıklama ara…"><select class="select" id="advance-status"><option value="">Tüm durumlar</option><option>Onay Sürecinde</option><option>Onaylandı</option><option>Reddedildi</option></select></div><div style="overflow:auto"><table id="advance-table"><thead><tr><th>ÇALIŞAN / DEPARTMAN</th><th>TALEP TARİHİ</th><th>TUTAR</th><th>MAHSUP</th><th>DURUM / ONAY AKIŞI</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Gösterilecek avans talebi yok</td></tr>'}</tbody></table></div></div>`;
    if($('#add-advance'))$('#add-advance').onclick=advanceModal;filter('advance');
    document.querySelectorAll('[data-advance-decision]').forEach(button=>button.onclick=()=>decideAdvance(button.dataset.id,button.dataset.advanceDecision));
    document.querySelectorAll('[data-advance-print]').forEach(button=>button.onclick=()=>window.open(`/api/advances/${button.dataset.advancePrint}/form`,'_blank','noopener'));
    document.querySelectorAll('[data-advance-delete]').forEach(button=>button.onclick=()=>remove('advances',button.dataset.advanceDelete));
  }

  function requestEmployeeField(prefix){
    const user=currentUser(),linked=currentEmployee(),isAdmin=user.role==='Sistem yöneticisi';
    if(!isAdmin&&!linked)return null;
    return isAdmin?`<select class="select" id="${prefix}-employee">${employeeOptions(linked?.id)}</select>`:`<input class="input" value="${esc(linked.name)} · ${esc(linked.department)}" disabled><input id="${prefix}-employee" type="hidden" value="${linked.id}">`;
  }

  function expenseModal(){
    const employeeField=requestEmployeeField('x');if(!employeeField)return toast('Masraf talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin');
    modal('Yeni masraf talebi',`<div class="form-grid"><div class="field"><label>Çalışan *</label>${employeeField}</div><div class="field"><label>Kategori *</label><select class="select" id="x-category">${categories.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Masraf tarihi *</label><input class="input" id="x-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Tutar (TRY) *</label><input class="input" id="x-amount" type="number" min="0.01" step="0.01"></div><div class="field"><label>Fiş / fatura no</label><input class="input" id="x-receipt"></div><div class="field"><label>Açıklama</label><input class="input" id="x-description"></div></div>`,async()=>{
      const employee=state.employees.find(x=>String(x.id)===String($('#x-employee').value)),value=Number($('#x-amount').value);if(!employee||!$('#x-date').value||value<=0)return toast('Çalışan, tarih ve pozitif tutar zorunludur');
      try{const created=await api('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employee_id:employee.id,category:$('#x-category').value,expense_date:$('#x-date').value,amount:value,currency:'TRY',receipt_no:$('#x-receipt').value,description:$('#x-description').value})});state.expenses.unshift(created);closeModal();renderExpenses();toast(`Masraf talebi ${created.current_approver} onayına gönderildi`)}catch(error){toast(error.message)}
    });
  }

  function advanceModal(){
    const employeeField=requestEmployeeField('a');if(!employeeField)return toast('Avans talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin');
    modal('Yeni avans talebi',`<div class="form-grid"><div class="field"><label>Personel *</label>${employeeField}</div><div class="field"><label>Talep tarihi *</label><input class="input" id="a-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Tutar (TRY) *</label><input class="input" id="a-amount" type="number" min="0.01" step="0.01"></div><div class="field"><label>Bordro mahsup ayı</label><input class="input" id="a-month" type="month"></div><div class="field" style="grid-column:1/-1"><label>Talep nedeni</label><textarea class="input" id="a-reason" rows="3"></textarea></div></div>`,async()=>{
      const employee=state.employees.find(x=>String(x.id)===String($('#a-employee').value)),value=Number($('#a-amount').value),month=$('#a-month').value;if(!employee||!$('#a-date').value||value<=0)return toast('Çalışan, tarih ve pozitif tutar zorunludur');
      try{const created=await api('/api/advances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employee_id:employee.id,requested_date:$('#a-date').value,amount:value,currency:'TRY',deduction_month:month?`${month}-01`:null,reason:$('#a-reason').value})});state.advances.unshift(created);closeModal();renderAdvances();toast(`Avans talebi ${created.current_approver} onayına gönderildi`)}catch(error){toast(error.message)}
    });
  }

  async function decideExpense(id,decision){const item=state.expenses.find(row=>String(row.id)===String(id));if(!item)return;let reason='';if(decision==='reject'){reason=prompt('Ret nedenini yazın:')||'';if(!reason)return toast('Ret nedeni zorunludur')}try{Object.assign(item,await api(`/api/expenses/${id}/decision`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}));renderExpenses();toast(decision==='approve'?(item.status==='Onaylandı'?'Masraf tamamen onaylandı':`Talep ${item.current_approver} onayına gönderildi`):'Masraf reddedildi')}catch(error){toast(error.message)}}
  async function markExpensePaid(id){const item=state.expenses.find(row=>String(row.id)===String(id));if(!item)return;try{Object.assign(item,await api(`/api/expenses/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'Ödendi'})}));renderExpenses();toast('Masraf ödendi olarak işaretlendi')}catch(error){toast(error.message)}}
  async function decideAdvance(id,decision){const item=state.advances.find(row=>String(row.id)===String(id));if(!item)return;let reason='';if(decision==='reject'){reason=prompt('Ret nedenini yazın:')||'';if(!reason)return toast('Ret nedeni zorunludur')}try{Object.assign(item,await api(`/api/advances/${id}/decision`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason})}));renderAdvances();toast(decision==='approve'?(item.status==='Onaylandı'?'Avans tamamen onaylandı':`Talep ${item.current_approver} onayına gönderildi`):'Avans reddedildi')}catch(error){toast(error.message)}}
  async function remove(type,id){if(!confirm('Talebi silmek istediğinize emin misiniz?'))return;try{await api(`/api/${type}/${id}`,{method:'DELETE'});state[type]=state[type].filter(item=>String(item.id)!==String(id));type==='expenses'?renderExpenses():renderAdvances();toast('Talep silindi')}catch(error){toast(error.message)}}

  const baseShell=shell;shell=function(){if(state.view==='expenses')renderExpenses();else if(state.view==='advances')renderAdvances();else baseShell()};
  Promise.all([api('/api/expenses').then(rows=>state.expenses=rows).catch(()=>{}),api('/api/advances').then(rows=>state.advances=rows).catch(()=>{})]).then(()=>{if(['expenses','advances'].includes(state.view))shell()});
})();
