// Güncel Tablo: yüklenen Excel dosyasının salt-okunur görüntüleyicisi + sürüm geçmişi.
// Excel finans ekibinde düzenlenir, buraya yeni sürüm yüklenir; uygulama sayfaları
// sekme sekme gösterir, formülleri hücreye tıklayınca gösterir.
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const colName = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; };
  const fmtDT = v => { if (!v) return '—'; const d = new Date(v); return isNaN(d) ? '—' : d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  async function api(path, opt) {
    const r = await fetch(path, opt);
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'İşlem tamamlanamadı');
    return d;
  }

  const S = { versions: [], wbId: null, sheetIdx: 0, sheetCache: {} };

  function canManage() {
    const u = window.__ikCurrentUser?.() || {};
    return ['Sistem yöneticisi', 'İK yöneticisi'].includes(u.role) || u.department === 'İnsan Kaynakları';
  }

  async function render() {
    if (state.view !== 'guncel-tablo') return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'guncel-tablo'));
    $('#page-title').textContent = 'Güncel Tablo';
    if (!canManage()) { $('#app').innerHTML = '<div class="card empty">Bu bölüme erişim yetkiniz yok.</div>'; return; }
    if (!document.querySelector('#gt-wrap')) $('#app').innerHTML = '<div class="section-title"><div><h2>Güncel Tablo</h2></div></div><div class="card empty">Yükleniyor…</div>';
    try { S.versions = await api('/api/guncel-tablo'); }
    catch (err) { $('#app').innerHTML = `<div class="card empty">${esc(err.message)}</div>`; return; }
    if (state.view !== 'guncel-tablo') return;

    if (!S.versions.length) {
      $('#app').innerHTML = `<div class="section-title"><div><h2>Güncel Tablo</h2><span class="muted">Excel raporu görüntüleyici</span></div></div>
        <div class="card"><p>Henüz bir Excel yüklenmemiş.</p>${uploadBtn('İlk Excel dosyasını yükle')}</div>`;
      bindUpload();
      return;
    }
    const cur = S.versions.find(v => v.id === S.wbId) || S.versions[0];
    S.wbId = cur.id;
    const meta = cur.sheet_meta || [];
    if (S.sheetIdx >= meta.length) S.sheetIdx = 0;

    $('#app').innerHTML = `
      <div class="section-title">
        <div><h2>Güncel Tablo</h2><span class="muted">${esc(cur.original_name)} · ${meta.length} sayfa · yükleyen ${esc(cur.uploaded_by || '—')} · ${esc(fmtDT(cur.uploaded_at))}</span></div>
        <div class="gt-actions">
          ${S.versions.length > 1 ? `<select class="select" id="gt-version">${S.versions.map(v => `<option value="${v.id}" ${v.id === cur.id ? 'selected' : ''}>${esc(fmtDT(v.uploaded_at))} · ${esc(v.uploaded_by || '—')}${v.is_current ? ' (güncel)' : ''}</option>`).join('')}</select>` : ''}
          <a class="btn secondary" id="gt-download" href="/api/guncel-tablo/${cur.id}/download">Excel indir</a>
          ${uploadBtn('Yeni sürüm yükle')}
          ${S.versions.length > 1 ? `<button class="btn ghost danger-text" id="gt-del">Bu sürümü sil</button>` : ''}
        </div>
      </div>
      ${cur.note ? `<div class="card" style="padding:12px 16px;margin-bottom:12px"><strong>Not:</strong> ${esc(cur.note)}</div>` : ''}
      <div id="gt-wrap">
        <div class="gt-tabs">${meta.map((s, i) => `<button class="gt-tab ${i === S.sheetIdx ? 'on' : ''}" data-sheet="${i}" title="${esc(s.name)}">${esc(s.name)}</button>`).join('')}</div>
        <div class="gt-formula" id="gt-formula"><span class="muted">Bir hücreye tıklayın — formülü / değeri burada görünür.</span></div>
        <div class="gt-sheet card" id="gt-sheet"><div class="empty">Yükleniyor…</div></div>
      </div>`;

    bindUpload();
    const vsel = document.querySelector('#gt-version');
    if (vsel) vsel.onchange = () => { S.wbId = Number(vsel.value); S.sheetIdx = 0; render(); };
    const del = document.querySelector('#gt-del');
    if (del) del.onclick = async () => {
      if (!confirm('Bu Excel sürümünü silmek istediğinize emin misiniz?')) return;
      try { await api('/api/guncel-tablo/' + cur.id, { method: 'DELETE' }); S.wbId = null; toast('Sürüm silindi'); render(); }
      catch (err) { toast(err.message); }
    };
    document.querySelectorAll('.gt-tab').forEach(b => b.onclick = () => {
      S.sheetIdx = Number(b.dataset.sheet);
      document.querySelectorAll('.gt-tab').forEach(x => x.classList.toggle('on', x === b));
      loadSheet();
    });
    loadSheet();
  }

  function uploadBtn(label) {
    return `<label class="btn" style="cursor:pointer">${esc(label)}<input type="file" id="gt-file" accept=".xlsx" hidden></label>`;
  }
  function bindUpload() {
    const f = document.querySelector('#gt-file');
    if (!f) return;
    f.onchange = async () => {
      const file = f.files && f.files[0];
      if (!file) return;
      if (!/\.xlsx$/i.test(file.name)) return toast('Yalnızca .xlsx dosyası yükleyebilirsiniz');
      if (file.size > 30 * 1024 * 1024) return toast('Dosya çok büyük (en fazla 30 MB)');
      const note = prompt('Bu sürüm için kısa not (opsiyonel):', '') || '';
      toast('Excel yükleniyor ve işleniyor, bu biraz sürebilir…');
      try {
        const saved = await api('/api/guncel-tablo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name), 'X-Note': encodeURIComponent(note) },
          body: file
        });
        S.wbId = saved.id; S.sheetIdx = 0; S.sheetCache = {};
        toast('Yeni sürüm yüklendi');
        render();
      } catch (err) { toast('Yükleme başarısız: ' + err.message); }
    };
  }

  async function loadSheet() {
    const host = document.querySelector('#gt-sheet');
    if (!host) return;
    const key = S.wbId + ':' + S.sheetIdx;
    host.innerHTML = '<div class="empty">Sayfa yükleniyor…</div>';
    let data = S.sheetCache[key];
    if (!data) {
      try { data = await api(`/api/guncel-tablo/${S.wbId}/sheet/${S.sheetIdx}`); S.sheetCache[key] = data; }
      catch (err) { host.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
    }
    if (document.querySelector('#gt-sheet') !== host) return;
    host.innerHTML = sheetTableHtml(data);
    const fbar = document.querySelector('#gt-formula');
    host.querySelectorAll('td[data-ref]').forEach(td => td.onclick = () => {
      host.querySelectorAll('td.gt-sel').forEach(x => x.classList.remove('gt-sel'));
      td.classList.add('gt-sel');
      const f = td.getAttribute('data-f');
      fbar.innerHTML = `<strong>${td.getAttribute('data-ref')}</strong> ${f ? `<span class="gt-fx">${esc(f)}</span> <span class="muted">→</span> ${esc(td.textContent)}` : esc(td.textContent) || '<span class="muted">(boş)</span>'}`;
    });
  }

  function sheetTableHtml(d) {
    const rows = d.rows || 0, cols = d.colsN || 0;
    if (!rows || !cols) return '<div class="empty">Bu sayfa boş.</div>';
    const map = new Map();
    (d.cells || []).forEach(c => map.set(c.r * 16384 + c.c, c));
    const covered = new Set();
    const anchor = new Map();
    (d.merges || []).forEach(m => {
      anchor.set(m.r1 * 16384 + m.c1, m);
      for (let r = m.r1; r <= m.r2; r++) for (let c = m.c1; c <= m.c2; c++) if (r !== m.r1 || c !== m.c1) covered.add(r * 16384 + c);
    });
    const st = d.styles || [];
    const big = rows * cols > 45000;
    let h = `<div class="gt-scroll${big ? ' gt-big' : ''}"><table class="gt-table"><colgroup><col class="gt-rowhdr">${
      Array.from({ length: cols }, (_, i) => `<col style="width:${Math.max(40, Math.min(240, (d.cols?.[i] || 9) * 7))}px">`).join('')
    }</colgroup><thead><tr><th></th>${Array.from({ length: cols }, (_, i) => `<th>${colName(i + 1)}</th>`).join('')}</tr></thead><tbody>`;
    for (let r = 1; r <= rows; r++) {
      h += `<tr><th>${r}</th>`;
      for (let c = 1; c <= cols; c++) {
        const key = r * 16384 + c;
        if (covered.has(key)) continue;
        const cell = map.get(key);
        const mg = anchor.get(key);
        let span = '';
        if (mg) { const rs = mg.r2 - mg.r1 + 1, cs = mg.c2 - mg.c1 + 1; if (rs > 1) span += ` rowspan="${rs}"`; if (cs > 1) span += ` colspan="${cs}"`; }
        if (!cell) { h += `<td${span}></td>`; continue; }
        const s = cell.s != null ? st[cell.s] : null;
        let cls = '', style = '';
        if (cell.f) cls += ' gt-hasf';
        if (s) {
          if (s.b) cls += ' gt-b';
          if (s.h === 'c') cls += ' gt-c'; else if (s.h === 'r') cls += ' gt-r'; else if (s.h === 'l') cls += ' gt-l';
          if (s.bg) style += `background:#${esc(s.bg)};`;
          if (s.fc) style += `color:#${esc(s.fc)};`;
        }
        if (cell.n && !(s && s.h)) cls += ' gt-r';
        h += `<td data-ref="${colName(c)}${r}"${cell.f ? ` data-f="${esc(cell.f)}"` : ''}${cls ? ` class="${cls.trim()}"` : ''}${style ? ` style="${style}"` : ''}${span}>${esc(cell.t || '')}</td>`;
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';
    if (big) h = `<div class="muted" style="font-size:12px;margin-bottom:8px">Büyük sayfa (${rows}×${cols}) — kaydırma biraz ağır olabilir.</div>` + h;
    return h;
  }

  const baseShell = shell;
  shell = function () {
    if (state.view === 'guncel-tablo') {
      if (window.__ikCan && !window.__ikCan('guncel-tablo')) { state.view = 'dashboard'; baseShell(); return; }
      render();
    } else baseShell();
  };
})();
