// A La Carte Rezervasyon — Konsiyerj departmanının kapalı devre kullandığı,
// diğer modüllerden bağımsız restoran/oturum + rezervasyon kayıt modülü.
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const api = async (path, options) => {
    const response = await fetch(path, options);
    const data = response.status === 204 ? null : await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'İşlem tamamlanamadı');
    return data;
  };
  const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const CURRENCY_LABELS = { TRY: '₺ TL', USD: '$ USD', EUR: '€ EUR', GBP: '£ GBP' };
  const CURRENCY_SYMBOLS = { TRY: '₺', USD: '$', EUR: '€', GBP: '£' };
  const currencySymbol = code => CURRENCY_SYMBOLS[code] || '₺';
  const todayISO = () => new Date().toISOString().slice(0, 10);
  // "HH:MM" başlangıçtan bitişe (dahil), 10 dk aralıklarla saat listesi üretir.
  // Bitiş, başlangıçtan küçükse (gece yarısını geçen oturum) ertesi güne sarkar.
  function timeSlots(start, end, stepMinutes) {
    const step = stepMinutes || 10;
    const toMin = t => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
    let startMin = toMin(start), endMin = toMin(end);
    if (endMin <= startMin) endMin += 24 * 60;
    const out = [];
    for (let m = startMin; m <= endMin; m += step) out.push(String(Math.floor((m % 1440) / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'));
    return out;
  }
  const CHART_COLORS = ['#4967f4', '#18a874', '#f59e0b', '#8b5cf6', '#06b6d4', '#e55261', '#64748b', '#ec4899'];
  function donutStyle(parts, total) {
    if (!total) return 'conic-gradient(var(--line-soft) 0 100%)';
    let cursor = 0;
    const stops = parts.filter(p => p.value > 0).map(p => { const start = cursor; cursor += p.value / total * 100; return `${p.color} ${start}% ${cursor}%`; });
    return `conic-gradient(${stops.join(',') || 'var(--line-soft) 0 100%'})`;
  }
  function populateTimeSelect(start, end, preselect) {
    const select = $('#ac-res-time');
    if (!select) return;
    const slots = timeSlots(start, end);
    if (preselect && !slots.includes(preselect)) slots.push(preselect);
    select.innerHTML = slots.map(t => `<option value="${t}" ${t === preselect ? 'selected' : ''}>${t}</option>`).join('');
  }

  const AC = { tab: 'restaurants', resTab: 'reservations', restaurants: [], loaded: false, resFrom: todayISO(), resTo: todayISO(), resRestaurant: '', resSession: '', resSessions: [], resSearch: '', reservations: [], guests: [], guestStatus: null };

  async function loadRestaurants(force) {
    if (AC.loaded && !force) return;
    AC.restaurants = await api('/api/alacarte/restaurants');
    AC.loaded = true;
  }

  function canWrite() { return window.__ikCan ? window.__ikCan('alacarte', 'create') : true; }
  function canFull() { return window.__ikCan ? window.__ikCan('alacarte', 'approve') : true; }

  // Sol menüde "A La Carte Rezervasyon" grubu: Restoranlar / Rezervasyonlar.
  function syncAlacarteNavGroup() {
    const group = document.getElementById('alacarte-nav-group');
    if (!group) return;
    const active = ['alacarte-group', 'alacarte-restaurants', 'alacarte-reservations'].includes(state.view);
    const toggle = group.querySelector('.nav-group-toggle');
    if (toggle) toggle.classList.toggle('active', active);
    if (active) group.classList.add('open');
  }
  window.__ikSyncAlacarteGroup = syncAlacarteNavGroup;
  window.__ikToggleAlacarteMenu = function (event) {
    event?.preventDefault(); event?.stopPropagation();
    document.getElementById('alacarte-nav-group')?.classList.toggle('open');
  };

  // Rezervasyonlar sekmesi içindeki ikinci düzey sekme: Rezervasyonlar / Misafir Listesi.
  function resTabsHtml() {
    const tabs = [['reservations', 'Rezervasyonlar'], ['guests', 'Misafir Listesi']];
    return `<div class="leave-tabs" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button class="btn ${AC.resTab === k ? '' : 'ghost'}" data-ac-restab="${k}">${esc(l)}</button>`).join('')}</div>`;
  }
  function bindResTabs() {
    document.querySelectorAll('[data-ac-restab]').forEach(b => b.onclick = () => { AC.resTab = b.dataset.acRestab; render(); });
  }

  // --- Restoranlar -------------------------------------------------------
  async function renderRestaurants() {
    await loadRestaurants();
    const rows = AC.restaurants.map(r => `<tr>
      <td><strong>${esc(r.name)}</strong>${r.description ? `<small class="muted" style="display:block">${esc(r.description)}</small>` : ''}</td>
      <td>${esc(CURRENCY_LABELS[r.currency] || r.currency)}</td>
      <td><span class="badge ${r.active ? 'green' : 'red'}">${r.active ? 'Aktif' : 'Pasif'}</span></td>
      <td>
        <button class="btn ghost" data-ac-sessions="${r.id}">Oturumlar</button>
        <button class="btn ghost" data-ac-export-rest="${r.id}">Excel Raporu</button>
        ${canWrite() ? `<button class="btn ghost" data-ac-edit-rest="${r.id}">Düzenle</button>` : ''}
        ${canFull() ? `<button class="btn ghost danger-text" data-ac-del-rest="${r.id}">Sil</button>` : ''}
      </td>
    </tr>`).join('');
    $('#app').innerHTML = `
      <div class="section-title"><div><h2>Restoranlar</h2><span class="muted">A la carte rezervasyon alınan restoranlar</span></div>${canWrite() ? '<button class="btn" id="ac-add-rest">+ Restoran ekle</button>' : ''}</div>
      <div class="card"><div style="overflow:auto"><table><thead><tr><th>RESTORAN</th><th>PARA BİRİMİ</th><th>DURUM</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">Henüz restoran yok</td></tr>'}</tbody></table></div></div>`;
    if ($('#ac-add-rest')) $('#ac-add-rest').onclick = () => restaurantModal();
    document.querySelectorAll('[data-ac-edit-rest]').forEach(b => b.onclick = () => restaurantModal(AC.restaurants.find(r => r.id === Number(b.dataset.acEditRest))));
    document.querySelectorAll('[data-ac-del-rest]').forEach(b => b.onclick = async () => {
      if (!confirm('Bu restoranı silmek istediğinize emin misiniz? Bağlı oturumlar da silinir.')) return;
      try { await api('/api/alacarte/restaurants/' + b.dataset.acDelRest, { method: 'DELETE' }); toast('Restoran silindi'); await loadRestaurants(true); renderRestaurants(); }
      catch (e) { toast(e.message); }
    });
    document.querySelectorAll('[data-ac-sessions]').forEach(b => b.onclick = () => { AC.tab = 'sessions'; AC.sessionsRestaurantId = Number(b.dataset.acSessions); render(); });
    document.querySelectorAll('[data-ac-export-rest]').forEach(b => b.onclick = () => { window.open('/api/alacarte/restaurants/' + b.dataset.acExportRest + '/export?_=' + Date.now(), '_blank'); });
  }
  function restaurantModal(existing) {
    modal(existing ? 'Restoranı düzenle' : 'Yeni restoran', `<div class="form-grid">
      <div class="field"><label>Ad *</label><input class="input" id="ac-r-name" value="${esc(existing?.name || '')}"></div>
      <div class="field"><label>Para birimi</label><select class="select" id="ac-r-currency">${Object.entries(CURRENCY_LABELS).map(([code, label]) => `<option value="${code}" ${(existing?.currency || 'TRY') === code ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div>
      <div class="field"><label>Durum</label><select class="select" id="ac-r-active"><option value="true" ${existing?.active !== false ? 'selected' : ''}>Aktif</option><option value="false" ${existing?.active === false ? 'selected' : ''}>Pasif</option></select></div>
      <div class="field" style="grid-column:1/-1"><label>Açıklama</label><textarea class="input" id="ac-r-desc" rows="2">${esc(existing?.description || '')}</textarea></div>
    </div>`, async () => {
      const name = $('#ac-r-name').value.trim();
      if (!name) return toast('Restoran adı zorunludur');
      const payload = { name, description: $('#ac-r-desc').value.trim(), active: $('#ac-r-active').value === 'true', currency: $('#ac-r-currency').value };
      try {
        if (existing) await api('/api/alacarte/restaurants/' + existing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        else await api('/api/alacarte/restaurants', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeModal(); await loadRestaurants(true); toast(existing ? 'Restoran güncellendi' : 'Restoran eklendi'); renderRestaurants();
      } catch (e) { toast(e.message); }
    });
  }

  // --- Oturumlar (restoran bazlı) -----------------------------------------
  async function renderSessions() {
    await loadRestaurants();
    const restaurant = AC.restaurants.find(r => r.id === AC.sessionsRestaurantId);
    if (!restaurant) { AC.tab = 'restaurants'; return renderRestaurants(); }
    const sessions = await api('/api/alacarte/restaurants/' + restaurant.id + '/sessions');
    const rows = sessions.map(s => `<tr>
      <td><strong>${esc(s.name)}</strong><small class="muted" style="display:block">${s.days_of_week.map(d => DAY_LABELS[d - 1]).join(', ')}</small></td>
      <td>${esc(s.start_time)} – ${esc(s.end_time)}</td>
      <td>${s.capacity || 'Sınırsız'}</td>
      <td>${currencySymbol(restaurant.currency)}${s.price_adult} / ${currencySymbol(restaurant.currency)}${s.price_child}</td>
      <td><span class="badge ${s.active ? 'green' : 'red'}">${s.active ? 'Aktif' : 'Pasif'}</span></td>
      <td>${canWrite() ? `<button class="btn ghost" data-ac-edit-sess="${s.id}">Düzenle</button>` : ''}${canFull() ? `<button class="btn ghost danger-text" data-ac-del-sess="${s.id}">Sil</button>` : ''}</td>
    </tr>`).join('');
    $('#app').innerHTML = `
      <div class="section-title"><div><button class="btn ghost" id="ac-back-rest">← Restoranlar</button><h2 style="margin-top:8px">${esc(restaurant.name)} · Oturumlar</h2><span class="muted">Gün/saat bazlı kapasite ve fiyatlandırma</span></div>${canWrite() ? '<button class="btn" id="ac-add-sess">+ Oturum ekle</button>' : ''}</div>
      <div class="card"><div style="overflow:auto"><table><thead><tr><th>PROGRAM</th><th>SAAT</th><th>KAPASİTE</th><th>FİYAT (YETİŞKİN/ÇOCUK)</th><th>DURUM</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="empty">Henüz oturum yok</td></tr>'}</tbody></table></div></div>`;
    $('#ac-back-rest').onclick = () => { AC.tab = 'restaurants'; render(); };
    if ($('#ac-add-sess')) $('#ac-add-sess').onclick = () => sessionModal(restaurant.id);
    document.querySelectorAll('[data-ac-edit-sess]').forEach(b => b.onclick = () => sessionModal(restaurant.id, sessions.find(s => s.id === Number(b.dataset.acEditSess))));
    document.querySelectorAll('[data-ac-del-sess]').forEach(b => b.onclick = async () => {
      if (!confirm('Bu oturumu silmek istediğinize emin misiniz?')) return;
      try { await api('/api/alacarte/sessions/' + b.dataset.acDelSess, { method: 'DELETE' }); toast('Oturum silindi'); renderSessions(); }
      catch (e) { toast(e.message); }
    });
  }
  function sessionModal(restaurantId, existing) {
    const days = existing?.days_of_week || [1, 2, 3, 4, 5, 6, 7];
    const currency = currencySymbol(AC.restaurants.find(r => r.id === restaurantId)?.currency);
    modal(existing ? 'Oturumu düzenle' : 'Yeni oturum', `
      <div class="field" style="margin-bottom:14px"><label>Program adı *</label><input class="input" id="ac-s-name" style="width:100%" value="${esc(existing?.name || '')}" placeholder="Oturum 1 - 19:00"></div>
      <div class="field" style="margin-bottom:14px"><label>Günler</label><div style="display:flex;gap:14px;flex-wrap:wrap;padding:9px 0">${DAY_LABELS.map((l, i) => `<label style="display:flex;align-items:center;gap:5px;font-size:13px;cursor:pointer"><input type="checkbox" class="ac-s-day" value="${i + 1}" ${days.includes(i + 1) ? 'checked' : ''}> ${l}</label>`).join('')}</div></div>
      <div class="form-grid">
        <div class="field"><label>Başlangıç saati *</label><input class="input" id="ac-s-start" type="time" value="${esc(existing?.start_time || '19:00')}"></div>
        <div class="field"><label>Bitiş saati *</label><input class="input" id="ac-s-end" type="time" value="${esc(existing?.end_time || '22:00')}"></div>
        <div class="field"><label>Kapasite (0 = sınırsız)</label><input class="input" id="ac-s-capacity" type="number" min="0" value="${existing?.capacity ?? 0}"></div>
        <div class="field"><label>Durum</label><select class="select" id="ac-s-active"><option value="true" ${existing?.active !== false ? 'selected' : ''}>Aktif</option><option value="false" ${existing?.active === false ? 'selected' : ''}>Pasif</option></select></div>
        <div class="field"><label>Yetişkin fiyatı (${currency})</label><input class="input" id="ac-s-price-adult" type="number" step="0.01" min="0" value="${existing?.price_adult ?? 0}"></div>
        <div class="field"><label>Çocuk fiyatı (${currency})</label><input class="input" id="ac-s-price-child" type="number" step="0.01" min="0" value="${existing?.price_child ?? 0}"></div>
        <div class="field"><label>Çocuk kabul ediliyor</label><select class="select" id="ac-s-accepts-children"><option value="true" ${existing?.accepts_children !== false ? 'selected' : ''}>Evet</option><option value="false" ${existing?.accepts_children === false ? 'selected' : ''}>Hayır</option></select></div>
        <div class="field"></div>
        <div class="field"><label>Çocuk yaşı — en küçük</label><input class="input" id="ac-s-child-min" type="number" min="0" value="${existing?.child_min_age ?? 7}"></div>
        <div class="field"><label>Çocuk yaşı — en büyük</label><input class="input" id="ac-s-child-max" type="number" min="0" value="${existing?.child_max_age ?? 11}"></div>
        <div class="field"><label>Kişi başı min. rez. limiti</label><input class="input" id="ac-s-min-party" type="number" min="0" value="${existing?.min_party ?? 0}"></div>
        <div class="field"><label>Kişi başı max. rez. limiti (0 = sınırsız)</label><input class="input" id="ac-s-max-party" type="number" min="0" value="${existing?.max_party ?? 0}"></div>
      </div>`, async () => {
      const name = $('#ac-s-name').value.trim();
      const days_of_week = [...document.querySelectorAll('.ac-s-day:checked')].map(c => Number(c.value));
      if (!name) return toast('Program adı zorunludur');
      if (!days_of_week.length) return toast('En az bir gün seçin');
      const payload = {
        name, days_of_week, start_time: $('#ac-s-start').value, end_time: $('#ac-s-end').value,
        capacity: Number($('#ac-s-capacity').value) || 0, active: $('#ac-s-active').value === 'true',
        price_adult: Number($('#ac-s-price-adult').value) || 0, price_child: Number($('#ac-s-price-child').value) || 0,
        child_min_age: Number($('#ac-s-child-min').value) || 0, child_max_age: Number($('#ac-s-child-max').value) || 0,
        accepts_children: $('#ac-s-accepts-children').value === 'true',
        min_party: Number($('#ac-s-min-party').value) || 0, max_party: Number($('#ac-s-max-party').value) || 0
      };
      try {
        if (existing) await api('/api/alacarte/sessions/' + existing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        else await api('/api/alacarte/restaurants/' + restaurantId + '/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeModal(); toast(existing ? 'Oturum güncellendi' : 'Oturum eklendi'); renderSessions();
      } catch (e) { toast(e.message); }
    });
    document.querySelector('.modal')?.classList.add('ac-modal');
  }

  // --- Rezervasyonlar ------------------------------------------------------
  async function renderReservations() {
    await loadRestaurants();
    if (AC.resRestaurant) {
      AC.resSessions = await api('/api/alacarte/restaurants/' + AC.resRestaurant + '/sessions').catch(() => []);
    } else {
      AC.resSessions = [];
      AC.resSession = '';
    }
    if (AC.resSession && !AC.resSessions.some(s => String(s.id) === String(AC.resSession))) AC.resSession = '';
    const params = new URLSearchParams();
    if (AC.resFrom) params.set('from', AC.resFrom);
    if (AC.resTo) params.set('to', AC.resTo);
    if (AC.resRestaurant) params.set('restaurant_id', AC.resRestaurant);
    if (AC.resSession) params.set('session_id', AC.resSession);
    if (AC.resSearch) params.set('search', AC.resSearch);
    const summaryParams = new URLSearchParams();
    if (AC.resFrom) summaryParams.set('from', AC.resFrom);
    if (AC.resTo) summaryParams.set('to', AC.resTo);
    if (AC.resRestaurant) summaryParams.set('restaurant_id', AC.resRestaurant);
    const [reservationsResult, summaryResult] = await Promise.all([
      api('/api/alacarte/reservations?' + params.toString()),
      api('/api/alacarte/reservations/summary?' + summaryParams.toString()).catch(() => [])
    ]);
    AC.reservations = reservationsResult;
    AC.summary = summaryResult;
    const totalAdult = AC.reservations.reduce((a, r) => a + r.adult_count + r.child_count + r.infant_count, 0);
    const totalsByCurrency = {};
    AC.reservations.forEach(r => { totalsByCurrency[r.restaurant_currency] = (totalsByCurrency[r.restaurant_currency] || 0) + r.amount; });
    const totalText = Object.entries(totalsByCurrency).map(([cur, amt]) => currencySymbol(cur) + amt.toLocaleString('tr-TR')).join(' · ') || '0';
    const restaurantTabsHtml = `<div class="leave-tabs" style="margin-bottom:16px;flex-wrap:wrap">
      <button class="btn ${AC.resRestaurant ? 'ghost' : ''}" data-ac-res-restaurant="">Tümü</button>
      ${AC.restaurants.map(r => `<button class="btn ${String(AC.resRestaurant) === String(r.id) ? '' : 'ghost'}" data-ac-res-restaurant="${r.id}">${esc(r.name)}</button>`).join('')}
    </div>`;
    const sessionOptions = AC.resSessions.map(s => `<option value="${s.id}" ${String(AC.resSession) === String(s.id) ? 'selected' : ''}>${esc(s.name)} (${s.start_time}-${s.end_time})</option>`).join('');
    const rows = AC.reservations.map(r => `<tr>
      <td>${esc(r.reservation_date)}<small class="muted" style="display:block">${esc(r.reservation_time)}</small></td>
      <td>${esc(r.restaurant_name)}</td>
      <td>${esc(r.session_name || '-')}</td>
      <td><strong>${esc(r.guest_name)}</strong>${r.phone ? `<small class="muted" style="display:block">${esc(r.phone)}</small>` : ''}</td>
      <td>${esc(r.room_no || '-')}</td>
      <td>${esc(r.created_by || '-')}</td>
      <td>${r.adult_count}</td>
      <td>${r.child_count}</td>
      <td>${r.infant_count}</td>
      <td>${currencySymbol(r.restaurant_currency)}${r.amount}</td>
      <td><span class="badge ${r.status === 'Onaylandı' ? 'green' : r.status === 'İptal' ? 'red' : 'orange'}">${esc(r.status)}</span></td>
      <td>${canWrite() ? `<button class="btn ghost" data-ac-edit-res="${r.id}">Düzenle</button>` : '-'}</td>
      <td>${canFull() ? `<button class="btn ghost danger-text" data-ac-del-res="${r.id}">Sil</button>` : ''}</td>
    </tr>`).join('');
    const summaryRows = AC.summary.map(s => `<tr>
      <td><strong>${esc(s.session_name)}</strong>${s.restaurant_name ? `<small class="muted" style="display:block">${esc(s.restaurant_name)}</small>` : ''}</td>
      <td>${s.total_capacity === null ? '—' : s.total_capacity}</td>
      <td>${s.remaining_capacity === null ? '—' : s.remaining_capacity}</td>
      <td>${s.total_reservations}</td>
      <td>${s.adult_count}</td>
      <td>${s.child_count}</td>
      <td>${s.infant_count}</td>
      <td>${currencySymbol(s.restaurant_currency)}${s.revenue.toLocaleString('tr-TR')}</td>
    </tr>`).join('');
    const chartTotal = AC.summary.reduce((a, s) => a + s.total_reservations, 0);
    const chartParts = AC.summary.map((s, i) => ({ label: s.session_name, value: s.total_reservations, color: CHART_COLORS[i % CHART_COLORS.length] }));
    const chartHtml = chartTotal ? `<div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="width:96px;height:96px;flex:0 0 96px;border-radius:50%;position:relative;background:${donutStyle(chartParts, chartTotal)}">
          <div style="position:absolute;inset:16px;border-radius:50%;background:var(--card);display:grid;place-items:center;text-align:center">
            <div><strong style="font-size:18px;display:block;line-height:1">${chartTotal}</strong><span class="muted" style="font-size:9px">rezervasyon</span></div>
          </div>
        </div>
        <ul style="list-style:none;margin:0;padding:0;flex:1;min-width:0">
          ${chartParts.map(p => `<li style="display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:5px"><span style="width:8px;height:8px;border-radius:50%;background:${p.color};flex:0 0 auto"></span><span class="muted" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.label)}</span><strong>${p.value}</strong></li>`).join('')}
        </ul>
      </div>` : '';
    $('#app').innerHTML = `${resTabsHtml()}
      <div class="section-title"><div><h2>Rezervasyonlar</h2><span class="muted">${AC.reservations.length} kayıt · ${totalAdult} kişi · ${totalText}</span></div>
        <div style="display:flex;gap:8px"><button class="btn ghost" id="ac-export">Excel indir</button>${canWrite() ? '<button class="btn" id="ac-add-res">+ Rezervasyon ekle</button>' : ''}</div></div>
      ${restaurantTabsHtml}
      <div class="ac-res-layout">
        <div class="ac-res-main">
          <div class="card" style="margin-bottom:16px"><div class="toolbar" style="flex-wrap:wrap">
            <div class="field"><label>Başlangıç</label><input class="input" id="ac-from" type="date" value="${AC.resFrom}"></div>
            <div class="field"><label>Bitiş</label><input class="input" id="ac-to" type="date" value="${AC.resTo}"></div>
            ${AC.resRestaurant ? `<div class="field"><label>Oturum</label><select class="select" id="ac-filter-session"><option value="">Tüm oturumlar</option>${sessionOptions}</select></div>` : ''}
            <div class="field"><label>Ara</label><input class="input" id="ac-search" placeholder="Misafir veya oda no…" value="${esc(AC.resSearch)}"></div>
          </div></div>
          <div class="card"><div style="overflow:auto"><table class="ac-res-table"><thead><tr><th>TARİH</th><th>RESTORAN</th><th>OTURUM</th><th>MİSAFİR</th><th>ODA NO</th><th>GİREN KULLANICI</th><th>YETİŞKİN</th><th>ÇOCUK</th><th>BEBEK</th><th>TUTAR</th><th>DURUM</th><th>DÜZENLE</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="13" class="empty">Gösterilecek rezervasyon yok</td></tr>'}</tbody></table></div></div>
        </div>
        <div class="card ac-res-summary">
          <div class="card-head"><h2>Oturum Özeti</h2><span class="muted">Seçili filtreye göre</span></div>
          ${chartHtml}
          <div style="overflow:auto"><table><thead><tr><th>OTURUM</th><th>KAPASİTE</th><th>KALAN</th><th>REZ.</th><th>YET.</th><th>ÇOC.</th><th>BEBEK</th><th>GELİR</th></tr></thead><tbody>${summaryRows || '<tr><td colspan="8" class="empty">Veri yok</td></tr>'}</tbody></table></div>
        </div>
      </div>`;
    bindResTabs();
    $('#ac-from').onchange = () => { AC.resFrom = $('#ac-from').value; renderReservations(); };
    $('#ac-to').onchange = () => { AC.resTo = $('#ac-to').value; renderReservations(); };
    document.querySelectorAll('[data-ac-res-restaurant]').forEach(b => b.onclick = () => { AC.resRestaurant = b.dataset.acResRestaurant; AC.resSession = ''; renderReservations(); });
    if ($('#ac-filter-session')) $('#ac-filter-session').onchange = () => { AC.resSession = $('#ac-filter-session').value; renderReservations(); };
    let searchTimer = null;
    $('#ac-search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { AC.resSearch = $('#ac-search').value.trim(); renderReservations(); }, 350); };
    $('#ac-export').onclick = () => { window.open('/api/alacarte/reservations/export?' + params.toString(), '_blank'); };
    if ($('#ac-add-res')) $('#ac-add-res').onclick = () => reservationModal();
    document.querySelectorAll('[data-ac-edit-res]').forEach(b => b.onclick = () => reservationModal(AC.reservations.find(r => r.id === Number(b.dataset.acEditRes))));
    document.querySelectorAll('[data-ac-del-res]').forEach(b => b.onclick = async () => {
      if (!confirm('Bu rezervasyonu silmek istediğinize emin misiniz?')) return;
      try { await api('/api/alacarte/reservations/' + b.dataset.acDelRes, { method: 'DELETE' }); toast('Rezervasyon silindi'); renderReservations(); }
      catch (e) { toast(e.message); }
    });
  }

  async function reservationModal(existing) {
    let sessions = [];
    const restaurantOptions = AC.restaurants.map(r => `<option value="${r.id}" ${existing?.restaurant_id === r.id ? 'selected' : ''}>${esc(r.name)}</option>`).join('');
    modal(existing ? 'Rezervasyonu düzenle' : 'Yeni rezervasyon', `
      <div class="form-grid" style="margin-bottom:14px">
        <div class="field"><label>Restoran *</label><select class="select" id="ac-res-rest"><option value="">Seçin</option>${restaurantOptions}</select></div>
        <div class="field"><label>Oturum</label><select class="select" id="ac-res-session"><option value="">Seçin</option></select><small class="muted" id="ac-res-capacity-info"></small></div>
      </div>
      <div class="field" style="margin-bottom:14px">
        <label>Misafir listesinden seç (opsiyonel)</label>
        <div style="display:flex;gap:8px">
          <select class="select" id="ac-res-guest-type" style="width:170px;flex:0 0 auto"><option value="inhouse">İçeride (Inhouse)</option><option value="arrival">Giriş (Arrival)</option></select>
          <input class="input" id="ac-res-guest-search" placeholder="İsim veya oda no yazarak arayın…" style="flex:1;min-width:0">
        </div>
        <div id="ac-res-guest-results" class="cb-menu" style="position:relative;max-height:160px;overflow:auto;display:none;border:1px solid var(--line);border-radius:9px;margin-top:6px"></div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Misafir adı *</label><input class="input" id="ac-res-name" value="${esc(existing?.guest_name || '')}"></div>
        <div class="field"><label>Oda no</label><input class="input" id="ac-res-room" value="${esc(existing?.room_no || '')}"></div>
        <div class="field"><label>Telefon</label><input class="input" id="ac-res-phone" value="${esc(existing?.phone || '')}"></div>
        <div class="field"><label>Durum</label><select class="select" id="ac-res-status"><option ${existing?.status === 'Onaylandı' || !existing ? 'selected' : ''}>Onaylandı</option><option ${existing?.status === 'Beklemede' ? 'selected' : ''}>Beklemede</option><option ${existing?.status === 'İptal' ? 'selected' : ''}>İptal</option></select></div>
        <div class="field"><label>Tarih *</label><input class="input" id="ac-res-date" type="date" value="${existing?.reservation_date || todayISO()}"></div>
        <div class="field"><label>Saat *</label><select class="select" id="ac-res-time"></select></div>
        <div class="field"><label>Yetişkin</label><input class="input" id="ac-res-adult" type="number" min="0" value="${existing?.adult_count ?? 1}"></div>
        <div class="field"><label>Çocuk</label><input class="input" id="ac-res-child" type="number" min="0" value="${existing?.child_count ?? 0}"></div>
        <div class="field"><label>Bebek</label><input class="input" id="ac-res-infant" type="number" min="0" value="${existing?.infant_count ?? 0}"></div>
        <div class="field"><label id="ac-res-amount-label">Tutar${existing ? ` (${currencySymbol(existing.restaurant_currency)})` : ''}</label><input class="input" id="ac-res-amount" type="number" step="0.01" min="0" value="${existing?.amount ?? 0}"></div>
      </div>
      <div class="field" style="margin-top:14px"><label>Not</label><textarea class="input" id="ac-res-note" rows="2" style="width:100%">${esc(existing?.note || '')}</textarea></div>
    `, async () => {
      const payload = {
        restaurant_id: $('#ac-res-rest').value, session_id: $('#ac-res-session').value || null,
        guest_id: $('#ac-res-rest').dataset.guestId || existing?.guest_id || null,
        guest_name: $('#ac-res-name').value.trim(), room_no: $('#ac-res-room').value.trim(), phone: $('#ac-res-phone').value.trim(),
        guest_type: $('#ac-res-guest-type').value,
        reservation_date: $('#ac-res-date').value, reservation_time: $('#ac-res-time').value,
        adult_count: Number($('#ac-res-adult').value) || 0, child_count: Number($('#ac-res-child').value) || 0, infant_count: Number($('#ac-res-infant').value) || 0,
        amount: Number($('#ac-res-amount').value) || 0, status: $('#ac-res-status').value, note: $('#ac-res-note').value.trim(),
        arrived: existing?.arrived || false
      };
      if (!payload.restaurant_id || !payload.guest_name || !payload.reservation_date || !payload.reservation_time) return toast('Restoran, misafir adı, tarih ve saati kontrol edin');
      try {
        if (existing) await api('/api/alacarte/reservations/' + existing.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        else await api('/api/alacarte/reservations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        closeModal(); toast(existing ? 'Rezervasyon güncellendi' : 'Rezervasyon oluşturuldu'); renderReservations();
      } catch (e) { toast(e.message); }
    });
    document.querySelector('.modal')?.classList.add('ac-modal');

    const loadSessionsForModal = async (restaurantId, preselect) => {
      const select = $('#ac-res-session');
      if (!restaurantId) { select.innerHTML = '<option value="">Seçin</option>'; sessions = []; return; }
      sessions = await api('/api/alacarte/restaurants/' + restaurantId + '/sessions');
      select.innerHTML = '<option value="">Seçin</option>' + sessions.map(s => `<option value="${s.id}" ${preselect === s.id ? 'selected' : ''}>${esc(s.name)} (${s.start_time}-${s.end_time})</option>`).join('');
    };
    $('#ac-res-rest').onchange = () => {
      loadSessionsForModal($('#ac-res-rest').value);
      const restaurant = AC.restaurants.find(r => r.id === Number($('#ac-res-rest').value));
      $('#ac-res-amount-label').textContent = 'Tutar' + (restaurant ? ` (${currencySymbol(restaurant.currency)})` : '');
    };
    const updateCapacityInfo = async () => {
      const info = $('#ac-res-capacity-info');
      const sessionId = Number($('#ac-res-session').value);
      const date = $('#ac-res-date').value;
      if (!sessionId || !date) { info.textContent = ''; return; }
      info.textContent = 'Kapasite kontrol ediliyor…';
      try {
        const params = new URLSearchParams({ date });
        if (existing) params.set('exclude', existing.id);
        const cap = await api('/api/alacarte/sessions/' + sessionId + '/capacity?' + params.toString());
        info.textContent = cap.remaining === null ? 'Kapasite: sınırsız' : `Kalan kapasite: ${cap.remaining} / ${cap.capacity} kişi`;
      } catch { info.textContent = ''; }
    };
    $('#ac-res-session').onchange = () => {
      const session = sessions.find(s => s.id === Number($('#ac-res-session').value));
      if (!session) { populateTimeSelect('00:00', '23:50', $('#ac-res-time').value); $('#ac-res-capacity-info').textContent = ''; return; }
      // Oturum seçilince saat listesi yalnızca o oturumun başlangıç-bitiş aralığına daralır (10 dk arayla).
      populateTimeSelect(session.start_time, session.end_time);
      const adult = Number($('#ac-res-adult').value) || 0, child = Number($('#ac-res-child').value) || 0;
      $('#ac-res-amount').value = (adult * session.price_adult + child * session.price_child).toFixed(2);
      updateCapacityInfo();
    };
    $('#ac-res-date').onchange = updateCapacityInfo;
    if (existing?.restaurant_id) await loadSessionsForModal(existing.restaurant_id, existing.session_id);
    const preselectedSession = sessions.find(s => s.id === existing?.session_id);
    if (preselectedSession) populateTimeSelect(preselectedSession.start_time, preselectedSession.end_time, existing.reservation_time);
    else populateTimeSelect('00:00', '23:50', existing?.reservation_time);
    if (existing?.guest_type) $('#ac-res-guest-type').value = existing.guest_type;
    if (preselectedSession) updateCapacityInfo();

    let guestSearchTimer = null;
    $('#ac-res-guest-search').oninput = () => {
      clearTimeout(guestSearchTimer);
      const q = $('#ac-res-guest-search').value.trim();
      const box = $('#ac-res-guest-results');
      if (!q) { box.style.display = 'none'; return; }
      guestSearchTimer = setTimeout(async () => {
        const type = $('#ac-res-guest-type').value;
        const results = await api('/api/alacarte/guests?type=' + encodeURIComponent(type) + '&search=' + encodeURIComponent(q)).catch(() => []);
        box.innerHTML = results.length
          ? results.map(g => `<div class="cb-opt" data-guest-id="${g.id}" data-guest-name="${esc(g.name)}" data-guest-room="${esc(g.room_no)}" data-guest-phone="${esc(g.phone)}" style="cursor:pointer">${esc(g.name)} · Oda ${esc(g.room_no || '-')}</div>`).join('')
          : '<div class="cb-empty">Eşleşme yok</div>';
        box.style.display = 'block';
        box.querySelectorAll('[data-guest-id]').forEach(opt => opt.onclick = () => {
          $('#ac-res-name').value = opt.dataset.guestName;
          $('#ac-res-room').value = opt.dataset.guestRoom;
          $('#ac-res-phone').value = opt.dataset.guestPhone;
          $('#ac-res-rest').dataset.guestId = opt.dataset.guestId;
          box.style.display = 'none';
          $('#ac-res-guest-search').value = '';
        });
      }, 300);
    };
  }

  // --- Misafir Listesi (Excel yükleme) --------------------------------------
  async function renderGuests() {
    AC.guestStatus = await api('/api/alacarte/guests/status').catch(() => null);
    AC.guests = await api('/api/alacarte/guests').catch(() => []);
    const rows = AC.guests.map(g => `<tr><td>${esc(g.name)}</td><td>${esc(g.room_no || '-')}</td><td><span class="badge ${g.guest_type === 'inhouse' ? 'blue' : 'orange'}">${g.guest_type === 'inhouse' ? 'İçeride' : 'Giriş'}</span></td><td>${esc(g.phone || '-')}</td></tr>`).join('');
    const statusText = AC.guestStatus?.imported_at
      ? `Son yükleme: ${new Date(AC.guestStatus.imported_at).toLocaleString('tr-TR')} · ${AC.guestStatus.count} misafir`
      : 'Henüz misafir listesi yüklenmedi';
    $('#app').innerHTML = `${resTabsHtml()}
      <div class="section-title"><div><h2>Misafir Listesi</h2><span class="muted">${statusText}</span></div>${canWrite() ? `<label class="btn" style="cursor:pointer">Excel yükle<input type="file" id="ac-guest-file" accept=".xlsx" hidden></label>` : ''}</div>
      <div class="formula" style="margin-bottom:16px">Beklenen sütun başlıkları: <code>Ad Soyad</code>, <code>Oda No</code>, <code>Tip</code> (Inhouse/Arrival), <code>Telefon</code> (opsiyonel). Her yükleme mevcut listenin yerine geçer.</div>
      <div class="card"><div style="overflow:auto"><table><thead><tr><th>AD SOYAD</th><th>ODA NO</th><th>TİP</th><th>TELEFON</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="empty">Misafir listesi boş</td></tr>'}</tbody></table></div></div>`;
    bindResTabs();
    if ($('#ac-guest-file')) $('#ac-guest-file').onchange = async () => {
      const file = $('#ac-guest-file').files[0];
      if (!file) return;
      if (!/\.xlsx$/i.test(file.name)) return toast('Yalnızca .xlsx dosyası yükleyebilirsiniz');
      toast('Misafir listesi yükleniyor…');
      try {
        const result = await api('/api/alacarte/guests/import', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file });
        toast(result.count + ' misafir yüklendi'); renderGuests();
      } catch (e) { toast(e.message); }
    };
  }

  function render() {
    if (state.view === 'alacarte-restaurants') {
      if (AC.tab === 'sessions') renderSessions(); else renderRestaurants();
    } else if (state.view === 'alacarte-reservations') {
      if (AC.resTab === 'guests') renderGuests(); else renderReservations();
    }
  }

  const baseShell = shell;
  shell = function () {
    if (state.view === 'alacarte-restaurants' || state.view === 'alacarte-reservations') {
      if (window.__ikCan && !window.__ikCan(state.view)) { state.view = 'dashboard'; baseShell(); return; }
      document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
      $('#page-title').textContent = state.view === 'alacarte-restaurants' ? 'A La Carte · Restoranlar' : 'A La Carte · Rezervasyonlar';
      window.__ikSyncAlacarteGroup?.();
      // Rezervasyonlar sayfası, sağdaki özet panel için standart içerik genişliğinin
      // ötesindeki boş alanı kullanır — yalnızca bu sayfada geçerli.
      $('#app')?.classList.toggle('ac-wide', state.view === 'alacarte-reservations');
      render();
    } else {
      $('#app')?.classList.remove('ac-wide');
      baseShell();
    }
  };
})();
