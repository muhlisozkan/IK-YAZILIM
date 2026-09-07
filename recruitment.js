(function(){
  const statuses=['Yeni başvuru','Ön görüşme','Mülakat','Teklif gönderildi','İşe alındı','Olumsuz'];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dfmt=v=>v?new Date(String(v).slice(0,10)+'T00:00:00').toLocaleDateString('tr-TR'):'—';
  let candidates=[];
  const user=()=>window.__ikCurrentUser?.()||{};
  const isManager=()=>{const u=user();return ['Sistem yöneticisi','İK yöneticisi'].includes(u.role)||u.department==='İnsan Kaynakları';};
  const api=async(path,opts)=>{const r=await fetch(path,opts);const d=r.status===204?null:await r.json().catch(()=>({}));if(!r.ok)throw new Error(d?.error||'İşlem tamamlanamadı');return d;};
  const departments=()=>[...new Set((state.employees||[]).map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));

  async function load(){
    try{candidates=await api('/api/candidates');}
    catch(e){candidates=[];if(state.view==='recruitment')toast(e.message);}
    if(state.view==='recruitment')render();
  }

  function render(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='recruitment'));
    $('#page-title').textContent='İşe Alım ve Aday Takip';
    const mgr=isManager();
    const rows=candidates.map(c=>{
      const badge=c.status==='Olumsuz'?'red':c.status==='İşe alındı'?'green':'orange';
      const approval=mgr?`<td>${c.hr_approved?`<span class="badge green">Departmana açıldı</span><small class="muted" style="display:block">${esc(c.hr_approved_by||'')}</small>`:'<span class="badge orange">İK\'da bekliyor</span>'}</td>`:'';
      const actions=mgr
        ?`<button class="btn ghost" data-cand-edit="${c.id}">Düzenle</button><button class="btn ghost" data-cand-approve="${c.id}">${c.hr_approved?'Geri al':'Departmana aç'}</button><button class="btn ghost danger-text" data-cand-del="${c.id}">Sil</button>`
        :`<button class="btn ghost" data-cand-status="${c.id}">Durum / not</button>`;
      return `<tr><td><strong>${esc(c.name)}</strong><small class="muted" style="display:block">${esc(c.email||'')} ${esc(c.phone||'')}</small></td><td>${esc(c.position||'—')}<small class="muted" style="display:block">${esc(c.department||'Departman atanmadı')}</small></td><td><span class="badge ${badge}">${esc(c.status)}</span>${c.notes?`<small class="muted" style="display:block;max-width:360px">${esc(c.notes)}</small>`:''}</td><td>${dfmt(c.interview_date)}${c.cv_name?`<small class="muted" style="display:block">CV: ${esc(c.cv_name)}</small>`:''}</td>${approval}<td class="row-actions">${actions}</td></tr>`;
    }).join('');
    const head=`<tr><th>ADAY</th><th>POZİSYON / DEPARTMAN</th><th>DURUM</th><th>GÖRÜŞME / CV</th>${mgr?'<th>İK ONAYI</th>':''}<th></th></tr>`;
    const intro=mgr?'Aday ekleyin, departman atayın ve departmana açın.':'Departmanınız için İK tarafından onaylanmış adaylar. Durum ve notu güncelleyebilirsiniz.';
    $('#app').innerHTML=`<div class="section-title"><div><h2>İşe alım ve aday takip</h2><span class="muted">${intro}</span></div>${mgr?'<button class="btn" id="add-candidate">+ Aday ekle</button>':''}</div><div class="card"><div class="card-head"><h2>Adaylar</h2><span class="muted">${candidates.length} kayıt</span></div><div style="overflow:auto"><table><thead>${head}</thead><tbody>${rows||`<tr><td colspan="${mgr?6:5}" class="empty">Henüz aday kaydı yok</td></tr>`}</tbody></table></div></div>`;
    if(mgr&&$('#add-candidate'))$('#add-candidate').onclick=()=>editModal();
    document.querySelectorAll('[data-cand-edit]').forEach(b=>b.onclick=()=>editModal(candidates.find(c=>String(c.id)===b.dataset.candEdit)));
    document.querySelectorAll('[data-cand-approve]').forEach(b=>b.onclick=()=>toggleApprove(candidates.find(c=>String(c.id)===b.dataset.candApprove)));
    document.querySelectorAll('[data-cand-del]').forEach(b=>b.onclick=()=>removeCandidate(b.dataset.candDel));
    document.querySelectorAll('[data-cand-status]').forEach(b=>b.onclick=()=>statusModal(candidates.find(c=>String(c.id)===b.dataset.candStatus)));
  }

  function editModal(existing){
    const deps=departments();
    modal(existing?'Adayı düzenle':'Yeni aday',`<div class="form-grid">
      <div class="field"><label>Ad soyad *</label><input class="input" id="c-name" value="${esc(existing?.name||'')}"></div>
      <div class="field"><label>E-posta</label><input class="input" id="c-email" type="email" value="${esc(existing?.email||'')}"></div>
      <div class="field"><label>Telefon</label><input class="input" id="c-phone" value="${esc(existing?.phone||'')}"></div>
      <div class="field"><label>Pozisyon</label><input class="input" id="c-position" value="${esc(existing?.position||'')}"></div>
      <div class="field"><label>Departman</label><select class="select" id="c-department"><option value="">Seçin</option>${deps.map(d=>`<option ${d===existing?.department?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
      <div class="field"><label>Durum</label><select class="select" id="c-status">${statuses.map(s=>`<option ${s===existing?.status?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field"><label>Görüşme tarihi</label><input class="input" id="c-date" type="date" value="${existing?.interview_date?String(existing.interview_date).slice(0,10):''}"></div>
      <div class="field"><label>CV dosya adı</label><input class="input" id="c-cv" value="${esc(existing?.cv_name||'')}"></div>
      <div class="field" style="grid-column:1/-1"><label>Not</label><textarea class="input" id="c-notes" rows="2">${esc(existing?.notes||'')}</textarea></div>
    </div>`,async()=>{
      const name=$('#c-name').value.trim();if(!name)return toast('Aday adı zorunludur');
      const payload={name,email:$('#c-email').value.trim(),phone:$('#c-phone').value.trim(),position:$('#c-position').value.trim(),department:$('#c-department').value,status:$('#c-status').value,interview_date:$('#c-date').value||null,cv_name:$('#c-cv').value.trim(),notes:$('#c-notes').value.trim()};
      try{
        const saved=await api(existing?`/api/candidates/${existing.id}`:'/api/candidates',{method:existing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(existing)Object.assign(existing,saved);else candidates.unshift(saved);
        closeModal();render();toast(existing?'Aday güncellendi':'Aday eklendi');
      }catch(e){toast(e.message);}
    });
  }

  function statusModal(c){
    if(!c)return;
    modal(`${esc(c.name)} · durum güncelle`,`<div class="form-grid">
      <div class="field"><label>Durum</label><select class="select" id="c-status">${statuses.map(s=>`<option ${s===c.status?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="field" style="grid-column:1/-1"><label>Not</label><textarea class="input" id="c-notes" rows="3">${esc(c.notes||'')}</textarea></div>
    </div>`,async()=>{
      try{Object.assign(c,await api(`/api/candidates/${c.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:$('#c-status').value,notes:$('#c-notes').value.trim()})}));closeModal();render();toast('Aday güncellendi');}
      catch(e){toast(e.message);}
    });
  }

  async function toggleApprove(c){
    if(!c)return;
    if(!c.hr_approved&&!c.department)return toast('Önce adaya bir departman atayın (Düzenle)');
    try{Object.assign(c,await api(`/api/candidates/${c.id}/approve`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({approved:!c.hr_approved})}));render();toast(c.hr_approved?'Aday departmana açıldı':'Aday departmandan geri alındı');}
    catch(e){toast(e.message);}
  }

  async function removeCandidate(id){
    if(!confirm('Aday kaydını silmek istediğinize emin misiniz?'))return;
    try{await api(`/api/candidates/${id}`,{method:'DELETE'});candidates=candidates.filter(c=>String(c.id)!==String(id));render();toast('Aday silindi');}
    catch(e){toast(e.message);}
  }

  const baseShell=shell;shell=function(){if(state.view==='recruitment')render();else baseShell();};
  load();
})();
