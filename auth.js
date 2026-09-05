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
    const passwordButton=document.createElement('button');
    passwordButton.type='button';passwordButton.textContent='Şifre değiştir';
    const logoutButton=document.createElement('button');
    logoutButton.type='button';logoutButton.className='danger-text';logoutButton.textContent='Çıkış yap';
    menu.append(identity,passwordButton,logoutButton);
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
    form?.addEventListener('submit',async event=>{
      event.preventDefault();error.textContent='';const button=form.querySelector('button');button.disabled=true;
      try{
        const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Giriş yapılamadı');
        location.reload();
      }catch(problem){error.textContent=problem.message}
      finally{button.disabled=false}
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();
