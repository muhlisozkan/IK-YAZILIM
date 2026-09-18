// Kullanıcı ve Yetkiler > Araç Tanımları — filo aracı kayıtları (hms_records/fleet).
// Güvenlik > Araç Takipleri formundaki "Sürücü aracı" (plaka) listesi doğrudan
// bu kayıtlardan (fleet) beslenir; burada eklenen/silinen araç orada da yansır.
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const trSort = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'tr');
  const TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/></svg>';
  let rows = [], loaded = false, loading = false, filterQ = '';

  const api = async (path, opt) => {
    const r = await fetch(path, opt);
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'İşlem tamamlanamadı');
    return d;
  };
  async function load() {
    if (loading) return;
    loading = true;
    try { rows = await api('/api/hms/fleet'); loaded = true; }
    catch (err) { toast(err.message); }
    finally { loading = false; }
  }

  function rowHtml(r) {
    const disabled = r.disabled === 'Evet';
    return `<tr data-id="${r.id}">
      <td><strong>${esc(r.plate)}</strong></td><td>${esc(r.brand || '—')}</td><td>${esc(r.model || '—')}</td>
      <td>${esc(r.startKm || '—')}</td><td>${esc(r.lastKm || '—')}</td>
      <td><span class="badge ${disabled ? 'red' : 'green'}">${disabled ? 'Evet' : 'Hayır'}</span></td>
      <td style="white-space:nowrap"><button class="lf-trash" type="button" data-veh-del="${r.id}" title="Sil" aria-label="Sil">${TRASH_SVG}</button></td>
    </tr>`;
  }

  function render() {
    if (state.view !== 'vehicle-definitions' || window.__ikCurrentUser?.()?.role !== 'Sistem yöneticisi') return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'vehicle-definitions'));
    $('#page-title').textContent = 'Araç Tanımları';
    const q = filterQ.toLocaleLowerCase('tr-TR');
    const list = rows.filter(r => !q || [r.plate, r.brand, r.model].join(' ').toLocaleLowerCase('tr-TR').includes(q))
      .sort((a, b) => trSort(a.plate, b.plate));
    const body = list.map(rowHtml).join('') || `<tr><td colspan="7" class="empty">${loaded ? 'Araç kaydı bulunmuyor' : 'Yükleniyor…'}</td></tr>`;
    $('#app').innerHTML = `<div class="section-title"><div><h2>Araç Tanımları</h2><span class="muted">Filo aracı kayıtları — Güvenlik › Araç Takipleri'ndeki sürücü aracı listesi buradan beslenir</span></div><button class="btn" id="veh-add">+ Yeni</button></div>
      <div class="card">
        <div class="toolbar"><input class="input" id="veh-q" placeholder="Plaka, marka veya model ara…" value="${esc(filterQ)}"><button class="btn lf-refresh" id="veh-refresh" type="button">↻ Yenile</button><span class="muted" id="veh-count">${list.length} araç</span></div>
        <div style="overflow:auto"><table><thead><tr><th>PLAKA</th><th>MARKA</th><th>MODEL</th><th>BAŞLANGIÇ KM</th><th>SON KM</th><th>KULLANIM DIŞI</th><th></th></tr></thead><tbody>${body}</tbody></table></div>
      </div>`;
    $('#veh-add').onclick = () => vehicleModal(null);
    $('#veh-q').oninput = () => { filterQ = $('#veh-q').value; render(); };
    $('#veh-refresh').onclick = async () => { await load(); render(); };
    document.querySelectorAll('[data-veh-del]').forEach(b => b.onclick = () => delVehicle(b.dataset.vehDel));
    document.querySelectorAll('#app tbody tr[data-id]').forEach(tr => {
      tr.ondblclick = e => { if (e.target.closest('[data-veh-del]')) return; const row = list.find(r => String(r.id) === tr.dataset.id); if (row) vehicleModal(row); };
    });
  }

  async function delVehicle(id) {
    if (!confirm('Bu aracı silmek istediğinize emin misiniz?')) return;
    try {
      await api('/api/hms/fleet/' + id, { method: 'DELETE' });
      rows = rows.filter(r => String(r.id) !== String(id));
      render(); toast('Araç silindi');
    } catch (err) { toast(err.message) }
  }

  function vehicleModal(row) {
    const editing = Boolean(row);
    modal(editing ? 'Aracı düzenle' : 'Yeni araç', `<div class="form-grid">
      <div class="field"><label>Plaka *</label><input class="input" id="v-plate" value="${esc(row?.plate || '')}"></div>
      <div class="field"><label>Marka</label><input class="input" id="v-brand" value="${esc(row?.brand || '')}"></div>
      <div class="field"><label>Model</label><input class="input" id="v-model" value="${esc(row?.model || '')}"></div>
      <div class="field"><label>Başlangıç Km</label><input class="input" type="number" id="v-startkm" value="${esc(row?.startKm || '')}"></div>
      <div class="field"><label>Son Km</label><input class="input" type="number" id="v-lastkm" value="${esc(row?.lastKm || '')}"></div>
      <div class="field"><label>Kullanım Dışı</label><select class="select" id="v-disabled"><option ${row?.disabled !== 'Evet' ? 'selected' : ''}>Hayır</option><option ${row?.disabled === 'Evet' ? 'selected' : ''}>Evet</option></select></div>
    </div>`, async () => {
      const plate = $('#v-plate').value.trim();
      if (!plate) return toast('Plaka zorunludur');
      const payload = { plate, brand: $('#v-brand').value.trim(), model: $('#v-model').value.trim(), startKm: $('#v-startkm').value, lastKm: $('#v-lastkm').value, disabled: $('#v-disabled').value };
      try {
        const saved = editing
          ? await api('/api/hms/fleet/' + row.id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          : await api('/api/hms/fleet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, department: 'GÜVENLİK' }) });
        const idx = rows.findIndex(r => String(r.id) === String(saved.id));
        if (idx >= 0) rows[idx] = saved; else rows.unshift(saved);
        closeModal(); render(); toast(editing ? 'Araç güncellendi' : 'Araç eklendi');
      } catch (err) { toast(err.message) }
    });
  }

  const baseShell = shell;
  shell = function () {
    if (state.view === 'vehicle-definitions') { if (!loaded) load().then(render); else render(); }
    else baseShell();
  };
})();
