// Personel Bütçesi: "Bütçe YYYY" sayfalarından departman bazlı kadro bütçesi.
// - Excel'de olan yıllar (2025/2026): Güncel Tablo'ya yüklenen dosyadan, salt-okunur.
// - Gelecek yıllar (ör. 2027): departman kendi bütçesini uygulamadan girer.
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parseNum = v => {
    if (v == null || String(v).trim() === '') return null;
    const n = Number(String(v).replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
  };
  const fmt = n => (n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ','));
  async function api(path, opt) {
    const r = await fetch(path, opt);
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'İşlem tamamlanamadı');
    return d;
  }
  const S = { year: sessionStorage.getItem('ik_pb_year') || '', dept: sessionStorage.getItem('ik_pb_dept') || '', tab: 'tablo', data: null, cmp: null, seedTried: '' };
  const saveTimers = {};

  function canView() {
    const u = window.__ikCurrentUser?.() || {};
    const all = ['Sistem yöneticisi', 'İK yöneticisi', 'Genel müdür', 'Genel müdür yardımcısı', 'Bölge yöneticisi', 'Mali İşler', 'Finans yöneticisi'].includes(u.role)
      || String(u.department || '').toLocaleUpperCase('tr-TR').trim() === 'İNSAN KAYNAKLARI';
    return all || u.role === 'Departman yöneticisi';
  }

  function fetchData() {
    const q = new URLSearchParams();
    if (S.year) q.set('year', S.year);
    if (S.dept) q.set('department', S.dept);
    return api('/api/personel-butcesi?' + q.toString());
  }

  async function render() {
    if (state.view !== 'personel-butcesi') return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'personel-butcesi'));
    $('#page-title').textContent = 'Personel Bütçesi';
    if (!canView()) { $('#app').innerHTML = '<div class="card empty">Personel bütçesi görüntüleme yetkiniz yok.</div>'; return; }
    if (S.tab === 'karsilastirma') return renderCompare();
    if (!document.querySelector('#pb-wrap')) $('#app').innerHTML = '<div class="section-title"><div><h2>Personel Bütçesi</h2></div></div><div class="card empty">Yükleniyor…</div>';
    try {
      S.data = await fetchData();
      // Yeni yıl + bu departmanda henüz giriş yok → önceki yılın listesini otomatik kopyala
      if (S.data.draftSource && S.data.canEdit && S.data.department) {
        const key = S.data.year + ':' + S.data.department;
        if (S.seedTried !== key) {
          S.seedTried = key;
          try {
            const r = await api('/api/personel-butcesi/' + S.data.year + '/entries/seed', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ department: S.data.department })
            });
            toast(`${r.from || S.data.draftSource} pozisyon listesi geldi (${r.count} pozisyon) — aylık sayıları girin`);
            S.data = await fetchData();
          } catch (_) { /* 409 vb. — mevcut taslakları göster */ }
        }
      }
    } catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== 'personel-butcesi') return;
    S.year = S.data.year;
    sessionStorage.setItem('ik_pb_year', S.year);
    if (S.data.scope === 'all') sessionStorage.setItem('ik_pb_dept', S.dept || '');
    paint();
  }

  function pbHeader(d, subtitle, extra) {
    const tabBtn = (k, l) => `<button type="button" class="rtab${S.tab === k ? ' on' : ''}" data-pb-tab="${k}">${l}</button>`;
    const yearBtns = (d.years || []).map(y =>
      `<button class="btn ${y === d.year ? '' : 'secondary'}" data-pb-year="${y}">${y}${/^(2025|2026)$/.test(y) ? '' : ' ✎'}</button>`).join('');
    const deptControl = (d.scope === 'all')
      ? `<select class="select" id="pb-dept"><option value="">Tüm departmanlar</option>${(d.departments || []).map(x => `<option value="${esc(x)}" ${x === d.department ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`
      : `<span class="badge blue">${esc(d.department || '—')}</span>`;
    return `
      <div class="rep-tabs" style="margin-bottom:14px">
        ${tabBtn('tablo', 'Bütçe Tablosu')}
        ${tabBtn('karsilastirma', 'Geçen Yılla Karşılaştırma')}
      </div>
      <div class="section-title">
        <div><h2>Personel Bütçesi</h2><span class="muted">${esc(subtitle)}</span></div>
        <div class="pb-controls">
          <div class="leave-tabs">${yearBtns}</div>
          ${deptControl}
          ${extra || ''}
        </div>
      </div>`;
  }
  function bindHeader() {
    document.querySelectorAll('[data-pb-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.pbTab; render(); });
    document.querySelectorAll('[data-pb-year]').forEach(b => b.onclick = () => { S.year = b.dataset.pbYear; render(); });
    const ds = document.querySelector('#pb-dept');
    if (ds) ds.onchange = () => { S.dept = ds.value; render(); };
  }

  function paint() {
    const d = S.data;
    const bEdit = !!(d.editable && d.canEdit && d.department);
    const subtitle = `${d.year} — her ay: ${d.prevYear} bütçe · ${d.year} bütçe · ${d.year} gerçekleşen (İK girer)${d.scope === 'all' ? '' : ' · ' + (d.department || 'departmanınız')}`;

    $('#app').innerHTML = `
      ${pbHeader(d, subtitle, bEdit ? '<button class="btn" id="pb-add">+ Pozisyon ekle</button>' : '')}
      ${d.editable && d.canEdit && !d.department ? '<div class="card" style="padding:12px 16px;margin-bottom:12px;color:var(--muted)">Bütçe girişi için önce bir departman seçin.</div>' : ''}
      ${bEdit && d.draftSource ? `<div class="card pb-draftbar"><span>Pozisyon listesi <strong>${esc(d.draftSource)}</strong> yılından geldi — aylık sayılar <strong>boş</strong>, departman girer. Liste <strong>henüz kaydedilmedi</strong>.</span><button class="btn" id="pb-seed">Pozisyon listesini ${esc(d.year)}'ye ekle</button></div>` : ''}
      ${d.canEditActual ? '<div class="muted" style="font-size:12px;margin:0 2px 8px">Yeşil <strong>Grç</strong> hücrelerine o ayın gerçekleşen kişi sayısını girin — otomatik kaydedilir.</div>' : ''}
      <div id="pb-wrap">${tableHtml(d)}</div>`;

    bindHeader();
    const add = document.querySelector('#pb-add');
    if (add) add.onclick = addRow;
    const seed = document.querySelector('#pb-seed');
    if (seed) seed.onclick = async () => {
      seed.disabled = true;
      try {
        const r = await api('/api/personel-butcesi/' + d.year + '/entries/seed', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ department: d.department })
        });
        toast(`${r.count} satır ${d.year}'ye kopyalandı`);
        render();
      } catch (err) { seed.disabled = false; toast(err.message); }
    };
    if (d.canEdit || d.canEditActual) bindTableRows(d);
  }

  // list = [{budget:[12], actual:[12]|null}]
  function computeSub(list) {
    const bud = Array(12).fill(0), act = Array(12).fill(0);
    let hasAct = false;
    list.forEach(x => {
      (x.budget || []).forEach((v, i) => { if (v) bud[i] += v; });
      if (x.actual) x.actual.forEach((v, i) => { if (v != null) { act[i] += v; hasAct = true; } });
    });
    const budT = bud.reduce((a, v) => a + v, 0);
    return { bud, act, hasAct, budT, budO: budT / 12 };
  }

  function tableHtml(d) {
    const rows = d.rows || [];
    const positions = rows.filter(r => r.kind === 'position');
    const bEdit = !!(d.editable && d.canEdit && d.department);   // bütçe hücreleri düzenlenebilir
    const aEdit = !!d.canEditActual;                             // gerçekleşen hücreleri düzenlenebilir
    if (!positions.length && !bEdit) return '<div class="card"><div class="empty">Bu seçim için satır bulunamadı.</div></div>';
    const showDept = !d.department;
    const py = String(d.prevYear || '').slice(2);
    const mtop = d.months.map((m, i) => `<th colspan="3" class="pb-mtop${i === (d.monthIdx ?? -1) ? ' now' : ''}">${esc(m.slice(0, 3).toLocaleUpperCase('tr-TR'))}</th>`).join('');
    const triple = `<th class="pb-sc-p" title="${esc(d.prevYear)}">${esc(py)}</th><th class="pb-sc-b" title="${esc(d.year)} bütçe">Büt</th><th class="pb-sc-a" title="${esc(d.year)} gerçekleşen">Grç</th>`;
    const msub = d.months.map(() => triple).join('');
    const head = `<thead>
      <tr>${showDept ? '<th rowspan="2">DEP.</th>' : ''}<th rowspan="2" class="pb-pos">POZİSYON</th>${mtop}<th colspan="3" class="pb-mtop">TOPLAM</th><th colspan="3" class="pb-mtop">ORT.</th>${bEdit ? '<th rowspan="2"></th>' : ''}</tr>
      <tr>${msub}${triple}${triple}</tr>
    </thead>`;

    let body;
    if (bEdit) {
      body = positions.map(r => posRowHtml(r, d, true, aEdit, showDept)).join('');
      body += subRowHtml(d, showDept, true);
    } else {
      body = rows.map(r => r.kind === 'position'
        ? posRowHtml(r, d, false, aEdit, showDept)
        : nonPosRowHtml(r, d, showDept)).join('');
    }
    return `<div class="card pb-card"><div class="pb-scroll"><table class="pb-table pb-3col${bEdit || aEdit ? ' pb-edit' : ''}">${head}<tbody>${body}</tbody></table></div></div>`;
  }

  function cellsHtml(r, d, bEdit, aEdit) {
    return d.months.map((m, i) => {
      const pv = (r.prevValues || [])[i] || '';
      const bvNum = (r.valuesNum || [])[i];
      const bvTxt = (r.values || [])[i] || (bvNum == null ? '' : fmt(bvNum));
      const avNum = (r.actualValuesNum || [])[i];
      const avTxt = avNum == null ? '' : fmt(avNum);
      return `<td class="num pb-gy pb-mp" data-mp="${i}">${esc(pv)}</td>`
        + (bEdit
          ? `<td class="num pb-bd"><input class="pb-in pb-m" inputmode="decimal" data-m="${i}" value="${bvNum == null ? '' : fmt(bvNum)}"></td>`
          : `<td class="num pb-bd">${esc(bvTxt)}</td>`)
        + (aEdit
          ? `<td class="num pb-gcell"><input class="pb-in pb-a" inputmode="decimal" data-m="${i}" value="${avTxt}"></td>`
          : `<td class="num pb-ac">${esc(avTxt)}</td>`);
    }).join('');
  }

  function posRowHtml(r, d, bEdit, aEdit, showDept) {
    const bt = r.toplamNum != null ? r.toplamNum : (r.valuesNum || []).reduce((a, v) => a + (v || 0), 0);
    const budT = esc(r.toplam || fmt(bt || null)), budO = esc(r.ortalama || fmt(bt ? bt / 12 : null));
    return `<tr class="pb-row" data-id="${r.id == null ? '' : r.id}" data-dept="${esc(r.dept || d.department || '')}" data-poz="${esc(r.pozisyon || r.label || '')}">
      ${showDept ? `<td>${esc(r.dept || '')}</td>` : ''}
      <td class="pb-pos">${bEdit ? `<input class="pb-in pb-pos-in" data-k="pozisyon" value="${esc(r.pozisyon || '')}" placeholder="Pozisyon adı">` : esc(r.pozisyon || r.label || '')}</td>
      ${cellsHtml(r, d, bEdit, aEdit)}
      <td class="num pb-gy pb-tp">${esc(r.prevToplam || '')}</td><td class="num pb-tb">${budT}</td><td class="num pb-gcell pb-ta">${esc(r.actualToplam || '')}</td>
      <td class="num pb-gy pb-op">${esc(r.prevOrt || '')}</td><td class="num pb-ob">${budO}</td><td class="num pb-gcell pb-oa">${esc(r.actualOrt || '')}</td>
      ${bEdit ? '<td><button class="btn ghost danger-text pb-del" title="Sil">×</button></td>' : ''}
    </tr>`;
  }

  function nonPosRowHtml(r, d, showDept) {
    const cls = r.kind === 'grand' ? 'pb-grand' : 'pb-sub';
    const mc = (r.values || Array(12).fill('')).map((v, i) => `<td class="pb-gy num pb-mp">${esc((r.prevValues || [])[i] || '')}</td><td class="num pb-bd">${esc(v || '')}</td><td class="num pb-ac">${esc((r.actualValues || [])[i] || '')}</td>`).join('');
    return `<tr class="${cls}">
      ${showDept ? '<td></td>' : ''}
      <td class="pb-pos">${esc(r.label || '')}</td>
      ${mc}
      <td class="num pb-gy pb-tp">${esc(r.prevToplam || '')}</td><td class="num pb-bd pb-tb">${esc(r.toplam || '')}</td><td class="num pb-ac pb-ta">${esc(r.actualToplam || '')}</td>
      <td class="num pb-gy pb-op">${esc(r.prevOrt || '')}</td><td class="num pb-bd pb-ob">${esc(r.ortalama || '')}</td><td class="num pb-ac pb-oa">${esc(r.actualOrt || '')}</td>
    </tr>`;
  }

  function subRowHtml(d, showDept) {
    const cells = d.months.map((_, i) => `<td class="pb-gy num pb-mp" data-sp="${i}"></td><td class="num pb-bd" data-sb="${i}"></td><td class="num pb-ac" data-sa="${i}"></td>`).join('');
    return `<tr class="pb-sub" id="pb-subrow">
      ${showDept ? '<td></td>' : ''}
      <td class="pb-pos">${esc(d.department || '')} — Toplam</td>
      ${cells}
      <td class="num pb-gy pb-tp" id="pb-subTp"></td><td class="num pb-bd pb-tb" id="pb-subTb"></td><td class="num pb-ac pb-ta" id="pb-subTa"></td>
      <td class="num pb-gy pb-op" id="pb-subOp"></td><td class="num pb-bd pb-ob" id="pb-subOb"></td><td class="num pb-ac pb-oa" id="pb-subOa"></td>
      <td></td>
    </tr>`;
  }

  function bindTableRows(d) {
    document.querySelectorAll('#pb-wrap tr.pb-row').forEach(row => bindRow(row, d));
    recalcAll(d);
  }
  function bindRow(row, d) {
    row.querySelectorAll('.pb-in').forEach(inp => {
      inp.addEventListener('input', () => { recalcRow(row); recalcSub(d); scheduleSave(row, inp); });
      inp.addEventListener('blur', () => flushSave(row));
    });
    const del = row.querySelector('.pb-del');
    if (del) del.onclick = () => removeRow(row, d);
  }
  const rowBudget = row => [...row.querySelectorAll('.pb-m')].map(i => parseNum(i.value));
  const rowActual = row => [...row.querySelectorAll('.pb-a')].map(i => parseNum(i.value));
  function recalcRow(row) {
    const b = rowBudget(row);
    if (b.length) {
      const t = b.reduce((a, v) => a + (v || 0), 0);
      const tb = row.querySelector('.pb-tb'), ob = row.querySelector('.pb-ob');
      if (tb) tb.textContent = fmt(t || null);
      if (ob) ob.textContent = fmt(t ? t / 12 : null);
    }
    const a = rowActual(row);
    if (a.length) {
      const has = a.some(v => v != null);
      const at = has ? a.reduce((x, v) => x + (v || 0), 0) : null;
      const ta = row.querySelector('.pb-ta'), oa = row.querySelector('.pb-oa');
      if (ta) ta.textContent = at != null ? fmt(at) : '';
      if (oa) oa.textContent = at ? fmt(at / 12) : '';
    }
  }
  function recalcSub(d) {
    const sr = document.querySelector('#pb-subrow');
    if (!sr) return;
    const months = (d || S.data).months;
    const prevM = Array(12).fill(0), budM = Array(12).fill(0), actM = Array(12).fill(0);
    let hasPrev = false, hasAct = false;
    document.querySelectorAll('#pb-wrap tr.pb-row').forEach(row => {
      row.querySelectorAll('[data-mp]').forEach(td => { const v = parseNum(td.textContent); if (v != null) { prevM[+td.dataset.mp] += v; hasPrev = true; } });
      rowBudget(row).forEach((v, i) => { if (v) budM[i] += v; });
      const a = rowActual(row);
      if (a.length) a.forEach((v, i) => { if (v != null) { actM[i] += v; hasAct = true; } });
    });
    months.forEach((_, i) => {
      const p = sr.querySelector(`[data-sp="${i}"]`), b = sr.querySelector(`[data-sb="${i}"]`), a = sr.querySelector(`[data-sa="${i}"]`);
      if (p) p.textContent = hasPrev ? fmt(prevM[i] || null) : '';
      if (b) b.textContent = fmt(budM[i] || null);
      if (a) a.textContent = hasAct ? fmt(actM[i] || null) : '';
    });
    const s = arr => arr.reduce((x, v) => x + v, 0);
    const pT = s(prevM), bT = s(budM), aT = s(actM);
    const set = (id, val) => { const el = document.querySelector('#' + id); if (el) el.textContent = val; };
    set('pb-subTp', hasPrev ? fmt(pT || null) : ''); set('pb-subOp', hasPrev && pT ? fmt(pT / 12) : '');
    set('pb-subTb', fmt(bT || null)); set('pb-subOb', bT ? fmt(bT / 12) : '');
    set('pb-subTa', hasAct ? fmt(aT || null) : ''); set('pb-subOa', hasAct && aT ? fmt(aT / 12) : '');
  }
  function recalcAll(d) {
    document.querySelectorAll('#pb-wrap tr.pb-row').forEach(recalcRow);
    recalcSub(d);
  }

  const rowKey = row => row.dataset.id || row.dataset.tmp || (row.dataset.tmp = 't' + Math.random().toString(36).slice(2));
  function scheduleSave(row, inp) {
    const kind = inp.classList.contains('pb-a') ? 'a' : 'b';
    const k = rowKey(row) + kind;
    clearTimeout(saveTimers[k]);
    saveTimers[k] = setTimeout(() => (kind === 'a' ? saveActual(row) : saveBudget(row)), 800);
  }
  function flushSave(row) {
    ['b', 'a'].forEach(kind => {
      const k = rowKey(row) + kind;
      if (saveTimers[k]) { clearTimeout(saveTimers[k]); delete saveTimers[k]; (kind === 'a' ? saveActual : saveBudget)(row); }
    });
  }
  function savedFlash(row) {
    row.classList.remove('pb-saving');
    row.classList.add('pb-saved');
    setTimeout(() => row.classList.remove('pb-saved'), 1200);
  }
  async function saveBudget(row) {
    if (!row.querySelectorAll('.pb-m').length) return;
    const id = row.dataset.id ? Number(row.dataset.id) : null;
    const pozInp = row.querySelector('.pb-pos-in');
    const pozisyon = pozInp ? pozInp.value.trim() : row.dataset.poz;
    const aylar = rowBudget(row);
    if (!pozisyon && aylar.every(v => v == null)) return;
    row.classList.add('pb-saving');
    try {
      const base = '/api/personel-butcesi/' + S.data.year + '/entries';
      const hdr = { 'Content-Type': 'application/json' };
      const body = JSON.stringify({ department: S.data.department, pozisyon, aylar });
      const saved = id ? await api(base + '/' + id, { method: 'PUT', headers: hdr, body })
        : await api(base, { method: 'POST', headers: hdr, body });
      if (!id && saved && saved.id) row.dataset.id = saved.id;
      if (pozisyon) row.dataset.poz = pozisyon;
      savedFlash(row);
    } catch (err) { row.classList.remove('pb-saving'); toast(err.message); }
  }
  async function saveActual(row) {
    if (!row.querySelectorAll('.pb-a').length) return;
    const pozInp = row.querySelector('.pb-pos-in');
    const pozisyon = (pozInp ? pozInp.value.trim() : '') || row.dataset.poz;
    if (!pozisyon) return;
    const dept = row.dataset.dept || S.data.department;
    const aylar = rowActual(row);
    row.classList.add('pb-saving');
    try {
      await api('/api/personel-butcesi/' + S.data.year + '/pozisyon-gerceklesen', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: dept, pozisyon, aylar })
      });
      savedFlash(row);
    } catch (err) { row.classList.remove('pb-saving'); toast(err.message); }
  }
  function addRow() {
    const sub = document.querySelector('#pb-subrow');
    if (!sub) { render(); return; }
    const empty = { id: null, pozisyon: '', dept: S.data.department, values: [], valuesNum: Array(12).fill(null), prevValues: Array(12).fill(''), actualValuesNum: Array(12).fill(null) };
    sub.insertAdjacentHTML('beforebegin', posRowHtml(empty, S.data, true, !!S.data.canEditActual, !S.data.department));
    const row = sub.previousElementSibling;
    bindRow(row, S.data);
    row.querySelector('.pb-pos-in').focus();
  }
  async function removeRow(row, d) {
    const id = row.dataset.id;
    if (id && !confirm('Bu pozisyon satırını silmek istiyor musunuz?')) return;
    if (id) {
      try { await api('/api/personel-butcesi/' + S.data.year + '/entries/' + id, { method: 'DELETE' }); }
      catch (err) { return toast(err.message); }
    }
    row.remove();
    recalcSub(d || S.data);
  }

  // --- Geçen yılla karşılaştırma ---
  async function renderCompare() {
    if (!document.querySelector('#pb-cmp')) $('#app').innerHTML = '<div class="section-title"><div><h2>Personel Bütçesi</h2></div></div><div class="card empty">Yükleniyor…</div>';
    try {
      const q = new URLSearchParams();
      if (S.year) q.set('year', S.year);
      if (S.dept) q.set('department', S.dept);
      S.cmp = await api('/api/personel-butcesi/karsilastirma?' + q.toString());
    } catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== 'personel-butcesi') return;
    S.year = S.cmp.year;
    sessionStorage.setItem('ik_pb_year', S.year);
    const d = S.cmp;
    const sub = `${d.year} — ${d.prevYear} karşılaştırması${d.scope === 'all' ? (d.department ? ' · ' + d.department : ' · tüm departmanlar') : ' · kendi departmanınız'}`;
    $('#app').innerHTML = `${pbHeader(d, sub, '')}<div id="pb-cmp">${compareHtml(d)}</div>`;
    bindHeader();
  }

  function pct(a, b) { return b ? Math.round((a - b) / b * 100) : (a ? 100 : 0); }

  function compareHtml(d) {
    if (!d.hasPrev) return `<div class="card"><div class="empty">${esc(d.prevYear)} yılı için karşılaştırılacak veri yok.</div></div>`;
    const t = d.totals;
    const yc = pct(t.currentYearAvg, t.prevYearAvg);
    const mc = pct(t.currentMonth.current, t.currentMonth.prev);
    const maxM = Math.max(1, ...d.monthly.flatMap(m => [m.current, m.prev]));
    const sign = n => (n > 0 ? '+' : '') + fmt(n);

    const kpis = `<div class="grid stats" style="margin-bottom:16px">
      <div class="card stat"><span class="label">${esc(d.year)} ort. kadro</span><div class="value">${fmt(t.currentYearAvg) || '0'}</div></div>
      <div class="card stat"><span class="label">${esc(d.prevYear)} ort. kadro</span><div class="value">${fmt(t.prevYearAvg) || '0'}</div></div>
      <div class="card stat"><span class="label">Yıllık değişim</span><div class="value">${yc >= 0 ? '+' : ''}${yc}%</div><span class="trend ${yc >= 0 ? 'up' : 'warn'}">${sign(t.currentYearAvg - t.prevYearAvg)} kişi</span></div>
      <div class="card stat"><span class="label">${esc(t.currentMonth.label)} · ${esc(d.year)} / ${esc(d.prevYear)}</span><div class="value">${fmt(t.currentMonth.current) || '0'} <span class="muted" style="font-size:15px">/ ${fmt(t.currentMonth.prev) || '0'}</span></div><span class="trend ${mc >= 0 ? 'up' : 'warn'}">${mc >= 0 ? '+' : ''}${mc}%</span></div>
    </div>`;

    const bars = `<div class="card"><div class="card-head">
        <h2>Aylık toplam kadro — ${esc(d.year)} vs ${esc(d.prevYear)}</h2>
        <div class="pb-legend"><span><i class="cur"></i>${esc(d.year)}</span><span><i class="prev"></i>${esc(d.prevYear)}</span></div>
      </div>
      <div class="pb-bars">${d.monthly.map((m, i) => `
        <div class="pb-mcol${i === d.monthIdx ? ' now' : ''}">
          <div class="pb-plot">
            <span class="pb-bar cur" style="height:${(m.current / maxM * 100).toFixed(1)}%" title="${esc(d.year)} ${esc(m.month)}: ${fmt(m.current)}"></span>
            <span class="pb-bar prev" style="height:${(m.prev / maxM * 100).toFixed(1)}%" title="${esc(d.prevYear)} ${esc(m.month)}: ${fmt(m.prev)}"></span>
          </div>
          <span class="pb-mlbl">${esc(m.month.slice(0, 3))}</span>
        </div>`).join('')}</div>
      <div class="muted" style="font-size:11px;padding:0 4px 4px">Her ay, bir önceki yılın aynı ayıyla karşılaştırılır. Vurgulu sütun içinde bulunduğumuz ay.</div>
    </div>`;

    const posRows = d.positions.map(p => {
      const mx = Math.max(1, p.currentAvg, p.prevAvg);
      const dc = p.diff > 0 ? 'up' : (p.diff < 0 ? 'warn' : 'muted');
      const tag = p.status === 'yeni' ? ' <span class="badge green">yeni</span>' : (p.status === 'kaldirildi' ? ' <span class="badge red">kaldırıldı</span>' : '');
      return `<tr>
        <td class="pb-pos">${esc(p.pozisyon)}${tag}</td>
        <td class="num">${fmt(p.currentAvg) || '0'}</td>
        <td class="num">${fmt(p.prevAvg) || '0'}</td>
        <td class="num"><span class="trend ${dc}">${sign(p.diff)}</span></td>
        <td style="min-width:170px"><div class="pb-cmpbar"><i class="prev" style="width:${(p.prevAvg / mx * 100).toFixed(1)}%"></i><i class="cur" style="width:${(p.currentAvg / mx * 100).toFixed(1)}%"></i></div></td>
      </tr>`;
    }).join('');
    const posTable = `<div class="card" style="margin-top:16px"><div class="card-head">
        <h2>Pozisyon bazında ortalama kadro</h2><span class="muted">${d.positions.length} pozisyon · ${esc(d.year)} vs ${esc(d.prevYear)}</span></div>
      <div style="overflow:auto"><table class="pb-table"><thead><tr>
        <th class="pb-pos">POZİSYON</th><th>${esc(d.year)} ORT.</th><th>${esc(d.prevYear)} ORT.</th><th>FARK</th><th></th>
      </tr></thead><tbody>${posRows || '<tr><td colspan="5" class="empty">Pozisyon yok</td></tr>'}</tbody></table></div></div>`;

    return kpis + bars + posTable;
  }

  // --- Bütçe / Gerçekleşen (departman satırlı, 3'lü sütun) ---
  const bgTimers = {};
  async function renderBG() {
    if (!document.querySelector('#pb-bg')) $('#app').innerHTML = '<div class="section-title"><div><h2>Personel Bütçesi</h2></div></div><div class="card empty">Yükleniyor…</div>';
    let d;
    try {
      const q = new URLSearchParams();
      if (S.year) q.set('year', S.year);
      if (S.dept) q.set('department', S.dept);
      d = await api('/api/personel-butcesi/butce-gerceklesen?' + q.toString());
    } catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== 'personel-butcesi') return;
    S.year = d.year;
    sessionStorage.setItem('ik_pb_year', S.year);
    S.bg = d;
    const sub = `${d.year} — her ay: ${d.prevYear} gerçekleşen · ${d.year} bütçe · ${d.year} gerçekleşen${d.department ? ' · ' + d.department : (d.scope === 'all' ? ' · tüm departmanlar' : '')}`;
    $('#app').innerHTML = `
      ${pbHeader(d, sub, '')}
      ${d.editable ? `<div class="card pb-draftbar" style="background:var(--blue-tint);border-color:#cdd8f5;color:var(--blue-ink)">Yeşil "Grç" hücrelerine <strong>${esc(d.department)}</strong> için aylık gerçekleşen kişi sayısını girin — otomatik kaydedilir. Bütçe, pozisyon girişlerinizden gelir.</div>` : ''}
      ${d.editableYear && !d.editable && !d.department && d.scope === 'all' ? '<div class="card" style="padding:12px 16px;margin-bottom:12px;color:var(--muted)">Gerçekleşen girmek için bir departman seçin.</div>' : ''}
      <div id="pb-bg">${bgTableHtml(d)}</div>`;
    bindHeader();
    if (d.editable) bindBG(d);
  }

  function bgTableHtml(d) {
    const rows = d.rows || [];
    if (!rows.length) return '<div class="card"><div class="empty">Veri yok.</div></div>';
    const monthTop = d.months.map((m, i) => `<th colspan="3" class="pb-mtop${i === d.monthIdx ? ' now' : ''}">${esc(m.slice(0, 3).toLocaleUpperCase('tr-TR'))}</th>`).join('');
    const monthSub = d.months.map(() => `<th title="${esc(d.prevYear)} gerçekleşen">${esc(d.prevYear.slice(2))}</th><th title="${esc(d.year)} bütçe">Büt</th><th title="${esc(d.year)} gerçekleşen">Grç</th>`).join('');
    const head = `<thead>
      <tr><th rowspan="2" class="pb-pos">DEPARTMAN</th>${monthTop}<th colspan="4" class="pb-ttop">TOPLAM</th></tr>
      <tr>${monthSub}<th>${esc(d.prevYear.slice(2))} G</th><th>Bütçe</th><th>Grç</th><th>Fark</th></tr>
    </thead>`;
    const body = rows.map(r => bgRowHtml(r, d)).join('');
    return `<div class="card pb-card"><div class="pb-scroll"><table class="pb-table pb-bg-table">${head}<tbody>${body}</tbody></table></div></div>`;
  }
  function bgRowHtml(r, d) {
    const cells = d.months.map((m, i) => `
      <td class="num pb-gy">${fmt(r.prevActual[i]) || ''}</td>
      <td class="num pb-bd">${fmt(r.budget[i]) || ''}</td>
      ${d.editable ? `<td class="num pb-gcell"><input class="pb-in pb-g" inputmode="decimal" data-m="${i}" value="${r.actual[i] == null ? '' : fmt(r.actual[i])}"></td>`
        : `<td class="num pb-ac">${fmt(r.actual[i]) || ''}</td>`}`).join('');
    const t = r.totals;
    const fc = t.fark == null ? 'muted' : (t.fark < 0 ? 'warn' : (t.fark > 0 ? 'up' : 'muted'));
    return `<tr class="pb-bgrow${r.grand ? ' pb-grand' : ''}" data-dept="${esc(r.dept)}">
      <td class="pb-pos">${esc(r.dept)}</td>${cells}
      <td class="num pb-gy">${fmt(t.prevActual) || ''}</td>
      <td class="num pb-bd">${fmt(t.budgetToDate) || fmt(t.budget) || ''}</td>
      <td class="num pb-ac pb-tot">${fmt(t.actual) || ''}</td>
      <td class="num"><span class="trend ${fc}">${t.fark == null ? '' : (t.fark > 0 ? '+' : '') + fmt(t.fark)}</span></td>
    </tr>`;
  }
  function bindBG(d) {
    document.querySelectorAll('#pb-bg tr.pb-bgrow').forEach(row => {
      row.querySelectorAll('.pb-g').forEach(inp => {
        inp.addEventListener('input', () => { bgRecalc(row, d); bgSchedule(row, d); });
        inp.addEventListener('blur', () => bgFlush(row, d));
      });
    });
  }
  function bgRecalc(row, d) {
    const aylar = [...row.querySelectorAll('.pb-g')].map(i => parseNum(i.value));
    const budgets = [...row.querySelectorAll('.pb-bd')].slice(0, 12).map(td => parseNum(td.textContent));
    let tA = 0, tBd = 0, hasA = false;
    aylar.forEach((v, i) => { if (v != null) { hasA = true; tA += v; tBd += (budgets[i] || 0); } });
    const cells = row.children;
    const totIdx = cells.length - 4;
    cells[totIdx + 1].textContent = hasA ? fmt(Math.round(tBd * 100) / 100) : (fmt(d.rows[0] && d.rows[0].totals.budget) || '');
    cells[totIdx + 2].textContent = hasA ? fmt(Math.round(tA * 100) / 100) : '';
    const fark = hasA ? Math.round((tA - tBd) * 100) / 100 : null;
    const span = cells[totIdx + 3].querySelector('.trend');
    span.textContent = fark == null ? '' : (fark > 0 ? '+' : '') + fmt(fark);
    span.className = 'trend ' + (fark == null ? 'muted' : (fark < 0 ? 'warn' : (fark > 0 ? 'up' : 'muted')));
  }
  function bgSchedule(row, d) {
    const k = row.dataset.dept;
    clearTimeout(bgTimers[k]);
    bgTimers[k] = setTimeout(() => bgSave(row, d), 800);
  }
  function bgFlush(row, d) {
    const k = row.dataset.dept;
    if (bgTimers[k]) { clearTimeout(bgTimers[k]); delete bgTimers[k]; bgSave(row, d); }
  }
  async function bgSave(row, d) {
    const aylar = [...row.querySelectorAll('.pb-g')].map(i => parseNum(i.value));
    row.classList.add('pb-saving');
    try {
      await api('/api/personel-butcesi/' + d.year + '/gerceklesen', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: row.dataset.dept, aylar })
      });
      row.classList.remove('pb-saving'); row.classList.add('pb-saved');
      setTimeout(() => row.classList.remove('pb-saved'), 1200);
    } catch (err) { row.classList.remove('pb-saving'); toast(err.message); }
  }

  const baseShell = shell;
  shell = function () {
    if (state.view === 'personel-butcesi') {
      if (window.__ikCan && !window.__ikCan('personel-butcesi')) { state.view = 'dashboard'; baseShell(); return; }
      render();
    } else baseShell();
  };
})();
