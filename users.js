(function(){
  let users=[],loaded=false,loading=false;
  const roles=['Sistem yöneticisi','İK yöneticisi','Departman yöneticisi','Mali İşler','Finans yöneticisi','Bordro yetkilisi','Genel müdür','Genel müdür yardımcısı','Bölge yöneticisi','Personel','Sadece görüntüleme'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const departments=()=>[...new Set((state.employees||[]).map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
  const api=async(path,options)=>{
    const response=await fetch(path,options);
    const data=response.status===204?null:await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error||'İşlem tamamlanamadı');
    return data;
  };

  async function loadUsers(force=false){
    if(loading||loaded&&!force)return;
    loading=true;
    try{
      users=await api('/api/users');
      loaded=true;
      if(state.view==='users')renderUsers();
    }catch(error){if(state.view==='users')toast(error.message)}
    finally{loading=false}
  }

  function renderUsers(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='users'));
    $('#page-title').textContent='Kullanıcı ve Yetki Yönetimi';
    const rows=users.map(u=>`<tr><td><strong>${esc(u.name)}</strong><small class="muted" style="display:block">@${esc(u.username)}${u.email?' · '+esc(u.email):''}</small></td><td>${esc(u.role)}</td><td>${esc(u.department||'-')}<small class="muted" style="display:block">${esc((state.employees||[]).find(e=>String(e.id)===String(u.employee_id))?.name||'Personel bağlantısı yok')}</small></td><td><span class="badge ${u.status==='Aktif'?'green':'red'}">${esc(u.status)}</span></td><td><button class="btn ghost" data-user-edit="${u.id}">Düzenle</button><button class="btn ghost danger-text" data-user-delete="${u.id}">Sil</button></td></tr>`).join('');
    const body=loaded?(rows||'<tr><td colspan="5" class="empty">Kullanıcı bulunmuyor</td></tr>'):'<tr><td colspan="5" class="empty">Kullanıcılar yükleniyor…</td></tr>';
    $('#app').innerHTML=`<div class="section-title"><div><h2>Kullanıcı ve yetki yönetimi</h2><span class="muted">Gerçek giriş hesaplarını, rollerini ve personel bağlantılarını yönetin</span></div><button class="btn" id="add-user">+ Kullanıcı ekle</button></div><div class="card"><div class="card-head"><h2>Kullanıcılar</h2><span class="muted">${loaded?users.length:0} hesap</span></div><div style="overflow:auto"><table><thead><tr><th>KULLANICI / GİRİŞ ADI</th><th>ROL</th><th>DEPARTMAN / PERSONEL</th><th>DURUM</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
    window.__ikRenderApprovalMatrix?.();
    $('#add-user').onclick=()=>userModal();
    document.querySelectorAll('[data-user-edit]').forEach(b=>b.onclick=()=>userModal(users.find(u=>String(u.id)===b.dataset.userEdit)));
    document.querySelectorAll('[data-user-delete]').forEach(b=>b.onclick=()=>deleteUser(b.dataset.userDelete));
  }

  async function deleteUser(id){
    if(!confirm('Bu kullanıcı hesabını silmek istediğinize emin misiniz?'))return;
    try{
      await api('/api/users/'+encodeURIComponent(id),{method:'DELETE'});
      users=users.filter(u=>String(u.id)!==String(id));
      renderUsers();
      toast('Kullanıcı hesabı silindi');
    }catch(error){toast(error.message)}
  }

  function userModal(existing){
    const employeeOptions=['<option value="">Bağlantı yok</option>',...(state.employees||[]).map(e=>`<option value="${e.id}" ${String(existing?.employee_id||'')===String(e.id)?'selected':''}>${esc(e.name)} · ${esc(e.department)}</option>`)].join('');
    modal(existing?'Kullanıcıyı düzenle':'Yeni kullanıcı',`<div class="form-grid">
      <div class="field"><label>Giriş kullanıcı adı *</label><input class="input" id="u-username" autocomplete="off" value="${esc(existing?.username||'')}"></div>
      <div class="field"><label>${existing?'Yeni şifre':'Şifre *'}</label><input class="input" id="u-password" type="password" autocomplete="new-password" placeholder="${existing?'Değişmeyecekse boş bırakın':'En az 8 karakter'}"></div>
      <div class="field"><label>Ad soyad *</label><input class="input" id="u-name" value="${esc(existing?.name||'')}"></div>
      <div class="field"><label>E-posta</label><input class="input" id="u-email" type="email" value="${esc(existing?.email||'')}"></div>
      <div class="field"><label>Rol</label><select class="select" id="u-role">${roles.map(r=>`<option ${r===existing?.role?'selected':''}>${r}</option>`).join('')}</select></div>
      <div class="field"><label>Durum</label><select class="select" id="u-status"><option ${existing?.status!=='Pasif'?'selected':''}>Aktif</option><option ${existing?.status==='Pasif'?'selected':''}>Pasif</option></select></div>
      <div class="field"><label>Departman</label><select class="select" id="u-department"><option value="">Departman seçin</option>${departments().map(d=>`<option ${d===existing?.department?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
      <div class="field"><label>Bağlı personel</label><select class="select" id="u-employee">${employeeOptions}</select></div>
    </div>`,async()=>{
      const username=$('#u-username').value.trim(),password=$('#u-password').value,name=$('#u-name').value.trim(),employeeId=$('#u-employee').value;
      if(username.length<3||!name||(!existing&&password.length<8)||(password&&password.length<8))return toast('Kullanıcı adı, ad ve en az 8 karakterlik şifreyi kontrol edin');
      const employee=(state.employees||[]).find(e=>String(e.id)===employeeId);
      const payload={username,password,name,email:$('#u-email').value.trim(),role:$('#u-role').value,status:$('#u-status').value,department:$('#u-department').value||employee?.department||'',employee_id:employeeId||null};
      const submit=document.querySelector('.modal .submit');
      if(submit)submit.disabled=true;
      try{
        const saved=await api(existing?'/api/users/'+encodeURIComponent(existing.id):'/api/users',{method:existing?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        if(existing)Object.assign(existing,saved);else users.push(saved);
        closeModal();
        renderUsers();
        toast(existing?'Kullanıcı güncellendi':'Kullanıcı hesabı oluşturuldu');
        if(existing&&String(existing.id)===String(window.__ikAuthUser?.id))setTimeout(()=>location.reload(),500);
      }catch(error){toast(error.message)}
      finally{if(submit)submit.disabled=false}
    });
    $('#u-employee').onchange=()=>{const employee=(state.employees||[]).find(e=>String(e.id)===$('#u-employee').value);if(employee)$('#u-department').value=employee.department};
  }

  const baseShell=shell;
  shell=function(){
    if(state.view==='users'){renderUsers();loadUsers()}
    else baseShell();
  };
  loadUsers();
})();
