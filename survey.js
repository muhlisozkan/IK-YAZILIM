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
  function surveyPreviewHtml(title,description,questions){
    return `<div class="sv-preview">
      <h2 style="margin:0 0 4px;font-size:18px">${esc(title||'(anket başlığı)')}</h2>
      ${description?`<p class="muted" style="margin:0 0 16px">${esc(description)}</p>`:''}
      ${(questions||[]).map((q,i)=>`<div class="sv-pv-q"><div class="sv-pv-title">${i+1}. ${esc(q.title||'(başlıksız soru)')}${q.required?' <span class="danger-text">*</span>':''}</div>${q.detail?`<div class="muted" style="font-size:12px;margin:2px 0 8px">${esc(q.detail)}</div>`:''}${previewControl(q,i)}</div>`).join('')||'<div class="empty">Henüz soru yok</div>'}
      <button class="btn" type="button" disabled style="margin-top:14px">Anketi gönder</button>
    </div>`;
  }
  function previewSurvey(s){
    modal('Önizleme · '+(s.title||'Anket'),surveyPreviewHtml(s.title,s.description,s.questions),()=>closeModal());
    document.querySelector('.modal')?.classList.add('survey-modal');
    const submit=document.querySelector('.modal .submit');if(submit){submit.textContent='Kapat';submit.onclick=closeModal;}
  }

  const tabs=[['personel','Personel Anketi'],['makeitright','Make It Right']];
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
    return `<div class="section-title"><div><h2>Anket</h2><span class="muted">Personel anketleri ve Make It Right geri bildirimleri</span></div></div>
      <div class="leave-tabs" style="margin-bottom:16px;flex-wrap:wrap">${tabs.map(([k,l])=>`<button class="btn ${tab===k?'':'secondary'}" data-survey-tab="${k}">${l}</button>`).join('')}</div>
      <div id="survey-body">${body}</div>`;
  }
  function mount(body){
    $('#app').innerHTML=shellHtml(body);
    document.querySelectorAll('[data-survey-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.surveyTab;sessionStorage.setItem('ik_survey_tab',tab);render();});
  }

  async function renderPersonel(){
    mount('<div class="card empty">Yükleniyor…</div>');
    let list;
    try{list=await load('personel');}catch(err){mount(`<div class="card empty">${esc(err.message)}</div>`);return;}
    if(tab!=='personel')return;
    const manage=canManage();
    const rows=list.map(s=>`<tr data-id="${s.id}">
      <td><strong>${esc(s.title)}</strong>${s.description?`<small class="muted" style="display:block">${esc(s.description)}</small>`:''}</td>
      <td>${(s.questions||[]).length} soru</td>
      <td><span class="badge ${s.active?'green':'orange'}">${s.active?'Aktif':'Pasif'}</span></td>
      <td class="row-actions"><button class="btn ghost" data-survey-preview="${s.id}">Önizle</button>${manage?`<button class="btn ghost" data-survey-edit="${s.id}">Düzenle</button><button class="btn ghost" data-survey-copy="${s.id}">Kopyala</button><button class="btn ghost danger-text" data-survey-del="${s.id}">Sil</button>`:''}</td>
    </tr>`).join('');
    mount(`<div class="card">
      <div class="toolbar">
        ${manage?`<button class="btn" id="survey-add">+ Yeni anket şablonu</button>`:''}
        <span class="muted">${list.length} şablon</span>
      </div>
      <div style="overflow:auto"><table><thead><tr><th>ANKET</th><th>SORU</th><th>DURUM</th><th></th></tr></thead>
      <tbody>${rows||`<tr><td colspan="4" class="empty">Henüz anket şablonu yok</td></tr>`}</tbody></table></div>
    </div>`);
    if($('#survey-add'))$('#survey-add').onclick=()=>openBuilder('personel',null);
    document.querySelectorAll('[data-survey-preview]').forEach(b=>b.onclick=()=>previewSurvey(list.find(s=>String(s.id)===b.dataset.surveyPreview)));
    document.querySelectorAll('[data-survey-edit]').forEach(b=>b.onclick=()=>openBuilder('personel',list.find(s=>String(s.id)===b.dataset.surveyEdit)));
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

  function render(){
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.view==='survey'));
    $('#page-title').textContent='Anket';
    if(!tabs.some(t=>t[0]===tab))tab='personel';
    if(tab==='personel')renderPersonel();
    else mount(`<div class="card"><div class="card-head"><h2>Make It Right</h2></div><div class="empty">Bu bölümün içeriği henüz kurgulanmadı.</div></div>`);
  }

  const baseShell=shell;
  shell=function(){
    if(state.view==='survey'){
      if(window.__ikCan&&!window.__ikCan('survey')){state.view='dashboard';baseShell();return;}
      render();
    }else baseShell();
  };
})();
