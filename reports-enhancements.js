(function(){
  const salaryOn=()=>window.__ikAuthUser?.can_see_salary!==false;
  function exportReport(){
    const withSalary=salaryOn();
    const head=(withSalary?'Çalışan,Departman,Durum,Brüt Ücret':'Çalışan,Departman,Durum')+'\n';
    const body=state.employees.map(e=>{
      const cols=[e.name,e.department,e.status];
      if(withSalary)cols.push(e.salary);
      return cols.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');
    }).join('\n');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+head+body],{type:'text/csv;charset=utf-8'}));a.download='ik-calisan-raporu.csv';a.click();URL.revokeObjectURL(a.href);
  }
  reports=function(){
    const withSalary=salaryOn();
    const total=state.employees.reduce((a,e)=>a+Number(e.salary||0),0);
    const departments=[...new Set(state.employees.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
    const salaryStat=withSalary?`<div class="card stat"><span class="label">Toplam brüt ücret</span><div class="value">${fmt(total)}</div></div>`:'';
    $('#app').innerHTML=`<div class="section-title"><div><h2>Raporlar</h2><span class="muted">Kadro, izin ve ücret özetleri</span></div><button class="btn" id="export-report">CSV indir</button></div><div class="grid stats"><div class="card stat"><span class="label">Toplam çalışan</span><div class="value">${state.employees.length}</div></div><div class="card stat"><span class="label">Aktif çalışan</span><div class="value">${state.employees.filter(e=>e.status==='Aktif').length}</div></div><div class="card stat"><span class="label">Bekleyen izin</span><div class="value">${state.leaves.filter(l=>l.status==='Bekliyor').length}</div></div>${salaryStat}</div><div class="card" style="margin-top:20px"><div class="card-head"><h2>Departman özeti</h2><select class="select" id="report-dept"><option value="">Tüm departmanlar</option>${departments.map(d=>`<option>${d}</option>`).join('')}</select></div><div style="overflow:auto"><table id="report-table"><thead><tr><th>ÇALIŞAN</th><th>DEPARTMAN</th><th>DURUM</th>${withSalary?'<th>BRÜT ÜCRET</th>':''}</tr></thead><tbody>${state.employees.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr')).map(e=>`<tr data-department="${e.department}"><td>${e.name}</td><td>${e.department}</td><td>${e.status}</td>${withSalary?`<td>${fmt(e.salary||0)}</td>`:''}</tr>`).join('')}</tbody></table></div></div>`;
    $('#export-report').onclick=exportReport;
    $('#report-dept').onchange=e=>document.querySelectorAll('#report-table tbody tr').forEach(r=>r.style.display=!e.target.value||r.dataset.department===e.target.value?'':'none');
  };
})();
