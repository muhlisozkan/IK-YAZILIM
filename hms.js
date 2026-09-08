(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trSort=(a,b)=>String(a??'').localeCompare(String(b??''),'tr');
  const nowInput=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  const fromInput=v=>{if(!v)return '—';const d=new Date(v);return isNaN(d)?v:d.toLocaleString('tr-TR');};
  const toInput=v=>{if(!v||v==='—')return '';const m=String(v).match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})[ T](\d{1,2}):(\d{2})/);if(m)return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T${m[4].padStart(2,'0')}:${m[5]}`;const d=new Date(v);return isNaN(d)?'':new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};

  const lostCategories=['Ayakkabı/Terlik','Bebek Malzemeleri','Çanta','Değerli Eşya','Deniz/Havuz Malzemeleri','Diğer','Elektronik','Gözlük','Kozmetik','Kitap','Oyuncak','Takı','Tekstil','Termos','Toplu Kayıp'];
  const HMS_DEPTS=['ÖN BÜRO','KAT HİZMETLERİ','TEKNİK SERVİS','MİSAFİR İLİŞKİLERİ','GÜVENLİK','MALİ İŞLER'];
  const normDept=d=>String(d||'').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g,' ');
  const deptList=()=>[...new Set([...(state.employees||[]).map(e=>normDept(e.department)).filter(Boolean),...HMS_DEPTS])].sort(trSort);
  const deptEmployees=d=>(state.employees||[]).filter(e=>normDept(e.department)===normDept(d)).map(e=>e.name).sort(trSort);

  const GUV_TABS=['visitors','vehicles','fleet','staff_status'];
  const LOST_TABS=['lost_items','lost_approvals'];
  function access(){
    const a=window.__ikSecurityAccess?.()||{};
    const guv=a.admin?'full':(a.hr?'read':(a.security?'operate':'none'));
    const lost=a.admin?'full':(a.hr?'read':(a.lostDept?'operate':'none'));
    return {guv,lost,report:(guv!=='none'||lost!=='none')};
  }
  const permFor=module=>{const ac=access();if(module==='report')return 'read';return LOST_TABS.includes(module)?ac.lost:ac.guv;};
  const canWrite=module=>['full','operate'].includes(permFor(module));
  const canDelete=module=>permFor(module)==='full';

  const tabs=[
    ['visitors','Ziyaretçiler'],
    ['vehicles','Araç Takipleri'],
    ['fleet','Araçlar'],
    ['staff_status','Çalışan Takipleri'],
    ['lost_items','Kayıp/Bulunan Eşyalar'],
    ['lost_approvals','Onay Bekleyenler'],
    ['report','Rapor']
  ];

  const columns={
    visitors:[['date','Ziyaret Tarihi',fromInput],['type','Tip'],['name','İsim'],['company','Firma'],['plate','Plaka'],['department','Departman'],['status','Durum'],['exit','Çıkış',fromInput],['identity','Kimlik'],['count','Kişi']],
    vehicles:[['departure','Çıkış Tarihi',fromInput],['plate','Plaka'],['brand','Marka'],['model','Model'],['driver','Sürücü'],['destination','Gideceği Yer'],['status','Durum'],['km','Çıkış Km'],['returnDate','Dönüş',fromInput],['returnKm','Dönüş Km'],['requester','Talep Eden'],['fault','Hata']],
    fleet:[['plate','Plaka'],['brand','Marka'],['model','Model'],['startKm','Başlangıç Km'],['lastKm','Son Km'],['disabled','Kullanım Dışı']],
    staff_status:[['name','İsim'],['entry','Giriş',fromInput],['status','Durum'],['exit','Çıkış',fromInput],['title','Ünvan'],['department','Departman']],
    lost_items:[['id','ID'],['foundDate','Bulunma Tarihi'],['processDate','İşlem Tarihi'],['item','Eşya'],['category','Kategori'],['location','Nerede Bulundu'],['storage','Saklandığı Yer'],['status','Durum'],['transferStatus','Transfer'],['receiver','Teslim Alan']],
    lost_approvals:[['id','ID'],['processDate','İşlem Tarihi'],['item','Eşya'],['category','Kategori'],['fromDepartment','Gönderen'],['targetDepartment','Hedef'],['transferSender','Teslim Eden'],['transferReceiver','Teslim Alan'],['status','Durum']]
  };
  const fields={
    visitors:()=>[['date','Ziyaret Tarihi','datetime-local'],['type','Ziyaret Tipi','select',['Misafir','Personel','Mağaza','Günübirlik']],['name','Adı Soyadı'],['company','Firma'],['plate','Plaka'],['identity','Kimlik Tipi','select',['Kart Verilmedi','Kimlik Kartı','Pasaport','Ehliyet']],['count','Kişi Sayısı','number'],['department','Departman','select',deptList()],['status','Durum','select',['İçeride','Çıkış Yaptı']],['exit','Çıkış Tarihi','datetime-local'],['notes','Notlar','textarea']],
    vehicles:()=>[['departure','Çıkış Tarihi','datetime-local'],['plate','Araç Plakası'],['brand','Marka'],['model','Model'],['driver','Sürücü'],['requester','Talep Eden'],['destination','Gideceği Yer'],['status','Durum','select',['Ayrıldı','Çıkış Yaptı','Dönüş Yaptı']],['km','Çıkış Km','number'],['returnDate','Dönüş Tarihi','datetime-local'],['returnKm','Dönüş Km','number'],['fault','Araç Hata Durumu','select',['Yok','Var']],['notes','Notlar','textarea']],
    fleet:()=>[['plate','Plaka'],['brand','Marka'],['model','Model'],['startKm','Başlangıç Km','number'],['lastKm','Son Km','number'],['disabled','Kullanım Dışı','select',['Hayır','Evet']]],
    staff_status:()=>[['name','İsim'],['entry','Giriş','datetime-local'],['status','Durum','select',['İçeride','Henüz Giriş Yapmadı','Çıkış Yaptı']],['exit','Çıkış Tarihi','datetime-local'],['title','Ünvan'],['department','Departman','select',deptList()],['notes','Notlar','textarea']],
    lost_items:()=>[['foundDate','Kayıp/Bulunma Tarihi','datetime-local'],['category','Kategori','select',lostCategories],['item','Eşya'],['location','Nerede Bulundu'],['notes','Notlar','textarea'],['status','Durum','select',['Beklemede','Saklama Sonu','Teslim Edildi']],['storage','Saklandığı Yer'],['receiver','Teslim Alan']]
  };

  let tab=sessionStorage.getItem('ik_hms_tab')||'visitors';
  const cache={};
  const filters={};

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
    return tabs.filter(([k])=>k==='report'?ac.report:(LOST_TABS.includes(k)?ac.lost!=='none':ac.guv!=='none'));
  }
  function shellHtml(body){
    const vt=visibleTabs();
    return `<div class="section-title"><div><h2>Güvenlik ve Kayıp Eşya</h2><span class="muted">Ziyaretçi, araç, çalışan takibi ve kayıp/bulunan eşya yönetimi</span></div></div>
      <div class="leave-tabs" style="margin-bottom:16px;flex-wrap:wrap">${vt.map(([k,l])=>`<button class="btn ${tab===k?'':'secondary'}" data-hms-tab="${k}">${l}</button>`).join('')}</div>
      <div id="hms-body">${body}</div>`;
  }
  function mount(body){
    $('#app').innerHTML=shellHtml(body);
    document.querySelectorAll('[data-hms-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.hmsTab;sessionStorage.setItem('ik_hms_tab',tab);render();});
  }

  // --- Genel tablo görünümü -------------------------------------------
  async function renderTable(module){
    mount('<div class="card empty">Yükleniyor…</div>');
    let rows;
    try{rows=await load(module);}catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!==module)return;
    const cols=columns[module];
    const f=filters[module]||(filters[module]={q:''});
    const q=f.q.toLocaleLowerCase('tr-TR');
    const shown=rows.filter(row=>!q||cols.some(([k])=>String(row[k]??'').toLocaleLowerCase('tr-TR').includes(q))
      ||String(row.name??'').toLocaleLowerCase('tr-TR').includes(q));
    const isApprovals=module==='lost_approvals';
    const canAdd=fields[module]&&canWrite(module)&&!isApprovals;
    const list=isApprovals?shown.filter(r=>r.status==='Beklemede'):shown;
    const body=`<div class="card">
      <div class="toolbar">
        <input class="input" id="hms-q" placeholder="Listede ara…" value="${esc(f.q)}">
        ${canAdd?`<button class="btn" id="hms-add">+ Yeni</button>`:''}
        <span class="muted">${list.length} kayıt${permFor(module)==='read'?' · salt görüntüleme':''}</span>
      </div>
      <div style="overflow:auto"><table><thead><tr>
        ${cols.map(([,l])=>`<th>${l}</th>`).join('')}<th></th>
      </tr></thead><tbody>${list.map(row=>`<tr data-id="${row.id}">
        ${cols.map(([k,,fmt])=>`<td>${esc(fmt?fmt(row[k]):(row[k]??'—'))}</td>`).join('')}
        <td class="row-actions">${rowActions(module,row)}</td>
      </tr>`).join('')||`<tr><td colspan="${cols.length+1}" class="empty">Kayıt bulunamadı</td></tr>`}</tbody></table></div>
    </div>`;
    mount(body);
    $('#hms-q').oninput=()=>{f.q=$('#hms-q').value;clearTimeout(window.__hmsT);window.__hmsT=setTimeout(()=>renderTable(module),250);};
    if($('#hms-add'))$('#hms-add').onclick=()=>openEditor(module,null);
    document.querySelectorAll('#hms-body tbody tr[data-id]').forEach(tr=>{
      tr.ondblclick=()=>{const row=list.find(r=>String(r.id)===tr.dataset.id);if(row&&fields[module]&&canWrite(module))openEditor(module,row);};
    });
    document.querySelectorAll('[data-hms-toggle]').forEach(b=>b.onclick=()=>toggleStatus(module,b.dataset.hmsToggle));
    document.querySelectorAll('[data-hms-del]').forEach(b=>b.onclick=()=>del(module,b.dataset.hmsDel));
    document.querySelectorAll('[data-hms-approve]').forEach(b=>b.onclick=()=>decideApproval(b.dataset.hmsApprove,'Onaylandı'));
    document.querySelectorAll('[data-hms-reject]').forEach(b=>b.onclick=()=>decideApproval(b.dataset.hmsReject,'Reddedildi'));
  }

  function rowActions(module,row){
    if(module==='lost_approvals')
      return canWrite(module)?`<button class="btn ghost" data-hms-approve="${row.id}">Onayla</button><button class="btn ghost danger-text" data-hms-reject="${row.id}">Reddet</button>`:'';
    let html='';
    if((module==='visitors'||module==='staff_status')&&canWrite(module))
      html+=`<button class="btn ghost" data-hms-toggle="${row.id}">${row.status==='İçeride'?'Çıkış':'Giriş'}</button>`;
    if(canDelete(module))
      html+=`<button class="btn ghost danger-text" data-hms-del="${row.id}">Sil</button>`;
    return html;
  }

  async function toggleStatus(module,id){
    const row=(cache[module]||[]).find(r=>String(r.id)===String(id));if(!row)return;
    const status=row.status==='İçeride'?'Çıkış Yaptı':'İçeride';
    const exit=status==='Çıkış Yaptı'?new Date().toLocaleString('tr-TR'):'—';
    try{await api(`/api/hms/${module}/${id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,exit})});
      Object.assign(row,{status,exit});renderTable(module);toast('Durum güncellendi');
    }catch(err){toast(err.message)}
  }
  async function del(module,id){
    if(!confirm('Bu kaydı silmek istediğinize emin misiniz?'))return;
    try{await api(`/api/hms/${module}/${id}`,{method:'DELETE'});
      cache[module]=(cache[module]||[]).filter(r=>String(r.id)!==String(id));renderTable(module);toast('Kayıt silindi');
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
  function openEditor(module,row){
    const editing=Boolean(row);
    const cfg=fields[module]();
    const isLost=module==='lost_items';
    const inputFor=([key,label,type,opts])=>{
      let val=row?row[key]:'';
      if(!editing&&(key==='date'||key==='departure'||key==='foundDate'||key==='entry'))val=nowInput();
      const wide=key==='notes'?' style="grid-column:1/-1"':'';
      let ctrl;
      if(type==='select')ctrl=`<select class="select" name="${key}">${['',...opts].map(o=>`<option ${String(val)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
      else if(type==='textarea')ctrl=`<textarea class="input" name="${key}">${esc(val)}</textarea>`;
      else if(type==='datetime-local')ctrl=`<input class="input" type="datetime-local" name="${key}" value="${esc(toInput(val)||(!editing?val:''))}" ${isLost&&key==='foundDate'&&!editing?'readonly title="Otomatik belirlenir"':''}>`;
      else if(type==='number')ctrl=`<input class="input" type="number" name="${key}" value="${esc(val)}">`;
      else ctrl=`<input class="input" name="${key}" value="${esc(val)}" ${isLost&&key==='storage'?'readonly title="Departmanınızdan otomatik belirlenir"':''}>`;
      return `<div class="field"${wide}><label>${label}</label>${ctrl}</div>`;
    };
    const imageBlock=isLost?`<div class="field" style="grid-column:1/-1"><label>Resim</label><input class="input" type="file" accept="image/*" id="hms-image">${row?.image?`<img src="${esc(row.image)}" alt="" style="max-height:120px;margin-top:8px;border-radius:8px">`:''}</div>`:'';
    const transferBlock=(isLost&&editing&&canWrite('lost_items'))?transferPanel(row):(isLost&&editing?historyList(row):'');
    modal(editing?'Kaydı düzenle':'Yeni kayıt',
      `<div class="form-grid">${cfg.map(inputFor).join('')}</div>${imageBlock}${transferBlock}`,
      async()=>{
        const box=document.querySelector('.modal');
        const payload={};
        cfg.forEach(([key,,type])=>{
          let v=box.querySelector(`[name="${key}"]`)?.value??'';
          if(type==='datetime-local')v=fromInput(v);
          payload[key]=v;
        });
        if(isLost&&!editing)delete payload.storage;
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
            closeModal();renderTable(module);toast(editing?'Kayıt güncellendi':'Kayıt oluşturuldu');
          }catch(err){toast(err.message)}
        };
        if(img){
          if(img.size>600*1024)return toast('Resim en fazla 600 KB olabilir');
          const reader=new FileReader();reader.onload=()=>send({image:reader.result});reader.readAsDataURL(img);
        }else send({});
      });
    if(isLost&&editing&&canWrite('lost_items'))bindTransfer(row);
  }

  // --- Kayıp eşya transfer paneli -----------------------------------
  function transferPanel(row){
    if(row.transferStatus==='Beklemede')
      return `<div class="formula" style="margin-top:14px">Bu eşya için <strong>${esc(row.targetDepartment)}</strong> departmanına transfer onayı bekleniyor.</div>${historyList(row)}`;
    const from=row.storage||row.department;
    const targets=deptList().filter(d=>d.toLocaleUpperCase('tr-TR')!==String(from||'').toLocaleUpperCase('tr-TR'));
    return `<div class="transfer-box" style="margin-top:14px;border-top:1px solid var(--line);padding-top:14px">
      <strong style="font-size:13px">Departman transferi</strong>
      <div class="form-grid" style="margin-top:10px">
        <div class="field"><label>Hedef departman</label><select class="select" id="tr-target">${targets.map(d=>`<option>${esc(d)}</option>`).join('')}</select></div>
        <div class="field"><label>Teslim eden</label><input class="input" id="tr-sender" list="tr-sender-list" value="${esc(deptEmployees(from)[0]||'')}"><datalist id="tr-sender-list">${deptEmployees(from).map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>
        <div class="field"><label>Teslim alan</label><input class="input" id="tr-receiver" list="tr-receiver-list"><datalist id="tr-receiver-list"></datalist></div>
      </div>
      <button class="btn secondary" type="button" id="tr-send" style="margin-top:10px">▶ Transfer onayına gönder</button>
    </div>${historyList(row)}`;
  }
  function historyList(row){
    const h=Array.isArray(row.history)?row.history:[];
    if(!h.length)return '';
    return `<div class="formula" style="margin-top:12px"><strong>Hareket geçmişi</strong>${h.map(m=>`<div>${esc(m.processDate)} · ${esc(m.transferStatus)} · ${esc(m.targetDepartment||'—')} · ${esc(m.transferSender||'')} → ${esc(m.transferReceiver||'')}</div>`).join('')}</div>`;
  }
  function bindTransfer(row){
    const box=document.querySelector('.modal');
    const targetSel=box.querySelector('#tr-target');
    const recList=box.querySelector('#tr-receiver-list');
    const refreshReceivers=()=>{if(recList&&targetSel)recList.innerHTML=deptEmployees(targetSel.value).map(n=>`<option value="${esc(n)}">`).join('');};
    if(targetSel){targetSel.onchange=refreshReceivers;refreshReceivers();}
    const send=box.querySelector('#tr-send');
    if(send)send.onclick=async()=>{
      const target=targetSel.value,sender=box.querySelector('#tr-sender').value.trim(),receiver=box.querySelector('#tr-receiver').value.trim();
      if(!target||!sender||!receiver)return toast('Hedef departman, teslim eden ve teslim alan zorunludur');
      try{await api(`/api/hms/lost-items/${row.id}/transfer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({targetDepartment:target,sender,receiver})});
        delete cache.lost_items;delete cache.lost_approvals;closeModal();renderTable('lost_items');toast(`${target} departmanına onay için gönderildi`);
      }catch(err){toast(err.message)}
    };
  }

  // --- Raporlar -----------------------------------------------------
  async function renderReport(){
    mount('<div class="card empty">Yükleniyor…</div>');
    let lost,vehicles;
    try{[lost,vehicles]=await Promise.all([load('lost_items'),load('vehicles')]);}
    catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!=='report')return;
    const storages=[...new Set(lost.map(r=>r.storage).filter(Boolean))].sort(trSort);
    const statuses=[...new Set(lost.map(r=>r.transferStatus||r.status).filter(Boolean))].sort(trSort);
    const plates=[...new Set(vehicles.map(v=>v.plate).filter(Boolean))].sort(trSort);
    mount(`<div class="card" style="margin-bottom:16px">
      <div class="card-head"><h2>Kayıp Eşya Raporu</h2></div>
      <div class="form-grid">
        <div class="field"><label>Başlangıç tarihi</label><input class="input" type="date" id="lr-from"></div>
        <div class="field"><label>Bitiş tarihi</label><input class="input" type="date" id="lr-to"></div>
        <div class="field"><label>Durum</label><select class="select" id="lr-status"><option value="">Tümü</option>${statuses.map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>Saklandığı yer</label><select class="select" id="lr-storage"><option value="">Tümü</option>${storages.map(s=>`<option>${esc(s)}</option>`).join('')}</select></div>
      </div>
      <div style="margin-top:12px"><button class="btn" id="lr-go">PDF Raporu Al</button></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Araç Kullanım Raporu</h2></div>
      <div class="form-grid">
        <div class="field"><label>Ay</label><input class="input" type="month" id="vr-month"></div>
        <div class="field"><label>Araç</label><select class="select" id="vr-plate"><option value="">Tüm araçlar</option>${plates.map(p=>`<option>${esc(p)}</option>`).join('')}</select></div>
      </div>
      <div style="margin-top:12px"><button class="btn" id="vr-go">PDF Raporu Al</button></div>
    </div>`);
    $('#lr-go').onclick=()=>lostReport(lost);
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
    printHtml(`<!doctype html><meta charset="utf-8"><title>Araç Kullanım Raporu</title><style>body{font-family:Arial;color:#172b4d;padding:24px}h1{margin:0 0 6px}p{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}th,td{border:1px solid #334155;padding:8px}th{background:#dbe5f1}</style><h1>Araç Kullanım Raporu</h1><p>Dönem: ${esc(month||'Tüm dönem')} · Araç: ${esc(plate||'Tümü')} · ${new Date().toLocaleString('tr-TR')}</p><table><thead><tr><th>Araç</th><th>Çıkış Sayısı</th><th>Ay Toplamı</th></tr></thead><tbody>${body}</tbody></table>`);
  }

  function render(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='security'));
    $('#page-title').textContent='Güvenlik ve Kayıp Eşya';
    const vt=visibleTabs().map(t=>t[0]);
    if(!vt.length){mount('<div class="card empty">Bu modüle erişim yetkiniz yok.</div>');return;}
    if(!vt.includes(tab)){tab=vt[0];sessionStorage.setItem('ik_hms_tab',tab);}
    if(tab==='report')renderReport();
    else renderTable(tab);
  }

  const baseShell=shell;
  shell=function(){
    if(state.view==='security'){
      if(window.__ikCan&&!window.__ikCan('security')){state.view='dashboard';baseShell();return;}
      render();
    }else baseShell();
  };

})();
