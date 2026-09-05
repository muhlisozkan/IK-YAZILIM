(function(){
  let selectedDepartment='';
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const dateKey=()=>{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`};
  const isApproved=value=>value==='Onaylandı';
  const isCurrentLeave=leave=>isApproved(leave.status)&&String(leave.start||'')<=dateKey()&&String(leave.end||'')>=dateKey();
  const isSickType=type=>/hastalık|rapor/i.test(String(type||''));

  function donutStyle(parts,total){
    if(!total)return 'conic-gradient(#e9edf4 0 100%)';
    let cursor=0;
    const stops=parts.filter(part=>part.value>0).map(part=>{const start=cursor;cursor+=part.value/total*100;return `${part.color} ${start}% ${cursor}%`});
    return `conic-gradient(${stops.join(',')||'#e9edf4 0 100%'})`;
  }

  function metric(label,value,total,color,detail){
    const percent=total?Math.round(value/total*100):0;
    return `<article class="card dashboard-metric"><div class="metric-ring" style="--metric:${percent};--metric-color:${color}" role="img" aria-label="${esc(label)}: ${value}, yüzde ${percent}"><div><strong>${value}</strong><span>${percent}%</span></div></div><div class="metric-copy"><span>${esc(label)}</span><strong>${esc(detail)}</strong></div></article>`;
  }

  function largeChart(title,total,parts,centerLabel){
    const legend=parts.map(part=>`<li><span class="legend-color" style="background:${part.color}"></span><span>${esc(part.label)}</span><strong>${part.value}</strong></li>`).join('');
    return `<article class="card dashboard-chart"><div class="card-head"><div><h2>${esc(title)}</h2><span class="muted">Seçili kapsama ait anlık dağılım</span></div></div><div class="chart-body"><div class="large-donut" style="background:${donutStyle(parts,total)}" role="img" aria-label="${esc(title)}"><div><strong>${total}</strong><span>${esc(centerLabel)}</span></div></div><ul class="chart-legend">${legend||'<li class="muted">Gösterilecek veri yok</li>'}</ul></div></article>`;
  }

  dashboard=function(){
    $('#page-title').textContent='Genel Bakış';
    const employees=(state.employees||[]).filter(employee=>employee.status!=='Pasif');
    const departments=[...new Set(employees.map(employee=>employee.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    if(selectedDepartment&&!departments.includes(selectedDepartment))selectedDepartment='';
    const scoped=employees.filter(employee=>!selectedDepartment||employee.department===selectedDepartment);
    const currentLeaves=(state.leaves||[]).filter(isCurrentLeave);
    const leaveByName=new Map(currentLeaves.map(leave=>[leave.employee,leave]));
    const sick=scoped.filter(employee=>isSickType(employee.status)||isSickType(leaveByName.get(employee.name)?.type));
    const sickNames=new Set(sick.map(employee=>employee.name));
    const onLeave=scoped.filter(employee=>!sickNames.has(employee.name)&&(employee.status==='İzinli'||leaveByName.has(employee.name)));
    const leaveNames=new Set(onLeave.map(employee=>employee.name));
    const working=scoped.filter(employee=>!sickNames.has(employee.name)&&!leaveNames.has(employee.name));
    const total=scoped.length;
    const pending=(state.leaves||[]).filter(leave=>leave.status==='Bekliyor'&&scoped.some(employee=>employee.name===leave.employee)).length;
    const statusParts=[
      {label:'Görevde',value:working.length,color:'#4967f4'},
      {label:'İzinli',value:onLeave.length,color:'#f59e0b'},
      {label:'Raporlu',value:sick.length,color:'#e55261'}
    ];
    const departmentParts=departments.map((department,index)=>({
      label:department,
      value:scoped.filter(employee=>employee.department===department).length,
      color:['#4967f4','#18a874','#f59e0b','#8b5cf6','#06b6d4','#e55261','#64748b'][index%7]
    })).filter(part=>part.value);
    const absent=[...sick.map(employee=>({employee,type:leaveByName.get(employee.name)?.type||'Raporlu',kind:'red',end:leaveByName.get(employee.name)?.end})),...onLeave.map(employee=>({employee,type:leaveByName.get(employee.name)?.type||'İzinli',kind:'orange',end:leaveByName.get(employee.name)?.end}))];
    const absentRows=absent.map(item=>`<tr><td><div class="person"><span class="person-avatar">${esc(initials(item.employee.name))}</span><span><strong>${esc(item.employee.name)}</strong><small class="muted" style="display:block">${esc(item.employee.title||'Pozisyon belirtilmemiş')}</small></span></div></td><td>${esc(item.employee.department||'-')}</td><td><span class="badge ${item.kind}">${esc(item.type)}</span></td><td>${item.end?new Date(`${item.end}T00:00:00`).toLocaleDateString('tr-TR'):'-'}</td></tr>`).join('');

    $('#app').innerHTML=`<div class="dashboard-heading"><div><h2>İK durum dashboard'u</h2><p>Güncel kadro, izin ve rapor durumlarını tek ekranda izleyin.</p></div><div class="dashboard-filter"><label for="dashboard-department">Departman</label><select class="select" id="dashboard-department"><option value="">Tüm departmanlar</option>${departments.map(department=>`<option value="${esc(department)}" ${selectedDepartment===department?'selected':''}>${esc(department)}</option>`).join('')}</select></div></div>
      <div class="dashboard-metrics">
        ${metric('Güncel çalışan',total,total,'#18a874',selectedDepartment||'Tüm şirket')}
        ${metric('Görevde',working.length,total,'#4967f4','Aktif olarak çalışıyor')}
        ${metric('İzinli',onLeave.length,total,'#f59e0b','Bugün izinli')}
        ${metric('Raporlu',sick.length,total,'#e55261','Bugün raporlu')}
      </div>
      <div class="dashboard-charts">
        ${largeChart('Çalışan durumları',total,statusParts,'çalışan')}
        ${largeChart(selectedDepartment?'Seçili departman':'Departman dağılımı',total,departmentParts,'kişi')}
      </div>
      <div class="card dashboard-absence"><div class="card-head"><div><h2>Bugün izinli ve raporlu çalışanlar</h2><span class="muted">${absent.length} çalışan · ${pending} bekleyen izin talebi</span></div><button class="btn ghost" data-go="leave">İzin yönetimine git →</button></div><div class="dashboard-table"><table><thead><tr><th>ÇALIŞAN</th><th>DEPARTMAN</th><th>DURUM</th><th>BİTİŞ</th></tr></thead><tbody>${absentRows||'<tr><td colspan="4" class="empty">Bugün izinli veya raporlu çalışan bulunmuyor.</td></tr>'}</tbody></table></div></div>`;
    $('#dashboard-department').onchange=event=>{selectedDepartment=event.target.value;dashboard()};
    bindGo();
  };

  if(state.view==='dashboard')dashboard();
})();
