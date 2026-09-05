(function(){
  const key='ik_approval_routes';
  const routes=JSON.parse(localStorage.getItem(key)||'{}');
  const approvers=['Departman yöneticisi','İK yöneticisi','Finans yöneticisi','Genel müdür','Genel müdür yardımcısı','Bölge yöneticisi'];
  const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  const selectOptions=value=>approvers.map(x=>`<option ${x===value?'selected':''}>${x}</option>`).join('');
  const getRoute=dept=>{if(!Array.isArray(routes[dept])||!routes[dept].filter(Boolean).length)routes[dept]=['Departman yöneticisi','İK yöneticisi'];else routes[dept]=routes[dept].filter(Boolean);return routes[dept]};
  function approvalCard(){
    if(!['Sistem yöneticisi','İK yöneticisi'].includes(window.__ikCurrentUser?.()?.role))return;
    const departments=[...new Set((state.employees||[]).map(e=>e.department).filter(Boolean))];
    const rows=departments.map(dept=>{const route=getRoute(dept);return `<div class="approval-row" data-dept="${esc(dept)}"><strong>${esc(dept)}</strong><div class="approval-steps">${route.map((x,i)=>`<span class="approval-step-wrap"><select class="select approval-step" data-dept="${esc(dept)}" data-step="${i}">${selectOptions(x)}</select>${i>0?'<button type="button" class="approval-remove" title="Adımı kaldır" data-remove-step="1">×</button>':''}</span>`).join('<span class="approval-arrow">→</span>')}</div><button type="button" class="btn ghost approval-add" data-add-step="1">+ İzin akışı ekle</button></div>`}).join('');
    const box=document.createElement('div');box.className='card approval-card';box.innerHTML=`<div class="card-head"><div><h2>İzin onay akışı</h2><span class="muted">Departmana göre sınırsız sıralı onaycı ekleyin</span></div><button class="btn" id="save-approval">Akışları kaydet</button></div>${rows||'<div class="empty">Onay akışı tanımlamak için önce çalışan ekleyin.</div>'}<div class="formula" style="margin-top:14px">Yeni izin talepleri seçilen sıraya göre ilerler. Her adım bir önceki onaydan sonra açılır.</div>`;$('#app').appendChild(box);
    box.addEventListener('click',e=>{const add=e.target.closest('[data-add-step]');if(add){const row=add.closest('.approval-row'),dept=row.dataset.dept,route=getRoute(dept);route.push('İK yöneticisi');localStorage.setItem(key,JSON.stringify(routes));leave();return}const remove=e.target.closest('[data-remove-step]');if(remove){const row=remove.closest('.approval-row'),dept=row.dataset.dept,idx=[...row.querySelectorAll('.approval-step')].indexOf(remove.parentElement.querySelector('select'));getRoute(dept).splice(idx,1);if(!getRoute(dept).length)getRoute(dept).push('Departman yöneticisi');localStorage.setItem(key,JSON.stringify(routes));leave()}});
    $('#save-approval').onclick=()=>{document.querySelectorAll('.approval-row').forEach(row=>{routes[row.dataset.dept]=[...row.querySelectorAll('.approval-step')].map(s=>s.value)});localStorage.setItem(key,JSON.stringify(routes));toast('İzin onay akışları kaydedildi')};
  }
  const baseLeave=leave;leave=function(){baseLeave();approvalCard()};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.modal')&&window.closeModal)window.closeModal()});
  document.addEventListener('click',e=>{if(e.target.classList.contains('modal'))window.closeModal&&window.closeModal()});
})();
