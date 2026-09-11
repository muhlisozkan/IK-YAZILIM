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
        { key: 'responsible', label: 'Sorumlu' },
        { key: 'status', label: 'Durum', type: 'select', options: ['Geçerli', 'Süresi Yaklaşıyor', 'Süresi Geçti'], default: 'Geçerli' }
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
      if (key === 'sikayet' && data.status === 'Kapatıldı' && (!data.rootCause || !data.action)) {
        return toast('Kapatmadan önce kök neden ve aksiyon alanlarını doldurun');
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

  function dokumanActionsHtml(r, canWrite, canApprove) {
    if (r.status === 'Onay Bekliyor') {
      if (canApprove) return `<button class="btn ghost" data-kys-approve="${r.id}">Onayla</button><button class="btn ghost danger-text" data-kys-reject="${r.id}">Reddet</button>`;
      return '<span class="muted" style="font-size:11.5px">Onay bekliyor</span>';
    }
    const btns = [];
    if (canWrite) btns.push(`<button class="btn ghost" data-kys-edit="${r.id}">Düzenle</button>`);
    if (canWrite && ['Taslak', 'Revizyonda'].includes(r.status)) btns.push(`<button class="btn ghost" data-kys-submit="${r.id}">Onaya Gönder</button>`);
    if (canWrite && r.status !== 'İptal') btns.push(`<button class="btn ghost danger-text" data-kys-retire="${r.id}">İptal Et</button>`);
    if (canWrite) btns.push(`<button class="btn ghost danger-text" data-kys-del="${r.id}">Sil</button>`);
    return btns.join('');
  }

  async function render(key) {
    if (state.view !== MOD[key].view) return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    syncNavGroup();
    const cfg = MOD[key];
    $('#page-title').textContent = cfg.title;
    if (!canSeeKys()) { $('#app').innerHTML = '<div class="card empty">Bu modüle erişim yetkiniz yok.</div>'; return; }
    const canWrite = canWriteKys();
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
    }).join('')}<td class="row-actions">${cfg.workflow ? dokumanActionsHtml(r, canWrite, canApprove) : (canWrite ? `<button class="btn ghost" data-kys-edit="${r.id}">Düzenle</button><button class="btn ghost danger-text" data-kys-del="${r.id}">Sil</button>` : '')}</td></tr>`).join('');
    $('#app').innerHTML = `
      <div id="kys-wrap">
        <div class="section-title"><div><h2>${esc(cfg.title)}</h2><span class="muted">${esc(cfg.desc)}</span></div>${canWrite ? '<button class="btn" id="kys-add">+ Yeni kayıt</button>' : ''}</div>
        <div class="card"><div style="overflow:auto"><table><thead><tr>${cfg.columns.map(([, l]) => `<th>${esc(l)}</th>`).join('')}<th></th></tr></thead>
        <tbody>${trs || `<tr><td colspan="${cfg.columns.length + 1}" class="empty">Henüz kayıt yok</td></tr>`}</tbody></table></div></div>
      </div>`;
    document.getElementById('kys-add')?.addEventListener('click', () => openForm(key, null));
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

  function syncNavGroup() {
    const group = document.getElementById('kys-nav-group');
    if (!group) return;
    const active = String(state.view || '').startsWith('kys-');
    const toggle = group.querySelector('.nav-group-toggle');
    if (toggle) toggle.classList.toggle('active', active);
    if (active) group.classList.add('open');
  }

  window.__ikToggleKysMenu = function () {
    document.getElementById('kys-nav-group')?.classList.toggle('open');
  };

  const baseShell = shell;
  shell = function () {
    const key = VIEW_TO_KEY[state.view];
    if (key) render(key);
    else { baseShell(); syncNavGroup(); }
  };
})();
