(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trSort=(a,b)=>String(a??'').localeCompare(String(b??''),'tr');
  const nowInput=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  const fromInput=v=>{if(!v)return '—';const d=new Date(v);return isNaN(d)?v:d.toLocaleString('tr-TR');};
  const toInput=v=>{if(!v||v==='—')return '';const m=String(v).match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})[ T](\d{1,2}):(\d{2})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}`;const d=new Date(v);return isNaN(d)?'':new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};

  const lostCategories=['Ayakkabı/Terlik','Bebek Malzemeleri','Çanta','Değerli Eşya','Deniz/Havuz Malzemeleri','Diğer','Elektronik','Gözlük','Kozmetik','Kitap','Oyuncak','Takı','Tekstil','Termos','Toplu Kayıp'];
  const HMS_DEPTS=['ÖN BÜRO','MALİ İŞLER','KAT HİZMETLERİ','TEKNİK SERVİS','MİSAFİR İLİŞKİLERİ','GÜVENLİK'];
  const normDept=d=>String(d||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
  // Departman-personel listesi: state.employees departman kapsamlı olabildiği için
  // HMS'e özel kapsamsız uçtan yüklenir (transfer teslim alan/eden seçimi için tüm departmanlar).
  let hmsPeople=null;
  async function loadPeople(){
    if(hmsPeople)return hmsPeople;
    try{hmsPeople=await api('/api/hms/people');}
    catch(_){hmsPeople=(state.employees||[]).map(e=>({name:e.name,department:e.department}));}
    return hmsPeople;
  }
  const peopleSrc=()=>(hmsPeople&&hmsPeople.length?hmsPeople:(state.employees||[]));
  const deptList=()=>[...new Set([...peopleSrc().map(e=>normDept(e.department)).filter(Boolean),...HMS_DEPTS])].sort(trSort);
  const deptEmployees=d=>peopleSrc().filter(e=>normDept(e.department)===normDept(d)).map(e=>e.name).filter(Boolean).sort(trSort);

  const GUV_TABS=['visitors','vehicles','fleet','staff_status'];
  const LOST_TABS=['lost_items','lost_approvals','lost_delivered'];
  // Özel rol ("Yeni Rol") seviyesini (view/write/full) HMS'in kendi seviyelerine çevirir.
  const hmsLevelFromCustom=lv=>lv==='full'?'full':lv==='write'?'operate':lv==='view'?'read':'none';
  function access(){
    const a=window.__ikSecurityAccess?.()||{};
    const customLevel=window.__ikCustomModuleLevel;
    const guv=a.admin?'full':(a.hr?'read':(a.security?'operate':hmsLevelFromCustom(customLevel?.('security'))));
    // Kayıp Eşya: sadece Sistem yöneticisi (tam) + ilgili departmanlar + özel rolde tanımlıysa. İK dahil değil.
    const lost=a.admin?'full':(a.lostDept?'operate':hmsLevelFromCustom(customLevel?.('lostfound')));
    return {guv,lost,report:(guv!=='none'||lost!=='none')};
  }
  const permFor=module=>{const ac=access();if(module==='report')return 'read';return LOST_TABS.includes(module)?ac.lost:ac.guv;};
  const canWrite=module=>['full','operate'].includes(permFor(module));
  const canDelete=module=>permFor(module)==='full';

  const TABDEFS={
    security:[['visitors','Ziyaretçiler'],['vehicles','Araç Takipleri'],['staff_status','Çalışan Takipleri'],['guest_tracking','Misafir Takip'],['report','Rapor']],
    lostfound:[['lost_items','Kayıp/Bulunan Eşyalar'],['lost_approvals','Onay Bekleyenler'],['lost_delivered','Teslim Edilenler'],['report','Rapor']]
  };
  const VIEW_META={
    security:{title:'Güvenlik',subtitle:'Ziyaretçi, araç ve çalışan giriş/çıkış takibi'},
    lostfound:{title:'Kayıp Eşya',subtitle:'Kayıp/bulunan eşya kaydı, departman transferi ve raporlar'}
  };
  let currentView='security';

  const columns={
    visitors:[['date','Ziyaret Tarihi',fromInput],['type','Ziyaret Tipi'],['name','İsim'],['company','Firma'],['plate','Plaka'],['status','Durum'],['exit','Çıkış Tarihi',fromInput],['identity','Kimlik Tipi'],['count','Kişi Sayısı']],
    vehicles:[['plate','Plaka'],['brand','Marka'],['model','Model'],['driver','Sürücü'],['destination','Gideceği Yer'],['departure','Çıkış Tarihi',fromInput],['status','Durum'],['km','Km'],['returnDate','Dönüş Tarihi',fromInput],['returnKm','Dönüş Km'],['requester','Talep Eden'],['fault','Araç Hata Durumu']],
    fleet:[['plate','Plaka'],['brand','Marka'],['model','Model'],['startKm','Başlangıç Km'],['lastKm','Son Km'],['disabled','Kullanım Dışı']],
    staff_status:[['name','İsim'],['entry','Giriş',fromInput],['status','Durum'],['exit','Çıkış Tarihi',fromInput],['title','Ünvan'],['department','Departman']],
    lost_items:[['id','ID'],['foundDate','Kayıp/Bulunma Tarihi'],['processDate','İşlem Tarihi'],['item','Eşya'],['category','Kategori'],['location','Nerede Bulundu'],['storage','Saklandığı Yer'],['status','Durum'],['receiver','Teslim Alan'],['approval','Onay Durumu']],
    lost_approvals:[['id','ID'],['foundDate','Kayıp/Bulunma Tarihi'],['processDate','İşlem Tarihi'],['item','Eşya'],['category','Kategori'],['location','Nerede Bulundu'],['fromDepartment','Gönderen'],['targetDepartment','Hedef'],['transferReceiver','Teslim Alan'],['status','Durum']],
    lost_delivered:[['id','ID'],['foundDate','Kayıp/Bulunma Tarihi'],['processDate','İşlem Tarihi'],['item','Eşya'],['category','Kategori'],['location','Nerede Bulundu'],['receiver','Teslim Alan'],['status','Durum']]
  };
  const fields={
    visitors:()=>[['date','Ziyaret Tarihi','datetime-local'],['type','Ziyaret Tipi','select',['Misafir','Personel','Mağaza','Günübirlik']],['name','Ziyaretçinin Adı Soyadı'],['company','Firma'],['plate','Plaka'],['identity','Kimlik Tipi','select',['Kart Verilmedi','Kimlik Kartı','Pasaport','Ehliyet']],['count','Kişi Sayısı','number'],['department','Departman','select',deptList()],['status','Durum','select',['İçeride','Çıkış Yaptı']],['exit','Çıkış Tarihi','datetime-local'],['notes','Notlar','textarea']],
    vehicles:()=>[['departure','Çıkış Tarihi','datetime-local'],['plate','Araç'],['driver','Sürücü'],['requester','Talep Eden'],['destination','Gideceği Yer'],['status','Durum','select',['Ayrıldı','Çıkış Yaptı','Dönüş Yaptı']],['km','Çıkış Km','number'],['returnDate','Dönüş Tarihi','datetime-local'],['returnKm','Dönüş Km','number'],['fault','Araç Hata Durumu','select',['Yok','Var']],['notes','Notlar','textarea']],
    fleet:()=>[['plate','Plaka'],['brand','Marka'],['model','Model'],['startKm','Başlangıç Km','number'],['lastKm','Son Km','number'],['disabled','Kullanım Dışı','select',['Hayır','Evet']]],
    staff_status:()=>[['name','İsim'],['entry','Giriş','datetime-local'],['status','Durum','select',['İçeride','Henüz Giriş Yapmadı','Çıkış Yaptı']],['exit','Çıkış Tarihi','datetime-local'],['title','Ünvan'],['department','Departman','select',deptList()],['notes','Notlar','textarea']],
    lost_items:()=>[['foundDate','Kayıp/Bulunma Tarihi ve Saati','datetime-local'],['category','Kategori','select',lostCategories],['item','Eşya'],['location','Nerede Bulundu'],['notes','Notlar','textarea'],['status','Durum','select',['Beklemede','Saklama Sonu','Teslim Edildi']],['storage','Saklandığı Yer'],['receiver','Teslim Alan'],['approval','Onay Durumu','select',['Onay Bekliyor','Onaylandı','Reddedildi']]]
  };

  let tab='visitors';
  let staffSelectedId=null;
  const cache={};
  const filters={};
  const tabKey=()=>'ik_hms_tab_'+currentView;

  async function api(path,opt){
    const r=await fetch(path,opt);
    const d=r.status===204?null:await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d?.error||'İşlem tamamlanamadı');
    return d;
  }
  async function load(module,force){
    if(cache[module]&&!force)return cache[module];
    cache[module]=await api('/api/hms/'+module);
    return cache[module];
  }

  function visibleTabs(){
    const ac=access();
    const perm=currentView==='lostfound'?ac.lost:ac.guv;
    return perm==='none'?[]:TABDEFS[currentView];
  }
  function shellHtml(body){
    const vt=visibleTabs();
    const meta=VIEW_META[currentView];
    return `<div class="section-title"><div><h2>${meta.title}</h2><span class="muted">${meta.subtitle}</span></div></div>
      <div class="leave-tabs" style="margin-bottom:16px;flex-wrap:wrap">${vt.map(([k,l])=>`<button class="btn ${tab===k?'':'secondary'} hms-tabbtn" data-hms-tab="${k}">${l}${k==='lost_approvals'?'<span class="hms-tab-badge" id="lost-appr-badge" hidden></span>':''}</button>`).join('')}</div>
      <div id="hms-body">${body}</div>`;
  }
  function mount(body){
    $('#app').innerHTML=shellHtml(body);
    document.querySelectorAll('[data-hms-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.hmsTab;sessionStorage.setItem(tabKey(),tab);render();});
    if(currentView==='lostfound')refreshApprovalBadge();
  }
  // "Onay Bekleyenler" sekmesindeki bekleyen talep sayısı (hedef departmana göre)
  async function refreshApprovalBadge(){
    const el=$('#lost-appr-badge');if(!el)return;
    let rows;
    try{rows=await api('/api/hms/lost_approvals');}catch(_){return;}
    cache.lost_approvals=rows;
    const n=rows.filter(r=>r.status==='Beklemede').length;
    el.textContent=n>99?'99+':String(n);
    el.hidden=n===0;
  }

  // --- Kolon filtreleri (HMS ile aynı davranış) ----------------------
  const COMBO_FILTER_COLS={lost_items:['category','status','storage'],lost_approvals:['category','status'],lost_delivered:['category'],visitors:['type']};
  // "2026-09-10" gibi bir tarih filtresini "10.09.2026" metnine çevirerek eşle
  function colFilterMatch(row,key,raw){
    const val=String(raw||'').trim();
    if(!val)return true;
    const text=String(row[key]??'').toLocaleLowerCase('tr-TR');
    const m=val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(m)return text.includes(`${m[3]}.${m[2]}.${m[1]}`);
    return text.includes(val.toLocaleLowerCase('tr-TR'));
  }

  // --- Genel tablo görünümü -------------------------------------------
  async function renderTable(module){
    mount('<div class="card empty">Yükleniyor…</div>');
    // "Teslim Edilenler" sanal sekmesi lost_items verisini kullanır
    const dataModule=module==='lost_delivered'?'lost_items':module;
    const editModule=module==='lost_delivered'?'lost_items':module;
    let rows;
    try{rows=await load(dataModule);}catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(module==='staff_status')loadPeople().catch(()=>{});
    if(tab!==module)return;
    const cols=columns[module];
    const f=filters[module]||(filters[module]={q:'',cols:{}});
    if(!f.cols)f.cols={};
    const isApprovals=module==='lost_approvals';
    const isDelivered=module==='lost_delivered';
    const isLF=currentView==='lostfound';
    const isStaff=module==='staff_status';
    const comboCols=COMBO_FILTER_COLS[module]||[];
    const dateCol=l=>/tarih/i.test(l);
    const optsFor=k=>[...new Set(rows.map(r=>String(r[k]??'').trim()).filter(Boolean))].sort(trSort);
    const filterCell=([k,l])=>comboCols.includes(k)
      ? `<th><div class="hms-fcombo"><input class="input" list="hmsf-${k}" data-hms-fcol="${k}" placeholder="${esc(l)}…" value="${esc(f.cols[k]||'')}"><button type="button" class="hms-fclear" data-hms-fclear="${k}" title="Temizle">×</button><datalist id="hmsf-${k}">${optsFor(k).map(o=>`<option value="${esc(o)}">`).join('')}</datalist></div></th>`
      : `<th><input class="input" type="${dateCol(l)?'date':'text'}" data-hms-fcol="${k}" placeholder="${dateCol(l)?'gg.aa.yyyy':''}" value="${esc(f.cols[k]||'')}"></th>`;
    const canAdd=fields[module]&&canWrite(module)&&!isApprovals&&!isDelivered;
    const filteredList=()=>{
      const q=f.q.toLocaleLowerCase('tr-TR');
      let shown=rows.filter(row=>!q||Object.values(row).join(' ').toLocaleLowerCase('tr-TR').includes(q));
      shown=shown.filter(row=>cols.every(([k])=>colFilterMatch(row,k,f.cols[k])));
      if(isApprovals)return shown.filter(r=>r.status==='Beklemede');
      if(isDelivered)return shown.filter(r=>r.status==='Teslim Edildi');
      if(module==='lost_items')return shown.filter(r=>r.status!=='Teslim Edildi');
      // Çalışan Takip: isimler alfabetik sırada listelenir (kullanıcı isteği 2026-09).
      if(isStaff)return shown.slice().sort((a,b)=>trSort(a.name,b.name));
      // Araç Takipleri: ekranda her aracın yalnızca en son kaydı görünür (Çalışan Takip'teki
      // gibi) — önceki geçmiş kayıtlar "Detay" penceresine taşınır (kullanıcı isteği 2026-09).
      // /api/hms/vehicles zaten "id desc" (en yeni önce) döndüğü için ilk görülen kayıt en yenisidir.
      if(module==='vehicles'){
        const seen=new Set();
        return shown.filter(row=>{
          const key=String(row.plate||'').trim().toLocaleUpperCase('tr-TR');
          if(seen.has(key))return false;
          seen.add(key);
          return true;
        });
      }
      return shown;
    };
    const rowClass=row=>{
      if((module==='visitors'||module==='staff_status')&&row.status==='İçeride')return ' class="hms-inside"';
      // Araç içerideyken (döndüğünde) beyaz, dışarıdayken kırmızı gösterilir — Ziyaretçi/Çalışan
      // Takip'in yeşil "içeride" rengiyle karışmasın diye ayrı bir sınıf (kullanıcı isteği 2026-09).
      if(module==='vehicles'&&['Dönüş Yaptı','Giriş Yaptı'].includes(String(row.status)))return ' class="hms-vehin"';
      if(module==='vehicles'&&row.status==='Çıkış Yaptı')return ' class="hms-vehout"';
      return '';
    };
    const rowsHtml=list=>list.map(row=>`<tr data-id="${row.id}"${rowClass(row)}>
        ${isStaff?`<td class="hms-selcell"><input type="checkbox" class="hms-rowsel" data-hms-sel="${row.id}"${String(row.id)===String(staffSelectedId)?' checked':''}></td>`:''}
        ${cols.map(([k,,fmt])=>`<td>${esc(fmt?fmt(row[k]):(row[k]??'—'))}</td>`).join('')}
        <td class="row-actions">${rowActions(module,row)}</td>
      </tr>`).join('')||`<tr><td colspan="${cols.length+1+(isStaff?1:0)}" class="empty">Kayıt bulunamadı</td></tr>`;
    const toolbar=isStaff
      ? `<div class="toolbar">
          <button class="btn secondary" type="button" id="staff-detail-btn">▤ Detaylar</button>
          <div class="lf-search"><input class="input" id="hms-q" placeholder="Listede ara…" value="${esc(f.q)}"></div>
          ${canAdd?`<button class="btn" id="hms-add">+ Yeni</button>`:''}
          <button class="btn lf-refresh" id="hms-refresh">↻ Yenile</button>
          <span class="lf-count" id="hms-count"></span>
        </div>`
      : isLF
      ? `<div class="toolbar">
          <div class="lf-search"><input class="input" id="hms-q" placeholder="Listede ara…" value="${esc(f.q)}"></div>
          ${canAdd?`<button class="btn" id="hms-add">+ Yeni</button>`:''}
          <button class="btn lf-refresh" id="hms-refresh">↻ Yenile</button>
          <span class="lf-count" id="hms-count"></span>
        </div>`
      : `<div class="toolbar">
          <input class="input" id="hms-q" placeholder="Listede ara…" value="${esc(f.q)}">
          ${canAdd?`<button class="btn" id="hms-add">+ Yeni</button>`:''}
          <span class="muted" id="hms-count"></span>
        </div>`;
    const headCell=([k,l],i)=>`<th>${l}${isLF&&i===0?' <span class="lf-sort">↓</span>':''}</th>`;
    const isVisitors=module==='visitors';
    const body=`<div class="card${(isLF||isStaff)?' lf-list':''}${isStaff?' staff-list':''}${isVisitors?' visitors-list':''}">
      ${toolbar}
      <div style="overflow:auto"><table class="hms-table"><thead>
        <tr>${isStaff?'<th></th>':''}${cols.map(headCell).join('')}<th>Eylemler</th></tr>
        <tr class="hms-filters">${isStaff?'<th></th>':''}${cols.map(filterCell).join('')}<th></th></tr>
      </thead><tbody id="hms-tbody"></tbody></table></div>
    </div>`;
    mount(body);
    // Filtreleri yerinde uygula — tüm kabuğu yeniden çizmeden, odak kaybolmadan
    const paint=()=>{
      const list=filteredList();
      const tb=$('#hms-tbody');if(tb)tb.innerHTML=rowsHtml(list);
      const c=$('#hms-count');
      if(c)c.innerHTML=(isLF||isStaff)?`Kalıcı kayıt <b>${list.length} kayıt</b>`:`${list.length} kayıt${permFor(module)==='read'?' · salt görüntüleme':''}`;
      $('#hms-body').querySelectorAll('tbody tr[data-id]').forEach(tr=>{
        // Çalışan Takip: Sistem yöneticisi dışındaki kullanıcılar için çift tıklama
        // hiçbir şey açmaz (kullanıcı isteği 2026-09).
        tr.ondblclick=()=>{
          if(isStaff&&permFor(editModule)!=='full')return;
          const row=list.find(r=>String(r.id)===tr.dataset.id);
          if(row&&fields[editModule]&&canWrite(editModule))openEditor(editModule,row);
        };
        if(isStaff&&String(tr.dataset.id)===String(staffSelectedId))tr.classList.add('lf-sel');
        if(isLF)tr.onclick=e=>{if(e.target.closest('.row-actions'))return;$('#hms-body').querySelectorAll('tbody tr.lf-sel').forEach(x=>x.classList.remove('lf-sel'));tr.classList.add('lf-sel');};
        // Çalışan Takip: satıra tıklayınca değil, yalnızca baştaki tik kutucuğuyla
        // seçim yapılır (kullanıcı isteği 2026-09).
        if(isStaff){
          const cb=tr.querySelector('.hms-rowsel');
          if(cb)cb.onchange=()=>{
            if(cb.checked){
              staffSelectedId=tr.dataset.id;
              $('#hms-body').querySelectorAll('.hms-rowsel').forEach(x=>{if(x!==cb)x.checked=false;});
              $('#hms-body').querySelectorAll('tbody tr.lf-sel').forEach(x=>x.classList.remove('lf-sel'));
              tr.classList.add('lf-sel');
            }else{
              if(String(staffSelectedId)===String(tr.dataset.id))staffSelectedId=null;
              tr.classList.remove('lf-sel');
            }
          };
        }
        // Araç Takipleri: kayda tıklanınca doğrudan düzenleme penceresi açılır (kullanıcı isteği 2026-09).
        if(module==='vehicles')tr.onclick=e=>{
          if(e.target.closest('.row-actions'))return;
          const row=list.find(r=>String(r.id)===tr.dataset.id);
          if(row&&fields[editModule]&&canWrite(editModule))openEditor(editModule,row);
        };
      });
      $('#hms-body').querySelectorAll('[data-hms-toggle]').forEach(b=>b.onclick=()=>toggleStatus(module,b.dataset.hmsToggle));
      $('#hms-body').querySelectorAll('[data-hms-vehaction]').forEach(b=>b.onclick=()=>{
        const row=(cache.vehicles||[]).find(r=>String(r.id)===String(b.dataset.hmsVehaction));
        if(!row)return;
        if(row.status==='Çıkış Yaptı')openVehicleReturnEditor(row);
        else openEditor('vehicles',null,{plate:row.plate,status:'Çıkış Yaptı'});
      });
      $('#hms-body').querySelectorAll('[data-hms-vehdetail]').forEach(b=>b.onclick=()=>{
        const row=(cache.vehicles||[]).find(r=>String(r.id)===String(b.dataset.hmsVehdetail));
        if(row)openVehicleHistoryModal(row);
      });
      $('#hms-body').querySelectorAll('[data-hms-del]').forEach(b=>b.onclick=()=>del(module,b.dataset.hmsDel));
      $('#hms-body').querySelectorAll('[data-hms-approve]').forEach(b=>b.onclick=()=>decideApproval(b.dataset.hmsApprove,'Onaylandı'));
      $('#hms-body').querySelectorAll('[data-hms-reject]').forEach(b=>b.onclick=()=>decideApproval(b.dataset.hmsReject,'Reddedildi'));
    };
    const debouncedPaint=()=>{clearTimeout(window.__hmsT);window.__hmsT=setTimeout(paint,180);};
    $('#hms-q').oninput=()=>{f.q=$('#hms-q').value;debouncedPaint();};
    document.querySelectorAll('[data-hms-fcol]').forEach(el=>{el.oninput=()=>{f.cols[el.dataset.hmsFcol]=el.value;debouncedPaint();};});
    document.querySelectorAll('[data-hms-fclear]').forEach(b=>b.onclick=()=>{f.cols[b.dataset.hmsFclear]='';const el=document.querySelector(`[data-hms-fcol="${b.dataset.hmsFclear}"]`);if(el)el.value='';paint();});
    if($('#hms-add'))$('#hms-add').onclick=()=>openEditor(module,null);
    if($('#hms-refresh'))$('#hms-refresh').onclick=()=>{delete cache[dataModule];renderTable(module);};
    if($('#staff-detail-btn'))$('#staff-detail-btn').onclick=async()=>{
      const row=(cache.staff_status||[]).find(r=>String(r.id)===String(staffSelectedId));
      if(!row)return toast('Önce listeden bir çalışan seçin');
      await loadPeople();
      openStaffHistoryModal(row);
    };
    paint();
  }

  const TRASH_SVG='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/></svg>';
  function rowActions(module,row){
    if(module==='lost_approvals')
      return canWrite(module)?`<button class="btn ghost" data-hms-approve="${row.id}">Onayla</button><button class="btn ghost danger-text" data-hms-reject="${row.id}">Reddet</button>`:'';
    let html='';
    // Ziyaretçi çıkış yaptıktan sonra buton pasif "Çıkış Yaptı" etiketine döner — tekrar
    // "İçeride"ye alınamaz; yeni bir ziyaret "+ Yeni" ile ayrı kayıt olarak açılır
    // (kullanıcı isteği 2026-09).
    if(module==='visitors'&&canWrite(module))
      html+=row.status==='Çıkış Yaptı'
        ?`<button class="btn ghost" disabled title="Bu ziyaretçi çıkış yaptı">Çıkış Yaptı</button>`
        :`<button class="btn ghost" data-hms-toggle="${row.id}">Çıkış</button>`;
    // Mavi zemin/beyaz yazı (kullanıcı isteği 2026-09) için ayrı sınıf.
    if(module==='staff_status'&&canWrite(module))
      html+=`<button class="btn ghost hms-staff-toggle" data-hms-toggle="${row.id}">${row.status==='İçeride'?'Çıkış':'Giriş'}</button>`;
    // Araç Takipleri: araç dışarıdaysa (Çıkış Yaptı) "Giriş Yap" — küçük, yalnız dönüş km/tarih
    // formu açar; içerideyse "Çıkış Yap" — Yeni Kayıt formunu bu aracın plakası önceden seçili
    // olarak açar (kullanıcı isteği 2026-09).
    if(module==='vehicles'&&canWrite(module))
      html+=`<button class="btn ghost" data-hms-vehaction="${row.id}">${row.status==='Çıkış Yaptı'?'Giriş Yap':'Çıkış Yap'}</button>`;
    // Araç Takipleri: tabloda yalnızca en son kayıt göründüğünden, önceki tüm çıkış/dönüş
    // kayıtları "Detay" penceresinde listelenir (Çalışan Takip'teki gibi, kullanıcı isteği 2026-09).
    if(module==='vehicles')
      html+=`<button class="btn ghost" data-hms-vehdetail="${row.id}">▤ Detay</button>`;
    // Araç Takipleri: silme yalnızca Sistem yöneticisinde (canDelete zaten 'full' seviyeyi
    // gerektirir); diğer Güvenlik sekmelerinde (Ziyaretçiler/Çalışan Takip/Filo) değişmedi.
    if(canDelete(module)&&(!GUV_TABS.includes(module)||module==='vehicles'))
      html+=(module==='lost_items'||module==='lost_delivered')
        ? `<button class="lf-trash" data-hms-del="${row.id}" title="Sil" aria-label="Sil">${TRASH_SVG}</button>`
        : `<button class="btn ghost danger-text" data-hms-del="${row.id}">Sil</button>`;
    return html;
  }

  async function toggleStatus(module,id){
    const row=(cache[module]||[]).find(r=>String(r.id)===String(id));if(!row)return;
    // Çalışan Takip: sunucu tarafında saat + geçmiş (history) ile birlikte işlenen ayrı
    // bir uç kullanılır — her giriş/çıkış loglarda tutulsun diye (kullanıcı isteği 2026-09).
    if(module==='staff_status'){
      try{
        const updated=await api(`/api/hms/staff_status/${id}/toggle`,{method:'POST'});
        Object.assign(row,updated);renderTable(module);toast('Durum güncellendi');
      }catch(err){toast(err.message)}
      return;
    }
    const entering=row.status!=='İçeride';
    const status=entering?'İçeride':'Çıkış Yaptı';
    const now=new Date().toLocaleString('tr-TR');
    const exit=entering?'—':now;
    const patch={status,exit};
    try{await api(`/api/hms/${module}/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
      Object.assign(row,patch);renderTable(module);toast('Durum güncellendi');
    }catch(err){toast(err.message)}
  }
  function staffHistory(row){
    if(Array.isArray(row.history)&&row.history.length)return row.history;
    const h=[];
    if(row.entry&&row.entry!=='—')h.push({type:'Giriş',time:row.entry});
    if(row.exit&&row.exit!=='—')h.push({type:'Çıkış',time:row.exit});
    return h;
  }
  // "DD.MM.YYYY HH:MM:SS" metnini Date'e çevirir (süre hesabı için)
  function parseTRDateTime(str){
    const m=String(str||'').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if(!m)return null;
    const [,d,mo,y,h,mi,s]=m;
    return new Date(Number(y),Number(mo)-1,Number(d),Number(h),Number(mi),Number(s||0));
  }
  const trDateKey=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  const hmOf=str=>{const t=String(str||'').split(' ')[1]||'';return t.slice(0,5)||'—';};
  function staffDuration(inStr,outStr){
    const a=parseTRDateTime(inStr),b=parseTRDateTime(outStr);
    if(!a||!b)return '—';
    let mins=Math.round((b-a)/60000);if(mins<0)mins+=24*60;
    return `${Math.floor(mins/60)} sa ${mins%60} dk`;
  }
  // Giriş/Çıkış olaylarını ardışık oturumlara (bir günlük mesai) ayırır
  function staffSessions(row){
    const hist=staffHistory(row);
    const sessions=[];
    for(let i=0;i<hist.length;i++){
      const ev=hist[i];if(ev.type!=='Giriş')continue;
      const next=hist[i+1];
      if(next&&next.type==='Çıkış'){sessions.push({dateKey:String(ev.time).split(' ')[0],inTime:ev.time,outTime:next.time});i++;}
      else sessions.push({dateKey:String(ev.time).split(' ')[0],inTime:ev.time,outTime:null});
    }
    return sessions;
  }
  const STAFF_HISTORY_DAYS=30;
  // Son N takvim gününü (bugün dahil) döndürür. Bir günde birden fazla giriş/çıkış
  // oturumu varsa (aynı gün birkaç kez giriş-çıkış yapılmışsa) hepsi ayrı satır olarak
  // gösterilir — tek oturuma indirgenip kaybolmasın diye (kullanıcı isteği 2026-09:
  // her giriş/çıkış kaydı görünsün). Kayıt yoksa tek "Gelmedi" satırı.
  function staffDailyRows(row,days){
    const byDate=new Map();
    staffSessions(row).forEach(s=>{
      const list=byDate.get(s.dateKey)||[];
      list.push(s);
      byDate.set(s.dateKey,list);
    });
    const today=new Date();
    const out=[];
    for(let i=0;i<days;i++){
      const d=new Date(today.getFullYear(),today.getMonth(),today.getDate()-i);
      const key=trDateKey(d);
      const sessions=byDate.get(key);
      if(sessions&&sessions.length)sessions.forEach(session=>out.push({dateKey:key,session}));
      else out.push({dateKey:key,session:null});
    }
    return out;
  }
  function staffHistoryRowHtml(r){
    let giris='—',cikis='—',sure,badgeText,badgeClass;
    if(!r.session){sure='Gelmedi';badgeText='Gelmedi';badgeClass='red';}
    else{
      giris=hmOf(r.session.inTime);
      if(r.session.outTime){cikis=hmOf(r.session.outTime);sure=staffDuration(r.session.inTime,r.session.outTime);badgeText='Çıkış Yaptı';badgeClass='green';}
      else{cikis='Henüz çıkış yapmadı';sure='Devam ediyor';badgeText='İçeride';badgeClass='orange';}
    }
    return `<tr><td>${esc(r.dateKey)}</td><td>${esc(giris)}</td><td>${esc(cikis)}</td><td>${esc(sure)}</td><td><span class="badge ${badgeClass}">${esc(badgeText)}</span></td></tr>`;
  }
  function staffInitials(name){
    const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!parts.length)return '—';
    return (parts[0][0]+(parts.length>1?parts[parts.length-1][0]:'')).toLocaleUpperCase('tr-TR');
  }
  // Çalışan Takip satırına tıklayınca kişinin özlük kayıt detayları da görünsün
  // (kullanıcı isteği 2026-09) — employeeId ile state.employees'teki tam kayıt eşlenir.
  function staffEmployeeRecord(row){
    if(!row)return null;
    const list=peopleSrc();
    if(row.employeeId){
      const byId=list.find(e=>e.id!=null&&String(e.id)===String(row.employeeId));
      if(byId)return byId;
    }
    if(row.name){
      const target=String(row.name).trim().toLocaleLowerCase('tr-TR');
      const byName=list.find(e=>String(e.name||'').trim().toLocaleLowerCase('tr-TR')===target);
      if(byName)return byName;
    }
    return null;
  }
  function staffDetailField(label,value){
    return value?`<div><span class="muted" style="display:block;font-size:11px">${esc(label)}</span><strong style="font-size:13px">${esc(value)}</strong></div>`:'';
  }
  function openStaffHistoryModal(row){
    if(!row)return;
    const rows=staffDailyRows(row,STAFF_HISTORY_DAYS);
    const emp=staffEmployeeRecord(row);
    const detailBlock=emp?`<div class="formula" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:14px 0">
        ${staffDetailField('Sicil',emp.payroll_sicil)}
        ${staffDetailField('Departman',emp.department)}
        ${staffDetailField('Görev',emp.title)}
        ${staffDetailField('Telefon',emp.phone)}
        ${staffDetailField('E-posta',emp.email)}
        ${staffDetailField('İşe Giriş',emp.start_date?new Date(emp.start_date).toLocaleDateString('tr-TR'):'')}
        ${staffDetailField('Durum',emp.status)}
      </div>`:'';
    const body=`<div class="lf-body">
      <div class="staff-hist-head">
        <span class="staff-hist-avatar">${esc(staffInitials(row.name))}</span>
        <div class="staff-hist-who"><strong>${esc(row.name||'—')}</strong><span class="muted">${esc(row.title||'—')}${row.department?' · '+esc(row.department):''}</span></div>
        <span class="staff-hist-days muted">${STAFF_HISTORY_DAYS} günlük kayıt</span>
      </div>
      ${detailBlock}
      <div style="overflow:auto"><table class="hms-table staff-hist-table"><thead><tr><th>Tarih</th><th>Giriş Saati</th><th>Çıkış Saati</th><th>Çalışma Süresi</th><th>Durum</th></tr></thead><tbody>
        ${rows.map(staffHistoryRowHtml).join('')}
      </tbody></table></div>
    </div>`;
    modal('Çalışan Giriş/Çıkış Geçmişi',body,()=>closeModal());
    const mdl=document.querySelector('.modal');
    if(mdl){
      mdl.classList.add('lf-modal');
      const actions=mdl.querySelector('.modal-actions');if(actions)actions.style.justifyContent='flex-end';
      const sub=mdl.querySelector('.modal-actions .submit');if(sub)sub.style.display='none';
      const ccl=mdl.querySelector('.modal-actions .close-action');if(ccl)ccl.textContent='× Kapat';
    }
  }
  async function del(module,id){
    if(!confirm('Bu kaydı silmek istediğinize emin misiniz?'))return;
    const dm=module==='lost_delivered'?'lost_items':module;
    try{await api(`/api/hms/${dm}/${id}`,{method:'DELETE'});
      cache[dm]=(cache[dm]||[]).filter(r=>String(r.id)!==String(id));renderTable(tab);toast('Kayıt silindi');
    }catch(err){toast(err.message)}
  }
  async function decideApproval(id,decision){
    if(decision==='Reddedildi'&&!confirm('Transfer reddedilsin mi? Eşya gönderen departmanda kalır.'))return;
    try{await api(`/api/hms/lost-approvals/${id}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision})});
      delete cache.lost_approvals;delete cache.lost_items;renderTable('lost_approvals');
      toast(decision==='Onaylandı'?'Transfer onaylandı':'Transfer reddedildi');
    }catch(err){toast(err.message)}
  }

  // --- Kayıt ekle/düzenle modalı -------------------------------------
  const empNames=()=>[...new Set(peopleSrc().map(e=>e.name).filter(Boolean))].sort(trSort);
  // Yalnızca Çalışanlar ekranında "Şoför" işaretlenmiş personel (Sürücü önerisi için)
  const driverNames=()=>[...new Set(peopleSrc().filter(e=>e.is_driver).map(e=>e.name).filter(Boolean))].sort(trSort);
  async function openEditor(module,row,preset){
    const editing=Boolean(row);
    const pre=preset||{};
    const isLost=module==='lost_items';
    await loadPeople();
    // Araç/ziyaretçi formu için yardımcı listeler (HMS ile aynı davranış)
    if(module==='vehicles'){try{await load('fleet');}catch(_){}}
    if(module==='visitors'){try{await load('visitors');}catch(_){}}
    const fleetRows=(cache.fleet||[]).filter(v=>v.disabled!=='Evet');
    const visitorRows=cache.visitors||[];
    // Yeni kayıp eşya kaydında "Onay Durumu" alanı gizli (HMS ile aynı) — onay yalnızca transferde.
    // Yeni araç çıkışında Dönüş Tarihi/Dönüş Km/Durum alanları da gizli — araç henüz dönmedi,
    // durum zaten "Çıkış Yaptı" olarak sabit; dönüş bilgisi "Giriş Yap" ile ayrıca girilir
    // (kullanıcı isteği 2026-09).
    const cfg=fields[module]().filter(([k])=>!(isLost&&!editing&&k==='approval')&&!(module==='vehicles'&&!editing&&(k==='returnDate'||k==='returnKm'||k==='status'))&&!(module==='visitors'&&!editing&&k==='status'));
    const myDept=normDept((window.__ikCurrentUser&&window.__ikCurrentUser()?.department)||window.__ikAuthUser?.department||'');
    // Çalışan Takip'te var olan bir kaydı düzenlerken, Sistem yöneticisi dışındaki
    // kullanıcılar (Güvenlik vb.) yalnızca Giriş/Çıkış saatini değiştirebilir — diğer
    // özlük alanları salt okunur gösterilir (kullanıcı isteği 2026-09). Sunucu tarafında
    // da aynı kısıt uygulanır; burası yalnızca arayüzü buna göre gösterir.
    const staffTimeOnly=editing&&module==='staff_status'&&permFor(module)!=='full';
    const inputFor=([key,label,type,opts])=>{
      let val=row?row[key]:(pre[key]??'');
      if(!editing&&(key==='date'||key==='departure'||key==='foundDate'||key==='entry'))val=nowInput();
      if(isLost&&!editing&&key==='storage')val=myDept||'';
      const wideKey=(key==='notes'||key==='destination'||key==='fault');
      const wide=isLost?(key==='notes'?' class="field lf-wide"':' class="field"'):(wideKey?' class="field" style="grid-column:1/-1"':' class="field"');
      const lockFound=isLost&&key==='foundDate';
      if(staffTimeOnly&&key!=='entry'&&key!=='exit'){
        const shown=type==='datetime-local'?(toInput(val)?new Date(toInput(val)).toLocaleString('tr-TR'):val):val;
        return `<div${wide}><label>${label}</label><input class="input lf-ro" name="${key}" value="${esc(shown)}" readonly title="Yalnızca Sistem yöneticisi düzenleyebilir"></div>`;
      }
      let ctrl;
      // --- HMS'e özel alanlar ---
      if(module==='vehicles'&&key==='plate'){
        ctrl=`<select class="select" name="plate" id="veh-plate"><option value="" ${!val?'selected':''} disabled>Araç seçin</option>${fleetRows.map(v=>`<option value="${esc(v.plate)}" ${String(val)===String(v.plate)?'selected':''}>${esc(v.plate)} · ${esc(v.brand||'')} ${esc(v.model||'')}</option>`).join('')}</select>
          <input type="hidden" name="brand" id="veh-brand" value="${esc(row?.brand||'')}"><input type="hidden" name="model" id="veh-model" value="${esc(row?.model||'')}">`;
      }
      else if(module==='vehicles'&&key==='km'){
        ctrl=`<input class="input" type="number" name="km" id="veh-km" value="${esc(val)}" readonly title="Son dönüş kilometresinden otomatik alınır"><small class="muted" id="veh-km-hint" style="display:block;font-size:11px"></small>`;
      }
      else if(module==='vehicles'&&key==='driver'){
        ctrl=`<input class="input" name="driver" list="veh-drivers" value="${esc(val)}" placeholder="Şoför seçin veya yazın">`;
      }
      else if(module==='vehicles'&&key==='requester'){
        ctrl=`<input class="input" name="requester" list="veh-people" value="${esc(val)}" placeholder="Kişi seçin veya yazın">`;
      }
      else if(module==='vehicles'&&key==='departure'){
        const dv=editing?toInput(val):nowInput();
        ctrl=`<input class="input" type="datetime-local" name="departure" value="${esc(dv)}" readonly title="Sistem tarafından otomatik belirlenir; değiştirilemez">`;
      }
      else if(module==='visitors'&&key==='date'){
        const dv=editing?toInput(val):nowInput();
        ctrl=`<input class="input" type="datetime-local" name="date" value="${esc(dv)}" readonly title="Sistem tarafından otomatik belirlenir; değiştirilemez">`;
      }
      else if(module==='visitors'&&key==='exit'){
        ctrl=`<input class="input" type="datetime-local" name="exit" value="${esc(toInput(val))}" readonly title="Çıkış yapıldığında sistem tarafından otomatik belirlenir; değiştirilemez">`;
      }
      else if(module==='visitors'&&key==='name'){
        // Aşağı açılır bir "liste" değil — yazarken eşleşen önceki ziyaretçi adları anlık
        // filtrelenip küçük bir öneri kutusunda gösterilir (bindVisitorEditor). Personel
        // kaydından bağımsız, tamamen elle girilip serbestçe kaydedilir (kullanıcı isteği 2026-09).
        ctrl=`<div class="cb-wrap"><input class="input" name="name" id="vis-name" value="${esc(val)}" autocomplete="off"></div><small class="muted" style="display:block;font-size:11px">Yazdıkça eşleşen önceki ziyaretçiler altta önerilir.</small>`;
      }
      else if(module==='visitors'&&key==='company'){
        ctrl=`<div class="cb-wrap"><input class="input" name="company" id="vis-company" value="${esc(val)}" autocomplete="off"></div>`;
      }
      else if(isLost&&key==='status'&&!editing){
        // Yeni kayıtta durum otomatik "Beklemede" ve değiştirilemez
        ctrl=`<input class="input lf-ro lf-ro-strong" name="status" value="Beklemede" readonly title="Yeni kayıtta durum otomatik olarak Beklemede'dir">`;
      }
      else if(isLost&&key==='receiver'){
        // Teslim Alan: eşyanın bulunduğu (yeni kayıtta: giriş yapan) departmanın personeli — yazarak ara/seç
        const dep=row?.storage||myDept;
        const people=dep?deptEmployees(dep):[];
        ctrl=`<input class="input" name="receiver" value="${esc(val)}" list="lf-receivers" autocomplete="off" placeholder="${esc(dep||'Teslim alan')} — listeden seçin veya yazarak arayın"><datalist id="lf-receivers">${people.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>${dep&&!people.length?`<small class="muted" style="display:block;font-size:11px">${esc(dep)} için kayıtlı personel bulunamadı; elle yazabilirsiniz</small>`:''}`;
      }
      else if(type==='select')ctrl=`<select class="select" name="${key}">${['',...opts].map(o=>`<option ${String(val)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
      else if(type==='textarea')ctrl=`<textarea class="input" name="${key}">${esc(val)}</textarea>`;
      else if(type==='datetime-local')ctrl=`<input class="input${lockFound?' lf-ro':''}" type="datetime-local" name="${key}" value="${esc(toInput(val)||(!editing?val:''))}" ${lockFound?'readonly title="Sistem tarafından otomatik belirlenir"':''}>`;
      else if(type==='number')ctrl=`<input class="input" type="number" name="${key}" value="${esc(val)}">`;
      else if(isLost&&key==='storage')ctrl=`<input class="input lf-ro lf-ro-strong" name="storage" value="${esc(val)}" readonly title="Departmanınızdan otomatik belirlenir">`;
      else ctrl=`<input class="input" name="${key}" value="${esc(val)}">`;
      return `<div${wide}><label>${label}</label>${ctrl}</div>`;
    };
    // Ziyaretçi İsim/Firma artık native <datalist> (tıklayınca tüm liste açılan) yerine
    // bindVisitorEditor'daki özel, yazarken filtrelenen küçük öneri kutusunu kullanıyor
    // (kullanıcı isteği 2026-09) — burada yalnızca Araç Takipleri'nin datalist'leri kalır.
    const dataLists=module==='vehicles'?`<datalist id="veh-people">${empNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist><datalist id="veh-drivers">${driverNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`:'';
    const imageCol=`<div class="lf-image"><span>Resim</span><label class="lf-drop" id="lf-drop">${row?.image?`<img src="${esc(row.image)}" alt="">`:`<span class="lf-hatch"></span>Fotoğraf seç`}<input type="file" accept="image/*" id="hms-image"></label></div>`;
    const transferBlock=(isLost&&editing)?transferPanel(row):'';
    const formInner=cfg.map(inputFor).join('');
    const bodyHtml=isLost
      ? `<div class="lf-body"><div class="lf-grid">${formInner}${imageCol}</div>${dataLists}</div>${transferBlock}`
      : `<div class="form-grid">${formInner}</div>${dataLists}`;
    modal(isLost?`Kayıp/Bulunan Eşyalar - ${editing?row.id:'Yeni'}`:(editing?'Kaydı düzenle':'Yeni kayıt'),
      bodyHtml,
      async()=>{
        const box=document.querySelector('.modal');
        const payload={};
        cfg.forEach(([key,,type])=>{
          let v=box.querySelector(`[name="${key}"]`)?.value??'';
          if(type==='datetime-local')v=fromInput(v);
          payload[key]=v;
        });
        if(module==='vehicles'){
          payload.brand=box.querySelector('#veh-brand')?.value||'';
          payload.model=box.querySelector('#veh-model')?.value||'';
          payload.km=box.querySelector('#veh-km')?.value||'';
          // Durum alanı yeni kayıtta forma hiç konmuyor — yeni bir çıkış her zaman
          // "Çıkış Yaptı" olarak başlar (kullanıcı isteği 2026-09).
          if(!editing)payload.status='Çıkış Yaptı';
          const missing=[];
          if(!String(payload.driver||'').trim())missing.push('Sürücü');
          if(!String(payload.requester||'').trim())missing.push('Talep Eden');
          if(!String(payload.destination||'').trim())missing.push('Gideceği Yer');
          if(!String(payload.km||'').trim())missing.push('Km');
          if(missing.length)return toast(`Eksik alanlar: ${missing.join(', ')} — kayıt yapılamaz.`);
        }
        if(isLost&&!editing)delete payload.storage;
        if(module==='staff_status'&&!editing){
          if(payload.status==='İçeride')payload.history=[{type:'Giriş',time:payload.entry||new Date().toLocaleString('tr-TR')}];
          else if(payload.status==='Çıkış Yaptı')payload.history=[{type:'Çıkış',time:payload.exit||new Date().toLocaleString('tr-TR')}];
        }
        const img=box.querySelector('#hms-image')?.files?.[0];
        const send=async(extra)=>{
          const finalPayload={...payload,...extra};
          try{
            const saved=editing
              ? await api(`/api/hms/${module}/${row.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(finalPayload)})
              : await api(`/api/hms/${module}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(finalPayload)});
            const list=cache[module]||(cache[module]=[]);
            const idx=list.findIndex(r=>String(r.id)===String(saved.id));
            if(idx>=0)list[idx]=saved;else list.unshift(saved);
            closeModal();renderTable(tab);toast(editing?'Kayıt güncellendi':'Kayıt oluşturuldu');
          }catch(err){toast(err.message)}
        };
        if(img){
          if(img.size>600*1024)return toast('Resim en fazla 600 KB olabilir');
          const reader=new FileReader();reader.onload=()=>send({image:reader.result});reader.readAsDataURL(img);
        }else send({});
      });
    if(isLost&&editing&&canWrite('lost_items'))bindTransfer(row);
    if(module==='vehicles')bindVehicleEditor(row,fleetRows,editing);
    if(module==='visitors')bindVisitorEditor(visitorRows,editing);
    if(isLost){
      const mdl=document.querySelector('.modal');
      if(mdl){
        mdl.classList.add('lf-modal');
        const head=mdl.querySelector('.modal-head');
        if(head&&!head.querySelector('.lf-role')){
          const b=document.createElement('span');b.className='lf-role';
          b.textContent=canWrite('lost_items')?'Yönetici · Düzenleme':'Salt okunur';
          head.querySelector('.close').before(b);
        }
        const sub=mdl.querySelector('.modal-actions .submit');if(sub)sub.textContent='▣ Kaydet';
        const ccl=mdl.querySelector('.modal-actions .close-action');if(ccl)ccl.textContent='× Vazgeç';
        // Transfer onayı bekleyen eşya: Sistem yöneticisi dışında tüm form kilitli
        const locked=editing&&row&&row.transferStatus==='Beklemede'&&!canDelete('lost_items');
        if(locked){
          mdl.querySelectorAll('.lf-body input,.lf-body select,.lf-body textarea,#hms-image,#tr-status,#tr-sender,#tr-target,#tr-receiver,#tr-send').forEach(el=>{el.disabled=true;});
          if(sub)sub.style.display='none';
          const lb=document.createElement('div');lb.className='lf-locked';
          lb.textContent=`Bu eşya "${row.targetDepartment||'—'}" departmanının onayını bekliyor; onay ya da ret verilene kadar üzerinde işlem yapılamaz.`;
          mdl.querySelector('.lf-body').prepend(lb);
        }
        const drop=mdl.querySelector('#lf-drop'),fileInput=mdl.querySelector('#hms-image');
        if(fileInput&&drop)fileInput.onchange=()=>{
          const f=fileInput.files?.[0];if(!f)return;
          const rd=new FileReader();
          rd.onload=()=>{
            drop.querySelectorAll('img,.lf-hatch').forEach(e=>e.remove());
            [...drop.childNodes].forEach(n=>{if(n.nodeType===3)n.remove();});
            const im=document.createElement('img');im.src=rd.result;drop.prepend(im);
          };
          rd.readAsDataURL(f);
        };
      }
    }
  }
  function bindVehicleEditor(row,fleetRows,editing){
    const box=document.querySelector('.modal');if(!box)return;
    const plate=box.querySelector('#veh-plate'),brand=box.querySelector('#veh-brand'),model=box.querySelector('#veh-model');
    const km=box.querySelector('#veh-km'),hint=box.querySelector('#veh-km-hint'),status=box.querySelector('[name="status"]'),retKm=box.querySelector('[name="returnKm"]');
    const norm=p=>String(p||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
    const applyPlate=()=>{
      const f=fleetRows.find(v=>norm(v.plate)===norm(plate&&plate.value));
      if(f){if(brand)brand.value=f.brand||'';if(model)model.value=f.model||'';}
      if(editing)return; // düzenlemede km korunur (HMS ile aynı)
      const trips=(cache.vehicles||[]).filter(v=>norm(v.plate)===norm(plate&&plate.value))
        .sort((a,b)=>Number(b.id)-Number(a.id))
        .find(v=>v.returnKm&&v.returnKm!=='—'&&Number.isFinite(Number(v.returnKm))&&Number(v.returnKm)>0);
      if(trips){if(km){km.value=trips.returnKm;km.readOnly=true;}if(hint)hint.textContent=`Son dönüş kilometresi: ${trips.returnKm}`;}
      else if(f&&(f.lastKm||f.startKm)&&String(f.lastKm||f.startKm)!=='—'){if(km){km.value=f.lastKm||f.startKm;km.readOnly=true;}if(hint)hint.textContent=`Kayıtlı son kilometre: ${f.lastKm||f.startKm}`;}
      else{if(km){km.value='';km.readOnly=false;}if(hint)hint.textContent='Bu araç için kayıtlı kilometre bulunamadı; başlangıç km değerini elle girin.';}
    };
    if(plate){plate.onchange=applyPlate;if(plate.value)applyPlate();}
    if(status)status.onchange=()=>{
      if(!editing||status.value!=='Çıkış Yaptı')return;
      const last=String((retKm&&retKm.value)||row?.returnKm||'');
      if(last&&last!=='—'&&Number.isFinite(Number(last))){
        if(km){km.value=last;km.readOnly=true;}if(retKm)retKm.value='';
        const rd=box.querySelector('[name="returnDate"]');if(rd)rd.value='';
        const dep=box.querySelector('[name="departure"]');if(dep)dep.value=nowInput();
        if(hint)hint.textContent=`Son dönüş kilometresi ${last}, yeni çıkış kilometresine aktarıldı.`;
      }
    };
  }
  // Araç dışarıdayken "Giriş Yap": tam düzenleme formu yerine yalnızca dönüş km'si ve
  // (otomatik, değiştirilemez) dönüş tarihi/saati olan küçük bir form açar (kullanıcı isteği
  // 2026-09). Kaydedince durum "Dönüş Yaptı"ya döner — satırda tekrar "Çıkış Yap" görünür.
  function openVehicleReturnEditor(row){
    const dv=nowInput();
    const body=`<div class="form-grid">
      <div class="field"><label>Dönüş Km</label><input class="input" type="number" id="veh-ret-km" placeholder="Dönüş km" autofocus></div>
      <div class="field"><label>Dönüş Tarihi</label><input class="input" type="datetime-local" value="${esc(dv)}" readonly title="Sistem tarafından otomatik belirlenir; değiştirilemez"></div>
    </div>`;
    modal(`Araç Dönüşü — ${esc(row.plate)}`,body,async()=>{
      const box=document.querySelector('.modal');
      const returnKm=box.querySelector('#veh-ret-km')?.value||'';
      if(!String(returnKm).trim())return toast('Dönüş km girin');
      const patch={returnKm,returnDate:fromInput(dv),status:'Dönüş Yaptı'};
      try{
        const saved=await api(`/api/hms/vehicles/${row.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patch)});
        const list=cache.vehicles||(cache.vehicles=[]);
        const idx=list.findIndex(r=>String(r.id)===String(saved.id));
        if(idx>=0)list[idx]=saved;
        closeModal();renderTable(tab);toast('Araç dönüşü kaydedildi');
      }catch(err){toast(err.message)}
    });
  }
  // Bir plakanın tüm çıkış/dönüş kayıtları (en yeni önce) — "Detay" penceresinde gösterilir.
  function vehicleTrips(plate){
    const key=String(plate||'').trim().toLocaleUpperCase('tr-TR');
    return (cache.vehicles||[]).filter(v=>String(v.plate||'').trim().toLocaleUpperCase('tr-TR')===key)
      .sort((a,b)=>Number(b.id)-Number(a.id));
  }
  function vehicleTripStatusBadge(status){
    if(status==='Çıkış Yaptı')return '<span class="badge orange">Dışarıda</span>';
    if(status==='Dönüş Yaptı')return '<span class="badge green">Döndü</span>';
    return `<span class="badge">${esc(status||'—')}</span>`;
  }
  function vehicleTripRowHtml(r){
    return `<tr>
      <td>${esc(r.departure&&r.departure!=='—'?r.departure:'—')}</td>
      <td>${esc(r.km??'—')}</td>
      <td>${esc(r.returnDate&&r.returnDate!=='—'?r.returnDate:'—')}</td>
      <td>${esc(r.returnKm??'—')}</td>
      <td>${esc(r.driver||'—')}</td>
      <td>${esc(r.requester||'—')}</td>
      <td>${esc(r.destination||'—')}</td>
      <td>${esc(r.fault==='Var'?'Var':'—')}</td>
      <td>${vehicleTripStatusBadge(r.status)}</td>
    </tr>`;
  }
  // Araç çıkış/giriş yaptıkça (yeni kayıt veya dönüş) her araç kendi geçmişini burada biriktirir
  // (Çalışan Takip'teki gibi, kullanıcı isteği 2026-09) — ayrı bir tablo/alan gerekmez, çünkü her
  // çıkış zaten kendi kaydını oluşturuyor; bu pencere o kayıtları plakaya göre listeler.
  function openVehicleHistoryModal(row){
    if(!row)return;
    const trips=vehicleTrips(row.plate);
    const body=`<div class="lf-body">
      <div class="staff-hist-head">
        <span class="staff-hist-avatar">${esc(String(row.plate||'—').replace(/\s+/g,'').slice(0,3))}</span>
        <div class="staff-hist-who"><strong>${esc(row.plate||'—')}</strong><span class="muted">${esc(row.brand||'')} ${esc(row.model||'')}</span></div>
        <span class="staff-hist-days muted">${trips.length} kayıt</span>
      </div>
      <div style="overflow:auto"><table class="hms-table staff-hist-table"><thead><tr>
        <th>Çıkış Tarihi</th><th>Çıkış Km</th><th>Dönüş Tarihi</th><th>Dönüş Km</th><th>Şoför</th><th>Talep Eden</th><th>Gideceği Yer</th><th>Hata</th><th>Durum</th>
      </tr></thead><tbody>
        ${trips.map(vehicleTripRowHtml).join('')||'<tr><td colspan="9" class="empty">Kayıt bulunamadı</td></tr>'}
      </tbody></table></div>
    </div>`;
    modal(`Araç Geçmişi — ${esc(row.plate||'')}`,body,()=>closeModal());
    const mdl=document.querySelector('.modal');
    if(mdl){
      mdl.classList.add('lf-modal');
      const actions=mdl.querySelector('.modal-actions');if(actions)actions.style.justifyContent='flex-end';
      const sub=mdl.querySelector('.modal-actions .submit');if(sub)sub.style.display='none';
      const ccl=mdl.querySelector('.modal-actions .close-action');if(ccl)ccl.textContent='× Kapat';
    }
  }
  // Native <datalist>, alan tıklanır tıklanmaz (yazmadan) TÜM listeyi açan bir açılır pencere
  // gibi görünüyordu — bunun yerine hiçbir şey yazılmadığında tamamen gizli kalan, yazarken
  // eşleşenleri filtreleyip altta küçük bir kutuda gösteren kendi öneri bileşenimiz. Seçim
  // yapmak zorunlu değil — serbest metin olarak da kaydedilebilir (kullanıcı isteği 2026-09).
  function bindSuggest(input,options){
    if(!input)return;
    const wrap=input.closest('.cb-wrap')||input.parentNode;
    const norm=s=>String(s||'').toLocaleLowerCase('tr-TR');
    const menu=document.createElement('div');
    menu.className='cb-menu';menu.hidden=true;
    wrap.appendChild(menu);
    const render=()=>{
      const q=norm(input.value.trim());
      if(!q){menu.hidden=true;menu.innerHTML='';return;}
      const matches=options.filter(o=>norm(o).includes(q)&&norm(o)!==q).slice(0,8);
      if(!matches.length){menu.hidden=true;menu.innerHTML='';return;}
      menu.innerHTML=matches.map(m=>`<div class="cb-opt">${esc(m)}</div>`).join('');
      menu.hidden=false;
    };
    input.addEventListener('input',render);
    input.addEventListener('blur',()=>setTimeout(()=>{menu.hidden=true;},150));
    menu.addEventListener('mousedown',e=>{
      const opt=e.target.closest('.cb-opt');if(!opt)return;
      e.preventDefault();
      input.value=opt.textContent;
      menu.hidden=true;
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
  }
  function bindVisitorEditor(visitorRows,editing){
    const box=document.querySelector('.modal');if(!box)return;
    const name=box.querySelector('#vis-name'),company=box.querySelector('#vis-company');
    bindSuggest(name,[...new Set(visitorRows.map(v=>String(v.name||'').trim()).filter(Boolean))].sort(trSort));
    bindSuggest(company,[...new Set(visitorRows.map(v=>String(v.company||'').trim()).filter(Boolean))].sort(trSort));
    if(name)name.addEventListener('input',()=>{
      const key=name.value.trim().toLocaleLowerCase('tr-TR');if(!key)return;
      const prev=[...visitorRows].sort((a,b)=>Number(b.id)-Number(a.id)).find(v=>String(v.name||'').toLocaleLowerCase('tr-TR')===key);
      if(prev&&prev.company&&company)company.value=prev.company;
    });
    // Yeni kayıtta plaka girilince önceki kayıtlarla eşleşen bilgiler (isim, firma, kimlik
    // tipi) otomatik doldurulur; alanlar kilitlenmez, elle değiştirilebilir (kullanıcı isteği 2026-09).
    const plate=box.querySelector('[name="plate"]'),identity=box.querySelector('[name="identity"]');
    const normPlate=p=>String(p||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,'');
    if(plate&&!editing)plate.addEventListener('input',()=>{
      const key=normPlate(plate.value);if(!key)return;
      const prev=[...visitorRows].sort((a,b)=>Number(b.id)-Number(a.id)).find(v=>normPlate(v.plate)===key);
      if(!prev)return;
      if(prev.name&&name)name.value=prev.name;
      if(prev.company&&company)company.value=prev.company;
      if(prev.identity&&identity)identity.value=prev.identity;
    });
    // Çıkış tarihi: durum "Çıkış Yaptı"ya çevrildiğinde otomatik ve değiştirilemez olarak şimdi atanır;
    // "İçeride"ye geri alınırsa temizlenir (kullanıcı isteği 2026-09).
    const status=box.querySelector('[name="status"]'),exit=box.querySelector('[name="exit"]');
    if(status&&exit)status.onchange=()=>{
      exit.value=status.value==='Çıkış Yaptı'?nowInput():'';
    };
  }

  // --- Kayıp eşya transfer paneli (HMS görünümü) -------------------
  const TR_STATUSES=['Beklemede','Saklama Sonu','Teslim Edildi','Reddedildi'];
  function movementsTable(row){
    const hist=Array.isArray(row.history)&&row.history.length?row.history
      :[{processDate:row.processDate,transferStatus:row.transferStatus||row.status,transferSender:row.transferSender,transferReceiver:row.transferReceiver,targetDepartment:row.targetDepartment,storage:row.storage}];
    // Sil yalnızca Sistem yöneticisinde, yalnız son harekette, ilk kayıt hariç
    const canDelLast=canDelete('lost_items')&&Array.isArray(row.history)&&row.history.length>1;
    return `<div style="overflow:auto"><table class="lf-mov"><thead><tr><th>İşlem Tarihi</th><th>Durum</th><th>Teslim Eden</th><th>Teslim Alan</th><th>Saklandığı Yer</th><th>Eylem</th></tr></thead><tbody>
      ${hist.map((m,i)=>`<tr><td>${esc(m.processDate||'—')}</td><td>${esc(m.transferStatus||m.status||'—')}</td><td>${esc(m.transferSender||'—')}</td><td>${esc(m.transferReceiver||m.receiver||'—')}</td><td>${esc(m.targetDepartment||m.storage||'—')}</td>
        <td>${canDelLast&&i===hist.length-1?`<button class="lf-mov-del" type="button" id="mov-del">Sil</button>`:'—'}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function transferPanel(row){
    const canEdit=canWrite('lost_items');
    const from=row.storage||row.department||'';
    const pending=row.transferStatus==='Beklemede';
    const targets=HMS_DEPTS.filter(d=>normDept(d)!==normDept(from));
    const senderList=deptEmployees(from);
    const curStatus=row.transferStatus&&row.transferStatus!=='—'?row.transferStatus:(row.status||'Beklemede');
    const form=pending
      ? `<p class="lf-pending"><strong>${esc(row.targetDepartment||'—')}</strong> departmanının onaylaması bekleniyor. Bu eşya üzerinde, hedef departman onay ya da ret verene kadar işlem yapılamaz.</p>`
      : `<div class="lf-trow">
          <div class="field"><label>Durum</label><select class="select" id="tr-status">${TR_STATUSES.map(s=>`<option ${s===curStatus?'selected':''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Teslim Eden</label><input class="input" id="tr-sender" list="tr-sender-list" value="${esc(senderList[0]||'')}" placeholder="Kullanıcı veya personel yazın"><datalist id="tr-sender-list">${senderList.map(n=>`<option value="${esc(n)}">`).join('')}</datalist><span class="lf-hint">Listeden seçebilir veya manuel yazabilirsiniz.</span></div>
          <div class="field"><label>Transfer Departmanı</label><select class="select" id="tr-target"><option value="">— Teslim alacak departmanı seçin —</option>${targets.map(d=>`<option>${esc(d)}</option>`).join('')}</select></div>
          <div class="field lf-combo"><label>Teslim Alan</label><input class="input" id="tr-receiver" autocomplete="off" placeholder="Önce departman seçin"><div class="lf-combo-menu" id="tr-rec-menu" hidden></div><span class="lf-hint">Hedef departmanın personeli listelenir; elle isim de yazabilirsiniz.</span></div>
        </div>
        <div class="field" style="max-width:280px;margin-top:12px"><label>Saklandığı Yer</label><input class="input" id="tr-storage" value="" placeholder="Departman seçilince belirlenir" readonly></div>
        ${canEdit?`<button class="lf-transfer-btn" type="button" id="tr-send">▶▶ Transfer</button><span class="lf-await" id="tr-await" hidden></span>`:''}`;
    return `<div class="transfer-box">
      <div class="lf-band">Transfer</div>
      <div class="lf-section">${form}</div>
      <div class="lf-band">Hareketler</div>
      <div class="lf-section" style="border-bottom:0">${movementsTable(row)}</div>
    </div>`;
  }
  function bindTransfer(row){
    const box=document.querySelector('.modal');
    const targetSel=box.querySelector('#tr-target');
    const storageInput=box.querySelector('#tr-storage');
    const recInput=box.querySelector('#tr-receiver');
    const recMenu=box.querySelector('#tr-rec-menu');
    const norm=s=>String(s||'').toLocaleLowerCase('tr-TR');
    const targetPeople=()=>targetSel&&targetSel.value?deptEmployees(targetSel.value):[];
    const drawMenu=()=>{
      if(!recMenu)return;
      const q=norm(recInput.value);
      const list=targetPeople().filter(n=>!q||norm(n).includes(q));
      recMenu.innerHTML=list.length
        ? list.map(n=>`<button type="button" class="lf-combo-opt">${esc(n)}</button>`).join('')
        : `<span class="lf-combo-empty">${targetSel&&targetSel.value?'Eşleşen personel yok — elle yazabilirsiniz':'Önce transfer departmanını seçin'}</span>`;
    };
    if(recInput&&recMenu){
      recInput.onfocus=()=>{if(!targetSel.value){toast('Önce transfer departmanını seçin');return;}drawMenu();recMenu.hidden=false;};
      recInput.oninput=()=>{drawMenu();recMenu.hidden=false;};
      recInput.onblur=()=>setTimeout(()=>{recMenu.hidden=true;},160);
      recMenu.onmousedown=e=>{const b=e.target.closest('.lf-combo-opt');if(b){e.preventDefault();recInput.value=b.textContent;recMenu.hidden=true;}};
    }
    if(targetSel)targetSel.onchange=()=>{
      if(recInput){recInput.value='';recInput.placeholder=targetSel.value?`${targetSel.value} personeli — seçin veya yazın`:'Önce departman seçin';}
      if(storageInput)storageInput.value=targetSel.value;
      if(recMenu)recMenu.hidden=true;
    };
    const send=box.querySelector('#tr-send');
    if(send)send.onclick=async()=>{
      const target=targetSel.value,sender=box.querySelector('#tr-sender').value.trim(),receiver=recInput.value.trim();
      if(box.querySelector('#tr-status')?.value!=='Beklemede')return toast('Transfer yalnızca durumu "Beklemede" olan eşyalar için yapılabilir');
      if(!target)return toast('Teslim alacak departmanı seçin');
      if(!sender)return toast('Teslim eden zorunludur');
      if(!receiver)return toast('Teslim alan zorunludur');
      send.disabled=true;
      try{
        await api(`/api/hms/lost-items/${row.id}/transfer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetDepartment:target,sender,receiver})});
        // Transfer butonunun altında bekleme ibaresi
        const aw=box.querySelector('#tr-await');
        if(aw){aw.textContent=`${target} departmanının onaylaması bekleniyor`;aw.hidden=false;}
        toast(`${target} departmanına onay için gönderildi`);
        delete cache.lost_items;delete cache.lost_approvals;
        // Güncel kaydı çekip modalı bekleme durumuyla yeniden aç
        let fresh=null;
        try{fresh=(await load('lost_items',true)).find(r=>String(r.id)===String(row.id));}catch(_){}
        setTimeout(()=>{closeModal();if(fresh)openEditor('lost_items',fresh);renderTable(tab==='lost_approvals'?'lost_approvals':'lost_items');},700);
      }catch(err){send.disabled=false;toast(err.message)}
    };
    const movDel=box.querySelector('#mov-del');
    if(movDel)movDel.onclick=()=>deleteMovement(row);
  }
  async function deleteMovement(row){
    if(!confirm('Son transfer hareketi silinsin mi? Bekleyen transfer varsa iptal edilir.'))return;
    try{
      const saved=await api(`/api/hms/lost-items/${row.id}/movements/delete-last`,{method:'POST'});
      delete cache.lost_items;delete cache.lost_approvals;
      closeModal();renderTable(tab==='lost_approvals'?'lost_approvals':'lost_items');toast('Son hareket silindi');
      if(saved&&saved.id)setTimeout(()=>openEditor('lost_items',saved),80);
    }catch(err){toast(err.message)}
  }

  // --- Raporlar -----------------------------------------------------
  function reportPanelHtml(){
    return `<div class="lf-report-bar">
      <div class="lf-rb-title"><strong>Rapor</strong><small>En az bir kriter seçerek PDF raporu oluşturabilirsiniz.</small></div>
      <div><label>Başlangıç tarihi</label><input class="input" type="date" id="lr-from"></div>
      <div><label>Bitiş tarihi</label><input class="input" type="date" id="lr-to"></div>
      <div><label>Durum</label><select class="select" id="lr-status"><option value="">Tümü</option></select></div>
      <div><label>Saklandığı yer</label><select class="select" id="lr-storage"><option value="">Tümü</option></select></div>
      <button class="btn" id="lr-go">PDF Raporu Al</button>
      <button class="lf-rb-clear" type="button" id="lr-clear" title="Temizle">×</button>
    </div>`;
  }
  async function bindReportPanel(fallbackRows){
    let lost=cache.lost_items;
    if(!lost){try{lost=await load('lost_items');}catch(_){lost=fallbackRows||[];}}
    const statuses=[...new Set(lost.map(r=>r.transferStatus||r.status).filter(Boolean))].sort(trSort);
    const storages=[...new Set(lost.map(r=>r.storage).filter(Boolean))].sort(trSort);
    if($('#lr-status'))$('#lr-status').insertAdjacentHTML('beforeend',statuses.map(s=>`<option>${esc(s)}</option>`).join(''));
    if($('#lr-storage'))$('#lr-storage').insertAdjacentHTML('beforeend',storages.map(s=>`<option>${esc(s)}</option>`).join(''));
    if($('#lr-go'))$('#lr-go').onclick=()=>lostReport(lost);
    if($('#lr-clear'))$('#lr-clear').onclick=()=>['lr-from','lr-to','lr-status','lr-storage'].forEach(id=>{const el=$('#'+id);if(el)el.value='';});
  }
  async function renderReport(){
    mount('<div class="card empty">Yükleniyor…</div>');
    if(currentView==='lostfound'){
      let lost;
      try{lost=await load('lost_items');}catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
      if(tab!=='report'||currentView!=='lostfound')return;
      mount(`<div class="lf-list">${reportPanelHtml()}</div>`);
      bindReportPanel(lost);
      return;
    }
    let vehicles;
    try{vehicles=await load('vehicles');}catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!=='report'||currentView!=='security')return;
    const plates=[...new Set(vehicles.map(v=>v.plate).filter(Boolean))].sort(trSort);
    mount(`<div class="card">
      <div class="card-head"><h2>Araç Kullanım Raporu</h2></div>
      <div class="form-grid">
        <div class="field"><label>Ay</label><input class="input" type="month" id="vr-month"></div>
        <div class="field"><label>Araç</label><select class="select" id="vr-plate"><option value="">Tüm araçlar</option>${plates.map(p=>`<option>${esc(p)}</option>`).join('')}</select></div>
      </div>
      <div style="margin-top:12px"><button class="btn" id="vr-go">PDF Raporu Al</button></div>
    </div>`);
    $('#vr-go').onclick=()=>vehicleReport(vehicles);
  }
  const rDate=v=>{const m=String(v||'').match(/(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:'';};
  function printHtml(html){const w=window.open('','_blank');if(!w)return toast('Açılır pencereye izin verin');w.document.write(html);w.document.close();setTimeout(()=>w.print(),350);}
  function lostReport(lost){
    const from=$('#lr-from').value,to=$('#lr-to').value,st=$('#lr-status').value,sg=$('#lr-storage').value;
    if(!(from||to||st||sg))return toast('En az bir kriter seçin');
    const rows=lost.filter(r=>{const d=rDate(r.foundDate||r.processDate);const status=r.transferStatus||r.status;
      return (!from||d>=from)&&(!to||d<=to)&&(!st||status===st)&&(!sg||r.storage===sg);});
    const body=rows.map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.foundDate||'—')}</td><td>${esc(r.item)}</td><td>${esc(r.category)}</td><td>${esc(r.storage)}</td><td>${esc(r.transferStatus||r.status)}</td><td>${esc(r.receiver||'—')}</td></tr>`).join('');
    printHtml(`<!doctype html><meta charset="utf-8"><title>Kayıp Eşya Raporu</title><style>body{font-family:Arial;color:#172b4d;padding:24px}h1{margin:0 0 6px}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#e8eef7}</style><h1>Kayıp Eşya Raporu</h1><p>Oluşturulma: ${new Date().toLocaleString('tr-TR')} · ${rows.length} kayıt</p><table><thead><tr><th>ID</th><th>Tarih</th><th>Eşya</th><th>Kategori</th><th>Saklandığı Yer</th><th>Durum</th><th>Teslim Alan</th></tr></thead><tbody>${body}</tbody></table>`);
  }
  function vehicleReport(vehicles){
    const month=$('#vr-month').value,plate=$('#vr-plate').value;
    const wanted=month?month.replace('-','.'):'';
    const groups={};
    vehicles.forEach(v=>{
      const m=String(v.departure||'').match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if(wanted&&m&&`${m[3]}.${m[2]}`!==wanted)return;
      if(plate&&v.plate!==plate)return;
      if(!v.plate)return;
      const km=Number(v.returnKm)-Number(v.km);
      const g=groups[v.plate]||(groups[v.plate]={plate:v.plate,trips:0,km:0});
      g.trips++;if(Number.isFinite(km)&&km>0)g.km+=km;
    });
    const list=Object.values(groups).sort((a,b)=>trSort(a.plate,b.plate));
    const body=list.map(g=>`<tr><td>${esc(g.plate)}</td><td>${g.trips}</td><td>${g.km} km</td></tr>`).join('');
    const maxKm=Math.max(1,...list.map(g=>g.km));
    const chart=list.map(g=>`<div style="display:flex;align-items:center;gap:8px;margin:6px 0"><span style="width:110px">${esc(g.plate)}</span><i style="height:16px;flex:1;border:1px solid #64748b;display:block"><b style="display:block;height:100%;background:#2563eb;width:${Math.min(100,g.km/maxKm*100)}%"></b></i><strong>${g.km} km</strong></div>`).join('');
    printHtml(`<!doctype html><meta charset="utf-8"><title>Araç Kullanım Raporu</title><style>@page{size:A4 landscape;margin:14mm}body{font-family:Arial;color:#172b4d;padding:24px}h1{margin:0 0 6px}h2{font-size:15px;margin:22px 0 8px}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #334155;padding:8px}th{background:#dbe5f1}</style><h1>Araç Kullanım Raporu</h1><p>Dönem: ${esc(month||'Tüm dönem')} · Araç: ${esc(plate||'Tümü')} · ${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Araç</th><th>Çıkış Sayısı</th><th>Ay Toplamı</th></tr></thead><tbody>${body}</tbody></table><h2>Araçların Aylık Kilometre Grafiği</h2>${chart||'<p>Kayıt yok</p>'}`);
  }

  // --- Misafir Takip: Lapis (PMS) Excel içe aktarımı, salt-okunur liste ----
  // Yükleme her seferinde tabloyu tamamen değiştirir; yeni dosyada olmayan
  // misafirler ekrandan (ve veritabanından) kalkar (kullanıcı isteği 2026-09).
  const fromDateOnly=v=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}.${m[2]}.${m[1]}`:(v||'—');};
  const guestCols=[['ad','Ad'],['soyad','Soyad'],['oda_no','Oda No'],['checkin','Giriş',fromDateOnly],['checkout','Çıkış',fromDateOnly],['uyruk','Uyruğu'],['email','E-posta'],['telefon','Telefon'],['firma_kodu','Firma Kodu']];
  const GUEST_SORTABLE=new Set(['ad','soyad','oda_no','checkin','checkout']);
  const guestSortVal=(row,key)=>{
    if(key==='oda_no'){const n=Number(row.oda_no);return Number.isFinite(n)?n:row.oda_no;}
    return row[key];
  };
  async function renderGuestTracking(){
    mount('<div class="card empty">Yükleniyor…</div>');
    let rows,meta;
    try{[rows,meta]=await Promise.all([api('/api/guest-tracking'),api('/api/guest-tracking/meta')]);}
    catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!=='guest_tracking')return;
    const f=filters.guest_tracking||(filters.guest_tracking={q:'',sortKey:null,sortDir:'asc'});
    const canUpload=canWrite('guest_tracking');
    const filteredList=()=>{
      const q=f.q.toLocaleLowerCase('tr-TR');
      let list=!q?rows:rows.filter(row=>Object.values(row).join(' ').toLocaleLowerCase('tr-TR').includes(q));
      if(f.sortKey){
        list=list.slice().sort((a,b)=>{
          const va=guestSortVal(a,f.sortKey),vb=guestSortVal(b,f.sortKey);
          const cmp=typeof va==='number'&&typeof vb==='number'?va-vb:trSort(va,vb);
          return f.sortDir==='desc'?-cmp:cmp;
        });
      }
      return list;
    };
    const metaLine=meta
      ? `Son yüklenen: <b>${esc(meta.original_name||'Lapis.xlsx')}</b> · ${esc(new Date(meta.uploaded_at).toLocaleString('tr-TR'))} · ${esc(meta.uploaded_by||'')} · ${meta.row_count} kayıt`
      : 'Henüz Excel yüklenmedi';
    const headCell=([k,l])=>{
      if(!GUEST_SORTABLE.has(k))return `<th>${l}</th>`;
      const active=f.sortKey===k;
      const arrow=active?(f.sortDir==='desc'?' ↓':' ↑'):'';
      return `<th class="hms-sortable" data-hms-sort="${k}" style="cursor:pointer;user-select:none">${l}${arrow}</th>`;
    };
    const body=`<div class="card">
      <div class="toolbar">
        <input class="input" id="hms-q" placeholder="Ada, odaya, telefona göre ara…" value="${esc(f.q)}">
        ${canUpload?`<label class="btn secondary" style="cursor:pointer">Excel yükle<input type="file" id="gt-file" accept=".xlsx" hidden></label>`:''}
        <span class="muted" id="hms-count"></span>
      </div>
      <div class="muted" style="margin:-6px 0 10px;font-size:12.5px">${metaLine}</div>
      <div style="overflow:auto"><table class="hms-table"><thead><tr id="hms-ghead">${guestCols.map(headCell).join('')}</tr></thead><tbody id="hms-tbody"></tbody></table></div>
    </div>`;
    mount(body);
    const paint=()=>{
      const list=filteredList();
      const tb=$('#hms-tbody');
      if(tb)tb.innerHTML=list.map(row=>`<tr>${guestCols.map(([k,,fmt])=>`<td>${esc(fmt?fmt(row[k]):(row[k]||'—'))}</td>`).join('')}</tr>`).join('')
        ||`<tr><td colspan="${guestCols.length}" class="empty">Kayıt bulunamadı</td></tr>`;
      const c=$('#hms-count');if(c)c.textContent=`${list.length} kayıt`;
    };
    const bindSortHeaders=()=>{
      const head=$('#hms-ghead');if(!head)return;
      head.querySelectorAll('[data-hms-sort]').forEach(th=>th.onclick=()=>{
        const key=th.dataset.hmsSort;
        f.sortDir=(f.sortKey===key&&f.sortDir==='asc')?'desc':'asc';
        f.sortKey=key;
        head.innerHTML=guestCols.map(headCell).join('');
        bindSortHeaders();
        paint();
      });
    };
    paint();
    bindSortHeaders();
    const q=$('#hms-q');if(q)q.oninput=()=>{f.q=q.value;paint();};
    const file=$('#gt-file');
    if(file)file.onchange=async()=>{
      const f0=file.files&&file.files[0];
      if(!f0)return;
      if(!/\.xlsx$/i.test(f0.name))return toast('Yalnızca .xlsx dosyası yükleyebilirsiniz');
      if(f0.size>20*1024*1024)return toast('Dosya çok büyük (en fazla 20 MB)');
      if(!confirm('Yeni Lapis Excel dosyası yüklenecek. Bu dosyada bulunmayan mevcut misafirler sistemden silinecek ve ekran yalnızca bu yeni dosyanın verilerini gösterecek. Devam edilsin mi?'))return;
      toast('Excel yükleniyor ve işleniyor…');
      try{
        const r=await api('/api/guest-tracking/upload',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Filename':encodeURIComponent(f0.name)},body:f0});
        toast(`Yüklendi: ${r.count} kayıt`);
        renderGuestTracking();
      }catch(err){toast('Yükleme başarısız: '+err.message);}
    };
  }

  function render(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
    $('#page-title').textContent=VIEW_META[currentView].title;
    const vt=visibleTabs().map(t=>t[0]);
    if(!vt.length){mount('<div class="card empty">Bu modüle erişim yetkiniz yok.</div>');return;}
    if(!vt.includes(tab)){tab=vt[0];sessionStorage.setItem(tabKey(),tab);}
    if(tab==='report')renderReport();
    else if(tab==='guest_tracking')renderGuestTracking();
    else renderTable(tab);
  }

  const baseShell=shell;
  shell=function(){
    if(state.view==='security'||state.view==='lostfound'){
      if(window.__ikCan&&!window.__ikCan(state.view)){state.view='dashboard';baseShell();return;}
      currentView=state.view;
      tab=sessionStorage.getItem(tabKey())||TABDEFS[currentView][0][0];
      loadPeople().then(()=>{if(state.view==='security'||state.view==='lostfound')render();});
      render();
    }else baseShell();
  };

})();
