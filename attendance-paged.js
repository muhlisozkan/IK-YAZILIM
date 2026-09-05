(function(){
  const store=attendanceStore, shiftStore=()=>JSON.parse(localStorage.getItem('ik_shifts')||'[]'), pageSize=25;
  const codes=['A','B','C','D','E','F','M','AB','G','Y','O','Ü','Ö','ÇRT','ÇRT.','RT','RT.','ÇHT','DV','UZ','R.','R'];
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const entryBody=(key,value)=>{
    const parts=key.split('-'),user=window.__ikCurrentUser?.()||{};
    return {employee_id:Number(parts[2]),work_date:`${parts[0]}-${parts[1]}-${String(Number(parts[3])).padStart(2,'0')}`,work_type:parts[4],value,actor_role:user.role||'',actor_department:user.department||'',actor_name:user.name||''};
  };
  const sendEntry=async(key,value)=>{
    const response=await fetch('/api/attendance',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(entryBody(key,value))});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Puantaj kaydedilemedi')}
  };
  const loadMonth=async month=>{
    const response=await fetch(`/api/attendance?month=${encodeURIComponent(month)}`);
    if(!response.ok)throw new Error('Puantaj kayıtları alınamadı');
    const remote=await response.json();
    Object.keys(store).filter(key=>key.startsWith(month+'-')).forEach(key=>delete store[key]);
    Object.assign(store,remote);
    localStorage.setItem('ik_attendance',JSON.stringify(store));
  };
  const saveEntry=async select=>{
    const previous=select.dataset.savedValue||'';
    select.disabled=true;
    try{
      await sendEntry(select.dataset.key,select.value);
      if(select.value)store[select.dataset.key]=select.value;else delete store[select.dataset.key];
      select.dataset.savedValue=select.value;
      localStorage.setItem('ik_attendance',JSON.stringify(store));
      toast('Puantaj sunucuya kaydedildi');
    }catch(error){select.value=previous;toast(error.message||'Puantaj kaydedilemedi')}
    finally{select.disabled=false}
  };
  const exportTemplate=async(employees,month,department)=>{
    const reportEmployees=employees.map(e=>({id:e.id,name:e.name,payroll_sicil:e.payroll_sicil||'',department:e.department||''}));
    const response=await fetch('/api/attendance-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({employees:reportEmployees,month,department,attendance:store})});
    if(!response.ok){toast('Excel raporu oluşturulamadı');return}
    const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`puantaj-${department||'tum-departmanlar'}-${month}.xlsx`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  window.attendance=async function(){
    let page=1,search='',department='',month=attMonth();
    const key=(id,d,type)=>`${month}-${id}-${d}-${type}`;
    const canEditWithoutDateLimit=()=>{
      const user=window.__ikCurrentUser?.()||{};
      return ['Sistem yöneticisi','İK yöneticisi'].includes(user.role)||user.department==='İnsan Kaynakları';
    };
    const editable=(date)=>{
      if(canEditWithoutDateLimit())return true;
      if(month!==attMonth())return false;
      const d=new Date(`${date}T00:00:00`),today=new Date();
      today.setHours(0,0,0,0);
      const earliest=new Date(today);earliest.setDate(earliest.getDate()-2);
      return d>=earliest;
    };
    const options=(id,d,type,employeeName)=>{const date=`${month}-${String(d).padStart(2,'0')}`,shiftValue=type==='normal'?(shiftStore().find(item=>item.employee===employeeName&&item.date===date)?.type||''):'';const value=store[key(id,d,type)]||shiftValue;return type==='normal'?codes.map(s=>`<option ${value===s?'selected':''}>${s}</option>`).join(''):['0.5','1','1.5','2','2.5','3'].map(s=>`<option value="${s}" ${String(value||'')===s?'selected':''}>${s}</option>`).join('')};
    function render(){
      const [year,monthNumber]=month.split('-').map(Number),days=new Date(year,monthNumber,0).getDate();
      const unrestricted=canEditWithoutDateLimit();
      const filtered=[...state.employees].filter(e=>(!search||`${e.name} ${e.department} ${e.payroll_sicil||''}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR')))&&(!department||e.department===department)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr')),
        pages=Math.max(1,Math.ceil(filtered.length/pageSize)); page=Math.min(page,pages); const list=filtered.slice((page-1)*pageSize,page*pageSize);
      const rows=list.flatMap(e=>['normal','fazla'].map((type,index)=>`<tr>${index===0?`<td rowspan="2" class="att-person"><strong>${e.name}</strong><small class="muted" style="display:block">${e.payroll_sicil||''} · ${e.department}</small></td>`:''}<td class="att-type ${type}">${type==='normal'?'Normal':'Fazla Mesai'}</td>${Array.from({length:days},(_,i)=>`<td><select class="att-select" data-key="${key(e.id,i+1,type)}"><option value="">—</option>${options(e.id,i+1,type,e.name)}</select></td>`).join('')}</tr>`)).join('');
      const isAdmin=window.__ikCurrentUser?.()?.role==='Sistem yöneticisi';
      const departmentFilter=isAdmin?`<select class="select" id="att-department"><option value="">Tüm departmanlar</option>${[...new Set(state.employees.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr')).map(d=>`<option ${department===d?'selected':''}>${d}</option>`).join('')}</select>`:'';
      $('#app').innerHTML=`<div class="section-title"><div><h2>Puantaj ve devam</h2><span class="muted">${month} dönemi · ${filtered.length} çalışan · Sayfa ${page}/${pages} · Hücre değişiklikleri otomatik kaydedilir</span></div></div><div class="card"><div class="toolbar"><input class="input" id="att-search" placeholder="Çalışan, sicil veya departman ara…" value="${search}">${departmentFilter}<button class="btn secondary" id="att-export">Excel raporu</button><button class="btn ghost" id="att-prev" ${page<=1?'disabled':''}>← Önceki</button><button class="btn ghost" id="att-next" ${page>=pages?'disabled':''}>Sonraki →</button></div><div class="att-scroll"><table class="att-table"><thead><tr><th>Çalışan</th><th>Çalışma tipi</th>${Array.from({length:days},(_,i)=>`<th>${i+1}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${days+2}" class="empty">Çalışan bulunmuyor</td></tr>`}</tbody></table></div></div><div class="formula" style="margin-top:18px">${unrestricted?'<strong>Yetkili düzenleme:</strong> Sistem yöneticisi ve İK kullanıcıları tüm puantaj dönemlerinde değişiklik yapabilir.':'<strong>Düzenleme sınırı:</strong> Yalnızca güncel ayda, geriye dönük son 2 gün ve sonrası için işlem yapılabilir. Yeni aya geçildiğinde önceki ay salt okunur olur.'}<br><small>Excel raporu seçili departman veya tüm departmanlar için indirilebilir.</small></div>`;
      $('#att-search').oninput=e=>{search=e.target.value;page=1;render()}; if($('#att-department')) $('#att-department').onchange=e=>{department=e.target.value;page=1;render()}; $('#att-prev').onclick=()=>{page--;render()}; $('#att-next').onclick=()=>{page++;render()}; $('#att-export').onclick=()=>exportTemplate(filtered,month,department);
      document.querySelectorAll('.att-select').forEach(s=>{s.dataset.savedValue=s.value;s.onchange=()=>saveEntry(s)});
      const monthInput=document.createElement('input'); monthInput.type='month'; monthInput.id='att-month'; monthInput.className='input'; monthInput.value=month; monthInput.title='Puantaj dönemi'; document.querySelector('.toolbar').prepend(monthInput);
      monthInput.onchange=async()=>{month=monthInput.value||attMonth();page=1;monthInput.disabled=true;try{await loadMonth(month);render()}catch(error){toast(error.message)}finally{monthInput.disabled=false}};
      document.querySelectorAll('.att-select').forEach(select=>{const parts=select.dataset.key.split('-'), day=parts[3],canEdit=editable(`${month}-${String(day).padStart(2,'0')}`);select.disabled=!canEdit;if(!canEdit)select.title=month===attMonth()?'Bu tarih için 2 günlük düzeltme süresi doldu':'Önceki aylarda puantaj değiştirilemez'});
    }
    try{await loadMonth(month)}catch(error){toast(error.message)}
    render();
  };
})();
