(function(){
  // Uzun <select> alanlarını (çalışan, departman vb.) yazdıkça filtrelenen
  // arama kutusuna dönüştürür. Native select gizli tutulur; seçim yapılınca
  // value güncellenip 'change' olayı tetiklenir, mevcut kodlar aynen çalışır.
  const MIN_OPTIONS=10;
  const skip=sel=>sel.multiple||sel.dataset.cb||sel.dataset.noCombobox
    ||sel.classList.contains('att-select')||sel.classList.contains('shift-select')
    ||sel.classList.contains('approval-step')||sel.classList.contains('cb-native');

  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const norm=s=>String(s||'').toLocaleLowerCase('tr-TR');

  function enhance(sel){
    if(skip(sel)||sel.options.length<MIN_OPTIONS)return;
    sel.dataset.cb='1';
    const wrap=document.createElement('div');
    wrap.className='cb-wrap';
    sel.parentNode.insertBefore(wrap,sel);
    wrap.appendChild(sel);
    sel.classList.add('cb-native');

    const input=document.createElement('input');
    input.type='text';
    input.autocomplete='off';
    input.spellcheck=false;
    input.className=(sel.className.replace('cb-native','').trim()||'select')+' cb-input';
    input.placeholder=sel.dataset.cbPlaceholder||'Yazarak ara…';
    if(sel.disabled)input.disabled=true;
    const menu=document.createElement('div');
    menu.className='cb-menu';
    menu.hidden=true;
    wrap.appendChild(input);
    wrap.appendChild(menu);

    const currentLabel=()=>sel.selectedOptions[0]?sel.selectedOptions[0].textContent:'';
    const sync=()=>{input.value=currentLabel();};
    sync();

    let active=-1;
    const build=(q='')=>{
      const nq=norm(q);
      const list=[...sel.options].map(o=>({v:o.value,l:o.textContent})).filter(it=>!nq||norm(it.l).includes(nq));
      menu.innerHTML=list.length
        ? list.map(it=>`<div class="cb-opt${it.v===sel.value?' cb-cur':''}" data-value="${esc(it.v)}">${esc(it.l)}</div>`).join('')
        : '<div class="cb-empty">Eşleşme yok</div>';
      active=-1;
    };
    const openMenu=()=>{build('');menu.hidden=false;};
    const closeMenu=()=>{menu.hidden=true;sync();};
    const pick=v=>{
      if(sel.value!==v){sel.value=v;sel.dispatchEvent(new Event('change',{bubbles:true}));}
      sync();menu.hidden=true;
    };

    input.addEventListener('focus',()=>{input.value='';openMenu();});
    input.addEventListener('input',()=>{menu.hidden=false;build(input.value);});
    input.addEventListener('keydown',e=>{
      const opts=[...menu.querySelectorAll('.cb-opt')];
      if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(active+1,opts.length-1);}
      else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);}
      else if(e.key==='Enter'){e.preventDefault();const o=opts[active]||opts[0];if(o)pick(o.dataset.value);input.blur();return;}
      else if(e.key==='Escape'){closeMenu();input.blur();return;}
      else return;
      opts.forEach((o,i)=>o.classList.toggle('cb-active',i===active));
      if(opts[active])opts[active].scrollIntoView({block:'nearest'});
    });
    menu.addEventListener('mousedown',e=>{
      const o=e.target.closest('.cb-opt');
      if(o){e.preventDefault();pick(o.dataset.value);}
    });
    input.addEventListener('blur',()=>setTimeout(closeMenu,150));

    // Kod tarafı select'i sonradan değiştirirse (ör. p-employee -> p-gross) yansıt
    sel.addEventListener('change',()=>{if(document.activeElement!==input)sync();});
  }

  function scan(node){
    if(node.nodeType!==1)return;
    if(node.tagName==='SELECT')enhance(node);
    else if(node.querySelectorAll)node.querySelectorAll('select').forEach(enhance);
  }

  new MutationObserver(muts=>{
    for(const m of muts)for(const node of m.addedNodes)scan(node);
  }).observe(document.body,{childList:true,subtree:true});
  scan(document.body);
})();
