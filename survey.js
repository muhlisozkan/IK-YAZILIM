(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tabs=[
    ['personel','Personel Anketi'],
    ['makeitright','Make It Right']
  ];
  let tab=sessionStorage.getItem('ik_survey_tab')||'personel';

  function render(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='survey'));
    $('#page-title').textContent='Anket';
    if(!tabs.some(t=>t[0]===tab))tab='personel';
    const active=tabs.find(t=>t[0]===tab);
    $('#app').innerHTML=`<div class="section-title"><div><h2>Anket</h2><span class="muted">Personel anketleri ve Make It Right geri bildirimleri</span></div></div>
      <div class="leave-tabs" style="margin-bottom:16px;flex-wrap:wrap">${tabs.map(([k,l])=>`<button class="btn ${tab===k?'':'secondary'}" data-survey-tab="${k}">${l}</button>`).join('')}</div>
      <div class="card">
        <div class="card-head"><h2>${esc(active[1])}</h2></div>
        <div class="empty">Bu bölümün içeriği henüz kurgulanmadı.</div>
      </div>`;
    document.querySelectorAll('[data-survey-tab]').forEach(b=>b.onclick=()=>{
      tab=b.dataset.surveyTab;sessionStorage.setItem('ik_survey_tab',tab);render();
    });
  }

  const baseShell=shell;
  shell=function(){
    if(state.view==='survey'){
      if(window.__ikCan&&!window.__ikCan('survey')){state.view='dashboard';baseShell();return;}
      render();
    }else baseShell();
  };
})();
