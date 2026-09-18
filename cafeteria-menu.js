// Personel Yemekhane Menüsü: haftalık personel yemek menüsü. İK Yanımda
// mobil uygulamasında tüm çalışanlara salt-okunur gösterilir. Bu paneldeki
// sayfa ise yalnızca Ana Mutfak departmanına (ve Sistem yöneticisine) açık —
// görüp düzenleyebilen tek departman Ana Mutfak.
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function api(path, options) {
    const r = await fetch(path, options ? { headers: { 'Content-Type': 'application/json' }, ...options } : undefined);
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'İşlem tamamlanamadı');
    return d;
  }
  const canWrite = () => window.__ikCan ? window.__ikCan('cafeteria-menu') : true;
  const CATEGORIES = [['soup', 'Çorba'], ['main', 'Ana Yemek'], ['alt', 'Alternatif'], ['dessert', 'Tatlı/Ek']];
  const catRank = type => { const i = CATEGORIES.findIndex(([k]) => k === type); return i === -1 ? CATEGORIES.length : i; };
  const catLabel = type => (CATEGORIES.find(([k]) => k === type) || [, type])[1];
  const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
  const mondayOf = d => { const x = new Date(d); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x.toISOString().slice(0, 10); };
  const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  const S = { weekStart: mondayOf(new Date()), weeks: [], editing: false, editDays: null };

  async function load() {
    if (state.view !== 'cafeteria-menu') return;
    if (!document.querySelector('#menu-wrap')) $('#app').innerHTML = '<div class="card empty">Yükleniyor…</div>';
    try { S.weeks = await api('/api/cafeteria-menu'); }
    catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== 'cafeteria-menu') return;
    render();
  }

  function currentWeekData() {
    return S.weeks.find(w => w.week_start === S.weekStart) || { week_start: S.weekStart, days: {} };
  }

  // Eski kayıtlar sabit soup/main/alt/dessert alanlarıyla (+ olası bir "extra"
  // dizisiyle) saklanmış olabilir; yeni format tek bir {type,value} dizisi
  // (items). İkisini de okuyup ortak listeye çevirir.
  function normalizeDayItems(d) {
    if (!d) return [];
    if (Array.isArray(d.items)) return d.items.map(x => ({ type: x.type || 'main', value: x.value || '' }));
    const items = [];
    CATEGORIES.forEach(([k]) => { if (d[k]) items.push({ type: k, value: d[k] }); });
    (Array.isArray(d.extra) ? d.extra : []).forEach(x => { if (x && x.value) items.push({ type: 'main', value: x.value }); });
    return items;
  }
  const sortItems = items => [...items].sort((a, b) => catRank(a.type) - catRank(b.type));

  function readOnlyView(week) {
    const dates = [...Array(7)].map((_, i) => addDays(S.weekStart, i));
    return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
      ${dates.map((date, i) => {
        const items = sortItems(normalizeDayItems(week.days?.[date]));
        return `<div class="card"><h3 style="font-size:13px;margin:0 0 8px">${DAY_NAMES[i]}<br><span class="muted" style="font-weight:400;font-size:11px">${date}</span></h3>
          ${items.length ? items.map(it => `<div class="detail" style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12.5px"><span class="muted">${esc(catLabel(it.type))}</span><strong style="text-align:right">${esc(it.value)}</strong></div>`).join('') : '<p class="muted" style="font-size:12px">Menü girilmedi</p>'}
        </div>`;
      }).join('')}
    </div>`;
  }

  function dayCardEdit(date, i) {
    const items = S.editDays[date] || [];
    return `<div class="card" id="daycard-${date}">
      <h3 style="font-size:13px;margin:0 0 10px">${DAY_NAMES[i]}<br><span class="muted" style="font-weight:400;font-size:11px">${date}</span></h3>
      ${items.map((it, idx) => `<div class="cm-row" style="border:1px solid var(--line);border-radius:9px;padding:6px;margin-bottom:8px">
        <div style="display:flex;gap:6px;align-items:center">
          <select class="select" style="flex:1;padding:5px 8px;font-size:12px" data-role="type" data-date="${date}" data-idx="${idx}">${CATEGORIES.map(([k, l]) => `<option value="${k}" ${it.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <button type="button" class="btn ghost danger-text" style="padding:3px 8px" data-remove="${date}:${idx}">✕</button>
        </div>
        <input class="input" style="width:100%;margin-top:5px;padding:5px 8px;font-size:12px" placeholder="Açıklama" data-role="value" data-date="${date}" data-idx="${idx}" value="${esc(it.value)}">
      </div>`).join('')}
      <button type="button" class="btn ghost" data-add="${date}" style="width:100%">+ Satır ekle</button>
    </div>`;
  }

  function editView() {
    const dates = [...Array(7)].map((_, i) => addDays(S.weekStart, i));
    return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${dates.map((date, i) => dayCardEdit(date, i)).join('')}</div>`;
  }

  function bindEditEvents() {
    document.querySelectorAll('[data-role="type"]').forEach(el => el.onchange = () => {
      const { date, idx } = el.dataset;
      if (S.editDays[date]?.[idx]) S.editDays[date][idx].type = el.value;
    });
    document.querySelectorAll('[data-role="value"]').forEach(el => el.oninput = () => {
      const { date, idx } = el.dataset;
      if (S.editDays[date]?.[idx]) S.editDays[date][idx].value = el.value;
    });
    document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => {
      const date = b.dataset.add;
      S.editDays[date] = [...(S.editDays[date] || []), { type: 'main', value: '' }];
      redrawDay(date);
    });
    document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
      const [date, idxStr] = b.dataset.remove.split(':');
      S.editDays[date] = (S.editDays[date] || []).filter((_, i) => String(i) !== idxStr);
      redrawDay(date);
    });
  }

  function redrawDay(date) {
    const dates = [...Array(7)].map((_, i) => addDays(S.weekStart, i));
    const i = dates.indexOf(date);
    const card = document.getElementById('daycard-' + date);
    if (!card || i === -1) { render(); return; }
    card.outerHTML = dayCardEdit(date, i);
    bindEditEvents();
  }

  const DEFAULT_ROW_TYPES = ['soup', 'main', 'alt', 'dessert', 'main'];
  function beginEdit() {
    const week = currentWeekData();
    const dates = [...Array(7)].map((_, i) => addDays(S.weekStart, i));
    S.editDays = {};
    dates.forEach(date => {
      const items = sortItems(normalizeDayItems(week.days?.[date]));
      S.editDays[date] = items.length ? items : DEFAULT_ROW_TYPES.map(type => ({ type, value: '' }));
    });
    S.editing = true;
    render();
  }

  async function save() {
    const dates = [...Array(7)].map((_, i) => addDays(S.weekStart, i));
    const days = {};
    dates.forEach(date => {
      const items = (S.editDays[date] || []).map(x => ({ type: x.type, value: (x.value || '').trim() })).filter(x => x.value);
      if (items.length) days[date] = { items: sortItems(items) };
    });
    try {
      await api('/api/cafeteria-menu', { method: 'PUT', body: JSON.stringify({ week_start: S.weekStart, days }) });
      toast('Menü kaydedildi'); S.editing = false; S.editDays = null; load();
    } catch (err) { toast(err.message); }
  }

  function render() {
    if (state.view !== 'cafeteria-menu') return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'cafeteria-menu'));
    $('#page-title').textContent = 'Personel Yemekhane Menüsü';
    const write = canWrite();
    const week = currentWeekData();
    const rangeLabel = `${S.weekStart} – ${addDays(S.weekStart, 6)}`;
    $('#app').innerHTML = `<div id="menu-wrap">
      <div class="section-title">
        <div><h2>Personel Yemekhane Menüsü</h2><span class="muted">${rangeLabel} — İK Yanımda mobil uygulamasında çalışanlara gösterilir</span></div>
        <div class="toolbar" style="margin:0">
          <button class="btn ghost" id="menu-prev">← Önceki hafta</button>
          <button class="btn ghost" id="menu-next">Sonraki hafta →</button>
          ${write ? (S.editing ? '<button class="btn" id="menu-save">Kaydet</button><button class="btn secondary" id="menu-cancel">Vazgeç</button>' : '<button class="btn" id="menu-edit">Düzenle</button>') : ''}
        </div>
      </div>
      ${S.editing ? editView() : readOnlyView(week)}
      </div>`;
    $('#menu-prev').onclick = () => { S.weekStart = addDays(S.weekStart, -7); S.editing = false; S.editDays = null; render(); };
    $('#menu-next').onclick = () => { S.weekStart = addDays(S.weekStart, 7); S.editing = false; S.editDays = null; render(); };
    $('#menu-edit')?.addEventListener('click', beginEdit);
    $('#menu-cancel')?.addEventListener('click', () => { S.editing = false; S.editDays = null; render(); });
    $('#menu-save')?.addEventListener('click', save);
    if (S.editing) bindEditEvents();
  }

  // Genel Bakış (dashboard) kartı: bugünün menüsünü departman kısıtlaması
  // olmadan herkese gösterir — ayrı, açık bir uç noktadan (/api/cafeteria-menu/today) okur.
  async function renderDashboardMenuCard() {
    const mount = document.querySelector('#dashboard-menu-mount');
    if (!mount) return;
    mount.innerHTML = '<div class="card" style="margin-bottom:16px"><div class="empty">Yükleniyor…</div></div>';
    let today;
    try { today = await api('/api/cafeteria-menu/today'); }
    catch { mount.innerHTML = ''; return; }
    if (!document.querySelector('#dashboard-menu-mount')) return;
    const rows = today.items.map(it => `<div class="detail" style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:12.5px"><span class="muted">${esc(it.label)}</span><strong style="text-align:right">${esc(it.value)}</strong></div>`).join('');
    mount.innerHTML = `<div class="card" style="margin-bottom:16px"><div class="card-head"><h2>Bugünün Yemek Menüsü</h2></div>${rows || '<p class="muted" style="font-size:12px">Bugün için menü henüz girilmedi.</p>'}</div>`;
  }
  window.__ikRenderCafeteriaMenuCard = renderDashboardMenuCard;

  const baseShell = shell;
  shell = function () {
    if (state.view === 'cafeteria-menu') load();
    else baseShell();
  };
})();
