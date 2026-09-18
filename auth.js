(function(){
  window.__ikAuthUser=null;
  try{
    const request=new XMLHttpRequest();
    request.open('GET','/api/auth/me',false);
    request.send();
    if(request.status>=200&&request.status<300)window.__ikAuthUser=JSON.parse(request.responseText);
  }catch{}

  const logout=async()=>{
    await fetch('/api/auth/logout',{method:'POST'}).catch(()=>{});
    location.reload();
  };

  const passwordModal=()=>{
    if(typeof modal!=='function')return;
    modal('Şifre değiştir',`<div class="form-grid account-password-form">
      <div class="field" style="grid-column:1/-1"><label>Mevcut şifre</label><input class="input" id="password-current" type="password" autocomplete="current-password"></div>
      <div class="field"><label>Yeni şifre</label><input class="input" id="password-new" type="password" autocomplete="new-password"></div>
      <div class="field"><label>Yeni şifre tekrar</label><input class="input" id="password-confirm" type="password" autocomplete="new-password"></div>
      <small class="muted" style="grid-column:1/-1">Yeni şifre en az 8 karakter olmalıdır.</small>
    </div>`,async()=>{
      const current=document.querySelector('#password-current').value;
      const next=document.querySelector('#password-new').value;
      const confirm=document.querySelector('#password-confirm').value;
      if(!current||next.length<8)return toast('Yeni şifre en az 8 karakter olmalıdır');
      if(next!==confirm)return toast('Yeni şifreler eşleşmiyor');
      const submit=document.querySelector('.modal .submit');
      if(submit)submit.disabled=true;
      try{
        const response=await fetch('/api/auth/password',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({current_password:current,new_password:next})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Şifre değiştirilemedi');
        closeModal();
        toast('Şifreniz değiştirildi');
      }catch(error){toast(error.message)}
      finally{if(submit)submit.disabled=false}
    });
  };

  const savedTheme=()=>{try{return localStorage.getItem('ik_theme')}catch{return null}};
  const isDarkNow=()=>document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme: dark)').matches);
  const applyTheme=dark=>{
    document.documentElement.dataset.theme=dark?'dark':'light';
    try{localStorage.setItem('ik_theme',dark?'dark':'light')}catch{}
  };
  const currentLang=()=>window.__ikCurrentLang?window.__ikCurrentLang():(()=>{try{return localStorage.getItem('ik_lang')||'tr'}catch{return 'tr'}})();

  const setupAccountMenu=()=>{
    const host=document.querySelector('.top-actions'),avatar=host?.querySelector('.avatar');
    if(!host||!avatar||document.querySelector('#account-dropdown'))return;
    avatar.type='button';
    avatar.setAttribute('aria-label','Hesap menüsü');
    avatar.setAttribute('aria-expanded','false');
    const menu=document.createElement('div');
    menu.id='account-dropdown';
    menu.className='account-dropdown';
    const identity=document.createElement('div');
    identity.className='account-identity';
    const name=document.createElement('strong');
    name.textContent=window.__ikAuthUser.name||window.__ikAuthUser.username;
    const username=document.createElement('small');
    username.textContent='@'+window.__ikAuthUser.username+' · '+window.__ikAuthUser.role;
    identity.append(name,username);
    const themeRow=document.createElement('div');
    themeRow.className='account-theme-row';
    const themeLabel=document.createElement('span');
    themeLabel.textContent='Gece modu';
    const themeSwitch=document.createElement('label');
    themeSwitch.className='theme-switch';
    const themeInput=document.createElement('input');
    themeInput.type='checkbox';
    themeInput.checked=isDarkNow();
    const themeTrack=document.createElement('span');
    themeTrack.className='theme-switch-track';
    themeSwitch.append(themeInput,themeTrack);
    themeRow.append(themeLabel,themeSwitch);
    themeInput.onchange=()=>applyTheme(themeInput.checked);
    const langRow=document.createElement('div');
    langRow.className='account-theme-row';
    const langLabel=document.createElement('span');
    langLabel.textContent='Dil / Language';
    const langPill=document.createElement('div');
    langPill.className='lang-pill';
    const trButton=document.createElement('button');
    trButton.type='button';trButton.textContent='TR';
    const enButton=document.createElement('button');
    enButton.type='button';enButton.textContent='EN';
    const syncLangButtons=()=>{
      const lang=currentLang();
      trButton.classList.toggle('active',lang!=='en');
      enButton.classList.toggle('active',lang==='en');
    };
    syncLangButtons();
    trButton.onclick=()=>{if(currentLang()!=='tr')window.__ikSetLanguage?.('tr')};
    enButton.onclick=()=>{if(currentLang()!=='en')window.__ikSetLanguage?.('en')};
    langPill.append(trButton,enButton);
    langRow.append(langLabel,langPill);
    const passwordButton=document.createElement('button');
    passwordButton.type='button';passwordButton.textContent='Şifre değiştir';
    const logoutButton=document.createElement('button');
    logoutButton.type='button';logoutButton.className='danger-text';logoutButton.textContent='Çıkış yap';
    menu.append(identity,themeRow,langRow,passwordButton,logoutButton);
    host.appendChild(menu);
    const close=()=>{menu.classList.remove('open');avatar.setAttribute('aria-expanded','false')};
    avatar.onclick=event=>{event.stopPropagation();const open=menu.classList.toggle('open');avatar.setAttribute('aria-expanded',String(open))};
    passwordButton.onclick=()=>{close();passwordModal()};
    logoutButton.onclick=()=>{close();logout()};
    document.addEventListener('click',event=>{if(!menu.contains(event.target)&&event.target!==avatar)close()});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')close()});
  };

  const ready=()=>{
    const form=document.querySelector('#login-form'),error=document.querySelector('#login-error');
    if(window.__ikAuthUser){
      document.body.classList.add('auth-ok');
      setupAccountMenu();
      return;
    }
    document.body.classList.add('auth-required');
    document.querySelector('#auth-loading')?.setAttribute('hidden','');
    document.querySelector('#login-card')?.removeAttribute('hidden');
    const remembered=(()=>{try{return localStorage.getItem('ik_remember_user')||''}catch{return ''}})();
    if(remembered&&form){form.username.value=remembered;if(form.remember)form.remember.checked=true;form.password.focus()}
    form?.addEventListener('submit',async event=>{
      event.preventDefault();error.textContent='';const button=form.querySelector('button');button.disabled=true;
      try{
        const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Giriş yapılamadı');
        try{
          if(form.remember?.checked)localStorage.setItem('ik_remember_user',form.username.value.trim());
          else localStorage.removeItem('ik_remember_user');
        }catch{}
        location.reload();
      }catch(problem){error.textContent=problem.message}
      finally{button.disabled=false}
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
