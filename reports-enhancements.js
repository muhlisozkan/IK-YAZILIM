(function(){
  const salaryOn=()=>window.__ikAuthUser?.can_see_salary!==false;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const trSort=(a,b)=>String(a??'').localeCompare(String(b??''),'tr');
  const dateStr=v=>v?String(v).slice(0,10):'';
  const trDate=v=>v?new Date(v).toLocaleDateString('tr-TR'):'—';
  const num=v=>Number(v||0).toLocaleString('tr-TR',{maximumFractionDigits:1});
  const yearOf=v=>v?Number(String(v).slice(0,4)):null;

  // Ortak yardımcılar -------------------------------------------------------
  const firstStart=e=>e.first_employment_start_date||e.start_date||e.start;
  function serviceYears(e){
    const s=new Date(firstStart(e));if(isNaN(s))return 0;
    const end=e.termination_date?new Date(e.termination_date):new Date();
    let y=end.getFullYear()-s.getFullYear();
    if(end<new Date(end.getFullYear(),s.getMonth(),s.getDate()))y--;
    return Math.max(0,y);
  }
  const deptList=()=>[...new Set((state.employees||[]).map(e=>e.department).filter(Boolean))].sort(trSort);
  const empDept=id=>((state.employees||[]).find(e=>String(e.id)===String(id))||{}).department||'';

  function downloadCsv(name,header,rows){
    const line=cols=>cols.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',');
    const csv='﻿'+[line(header),...rows.map(line)].join('\r\n');
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    a.download=name;a.click();URL.revokeObjectURL(a.href);
  }

  let tab=sessionStorage.getItem('ik_report_tab')||'employees';
  const tabs=[
    ['employees','Çalışanlar'],
    ['leaves','İzin Talepleri'],
    ['balances','Yıllık İzin Bakiyesi'],
    ['departments','Departman Özeti'],
    ['turnover','İşten Ayrılanlar'],
    ['seniority','Kıdem ve Yıl Dönümü']
  ];
  const state_f={};// filtre durumları sekme bazında saklanır

  function shellHtml(body){
    return `<div class="section-title"><div><h2>Raporlar</h2><span class="muted">Filtrelenebilir kadro, izin ve kıdem raporları</span></div></div>
      <div class="leave-tabs" style="margin-bottom:16px">${tabs.map(([k,l])=>`<button class="btn ${tab===k?'':'secondary'}" data-report-tab="${k}">${l}</button>`).join('')}</div>
      <div id="report-body">${body}</div>`;
  }
  function mount(body){
    $('#app').innerHTML=shellHtml(body);
    document.querySelectorAll('[data-report-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.reportTab;sessionStorage.setItem('ik_report_tab',tab);render();});
  }
  function field(label,inner){return `<div class="field"><label>${label}</label>${inner}</div>`;}
  function selectEl(id,opts,selected){
    return `<select class="select" id="${id}">${opts.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(selected||'')?'selected':''}>${esc(l)}</option>`;}).join('')}</select>`;
  }
  const statLine=items=>`<div class="grid stats" style="margin-bottom:16px">${items.map(([l,v])=>`<div class="card stat"><span class="label">${l}</span><div class="value">${v}</div></div>`).join('')}</div>`;

  // 1) ÇALIŞANLAR ---------------------------------------------------------
  function renderEmployees(){
    const f=state_f.employees||(state_f.employees={dept:'',status:'',workplace:'',q:''});
    const withSalary=salaryOn();
    const hasWorkplace=(state.employees||[]).some(e=>e.workplace);
    const statuses=[...new Set((state.employees||[]).map(e=>e.status).filter(Boolean))].sort(trSort);
    const workplaces=[...new Set((state.employees||[]).map(e=>e.workplace).filter(Boolean))].sort(trSort);
    const q=f.q.toLocaleLowerCase('tr-TR');
    const list=(state.employees||[]).filter(e=>
      (!f.dept||e.department===f.dept)&&
      (!f.status||e.status===f.status)&&
      (!f.workplace||e.workplace===f.workplace)&&
      (!q||`${e.name} ${e.department} ${e.title||''} ${e.payroll_sicil||''}`.toLocaleLowerCase('tr-TR').includes(q))
    ).sort((a,b)=>trSort(a.name,b.name));
    const totalSalary=list.reduce((s,e)=>s+Number(e.salary||0),0);
    const rows=list.map(e=>`<tr>
      <td><strong>${esc(e.name)}</strong>${e.payroll_sicil?`<small class="muted" style="display:block">Sicil: ${esc(e.payroll_sicil)}</small>`:''}</td>
      <td>${esc(e.department||'—')}</td><td>${esc(e.title||'—')}</td>
      ${hasWorkplace?`<td>${esc(e.workplace||'—')}</td>`:''}
      <td>${trDate(firstStart(e))}</td><td>${serviceYears(e)} yıl</td>
      <td><span class="badge ${e.status==='Aktif'?'green':e.status==='Pasif'?'red':'orange'}">${esc(e.status||'—')}</span></td>
      ${withSalary?`<td>${fmt(e.salary||0)}</td>`:''}
    </tr>`).join('');
    mount(`${statLine([['Kayıt',list.length],['Aktif',list.filter(e=>e.status==='Aktif').length],...(withSalary?[['Toplam brüt',fmt(totalSalary)]]:[])])}
      <div class="card">
        <div class="form-grid" style="margin-bottom:12px">
          ${field('Ara',`<input class="input" id="rf-q" placeholder="İsim, pozisyon, sicil…" value="${esc(f.q)}">`)}
          ${field('Departman',selectEl('rf-dept',[['','Tüm departmanlar'],...deptList()],f.dept))}
          ${field('Durum',selectEl('rf-status',[['','Tüm durumlar'],...statuses],f.status))}
          ${hasWorkplace?field('İşyeri',selectEl('rf-workplace',[['','Tüm işyerleri'],...workplaces],f.workplace)):''}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn" id="rf-csv">CSV indir</button></div>
        <div style="overflow:auto"><table><thead><tr>
          <th>ÇALIŞAN</th><th>DEPARTMAN</th><th>POZİSYON</th>${hasWorkplace?'<th>İŞYERİ</th>':''}<th>İLK İŞE GİRİŞ</th><th>KIDEM</th><th>DURUM</th>${withSalary?'<th>BRÜT ÜCRET</th>':''}
        </tr></thead><tbody>${rows||`<tr><td colspan="9" class="empty">Kayıt bulunamadı</td></tr>`}</tbody></table></div>
      </div>`);
    const upd=()=>{f.q=$('#rf-q').value;f.dept=$('#rf-dept').value;f.status=$('#rf-status').value;if($('#rf-workplace'))f.workplace=$('#rf-workplace').value;renderEmployees();};
    $('#rf-q').oninput=()=>{f.q=$('#rf-q').value;clearTimeout(window.__rfT);window.__rfT=setTimeout(renderEmployees,250);};
    $('#rf-dept').onchange=upd;$('#rf-status').onchange=upd;if($('#rf-workplace'))$('#rf-workplace').onchange=upd;
    $('#rf-csv').onclick=()=>downloadCsv('calisan-raporu.csv',
      ['Çalışan','Sicil','Departman','Pozisyon',...(hasWorkplace?['İşyeri']:[]),'İlk işe giriş','Kıdem (yıl)','Durum',...(withSalary?['Brüt ücret']:[])],
      list.map(e=>[e.name,e.payroll_sicil||'',e.department||'',e.title||'',...(hasWorkplace?[e.workplace||'']:[]),dateStr(firstStart(e)),serviceYears(e),e.status||'',...(withSalary?[e.salary||0]:[])]));
  }

  // 2) İZİN TALEPLERİ ----------------------------------------------------
  function renderLeaves(){
    const all=state.leaves||[];
    const f=state_f.leaves||(state_f.leaves={year:'',dept:'',type:'',status:'',q:''});
    const years=[...new Set(all.map(l=>yearOf(l.start_date||l.start)).filter(Boolean))].sort((a,b)=>b-a);
    const types=[...new Set(all.map(l=>l.leave_type||l.type).filter(Boolean))].sort(trSort);
    const statuses=[...new Set(all.map(l=>l.status).filter(Boolean))].sort(trSort);
    const q=f.q.toLocaleLowerCase('tr-TR');
    const withDept=l=>l.department||empDept(l.employee_id);
    const list=all.map(l=>({...l,_dept:withDept(l),_year:yearOf(l.start_date||l.start),_type:l.leave_type||l.type,_name:l.employee_name||l.employee})).filter(l=>
      (!f.year||String(l._year)===String(f.year))&&
      (!f.dept||l._dept===f.dept)&&
      (!f.type||l._type===f.type)&&
      (!f.status||l.status===f.status)&&
      (!q||String(l._name||'').toLocaleLowerCase('tr-TR').includes(q))
    ).sort((a,b)=>dateStr(b.start_date||b.start).localeCompare(dateStr(a.start_date||a.start)));
    const totalDays=list.reduce((s,l)=>s+Number(l.days||0),0);
    const approvedDays=list.filter(l=>l.status==='Onaylandı').reduce((s,l)=>s+Number(l.days||0),0);
    const rows=list.map(l=>`<tr>
      <td><strong>${esc(l._name)}</strong></td><td>${esc(l._dept||'—')}</td><td>${esc(l._type||'—')}</td>
      <td>${trDate(l.start_date||l.start)}</td><td>${trDate(l.end_date||l.end)}</td><td>${num(l.days)}</td>
      <td><span class="badge ${l.status==='Onaylandı'?'green':l.status==='Reddedildi'?'red':'orange'}">${esc(l.status||'—')}</span></td>
    </tr>`).join('');
    mount(`${statLine([['Talep',list.length],['Toplam gün',num(totalDays)],['Onaylı gün',num(approvedDays)]])}
      <div class="card">
        <div class="form-grid" style="margin-bottom:12px">
          ${field('Ara',`<input class="input" id="rf-q" placeholder="Çalışan adı…" value="${esc(f.q)}">`)}
          ${field('Yıl',selectEl('rf-year',[['','Tüm yıllar'],...years],f.year))}
          ${field('Departman',selectEl('rf-dept',[['','Tüm departmanlar'],...deptList()],f.dept))}
          ${field('İzin türü',selectEl('rf-type',[['','Tüm türler'],...types],f.type))}
          ${field('Durum',selectEl('rf-status',[['','Tüm durumlar'],...statuses],f.status))}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn" id="rf-csv">CSV indir</button></div>
        <div style="overflow:auto"><table><thead><tr>
          <th>ÇALIŞAN</th><th>DEPARTMAN</th><th>TÜR</th><th>BAŞLANGIÇ</th><th>BİTİŞ</th><th>GÜN</th><th>DURUM</th>
        </tr></thead><tbody>${rows||`<tr><td colspan="7" class="empty">İzin kaydı bulunamadı</td></tr>`}</tbody></table></div>
      </div>`);
    const upd=()=>{f.q=$('#rf-q').value;f.year=$('#rf-year').value;f.dept=$('#rf-dept').value;f.type=$('#rf-type').value;f.status=$('#rf-status').value;renderLeaves();};
    $('#rf-q').oninput=()=>{f.q=$('#rf-q').value;clearTimeout(window.__rfT);window.__rfT=setTimeout(renderLeaves,250);};
    ['rf-year','rf-dept','rf-type','rf-status'].forEach(id=>$('#'+id).onchange=upd);
    $('#rf-csv').onclick=()=>downloadCsv('izin-raporu.csv',
      ['Çalışan','Departman','İzin türü','Başlangıç','Bitiş','Gün','Durum'],
      list.map(l=>[l._name,l._dept||'',l._type||'',dateStr(l.start_date||l.start),dateStr(l.end_date||l.end),l.days||0,l.status||'']));
  }

  // 3) YILLIK İZİN BAKİYESİ --------------------------------------------
  async function renderBalances(){
    const f=state_f.balances||(state_f.balances={year:String(new Date().getFullYear()),dept:'',negative:false});
    const token=++renderBalances._t;
    mount(`<div class="card empty">Yıllık izin bakiyeleri yükleniyor…</div>`);
    let data;
    try{
      const query=new URLSearchParams({year:f.year});if(f.dept)query.set('department',f.dept);
      const r=await fetch('/api/annual-leave-balances?'+query.toString(),{cache:'no-store'});
      if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||'Bakiye alınamadı');
      data=await r.json();
    }catch(err){if(token===renderBalances._t)mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(token!==renderBalances._t||tab!=='balances')return;
    const deps=(data.departments||deptList());
    let rows=(data.rows||[]).slice().sort((a,b)=>trSort(a.employee_name,b.employee_name));
    if(f.negative)rows=rows.filter(r=>Number(r.remaining_days)<0);
    const t=data.totals||{entitled:0,used:0,remaining:0};
    const body=`${statLine([['Kişi',rows.length],['Toplam hak',num(t.entitled)],['Kullanılan',num(t.used)],['Kalan',num(t.remaining)]])}
      <div class="card">
        <div class="form-grid" style="margin-bottom:12px">
          ${field('Yıl',selectEl('rf-year',[f.year-2,f.year-1,f.year,Number(f.year)+1].map(String).filter((v,i,a)=>a.indexOf(v)===i),f.year))}
          ${field('Departman',selectEl('rf-dept',[['','Tüm departmanlar'],...deps],f.dept))}
          ${field('Filtre',`<label style="display:flex;align-items:center;gap:8px;font-size:13px"><input type="checkbox" id="rf-neg" ${f.negative?'checked':''}> Sadece negatif bakiye</label>`)}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn" id="rf-csv">CSV indir</button></div>
        <div style="overflow:auto"><table><thead><tr>
          <th>ÇALIŞAN</th><th>DEPARTMAN</th><th>TOPLAM HAK</th><th>BU YIL</th><th>KULLANILAN</th><th>KALAN</th>
        </tr></thead><tbody>${rows.map(r=>`<tr>
          <td><strong>${esc(r.employee_name)}</strong></td><td>${esc(r.department||'—')}</td>
          <td>${num(r.entitled_days)}</td><td>${num(r.current_year_days)}</td><td>${num(r.used_days)}</td>
          <td><strong style="color:${Number(r.remaining_days)<0?'var(--danger,#c0392b)':'inherit'}">${num(r.remaining_days)}</strong></td>
        </tr>`).join('')||`<tr><td colspan="6" class="empty">Kayıt yok</td></tr>`}</tbody></table></div>
      </div>`;
    mount(body);
    const reload=()=>{f.year=$('#rf-year').value;f.dept=$('#rf-dept').value;f.negative=$('#rf-neg').checked;renderBalances();};
    $('#rf-year').onchange=reload;$('#rf-dept').onchange=reload;$('#rf-neg').onchange=reload;
    $('#rf-csv').onclick=()=>downloadCsv(`yillik-izin-bakiyesi-${f.year}.csv`,
      ['Çalışan','Departman','Toplam hak','Bu yıl hak edilen','Kullanılan','Kalan'],
      rows.map(r=>[r.employee_name,r.department||'',r.entitled_days,r.current_year_days,r.used_days,r.remaining_days]));
  }

  // 4) DEPARTMAN ÖZETİ -------------------------------------------------
  function renderDepartments(){
    const withSalary=salaryOn();
    const groups={};
    (state.employees||[]).forEach(e=>{(groups[e.department||'—']=groups[e.department||'—']||[]).push(e);});
    const list=Object.entries(groups).sort((a,b)=>trSort(a[0],b[0])).map(([d,arr])=>{
      const active=arr.filter(e=>e.status==='Aktif').length;
      const totalSal=arr.reduce((s,e)=>s+Number(e.salary||0),0);
      const avgSen=arr.reduce((s,e)=>s+serviceYears(e),0)/arr.length;
      return {d,count:arr.length,active,totalSal,avgSal:totalSal/arr.length,avgSen};
    });
    mount(`${statLine([['Departman',list.length],['Çalışan',(state.employees||[]).length],['Aktif',(state.employees||[]).filter(e=>e.status==='Aktif').length]])}
      <div class="card">
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn" id="rf-csv">CSV indir</button></div>
        <div style="overflow:auto"><table><thead><tr>
          <th>DEPARTMAN</th><th>ÇALIŞAN</th><th>AKTİF</th><th>ORT. KIDEM</th>${withSalary?'<th>TOPLAM BRÜT</th><th>ORT. BRÜT</th>':''}
        </tr></thead><tbody>${list.map(r=>`<tr>
          <td><strong>${esc(r.d)}</strong></td><td>${r.count}</td><td>${r.active}</td><td>${num(r.avgSen)} yıl</td>
          ${withSalary?`<td>${fmt(r.totalSal)}</td><td>${fmt(r.avgSal)}</td>`:''}
        </tr>`).join('')||`<tr><td colspan="6" class="empty">Kayıt yok</td></tr>`}</tbody></table></div>
      </div>`);
    $('#rf-csv').onclick=()=>downloadCsv('departman-ozeti.csv',
      ['Departman','Çalışan','Aktif','Ortalama kıdem (yıl)',...(withSalary?['Toplam brüt','Ortalama brüt']:[])],
      list.map(r=>[r.d,r.count,r.active,num(r.avgSen),...(withSalary?[r.totalSal,Math.round(r.avgSal)]:[])]));
  }

  // 5) İŞTEN AYRILANLAR ----------------------------------------------
  function renderTurnover(){
    const leavers=(state.employees||[]).filter(e=>e.termination_date);
    const f=state_f.turnover||(state_f.turnover={year:'',dept:''});
    const years=[...new Set(leavers.map(e=>yearOf(e.termination_date)).filter(Boolean))].sort((a,b)=>b-a);
    const list=leavers.filter(e=>(!f.year||String(yearOf(e.termination_date))===String(f.year))&&(!f.dept||e.department===f.dept))
      .sort((a,b)=>dateStr(b.termination_date).localeCompare(dateStr(a.termination_date)));
    const headcount=(state.employees||[]).length;
    const rate=headcount?(leavers.filter(e=>!f.year||String(yearOf(e.termination_date))===String(f.year)).length/headcount*100):0;
    mount(`${statLine([['Ayrılan',list.length],['Kadro',headcount],['Devir oranı',num(rate)+'%']])}
      <div class="card">
        <div class="form-grid" style="margin-bottom:12px">
          ${field('Yıl',selectEl('rf-year',[['','Tüm yıllar'],...years],f.year))}
          ${field('Departman',selectEl('rf-dept',[['','Tüm departmanlar'],...deptList()],f.dept))}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn" id="rf-csv">CSV indir</button></div>
        <div style="overflow:auto"><table><thead><tr>
          <th>ÇALIŞAN</th><th>DEPARTMAN</th><th>İŞE GİRİŞ</th><th>ÇIKIŞ</th><th>ÇALIŞMA SÜRESİ</th>
        </tr></thead><tbody>${list.map(e=>`<tr>
          <td><strong>${esc(e.name)}</strong></td><td>${esc(e.department||'—')}</td>
          <td>${trDate(firstStart(e))}</td><td>${trDate(e.termination_date)}</td><td>${serviceYears(e)} yıl</td>
        </tr>`).join('')||`<tr><td colspan="5" class="empty">İşten ayrılan kaydı yok</td></tr>`}</tbody></table></div>
      </div>`);
    ['rf-year','rf-dept'].forEach(id=>$('#'+id).onchange=()=>{f.year=$('#rf-year').value;f.dept=$('#rf-dept').value;renderTurnover();});
    $('#rf-csv').onclick=()=>downloadCsv('isten-ayrilanlar.csv',
      ['Çalışan','Departman','İşe giriş','Çıkış tarihi','Çalışma süresi (yıl)'],
      list.map(e=>[e.name,e.department||'',dateStr(firstStart(e)),dateStr(e.termination_date),serviceYears(e)]));
  }

  // 6) KIDEM VE YIL DÖNÜMÜ ------------------------------------------
  const months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  function renderSeniority(){
    const f=state_f.seniority||(state_f.seniority={month:String(new Date().getMonth()+1),dept:''});
    const active=(state.employees||[]).filter(e=>!e.termination_date&&e.status!=='Pasif');
    const buckets=[['0-1 yıl',0,1],['1-5 yıl',1,5],['5-10 yıl',5,10],['10-15 yıl',10,15],['15+ yıl',15,999]];
    const dist=buckets.map(([l,lo,hi])=>[l,active.filter(e=>{const y=serviceYears(e);return y>=lo&&y<hi;}).length]);
    const anniv=active.filter(e=>{const d=new Date(firstStart(e));return !isNaN(d)&&d.getMonth()+1===Number(f.month)&&(!f.dept||e.department===f.dept);})
      .map(e=>({...e,day:new Date(firstStart(e)).getDate(),years:serviceYears(e)+1}))
      .sort((a,b)=>a.day-b.day||trSort(a.name,b.name));
    mount(`${statLine(dist.map(([l,v])=>[l,v]))}
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><h2>Kıdem dağılımı</h2><span class="muted">${active.length} aktif çalışan</span></div>
        ${dist.map(([l,v])=>`<div style="margin:12px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px"><span>${l}</span><span class="muted">${v}</span></div><div class="bar"><i style="width:${active.length?v/active.length*100:0}%"></i></div></div>`).join('')}
      </div>
      <div class="card">
        <div class="card-head"><h2>Ay içinde işe giriş yıl dönümü</h2></div>
        <div class="form-grid" style="margin-bottom:12px">
          ${field('Ay',selectEl('rf-month',months.map((m,i)=>[String(i+1),m]),f.month))}
          ${field('Departman',selectEl('rf-dept',[['','Tüm departmanlar'],...deptList()],f.dept))}
        </div>
        <div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn" id="rf-csv">CSV indir</button></div>
        <div style="overflow:auto"><table><thead><tr>
          <th>GÜN</th><th>ÇALIŞAN</th><th>DEPARTMAN</th><th>İŞE GİRİŞ</th><th>TAMAMLANAN YIL</th>
        </tr></thead><tbody>${anniv.map(e=>`<tr>
          <td>${e.day} ${months[Number(f.month)-1]}</td><td><strong>${esc(e.name)}</strong></td>
          <td>${esc(e.department||'—')}</td><td>${trDate(firstStart(e))}</td><td>${e.years}. yıl</td>
        </tr>`).join('')||`<tr><td colspan="5" class="empty">Bu ay yıl dönümü yok</td></tr>`}</tbody></table></div>
      </div>`);
    ['rf-month','rf-dept'].forEach(id=>$('#'+id).onchange=()=>{f.month=$('#rf-month').value;f.dept=$('#rf-dept').value;renderSeniority();});
    $('#rf-csv').onclick=()=>downloadCsv(`yil-donumu-${months[Number(f.month)-1]}.csv`,
      ['Gün','Çalışan','Departman','İşe giriş','Tamamlanan yıl'],
      anniv.map(e=>[e.day,e.name,e.department||'',dateStr(firstStart(e)),e.years]));
  }

  renderBalances._t=0;
  function render(){
    ({employees:renderEmployees,leaves:renderLeaves,balances:renderBalances,
      departments:renderDepartments,turnover:renderTurnover,seniority:renderSeniority}[tab]||renderEmployees)();
  }
  reports=render;
})();
