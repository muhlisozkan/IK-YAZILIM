(function(){
  let smtpSettings=null;
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const api=async(path,options)=>{
    const response=await fetch(path,options);
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'İşlem tamamlanamadı');
    return data;
  };
  function renderNotifications(){
    document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view==='notifications'));
    $('#page-title').textContent='Bildirim ve Görev Merkezi';
    const items=[];
    state.leaves.filter(item=>item.status==='Bekliyor').forEach(item=>items.push({type:'İzin onayı',text:`${item.employee} izin talebi onay bekliyor`,kind:'orange'}));
    (state.expenses||[]).filter(item=>item.status==='Bekliyor').forEach(item=>items.push({type:'Masraf onayı',text:`${item.employee_name} için ${fmt(item.amount)} masraf onay bekliyor`,kind:'orange'}));
    (state.advances||[]).filter(item=>item.status==='Onay Sürecinde').forEach(item=>items.push({type:'Avans onayı',text:`${item.employee_name} için ${fmt(item.amount)} avans onay bekliyor`,kind:'orange'}));
    if(!items.length)items.push({type:'Sistem',text:'Bekleyen bildirim bulunmuyor',kind:'green'});
    $('#app').innerHTML=`<div class="section-title"><div><h2>Bildirim ve görev merkezi</h2><span class="muted">İşlem bekleyen kayıtlar ve hatırlatmalar</span></div><button class="btn secondary" id="clear-notices">Tümünü okundu işaretle</button></div><div class="card"><div class="card-head"><h2>Bildirimler</h2><span class="muted">${items.length} kayıt</span></div>${items.map(item=>`<div style="display:flex;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--line)"><span class="badge ${item.kind}">${item.type}</span><span>${item.text}</span></div>`).join('')}</div>`;
    $('#clear-notices').onclick=()=>toast('Bildirimler okundu olarak işaretlendi');
    if(window.__ikCurrentUser?.()?.role==='Sistem yöneticisi')loadSmtpSettings();
  }
  async function loadSmtpSettings(){
    try{smtpSettings=await api('/api/smtp-settings');renderSmtpSettings()}
    catch(error){toast(error.message)}
  }
  function renderSmtpSettings(){
    if(state.view!=='notifications'||!smtpSettings)return;
    document.querySelector('#smtp-settings-card')?.remove();
    const card=document.createElement('div');
    card.id='smtp-settings-card';
    card.className='card';
    card.style.marginTop='18px';
    card.innerHTML=`<div class="card-head"><div><h2>Office 365 E-posta Ayarları</h2><span class="muted">Kullanıcılara e-posta bilgilendirmesi göndermek için merkezi SMTP hesabını tanımlayın</span></div><span class="badge ${smtpSettings.configured?'green':'orange'}">${smtpSettings.configured?'Yapılandırıldı':'Yapılandırılmadı'}</span></div>
      <div class="formula"><strong>Microsoft 365 varsayılanı:</strong> smtp.office365.com · Port 587 · STARTTLS. OAuth2 önerilir. Gizli bilgiler şifreli saklanır ve tekrar ekranda gösterilmez.</div>
      <div class="form-grid" style="margin-top:16px">
        <div class="field"><label>SMTP sunucusu</label><input class="input" id="smtp-host" value="smtp.office365.com" readonly></div>
        <div class="field"><label>Port</label><input class="input" id="smtp-port" type="number" value="587" readonly></div>
        <div class="field"><label>Kimlik doğrulama</label><select class="select" id="smtp-auth"><option value="oauth2" ${smtpSettings.auth_mode==='oauth2'?'selected':''}>Microsoft OAuth2 (Önerilen)</option><option value="password" ${smtpSettings.auth_mode==='password'?'selected':''}>E-posta ve parola</option></select></div>
        <div class="field"><label>Gönderimi etkinleştir</label><select class="select" id="smtp-enabled"><option value="true" ${smtpSettings.enabled?'selected':''}>Etkin</option><option value="false" ${!smtpSettings.enabled?'selected':''}>Kapalı</option></select></div>
        <div class="field"><label>SMTP kullanıcı e-postası *</label><input class="input" id="smtp-user" type="email" value="${esc(smtpSettings.username)}" placeholder="bildirim@firma.com"></div>
        <div class="field"><label>Gönderen e-posta *</label><input class="input" id="smtp-from" type="email" value="${esc(smtpSettings.from_email)}" placeholder="bildirim@firma.com"></div>
        <div class="field"><label>Gönderen adı</label><input class="input" id="smtp-name" value="${esc(smtpSettings.from_name||'İK Merkezi')}"></div>
        <div class="field smtp-password"><label>SMTP parolası</label><input class="input" id="smtp-password" type="password" autocomplete="new-password" placeholder="${smtpSettings.password_saved?'Kayıtlı · değiştirmek için yazın':'Parolayı girin'}"></div>
        <div class="field smtp-oauth"><label>Microsoft Entra Tenant ID *</label><input class="input" id="smtp-tenant" value="${esc(smtpSettings.tenant_id)}"></div>
        <div class="field smtp-oauth"><label>Uygulama (Client) ID *</label><input class="input" id="smtp-client" value="${esc(smtpSettings.client_id)}"></div>
        <div class="field smtp-oauth"><label>Client Secret</label><input class="input" id="smtp-secret" type="password" autocomplete="new-password" placeholder="${smtpSettings.client_secret_saved?'Kayıtlı · değiştirmek için yazın':'İstemci sırrını girin'}"></div>
        <div class="field"><label>Test alıcısı</label><input class="input" id="smtp-test-recipient" type="email" value="${esc(window.__ikCurrentUser?.()?.email||'')}" placeholder="test@firma.com"></div>
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="btn secondary" id="smtp-test">Test e-postası gönder</button><button class="btn" id="smtp-save">Ayarları kaydet</button></div>`;
    $('#app').appendChild(card);
    const toggle=()=>{const oauth=$('#smtp-auth').value==='oauth2';card.querySelectorAll('.smtp-oauth').forEach(element=>element.hidden=!oauth);card.querySelectorAll('.smtp-password').forEach(element=>element.hidden=oauth)};
    $('#smtp-auth').onchange=toggle;toggle();
    $('#smtp-save').onclick=saveSmtpSettings;
    $('#smtp-test').onclick=testSmtpSettings;
  }
  async function saveSmtpSettings(){
    const button=$('#smtp-save');button.disabled=true;
    try{
      smtpSettings=Object.assign(smtpSettings,await api('/api/smtp-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        enabled:$('#smtp-enabled').value==='true',host:'smtp.office365.com',port:587,auth_mode:$('#smtp-auth').value,
        username:$('#smtp-user').value.trim(),from_email:$('#smtp-from').value.trim(),from_name:$('#smtp-name').value.trim(),
        password:$('#smtp-password').value,tenant_id:$('#smtp-tenant').value.trim(),client_id:$('#smtp-client').value.trim(),client_secret:$('#smtp-secret').value
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
  const baseShell=shell;shell=function(){if(state.view==='notifications')renderNotifications();else baseShell()};
})();