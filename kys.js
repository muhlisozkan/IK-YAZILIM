// Kalite Yönetim Sistemi (KYS) — 8 alt modül, ortak iskelet (liste + ekle/düzenle/sil).
// Veri deposu: kys_records (module, department, data jsonb) — hms_records paterniyle aynı.
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? esc(v) : d.toLocaleDateString('tr-TR'); };
  async function api(path, opt) {
    const r = await fetch(path, opt);
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'İşlem tamamlanamadı');
    return d;
  }
  function canWriteKys() { return (window.__ikKysAccess?.() || 'none') === 'full'; }
  function canSeeKys() { return (window.__ikKysAccess?.() || 'none') !== 'none'; }
  function canApproveDokuman() { return Boolean(window.__ikKysCanApproveDokuman?.()); }
  const fmtBytes = n => { if (!n) return ''; const kb = n / 1024; return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`; };
  async function uploadDokumanFile(id, file) {
    const buf = await file.arrayBuffer();
    const r = await fetch(`/api/kys/dokuman/${id}/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), 'X-Filetype': file.type || 'application/octet-stream' },
      body: buf
    });
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'Dosya yüklenemedi');
    return d;
  }
  async function dokumanAction(id, action, body) {
    return api(`/api/kys/dokuman/${id}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }

  const MOD = {
    dokuman: {
      view: 'kys-dokuman', title: 'Doküman Yönetimi',
      desc: 'Kalite el kitabı, prosedür, talimat ve formların versiyon kontrolü',
      fields: [
        { key: 'title', label: 'Doküman adı', required: true },
        { key: 'docNo', label: 'Doküman no' },
        { key: 'category', label: 'Tür', type: 'select', options: ['Kalite El Kitabı', 'Prosedür', 'Talimat', 'Form', 'Diğer'] },
        { key: 'version', label: 'Revizyon no' },
        { key: 'effectiveDate', label: 'Yürürlük tarihi', type: 'date' },
        { key: 'owner', label: 'Doküman sahibi' },
        { key: 'note', label: 'Açıklama', type: 'textarea' }
        // status alanı yok: yalnızca onay akışı (Onaya Gönder / Onayla / Reddet / İptal) ile değişir.
      ],
      columns: [['title', 'Doküman'], ['docNo', 'No'], ['category', 'Tür'], ['version', 'Rev.'], ['effectiveDate', 'Yürürlük'], ['status', 'Durum'], ['file', 'Dosya']],
      workflow: true
    },
    hedefler: {
      view: 'kys-hedefler', title: 'Kalite Hedefleri / KPI',
      desc: 'Departman bazlı kalite hedefleri ve gerçekleşme takibi',
      fields: [
        { key: 'title', label: 'Hedef', required: true },
        { key: 'department', label: 'Departman' },
        { key: 'indicator', label: 'Gösterge (KPI)' },
        { key: 'target', label: 'Hedef değer' },
        { key: 'current', label: 'Gerçekleşen' },
        { key: 'period', label: 'Dönem (ör. 2026 Ç3)' },
        { key: 'status', label: 'Durum', type: 'select', options: ['Devam Ediyor', 'Ulaşıldı', 'Ulaşılamadı'], default: 'Devam Ediyor' },
        { key: 'note', label: 'Not', type: 'textarea' }
      ],
      columns: [['title', 'Hedef'], ['department', 'Departman'], ['target', 'Hedef'], ['current', 'Gerçekleşen'], ['period', 'Dönem'], ['status', 'Durum']]
    },
    ygg: {
      view: 'kys-ygg', title: 'Yönetimin Gözden Geçirmesi',
      desc: 'YGG toplantı kayıtları, kararlar ve aksiyon takibi',
      fields: [
        { key: 'title', label: 'Toplantı konusu', required: true },
        { key: 'meetingDate', label: 'Toplantı tarihi', type: 'date' },
        { key: 'participants', label: 'Katılımcılar' },
        { key: 'decisions', label: 'Kararlar', type: 'textarea' },
        { key: 'actionOwner', label: 'Aksiyon sorumlusu' },
        { key: 'dueDate', label: 'Termin', type: 'date' },
        { key: 'status', label: 'Durum', type: 'select', options: ['Planlandı', 'Tamamlandı', 'Ertelendi'], default: 'Planlandı' }
      ],
      columns: [['title', 'Konu'], ['meetingDate', 'Tarih'], ['actionOwner', 'Aksiyon Sorumlusu'], ['dueDate', 'Termin'], ['status', 'Durum']]
    },
    tedarikci: {
      view: 'kys-tedarikci', title: 'Tedarikçi Değerlendirme',
      desc: 'Tedarikçi performans ve uygunluk değerlendirme kayıtları',
      fields: [
        { key: 'title', label: 'Tedarikçi adı', required: true },
        { key: 'category', label: 'Hizmet / kategori' },
        { key: 'evalDate', label: 'Değerlendirme tarihi', type: 'date' },
        { key: 'score', label: 'Puan (0-100)', type: 'number' },
        { key: 'status', label: 'Durum', type: 'select', options: ['Onaylı', 'Şartlı Onaylı', 'Reddedildi'], default: 'Onaylı' },
        { key: 'note', label: 'Not', type: 'textarea' }
      ],
      columns: [['title', 'Tedarikçi'], ['category', 'Kategori'], ['evalDate', 'Tarih'], ['score', 'Puan'], ['status', 'Durum']]
    },
    kalibrasyon: {
      view: 'kys-kalibrasyon', title: 'Kalibrasyon / Ekipman Takibi',
      desc: 'Ölçüm ve teknik ekipmanların kalibrasyon takvimi',
      fields: [
        { key: 'title', label: 'Ekipman adı', required: true },
        { key: 'department', label: 'Bölüm' },
        { key: 'lastCalibDate', label: 'Son kalibrasyon', type: 'date' },
        { key: 'nextCalibDate', label: 'Sonraki kalibrasyon', type: 'date' },
        { key: 'responsible', label: 'Sorumlu' }
        // status alanı yok: "sonraki kalibrasyon" tarihinden otomatik hesaplanır.
      ],
      columns: [['title', 'Ekipman'], ['department', 'Bölüm'], ['lastCalibDate', 'Son Kalib.'], ['nextCalibDate', 'Sonraki Kalib.'], ['status', 'Durum']]
    },
    sikayet: {
      view: 'kys-sikayet', title: 'Misafir Şikayet & Memnuniyet',
      desc: 'Misafir şikayetlerinin kalite bakış açısıyla kayıt, kök neden ve kapatma takibi',
      fields: [
        { key: 'title', label: 'Konu', required: true },
        { key: 'department', label: 'İlgili departman' },
        { key: 'guestName', label: 'Misafir adı' },
        { key: 'date', label: 'Tarih', type: 'date' },
        { key: 'description', label: 'Açıklama', type: 'textarea' },
        { key: 'rootCause', label: 'Kök neden', type: 'textarea' },
        { key: 'action', label: 'Aksiyon', type: 'textarea' },
        { key: 'status', label: 'Durum', type: 'select', options: ['Açık', 'İnceleniyor', 'Kapatıldı'], default: 'Açık' }
      ],
      columns: [['title', 'Konu'], ['department', 'Departman'], ['guestName', 'Misafir'], ['date', 'Tarih'], ['status', 'Durum']]
    },
    denetim: {
      view: 'kys-denetim', title: 'Marka Standart Denetimi',
      desc: 'LQA / mystery guest tipi departman kontrol turları ve puanlama',
      fields: [
        { key: 'title', label: 'Denetim alanı / konu', required: true },
        { key: 'department', label: 'Departman' },
        { key: 'auditDate', label: 'Tarih', type: 'date' },
        { key: 'auditor', label: 'Denetçi' },
        { key: 'score', label: 'Puan', type: 'number' },
        { key: 'findings', label: 'Bulgular', type: 'textarea' },
        { key: 'correctiveAction', label: 'Düzeltici faaliyet', type: 'textarea' },
        { key: 'status', label: 'Durum', type: 'select', options: ['Planlandı', 'Tamamlandı', 'Aksiyon Bekliyor', 'Kapatıldı'], default: 'Planlandı' }
      ],
      columns: [['title', 'Alan'], ['department', 'Departman'], ['auditDate', 'Tarih'], ['score', 'Puan'], ['status', 'Durum']]
    },
    haccp: {
      view: 'kys-haccp', title: 'Gıda Güvenliği / HACCP',
      desc: 'Mutfak-restoran için kritik kontrol noktaları (CCP) ve kayıtları',
      fields: [
        { key: 'title', label: 'Kritik kontrol noktası (CCP)', required: true },
        { key: 'area', label: 'Bölüm / mutfak' },
        { key: 'date', label: 'Tarih', type: 'date' },
        { key: 'measuredValue', label: 'Ölçülen değer' },
        { key: 'limit', label: 'Kritik limit' },
        { key: 'correctiveAction', label: 'Düzeltici faaliyet', type: 'textarea' },
        { key: 'status', label: 'Durum', type: 'select', options: ['Uygun', 'Sapma', 'Düzeltildi'], default: 'Uygun' }
      ],
      columns: [['title', 'CCP'], ['area', 'Bölüm'], ['date', 'Tarih'], ['measuredValue', 'Ölçülen'], ['status', 'Durum']]
    }
  };
  const VIEW_TO_KEY = {};
  Object.keys(MOD).forEach(k => VIEW_TO_KEY[MOD[k].view] = k);

  // Belirli bir "kapanış" durumuna geçmeden önce doldurulması zorunlu alanlar (erken/eksik kapatmayı önler).
  const CLOSE_GATES = {
    sikayet: { status: 'Kapatıldı', fields: ['rootCause', 'action'], message: 'Kapatmadan önce kök neden ve aksiyon alanlarını doldurun' },
    denetim: { status: 'Kapatıldı', fields: ['findings', 'correctiveAction'], message: 'Kapatmadan önce bulgular ve düzeltici faaliyet alanlarını doldurun' },
    haccp: { status: 'Düzeltildi', fields: ['correctiveAction'], message: '"Düzeltildi" işaretlemeden önce düzeltici faaliyet alanını doldurun' }
  };

  const S = { cache: {} };

  function badgeClass(status) {
    const s = String(status || '').toLocaleLowerCase('tr-TR');
    if (/şartlı/.test(s)) return 'orange';
    if (/yürürlük|tamamla|kapat|geçerli|uygun|onaylı|ulaşıldı|düzeltildi/.test(s)) return 'green';
    if (/iptal|süresi geçti|reddedildi|sapma|ulaşılamadı|ertelendi/.test(s)) return 'red';
    return 'orange';
  }

  function fmtVal(f, v) {
    if (v == null || v === '') return '—';
    if (f && f.type === 'date') return fmtDate(v);
    return esc(v);
  }

  function fieldInput(f, val) {
    const v = val == null ? '' : val;
    if (f.type === 'select') {
      return `<select class="select" id="kys-f-${f.key}">${f.options.map(o => `<option ${String(v || f.default || '') === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    }
    if (f.type === 'textarea') {
      return `<textarea class="input" id="kys-f-${f.key}" rows="3" style="width:100%;resize:vertical">${esc(v)}</textarea>`;
    }
    const type = f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text';
    return `<input class="input" id="kys-f-${f.key}" type="${type}" style="width:100%" value="${esc(v)}">`;
  }

  function openForm(key, row) {
    const cfg = MOD[key];
    const fileBlock = !cfg.workflow ? '' : `<div class="field" style="grid-column:1/-1">
      <label>Dosya eki (PDF/Word, en fazla 15 MB)</label>
      <input class="input" id="kys-f-file" type="file" accept=".pdf,.doc,.docx" style="width:100%">
      ${row && row.fileId ? `<div class="muted" style="margin-top:5px;font-size:11.5px">Mevcut dosya: <a href="/api/kys/dokuman/${row.id}/file" target="_blank" rel="noopener">${esc(row.fileName || 'dosya')}</a> (${fmtBytes(row.fileSize)}) — yeni dosya seçersen bunun yerine geçer</div>` : ''}
    </div>`;
    const body = `<div class="form-grid">${cfg.fields.map(f => `<div class="field"${f.type === 'textarea' ? ' style="grid-column:1/-1"' : ''}><label>${esc(f.label)}${f.required ? ' *' : ''}</label>${fieldInput(f, row ? row[f.key] : '')}</div>`).join('')}</div>${fileBlock}`;
    modal(row ? `${cfg.title} — kaydı düzenle` : `${cfg.title} — yeni kayıt`, body, async () => {
      const data = {};
      cfg.fields.forEach(f => { data[f.key] = document.getElementById('kys-f-' + f.key).value.trim(); });
      if (cfg.fields.some(f => f.required && !data[f.key])) return toast('Zorunlu alanları doldurun');
      const closeGate = CLOSE_GATES[key];
      if (closeGate && data.status === closeGate.status && closeGate.fields.some(k => !data[k])) {
        return toast(closeGate.message);
      }
      const fileInput = cfg.workflow ? document.getElementById('kys-f-file') : null;
      const file = fileInput && fileInput.files[0];
      try {
        let saved;
        if (row) saved = await api(`/api/kys/${key}/${row.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        else saved = await api(`/api/kys/${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (file) await uploadDokumanFile(saved.id, file);
        closeModal(); toast(row ? 'Kayıt güncellendi' : 'Kayıt eklendi');
        S.cache[key] = null; render(key);
        window.__ikRefreshKysPending?.();
      } catch (err) { toast(err.message); }
    });
  }

  async function removeRow(key, id) {
    if (!confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    try {
      await api(`/api/kys/${key}/${id}`, { method: 'DELETE' });
      toast('Kayıt silindi'); S.cache[key] = null; render(key);
    } catch (err) { toast(err.message); }
  }

  async function runDokumanAction(id, action, note) {
    try {
      await dokumanAction(id, action, note != null ? { note } : undefined);
      const msg = { submit: 'Onaya gönderildi', approve: 'Onaylandı ve yürürlüğe girdi', reject: 'Reddedildi', retire: 'İptal edildi' }[action];
      toast(msg); S.cache.dokuman = null; render('dokuman');
      window.__ikRefreshKysPending?.();
    } catch (err) { toast(err.message); }
  }

  function dokumanActionsHtml(r, canWrite, canApprove, canRequestRevision) {
    if (r.status === 'Onay Bekliyor') {
      if (canApprove) return `<button class="btn ghost" data-kys-approve="${r.id}">Onayla</button><button class="btn ghost danger-text" data-kys-reject="${r.id}">Reddet</button>`;
      return '<span class="muted" style="font-size:11.5px">Onay bekliyor</span>';
    }
    const btns = [];
    if (r.revisionRequested) {
      btns.push(`<span class="badge orange" title="${esc(r.revisionRequestNote || '')}">Revizyon Talebi</span>`);
      if (canWrite) btns.push(`<button class="btn ghost" data-kys-clearrev="${r.id}">Talebi Kapat</button>`);
    } else if (canRequestRevision && r.status !== 'İptal') {
      btns.push(`<button class="btn ghost" data-kys-reqrev="${r.id}">Revizyon Talep Et</button>`);
    }
    if (canWrite) btns.push(`<button class="btn ghost" data-kys-edit="${r.id}">Düzenle</button>`);
    if (canWrite && ['Taslak', 'Revizyonda'].includes(r.status)) btns.push(`<button class="btn ghost" data-kys-submit="${r.id}">Onaya Gönder</button>`);
    if (canWrite && r.status !== 'İptal') btns.push(`<button class="btn ghost danger-text" data-kys-retire="${r.id}">İptal Et</button>`);
    if (canWrite) btns.push(`<button class="btn ghost danger-text" data-kys-del="${r.id}">Sil</button>`);
    return btns.join('');
  }

  // Revizyon talebi: departman (veya Kalite/İK) yazmaya başladıkça eşleşen dokümanlar
  // aşağıda listelenir, seçilince bilgiler otomatik gelir.
  function dokumanOpenRevisionModal(rows, preselected) {
    let selected = preselected || null;
    const body = `
      <div class="field">
        <label>Doküman ara (ad veya doküman no) *</label>
        <input class="input" id="rev-search" placeholder="Yazmaya başlayın…" autocomplete="off" style="width:100%" value="${preselected ? esc(preselected.title) : ''}">
        <div id="rev-suggestions" class="rev-suggestions"></div>
      </div>
      <div id="rev-selected-info"></div>
      <div class="field" style="margin-top:12px"><label>Revizyon talebi açıklaması *</label><textarea class="input" id="rev-note" rows="4" style="width:100%"></textarea></div>`;
    function paintSelected() {
      const el = document.getElementById('rev-selected-info');
      if (!selected) { el.innerHTML = ''; return; }
      el.innerHTML = `<div class="form-grid" style="margin-top:10px">
        <div class="field"><label>Doküman no</label><div class="muted">${esc(selected.docNo || '—')}</div></div>
        <div class="field"><label>Tür</label><div class="muted">${esc(selected.category || '—')}</div></div>
        <div class="field"><label>Revizyon no</label><div class="muted">${esc(selected.version || '—')}</div></div>
        <div class="field"><label>Doküman sahibi</label><div class="muted">${esc(selected.owner || '—')}</div></div>
        <div class="field" style="grid-column:1/-1"><label>Mevcut durum</label><span class="badge ${badgeClass(selected.status)}">${esc(selected.status)}</span></div>
      </div>`;
    }
    function paintSuggestions(term) {
      const box = document.getElementById('rev-suggestions');
      if (!term || term.trim().length < 2) { box.innerHTML = ''; return; }
      const t = term.toLocaleLowerCase('tr-TR');
      const matches = rows.filter(r => r.status !== 'İptal' && (String(r.title || '').toLocaleLowerCase('tr-TR').includes(t) || String(r.docNo || '').toLocaleLowerCase('tr-TR').includes(t))).slice(0, 8);
      box.innerHTML = matches.length
        ? matches.map(r => `<div class="rev-suggest-item" data-rev-pick="${r.id}">${esc(r.title)} <span class="muted">${esc(r.docNo || '')}</span></div>`).join('')
        : '<div class="rev-suggest-item muted" style="cursor:default">Eşleşen doküman yok</div>';
      box.querySelectorAll('[data-rev-pick]').forEach(item => item.onclick = () => {
        selected = rows.find(r => String(r.id) === item.dataset.revPick);
        document.getElementById('rev-search').value = selected.title;
        box.innerHTML = '';
        paintSelected();
      });
    }
    modal('Revizyon Talebi', body, async () => {
      if (!selected) return toast('Listeden bir doküman seçin');
      const note = document.getElementById('rev-note').value.trim();
      if (!note) return toast('Talep açıklaması zorunludur');
      try {
        await api(`/api/kys/dokuman/${selected.id}/request-revision`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
        closeModal(); toast('Revizyon talebi Kalite departmanına gönderildi');
        S.cache.dokuman = null; render('dokuman');
        window.__ikRefreshKysPending?.();
      } catch (err) { toast(err.message); }
    });
    document.getElementById('rev-search').oninput = e => paintSuggestions(e.target.value);
    if (preselected) paintSelected();
  }

  async function render(key) {
    if (state.view !== MOD[key].view) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    syncNavGroup();
    const cfg = MOD[key];
    $('#page-title').textContent = cfg.title;
    // Doküman Yönetimi diğer KYS modüllerinden farklı: Departman yöneticisi de
    // erişebilir (yalnız görüntüleme + revizyon talebi), bu yüzden ayrı bir erişim kapısı var.
    const isDokuman = key === 'dokuman';
    const dAccess = isDokuman ? (window.__ikDokumanAccess?.() || 'none') : null;
    if (isDokuman ? dAccess === 'none' : !canSeeKys()) { $('#app').innerHTML = '<div class="card empty">Bu modüle erişim yetkiniz yok.</div>'; return; }
    const canWrite = isDokuman ? dAccess === 'full' : canWriteKys();
    const canRequestRevision = isDokuman && ['full', 'dept'].includes(dAccess);
    if (!document.querySelector('#kys-wrap')) $('#app').innerHTML = '<div class="card empty">Yükleniyor…</div>';
    let rows = S.cache[key];
    if (!rows) {
      try { rows = await api(`/api/kys/${key}`); S.cache[key] = rows; }
      catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    }
    if (state.view !== MOD[key].view) return;
    const canApprove = cfg.workflow && canApproveDokuman();
    const trs = rows.map(r => `<tr data-id="${r.id}">${cfg.columns.map(([k]) => {
      if (k === 'status') return `<td><span class="badge ${badgeClass(r.status)}">${esc(r.status || '—')}</span></td>`;
      if (k === 'file') return `<td>${r.fileId ? `<a href="/api/kys/dokuman/${r.id}/file" target="_blank" rel="noopener">${esc(r.fileName || 'İndir')}</a>` : '—'}</td>`;
      const f = cfg.fields.find(x => x.key === k);
      return `<td>${fmtVal(f, r[k])}</td>`;
    }).join('')}<td class="row-actions">${cfg.workflow ? dokumanActionsHtml(r, canWrite, canApprove, canRequestRevision) : (canWrite ? `<button class="btn ghost" data-kys-edit="${r.id}">Düzenle</button><button class="btn ghost danger-text" data-kys-del="${r.id}">Sil</button>` : '')}</td></tr>`).join('');
    $('#app').innerHTML = `
      <div id="kys-wrap">
        <div class="section-title"><div><h2>${esc(cfg.title)}</h2><span class="muted">${esc(cfg.desc)}</span></div>
          <div style="display:flex;gap:8px">
            ${canWrite ? '<button class="btn" id="kys-add">+ Yeni kayıt</button>' : ''}
            ${canRequestRevision ? '<button class="btn secondary" id="kys-reqrev">Revizyon Talebi</button>' : ''}
          </div>
        </div>
        <div class="card"><div style="overflow:auto"><table><thead><tr>${cfg.columns.map(([, l]) => `<th>${esc(l)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${trs || `<tr><td colspan="${cfg.columns.length + 1}" class="empty">Henüz kayıt yok</td></tr>`}</tbody></table></div></div>
      </div>`;
    document.getElementById('kys-add')?.addEventListener('click', () => openForm(key, null));
    document.getElementById('kys-reqrev')?.addEventListener('click', () => dokumanOpenRevisionModal(rows, null));
    document.querySelectorAll('[data-kys-reqrev]').forEach(b => b.onclick = () => dokumanOpenRevisionModal(rows, rows.find(r => String(r.id) === b.dataset.kysReqrev)));
    document.querySelectorAll('[data-kys-clearrev]').forEach(b => b.onclick = async () => {
      try {
        await api(`/api/kys/dokuman/${b.dataset.kysClearrev}/clear-revision-request`, { method: 'POST' });
        toast('Revizyon talebi kapatıldı'); S.cache.dokuman = null; render('dokuman');
        window.__ikRefreshKysPending?.();
      } catch (err) { toast(err.message); }
    });
    document.querySelectorAll('[data-kys-edit]').forEach(b => b.onclick = () => openForm(key, rows.find(r => String(r.id) === b.dataset.kysEdit)));
    document.querySelectorAll('[data-kys-del]').forEach(b => b.onclick = () => removeRow(key, b.dataset.kysDel));
    document.querySelectorAll('[data-kys-submit]').forEach(b => b.onclick = () => runDokumanAction(b.dataset.kysSubmit, 'submit'));
    document.querySelectorAll('[data-kys-approve]').forEach(b => b.onclick = () => runDokumanAction(b.dataset.kysApprove, 'approve'));
    document.querySelectorAll('[data-kys-retire]').forEach(b => b.onclick = () => { if (confirm('Bu dokümanı iptal etmek istediğinize emin misiniz?')) runDokumanAction(b.dataset.kysRetire, 'retire'); });
    document.querySelectorAll('[data-kys-reject]').forEach(b => b.onclick = () => {
      const note = prompt('Red gerekçesi (isteğe bağlı):');
      if (note === null) return;
      runDokumanAction(b.dataset.kysReject, 'reject', note);
    });
  }

  // --- Entegre Yönetim Sistemi: klasör klasör doküman arşivi gezgini -----
  const EYS_VIEW = 'kys-eys';
  const FOLDER_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" style="vertical-align:-4px;margin-right:7px;flex-shrink:0"><path d="M3 6.5a2 2 0 0 1 2-2h4.4l2 2H19a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-10.5Z" fill="#f6c343" stroke="#d99e1f" stroke-width="1.2" stroke-linejoin="round"/></svg>';
  // İki ayrı ağ paylaşımı — sayfa içi sekme olarak seçiliyor (backend her istekte source= alıyor).
  const EYS_TABS = [
    { key: 'eys', label: 'Entegre Yönetim Sistemi' },
    { key: 'kayitlar', label: 'Entegre Yönetim Sistemi Kayıtlar' }
  ];
  let eysSource = 'eys';
  try { eysSource = sessionStorage.getItem('ik_eys_source') || 'eys'; } catch (_) { /* özel gezinti modu */ }
  if (!EYS_TABS.some(t => t.key === eysSource)) eysSource = 'eys';
  let eysPath = '';
  function eysLoadPathForSource() {
    try { eysPath = sessionStorage.getItem('ik_eys_path_' + eysSource) || ''; } catch (_) { eysPath = ''; }
  }
  eysLoadPathForSource();
  function eysSetPath(p) {
    eysPath = p || '';
    try { sessionStorage.setItem('ik_eys_path_' + eysSource, eysPath); } catch (_) { /* özel gezinti modu */ }
  }
  function eysSetSource(src) {
    if (src === eysSource) return;
    eysSource = src;
    try { sessionStorage.setItem('ik_eys_source', eysSource); } catch (_) { /* özel gezinti modu */ }
    eysLoadPathForSource();
  }
  const eysExt = name => (name.split('.').pop() || '').toLowerCase();
  const eysPreviewKind = name => {
    const ext = eysExt(name);
    // .doc/.xls: backend aynı /api/eys/file?inline=1 ucunda LibreOffice ile PDF'e
    // çevirip gönderiyor — frontend için normal bir PDF önizlemesinden farksız.
    if (ext === 'pdf' || ext === 'doc' || ext === 'xls') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    if (ext === 'xlsx' || ext === 'xltx') return 'xlsx';
    if (ext === 'docx') return 'docx';
    return null;
  };

  const EYS = { items: [], searchTerm: '', searching: false, selected: null, xlsx: null, docx: null, pdf: null };

  // PDF önizleme: bazı tarayıcılarda (ör. Samsung Internet / Android'de birçok
  // tarayıcı) <iframe src="...pdf"> hiçbir şey göstermiyor — yerleşik PDF
  // görüntüleyicileri yok. Bunun yerine PDF.js'i (kendi sunucumuzdan, /pdfjs/)
  // gömüp sayfaları <canvas>'a çiziyoruz — tüm tarayıcılarda aynı şekilde çalışır.
  let pdfjsLibPromise = null;
  function loadPdfjs() {
    if (!pdfjsLibPromise) {
      pdfjsLibPromise = import('/pdfjs/pdf.min.js').then(mod => {
        mod.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';
        return mod;
      });
    }
    return pdfjsLibPromise;
  }

  function eysXlsxBodyHtml() {
    const x = EYS.xlsx;
    if (!x || x.loading) return '<div class="empty">Excel yükleniyor…</div>';
    if (x.error) return `<div class="empty">${esc(x.error)}</div>`;
    const tabs = x.sheetMeta.length > 1
      ? `<div class="eys-xlsx-tabs">${x.sheetMeta.map((s, i) => `<button class="btn ghost eys-xlsx-tab${i === x.idx ? ' active' : ''}" data-eys-sheet="${i}">${esc(s.name)}</button>`).join('')}</div>`
      : '';
    const sheetData = x.cache[x.idx];
    return `<div class="eys-xlsx-wrap">${tabs}${sheetData ? window.__ikSheetTableHtml(sheetData) : '<div class="empty">Sayfa yükleniyor…</div>'}</div>`;
  }

  function eysDocxBodyHtml() {
    const d = EYS.docx;
    if (!d || d.loading) return '<div class="empty">Word yükleniyor…</div>';
    if (d.error) return `<div class="empty">${esc(d.error)}</div>`;
    return `<div class="eys-docx-wrap">${d.html}</div>`;
  }

  function eysPdfBodyHtml() {
    const p = EYS.pdf;
    if (!p || p.loading) return '<div class="empty">PDF yükleniyor…</div>';
    if (p.error) return `<div class="empty">${esc(p.error)}</div>`;
    return `<div class="eys-pdf-wrap">
      <div class="eys-pdf-meta">
        <span class="muted">${p.pages} sayfa</span>
        <div class="eys-pdf-zoom">
          <button type="button" class="btn ghost" id="eys-pdf-zoom-out" title="Küçült">−</button>
          <span class="muted eys-pdf-zoom-pct">%${Math.round((p.zoom || 1) * 100)}</span>
          <button type="button" class="btn ghost" id="eys-pdf-zoom-in" title="Büyüt">+</button>
        </div>
      </div>
      <div class="eys-pdf-pages" id="eys-pdf-pages"></div>
    </div>`;
  }

  function eysPreviewHtml() {
    const item = EYS.selected;
    if (!item) return '<div class="empty">Önizlemek için bir dosyaya tıklayın</div>';
    const kind = eysPreviewKind(item.name);
    const inlineUrl = `/api/eys/file?inline=1&source=${eysSource}&path=` + encodeURIComponent(item.path);
    const dlUrl = `/api/eys/file?source=${eysSource}&path=` + encodeURIComponent(item.path);
    const head = `<div class="eys-preview-head"><strong title="${esc(item.path)}">${esc(item.name)}</strong><div class="eys-preview-actions"><button type="button" class="btn ghost" id="eys-fs-btn" title="Tam ekran">⛶ Tam ekran</button><a class="btn ghost" href="${dlUrl}" target="_blank" rel="noopener">⬇ İndir</a></div></div>`;
    if (kind === 'pdf') return head + eysPdfBodyHtml();
    if (kind === 'image') return head + `<div class="eys-preview-imgwrap"><img src="${inlineUrl}" alt="${esc(item.name)}"></div>`;
    if (kind === 'xlsx') return head + eysXlsxBodyHtml();
    if (kind === 'docx') return head + eysDocxBodyHtml();
    return head + '<div class="empty">Bu dosya türü tarayıcıda önizlenemiyor — indirip açın</div>';
  }

  function eysDestroyPdf() {
    const doc = EYS.pdf && EYS.pdf.doc;
    EYS.pdf = null;
    if (doc) doc.destroy().catch(() => {});
  }

  function eysSelectFile(item) {
    EYS.selected = item;
    EYS.xlsx = null;
    EYS.docx = null;
    eysDestroyPdf();
    eysPaintResults();
    const kind = item && eysPreviewKind(item.name);
    if (kind === 'xlsx') eysLoadXlsx(item.path, 0);
    else if (kind === 'docx') eysLoadDocx(item.path);
    else if (kind === 'pdf') eysLoadPdf(item.path, `/api/eys/file?inline=1&source=${eysSource}&path=` + encodeURIComponent(item.path));
  }

  async function eysLoadPdf(filePath, url) {
    EYS.pdf = { path: filePath, loading: true, error: null, doc: null, pages: 0, zoom: 1 };
    eysRepaintPreviewOnly();
    let doc;
    try {
      const pdfjsLib = await loadPdfjs();
      doc = await pdfjsLib.getDocument({ url, withCredentials: true }).promise;
    } catch (_) {
      if (EYS.selected?.path !== filePath) return;
      EYS.pdf = { path: filePath, loading: false, error: 'Bu dosya PDF görüntüleyici tarafından okunamadı', doc: null, pages: 0, zoom: 1 };
      eysRepaintPreviewOnly();
      return;
    }
    if (EYS.selected?.path !== filePath) { doc.destroy().catch(() => {}); return; }
    EYS.pdf = { path: filePath, loading: false, error: null, doc, pages: doc.numPages, zoom: 1 };
    eysRepaintPreviewOnly();
    await eysRenderPdfPages(doc, filePath);
  }

  // Yakınlaştırma: her sayfa, alan genişliğine sığdırılmış temel ölçekle
  // çarpılan bir kullanıcı çarpanıyla yeniden çizilir — tam ekranda da (konteyner
  // genişliği değiştiğinde) aynı fonksiyon çağrılır, böylece sayfa büyür.
  function eysZoomPdf(delta) {
    if (!EYS.pdf || !EYS.pdf.doc) return;
    EYS.pdf.zoom = Math.min(3, Math.max(0.4, +((EYS.pdf.zoom + delta).toFixed(2))));
    const pct = document.querySelector('.eys-pdf-zoom-pct');
    if (pct) pct.textContent = `%${Math.round(EYS.pdf.zoom * 100)}`;
    eysRenderPdfPages(EYS.pdf.doc, EYS.pdf.path);
  }

  async function eysRenderPdfPages(doc, filePath) {
    const host = document.getElementById('eys-pdf-pages');
    if (!host) return;
    const renderToken = (eysRenderPdfPages.token = (eysRenderPdfPages.token || 0) + 1);
    host.innerHTML = '';
    const containerWidth = host.clientWidth || 720;
    for (let i = 1; i <= doc.numPages; i++) {
      if (eysRenderPdfPages.token !== renderToken || EYS.selected?.path !== filePath || !EYS.pdf || EYS.pdf.doc !== doc) return;
      let page;
      try { page = await doc.getPage(i); } catch (_) { continue; }
      if (eysRenderPdfPages.token !== renderToken || EYS.selected?.path !== filePath || !EYS.pdf || EYS.pdf.doc !== doc) return;
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = (containerWidth - 4) / baseViewport.width;
      const scale = Math.max(fitScale * (EYS.pdf.zoom || 1), 0.2);
      const viewport = page.getViewport({ scale });
      // Ekran çözünürlüğü (devicePixelRatio) hesaba katılmazsa yüksek DPI'lı
      // tablet/telefon ekranlarında yazı bulanık çıkar: canvas'ın iç piksel
      // sayısı CSS boyutundan (viewport) DPR kat fazla olmalı, render de
      // transform ile aynı oranda ölçeklenmeli — CSS boyutu değişmez.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const canvas = document.createElement('canvas');
      canvas.className = 'eys-pdf-page';
      canvas.width = Math.ceil(viewport.width * dpr);
      canvas.height = Math.ceil(viewport.height * dpr);
      canvas.style.width = Math.ceil(viewport.width) + 'px';
      canvas.style.height = Math.ceil(viewport.height) + 'px';
      host.appendChild(canvas);
      const renderParams = { canvasContext: canvas.getContext('2d'), viewport };
      if (dpr !== 1) renderParams.transform = [dpr, 0, 0, dpr, 0, 0];
      try { await page.render(renderParams).promise; } catch (_) { /* sayfa değişmiş olabilir */ }
    }
  }

  async function eysLoadXlsx(filePath, idx) {
    const keep = EYS.xlsx && EYS.xlsx.path === filePath;
    EYS.xlsx = { path: filePath, sheetMeta: keep ? EYS.xlsx.sheetMeta : [], cache: keep ? EYS.xlsx.cache : {}, idx, loading: true, error: null };
    eysRepaintPreviewOnly();
    try {
      const data = await api(`/api/eys/xlsx?source=${eysSource}&path=${encodeURIComponent(filePath)}&idx=${idx}`);
      if (EYS.selected?.path !== filePath) return;
      EYS.xlsx.sheetMeta = data.sheetMeta || [];
      EYS.xlsx.cache[idx] = data.sheet;
      EYS.xlsx.loading = false;
    } catch (err) {
      if (EYS.selected?.path !== filePath) return;
      EYS.xlsx.loading = false;
      EYS.xlsx.error = err.message;
    }
    eysRepaintPreviewOnly();
  }

  async function eysLoadDocx(filePath) {
    EYS.docx = { path: filePath, html: '', loading: true, error: null };
    eysRepaintPreviewOnly();
    try {
      const data = await api(`/api/eys/docx?source=${eysSource}&path=` + encodeURIComponent(filePath));
      if (EYS.selected?.path !== filePath) return;
      EYS.docx.html = data.html || '';
      EYS.docx.loading = false;
    } catch (err) {
      if (EYS.selected?.path !== filePath) return;
      EYS.docx.loading = false;
      EYS.docx.error = err.message;
    }
    eysRepaintPreviewOnly();
  }

  function bindEysPreviewTabs() {
    document.querySelectorAll('#eys-preview [data-eys-sheet]').forEach(b => b.onclick = () => eysLoadXlsx(EYS.selected.path, Number(b.dataset.eysSheet)));
    const fsBtn = document.getElementById('eys-fs-btn');
    if (fsBtn) fsBtn.onclick = eysToggleFullscreen;
    const zoomIn = document.getElementById('eys-pdf-zoom-in');
    const zoomOut = document.getElementById('eys-pdf-zoom-out');
    if (zoomIn) zoomIn.onclick = () => eysZoomPdf(0.2);
    if (zoomOut) zoomOut.onclick = () => eysZoomPdf(-0.2);
    eysBindPdfPinch();
  }

  // Dokunmatik ekranda iki parmakla yakınlaştırma. Her touchmove'da tam
  // çözünürlükte yeniden çizim yapmak takılır — parmak hareket ederken CSS
  // transform ile anlık (ucuz) önizleme yapılır; parmaklar kalkınca gerçek
  // çözünürlükte tek seferde net biçimde yeniden çizilir. Tek parmakla
  // kaydırma tarayıcının kendi scroll'una bırakılır (touch-action:pan-x
  // pan-y sadece yerleşik pinch-zoom'u devre dışı bırakır, kaydırmayı değil).
  function eysBindPdfPinch() {
    const host = document.getElementById('eys-pdf-pages');
    if (!host || host.dataset.pinchBound) return;
    host.dataset.pinchBound = '1';
    const dist = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    let startDist = 0, startZoom = 1, liveZoom = null;
    host.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        startDist = dist(e.touches[0], e.touches[1]);
        startZoom = (EYS.pdf && EYS.pdf.zoom) || 1;
      }
    }, { passive: true });
    host.addEventListener('touchmove', e => {
      if (e.touches.length === 2 && startDist) {
        e.preventDefault();
        const factor = dist(e.touches[0], e.touches[1]) / startDist;
        liveZoom = Math.min(3, Math.max(0.4, startZoom * factor));
        host.style.transformOrigin = 'top center';
        host.style.transform = `scale(${liveZoom / startZoom})`;
      }
    }, { passive: false });
    const commitPinch = () => {
      if (liveZoom == null) return;
      const zoom = liveZoom;
      liveZoom = null; startDist = 0;
      host.style.transform = '';
      if (EYS.pdf && EYS.pdf.doc) {
        EYS.pdf.zoom = zoom;
        const pct = document.querySelector('.eys-pdf-zoom-pct');
        if (pct) pct.textContent = `%${Math.round(zoom * 100)}`;
        eysRenderPdfPages(EYS.pdf.doc, EYS.pdf.path);
      }
    };
    host.addEventListener('touchend', commitPinch);
    host.addEventListener('touchcancel', commitPinch);
  }

  // Tam ekran: önizleme kartının kendisini (başlık + içerik) tarayıcının
  // yerleşik Fullscreen API'siyle büyütür — vendor önekleri Safari/eski Edge içindir.
  const eysFsEl = () => document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement || null;
  function eysToggleFullscreen() {
    const el = document.getElementById('eys-preview');
    if (!el) return;
    if (eysFsEl()) (document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen).call(document);
    else (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen).call(el);
  }
  function eysSyncFsBtn() {
    const btn = document.getElementById('eys-fs-btn');
    if (btn) {
      const on = eysFsEl() === document.getElementById('eys-preview');
      btn.textContent = on ? '✕ Tam ekrandan çık' : '⛶ Tam ekran';
      btn.title = on ? 'Tam ekrandan çık' : 'Tam ekran';
    }
    // Tam ekrana girip çıkmak önizleme alanının genişliğini değiştirir — PDF
    // sayfaları yeni genişliğe göre yeniden çizilmezse tam ekranda küçük kalır.
    if (EYS.pdf && EYS.pdf.doc) {
      const doc = EYS.pdf.doc, path = EYS.pdf.path;
      setTimeout(() => { if (EYS.pdf && EYS.pdf.doc === doc) eysRenderPdfPages(doc, path); }, 80);
    }
  }
  ['fullscreenchange', 'webkitfullscreenchange', 'MSFullscreenChange'].forEach(evt => document.addEventListener(evt, eysSyncFsBtn));

  function eysRepaintPreviewOnly() {
    const el = document.getElementById('eys-preview');
    if (!el) return;
    el.innerHTML = eysPreviewHtml();
    bindEysPreviewTabs();
  }

  function eysRowsHtml() {
    if (EYS.searching) {
      if (!EYS.items.length) return '<tr><td class="empty">Eşleşen dosya bulunamadı</td></tr>';
      return EYS.items.map(it => `<tr class="eys-row${EYS.selected === it ? ' eys-sel' : ''}" data-eys-file="${esc(it.path)}">
        <td><div>${esc(it.name)}</div><div class="muted eys-path">${esc(it.path.split('/').slice(0, -1).join(' / ') || 'Ana dizin')}</div></td>
      </tr>`).join('');
    }
    if (!EYS.items.length) return '<tr><td class="empty">Bu klasör boş</td></tr>';
    return EYS.items.map(it => it.type === 'dir'
      ? `<tr class="eys-row" data-eys-open="${esc(it.path)}"><td>${FOLDER_SVG}${esc(it.name)}</td></tr>`
      : `<tr class="eys-row${EYS.selected === it ? ' eys-sel' : ''}" data-eys-file="${esc(it.path)}"><td>${esc(it.name)}</td></tr>`
    ).join('');
  }

  // İskelet (arama kutusu dahil) bir kez kurulur; klasör/arama sonuçları yalnızca
  // liste+önizleme panelini günceller — böylece yazarken arama kutusu odağı kaybolmaz.
  function eysPaintShell() {
    $('#app').innerHTML = `
      <div id="eys-wrap">
        <div class="section-title"><div><h2>Entegre Yönetim Sistemi</h2><span class="muted">Kalite/İK doküman arşivi — klasör klasör gezinin</span></div></div>
        <div class="rep-tabs" id="eys-tabs">${EYS_TABS.map(t => `<button class="rtab${t.key === eysSource ? ' on' : ''}" data-eys-source="${t.key}">${esc(t.label)}</button>`).join('')}</div>
        <div class="eys-toolbar">
          <div class="eys-crumbs" id="eys-crumbs"></div>
          <input class="input eys-search" id="eys-search" type="search" placeholder="Dosya ara…">
        </div>
        <div class="eys-split">
          <div class="eys-list-pane"><div class="card" style="padding:0"><div style="overflow:auto;max-height:75vh"><table><tbody id="eys-tbody"><tr><td class="empty">Yükleniyor…</td></tr></tbody></table></div></div></div>
          <div class="eys-preview-pane"><div class="card eys-preview-card" id="eys-preview">${eysPreviewHtml()}</div></div>
        </div>
      </div>`;
    document.getElementById('eys-search').oninput = e => eysOnSearchInput(e.target.value);
    document.querySelectorAll('#eys-tabs [data-eys-source]').forEach(b => b.onclick = () => {
      if (b.dataset.eysSource === eysSource) return;
      eysSetSource(b.dataset.eysSource);
      EYS.selected = null; EYS.xlsx = null; EYS.docx = null; eysDestroyPdf(); EYS.searching = false; EYS.searchTerm = '';
      document.querySelectorAll('#eys-tabs [data-eys-source]').forEach(x => x.classList.toggle('on', x.dataset.eysSource === eysSource));
      loadEysFolder();
    });
  }

  function eysPaintResults() {
    if (state.view !== EYS_VIEW || !document.querySelector('#eys-wrap')) return;
    const parts = eysPath ? eysPath.split('/') : [];
    const crumbs = [`<button class="btn ghost eys-crumb" data-eys-go="">Ana dizin</button>`]
      .concat(parts.map((p, i) => `<span class="muted">/</span><button class="btn ghost eys-crumb" data-eys-go="${esc(parts.slice(0, i + 1).join('/'))}">${esc(p)}</button>`))
      .join('');
    document.getElementById('eys-crumbs').innerHTML = EYS.searching ? '' : crumbs;
    document.getElementById('eys-tbody').innerHTML = eysRowsHtml();
    document.getElementById('eys-preview').innerHTML = eysPreviewHtml();
    bindEysPreviewTabs();
    const searchEl = document.getElementById('eys-search');
    if (searchEl && searchEl.value !== EYS.searchTerm) searchEl.value = EYS.searchTerm;
    document.querySelectorAll('[data-eys-open]').forEach(tr => tr.onclick = () => { eysSetPath(tr.dataset.eysOpen); EYS.selected = null; EYS.xlsx = null; EYS.docx = null; eysDestroyPdf(); loadEysFolder(); });
    document.querySelectorAll('[data-eys-go]').forEach(b => b.onclick = () => { eysSetPath(b.dataset.eysGo); EYS.searching = false; EYS.searchTerm = ''; EYS.selected = null; EYS.xlsx = null; EYS.docx = null; eysDestroyPdf(); loadEysFolder(); });
    document.querySelectorAll('[data-eys-file]').forEach(tr => tr.onclick = () => {
      eysSelectFile(EYS.items.find(it => it.path === tr.dataset.eysFile) || null);
    });
  }

  let eysSearchTimer = null;
  function eysOnSearchInput(value) {
    EYS.searchTerm = value;
    clearTimeout(eysSearchTimer);
    if (value.trim().length < 2) { EYS.searching = false; EYS.items = eysFolderCache || []; eysPaintResults(); return; }
    eysSearchTimer = setTimeout(() => loadEysSearch(value.trim()), 350);
  }

  let eysFolderCache = [];
  async function loadEysFolder() {
    if (state.view !== EYS_VIEW) return;
    let data;
    try { data = await api(`/api/eys/list?source=${eysSource}&path=` + encodeURIComponent(eysPath)); }
    catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== EYS_VIEW) return;
    EYS.searching = false; EYS.searchTerm = '';
    eysFolderCache = data.items;
    EYS.items = data.items;
    eysPaintResults();
  }

  async function loadEysSearch(term) {
    if (state.view !== EYS_VIEW) return;
    let data;
    try { data = await api(`/api/eys/search?source=${eysSource}&q=` + encodeURIComponent(term)); }
    catch (err) { toast(err.message); return; }
    if (state.view !== EYS_VIEW || EYS.searchTerm.trim() !== term) return;
    EYS.searching = true;
    EYS.items = data.items;
    eysPaintResults();
  }

  async function renderEys() {
    if (state.view !== EYS_VIEW) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    syncNavGroup();
    $('#page-title').textContent = 'Entegre Yönetim Sistemi';
    if (!window.__ikCan('kys-eys')) { $('#app').innerHTML = '<div class="card empty">Bu modüle erişim yetkiniz yok.</div>'; return; }
    if (document.querySelector('#eys-wrap')) { eysPaintResults(); return; }
    eysPaintShell();
    await loadEysFolder();
  }

  // --- DÖF Takip: Kalite bir departmana DÖF açar, departman aksiyon yazıp
  // kapatma talep eder, Kalite onaylar/reddeder. -------------------------
  const DOF_VIEW = 'kys-dof';
  const DOF = { items: [], deptFilter: '', tab: 'open' };
  const dofNormDept = v => String(v || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
  const dofFmtDate = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? esc(v) : d.toLocaleDateString('tr-TR'); };
  const dofBadgeClass = status => status === 'Kapatıldı' ? 'green' : status === 'Revizyonda' ? 'red' : 'orange';

  function dofDeptOptions() {
    const raw = [...new Set((state.employees || []).map(e => e.department).filter(Boolean))];
    const seen = new Map();
    raw.forEach(d => { const n = dofNormDept(d); if (!seen.has(n)) seen.set(n, d); });
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'tr'));
  }
  const dofDeptSelectHtml = (id, selected) =>
    `<select class="select" id="${id}">${dofDeptOptions().map(([norm, label]) => `<option value="${esc(norm)}" ${norm === selected ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`;

  async function loadDof() {
    if (state.view !== DOF_VIEW) return;
    if (!document.querySelector('#dof-wrap')) $('#app').innerHTML = '<div class="card empty">Yükleniyor…</div>';
    let rows;
    try { rows = await api('/api/dof'); }
    catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== DOF_VIEW) return;
    DOF.items = rows;
    renderDof();
  }

  function dofRowActions(r, access) {
    const btns = [];
    if (r.archived && r.sourcePath) btns.push(`<button class="btn ghost" data-dof-source="${esc(r.sourcePath)}">Kaynak dosya</button>`);
    if (access.level === 'kalite') {
      if (r.status === 'Kapatma Bekliyor') {
        btns.push(`<button class="btn ghost" data-dof-approve="${r.id}">Onayla</button>`);
        btns.push(`<button class="btn ghost danger-text" data-dof-reject="${r.id}">Reddet</button>`);
      } else {
        btns.push(`<button class="btn ghost" data-dof-edit="${r.id}">Düzenle</button>`);
        if (r.status !== 'Kapatıldı') btns.push(`<button class="btn ghost danger-text" data-dof-del="${r.id}">İptal Et</button>`);
      }
    } else if (access.level === 'dept') {
      if (['Açık', 'Revizyonda'].includes(r.status)) btns.push(`<button class="btn ghost" data-dof-act="${r.id}">Aksiyon Yaz &amp; Kapatma Talep Et</button>`);
      else if (r.status === 'Kapatma Bekliyor') btns.push('<span class="muted" style="font-size:11.5px">Onay bekliyor</span>');
    }
    return btns.join('');
  }

  function dofRowsHtml(items, access) {
    const cols = access.level === 'dept' ? 5 : 6;
    if (!items.length) return `<tr><td colspan="${cols}" class="empty">Kayıt yok</td></tr>`;
    return items.map(r => `<tr>
      <td>${esc(r.title)}</td>
      ${access.level !== 'dept' ? `<td>${esc(r.department)}</td>` : ''}
      <td>${dofFmtDate(r.dueDate)}</td>
      <td><span class="badge ${dofBadgeClass(r.status)}">${esc(r.status)}</span></td>
      <td>${dofFmtDate(r.created_at)}</td>
      <td class="row-actions">${dofRowActions(r, access)}</td>
    </tr>`).join('');
  }

  // FR/QM/004 Düzeltici Önleyici Faaliyet Formu ile hizalı alanlar.
  const DOF_ACTIVITY_TYPES = ['Düzeltici', 'Önleyici', 'Geliştirici'];
  function dofOpenFieldsHtml(r) {
    return `
      <div class="field"><label>Hedef departman *</label>${dofDeptSelectHtml('dof-f-dept', r?.department || '')}</div>
      <div class="field"><label>Termin (DF Planlama Tarihi)</label><input class="input" id="dof-f-due" type="date" value="${esc(r?.dueDate || '')}"></div>
      <div class="field" style="grid-column:1/-1"><label>Konu *</label><input class="input" id="dof-f-title" value="${esc(r?.title || '')}"></div>
      <div class="field"><label>Faaliyet türü</label><select class="select" id="dof-f-type">${DOF_ACTIVITY_TYPES.map(t => `<option ${t === (r?.activityType || 'Düzeltici') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label>Uygunsuzluk kaynağı</label><input class="input" id="dof-f-source" placeholder="ör. İç Denetim, Misafir Şikayeti…" value="${esc(r?.nonconformitySource || '')}"></div>
      <div class="field" style="grid-column:1/-1"><label>Faaliyet talebinde bulunan</label><input class="input" id="dof-f-reqby" value="${esc(r?.requestedBy || '')}"></div>
      <div class="field" style="grid-column:1/-1"><label>Tespit edilen uygunsuzluk</label><textarea class="input" id="dof-f-desc" rows="4" style="width:100%">${esc(r?.description || '')}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Uygunsuzluğun kök nedeni</label><textarea class="input" id="dof-f-root" rows="3" style="width:100%">${esc(r?.rootCause || '')}</textarea></div>`;
  }
  function dofReadOpenFields() {
    return {
      department: document.getElementById('dof-f-dept').value,
      title: document.getElementById('dof-f-title').value.trim(),
      activityType: document.getElementById('dof-f-type').value,
      nonconformitySource: document.getElementById('dof-f-source').value.trim(),
      requestedBy: document.getElementById('dof-f-reqby').value.trim(),
      description: document.getElementById('dof-f-desc').value.trim(),
      rootCause: document.getElementById('dof-f-root').value.trim(),
      dueDate: document.getElementById('dof-f-due').value
    };
  }

  function dofOpenCreateModal() {
    const body = `<div class="form-grid">${dofOpenFieldsHtml(null)}</div>`;
    modal('Yeni DÖF Aç', body, async () => {
      const payload = dofReadOpenFields();
      if (!payload.title) return toast('Konu zorunludur');
      try {
        await api('/api/dof', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeModal(); toast('DÖF açıldı'); loadDof();
      } catch (err) { toast(err.message); }
    });
  }

  function dofOpenEditModal(r) {
    if (!r) return;
    const body = `<div class="form-grid">${dofOpenFieldsHtml(r)}</div>`;
    modal('DÖF — düzenle', body, async () => {
      const payload = dofReadOpenFields();
      if (!payload.title) return toast('Konu zorunludur');
      try {
        await api(`/api/dof/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeModal(); toast('Güncellendi'); loadDof();
      } catch (err) { toast(err.message); }
    });
  }

  function dofOpenActionModal(r) {
    if (!r) return;
    const body = `<div class="form-grid">
      <div class="field" style="grid-column:1/-1"><label>Konu</label><div class="muted">${esc(r.title)}</div></div>
      <div class="field" style="grid-column:1/-1"><label>Tespit edilen uygunsuzluk</label><div class="muted">${esc(r.description || '—')}</div></div>
      ${r.rootCause ? `<div class="field" style="grid-column:1/-1"><label>Kök neden</label><div class="muted">${esc(r.rootCause)}</div></div>` : ''}
      <div class="field"><label>Düzeltme faaliyeti sorumlusu</label><input class="input" id="dof-f-actowner" value="${esc(r.actionOwner || '')}"></div>
      <div class="field"><label>DF Tamamlanma tarihi</label><input class="input" id="dof-f-compdate" type="date" value="${esc(r.completedDate || '')}"></div>
      <div class="field" style="grid-column:1/-1"><label>Düzeltme faaliyeti (planlanan) *</label><textarea class="input" id="dof-f-action" rows="4" style="width:100%">${esc(r.action || '')}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Gerçekleşen faaliyetler</label><textarea class="input" id="dof-f-completed" rows="4" style="width:100%">${esc(r.completedActivities || '')}</textarea></div>
    </div>`;
    modal('Aksiyon yaz ve kapatma talep et', body, async () => {
      const action = document.getElementById('dof-f-action').value.trim();
      const actionOwner = document.getElementById('dof-f-actowner').value.trim();
      const completedActivities = document.getElementById('dof-f-completed').value.trim();
      const completedDate = document.getElementById('dof-f-compdate').value;
      if (!action) return toast('Aksiyon açıklaması zorunludur');
      try {
        await api(`/api/dof/${r.id}/submit-closure`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, actionOwner, completedActivities, completedDate }) });
        closeModal(); toast('Kapatma talebi gönderildi'); loadDof();
      } catch (err) { toast(err.message); }
    });
  }

  async function dofApprove(id) {
    try { await api(`/api/dof/${id}/approve-closure`, { method: 'POST' }); toast('DÖF kapatıldı'); loadDof(); }
    catch (err) { toast(err.message); }
  }
  async function dofReject(id) {
    const note = prompt('Red gerekçesi (isteğe bağlı):');
    if (note === null) return;
    try {
      await api(`/api/dof/${id}/reject-closure`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
      toast('Revizyon istendi'); loadDof();
    } catch (err) { toast(err.message); }
  }
  async function dofDelete(id) {
    if (!confirm('Bu DÖF kaydını iptal etmek istediğinize emin misiniz?')) return;
    try { await api(`/api/dof/${id}`, { method: 'DELETE' }); toast('DÖF iptal edildi'); loadDof(); }
    catch (err) { toast(err.message); }
  }

  function renderDof() {
    if (state.view !== DOF_VIEW) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    syncNavGroup();
    $('#page-title').textContent = 'DÖF Takip';
    const access = window.__ikDofAccess ? window.__ikDofAccess() : { level: 'none' };
    if (access.level === 'none') { $('#app').innerHTML = '<div class="card empty">Bu modüle erişim yetkiniz yok.</div>'; return; }

    let html;
    if (access.level === 'dept') {
      const open = DOF.items.filter(r => r.status !== 'Kapatıldı');
      const closed = DOF.items.filter(r => r.status === 'Kapatıldı');
      const tabsHtml = `<div class="rep-tabs" id="dof-tabs">
        <button class="rtab${DOF.tab === 'open' ? ' on' : ''}" data-dof-tab="open">Açık DÖF'lerim <span class="rtab-badge">${open.length}</span></button>
        <button class="rtab${DOF.tab === 'closed' ? ' on' : ''}" data-dof-tab="closed">Kapatılmış DÖF'lerim <span class="rtab-badge">${closed.length}</span></button>
      </div>`;
      const shown = DOF.tab === 'open' ? open : closed;
      html = `
        <div class="section-title"><div><h2>DÖF Takip</h2><span class="muted">Departmanınıza açılan düzeltici/önleyici faaliyetler</span></div></div>
        ${tabsHtml}
        <div class="card"><div style="overflow:auto"><table><thead><tr><th>Konu</th><th>Termin</th><th>Durum</th><th>Açılış</th><th></th></tr></thead>
        <tbody>${dofRowsHtml(shown, access)}</tbody></table></div></div>`;
    } else {
      const filtered = DOF.deptFilter ? DOF.items.filter(r => r.department === DOF.deptFilter) : DOF.items;
      html = `
        <div class="section-title"><div><h2>DÖF Takip</h2><span class="muted">Tüm departmanlara açılan düzeltici/önleyici faaliyetler</span></div>${access.level === 'kalite' ? '<button class="btn" id="dof-add">+ Yeni DÖF Aç</button>' : ''}</div>
        <div class="toolbar"><select class="select" id="dof-dept-filter"><option value="">Tüm departmanlar</option>${dofDeptOptions().map(([norm, label]) => `<option value="${esc(norm)}" ${norm === DOF.deptFilter ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div>
        <div class="card"><div style="overflow:auto"><table><thead><tr><th>Konu</th><th>Departman</th><th>Termin</th><th>Durum</th><th>Açılış</th><th></th></tr></thead>
        <tbody>${dofRowsHtml(filtered, access)}</tbody></table></div></div>`;
    }
    $('#app').innerHTML = `<div id="dof-wrap">${html}</div>`;

    document.getElementById('dof-add')?.addEventListener('click', () => dofOpenCreateModal());
    document.getElementById('dof-dept-filter')?.addEventListener('change', e => { DOF.deptFilter = e.target.value; renderDof(); });
    document.querySelectorAll('#dof-tabs [data-dof-tab]').forEach(b => b.onclick = () => { DOF.tab = b.dataset.dofTab; renderDof(); });
    document.querySelectorAll('[data-dof-act]').forEach(b => b.onclick = () => dofOpenActionModal(DOF.items.find(r => String(r.id) === b.dataset.dofAct)));
    document.querySelectorAll('[data-dof-edit]').forEach(b => b.onclick = () => dofOpenEditModal(DOF.items.find(r => String(r.id) === b.dataset.dofEdit)));
    document.querySelectorAll('[data-dof-approve]').forEach(b => b.onclick = () => dofApprove(b.dataset.dofApprove));
    document.querySelectorAll('[data-dof-reject]').forEach(b => b.onclick = () => dofReject(b.dataset.dofReject));
    document.querySelectorAll('[data-dof-del]').forEach(b => b.onclick = () => dofDelete(b.dataset.dofDel));
    document.querySelectorAll('[data-dof-source]').forEach(b => b.onclick = () => {
      eysSetSource('kayitlar');
      eysSetPath(b.dataset.dofSource.split('/').slice(0, -1).join('/'));
      window.__ikNavigate('kys-eys');
    });
  }

  function syncNavGroup() {
    const group = document.getElementById('kys-nav-group');
    if (!group) return;
    const active = String(state.view || '').startsWith('kys-');
    const toggle = group.querySelector('.nav-group-toggle');
    if (toggle) toggle.classList.toggle('active', active);
    if (active) group.classList.add('open');
  }

  window.__ikToggleKysMenu = function (event) {
    // Yalnızca alt menüyü aç/kapat — başka hiçbir şey yapma (gezinme yok).
    event?.preventDefault();event?.stopPropagation();
    document.getElementById('kys-nav-group')?.classList.toggle('open');
  };

  const baseShell = shell;
  shell = function () {
    const key = VIEW_TO_KEY[state.view];
    if (state.view === EYS_VIEW) renderEys();
    else if (state.view === DOF_VIEW) loadDof();
    else if (key) render(key);
    else { baseShell(); syncNavGroup(); }
  };
})();
