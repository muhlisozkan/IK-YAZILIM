(function(){
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=async(path,options)=>{
    const response=await fetch(path,options);
    const data=response.status===204?null:await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.error||'İşlem tamamlanamadı');
    return data;
  };

  // Menüden kaldırılan "notifications" görünümüne takılı kalmış oturumları düzelt
  if(state.view==='notifications'){state.view='dashboard';try{sessionStorage.setItem('ik_current_view','dashboard')}catch{}}

  // --- Bildirim modeli ---------------------------------------------------
  const uid=()=>window.__ikAuthUser?.id||'x';
  const READ_KEY=()=>`ik_notif_read_${uid()}`;
  const SEEN_KEY=()=>`ik_notif_seen_${uid()}`;
  const jget=(k,fb)=>{try{const v=localStorage.getItem(k);return v==null?fb:JSON.parse(v)}catch{return fb}};
  const readSet=()=>new Set(jget(READ_KEY(),[]));
  const saveReadSet=s=>{try{localStorage.setItem(READ_KEY(),JSON.stringify([...s]))}catch{}};

  const numId=id=>Number(String(id).split(':')[1])||0;

  // Sunucu can_approve alanı sıralı onay akışında yalnızca sıradaki onaycıya true döner
  function currentNotifications(){
    const list=[];
    (state.leaves||[]).forEach(l=>{
      if(l.can_approve)
        list.push({id:'leave:'+l.id,cat:'İzin onayı',kind:'orange',view:'leave',section:'requests',
          text:`${esc(l.employee||l.employee_name||'Çalışan')} · ${esc(l.type||l.leave_type||'izin')} talebi onayınızı bekliyor`});
    });
    (state.expenses||[]).forEach(x=>{
      if(x.can_approve)
        list.push({id:'expense:'+x.id,cat:'Masraf onayı',kind:'orange',view:'expenses',
          text:`${esc(x.employee_name||'Çalışan')} · ${fmt(x.amount)} masraf onayınızı bekliyor`});
    });
    (state.advances||[]).forEach(a=>{
      if(a.can_approve)
        list.push({id:'advance:'+a.id,cat:'Avans onayı',kind:'orange',view:'advances',
          text:`${esc(a.employee_name||'Çalışan')} · ${fmt(a.amount)} avans onayınızı bekliyor`});
    });
    return list.sort((a,b)=>numId(b.id)-numId(a.id));
  }

  // --- Ses -------------------------------------------------------------
  let audioCtx;
  function beep(){
    try{
      audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
      if(audioCtx.state==='suspended')audioCtx.resume();
      const t=audioCtx.currentTime;
      [0,0.18].forEach((offset,i)=>{
        const o=audioCtx.createOscillator(),g=audioCtx.createGain();
        o.connect(g);g.connect(audioCtx.destination);
        o.type='sine';o.frequency.value=i?1046:784;
        g.gain.setValueAtTime(0.0001,t+offset);
        g.gain.exponentialRampToValueAtTime(0.16,t+offset+0.02);
        g.gain.exponentialRampToValueAtTime(0.0001,t+offset+0.16);
        o.start(t+offset);o.stop(t+offset+0.18);
      });
    }catch{}
  }
  document.addEventListener('click',()=>{try{if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume()}catch{}});

  // --- Durum güncelleme ----------------------------------------------
  let dropdownOpen=false;

  function tick(allowSound){
    if(!window.__ikAuthUser)return[];
    const cur=currentNotifications();
    const read=readSet();
    const curIds=cur.map(n=>n.id);
    const firstRun=localStorage.getItem(SEEN_KEY())==null;
    const seen=new Set(jget(SEEN_KEY(),[]));
    const fresh=curIds.filter(id=>!seen.has(id)&&!read.has(id));
    try{localStorage.setItem(SEEN_KEY(),JSON.stringify(curIds))}catch{}
    if(allowSound&&!firstRun&&fresh.length)beep();
    const unread=cur.filter(n=>!read.has(n.id));
    updateBell(unread.length);
    if(dropdownOpen)renderDropdown();
    renderDashboardPanel();
    return cur;
  }
  window.__ikNotifTick=()=>tick(true);

  // --- Rozet / zil --------------------------------------------------
  function bellEl(){return document.querySelector('#notif-bell')}
  function updateBell(count){
    const bell=bellEl();if(!bell)return;
    let badge=bell.querySelector('.notif-badge');
    if(!badge){badge=document.createElement('span');badge.className='notif-badge';bell.appendChild(badge)}
    badge.textContent=count>99?'99+':String(count);
    badge.style.display=count>0?'grid':'none';
    bell.classList.toggle('has-unread',count>0);
  }

  function itemRow(n,inDropdown){
    return `<button class="notif-item" data-notif-go="${n.id}" data-go-view="${n.view||''}" data-go-section="${n.section||''}">
      <span class="badge ${n.kind}">${n.cat}</span>
      <span class="notif-text">${n.text}</span>
      <span class="notif-read" data-notif-read="${n.id}" title="Okundu işaretle">✓</span>
    </button>`;
  }
  function readRow(n){
    return `<div class="notif-item read">
      <span class="badge ${n.kind}">${n.cat}</span>
      <span class="notif-text">${n.text}</span>
      <span class="notif-unread" data-notif-unread="${n.id}" title="Okunmadı işaretle">↩</span>
    </div>`;
  }

  function section(title,arr,limit,isRead){
    const shown=arr.slice(0,limit);
    return `<div class="notif-section">
      <div class="notif-section-head">${title}<span class="muted">${arr.length}</span></div>
      <div class="notif-list">
        ${shown.map(n=>isRead?readRow(n):itemRow(n)).join('')||`<div class="notif-empty">${isRead?'Okunan bildirim yok':'Yeni bildirim yok'}</div>`}
        ${arr.length>limit?`<div class="notif-more">+${arr.length-limit} bildirim daha</div>`:''}
      </div>
    </div>`;
  }
  function panelHtml(compact){
    const read=readSet();
    const cur=currentNotifications();
    const unread=cur.filter(n=>!read.has(n.id));
    const done=cur.filter(n=>read.has(n.id));
    const limit=compact?8:250;
    return `<div class="notif-head">
        <strong>Bildirimler</strong>
        <span class="muted">${unread.length} yeni</span>
        ${unread.length?`<button class="btn ghost" data-notif-readall="1">Tümünü okundu işaretle</button>`:''}
      </div>
      ${section('Yeni bildirimler',unread,limit,false)}
      ${section('Okunan bildirimler',done,limit,true)}`;
  }

  function bindPanel(root){
    root.querySelectorAll('[data-notif-read]').forEach(b=>b.onclick=e=>{
      e.stopPropagation();const s=readSet();s.add(b.dataset.notifRead);saveReadSet(s);tick(false);
    });
    root.querySelectorAll('[data-notif-unread]').forEach(b=>b.onclick=e=>{
      e.stopPropagation();const s=readSet();s.delete(b.dataset.notifUnread);saveReadSet(s);tick(false);
    });
    root.querySelectorAll('[data-notif-readall]').forEach(b=>b.onclick=e=>{
      e.stopPropagation();const s=readSet();currentNotifications().forEach(n=>s.add(n.id));saveReadSet(s);tick(false);
    });
    root.querySelectorAll('[data-notif-go]').forEach(b=>b.onclick=()=>{
      const s=readSet();s.add(b.dataset.notifGo);saveReadSet(s);
      closeDropdown();
      const view=b.dataset.goView,sec=b.dataset.goSection;
      if(view==='leave'&&typeof window.__ikOpenLeave==='function')window.__ikOpenLeave(sec||'requests');
      else if(view&&typeof window.__ikNavigate==='function')window.__ikNavigate(view);
      tick(false);
    });
  }

  // --- Açılır panel (zil) -----------------------------------------
  function renderDropdown(){
    const bell=bellEl();if(!bell)return;
    let dd=document.querySelector('#notif-dropdown');
    if(!dd){dd=document.createElement('div');dd.id='notif-dropdown';document.body.appendChild(dd)}
    dd.innerHTML=panelHtml(true);
    const r=bell.getBoundingClientRect();
    dd.style.top=(r.bottom+8)+'px';
    dd.style.right=(window.innerWidth-r.right)+'px';
    dd.hidden=false;
    bindPanel(dd);
  }
  function openDropdown(){dropdownOpen=true;renderDropdown();}
  function closeDropdown(){dropdownOpen=false;const dd=document.querySelector('#notif-dropdown');if(dd)dd.hidden=true;}
  function toggleDropdown(){dropdownOpen?closeDropdown():openDropdown();}

  document.addEventListener('click',e=>{
    if(!dropdownOpen)return;
    if(e.target.closest('#notif-dropdown')||e.target.closest('#notif-bell'))return;
    closeDropdown();
  });

  function ensureBell(){
    const host=document.querySelector('.top-actions');
    if(!host)return;
    let bell=document.querySelector('#notif-bell');
    if(!bell){
      bell=document.createElement('button');
      bell.id='notif-bell';bell.className='notif-bell';bell.type='button';
      bell.setAttribute('aria-label','Bildirimler');
      bell.innerHTML='<span class="notif-ic">🔔</span>';
      host.insertBefore(bell,host.firstChild);
    }
    bell.onclick=toggleDropdown;
  }

  // --- Genel Bakış paneli ---------------------------------------
  function renderDashboardPanel(){
    const mount=document.querySelector('#dashboard-notifications');
    if(!mount)return;
    mount.innerHTML=`<div class="card notif-panel">${panelHtml(false)}</div>`;
    bindPanel(mount);
  }

  // --- SMTP ayarları (Kullanıcı ve Yetkiler ekranına taşındı) -----
  let smtpSettings=null;
  async function loadSmtpSettings(){
    try{smtpSettings=await api('/api/smtp-settings');renderSmtpSettings()}
    catch(error){toast(error.message)}
  }
  function renderSmtpSettings(){
    if(state.view!=='users'||window.__ikCurrentUser?.()?.role!=='Sistem yöneticisi')return;
    if(!smtpSettings){loadSmtpSettings();return;}
    document.querySelector('#smtp-settings-card')?.remove();
    const card=document.createElement('div');
    card.id='smtp-settings-card';card.className='card';card.style.marginTop='18px';
    card.innerHTML=`<div class="card-head"><div><h2>Office 365 E-posta Ayarları</h2><span class="muted">Kullanıcılara e-posta bilgilendirmesi göndermek için merkezi SMTP hesabını tanımlayın</span></div><span class="badge ${smtpSettings.configured?'green':'orange'}">${smtpSettings.configured?'Yapılandırıldı':'Yapılandırılmadı'}</span></div>
      <div class="formula"><strong>Bağlantı:</strong> smtp.office365.com · Port 587 · STARTTLS. SMTP parolası şifreli saklanır ve tekrar ekranda gösterilmez.</div>
      <div class="form-grid" style="margin-top:16px">
        <div class="field"><label>SMTP sunucusu</label><input class="input" id="smtp-host" value="smtp.office365.com" readonly></div>
        <div class="field"><label>Port</label><input class="input" id="smtp-port" type="number" value="587" readonly></div>
        <div class="field"><label>Güvenlik</label><input class="input" value="STARTTLS" readonly></div>
        <div class="field"><label>Gönderimi etkinleştir</label><select class="select" id="smtp-enabled"><option value="true" ${smtpSettings.enabled?'selected':''}>Etkin</option><option value="false" ${!smtpSettings.enabled?'selected':''}>Kapalı</option></select></div>
        <div class="field"><label>SMTP kullanıcı e-postası *</label><input class="input" id="smtp-user" type="email" value="${esc(smtpSettings.username)}" placeholder="bildirim@firma.com"></div>
        <div class="field"><label>SMTP parolası *</label><input class="input" id="smtp-password" type="password" autocomplete="new-password" placeholder="${smtpSettings.password_saved?'Kayıtlı · değiştirmek için yazın':'Parolayı girin'}"></div>
        <div class="field"><label>Gönderen e-posta *</label><input class="input" id="smtp-from" type="email" value="${esc(smtpSettings.from_email)}" placeholder="bildirim@firma.com"></div>
        <div class="field"><label>Gönderen adı</label><input class="input" id="smtp-name" value="${esc(smtpSettings.from_name||'İK Merkezi')}"></div>
        <div class="field"><label>Test alıcısı</label><input class="input" id="smtp-test-recipient" type="email" value="${esc(window.__ikCurrentUser?.()?.email||'')}" placeholder="test@firma.com"></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn secondary" id="smtp-test">Test e-postası gönder</button><button class="btn" id="smtp-save">Ayarları kaydet</button></div>`;
    $('#app').appendChild(card);
    $('#smtp-save').onclick=saveSmtpSettings;
    $('#smtp-test').onclick=testSmtpSettings;
  }
  async function saveSmtpSettings(){
    const button=$('#smtp-save');button.disabled=true;
    try{
      smtpSettings=Object.assign(smtpSettings,await api('/api/smtp-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        enabled:$('#smtp-enabled').value==='true',host:'smtp.office365.com',port:587,
        username:$('#smtp-user').value.trim(),from_email:$('#smtp-from').value.trim(),from_name:$('#smtp-name').value.trim(),
        password:$('#smtp-password').value
      })}));
      toast('Office 365 SMTP ayarları sunucuya kaydedildi');renderSmtpSettings();
    }catch(error){toast(error.message)}
    finally{button.disabled=false}
  }
  async function testSmtpSettings(){
    const recipient=$('#smtp-test-recipient').value.trim();
    if(!recipient)return toast('Test alıcısı e-posta adresini girin');
    const button=$('#smtp-test');button.disabled=true;
    try{await api('/api/smtp-settings/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({recipient})});toast('Test e-postası başarıyla gönderildi')}
    catch(error){toast(error.message)}
    finally{button.disabled=false}
  }
  window.__ikRenderSmtpSettings=renderSmtpSettings;

  // --- Bağlama --------------------------------------------------
  const baseShell=shell;
  shell=function(){
    baseShell();
    ensureBell();
    tick(true);
  };
  const baseRefresh=window.__ikRefreshFromServer;
  if(typeof baseRefresh==='function')window.__ikRefreshFromServer=async function(){
    try{await baseRefresh.apply(this,arguments)}finally{ensureBell();tick(true)}
  };
  ensureBell();
  tick(false);
  setInterval(()=>tick(true),30000);
})();
