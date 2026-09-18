// Duyurular: İK Yanımda mobil uygulamasında çalışanlara gösterilen duyuru
// panosu. Oluşturma/düzenleme/silme yalnızca İK'da (Sistem yöneticisi veya
// İK yöneticisi); panele erişen herkes listeyi görebilir.
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function api(path, options) {
    const r = await fetch(path, options ? { headers: { 'Content-Type': 'application/json' }, ...options } : undefined);
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'İşlem tamamlanamadı');
    return d;
  }
  const S = { items: [] };
  const canWrite = () => ['Sistem yöneticisi', 'İK yöneticisi'].includes((window.__ikCurrentUser?.() || {}).role);
  const fmtDate = s => s ? new Date(s).toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  async function load() {
    if (state.view !== 'announcements') return;
    if (!document.querySelector('#ann-wrap')) $('#app').innerHTML = '<div class="card empty">Yükleniyor…</div>';
    try { S.items = await api('/api/announcements'); }
    catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== 'announcements') return;
    render();
  }

  function card(a) {
    const write = canWrite();
    return `<div class="card" style="margin-bottom:12px">
      <div class="card-head">
        <h2>${a.pinned ? '📌 ' : ''}${esc(a.title)}</h2>
        ${write ? `<div style="display:flex;gap:4px"><button class="btn ghost" data-edit="${a.id}">Düzenle</button><button class="btn ghost" data-delete="${a.id}">Sil</button></div>` : ''}
      </div>
      <p style="white-space:pre-wrap;font-size:13px;color:var(--ink-soft);margin:0 0 10px">${esc(a.body)}</p>
      <span class="muted" style="font-size:11.5px">${esc(a.created_by_name || '')} · ${fmtDate(a.created_at)}</span>
    </div>`;
  }

  function formHtml(a) {
    return `<div class="form-grid">
      <div class="field" style="grid-column:1/3"><label>Başlık *</label><input class="input" id="a-title" value="${esc(a?.title || '')}"></div>
      <div class="field" style="grid-column:1/3"><label>İçerik</label><textarea class="input" id="a-body" rows="4">${esc(a?.body || '')}</textarea></div>
      <div class="field" style="grid-column:1/3"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" id="a-pinned" ${a?.pinned ? 'checked' : ''}> Sabitlensin (üstte göster)</label></div>
    </div>`;
  }

  function openForm(a) {
    modal(a ? 'Duyuruyu düzenle' : 'Yeni duyuru', formHtml(a), async () => {
      const title = $('#a-title').value.trim();
      if (!title) return toast('Başlık zorunludur');
      const body = { title, body: $('#a-body').value.trim(), pinned: $('#a-pinned').checked };
      try {
        if (a) await api(`/api/announcements/${a.id}`, { method: 'PUT', body: JSON.stringify(body) });
        else await api('/api/announcements', { method: 'POST', body: JSON.stringify(body) });
        closeModal(); toast(a ? 'Duyuru güncellendi' : 'Duyuru yayınlandı'); load();
      } catch (err) { toast(err.message); }
    });
  }

  function render() {
    if (state.view !== 'announcements') return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'announcements'));
    $('#page-title').textContent = 'Duyurular';
    const write = canWrite();
    $('#app').innerHTML = `
      <div id="ann-wrap">
      <div class="section-title"><div><h2>Duyurular</h2><span class="muted">İK Yanımda mobil uygulamasında çalışanlara gösterilir</span></div>${write ? '<button class="btn" id="ann-add">+ Duyuru ekle</button>' : ''}</div>
      ${S.items.length ? S.items.map(card).join('') : '<div class="card empty">Henüz duyuru yok</div>'}
      </div>`;
    $('#ann-add')?.addEventListener('click', () => openForm(null));
    document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openForm(S.items.find(x => x.id === b.dataset.edit)));
    document.querySelectorAll('[data-delete]').forEach(b => b.onclick = async () => {
      if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
      try { await api(`/api/announcements/${b.dataset.delete}`, { method: 'DELETE' }); toast('Duyuru silindi'); load(); }
      catch (err) { toast(err.message); }
    });
  }

  const baseShell = shell;
  shell = function () {
    if (state.view === 'announcements') load();
    else baseShell();
  };
})();
