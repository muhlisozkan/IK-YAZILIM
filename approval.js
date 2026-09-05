(function(){
  const key='ik_approval_routes';
  const processInfo={
    leave:{label:'İzin',defaults:['Departman yöneticisi','İK yöneticisi']},
    expense:{label:'Masraf',defaults:['Departman yöneticisi','Mali İşler']},
    advance:{label:'Avans',defaults:['Departman yöneticisi','İK yöneticisi','Mali İşler']}
  };
  const approvers=['Departman yöneticisi','İK yöneticisi','Mali İşler','Finans yöneticisi','Bordro yetkilisi','Genel müdür','Genel müdür yardımcısı','Bölge yöneticisi'];
  const stored=JSON.parse(localStorage.getItem(key)||'{}');
  const routes={leave:{},expense:{},advance:{}};
  Object.keys(processInfo).forEach(type=>{
    if(stored[type]&&typeof stored[type]==='object'&&!Array.isArray(stored[type]))routes[type]={...stored[type]};
  });
  Object.entries(stored).forEach(([department,value])=>{
    if(!processInfo[department]&&Array.isArray(value)&&!routes.leave[department])routes.leave[department]=value;
  });
  let activeType='leave';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const departments=()=>[...new Set((state.employees||[]).map(employee=>employee.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
  const getRoute=(type,department)=>{
    const configured=routes[type]?.[department];
    return Array.isArray(configured)&&configured.filter(Boolean).length?configured.filter(Boolean):[...processInfo[type].defaults];
  };
  const selectOptions=value=>approvers.map(role=>`<option ${role===value?'selected':''}>${esc(role)}</option>`).join('');

  function matrixRows(type){
    return departments().map(department=>{
      const route=getRoute(type,department);
      return `<div class="approval-row" data-dept="${esc(department)}">
        <strong>${esc(department)}</strong>
        <div class="approval-steps">${route.map((role,index)=>`<span class="approval-step-wrap"><select class="select approval-step" data-step="${index}">${selectOptions(role)}</select>${index>0?'<button type="button" class="approval-remove" title="Onay adımını kaldır" data-remove-step="1">×</button>':''}</span>`).join('<span class="approval-arrow">→</span>')}</div>
        <button type="button" class="btn ghost approval-add" data-add-step="1">+ Onay adımı</button>
      </div>`;
    }).join('');
  }

  function renderMatrix(){
    if(state.view!=='users'||window.__ikCurrentUser?.()?.role!=='Sistem yöneticisi')return;
    document.querySelector('#approval-matrix')?.remove();
    const box=document.createElement('div');
    box.id='approval-matrix';
    box.className='card approval-card';
    box.innerHTML=`<div class="card-head"><div><h2>Onay Yetki Matrisi</h2><span class="muted">İzin, masraf ve avans taleplerinin departman bazlı sıralı onay akışını yönetin</span></div><div class="toolbar" style="margin:0"><select class="select" id="approval-process">${Object.entries(processInfo).map(([type,info])=>`<option value="${type}" ${type===activeType?'selected':''}>${info.label} yönetimi</option>`).join('')}</select><button class="btn" id="save-approval">Matrisi kaydet</button></div></div>
      <div class="formula"><strong>${processInfo[activeType].label} onay sırası:</strong> Bir adım tamamlanmadan sonraki onaycı talebi göremez. Yapılan değişiklikler yalnızca yeni oluşturulan taleplere uygulanır.</div>
      ${matrixRows(activeType)||'<div class="empty">Matris oluşturmak için önce çalışanlara departman tanımlayın.</div>'}`;
    document.querySelector('#app').appendChild(box);
    box.querySelector('#approval-process').onchange=event=>{activeType=event.target.value;renderMatrix()};
    box.addEventListener('click',event=>{
      const row=event.target.closest('.approval-row');
      if(!row)return;
      const department=row.dataset.dept;
      const current=[...row.querySelectorAll('.approval-step')].map(select=>select.value);
      if(event.target.closest('[data-add-step]')){
        routes[activeType][department]=[...current,processInfo[activeType].defaults[Math.min(current.length,processInfo[activeType].defaults.length-1)]||'İK yöneticisi'];
        renderMatrix();
      }
      if(event.target.closest('[data-remove-step]')){
        const wrapper=event.target.closest('.approval-step-wrap');
        const index=[...row.querySelectorAll('.approval-step-wrap')].indexOf(wrapper);
        current.splice(index,1);
        routes[activeType][department]=current.length?current:[processInfo[activeType].defaults[0]];
        renderMatrix();
      }
    });
    box.querySelector('#save-approval').onclick=async()=>{
      routes[activeType]={};
      box.querySelectorAll('.approval-row').forEach(row=>{
        routes[activeType][row.dataset.dept]=[...row.querySelectorAll('.approval-step')].map(select=>select.value);
      });
      const button=box.querySelector('#save-approval');
      button.disabled=true;
      try{
        const response=await fetch('/api/shared-data/'+encodeURIComponent(key),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:routes})});
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(data.error||'Yetki matrisi kaydedilemedi');
        localStorage.setItem(key,JSON.stringify(routes));
        toast(processInfo[activeType].label+' onay matrisi sunucuya kaydedildi');
      }catch(error){toast(error.message)}
      finally{button.disabled=false}
    };
  }

  window.__ikRenderApprovalMatrix=renderMatrix;
})();