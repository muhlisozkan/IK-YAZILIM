// Çalışan modülünün ikinci seviye özellikleri.
function isLeaveSeniorityExempt(employee) { return Boolean(employee && typeof employee === 'object' && employee.leave_seniority_exempt); }
function completedServiceYears(start) {
  const d = new Date(start), now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) years--;
  return Math.max(0, years);
}
function yearsOfService(employeeOrStart) {
  if (isLeaveSeniorityExempt(employeeOrStart)) return 0;
  const start = employeeOrStart && typeof employeeOrStart === 'object' ? (employeeOrStart.seniority_start_date || employeeOrStart.start) : employeeOrStart;
  return completedServiceYears(start);
}
function leaveYearsOfService(employeeOrStart) {
  if (isLeaveSeniorityExempt(employeeOrStart)) return 0;
  const start = employeeOrStart && typeof employeeOrStart === 'object'
    ? (employeeOrStart.leave_entitlement_start_date || employeeOrStart.seniority_start_date || employeeOrStart.start)
    : employeeOrStart;
  return completedServiceYears(start);
}
function annualEntitlement(employeeOrStart) {
  if (isLeaveSeniorityExempt(employeeOrStart)) return 0;
  const y = leaveYearsOfService(employeeOrStart);
  return y < 1 ? 0 : y < 5 ? 14 : y < 15 ? 20 : 26;
}
function usedLeave(name) { return state.leaves.filter(l => l.employee === name && l.status === 'Onaylandı' && l.type === 'Yıllık izin').reduce((s,l) => s + Number(l.days || 0), 0); }
function employeeDetails(e) {
  const exempt = isLeaveSeniorityExempt(e), entitlement = annualEntitlement(e), used = usedLeave(e.name);
  const seniority = exempt ? 'Muaf' : `${yearsOfService(e)} yıl`;
  const seniorityStart = e.seniority_start_date ? new Date(e.seniority_start_date).toLocaleDateString('tr-TR') : new Date(e.start).toLocaleDateString('tr-TR');
  const leaveEntitlementStart = e.leave_entitlement_start_date ? new Date(e.leave_entitlement_start_date).toLocaleDateString('tr-TR') : seniorityStart;
  const exemptionNote = exempt ? `<div class="formula" style="margin:14px 0"><strong>Sezonluk personel</strong><br>Önceki çıkış ile yeniden giriş arasında ${e.employment_gap_days ?? 10} gün bulunduğu için yıllık izin ve kıdem hesabından muaftır.</div>` : '';
  modal('Çalışan detayı', `<div class="person" style="margin-bottom:18px"><span class="person-avatar">${initials(e.name)}</span><div><strong style="font-size:17px">${e.name}</strong><small class="muted" style="display:block">${e.title || 'Pozisyon belirtilmemiş'}</small></div></div>${exemptionNote}<div class="form-grid"><div class="formula"><strong>İletişim</strong><br>${e.email || 'E-posta belirtilmemiş'}<br>${e.phone || 'Telefon belirtilmemiş'}</div><div class="formula"><strong>İş bilgileri</strong><br>${e.department}<br>Son işe giriş: ${new Date(e.start).toLocaleDateString('tr-TR')}<br>Kıdem başlangıcı: ${seniorityStart}<br>İzin hakediş başlangıcı: ${leaveEntitlementStart}<br>Kıdem: ${seniority}</div></div><div class="result"><span>Yıllık izin bakiyesi</span><strong>${Math.max(0, entitlement-used)} gün</strong><small>${exempt ? 'Sezonluk personel · izin ve kıdemden muaf' : `${entitlement} gün hak − ${used} gün onaylı kullanım`}</small></div>`, () => closeModal());
  const submit = document.querySelector('.modal .submit'); if (submit) { submit.textContent = 'Kapat'; submit.onclick = closeModal; }
}
function editEmployee(id) {
  const e = state.employees.find(x => x.id == id); if (!e) return;
  modal('Çalışanı düzenle', `<div class="form-grid"><div class="field"><label>Ad soyad *</label><input class="input" id="ef-name" value="${e.name}"></div><div class="field"><label>E-posta</label><input class="input" id="ef-email" type="email" value="${e.email || ''}"></div><div class="field"><label>Telefon</label><input class="input" id="ef-phone" value="${e.phone || ''}"></div><div class="field"><label>Departman *</label><input class="input" id="ef-dept" value="${e.department}"></div><div class="field"><label>Pozisyon</label><input class="input" id="ef-title" value="${e.title || ''}"></div><div class="field"><label>İşe giriş tarihi *</label><input class="input" id="ef-start" type="date" value="${e.start}"></div><div class="field"><label>Aylık brüt ücret</label><input class="input" id="ef-salary" type="number" value="${e.salary}"></div><div class="field"><label>Durum</label><select class="select" id="ef-status"><option ${e.status==='Aktif'?'selected':''}>Aktif</option><option ${e.status==='İzinli'?'selected':''}>İzinli</option><option ${e.status==='Pasif'?'selected':''}>Pasif</option></select></div></div>`, () => {
    const name = $('#ef-name').value.trim(), dept = $('#ef-dept').value.trim();
    if (!name || !dept) return toast('Ad ve departman zorunludur');
    Object.assign(e, {name, email:$('#ef-email').value, phone:$('#ef-phone').value, department:dept, title:$('#ef-title').value, start:$('#ef-start').value, salary:Number($('#ef-salary').value)||0, status:$('#ef-status').value});
    fetch('/api/employees/'+e.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)}).catch(()=>{}); save(); closeModal(); employees(); toast('Çalışan güncellendi');
  });
}
function employees() {
  const rows = state.employees.map(e => `<tr><td><div class="person"><span class="person-avatar">${initials(e.name)}</span><span><strong>${e.name}</strong><small class="muted" style="display:block">${e.email || 'E-posta yok'}</small></span></div></td><td>${e.department}<small class="muted" style="display:block">${e.title || '-'}</small></td><td>${new Date(e.start).toLocaleDateString('tr-TR')}<small class="muted" style="display:block">${isLeaveSeniorityExempt(e) ? 'Sezonluk · izin/kıdem muaf' : `${yearsOfService(e)} yıl kıdem`}</small></td><td>${fmt(e.salary)}</td><td><span class="badge ${e.status==='Aktif'?'green':e.status==='Pasif'?'red':'orange'}">${e.status}</span></td><td><button class="btn ghost" data-detail="${e.id}">Detay</button><button class="btn ghost" data-edit="${e.id}">Düzenle</button><button class="btn ghost" data-delete="${e.id}">Sil</button></td></tr>`).join('');
  $('#app').innerHTML=`<div class="section-title"><div><h2>Çalışan kayıtları</h2><span class="muted">Özlük bilgileri, kıdem ve yıllık izin bakiyesi</span></div><button class="btn" id="add-employee">+ Çalışan ekle</button></div><div class="card"><div class="toolbar"><input class="input" id="emp-search" placeholder="İsim veya departman ara…"><select class="select" id="dept-filter"><option value="">Tüm departmanlar</option>${[...new Set(state.employees.map(e=>e.department))].map(d=>`<option>${d}</option>`).join('')}</select></div><div style="overflow:auto"><table id="emp-table"><thead><tr><th>ÇALIŞAN</th><th>GÖREV</th><th>İŞE GİRİŞ</th><th>BRÜT ÜCRET</th><th>DURUM</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Çalışan bulunmuyor</td></tr>'}</tbody></table></div></div>`;
  $('#add-employee').onclick=employeeModal; $('#emp-search').oninput=filterEmployees; $('#dept-filter').onchange=filterEmployees;
  document.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>employeeDetails(state.employees.find(e=>e.id==b.dataset.detail)));
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editEmployee(b.dataset.edit));
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{if(confirm('Bu çalışanı silmek istediğinize emin misiniz?')){state.employees=state.employees.filter(e=>e.id!=b.dataset.delete);save();employees();toast('Çalışan silindi')}});
}
shell();
// Çalışan kayıtları yalnızca merkezi PostgreSQL veritabanına kaydedilir.
function employeeModal(){modal('Yeni çalışan',`<div class="form-grid"><div class="field"><label>Ad soyad *</label><input class="input" id="f-name"></div><div class="field"><label>E-posta</label><input class="input" id="f-email" type="email"></div><div class="field"><label>Departman *</label><input class="input" id="f-dept"></div><div class="field"><label>Pozisyon</label><input class="input" id="f-title"></div><div class="field"><label>İşe giriş tarihi *</label><input class="input" id="f-start" type="date"></div><div class="field"><label>Aylık brüt ücret</label><input class="input" id="f-salary" type="number"></div></div>`,async()=>{const name=$('#f-name').value.trim(),department=$('#f-dept').value.trim();if(!name||!department)return toast('Ad ve departman zorunludur');const payload={name,email:$('#f-email').value,department,title:$('#f-title').value,start:$('#f-start').value||new Date().toISOString().slice(0,10),salary:Number($('#f-salary').value)||0,status:'Aktif'};try{const r=await fetch('/api/employees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!r.ok)throw Error();const e=await r.json();state.employees.push({...e,start:e.start_date?.slice(0,10)||e.start});save();closeModal();employees();toast('Çalışan veritabanına eklendi')}catch(_){toast('Sunucuya ulaşılamadı; çalışan kaydedilmedi')}})}
document.addEventListener('click',e=>{const b=e.target.closest('[data-delete]');if(b)fetch('/api/employees/'+b.dataset.delete,{method:'DELETE'}).catch(()=>{})});
