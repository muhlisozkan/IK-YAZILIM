(function(){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canManage=()=>{const u=window.__ikCurrentUser?.()||{};return ['Sistem yöneticisi','İK yöneticisi'].includes(u.role)||u.department==='İnsan Kaynakları';};
  const QTYPES=[['text','Açık uçlu (yazı)'],['single','Tek seçim'],['multi','Çok seçim'],['scale','Puanlama (ölçek)'],['yesno','Evet / Hayır']];
  const qtypeLabel=t=>(QTYPES.find(x=>x[0]===t)||['',''])[1];

  function previewControl(q,i){
    if(q.type==='text')return `<textarea class="input" rows="2" placeholder="Cevabınız…" disabled></textarea>`;
    if(q.type==='yesno')return ['Evet','Hayır'].map(o=>`<label class="sv-pv-opt"><input type="radio" name="pv${i}" disabled> ${o}</label>`).join('');
    if(q.type==='single')return (q.options||[]).filter(o=>o.label).map(o=>`<label class="sv-pv-opt"><input type="radio" name="pv${i}" disabled> ${esc(o.label)}</label>`).join('')||'<span class="muted">Seçenek eklenmedi</span>';
    if(q.type==='multi')return (q.options||[]).filter(o=>o.label).map(o=>`<label class="sv-pv-opt"><input type="checkbox" disabled> ${esc(o.label)}</label>`).join('')||'<span class="muted">Seçenek eklenmedi</span>';
    if(q.type==='scale'){
      const min=Math.round(Number(q.scale_min)||1),max=Math.round(Number(q.scale_max)||5);
      const nums=[];for(let n=min;n<=max&&nums.length<21;n++)nums.push(n);
      return `<div class="sv-pv-scale">${nums.map(n=>`<label><input type="radio" name="pv${i}" disabled><span>${n}</span></label>`).join('')}</div>${(q.scale_min_label||q.scale_max_label)?`<div class="sv-pv-scale-lbl"><span>${esc(q.scale_min_label||'')}</span><span>${esc(q.scale_max_label||'')}</span></div>`:''}`;
    }
    return '';
  }
  function brandPreviewHead(eyebrow,title,subtitle){
    return `<div class="brand-pv">
      <div class="brand-pv-eyebrow">Hilton Dalaman · ${esc(eyebrow)}</div>
      <div class="brand-pv-title">${esc(title||'')}</div>
      ${subtitle?`<div class="brand-pv-sub">${esc(subtitle)}</div>`:''}
    </div>`;
  }
  function surveyPreviewHtml(title,description,questions,eyebrow){
    return `<div class="sv-preview">
      ${brandPreviewHead(eyebrow||'Personel Anketi',title||'(anket başlığı)',description)}
      ${(questions||[]).map((q,i)=>`<div class="sv-pv-q"><div class="sv-pv-title">${i+1}. ${esc(q.title||'(başlıksız soru)')}${q.required?' <span class="danger-text">*</span>':''}</div>${q.detail?`<div class="muted" style="font-size:12px;margin:2px 0 8px">${esc(q.detail)}</div>`:''}${previewControl(q,i)}</div>`).join('')||'<div class="empty">Henüz soru yok</div>'}
      <button class="btn" type="button" disabled style="margin-top:14px">Yanıtları gönder</button>
    </div>`;
  }
  function previewSurvey(s,eyebrow){
    modal('Önizleme · '+(s.title||'Anket'),surveyPreviewHtml(s.title,s.description,s.questions,eyebrow),()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    const submit=document.querySelector('.modal .submit');if(submit){submit.textContent='Kapat';submit.onclick=closeModal;}
  }

  const canSeePersonel=()=>canManage();
  const tabList=()=>{
    const t=[];
    if(canSeePersonel())t.push(['personel','Personel Anketi']);
    t.push(['makeitright','Make It Right']);
    return t;
  };
  let tab=sessionStorage.getItem('ik_survey_tab')||'personel';
  const cache={};

  async function api(path,opt){
    const r=await fetch(path,opt);
    const d=r.status===204?null:await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d?.error||'İşlem tamamlanamadı');
    return d;
  }
  const load=async(kind,force)=>{
    if(!cache[kind]||force)cache[kind]=await api('/api/surveys?kind='+kind);
    return cache[kind];
  };

  function shellHtml(body){
    const list=tabList();
    const tabsHtml=list.length>1?`<div class="leave-tabs" style="margin-bottom:16px;flex-wrap:wrap">${list.map(([k,l])=>`<button class="btn ${tab===k?'':'secondary'}" data-survey-tab="${k}">${l}</button>`).join('')}</div>`:'';
    return `<div class="section-title"><div><h2>Anket</h2><span class="muted">Personel anketleri ve Make It Right (Ayın Personeli) oylaması</span></div></div>
      ${tabsHtml}
      <div id="survey-body">${body}</div>`;
  }
  function mount(body){
    $('#app').innerHTML=shellHtml(body);
    document.querySelectorAll('[data-survey-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.surveyTab;sessionStorage.setItem('ik_survey_tab',tab);render();});
  }

  async function renderPersonel(){
    // Canlı yenilemede (yeni yanıt geldiğinde) "Yükleniyor" titremesini önle
    if(!document.querySelector('#survey-tmpl-card'))mount('<div class="card empty">Yükleniyor…</div>');
    let list,sent;
    try{
      list=await load('personel');
      sent=await api('/api/surveys/sent').catch(()=>[]);
    }catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!=='personel')return;
    const manage=canManage();
    const rows=list.map(s=>`<tr data-id="${s.id}">
      <td><strong>${esc(s.title)}</strong>${s.description?`<small class="muted" style="display:block">${esc(s.description)}</small>`:''}</td>
      <td>${(s.questions||[]).length} soru</td>
      <td><span class="badge ${s.active?'green':'orange'}">${s.active?'Aktif':'Pasif'}</span></td>
      <td class="row-actions"><button class="btn ghost" data-survey-preview="${s.id}">Önizle</button>${manage?`${s.active?`<button class="btn ghost" data-survey-send="${s.id}">Gönder</button>`:''}<button class="btn ghost" data-survey-edit="${s.id}">Düzenle</button><button class="btn ghost" data-survey-copy="${s.id}">Kopyala</button><button class="btn ghost danger-text" data-survey-del="${s.id}">Sil</button>`:''}</td>
    </tr>`).join('');
    mount(`<div class="card" id="survey-tmpl-card">
      <div class="toolbar">
        ${manage?`<button class="btn" id="survey-add">+ Yeni anket şablonu</button>`:''}
        <span class="muted">${list.length} şablon</span>
      </div>
      <div style="overflow:auto"><table><thead><tr><th>ANKET</th><th>SORU</th><th>DURUM</th><th></th></tr></thead>
      <tbody>${rows||`<tr><td colspan="4" class="empty">Henüz anket şablonu yok</td></tr>`}</tbody></table></div>
    </div>
    ${sentCardHtml(sent)}`);
    if($('#survey-add'))$('#survey-add').onclick=()=>openBuilder('personel',null);
    document.querySelectorAll('[data-survey-report]').forEach(b=>b.onclick=()=>openSurveyReport(b.dataset.surveyReport));
    document.querySelectorAll('[data-survey-preview]').forEach(b=>b.onclick=()=>previewSurvey(list.find(s=>String(s.id)===b.dataset.surveyPreview)));
    document.querySelectorAll('[data-survey-edit]').forEach(b=>b.onclick=()=>openBuilder('personel',list.find(s=>String(s.id)===b.dataset.surveyEdit)));
    document.querySelectorAll('[data-survey-send]').forEach(b=>b.onclick=()=>{
      const s=list.find(x=>String(x.id)===b.dataset.surveySend);
      inviteModal('personel',{surveyId:s.id,title:s.title});
    });
    document.querySelectorAll('[data-survey-copy]').forEach(b=>b.onclick=()=>{
      const src=list.find(s=>String(s.id)===b.dataset.surveyCopy);
      openBuilder('personel',{...src,id:null,title:src.title+' (kopya)'});
    });
    document.querySelectorAll('[data-survey-del]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Bu anket şablonunu silmek istediğinize emin misiniz?'))return;
      try{await api('/api/surveys/'+b.dataset.surveyDel,{method:'DELETE'});await load('personel',true);renderPersonel();toast('Anket silindi');}
      catch(err){toast(err.message);}
    });
  }

  // --- Performans Değerlendirme (Performans sekmesi) -------------
  async function renderPerformance(){
    if(state.view!=='performance')return;
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='performance'));
    $('#page-title').textContent='Performans Değerlendirme';
    if(!canManage()){$('#app').innerHTML='<div class="card empty">Performans değerlendirme yönetimi için yetkiniz yok.</div>';return;}
    if(!document.querySelector('#perf-tmpl-card'))$('#app').innerHTML='<div class="section-title"><div><h2>Performans Değerlendirme</h2></div></div><div class="card empty">Yükleniyor…</div>';
    let list,sent;
    try{
      list=await api('/api/surveys?kind=performans');
      sent=await api('/api/surveys/sent?kind=performans').catch(()=>[]);
    }catch(err){$('#app').innerHTML=`<div class="card empty">${esc(err.message)}</div>`;return;}
    if(state.view!=='performance')return;
    const rows=list.map(s=>`<tr>
      <td><strong>${esc(s.title)}</strong>${s.description?`<small class="muted" style="display:block">${esc(s.description)}</small>`:''}</td>
      <td>${(s.questions||[]).length} soru</td>
      <td><span class="badge ${s.active?'green':'orange'}">${s.active?'Aktif':'Pasif'}</span></td>
      <td class="row-actions">
        <button class="btn ghost" data-perf-preview="${s.id}">Önizle</button>
        ${s.active?`<button class="btn ghost" data-perf-send="${s.id}">Gönder</button>`:''}
        <button class="btn ghost" data-perf-edit="${s.id}">Düzenle</button>
        <button class="btn ghost" data-perf-copy="${s.id}">Kopyala</button>
        <button class="btn ghost danger-text" data-perf-del="${s.id}">Sil</button>
      </td></tr>`).join('');
    $('#app').innerHTML=`
      <div class="section-title"><div><h2>Performans Değerlendirme</h2><span class="muted">FR/HR/015 · yetkinlik bazlı öz değerlendirme — anket gönderimi ve departman raporları</span></div></div>
      <div class="card" id="perf-tmpl-card">
        <div class="toolbar">
          <button class="btn" id="perf-add">+ Yeni değerlendirme formu</button>
          <span class="muted">${list.length} form</span>
        </div>
        <div style="overflow:auto"><table><thead><tr><th>FORM</th><th>SORU</th><th>DURUM</th><th></th></tr></thead>
        <tbody>${rows||`<tr><td colspan="4" class="empty">Henüz form yok</td></tr>`}</tbody></table></div>
      </div>
      ${sentCardHtml(sent)}`;
    $('#perf-add').onclick=()=>openBuilder('performans',null);
    document.querySelectorAll('[data-perf-preview]').forEach(b=>b.onclick=()=>previewSurvey(list.find(s=>String(s.id)===b.dataset.perfPreview),'Performans Değerlendirme'));
    document.querySelectorAll('[data-perf-edit]').forEach(b=>b.onclick=()=>openBuilder('performans',list.find(s=>String(s.id)===b.dataset.perfEdit)));
    document.querySelectorAll('[data-perf-copy]').forEach(b=>b.onclick=()=>{const src=list.find(s=>String(s.id)===b.dataset.perfCopy);openBuilder('performans',{...src,id:null,title:src.title+' (kopya)'});});
    document.querySelectorAll('[data-perf-send]').forEach(b=>b.onclick=()=>{const s=list.find(x=>String(x.id)===b.dataset.perfSend);inviteModal('performans',{surveyId:s.id,title:s.title});});
    document.querySelectorAll('[data-perf-del]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Bu formu silmek istediğinize emin misiniz?'))return;
      try{await api('/api/surveys/'+b.dataset.perfDel,{method:'DELETE'});renderPerformance();toast('Form silindi');}
      catch(err){toast(err.message);}
    });
    document.querySelectorAll('[data-survey-report]').forEach(b=>b.onclick=()=>openSurveyReport(b.dataset.surveyReport));
  }

  // --- Gönderilen anketler & rapor -------------------------------
  const fmtDT=v=>{ if(!v)return '—'; const d=new Date(v); return isNaN(d)?'—':d.toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
  const PIE_COLORS=['#4967f4','#18a874','#f59e0b','#e55261','#8b5cf6','#0ea5e9','#ec4899','#64748b','#14b8a6','#f97316'];

  function sentCardHtml(sent,kind){
    const eom=kind==='eom';
    const attr=eom?'data-eom-report':'data-survey-report';
    const heading=eom?'Gönderilen Make It Right anketleri':'Gönderilen anketler';
    const rows=(sent||[]).map(s=>{
      const delivered=s.delivered??s.sent, failed=s.failed??0;
      const rate=delivered?Math.round(s.responded/delivered*100):0;
      return `<tr>
        <td><button class="btn ghost" ${attr}="${s.id}" style="padding:2px 0;font-weight:700;text-align:left">${esc(s.title)}</button>
          <small class="muted" style="display:block">Son gönderim: ${esc(fmtDT(s.last_sent_at))}</small></td>
        <td>${delivered}</td><td>${failed?`<span class="danger-text">${failed}</span>`:'0'}</td><td>${s.opened}</td><td>${s.responded}</td>
        <td style="min-width:150px"><div class="bar"><i style="width:${rate}%"></i></div><small class="muted">%${rate} ${eom?'oy':'yanıt'}</small></td>
      </tr>`;
    }).join('');
    return `<div class="card" style="margin-top:18px">
      <div class="card-head"><div><h2>${heading}</h2><span class="muted">İsmine tıklayarak katılım durumunu ve grafikleri görün</span></div></div>
      <div style="overflow:auto"><table><thead><tr><th>${eom?'ŞABLON':'ANKET'}</th><th>ULAŞTI</th><th>BAŞARISIZ</th><th>AÇILDI</th><th>${eom?'OY KULLANDI':'YANITLADI'}</th><th>KATILIM</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="6" class="empty">Henüz gönderim yok</td></tr>`}</tbody></table></div>
    </div>`;
  }

  function repRecipTable(invites){
    const all=invites||[];
    const ok=all.filter(v=>v.sent_ok===true).length, bad=all.length-ok;
    return `<details class="rep-recips"><summary>Alıcı listesi (${all.length}) · ${ok} ulaştı${bad?` · <span class="danger-text">${bad} başarısız</span>`:''}</summary>
      <div style="overflow:auto"><table><thead><tr><th>ALICI</th><th>KANAL</th><th>DURUM</th><th>AÇILMA</th><th>KATILIM</th></tr></thead><tbody>
      ${(invites||[]).map(v=>{
        const st=v.used_at?'<span class="badge green">Katıldı</span>':(v.opened_at?'<span class="badge orange">Açtı</span>':(v.sent_ok?'<span class="badge blue">Gönderildi</span>':'<span class="badge red">Gönderilemedi</span>'));
        return `<tr><td>${esc(v.name||'—')}${v.sent_error?`<small class="muted" style="display:block">${esc(v.sent_error)}</small>`:''}</td><td>${v.channel==='sms'?'SMS':'E-posta'}</td><td>${st}</td><td>${esc(fmtDT(v.opened_at))}</td><td>${esc(fmtDT(v.used_at))}</td></tr>`;
      }).join('')||'<tr><td colspan="5" class="empty">Alıcı yok</td></tr>'}
      </tbody></table></div>
    </details>`;
  }

  function pieHtml(parts){
    const p=parts.map((x,i)=>({...x,color:x.color||PIE_COLORS[i%PIE_COLORS.length]}));
    const total=p.reduce((a,x)=>a+x.count,0);
    let cur=0;
    const stops=total
      ? p.filter(x=>x.count>0).map(x=>{const st=cur;cur+=x.count/total*100;return `${x.color} ${st}% ${cur}%`}).join(',')
      : '#e9edf4 0 100%';
    const legend=p.map(x=>`<li><span class="rep-dot" style="background:${x.color}"></span><span>${esc(x.label)}</span><strong>${x.count}</strong><em>${total?Math.round(x.count/total*100):0}%</em></li>`).join('');
    return `<div class="rep-chart"><div class="rep-pie" style="background:conic-gradient(${stops})" role="img"></div><ul class="rep-legend">${legend}</ul></div>`;
  }

  function reportTextCount(rep){
    return (rep.questions||[]).filter(q=>q.type==='text').reduce((a,q)=>a+((q.texts||[]).length),0);
  }
  function reportTabsHtml(rep){
    const n=reportTextCount(rep);
    const hasCompare=(rep.departmentCompare||[]).length>0;
    const depts=rep.departmentList||[];
    const cur=['summary','texts','compare'].includes(repTab)?repTab:'summary';
    const deptSel=depts.length?`<select class="select" id="rep-dept" style="margin-left:auto;font-size:12px;padding:6px 9px">
        <option value="">Tüm departmanlar</option>
        ${depts.map(d=>`<option value="${esc(d)}" ${repDept===d?'selected':''}>${esc(d)}</option>`).join('')}
      </select>`:'';
    return `<div class="rep-tabs" id="rep-tabs">
      <button type="button" class="rtab${cur==='summary'?' on':''}" data-rtab="summary">Özet ve grafikler</button>
      <button type="button" class="rtab${cur==='texts'?' on':''}" data-rtab="texts">Yazılı değerlendirmeler <span class="rtab-badge">${n}</span></button>
      ${hasCompare?`<button type="button" class="rtab${cur==='compare'?' on':''}" data-rtab="compare">Departman karşılaştırma</button>`:''}
      ${deptSel}
    </div>`;
  }
  function bindReportTabs(){
    const bar=document.querySelector('#rep-tabs');
    if(!bar)return;
    bar.querySelectorAll('.rtab').forEach(b=>b.onclick=()=>{
      repTab=b.dataset.rtab;
      bar.querySelectorAll('.rtab').forEach(x=>x.classList.toggle('on',x.dataset.rtab===repTab));
      document.querySelectorAll('#rep-body [data-rpanel]').forEach(p=>{p.hidden=p.dataset.rpanel!==repTab;});
      const body=document.querySelector('#rep-body');if(body)body.scrollTop=0;
    });
    const ds=bar.querySelector('#rep-dept');
    if(ds)ds.onchange=()=>{repDept=ds.value;reloadReport();};
  }
  function avgClass(v){ if(v==null)return ''; return v>=3.5?'avg-hi':(v>=2.5?'avg-mid':'avg-lo'); }
  function compareHtml(rep){
    const rows=rep.departmentCompare||[];
    const depts=rep.departmentList||[];
    if(!rows.length)return '<div class="empty">Puanlanabilir soru yok</div>';
    const activeDepts=depts.filter(d=>rows.some(r=>r.byDept.some(x=>x.department===d)));
    const other=[...new Set(rows.flatMap(r=>r.byDept.map(x=>x.department)))].filter(d=>!activeDepts.includes(d));
    const cols=[...activeDepts,...other];
    const cell=(r,d)=>{const x=r.byDept.find(y=>y.department===d);return x?`<td class="${avgClass(x.average)}" title="${x.answered} yanıt">${x.average.toFixed(2).replace('.',',')}</td>`:'<td class="muted">—</td>';};
    return `<div class="muted" style="font-size:12px;margin-bottom:10px">Her yetkinlik için departman ortalaması (1–4 ölçek; Evet/Hayır sorularında 1 = Evet). Yeşil ≥ 3,5 · mavi 2,5–3,5 · turuncu &lt; 2,5.</div>
      <div style="overflow:auto"><table class="rep-compare"><thead><tr><th>YETKİNLİK</th>${cols.map(d=>`<th>${esc(d)}</th>`).join('')}<th>GENEL</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td class="rc-q">${esc(r.title)}</td>${cols.map(d=>cell(r,d)).join('')}<td class="${avgClass(r.overall)}"><b>${r.overall!=null?r.overall.toFixed(2).replace('.',','):'—'}</b></td></tr>`).join('')}
      </tbody></table></div>`;
  }
  function reportHtml(rep){
    const t=rep.totals, delivered=t.delivered??t.sent, failed=t.failed??0;
    const statusParts=[
      {label:'Yanıtladı',count:t.responded,color:'#18a874'},
      {label:'Açtı, yanıtlamadı',count:Math.max(0,t.opened-t.responded),color:'#f59e0b'},
      {label:'Hiç açmadı',count:Math.max(0,delivered-t.opened),color:'#c3cad6'}
    ];
    const qList=(rep.questions||[]).map((q,i)=>({q,i}));
    const chartHtml=qList.filter(x=>x.q.type!=='text').map(({q,i})=>`<div class="rep-q">
        <div class="rep-q-h">${i+1}. ${esc(q.title||'')}</div>
        <div class="muted" style="font-size:12px">${q.answered} kişi yanıtladı</div>
        ${pieHtml((q.distribution||[]).map(d=>({label:d.label,count:d.count})))}
      </div>`).join('');
    const textQs=qList.filter(x=>x.q.type==='text');
    const textHtml=textQs.length
      ? textQs.map(({q,i})=>`<div class="rep-q">
          <div class="rep-q-h">${i+1}. ${esc(q.title||'')}</div>
          <div class="muted" style="font-size:12px">${(q.texts||[]).length} yazılı yanıt</div>
          ${(q.texts&&q.texts.length)
            ? `<ul class="rep-texts">${q.texts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
            : `<div class="muted" style="font-size:13px">Henüz yazılı yanıt yok</div>`}
        </div>`).join('')
      : '<div class="empty">Bu ankette elle yazılan (serbest metin) soru yok</div>';
    const cur=['summary','texts','compare'].includes(repTab)?repTab:'summary';
    const hasCompare=(rep.departmentCompare||[]).length>0;
    const deptNote=rep.department?`<div class="badge blue" style="margin-bottom:12px">Departman: ${esc(rep.department)}</div> `:'';
    return `<div id="rep-body">
      <div data-rpanel="summary"${cur==='summary'?'':' hidden'}>
        ${deptNote}
        <div class="rep-stats">
          <div class="rep-stat"><b>${delivered}</b><span>Ulaştı</span></div>
          <div class="rep-stat"><b${failed?' class="danger-text"':''}>${failed}</b><span>Başarısız</span></div>
          <div class="rep-stat"><b>${t.opened}</b><span>Açıldı (tıkladı)</span></div>
          <div class="rep-stat"><b>${t.responded}</b><span>Yanıtladı</span></div>
        </div>
        <div class="rep-q"><div class="rep-q-h">Yanıt durumu <span class="muted" style="font-weight:400">(ulaşan ${delivered} kişi üzerinden)</span></div>${pieHtml(statusParts)}</div>
        ${chartHtml||'<div class="empty">Bu ankette grafikli soru yok</div>'}
        ${repRecipTable(rep.invites)}
      </div>
      <div data-rpanel="texts"${cur==='texts'?'':' hidden'}>
        ${textHtml}
      </div>
      ${hasCompare?`<div data-rpanel="compare"${cur==='compare'?'':' hidden'}>${compareHtml(rep)}</div>`:''}
    </div>`;
  }

  function repSig(rep){
    const t=rep.totals||{};
    return [rep.department||'',t.sent,t.delivered,t.failed,t.opened,t.responded,
      (rep.questions||[]).map(q=>q.type==='text'?q.answered+'x'+((q.texts||[]).length):(q.distribution||[]).map(d=>d.count).join('.')).join('|'),
      (rep.departmentCompare||[]).map(r=>r.byDept.map(x=>x.average).join('.')).join('|')
    ].join(';');
  }
  let repTimer=null, repTab='summary', repDept='', repRepId=null, lastRepSig='';
  function paintReport(rep,keepScroll){
    const bar=document.querySelector('#rep-tabs'), body=document.querySelector('#rep-body');
    if(!body)return;
    const scroll=keepScroll?body.scrollTop:0, recipsOpen=body.querySelector('.rep-recips')?.open;
    if(bar)bar.outerHTML=reportTabsHtml(rep); else return;
    body.outerHTML=reportHtml(rep);
    bindReportTabs();
    const nb=document.querySelector('#rep-body');
    if(nb){nb.scrollTop=scroll;if(recipsOpen){const d=nb.querySelector('.rep-recips');if(d)d.open=true;}}
    lastRepSig=repSig(rep);
  }
  async function reloadReport(){
    if(!repRepId)return;
    let fresh;
    try{fresh=await api('/api/surveys/'+repRepId+'/report'+(repDept?'?department='+encodeURIComponent(repDept):''));}catch(err){return toast(err.message);}
    paintReport(fresh,true);
  }
  async function openSurveyReport(id){
    repTab='summary';repDept='';repRepId=id;
    let rep;
    try{rep=await api('/api/surveys/'+id+'/report');}catch(err){return toast(err.message);}
    modal('Rapor · '+esc(rep.survey.title),reportTabsHtml(rep)+reportHtml(rep),()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    bindReportTabs();
    lastRepSig=repSig(rep);
    const s=document.querySelector('.modal .submit');if(s){s.textContent='Kapat';s.onclick=closeModal;}
    // Rapor açıkken yeni yanıtları canlı yansıt
    clearInterval(repTimer);
    repTimer=setInterval(async()=>{
      const body=document.querySelector('#rep-body');
      if(!body||!document.body.contains(body)){clearInterval(repTimer);repTimer=null;return;}
      let fresh;
      try{fresh=await api('/api/surveys/'+repRepId+'/report'+(repDept?'?department='+encodeURIComponent(repDept):''));}catch(_){return;}
      if(repSig(fresh)===lastRepSig)return;
      paintReport(fresh,true);
      toast('Yeni yanıt geldi — rapor güncellendi');
    },3000);
  }

  // --- Anket şablonu oluşturucu ------------------------------------
  function blankQuestion(){return {title:'',detail:'',type:'text',required:false,options:[{label:'',score:0},{label:'',score:0}],scored:false,scale_min:1,scale_max:5,scale_min_label:'',scale_max_label:''};}
  function openBuilder(kind,existing){
    const editing=Boolean(existing&&existing.id);
    let title=existing?.title||'';
    let description=existing?.description||'';
    let active=existing?existing.active!==false:true;
    let questions=(existing?.questions||[]).map(q=>({...blankQuestion(),...q,options:(q.options||[]).map(o=>typeof o==='object'?{label:o.label||'',score:Number(o.score)||0}:{label:String(o),score:0})}));
    if(!questions.length)questions=[blankQuestion()];

    modal(editing?'Anket şablonunu düzenle':'Yeni anket şablonu','<div id="survey-builder"></div>',async()=>{
      const payload={kind,title:title.trim(),description:description.trim(),active,questions};
      if(!payload.title)return toast('Anket başlığı zorunludur');
      if(!payload.questions.some(q=>q.title.trim()))return toast('En az bir soru başlığı girin');
      const submit=document.querySelector('.modal .submit');if(submit)submit.disabled=true;
      try{
        if(editing)await api('/api/surveys/'+existing.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        else await api('/api/surveys',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        await load(kind,true);closeModal();
        if(kind==='performans')renderPerformance();else render();
        toast(editing?'Form güncellendi':'Form oluşturuldu');
      }catch(err){toast(err.message);if(submit)submit.disabled=false;}
    });
    document.querySelector('.modal')?.classList.add('survey-modal');

    let previewMode=false;
    const box=()=>document.querySelector('#survey-builder');
    function redraw(){
      const b=box();if(!b)return;
      const toggle=`<div style="display:flex;justify-content:flex-end;margin-bottom:10px"><button class="btn secondary" type="button" id="sv-preview-toggle">${previewMode?'✎ Düzenlemeye dön':'👁 Önizleme'}</button></div>`;
      if(previewMode){
        b.innerHTML=toggle+surveyPreviewHtml(title,description,questions);
        b.querySelector('#sv-preview-toggle').onclick=()=>{previewMode=false;redraw();};
        return;
      }
      b.innerHTML=toggle+`
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1"><label>Anket başlığı *</label><input class="input" id="sv-title" value="${esc(title)}"></div>
          <div class="field" style="grid-column:1/-1"><label>Açıklama</label><textarea class="input" id="sv-desc">${esc(description)}</textarea></div>
          <div class="field"><label>Durum</label><select class="select" id="sv-active"><option value="1" ${active?'selected':''}>Aktif</option><option value="0" ${!active?'selected':''}>Pasif</option></select></div>
        </div>
        <div style="margin-top:14px;font-weight:700;font-size:13px">Sorular (${questions.length})</div>
        <div id="sv-questions">${questions.map((q,i)=>questionCard(q,i)).join('')}</div>
        <button class="btn secondary" type="button" id="sv-addq" style="margin-top:10px">+ Soru ekle</button>`;
      bind();
    }
    function questionCard(q,i){
      const opts=(q.type==='single'||q.type==='multi')?`
        <div class="field" style="grid-column:1/-1">
          <label style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-q="${i}" data-k="scored" ${q.scored?'checked':''}> Seçenekler puanlı</label>
          <div class="sv-options">${q.options.map((o,j)=>`<div class="sv-opt"><input class="input" placeholder="Seçenek ${j+1}" data-q="${i}" data-opt="${j}" data-k="label" value="${esc(o.label)}">${q.scored?`<input class="input" type="number" style="min-width:80px;width:80px" placeholder="puan" data-q="${i}" data-opt="${j}" data-k="score" value="${esc(o.score)}">`:''}<button class="btn ghost danger-text" type="button" data-opt-del="${i}:${j}">×</button></div>`).join('')}</div>
          <button class="btn ghost" type="button" data-opt-add="${i}">+ Seçenek</button>
        </div>`:'';
      const scale=q.type==='scale'?`
        <div class="field"><label>En düşük puan</label><input class="input" type="number" data-q="${i}" data-k="scale_min" value="${esc(q.scale_min)}"></div>
        <div class="field"><label>En yüksek puan</label><input class="input" type="number" data-q="${i}" data-k="scale_max" value="${esc(q.scale_max)}"></div>
        <div class="field"><label>En düşük etiketi</label><input class="input" data-q="${i}" data-k="scale_min_label" placeholder="ör. Hiç katılmıyorum" value="${esc(q.scale_min_label)}"></div>
        <div class="field"><label>En yüksek etiketi</label><input class="input" data-q="${i}" data-k="scale_max_label" placeholder="ör. Kesinlikle katılıyorum" value="${esc(q.scale_max_label)}"></div>`:'';
      return `<div class="sv-qcard">
        <div class="sv-qhead"><strong>Soru ${i+1}</strong><span class="muted">${esc(qtypeLabel(q.type))}</span>
          <span style="flex:1"></span>
          <button class="btn ghost" type="button" data-q-up="${i}" ${i===0?'disabled':''}>↑</button>
          <button class="btn ghost" type="button" data-q-down="${i}" ${i===questions.length-1?'disabled':''}>↓</button>
          <button class="btn ghost danger-text" type="button" data-q-del="${i}">Sil</button>
        </div>
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1"><label>Soru başlığı *</label><input class="input" data-q="${i}" data-k="title" value="${esc(q.title)}"></div>
          <div class="field" style="grid-column:1/-1"><label>Soru detayı / açıklama</label><textarea class="input" data-q="${i}" data-k="detail">${esc(q.detail)}</textarea></div>
          <div class="field"><label>Cevap tipi</label><select class="select" data-q="${i}" data-k="type">${QTYPES.map(([v,l])=>`<option value="${v}" ${q.type===v?'selected':''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label>Zorunlu mu</label><select class="select" data-q="${i}" data-k="required"><option value="0" ${!q.required?'selected':''}>Hayır</option><option value="1" ${q.required?'selected':''}>Evet</option></select></div>
          ${scale}${opts}
        </div>
      </div>`;
    }
    function bind(){
      const b=box();
      b.querySelector('#sv-preview-toggle').onclick=()=>{previewMode=true;redraw();};
      b.querySelector('#sv-title').oninput=e=>title=e.target.value;
      b.querySelector('#sv-desc').oninput=e=>description=e.target.value;
      b.querySelector('#sv-active').onchange=e=>active=e.target.value==='1';
      b.querySelector('#sv-addq').onclick=()=>{questions.push(blankQuestion());redraw();};
      b.querySelectorAll('[data-q][data-k]').forEach(el=>{
        const i=Number(el.dataset.q),k=el.dataset.k;
        if(el.dataset.opt!==undefined){
          const j=Number(el.dataset.opt);
          el.oninput=()=>{questions[i].options[j][k]=k==='score'?(Number(el.value)||0):el.value;};
          return;
        }
        if(el.tagName==='SELECT'){
          el.onchange=()=>{
            if(k==='required')questions[i].required=el.value==='1';
            else if(k==='type'){questions[i].type=el.value;redraw();}
          };
        }else if(el.type==='checkbox'){
          el.onchange=()=>{questions[i].scored=el.checked;redraw();};
        }else{
          el.oninput=()=>{questions[i][k]=(k==='scale_min'||k==='scale_max')?(Number(el.value)||0):el.value;};
        }
      });
      b.querySelectorAll('[data-q-del]').forEach(x=>x.onclick=()=>{questions.splice(Number(x.dataset.qDel),1);if(!questions.length)questions=[blankQuestion()];redraw();});
      b.querySelectorAll('[data-q-up]').forEach(x=>x.onclick=()=>{const i=Number(x.dataset.qUp);[questions[i-1],questions[i]]=[questions[i],questions[i-1]];redraw();});
      b.querySelectorAll('[data-q-down]').forEach(x=>x.onclick=()=>{const i=Number(x.dataset.qDown);[questions[i+1],questions[i]]=[questions[i],questions[i+1]];redraw();});
      b.querySelectorAll('[data-opt-add]').forEach(x=>x.onclick=()=>{questions[Number(x.dataset.optAdd)].options.push({label:'',score:0});redraw();});
      b.querySelectorAll('[data-opt-del]').forEach(x=>x.onclick=()=>{const [i,j]=x.dataset.optDel.split(':').map(Number);questions[i].options.splice(j,1);redraw();});
    }
    redraw();
  }

  // --- Make It Right · Ayın Personeli şablonları -----------------
  // Sol sütun = operasyon, sağ sütun = idari ofis. Oylama sadece link ile.
  const EOM_CATS=[['operasyon','Operasyon Çalışanları'],['idari','İdari Ofis Çalışanları']];
  const eomCatLabel=c=>(EOM_CATS.find(x=>x[0]===c)||['',''])[1];
  const eomInitials=n=>String(n||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toLocaleUpperCase('tr-TR')||'?';
  function eomPhoto(c){
    return c.photo
      ? `<img class="eom-photo" src="${esc(c.photo)}" alt="${esc(c.name)}">`
      : `<span class="eom-photo eom-photo-ph">${esc(eomInitials(c.name))}</span>`;
  }

  async function renderMakeItRight(){
    if(!document.querySelector('#eom-tmpl-card'))mount('<div class="card empty">Yükleniyor…</div>');
    let list,sent;
    try{
      list=await api('/api/eom/templates');
      sent=await api('/api/eom/sent').catch(()=>[]);
    }catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!=='makeitright')return;
    const manage=canManage();
    const rows=list.map(t=>`<tr>
      <td><strong>${esc(t.title)}</strong></td>
      <td>${t.candidate_count} aday</td>
      <td><span class="badge ${t.status==='open'?'green':'orange'}">${t.status==='open'?'Aktif':'Kapalı'}</span></td>
      <td class="row-actions">
        <button class="btn ghost" data-eom-preview="${t.id}">Önizle</button>
        ${manage?`${t.status==='open'?`<button class="btn ghost" data-eom-send="${t.id}">Gönder</button>`:''}<button class="btn ghost" data-eom-edit="${t.id}">Düzenle</button><button class="btn ghost" data-eom-copy="${t.id}">Kopyala</button><button class="btn ghost danger-text" data-eom-del="${t.id}">Sil</button>`:''}
      </td>
    </tr>`).join('');
    mount(`<div class="card" id="eom-tmpl-card">
      <div class="toolbar">
        ${manage?`<button class="btn" id="eom-add">+ Yeni Make It Right şablonu</button>`:''}
        <span class="muted">${list.length} şablon</span>
      </div>
      <div style="overflow:auto"><table><thead><tr><th>ŞABLON</th><th>ADAY</th><th>DURUM</th><th></th></tr></thead>
      <tbody>${rows||`<tr><td colspan="4" class="empty">Henüz şablon yok</td></tr>`}</tbody></table></div>
    </div>
    ${sentCardHtml(sent,'eom')}`);
    if($('#eom-add'))$('#eom-add').onclick=eomCreateTemplate;
    document.querySelectorAll('[data-eom-preview]').forEach(b=>b.onclick=()=>eomPreviewTemplate(b.dataset.eomPreview));
    document.querySelectorAll('[data-eom-edit]').forEach(b=>b.onclick=()=>openEomBuilder(b.dataset.eomEdit));
    document.querySelectorAll('[data-eom-report]').forEach(b=>b.onclick=()=>openEomReport(b.dataset.eomReport));
    document.querySelectorAll('[data-eom-send]').forEach(b=>b.onclick=()=>{
      const t=list.find(x=>String(x.id)===b.dataset.eomSend);
      inviteModal('makeitright',{templateId:t.id,title:t.title});
    });
    document.querySelectorAll('[data-eom-copy]').forEach(b=>b.onclick=async()=>{
      try{await api('/api/eom/templates/'+b.dataset.eomCopy+'/copy',{method:'POST'});renderMakeItRight();toast('Şablon kopyalandı');}
      catch(err){toast(err.message);}
    });
    document.querySelectorAll('[data-eom-del]').forEach(b=>b.onclick=async()=>{
      if(!confirm('Bu şablonu silmek istediğinize emin misiniz? Gönderilmiş linkler ve oylar da silinir.'))return;
      try{await api('/api/eom/templates/'+b.dataset.eomDel,{method:'DELETE'});renderMakeItRight();toast('Şablon silindi');}
      catch(err){toast(err.message);}
    });
  }

  function eomCreateTemplate(){
    modal('Yeni Make It Right şablonu',
      `<div class="field"><label>Şablon adı *</label><input class="input" id="eom-tname" placeholder="ör. 2026 1. Çeyrek Ayın Personeli"></div>
       <p class="muted" style="margin-top:10px;font-size:12px">Oluşturduktan sonra iki sütuna (operasyon / idari ofis) adayları eklersiniz.</p>`,
      async()=>{
        const title=($('#eom-tname').value||'').trim();
        if(!title)return toast('Şablon adı girin');
        try{
          const t=await api('/api/eom/templates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});
          closeModal();renderMakeItRight();openEomBuilder(t.id);toast('Şablon oluşturuldu — şimdi aday ekleyin');
        }catch(err){toast(err.message);}
      });
  }

  function eomBuilderColumns(tpl){
    return EOM_CATS.map(([cat,label])=>{
      const cands=(tpl.candidates||[]).filter(c=>c.category===cat);
      const cards=cands.map(c=>`<div class="eom-cand">
        <span class="eom-cand-main">${eomPhoto(c)}<span class="eom-cand-body"><strong>${esc(c.name)}</strong>${c.subtitle?`<small class="muted">${esc(c.subtitle)}</small>`:''}</span></span>
        <button type="button" class="btn ghost eom-edit-c" data-edit="${c.id}">Düzenle</button>
        <button type="button" class="btn ghost danger-text eom-del-c" data-del="${c.id}">Sil</button>
      </div>`).join('')||'<div class="empty">Aday eklenmedi</div>';
      return `<div class="eom-col">
        <div class="eom-col-head"><span>${label}</span><span class="muted">${cands.length} aday</span></div>
        <div class="eom-cards">${cards}</div>
        <button type="button" class="btn secondary eom-add-c" data-cat="${cat}">+ Aday ekle</button>
      </div>`;
    }).join('');
  }

  async function openEomBuilder(id){
    let tpl;
    try{tpl=await api('/api/eom/templates/'+id);}catch(err){return toast(err.message);}
    modal('Make It Right şablonu','<div id="eomb-body"></div>',()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    const s=document.querySelector('.modal .submit');if(s){s.textContent='Kapat';s.onclick=()=>{closeModal();renderMakeItRight();};}
    const box=()=>$('#eomb-body');
    async function reload(){try{tpl=await api('/api/eom/templates/'+id);}catch(_){}draw();}
    function draw(){
      box().innerHTML=`
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1"><label>Şablon adı *</label><input class="input" id="eomb-title" value="${esc(tpl.title)}"></div>
          <div class="field"><label>Durum</label><select class="select" id="eomb-status"><option value="open" ${tpl.status==='open'?'selected':''}>Aktif</option><option value="closed" ${tpl.status==='closed'?'selected':''}>Kapalı</option></select></div>
        </div>
        <p class="muted" style="font-size:12px;margin:12px 0 4px">Sol sütun operasyon, sağ sütun idari ofis adayları. Oy verenler her sütundan 1 aday seçer.</p>
        <div class="eom-grid">${eomBuilderColumns(tpl)}</div>`;
      bind();
    }
    function bind(){
      box().querySelector('#eomb-title').onchange=async e=>{
        const v=e.target.value.trim();if(!v)return;
        try{await api('/api/eom/templates/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:v})});toast('Kaydedildi');}catch(err){toast(err.message);}
      };
      box().querySelector('#eomb-status').onchange=async e=>{
        try{await api('/api/eom/templates/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:e.target.value})});toast('Kaydedildi');}catch(err){toast(err.message);}
      };
      box().querySelectorAll('.eom-add-c').forEach(b=>b.onclick=()=>eomCandidateModal(b.dataset.cat,null,{templateId:id,candidates:tpl.candidates||[],onDone:reload}));
      box().querySelectorAll('.eom-edit-c').forEach(b=>b.onclick=()=>{
        const c=(tpl.candidates||[]).find(x=>String(x.id)===b.dataset.edit);
        if(c)eomCandidateModal(c.category,c,{templateId:id,candidates:tpl.candidates||[],onDone:reload});
      });
      box().querySelectorAll('.eom-del-c').forEach(b=>b.onclick=async()=>{
        if(!confirm('Bu adayı silmek istediğinize emin misiniz?'))return;
        try{await api('/api/eom/candidates/'+b.dataset.del,{method:'DELETE'});reload();toast('Aday silindi');}catch(err){toast(err.message);}
      });
    }
    draw();
  }

  function eomPreviewTemplate(id){
    api('/api/eom/templates/'+id).then(tpl=>{
      const cols=EOM_CATS.map(([cat,label])=>{
        const cands=(tpl.candidates||[]).filter(c=>c.category===cat);
        const cards=cands.map(c=>`<div class="eom-cand"><label class="eom-cand-main"><input type="radio" name="pv-${cat}" disabled>${eomPhoto(c)}<span class="eom-cand-body"><strong>${esc(c.name)}</strong>${c.subtitle?`<small class="muted">${esc(c.subtitle)}</small>`:''}</span></label></div>`).join('')||'<div class="empty">Aday eklenmedi</div>';
        return `<div class="eom-col"><div class="eom-col-head"><span>${label}</span><span class="muted">${cands.length} aday</span></div><div class="eom-cards">${cards}</div></div>`;
      }).join('');
      modal('Önizleme · '+esc(tpl.title),
        `<div class="sv-preview">
         ${brandPreviewHead('Make It Right',tpl.title,'Ayın Personeli seçimi')}
         <p class="muted" style="margin:0 0 14px">Her sütundan yalnızca <strong>1</strong> aday seçilebilir.</p>
         <div class="eom-grid eom-preview">${cols}</div>
         <button class="btn" type="button" disabled style="margin-top:16px">Oyumu gönder</button>
         </div>`,()=>closeModal());
      document.querySelector('.modal')?.classList.add('survey-modal');
      const s=document.querySelector('.modal .submit');if(s){s.textContent='Kapat';s.onclick=closeModal;}
    }).catch(err=>toast(err.message));
  }

  function eomReportHtml(rep){
    const t=rep.totals, delivered=t.delivered??t.sent, failed=t.failed??0;
    const statusParts=[
      {label:'Oy kullandı',count:t.responded,color:'#18a874'},
      {label:'Açtı, oy kullanmadı',count:Math.max(0,t.opened-t.responded),color:'#f59e0b'},
      {label:'Hiç açmadı',count:Math.max(0,delivered-t.opened),color:'#c3cad6'}
    ];
    const cats=(rep.categories||[]).map(c=>`<div class="rep-q">
      <div class="rep-q-h">${esc(c.label)}</div>
      <div class="muted" style="font-size:12px">${c.total_votes} oy${c.winner?` · önde: <strong>${esc(c.winner)}</strong>`:''}</div>
      ${pieHtml((c.distribution||[]).map(d=>({label:d.label,count:d.count})))}
    </div>`).join('');
    return `<div id="rep-body">
      <div class="rep-stats">
        <div class="rep-stat"><b>${delivered}</b><span>Ulaştı</span></div>
        <div class="rep-stat"><b${failed?' class="danger-text"':''}>${failed}</b><span>Başarısız</span></div>
        <div class="rep-stat"><b>${t.opened}</b><span>Açıldı (tıkladı)</span></div>
        <div class="rep-stat"><b>${t.responded}</b><span>Oy kullandı</span></div>
      </div>
      <div class="rep-q"><div class="rep-q-h">Katılım durumu <span class="muted" style="font-weight:400">(ulaşan ${delivered} kişi üzerinden)</span></div>${pieHtml(statusParts)}</div>
      ${cats||'<div class="empty">Bu şablonda aday yok</div>'}
      ${repRecipTable(rep.invites)}
    </div>`;
  }
  function eomRepSig(rep){
    const t=rep.totals||{};
    return [t.sent,t.delivered,t.failed,t.opened,t.responded,(rep.categories||[]).map(c=>(c.distribution||[]).map(d=>d.count).join('.')).join('|')].join(';');
  }
  async function openEomReport(id){
    let rep;
    try{rep=await api('/api/eom/templates/'+id+'/report');}catch(err){return toast(err.message);}
    modal('Make It Right raporu · '+esc(rep.template.title),eomReportHtml(rep),()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    const s=document.querySelector('.modal .submit');if(s){s.textContent='Kapat';s.onclick=closeModal;}
    let lastSig=eomRepSig(rep);
    clearInterval(repTimer);
    repTimer=setInterval(async()=>{
      const body=document.querySelector('#rep-body');
      if(!body||!document.body.contains(body)){clearInterval(repTimer);repTimer=null;return;}
      let fresh;
      try{fresh=await api('/api/eom/templates/'+id+'/report');}catch(_){return;}
      const sig=eomRepSig(fresh);
      if(sig===lastSig)return;
      lastSig=sig;
      const scroll=body.scrollTop,recipsOpen=body.querySelector('.rep-recips')?.open;
      body.outerHTML=eomReportHtml(fresh);
      const nb=document.querySelector('#rep-body');
      if(nb){nb.scrollTop=scroll;if(recipsOpen){const d=nb.querySelector('.rep-recips');if(d)d.open=true;}}
      toast('Yeni oy geldi — rapor güncellendi');
    },3000);
  }

  function eomCandidateModal(cat,existing,ctx){
    ctx=ctx||{};
    const editing=!!existing;
    const onDone=ctx.onDone||renderMakeItRight;
    const taken=(ctx.candidates||[]);
    const takenEmp=new Set(taken.map(c=>String(c.employee_id)).filter(x=>x&&x!=='null'));
    const takenName=new Set(taken.map(c=>String(c.name||'').trim().toLocaleLowerCase('tr-TR')));
    const emps=(state.employees||[])
      .filter(e=>!takenEmp.has(String(e.id))&&!takenName.has(String(e.name||'').trim().toLocaleLowerCase('tr-TR')))
      .slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr'));
    let photoData=null;   // yeni seçilen fotoğrafın data URL'i
    let removePhoto=false;
    modal(editing?('Aday düzenle · '+esc(existing.name)):('Aday ekle · '+eomCatLabel(cat)),
      `<div class="form-grid">
        ${editing?'':`<div class="field" style="grid-column:1/-1"><label>Çalışan seç (opsiyonel)</label>
          <select class="select" id="eom-emp"><option value="">— elle gir —</option>
          ${emps.map(e=>`<option value="${e.id}" data-sub="${esc(e.title||e.department||'')}">${esc(e.name)}${e.department?' · '+esc(e.department):''}</option>`).join('')}</select></div>`}
        <div class="field" style="grid-column:1/-1"><label>Aday adı *</label><input class="input" id="eom-name" value="${editing?esc(existing.name):''}"></div>
        <div class="field" style="grid-column:1/-1"><label>Ünvan / departman</label><input class="input" id="eom-sub" value="${editing?esc(existing.subtitle||''):''}"></div>
        <div class="field" style="grid-column:1/-1">
          <label>Fotoğraf</label>
          <div class="eom-photo-pick">
            <div id="eom-photo-prev" class="eom-photo-prev">${editing&&existing.photo?`<img src="${esc(existing.photo)}" alt="">`:`<span class="eom-photo-prev-ph">Fotoğraf yok</span>`}</div>
            <div>
              <input type="file" accept="image/*" id="eom-photo-file" hidden>
              <button type="button" class="btn secondary" id="eom-photo-btn">Fotoğraf yükle</button>
              ${editing&&existing.photo?`<button type="button" class="btn ghost danger-text" id="eom-photo-rm">Kaldır</button>`:''}
              <div class="muted" style="font-size:11px;margin-top:6px">JPG / PNG / WEBP · en fazla 600 KB</div>
            </div>
          </div>
        </div>
      </div>`,
      async()=>{
        const name=($('#eom-name').value||'').trim();
        const employee_id=editing?'':($('#eom-emp')?.value||'');
        if(!name&&!employee_id)return toast('Aday adı girin veya çalışan seçin');
        const payload={category:cat,name,subtitle:($('#eom-sub').value||'').trim()};
        if(!editing){payload.template_id=ctx.templateId;if(employee_id)payload.employee_id=employee_id;}
        if(photoData!=null)payload.photo=photoData;
        else if(removePhoto)payload.photo='';
        const submit=document.querySelector('.modal .submit');if(submit)submit.disabled=true;
        try{
          if(editing)await api('/api/eom/candidates/'+existing.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          else await api('/api/eom/candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          closeModal();onDone();toast(editing?'Aday güncellendi':'Aday eklendi');
        }catch(err){toast(err.message);if(submit)submit.disabled=false;}
      });
    const sel=$('#eom-emp');
    if(sel)sel.onchange=()=>{
      const opt=sel.selectedOptions[0];
      if(sel.value&&opt){$('#eom-name').value=opt.textContent.split(' · ')[0];if(!$('#eom-sub').value)$('#eom-sub').value=opt.dataset.sub||'';}
    };
    const file=$('#eom-photo-file'),prev=$('#eom-photo-prev');
    $('#eom-photo-btn').onclick=()=>file.click();
    file.onchange=()=>{
      const f=file.files&&file.files[0];if(!f)return;
      if(!/^image\//.test(f.type))return toast('Lütfen bir resim dosyası seçin');
      if(f.size>600*1024)return toast('Fotoğraf en fazla 600 KB olabilir');
      const reader=new FileReader();
      reader.onload=()=>{photoData=reader.result;removePhoto=false;prev.innerHTML=`<img src="${esc(photoData)}" alt="">`;};
      reader.readAsDataURL(f);
    };
    if($('#eom-photo-rm'))$('#eom-photo-rm').onclick=()=>{
      photoData=null;removePhoto=true;file.value='';
      prev.innerHTML='<span class="eom-photo-prev-ph">Fotoğraf yok</span>';
    };
  }

  // --- Alıcı grupları --------------------------------------------
  const isEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  const empDepartments=()=>[...new Set((state.employees||[]).filter(e=>e.status!=='Pasif').map(e=>String(e.department||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
  const deptMembers=dept=>{
    const key=String(dept||'').trim().toLocaleLowerCase('tr-TR');
    if(!key)return [];
    return (state.employees||[])
      .filter(e=>e.status!=='Pasif'&&String(e.department||'').trim().toLocaleLowerCase('tr-TR')===key)
      .map(e=>({name:e.name||'',email:e.email||'',phone:e.phone||'',employee_id:e.id}));
  };

  async function recipientGroupsModal(afterChange){
    let groups=[];
    try{groups=await api('/api/recipient-groups');}catch(err){return toast(err.message);}
    modal('Alıcı grupları','<div id="rg-body"></div>',()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    const s=document.querySelector('.modal .submit');if(s){s.textContent='Kapat';s.onclick=()=>{closeModal();afterChange&&afterChange();};}
    const box=()=>$('#rg-body');
    let editing=null;            // düzenlenen grup (yoksa: yeni grup)
    let picked=new Set();        // seçili departmanlar
    let gname='';
    async function reload(){try{groups=await api('/api/recipient-groups');}catch(_){}draw();afterChange&&afterChange();}
    function resetForm(){editing=null;picked=new Set();gname='';}
    function draw(){
      const depts=empDepartments();
      box().innerHTML=`
        <div style="overflow:auto"><table><thead><tr><th>GRUP</th><th>DEPARTMANLAR</th><th>ÜYE</th><th></th></tr></thead><tbody>
        ${groups.map(g=>`<tr>
          <td><strong>${esc(g.name)}</strong></td>
          <td style="max-width:260px">${g.departments&&g.departments.length?esc(g.departments.join(', ')):'<span class="muted">Statik liste</span>'}</td>
          <td>${g.member_count} kişi<small class="muted" style="display:block">${g.with_phone} tel · ${g.with_email} e-posta</small></td>
          <td class="row-actions">${g.departments&&g.departments.length?`<button class="btn ghost" data-rg-edit="${g.id}">Düzenle</button>`:''}<button class="btn ghost danger-text" data-rg-del="${g.id}">Sil</button></td>
        </tr>`).join('')||'<tr><td colspan="4" class="empty">Henüz grup yok</td></tr>'}
        </tbody></table></div>
        <div class="field" style="margin-top:18px">
          <label>${editing?'Grubu düzenle':'Yeni departman grubu'}</label>
          <input class="input" id="rg-name" placeholder="Grup adı" value="${esc(gname)}" style="margin-bottom:10px">
          <div class="muted" style="font-size:11px;margin-bottom:6px">Bir veya birden fazla departman seçin. Grup her gönderimde bu departmanların güncel çalışanlarını içerir.</div>
          <div class="rg-depts">${depts.map(d=>`<label class="rg-dchip ${picked.has(d)?'on':''}"><input type="checkbox" value="${esc(d)}" ${picked.has(d)?'checked':''}> ${esc(d)}</label>`).join('')}</div>
          <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap">
            <button class="btn" id="rg-save">${editing?'Kaydet':'Oluştur'}</button>
            ${editing?`<button class="btn ghost" id="rg-cancel">İptal</button>`:''}
            <span class="muted" id="rg-cnt" style="align-self:center;font-size:12px">${picked.size} departman seçili</span>
          </div>
        </div>`;
      box().querySelector('#rg-name').oninput=e=>{gname=e.target.value;};
      box().querySelectorAll('.rg-depts input').forEach(cb=>cb.onchange=()=>{
        if(cb.checked)picked.add(cb.value);else picked.delete(cb.value);
        cb.closest('.rg-dchip').classList.toggle('on',cb.checked);
        const cnt=box().querySelector('#rg-cnt');
        if(cnt)cnt.textContent=picked.size+' departman seçili';
      });
      box().querySelector('#rg-save').onclick=async()=>{
        const name=(gname||'').trim();
        if(!name)return toast('Grup adı girin');
        if(!picked.size)return toast('En az bir departman seçin');
        const payload={name,departments:[...picked]};
        try{
          if(editing)await api('/api/recipient-groups/'+editing.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          else await api('/api/recipient-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          toast(editing?'Grup güncellendi':'Grup oluşturuldu');resetForm();reload();
        }catch(err){toast(err.message);}
      };
      if($('#rg-cancel'))$('#rg-cancel').onclick=()=>{resetForm();draw();};
      box().querySelectorAll('[data-rg-edit]').forEach(b=>b.onclick=async()=>{
        try{const g=await api('/api/recipient-groups/'+b.dataset.rgEdit);
          editing=g;gname=g.name;picked=new Set(g.departments||[]);draw();
          box().querySelector('#rg-name')?.scrollIntoView({block:'center'});
        }catch(err){toast(err.message);}
      });
      box().querySelectorAll('[data-rg-del]').forEach(b=>b.onclick=async()=>{
        if(!confirm('Bu grubu silmek istediğinize emin misiniz?'))return;
        try{await api('/api/recipient-groups/'+b.dataset.rgDel,{method:'DELETE'});toast('Grup silindi');if(editing&&String(editing.id)===b.dataset.rgDel)resetForm();reload();}
        catch(err){toast(err.message);}
      });
    }
    draw();
  }

  // "muhlis özkan" -> "Muhlis ÖZKAN"
  function salutationName(name){
    const p=String(name||'').trim().split(/\s+/).filter(Boolean);
    if(!p.length)return '';
    const t=s=>s.charAt(0).toLocaleUpperCase('tr-TR')+s.slice(1).toLocaleLowerCase('tr-TR');
    const l=p.pop();
    return [...p.map(t),l.toLocaleUpperCase('tr-TR')].join(' ');
  }

  // --- Kişiye özel tek kullanımlık link ile gönderim --------------
  function inviteModal(kind,opts){
    opts=opts||{};
    let channel='email';
    let greet=true;
    let rows=[{name:'',email:'',phone:'',employee_id:null}];
    let groups=[];
    let done=false;
    const path=kind==='makeitright'?'/api/eom/templates/'+opts.templateId+'/invites':'/api/surveys/'+opts.surveyId+'/invites';
    const rkey=r=>((r.email||'').trim().toLowerCase())||((r.phone||'').replace(/\D/g,''))||((r.name||'').trim().toLowerCase());
    const allActiveEmps=()=>(state.employees||[]).filter(e=>e.status!=='Pasif')
      .map(e=>({name:e.name||'',email:e.email||'',phone:e.phone||'',employee_id:e.id}));
    function addRecipients(list){
      const seen=new Set(rows.map(rkey).filter(Boolean));
      let added=0;
      (list||[]).forEach(r=>{
        const k=rkey(r);if(!k||seen.has(k))return;
        seen.add(k);rows.push({name:r.name||'',email:r.email||'',phone:r.phone||'',employee_id:r.employee_id||null});added++;
      });
      rows=rows.filter(r=>r.name||r.email||r.phone)
        .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr'));
      if(!rows.length)rows=[{name:'',email:'',phone:'',employee_id:null}];
      redraw();
      return added;
    }
    const loadGroups=async()=>{try{groups=await api('/api/recipient-groups');}catch(_){groups=[];}};
    modal('Link gönder'+(opts.title?' · '+opts.title:''),'<div id="inv-body">Yükleniyor…</div>',async()=>{
      if(done){closeModal();if(kind==='makeitright')renderMakeItRight();else if(kind==='performans')renderPerformance();return;}
      const recipients=rows.map(r=>({name:r.name.trim(),email:r.email.trim(),phone:r.phone.trim(),employee_id:r.employee_id||undefined})).filter(r=>r.name||r.email||r.phone);
      if(!recipients.length)return toast('En az bir alıcı girin');
      if(channel==='email'&&recipients.some(r=>!isEmail(r.email)))return toast('Tüm alıcıların geçerli e-posta adresi olmalı (e-postası olmayanları çıkarın)');
      if(channel==='sms'&&recipients.some(r=>!r.phone))return toast('Tüm alıcıların telefon numarası olmalı (numarası olmayanları çıkarın)');
      const submit=document.querySelector('.modal .submit');if(submit)submit.disabled=true;
      try{
        const res=await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel,greet,message:curMsg(),recipients})});
        showResult(res);
      }catch(err){toast(err.message);if(submit)submit.disabled=false;}
    });
    document.querySelector('.modal')?.classList.add('survey-modal');
    const box=()=>$('#inv-body');
    const curMsg=()=>($('#inv-msg')?$('#inv-msg').value:'');
    function rowHtml(r,i){
      const miss=(channel==='email'&&!isEmail(r.email))||(channel==='sms'&&!r.phone);
      return `<div class="inv-row ${miss?'inv-row-miss':''}" data-i="${i}">
        <input class="input" data-k="name" placeholder="Ad Soyad" value="${esc(r.name)}">
        <input class="input" data-k="email" placeholder="E-posta" value="${esc(r.email)}" ${channel==='sms'?'hidden':''}>
        <input class="input" data-k="phone" placeholder="Telefon" value="${esc(r.phone)}" ${channel==='email'?'hidden':''}>
        <button type="button" class="btn ghost danger-text" data-del="${i}" title="Sil">×</button>
      </div>`;
    }
    function redraw(){
      const filled=rows.filter(r=>r.name||r.email||r.phone).length;
      box().innerHTML=`
        <div class="field"><label>Gönderim kanalı</label>
          <div class="inv-channel">
            <label><input type="radio" name="inv-ch" value="email" ${channel==='email'?'checked':''}> E-posta</label>
            <label><input type="radio" name="inv-ch" value="sms" ${channel==='sms'?'checked':''}> SMS</label>
          </div>
        </div>
        <div class="field"><label>Alıcılar (${filled})</label>
          <div class="inv-sources">
            <select class="select" id="inv-group" data-no-combobox="1"><option value="">+ Gruptan ekle…</option>${groups.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr')).map(g=>`<option value="${esc(String(g.id))}">${esc(g.name)} (${g.member_count})</option>`).join('')}</select>
            <select class="select" id="inv-dept" data-no-combobox="1"><option value="">+ Departmandan ekle…</option><option value="__ALL__">▸ Tüm departmanlar (${allActiveEmps().length} kişi)</option>${empDepartments().map(d=>`<option value="${esc(d)}">${esc(d)}</option>`).join('')}</select>
            <button type="button" class="btn ghost" id="inv-add">+ Elle satır</button>
            <button type="button" class="btn ghost" id="inv-groups">Grupları yönet</button>
          </div>
          <p class="muted" style="font-size:11px;margin:0 0 8px">Grup ve departman seçimleri listeye <strong>eklenir</strong> (birden çok departmana birlikte gönderebilirsiniz). Baştan başlamak için “Listeyi temizle”.</p>
          <div class="inv-rows">${rows.map(rowHtml).join('')}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
            ${filled?`<button type="button" class="btn ghost danger-text" id="inv-clear">Listeyi temizle</button>`:''}
            ${filled?`<button type="button" class="btn ghost" id="inv-savegroup">💾 Bu listeyi grup olarak kaydet</button>`:''}
          </div>
        </div>
        <div class="field"><label>Selamlama</label>
          <label class="inv-greet"><input type="checkbox" id="inv-greet" ${greet?'checked':''}> Mesaja kişiye özel selamlama ekle</label>
          ${greet?`<small class="muted">Her mesaj <strong>Sayın ${esc(salutationName((rows.find(r=>r.name)||{}).name)||'Ad SOYAD')},</strong> ile başlar (soyisim büyük harf).</small>`:''}
        </div>
        <div class="field"><label>Mesaj (opsiyonel)</label>
          <textarea class="input" id="inv-msg" placeholder="Boş bırakılırsa standart metin gönderilir. {ad} = Ad SOYAD, {link} = bağlantı.">${esc(curMsg())}</textarea>
        </div>
        <p class="muted" style="font-size:12px;margin:0">Her alıcıya kişiye özel, <strong>tek kullanımlık</strong> bir bağlantı oluşturulur. ${channel==='sms'?'Telefon':'E-posta'}sı olmayan satırlar kırmızı gösterilir; göndermeden önce çıkarın.</p>`;
      bind();
    }
    function bind(){
      box().querySelectorAll('[name="inv-ch"]').forEach(el=>el.onchange=()=>{channel=el.value;redraw();});
      box().querySelector('#inv-greet').onchange=e=>{greet=e.target.checked;redraw();};
      box().querySelector('#inv-add').onclick=()=>{rows.push({name:'',email:'',phone:'',employee_id:null});redraw();};
      box().querySelector('#inv-groups').onclick=()=>recipientGroupsModal(async()=>{await loadGroups();redraw();});
      box().querySelector('#inv-group').onchange=async e=>{
        const id=e.target.value,label=e.target.selectedOptions[0]?.textContent||'Grup';e.target.value='';if(!id)return;
        try{const g=await api('/api/recipient-groups/'+id);const n=addRecipients(g.members);
          toast(n?`${label.split(' (')[0]}: ${n} kişi eklendi · toplam ${rows.filter(r=>r.name||r.email||r.phone).length} alıcı`:'Yeni alıcı yok (hepsi zaten listede)');}
        catch(err){toast(err.message);}
      };
      box().querySelector('#inv-dept').onchange=e=>{
        const d=e.target.value;e.target.value='';if(!d)return;
        const label=d==='__ALL__'?'Tüm departmanlar':d;
        const n=addRecipients(d==='__ALL__'?allActiveEmps():deptMembers(d));
        toast(n?`${label}: ${n} çalışan eklendi · toplam ${rows.filter(r=>r.name||r.email||r.phone).length} alıcı`:`${label}: yeni çalışan yok (hepsi zaten listede)`);
      };
      const cl=box().querySelector('#inv-clear');
      if(cl)cl.onclick=()=>{rows=[{name:'',email:'',phone:'',employee_id:null}];redraw();toast('Alıcı listesi temizlendi');};
      const sg=box().querySelector('#inv-savegroup');
      if(sg)sg.onclick=async()=>{
        const name=prompt('Grup adı:');if(!name||!name.trim())return;
        const members=rows.filter(r=>r.name||r.email||r.phone).map(r=>({name:r.name,email:r.email,phone:r.phone,employee_id:r.employee_id||undefined}));
        try{await api('/api/recipient-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),members})});await loadGroups();redraw();toast('Grup kaydedildi');}
        catch(err){toast(err.message);}
      };
      box().querySelectorAll('.inv-row [data-k]').forEach(el=>{
        const i=Number(el.closest('.inv-row').dataset.i),k=el.dataset.k;
        el.oninput=()=>{rows[i][k]=el.value;};
      });
      box().querySelectorAll('[data-del]').forEach(el=>el.onclick=()=>{
        rows.splice(Number(el.dataset.del),1);if(!rows.length)rows=[{name:'',email:'',phone:'',employee_id:null}];redraw();
      });
    }
    loadGroups().then(redraw);
    function showResult(res){
      done=true;
      box().innerHTML=`<div class="inv-result">
        <p><strong>${res.sent}</strong> gönderildi${res.failed?` · <strong class="danger-text">${res.failed}</strong> başarısız`:''}.
        ${res.base_url?`<br><span class="muted" style="font-size:12px">Bağlantı adresi: ${esc(res.base_url)}</span>`:''}</p>
        <ul class="inv-result-list">${(res.results||[]).map(r=>`<li>
          <div>${r.ok?'✅':'❌'} ${esc(r.name||'(isimsiz)')}${r.ok?'':' — '+esc(r.error||'')}</div>
          ${r.link?`<div class="inv-link"><input class="input" readonly value="${esc(r.link)}"><button type="button" class="btn ghost" data-copy="${esc(r.link)}">Kopyala</button></div>`:''}
        </li>`).join('')}</ul>
      </div>`;
      box().querySelectorAll('[data-copy]').forEach(b=>b.onclick=()=>{
        navigator.clipboard?.writeText(b.dataset.copy).then(()=>toast('Bağlantı kopyalandı'),()=>toast('Kopyalanamadı'));
      });
      const submit=document.querySelector('.modal .submit');
      if(submit){submit.textContent='Kapat';submit.disabled=false;}
    }
  }

  function render(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='survey'));
    $('#page-title').textContent='Anket';
    const list=tabList();
    if(!list.some(t=>t[0]===tab))tab=list[0][0];
    if(tab==='personel'&&canSeePersonel())renderPersonel();
    else renderMakeItRight();
  }

  const baseShell=shell;
  shell=function(){
    if(state.view==='survey'){
      if(window.__ikCan&&!window.__ikCan('survey')){state.view='dashboard';baseShell();return;}
      render();
    }else if(state.view==='performance'){
      if(window.__ikCan&&!window.__ikCan('performance')){state.view='dashboard';baseShell();return;}
      renderPerformance();
    }else baseShell();
  };
})();
