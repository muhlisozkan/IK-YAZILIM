(function(){
  let users=[],loaded=false,loading=false,customRoles=[];
  const roles=['Sistem yöneticisi','İK yöneticisi','Departman yöneticisi','Mali İşler','Finans yöneticisi','Bordro yetkilisi','Genel müdür','Genel müdür yardımcısı','Bölge yöneticisi','Güvenlik','Personel','Sadece görüntüleme'];
  const NEW_ROLE_VALUE='__new_role__';
  const ROLE_MODULES=[
    ['dashboard','Genel Bakış'],['attendance','Puantaj ve Devam'],['shifts','Vardiya Planı'],
    ['leave','İzin Yönetimi'],['birthdays','Doğum Günleri'],['documents','Özlük Dosyaları'],
    ['training','Eğitim ve Gelişim'],['performance','Performans'],['survey','Anket'],
    ['employees','Çalışanlar'],['departments','Departmanlar'],['recruitment','CV Yönetimi'],
    ['reports','Raporlar'],['security','Güvenlik'],['lostfound','Kayıp Eşya'],
    ['users','Kullanıcılar'],['approval-matrix','Onay Matrisi'],['smtp-settings','E-posta Ayarları'],
    ['sms-settings','SMS Entegrasyonu'],['personel-butcesi','Personel Bütçesi'],['guncel-tablo','Güncel Tablo'],
    ['kys-eys','Entegre Yönetim Sistemi'],['kys-dokuman','Doküman Yönetimi'],['kys-dof','DÖF Takip'],
    ['kys-hedefler','Kalite Hedefleri / KPI'],['kys-ygg','Yönetimin Gözden Geçirmesi'],
    ['kys-tedarikci','Tedarikçi Değerlendirme'],['kys-kalibrasyon','Kalibrasyon / Ekipman Takibi'],
    ['kys-sikayet','Misafir Şikayet & Memnuniyet'],['kys-denetim','Marka Standart Denetimi'],
    ['kys-haccp','Gıda Güvenliği / HACCP'],['alacarte','A La Carte Rezervasyon'],['spa-reservations','Spa Rezervasyon']
  ];
  const ROLE_LEVEL_LABELS={view:'Sadece görme',write:'Yazma',full:'Tam kontrol'};
  let roleBuilderSelected={},editingRoleId=null,editingBuiltinRole=null;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const departments=()=>[...new Set((state.employees||[]).map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
  const foldAscii=s=>String(s||'').replace(/İ/g,'i').replace(/I/g,'ı').toLocaleLowerCase('tr-TR')
    .replace(/ı/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c')
    .normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z ]/g,'').replace(/\s+/g,' ').trim();
  const suggestUsername=name=>{const p=foldAscii(name).split(' ').filter(Boolean);return p.length>1?p[0]+'.'+p[p.length-1]:(p[0]||'');};
  const normTel=v=>{let d=String(v||'').replace(/\D+/g,'');if(d.startsWith('0090'))d=d.slice(2);if(d.startsWith('90')&&d.length===12)d=d.slice(2);if(d.length===10&&d[0]==='5')d='0'+d;return d;};
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

  async function loadCustomRoles(){
    try{customRoles=await api('/api/custom-roles')}catch{customRoles=[]}
  }

  function renderUsers(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='users'));
    $('#page-title').textContent='Kullanıcı ve Yetki Yönetimi';
    const rows=users.map(u=>`<tr><td><strong>${esc(u.name)}</strong><small class="muted" style="display:block">@${esc(u.username)}${u.email?' · '+esc(u.email):''}${u.phone?' · '+esc(u.phone):''}</small></td><td>${esc(u.role)}</td><td>${esc(u.department||'-')}<small class="muted" style="display:block">${esc((state.employees||[]).find(e=>String(e.id)===String(u.employee_id))?.name||'Personel bağlantısı yok')}</small></td><td><span class="badge ${u.status==='Aktif'?'green':'red'}">${esc(u.status)}</span>${u.locked?` <span class="badge red" title="Çok fazla hatalı giriş denemesi">Kilitli</span>`:''}${u.is_manager===false?` <span class="badge" title="İzin Yönetimi, Personel Bütçesi ve CV Yönetimi menüleri gizli">Yönetici değil</span>`:''}</td><td><button class="btn ghost" data-user-edit="${u.id}">Düzenle</button>${u.locked?`<button class="btn ghost" data-user-unlock="${u.id}">Kilidi Aç</button>`:''}<button class="btn ghost danger-text" data-user-delete="${u.id}">Sil</button></td></tr>`).join('');
    const body=loaded?(rows||'<tr><td colspan="5" class="empty">Kullanıcı bulunmuyor</td></tr>'):'<tr><td colspan="5" class="empty">Kullanıcılar yükleniyor…</td></tr>';
    $('#app').innerHTML=`<div class="section-title"><div><h2>Kullanıcı ve yetki yönetimi</h2><span class="muted">Gerçek giriş hesaplarını, rollerini ve personel bağlantılarını yönetin</span></div><button class="btn" id="add-user">+ Kullanıcı ekle</button></div><div class="card"><div class="card-head"><h2>Kullanıcılar</h2><span class="muted">${loaded?users.length:0} hesap</span></div><div style="overflow:auto"><table><thead><tr><th>KULLANICI / GİRİŞ ADI</th><th>ROL</th><th>DEPARTMAN / PERSONEL</th><th>DURUM</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
    $('#add-user').onclick=()=>userModal();
    document.querySelectorAll('[data-user-edit]').forEach(b=>b.onclick=()=>userModal(users.find(u=>String(u.id)===b.dataset.userEdit)));
    document.querySelectorAll('[data-user-delete]').forEach(b=>b.onclick=()=>deleteUser(b.dataset.userDelete));
    document.querySelectorAll('[data-user-unlock]').forEach(b=>b.onclick=()=>unlockUser(b.dataset.userUnlock));
    window.__ikSyncUsersGroup?.();
  }

  function syncUsersNavGroup(){
    const group=document.getElementById('users-nav-group');
    if(!group)return;
    const active=['users-group','users','approval-matrix','smtp-settings','sms-settings','vehicle-definitions'].includes(state.view);
    const toggle=group.querySelector('.nav-group-toggle');
    if(toggle)toggle.classList.toggle('active',active);
    if(active)group.classList.add('open');
  }
  window.__ikSyncUsersGroup=syncUsersNavGroup;
  window.__ikToggleUsersMenu=function(event){
    // Yalnızca alt menüyü aç/kapat — başka hiçbir şey yapma (gezinme yok).
    event?.preventDefault();event?.stopPropagation();
    document.getElementById('users-nav-group')?.classList.toggle('open');
  };

  async function unlockUser(id){
    try{
      await api('/api/users/'+encodeURIComponent(id)+'/unlock',{method:'POST'});
      const u=users.find(x=>String(x.id)===String(id));
      if(u)u.locked=false;
      renderUsers();
      toast('Hesabın kilidi açıldı');
    }catch(error){toast(error.message)}
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

  function renderRoleBuilder(){
    const availableHost=$('#role-modules-available'),selectedHost=$('#role-modules-selected');
    if(!availableHost||!selectedHost)return;
    const available=ROLE_MODULES.filter(([k])=>!(k in roleBuilderSelected));
    availableHost.innerHTML=available.length
      ?available.map(([k,label])=>`<button type="button" class="role-module-item" data-add="${k}">+ ${esc(label)}</button>`).join('')
      :'<div class="muted" style="padding:8px;font-size:12px">Tüm modüller eklendi</div>';
    const keys=Object.keys(roleBuilderSelected);
    selectedHost.innerHTML=keys.length
      ?keys.map(k=>{
        const label=ROLE_MODULES.find(([mk])=>mk===k)?.[1]||k;
        const level=roleBuilderSelected[k];
        return `<div class="role-module-row">
          <button type="button" class="role-module-remove" data-remove="${k}" title="Kaldır">×</button>
          <span class="role-module-name">${esc(label)}</span>
          <div class="role-level-group">${['view','write','full'].map(lv=>`<button type="button" class="role-level-btn${level===lv?' active':''}" data-level-key="${k}" data-level-value="${lv}">${ROLE_LEVEL_LABELS[lv]}</button>`).join('')}</div>
        </div>`;
      }).join('')
      :'<div class="muted" style="padding:8px;font-size:12px">Henüz modül eklenmedi — soldan seçin</div>';
    availableHost.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>{roleBuilderSelected[b.dataset.add]='view';renderRoleBuilder();});
    selectedHost.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{delete roleBuilderSelected[b.dataset.remove];renderRoleBuilder();});
    selectedHost.querySelectorAll('[data-level-key]').forEach(b=>b.onclick=()=>{roleBuilderSelected[b.dataset.levelKey]=b.dataset.levelValue;renderRoleBuilder();});
  }

  function userModal(existing){
    roleBuilderSelected={};editingRoleId=null;editingBuiltinRole=null;
    const employeeOptions=['<option value="">Bağlantı yok</option>',...(state.employees||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr')).map(e=>`<option value="${e.id}" ${String(existing?.employee_id||'')===String(e.id)?'selected':''}>${esc(e.name)} · ${esc(e.department)}</option>`)].join('');
    const roleOptions=[
      ...roles.map(r=>`<option ${r===existing?.role?'selected':''}>${r}</option>`),
      ...customRoles.map(r=>`<option value="${esc(r.name)}" ${r.name===existing?.role?'selected':''}>${esc(r.name)}</option>`),
      `<option value="${NEW_ROLE_VALUE}">— Yeni Rol —</option>`
    ].join('');
    modal(existing?'Kullanıcıyı düzenle':'Yeni kullanıcı',`<div class="form-grid">
      <div class="field"><label>Giriş kullanıcı adı *</label><input class="input" id="u-username" autocomplete="off" value="${esc(existing?.username||'')}"></div>
      <div class="field"><label>${existing?'Yeni şifre':'Şifre *'}</label><input class="input" id="u-password" type="password" autocomplete="new-password" placeholder="${existing?'Değişmeyecekse boş bırakın':'En az 8 karakter'}"></div>
      <div class="field"><label>Ad soyad *</label><input class="input" id="u-name" value="${esc(existing?.name||'')}"></div>
      <div class="field"><label>E-posta</label><input class="input" id="u-email" type="email" value="${esc(existing?.email||'')}"></div>
      <div class="field"><label>Telefon (SMS bildirimi)</label><input class="input" id="u-phone" type="tel" placeholder="5xx xxx xx xx" value="${esc(existing?.phone||'')}"></div>
      <div class="field"><label>Rol</label><div style="display:flex;gap:6px"><select class="select" id="u-role" data-no-combobox style="flex:1">${roleOptions}</select><button type="button" class="btn ghost" id="u-role-edit" hidden>Rolü düzenle</button></div></div>
      <div class="field"><label>Durum</label><select class="select" id="u-status"><option ${existing?.status!=='Pasif'?'selected':''}>Aktif</option><option ${existing?.status==='Pasif'?'selected':''}>Pasif</option></select></div>
      <div class="field"><label>Departman</label><select class="select" id="u-department"><option value="">Departman seçin</option>${departments().map(d=>`<option ${d===existing?.department?'selected':''}>${esc(d)}</option>`).join('')}</select></div>
      <div class="field"><label>Bağlı personel</label><select class="select" id="u-employee">${employeeOptions}</select></div>
      <div class="field"><label style="display:flex;align-items:center;gap:7px"><input type="checkbox" id="u-manager" ${existing?.is_manager!==false?'checked':''}> Yönetici</label><small class="muted">İşaretli değilse İzin Yönetimi, Personel Bütçesi ve CV Yönetimi menüleri bu kullanıcıda görünmez.</small></div>
      <div class="field" id="u-new-role-builder" style="grid-column:1/-1" hidden>
        <label id="role-name-label">Yeni rol adı *</label><input class="input" id="new-role-name" placeholder="Örn. Gece Vardiyası Sorumlusu">
        <div class="role-builder-grid">
          <div><strong>Seçilebilir modüller</strong><div id="role-modules-available" class="role-module-list"></div></div>
          <div><strong>İzinli modüller</strong><div id="role-modules-selected" class="role-module-list"></div></div>
        </div>
        <label style="display:flex;align-items:center;gap:7px;margin-top:10px;font-size:12.5px;font-weight:500;color:var(--ink-soft)"><input type="checkbox" id="role-company-wide"> Tüm departmanların verilerini görebilsin (departman kısıtı olmasın)</label>
      </div>
    </div>`,async()=>{
      const username=$('#u-username').value.trim(),password=$('#u-password').value,name=$('#u-name').value.trim(),employeeId=$('#u-employee').value;
      if(username.length<3||!name||(!existing&&password.length<8)||(password&&password.length<8))return toast('Kullanıcı adı, ad ve en az 8 karakterlik şifreyi kontrol edin');
      let role=$('#u-role').value;
      if(role===NEW_ROLE_VALUE){
        const roleName=$('#new-role-name').value.trim();
        if(!roleName)return toast('Yeni rol için bir isim girin');
        if(!Object.keys(roleBuilderSelected).length)return toast('Yeni rol için en az bir modül seçin');
        try{
          const createdRole=await api('/api/custom-roles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:roleName,permissions:roleBuilderSelected,company_wide:$('#role-company-wide').checked})});
          customRoles.push(createdRole);
          window.__ikReloadCustomRoles?.();
          role=createdRole.name;
        }catch(error){return toast(error.message)}
      }else if(editingRoleId){
        if(!Object.keys(roleBuilderSelected).length)return toast('Rol için en az bir modül seçin');
        try{
          const updatedRole=await api('/api/custom-roles/'+encodeURIComponent(editingRoleId),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({permissions:roleBuilderSelected,company_wide:$('#role-company-wide').checked})});
          const idx=customRoles.findIndex(r=>r.id===editingRoleId);
          if(idx>-1)customRoles[idx]=updatedRole;
          window.__ikReloadCustomRoles?.();
        }catch(error){return toast(error.message)}
      }else if(editingBuiltinRole){
        if(!Object.keys(roleBuilderSelected).length)return toast('En az bir ek modül seçin');
        try{
          const createdRole=await api('/api/custom-roles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:editingBuiltinRole,permissions:roleBuilderSelected,company_wide:$('#role-company-wide').checked,overlay:true})});
          customRoles.push(createdRole);
          window.__ikReloadCustomRoles?.();
        }catch(error){return toast(error.message)}
      }
      const employee=(state.employees||[]).find(e=>String(e.id)===employeeId);
      const payload={username,password,name,email:$('#u-email').value.trim(),phone:$('#u-phone').value.trim(),role,status:$('#u-status').value,department:$('#u-department').value||employee?.department||'',employee_id:employeeId||null,is_manager:$('#u-manager').checked};
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
    const updateRoleEditButton=()=>{
      const btn=$('#u-role-edit'),val=$('#u-role').value;
      if(btn)btn.hidden=!val||val===NEW_ROLE_VALUE;
    };
    $('#u-role').onchange=()=>{
      const builder=$('#u-new-role-builder');
      const isNew=$('#u-role').value===NEW_ROLE_VALUE;
      editingRoleId=null;editingBuiltinRole=null;
      if(builder)builder.hidden=!isNew;
      if(isNew){
        roleBuilderSelected={};
        const nameField=$('#new-role-name'),label=$('#role-name-label'),companyWide=$('#role-company-wide');
        if(nameField){nameField.disabled=false;nameField.value='';}
        if(label)label.textContent='Yeni rol adı *';
        if(companyWide)companyWide.checked=false;
        renderRoleBuilder();
      }
      updateRoleEditButton();
    };
    $('#u-role-edit').onclick=()=>{
      const roleName=$('#u-role').value;
      const match=customRoles.find(r=>r.name===roleName);
      const isBuiltin=roles.includes(roleName);
      if(!match&&!isBuiltin)return;
      editingRoleId=match?match.id:null;
      editingBuiltinRole=(!match&&isBuiltin)?roleName:null;
      roleBuilderSelected={...(match?.permissions||{})};
      const builder=$('#u-new-role-builder');
      if(builder)builder.hidden=false;
      const nameField=$('#new-role-name'),label=$('#role-name-label'),companyWide=$('#role-company-wide');
      if(nameField){nameField.value=roleName;nameField.disabled=true;}
      if(label)label.textContent=isBuiltin
        ?`"${roleName}" yerleşik rolüne ek modül izni (bu ekranda seçtiğin modüller, rolün zaten sahip olduğu izinlerin üzerine eklenir — hiçbiri kaldırılmaz)`
        :'Rol adı (değiştirilemez)';
      if(companyWide)companyWide.checked=Boolean(match?.company_wide);
      renderRoleBuilder();
    };
    updateRoleEditButton();
    // Bağlı personel seçilince form alanlarını çalışan kaydından doldur
    $('#u-employee').onchange=()=>{
      const employee=(state.employees||[]).find(e=>String(e.id)===$('#u-employee').value);
      if(!employee)return;
      const set=(id,val)=>{const el=$('#'+id);if(el&&val)el.value=val;};
      set('u-name',employee.name);
      set('u-email',employee.email);
      set('u-phone',normTel(employee.phone));
      const dept=$('#u-department');
      if(dept&&employee.department){
        if(![...dept.options].some(o=>o.value===employee.department))dept.add(new Option(employee.department,employee.department));
        dept.value=employee.department;
      }
      const un=$('#u-username');
      if(un&&!un.value.trim())un.value=suggestUsername(employee.name);
    };
  }

  const baseShell=shell;
  shell=function(){
    if(state.view==='users'){renderUsers();loadUsers()}
    else baseShell();
  };
  loadUsers();
  loadCustomRoles();
})();
