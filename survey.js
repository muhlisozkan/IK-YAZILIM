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
  function surveyPreviewHtml(title,description,questions){
    return `<div class="sv-preview">
      ${brandPreviewHead('Personel Anketi',title||'(anket başlığı)',description)}
      ${(questions||[]).map((q,i)=>`<div class="sv-pv-q"><div class="sv-pv-title">${i+1}. ${esc(q.title||'(başlıksız soru)')}${q.required?' <span class="danger-text">*</span>':''}</div>${q.detail?`<div class="muted" style="font-size:12px;margin:2px 0 8px">${esc(q.detail)}</div>`:''}${previewControl(q,i)}</div>`).join('')||'<div class="empty">Henüz soru yok</div>'}
      <button class="btn" type="button" disabled style="margin-top:14px">Yanıtları gönder</button>
    </div>`;
  }
  function previewSurvey(s){
    modal('Önizleme · '+(s.title||'Anket'),surveyPreviewHtml(s.title,s.description,s.questions),()=>closeModal());
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
    mount('<div class="card empty">Yükleniyor…</div>');
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
    mount(`<div class="card">
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

  // --- Gönderilen anketler & rapor -------------------------------
  const fmtDT=v=>{ if(!v)return '—'; const d=new Date(v); return isNaN(d)?'—':d.toLocaleString('tr-TR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}); };
  const PIE_COLORS=['#4967f4','#18a874','#f59e0b','#e55261','#8b5cf6','#0ea5e9','#ec4899','#64748b','#14b8a6','#f97316'];

  function sentCardHtml(sent){
    const rows=(sent||[]).map(s=>{
      const rate=s.sent?Math.round(s.responded/s.sent*100):0;
      return `<tr>
        <td><button class="btn ghost" data-survey-report="${s.id}" style="padding:2px 0;font-weight:700;text-align:left">${esc(s.title)}</button>
          <small class="muted" style="display:block">Son gönderim: ${esc(fmtDT(s.last_sent_at))}</small></td>
        <td>${s.sent}</td><td>${s.opened}</td><td>${s.responded}</td>
        <td style="min-width:150px"><div class="bar"><i style="width:${rate}%"></i></div><small class="muted">%${rate} yanıt</small></td>
      </tr>`;
    }).join('');
    return `<div class="card" style="margin-top:18px">
      <div class="card-head"><div><h2>Gönderilen anketler</h2><span class="muted">Anket adına tıklayarak yanıt durumunu ve grafikleri görün</span></div></div>
      <div style="overflow:auto"><table><thead><tr><th>ANKET</th><th>GÖNDERİLDİ</th><th>AÇILDI</th><th>YANITLADI</th><th>YANIT ORANI</th></tr></thead>
      <tbody>${rows||`<tr><td colspan="5" class="empty">Henüz anket gönderilmedi</td></tr>`}</tbody></table></div>
    </div>`;
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

  function reportHtml(rep){
    const t=rep.totals, notResp=Math.max(0,t.sent-t.responded);
    const statusParts=[
      {label:'Yanıtladı',count:t.responded,color:'#18a874'},
      {label:'Açtı, yanıtlamadı',count:Math.max(0,t.opened-t.responded),color:'#f59e0b'},
      {label:'Hiç açmadı',count:Math.max(0,t.sent-t.opened),color:'#c3cad6'}
    ];
    const qHtml=(rep.questions||[]).map((q,i)=>{
      let inner;
      if(q.type==='text'){
        inner=q.texts&&q.texts.length
          ? `<ul class="rep-texts">${q.texts.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
          : `<div class="muted" style="font-size:13px">Henüz yazılı yanıt yok</div>`;
      }else{
        inner=pieHtml((q.distribution||[]).map(d=>({label:d.label,count:d.count})));
      }
      return `<div class="rep-q">
        <div class="rep-q-h">${i+1}. ${esc(q.title||'')}</div>
        <div class="muted" style="font-size:12px">${q.answered} kişi yanıtladı</div>
        ${inner}
      </div>`;
    }).join('');
    return `<div id="rep-body">
      <div class="rep-stats">
        <div class="rep-stat"><b>${t.sent}</b><span>Gönderildi</span></div>
        <div class="rep-stat"><b>${t.opened}</b><span>Açıldı (tıkladı)</span></div>
        <div class="rep-stat"><b>${t.responded}</b><span>Yanıtladı</span></div>
        <div class="rep-stat"><b>${notResp}</b><span>Yanıtlamadı</span></div>
      </div>
      <div class="rep-q"><div class="rep-q-h">Yanıt durumu</div>${pieHtml(statusParts)}</div>
      ${qHtml||'<div class="empty">Bu ankette soru yok</div>'}
      <details class="rep-recips"><summary>Alıcı listesi (${(rep.invites||[]).length})</summary>
        <div style="overflow:auto"><table><thead><tr><th>ALICI</th><th>KANAL</th><th>DURUM</th><th>AÇILMA</th><th>YANIT</th></tr></thead><tbody>
        ${(rep.invites||[]).map(v=>{
          const st=v.used_at?'<span class="badge green">Yanıtladı</span>':(v.opened_at?'<span class="badge orange">Açtı</span>':(v.sent_ok?'<span class="badge blue">Gönderildi</span>':'<span class="badge red">Gönderilemedi</span>'));
          return `<tr><td>${esc(v.name||'—')}${v.sent_error?`<small class="muted" style="display:block">${esc(v.sent_error)}</small>`:''}</td><td>${v.channel==='sms'?'SMS':'E-posta'}</td><td>${st}</td><td>${esc(fmtDT(v.opened_at))}</td><td>${esc(fmtDT(v.used_at))}</td></tr>`;
        }).join('')||'<tr><td colspan="5" class="empty">Alıcı yok</td></tr>'}
        </tbody></table></div>
      </details>
    </div>`;
  }

  async function openSurveyReport(id){
    let rep;
    try{rep=await api('/api/surveys/'+id+'/report');}catch(err){return toast(err.message);}
    modal('Anket raporu · '+esc(rep.survey.title),reportHtml(rep),()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    const s=document.querySelector('.modal .submit');if(s){s.textContent='Kapat';s.onclick=closeModal;}
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
        await load(kind,true);closeModal();render();toast(editing?'Anket güncellendi':'Anket şablonu oluşturuldu');
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

  // --- Make It Right · Ayın Personeli oylaması --------------------
  // Sol sütun = operasyon, sağ sütun = idari ofis
  const EOM_CATS=[['operasyon','Operasyon Çalışanları'],['idari','İdari Ofis Çalışanları']];
  const eomCatLabel=c=>(EOM_CATS.find(x=>x[0]===c)||['',''])[1];

  const eomInitials=n=>String(n||'?').trim().split(/\s+/).map(w=>w[0]||'').slice(0,2).join('').toLocaleUpperCase('tr-TR')||'?';
  function eomPhoto(c){
    return c.photo
      ? `<img class="eom-photo" src="${esc(c.photo)}" alt="${esc(c.name)}">`
      : `<span class="eom-photo eom-photo-ph">${esc(eomInitials(c.name))}</span>`;
  }

  // Oy pusulası — hem canlı görünüm hem önizleme aynı işaretlemeyi kullanır
  function eomColumnsHtml(data,{preview=false}={}){
    const manage=data.can_manage&&!preview;
    const open=data.period.status==='open';
    return EOM_CATS.map(([cat,label])=>{
      const cands=data.candidates.filter(c=>c.category===cat);
      const myPick=preview?null:data.my_votes[cat];
      const cards=cands.map(c=>{
        const picked=String(myPick)===String(c.id);
        return `<div class="eom-cand ${picked?'picked':''}">
          <label class="eom-cand-main">
            <input type="radio" name="${preview?'pv-':''}eom-${cat}" value="${c.id}" ${picked?'checked':''} ${(open&&!preview)?'':'disabled'}>
            ${eomPhoto(c)}
            <span class="eom-cand-body"><strong>${esc(c.name)}</strong>${c.subtitle?`<small class="muted">${esc(c.subtitle)}</small>`:''}</span>
          </label>
          ${manage?`<span class="eom-votes" title="Oy sayısı">${c.votes??0}</span><button type="button" class="btn ghost eom-edit" data-edit="${c.id}">Düzenle</button><button type="button" class="btn ghost danger-text eom-del" data-del="${c.id}">Sil</button>`:''}
        </div>`;
      }).join('')||'<div class="empty">Aday eklenmedi</div>';
      return `<div class="eom-col">
        <div class="eom-col-head"><span>${label}</span><span class="muted">${cands.length} aday</span></div>
        <div class="eom-cards">${cards}</div>
        ${manage&&open?`<button type="button" class="btn secondary eom-add" data-cat="${cat}">+ Aday ekle</button>`:''}
        ${!preview&&open&&myPick?`<button type="button" class="btn ghost eom-clear" data-cat="${cat}">Seçimi geri al</button>`:''}
      </div>`;
    }).join('');
  }

  let eomData=null;

  async function renderMakeItRight(){
    mount('<div class="card empty">Yükleniyor…</div>');
    let data;
    try{data=await api('/api/eom');}catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!=='makeitright')return;
    eomData=data;
    const manage=data.can_manage;

    if(!data.period){
      mount(`<div class="card">
        <div class="card-head"><h2>Ayın Personeli</h2></div>
        <div class="empty">Henüz bir oylama dönemi başlatılmadı.${manage?'':' İK bir dönem başlattığında burada oy kullanabilirsiniz.'}</div>
        ${manage?`<div style="margin-top:12px;text-align:center"><button class="btn" id="eom-new">+ Yeni dönem başlat</button></div>`:''}
      </div>`);
      if($('#eom-new'))$('#eom-new').onclick=eomNewPeriod;
      return;
    }

    const open=data.period.status==='open';
    mount(`<div class="card">
      <div class="card-head" style="align-items:center;gap:10px;flex-wrap:wrap">
        <h2 style="margin:0">Ayın Personeli · ${esc(data.period.title)}</h2>
        <span class="badge ${open?'green':'orange'}">${open?'Oylama açık':'Oylama kapandı'}</span>
        ${manage?`<span style="flex:1"></span><span class="muted">${data.voter_count||0} kişi oy kullandı</span>
          <button class="btn secondary" id="eom-preview">👁 Önizleme</button>
          ${open?`<button class="btn secondary" id="eom-invite">✉ Link gönder</button><button class="btn ghost" id="eom-close">Oylamayı kapat</button>`:`<button class="btn ghost" id="eom-reopen">Yeniden aç</button>`}
          <button class="btn" id="eom-new">Yeni dönem</button>`:''}
      </div>
      <p class="muted" style="margin:4px 0 16px">Her sütundan yalnızca <strong>1</strong> aday seçebilirsiniz. Seçiminiz otomatik kaydedilir.${open?'':' Oylama kapandığı için değişiklik yapılamaz.'}</p>
      <div class="eom-grid">${eomColumnsHtml(data,{preview:false})}</div>
    </div>`);

    document.querySelectorAll('input[type=radio][name^="eom-"]').forEach(r=>r.onchange=async()=>{
      const cat=r.name.slice(4);
      try{await api('/api/eom/votes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({category:cat,candidate_id:Number(r.value)})});toast('Oyunuz kaydedildi');renderMakeItRight();}
      catch(err){toast(err.message);renderMakeItRight();}
    });
    document.querySelectorAll('.eom-clear').forEach(b=>b.onclick=async()=>{
      try{await api('/api/eom/votes?category='+encodeURIComponent(b.dataset.cat),{method:'DELETE'});toast('Seçim geri alındı');renderMakeItRight();}
      catch(err){toast(err.message);}
    });
    document.querySelectorAll('.eom-add').forEach(b=>b.onclick=()=>eomCandidateModal(b.dataset.cat,null));
    document.querySelectorAll('.eom-edit').forEach(b=>b.onclick=()=>{
      const c=data.candidates.find(x=>String(x.id)===b.dataset.edit);
      if(c)eomCandidateModal(c.category,c);
    });
    document.querySelectorAll('.eom-del').forEach(b=>b.onclick=async()=>{
      if(!confirm('Bu adayı silmek istediğinize emin misiniz? Aldığı oylar da silinir.'))return;
      try{await api('/api/eom/candidates/'+b.dataset.del,{method:'DELETE'});toast('Aday silindi');renderMakeItRight();}
      catch(err){toast(err.message);}
    });
    if($('#eom-new'))$('#eom-new').onclick=eomNewPeriod;
    if($('#eom-preview'))$('#eom-preview').onclick=()=>eomPreview(eomData);
    if($('#eom-invite'))$('#eom-invite').onclick=()=>inviteModal('makeitright',{title:data.period.title});
    if($('#eom-close'))$('#eom-close').onclick=()=>{if(confirm('Oylamayı kapatmak istediğinize emin misiniz?'))eomSetStatus(data.period.id,'closed');};
    if($('#eom-reopen'))$('#eom-reopen').onclick=()=>eomSetStatus(data.period.id,'open');
  }

  function eomPreview(data){
    if(!data||!data.period)return;
    modal('Önizleme · Oy verenlerin göreceği ekran',
      `<div class="sv-preview">
       ${brandPreviewHead('Make It Right','Ayın Personeli',data.period.title)}
       <p class="muted" style="margin:0 0 14px">Her sütundan yalnızca <strong>1</strong> aday seçilebilir.</p>
       <div class="eom-grid eom-preview">${eomColumnsHtml(data,{preview:true})}</div>
       <button class="btn" type="button" disabled style="margin-top:16px">Oyumu gönder</button>
       </div>`,
      ()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    const s=document.querySelector('.modal .submit');if(s){s.textContent='Kapat';s.onclick=closeModal;}
  }

  function eomNewPeriod(){
    const now=new Date(),months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    modal('Yeni Ayın Personeli dönemi',
      `<div class="field"><label>Dönem başlığı</label><input class="input" id="eom-title" value="${esc(months[now.getMonth()]+' '+now.getFullYear())}"></div>
       <p class="muted" style="margin-top:10px">Açık bir dönem varsa kapatılır ve yeni dönem başlatılır. Yeni dönemde adaylar sıfırdan eklenir.</p>`,
      async()=>{
        const title=($('#eom-title').value||'').trim();
        if(!title)return toast('Dönem başlığı girin');
        try{await api('/api/eom/periods',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title})});closeModal();renderMakeItRight();toast('Yeni dönem başlatıldı');}
        catch(err){toast(err.message);}
      });
  }

  async function eomSetStatus(id,status){
    try{await api('/api/eom/periods/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});renderMakeItRight();toast(status==='closed'?'Oylama kapatıldı':'Oylama yeniden açıldı');}
    catch(err){toast(err.message);}
  }

  function eomCandidateModal(cat,existing){
    const editing=!!existing;
    const taken=(eomData?.candidates||[]);
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
        if(!editing&&employee_id)payload.employee_id=employee_id;
        if(photoData!=null)payload.photo=photoData;
        else if(removePhoto)payload.photo='';
        const submit=document.querySelector('.modal .submit');if(submit)submit.disabled=true;
        try{
          if(editing)await api('/api/eom/candidates/'+existing.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          else await api('/api/eom/candidates',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
          closeModal();renderMakeItRight();toast(editing?'Aday güncellendi':'Aday eklendi');
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

  // --- Kişiye özel tek kullanımlık link ile gönderim --------------
  const isEmail=v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());
  function inviteModal(kind,opts){
    opts=opts||{};
    let channel='email';
    let rows=[{name:'',email:'',phone:''}];
    let done=false;
    const path=kind==='personel'?'/api/surveys/'+opts.surveyId+'/invites':'/api/eom/invites';
    modal('Link gönder'+(opts.title?' · '+opts.title:''),'<div id="inv-body"></div>',async()=>{
      if(done){closeModal();if(kind!=='personel')renderMakeItRight();return;}
      const recipients=rows.map(r=>({name:r.name.trim(),email:r.email.trim(),phone:r.phone.trim()})).filter(r=>r.name||r.email||r.phone);
      if(!recipients.length)return toast('En az bir alıcı girin');
      if(channel==='email'&&recipients.some(r=>!isEmail(r.email)))return toast('Tüm alıcıların geçerli e-posta adresini girin');
      if(channel==='sms'&&recipients.some(r=>!r.phone))return toast('Tüm alıcıların telefon numarasını girin');
      const submit=document.querySelector('.modal .submit');if(submit)submit.disabled=true;
      try{
        const res=await api(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({channel,message:curMsg(),recipients})});
        showResult(res);
      }catch(err){toast(err.message);if(submit)submit.disabled=false;}
    });
    document.querySelector('.modal')?.classList.add('survey-modal');
    const box=()=>$('#inv-body');
    const curMsg=()=>($('#inv-msg')?$('#inv-msg').value:'');
    function rowHtml(r,i){
      return `<div class="inv-row" data-i="${i}">
        <input class="input" data-k="name" placeholder="Ad Soyad" value="${esc(r.name)}">
        <input class="input" data-k="email" placeholder="E-posta" value="${esc(r.email)}" ${channel==='sms'?'hidden':''}>
        <input class="input" data-k="phone" placeholder="Telefon" value="${esc(r.phone)}" ${channel==='email'?'hidden':''}>
        <button type="button" class="btn ghost danger-text" data-del="${i}" title="Sil">×</button>
      </div>`;
    }
    function redraw(){
      box().innerHTML=`
        <div class="field"><label>Gönderim kanalı</label>
          <div class="inv-channel">
            <label><input type="radio" name="inv-ch" value="email" ${channel==='email'?'checked':''}> E-posta</label>
            <label><input type="radio" name="inv-ch" value="sms" ${channel==='sms'?'checked':''}> SMS</label>
          </div>
        </div>
        <div class="field"><label>Alıcılar</label>
          <div class="inv-rows">${rows.map(rowHtml).join('')}</div>
          <button type="button" class="btn ghost" id="inv-add">+ Alıcı ekle</button>
        </div>
        <div class="field"><label>Mesaj (opsiyonel)</label>
          <textarea class="input" id="inv-msg" placeholder="Boş bırakılırsa standart metin gönderilir. {ad} ve {link} kullanılabilir.">${esc(curMsg())}</textarea>
        </div>
        <p class="muted" style="font-size:12px;margin:0">Her alıcıya kişiye özel, <strong>tek kullanımlık</strong> bir bağlantı oluşturulur. Bağlantı bir kez yanıtlandığında kapanır; düzeltme yapılamaz.</p>`;
      bind();
    }
    function bind(){
      box().querySelectorAll('[name="inv-ch"]').forEach(el=>el.onchange=()=>{channel=el.value;redraw();});
      box().querySelector('#inv-add').onclick=()=>{rows.push({name:'',email:'',phone:''});redraw();};
      box().querySelectorAll('.inv-row [data-k]').forEach(el=>{
        const i=Number(el.closest('.inv-row').dataset.i),k=el.dataset.k;
        el.oninput=()=>{rows[i][k]=el.value;};
      });
      box().querySelectorAll('[data-del]').forEach(el=>el.onclick=()=>{
        rows.splice(Number(el.dataset.del),1);if(!rows.length)rows=[{name:'',email:'',phone:''}];redraw();
      });
    }
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
    redraw();
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
    }else baseShell();
  };
})();
