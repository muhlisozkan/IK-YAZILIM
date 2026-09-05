(function(){
  const storageKey='ik_shifts',weekKey='ik_shifts_week',departmentKey='ik_shifts_department';
  let shifts=JSON.parse(localStorage.getItem(storageKey)||'[]');
  const types=['A','B','C','D','E','F','M','AB','G','Y','O','Ü','Ö','ÇRT','ÇRT.','RT','RT.','ÇHT','DV','UZ','R.','R'];
  const pad=n=>String(n).padStart(2,'0');
  const isoDate=date=>`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  const weekStart=week=>{const [year,number]=week.split('-W').map(Number),jan4=new Date(year,0,4),day=(jan4.getDay()+6)%7;const start=new Date(jan4);start.setDate(jan4.getDate()-day+(number-1)*7);start.setHours(0,0,0,0);return start};
  const isoWeek=date=>{const local=new Date(date);local.setHours(0,0,0,0);local.setDate(local.getDate()+3-((local.getDay()+6)%7));const firstThursday=new Date(local.getFullYear(),0,4);firstThursday.setDate(firstThursday.getDate()+3-((firstThursday.getDay()+6)%7));return `${local.getFullYear()}-W${pad(1+Math.round((local-firstThursday)/604800000))}`};
  const selectedWeek=()=>localStorage.getItem(weekKey)||isoWeek(new Date());
  const weekLabel=week=>{const start=weekStart(week),end=new Date(start);end.setDate(start.getDate()+6);const fmt=date=>date.toLocaleDateString('tr-TR',{day:'numeric',month:'long'});return start.getMonth()===end.getMonth()?`${start.getDate()}-${end.toLocaleDateString('tr-TR',{day:'numeric',month:'long'})}`:`${fmt(start)}-${fmt(end)}`};
  const itemFor=(employeeId,date)=>shifts.find(item=>String(item.employee_id)===String(employeeId)&&item.date===date);
  const bodyFor=(employeeId,date,type)=>{const user=window.__ikCurrentUser?.()||{};return {employee_id:Number(employeeId),work_date:date,shift_type:type,actor_name:user.name||user.role||''}};
  const sendShift=async(employeeId,date,type)=>{
    const response=await fetch('/api/shifts',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(bodyFor(employeeId,date,type))});
    if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||'Vardiya kaydedilemedi')}
  };
  const loadShifts=async(days)=>{
    const start=days[0].date,end=days[days.length-1].date;
    const response=await fetch(`/api/shifts?start=${start}&end=${end}`);
    if(!response.ok)throw new Error('Vardiya kayıtları alınamadı');
    const remote=await response.json(),remoteKeys=new Set(remote.map(item=>`${item.employee_id}|${item.date}`));
    const legacy=shifts.filter(item=>item.date>=start&&item.date<=end&&!item.employee_id).map(item=>({...item,employee_id:state.employees.find(employee=>employee.name===item.employee)?.id})).filter(item=>item.employee_id&&item.type&&!remoteKeys.has(`${item.employee_id}|${item.date}`));
    if(legacy.length){
      const migrated=await Promise.allSettled(legacy.map(item=>sendShift(item.employee_id,item.date,item.type).then(()=>item)));
      migrated.filter(result=>result.status==='fulfilled').forEach(result=>remote.push(result.value));
    }
    shifts=shifts.filter(item=>item.date<start||item.date>end);
    shifts.push(...remote.map(item=>({employee_id:item.employee_id,employee:item.employee,date:item.date,type:item.type,start:'',end:''})));
    localStorage.setItem(storageKey,JSON.stringify(shifts));
  };
  const cellOptions=item=>`<option value="">—</option>${types.map(type=>`<option value="${type}" ${item?.type===type?'selected':''}>${type}</option>`).join('')}`;
  async function renderShifts(){
    document.querySelectorAll('.nav-item').forEach(button=>button.classList.toggle('active',button.dataset.view==='shifts'));
    $('#page-title').textContent='Haftalık Vardiya Planı';
    const currentWeek=isoWeek(new Date()),nextDate=new Date();nextDate.setDate(nextDate.getDate()+7);const nextWeek=isoWeek(nextDate);let week=selectedWeek();if(week!==currentWeek&&week!==nextWeek)week=currentWeek;
    const start=weekStart(week);localStorage.setItem(weekKey,week);localStorage.setItem('ik_attendance_period',isoDate(start).slice(0,7));
    const days=Array.from({length:7},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return {date:isoDate(date),label:date.toLocaleDateString('tr-TR',{weekday:'short',day:'numeric',month:'short'})}});
    try{await loadShifts(days)}catch(error){toast(error.message)}
    const isAdmin=window.__ikCurrentUser?.()?.role==='Sistem yöneticisi';
    const departments=[...new Set(state.employees.map(employee=>employee.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    const department=isAdmin?(localStorage.getItem(departmentKey)||''):'';
    const employees=isAdmin&&!department?[]:state.employees.filter(employee=>!department||employee.department===department);
    const rows=employees.map(employee=>`<tr><td class="shift-person"><strong>${employee.name}</strong><small class="muted" style="display:block">${employee.department}</small></td>${days.map(day=>`<td><select class="select shift-select" data-employee-id="${employee.id}" data-date="${day.date}">${cellOptions(itemFor(employee.id,day.date))}</select></td>`).join('')}</tr>`).join('');
    const departmentFilter=isAdmin?`<div class="field"><label>Departman</label><select class="select" id="shift-department"><option value="">Tüm departmanlar</option>${departments.map(value=>`<option value="${value}" ${value===department?'selected':''}>${value}</option>`).join('')}</select></div>`:'';
    $('#app').innerHTML=`<div class="section-title"><div><h2>Haftalık vardiya planı</h2><span class="muted">Haftayı seçin; vardiyalar sunucuya kaydedilir ve günü geldiğinde saat 17.00'de puantaja aktarılır</span></div></div><div class="card shift-toolbar"><div class="field"><label>Planlama haftası</label><input class="input" id="shift-week" type="week" value="${week}"></div>${departmentFilter}<button class="btn secondary" id="shift-current-week">Bu hafta</button><span class="muted">Puantajdaki Normal satırında bulunan kodlar kullanılır.</span></div><div class="card shift-card"><div class="shift-scroll"><table class="shift-table"><thead><tr><th>ÇALIŞAN</th>${days.map(day=>`<th>${day.label}</th>`).join('')}</tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">Çalışan bulunmuyor</td></tr>'}</tbody></table></div></div><div class="formula" style="margin-top:18px"><strong>Günlük otomatik aktarım:</strong> Haftalık plan kaydedilir; yalnızca içinde bulunulan günün vardiyaları Türkiye saatiyle 17.00'de puantajın Normal satırına aktarılır. Gelecek günler kendi günlerinde aktarılır.</div>`;
    const shiftCutoff=new Date();shiftCutoff.setHours(0,0,0,0);shiftCutoff.setDate(shiftCutoff.getDate()-1);
    document.querySelectorAll('.shift-select').forEach(select=>{select.disabled=new Date(`${select.dataset.date}T00:00:00`)<shiftCutoff;if(select.disabled)select.title='Bu vardiya günü için değişiklik süresi doldu'});
    $('#shift-week').style.display='none';const weekPicker=document.createElement('select');weekPicker.id='shift-week-display';weekPicker.className='select';weekPicker.innerHTML=`<option value="${currentWeek}">${weekLabel(currentWeek)}</option><option value="${nextWeek}">${weekLabel(nextWeek)}</option>`;weekPicker.value=week;$('#shift-week').parentNode.appendChild(weekPicker);
    weekPicker.onchange=()=>{localStorage.setItem(weekKey,weekPicker.value);renderShifts()};
    if($('#shift-department'))$('#shift-department').onchange=()=>{localStorage.setItem(departmentKey,$('#shift-department').value);renderShifts()};
    $('#shift-current-week').onclick=()=>{localStorage.setItem(weekKey,currentWeek);renderShifts()};
    document.querySelectorAll('.shift-select').forEach(select=>{select.dataset.savedValue=select.value;select.onchange=async()=>{
      const previous=select.dataset.savedValue||'';select.disabled=true;
      try{
        await sendShift(select.dataset.employeeId,select.dataset.date,select.value);
        const index=shifts.findIndex(item=>String(item.employee_id)===select.dataset.employeeId&&item.date===select.dataset.date);
        if(select.value){const employee=state.employees.find(item=>String(item.id)===select.dataset.employeeId);const record={employee_id:Number(select.dataset.employeeId),employee:employee?.name||'',date:select.dataset.date,type:select.value,start:'',end:''};if(index>=0)shifts[index]=record;else shifts.push(record)}else if(index>=0)shifts.splice(index,1);
        localStorage.setItem(storageKey,JSON.stringify(shifts));select.dataset.savedValue=select.value;toast('Vardiya sunucuya kaydedildi; günü saat 17.00’de puantaja aktarılacak');
      }catch(error){select.value=previous;toast(error.message)}
      finally{select.disabled=false}
    }});
  }
  const baseShell=shell;shell=function(){if(state.view==='shifts')renderShifts();else baseShell()};
})();
