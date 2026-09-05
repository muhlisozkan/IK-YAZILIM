(function () {
  const expenseKey='ik_expenses',advanceKey='ik_advances';
  const categories=['Ulaşım','Konaklama','Yemek','Temsil ve ağırlama','Ofis','Eğitim','Diğer'];
  state.expenses=[];
  state.advances=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date=v=>v?new Date(`${String(v).slice(0,10)}T00:00:00`).toLocaleDateString('tr-TR'):'-';
  const color=s=>['Onaylandı','Ödendi','Mahsup Edildi'].includes(s)?'green':s==='Reddedildi'?'red':'orange';
  const saveFinance=()=>{};
  const can=action=>typeof window.__ikCan!=='function'||window.__ikCan(state.view,action);
  const currentUser=()=>window.__ikCurrentUser?.()||{id:1,name:'Sistem yöneticisi',role:'Sistem yöneticisi'};
  const currentEmployee=()=>window.__ikCurrentEmployee?.()||null;
  const employeeOptions=(selected='')=>state.employees.filter(e=>e.status==='Aktif').map(e=>`<option value="${e.id}" ${String(e.id)===String(selected)?'selected':''}>${esc(e.name)} · ${esc(e.department)}</option>`).join('');
  async function api(path,options){const r=await fetch(path,options);if(!r.ok){const p=await r.json().catch(()=>({}));throw Error(p.error||'Sunucu işlemi tamamlanamadı')}return r.status===204?null:r.json()}

  function stats(items,dateField){
    const pending=items.filter(x=>['Bekliyor','Onay Sürecinde'].includes(x.status));
    const done=items.filter(x=>['Onaylandı','Ödendi','Mahsup Edildi'].includes(x.status));
    const month=new Date().toISOString().slice(0,7);
    const monthTotal=items.filter(x=>String(x[dateField]||'').startsWith(month)).reduce((s,x)=>s+Number(x.amount||0),0);
    return `<div class="grid stats finance-stats"><div class="card stat"><span class="label">Toplam kayıt</span><div class="value">${items.length}</div></div><div class="card stat"><span class="label">Onay sürecinde</span><div class="value">${pending.length}</div><span class="trend warn">${fmt(pending.reduce((s,x)=>s+Number(x.amount||0),0))}</span></div><div class="card stat"><span class="label">Onaylanan / tamamlanan</span><div class="value">${done.length}</div></div><div class="card stat"><span class="label">Bu ay</span><div class="value">${fmt(monthTotal)}</div></div></div>`;
  }

  function expenseActions(x){
    if(x.status==='Bekliyor')return `${can('approve')?`<button class="btn ghost" data-expense-status="Onaylandı" data-id="${x.id}">Onayla</button><button class="btn ghost danger-text" data-expense-status="Reddedildi" data-id="${x.id}">Reddet</button>`:''}${can('create')?`<button class="btn ghost" data-expense-delete="${x.id}">Sil</button>`:''}`;
    if(x.status==='Onaylandı'&&can('approve'))return `<button class="btn ghost" data-expense-status="Ödendi" data-id="${x.id}">Ödendi</button>`;
    return '';
  }

  function visibleAdvances(){
    const user=currentUser(),employee=currentEmployee(),role=user.role;
    if(['Sistem yöneticisi','İK yöneticisi'].includes(role))return state.advances;
    if(role==='Departman yöneticisi')return state.advances.filter(x=>x.department===user.department||String(x.employee_id)===String(employee?.id));
    if(['Mali İşler','Bordro yetkilisi'].includes(role))return state.advances.filter(x=>x.approval_stage==='finance'||x.finance_approved_by||x.status==='Onaylandı');
    return state.advances.filter(x=>String(x.employee_id)===String(employee?.id)||String(x.requester_user_id)===String(user.id));
  }

  function canApproveAdvance(x){
    const user=currentUser();
    if(x.status!=='Onay Sürecinde')return false;
    if(user.role==='Sistem yöneticisi')return true;
    if(x.approval_stage==='department')return user.role==='Departman yöneticisi'&&user.department===x.department;
    if(x.approval_stage==='hr')return user.role==='İK yöneticisi';
    if(x.approval_stage==='finance')return ['Mali İşler','Bordro yetkilisi'].includes(user.role);
    return false;
  }

  function isOwnAdvance(x){
    const user=currentUser(),employee=currentEmployee();
    return String(x.employee_id)===String(employee?.id)||String(x.requester_user_id)===String(user.id)||user.role==='Sistem yöneticisi';
  }

  function stageText(x){
    if(x.status==='Onaylandı')return 'Tüm onaylar tamamlandı';
    if(x.status==='Reddedildi')return `Reddeden: ${x.rejected_by||'-'}${x.rejection_reason?` · ${x.rejection_reason}`:''}`;
    return `${x.current_approver||'Onay'} onayı bekleniyor`;
  }

  function advanceActions(x){
    let html='';
    if(canApproveAdvance(x))html+=`<button class="btn ghost" data-advance-decision="approve" data-id="${x.id}">Onayla</button><button class="btn ghost danger-text" data-advance-decision="reject" data-id="${x.id}">Reddet</button>`;
    if(x.status==='Onaylandı'&&isOwnAdvance(x))html+=`<button class="btn secondary" data-advance-print="${x.id}">Onaylı form</button>`;
    if(x.status==='Onay Sürecinde'&&x.approval_stage==='department'&&isOwnAdvance(x))html+=`<button class="btn ghost danger-text" data-advance-delete="${x.id}">Sil</button>`;
    return html;
  }

  function filter(type){
    const q=$(`#${type}-search`),s=$(`#${type}-status`),t=$(`#${type}-table`);
    const run=()=>t.querySelectorAll('tbody tr').forEach(r=>r.style.display=(!q.value||r.textContent.toLocaleLowerCase('tr-TR').includes(q.value.toLocaleLowerCase('tr-TR')))&&(!s.value||r.textContent.includes(s.value))?'':'none');
    q.oninput=run;s.onchange=run;
  }

  function renderExpenses(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='expenses'));$('#page-title').textContent='Masraf Yönetimi';
    const rows=state.expenses.map(x=>`<tr><td><strong>${esc(x.employee_name)}</strong><small class="muted" style="display:block">${esc(x.category)}</small></td><td>${date(x.expense_date)}</td><td>${esc(x.receipt_no||'-')}</td><td><strong>${fmt(x.amount)}</strong><small class="muted" style="display:block">${esc(x.description||'')}</small></td><td><span class="badge ${color(x.status)}">${esc(x.status)}</span><small class="muted" style="display:block">${esc(x.current_approver||'')}</small></td><td class="row-actions">${expenseActions(x)}</td></tr>`).join('');
    $('#app').innerHTML=`<div class="section-title"><div><h2>Masraf talepleri</h2><span class="muted">Fiş ve fatura bazında kayıt, onay ve ödeme takibi</span></div>${can('create')?'<button class="btn" id="add-expense">+ Masraf talebi</button>':''}</div>${stats(state.expenses,'expense_date')}<div class="card finance-list"><div class="toolbar"><input class="input" id="expense-search" placeholder="Çalışan, kategori veya açıklama ara…"><select class="select" id="expense-status"><option value="">Tüm durumlar</option><option>Bekliyor</option><option>Onaylandı</option><option>Reddedildi</option><option>Ödendi</option></select></div><div style="overflow:auto"><table id="expense-table"><thead><tr><th>ÇALIŞAN / KATEGORİ</th><th>TARİH</th><th>BELGE NO</th><th>TUTAR / AÇIKLAMA</th><th>DURUM</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Henüz masraf talebi yok</td></tr>'}</tbody></table></div></div>`;
    if($('#add-expense'))$('#add-expense').onclick=expenseModal;filter('expense');document.querySelectorAll('[data-expense-status]').forEach(b=>b.onclick=()=>updateExpense(b.dataset.id,b.dataset.expenseStatus));document.querySelectorAll('[data-expense-delete]').forEach(b=>b.onclick=()=>remove('expenses',b.dataset.expenseDelete));
  }

  function renderAdvances(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='advances'));$('#page-title').textContent='Avans Yönetimi';
    const list=visibleAdvances();
    const rows=list.map(x=>`<tr><td><strong>${esc(x.employee_name)}</strong><small class="muted" style="display:block">${esc(x.department||'-')} · ${esc(x.reason||'-')}</small></td><td>${date(x.requested_date)}</td><td><strong>${fmt(x.amount)}</strong></td><td>${date(x.deduction_month)}<small class="muted" style="display:block">Mahsup ayı</small></td><td><span class="badge ${color(x.status)}">${esc(x.status)}</span><small class="muted" style="display:block">${esc(stageText(x))}</small></td><td class="row-actions">${advanceActions(x)}</td></tr>`).join('');
    const queue=list.filter(canApproveAdvance).length;
    $('#app').innerHTML=`<div class="section-title"><div><h2>Avans talepleri</h2><span class="muted">Departman Müdürü → İnsan Kaynakları → Mali İşler onay akışı</span></div>${can('create')?'<button class="btn" id="add-advance">+ Avans talebi</button>':''}</div>${stats(list,'requested_date')}${queue?`<div class="formula advance-queue"><strong>${queue} avans talebi onayınızı bekliyor.</strong></div>`:''}<div class="card finance-list"><div class="toolbar"><input class="input" id="advance-search" placeholder="Çalışan, departman veya açıklama ara…"><select class="select" id="advance-status"><option value="">Tüm durumlar</option><option>Onay Sürecinde</option><option>Onaylandı</option><option>Reddedildi</option></select></div><div style="overflow:auto"><table id="advance-table"><thead><tr><th>ÇALIŞAN / DEPARTMAN</th><th>TALEP TARİHİ</th><th>TUTAR</th><th>MAHSUP</th><th>DURUM / AŞAMA</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Gösterilecek avans talebi yok</td></tr>'}</tbody></table></div></div>`;
    if($('#add-advance'))$('#add-advance').onclick=advanceModal;filter('advance');
    document.querySelectorAll('[data-advance-decision]').forEach(b=>b.onclick=()=>decideAdvance(b.dataset.id,b.dataset.advanceDecision));
    document.querySelectorAll('[data-advance-print]').forEach(b=>b.onclick=()=>window.open(`/api/advances/${b.dataset.advancePrint}/form`,'_blank','noopener'));
    document.querySelectorAll('[data-advance-delete]').forEach(b=>b.onclick=()=>remove('advances',b.dataset.advanceDelete));
  }

  function expenseModal(){
    if(!state.employees.length)return toast('Masraf talebi için önce çalışan ekleyin');
    modal('Yeni masraf talebi',`<div class="form-grid"><div class="field"><label>Çalışan *</label><select class="select" id="x-employee">${employeeOptions()}</select></div><div class="field"><label>Kategori *</label><select class="select" id="x-category">${categories.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label>Masraf tarihi *</label><input class="input" id="x-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Tutar (TRY) *</label><input class="input" id="x-amount" type="number" min="0.01" step="0.01"></div><div class="field"><label>Fiş / fatura no</label><input class="input" id="x-receipt"></div><div class="field"><label>Açıklama</label><input class="input" id="x-description"></div></div>`,async()=>{const e=state.employees.find(x=>x.id===$('#x-employee').value),value=Number($('#x-amount').value);if(!e||!$('#x-date').value||value<=0)return toast('Çalışan, tarih ve pozitif tutar zorunludur');const p={employee_id:e.id,employee_name:e.name,category:$('#x-category').value,expense_date:$('#x-date').value,amount:value,currency:'TRY',receipt_no:$('#x-receipt').value,description:$('#x-description').value,current_approver:'Finans yöneticisi'};try{state.expenses.unshift(await api('/api/expenses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)}));toast('Masraf talebi veritabanına kaydedildi')}catch(error){return toast(error.message||'Sunucuya ulaşılamadı; masraf kaydedilmedi')}saveFinance();closeModal();renderExpenses()});
  }

  function advanceModal(){
    const user=currentUser(),linked=currentEmployee(),isAdmin=user.role==='Sistem yöneticisi';
    if(!isAdmin&&!linked)return toast('Avans talebi için kullanıcı hesabınızı personel kaydıyla eşleştirin');
    const employeeField=isAdmin?`<select class="select" id="a-employee">${employeeOptions(linked?.id)}</select>`:`<input class="input" value="${esc(linked.name)} · ${esc(linked.department)}" disabled><input id="a-employee" type="hidden" value="${linked.id}">`;
    modal('Yeni avans talebi',`<div class="form-grid"><div class="field"><label>Personel *</label>${employeeField}</div><div class="field"><label>Talep tarihi *</label><input class="input" id="a-date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Tutar (TRY) *</label><input class="input" id="a-amount" type="number" min="0.01" step="0.01"></div><div class="field"><label>Bordro mahsup ayı</label><input class="input" id="a-month" type="month"></div><div class="field" style="grid-column:1/-1"><label>Talep nedeni</label><textarea class="input" id="a-reason" rows="3"></textarea></div></div><div class="formula" style="margin-top:14px">Talebiniz sırasıyla Departman Müdürü, İnsan Kaynakları ve Mali İşler onayına gönderilecektir.</div>`,async()=>{const employee=state.employees.find(x=>String(x.id)===String($('#a-employee').value)),value=Number($('#a-amount').value),month=$('#a-month').value;if(!employee||!$('#a-date').value||value<=0)return toast('Çalışan, tarih ve pozitif tutar zorunludur');const payload={employee_id:employee.id,requested_date:$('#a-date').value,amount:value,currency:'TRY',deduction_month:month?`${month}-01`:null,reason:$('#a-reason').value,requester_user_id:user.id,requester_user_name:user.name};try{const created=await api('/api/advances',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});state.advances.unshift(created);saveFinance();closeModal();renderAdvances();toast('Avans talebi departman müdürü onayına gönderildi')}catch(error){toast(error.message)}});
  }

  async function updateExpense(id,status){
    const item=state.expenses.find(x=>String(x.id)===String(id));if(!item)return;const current_approver=status==='Onaylandı'?'Bordro yetkilisi':null;
    try{Object.assign(item,await api(`/api/expenses/${id}/status`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,current_approver})}))}catch(error){return toast(error.message)}
    saveFinance();renderExpenses();toast(`Durum ${status.toLocaleLowerCase('tr-TR')} olarak güncellendi`);
  }

  async function decideAdvance(id,decision){
    const item=state.advances.find(x=>String(x.id)===String(id));if(!item)return;
    const user=currentUser();let reason='';
    if(decision==='reject'){reason=prompt('Ret nedenini yazın:')||'';if(!reason)return toast('Ret nedeni zorunludur')}
    try{Object.assign(item,await api(`/api/advances/${id}/decision`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,reason,actor_name:user.name,actor_role:user.role,actor_department:user.department||''})}))}catch(error){return toast(error.message)}
    saveFinance();renderAdvances();toast(decision==='approve'?(item.status==='Onaylandı'?'Avans tamamen onaylandı':`Talep ${item.current_approver} onayına gönderildi`):'Avans talebi reddedildi');
  }

  async function remove(type,id){
    if(!confirm('Talebi silmek istediğinize emin misiniz?'))return;
    try{await api(`/api/${type}/${id}`,{method:'DELETE'})}catch(error){return toast(error.message)}
    state[type]=state[type].filter(x=>String(x.id)!==String(id));saveFinance();type==='expenses'?renderExpenses():renderAdvances();toast('Talep silindi');
  }

  const baseShell=shell;shell=function(){if(state.view==='expenses')renderExpenses();else if(state.view==='advances')renderAdvances();else baseShell()};
  Promise.all([api('/api/expenses').then(x=>state.expenses=x).catch(()=>{}),api('/api/advances').then(x=>state.advances=x).catch(()=>{})]).then(()=>{saveFinance();if(['expenses','advances'].includes(state.view))shell()});
})();
