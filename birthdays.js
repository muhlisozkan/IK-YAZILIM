// Doğum Günleri: bugün/yarın doğum günü olan personel. Departman yöneticisi
// yalnız kendi departmanını, İK/şirket geneli roller tüm personeli + departman
// filtresiyle görür (bkz. api/server.js visibleDepartments).
(function () {
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  async function api(path) {
    const r = await fetch(path);
    const d = r.status === 204 ? null : await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d?.error || 'İşlem tamamlanamadı');
    return d;
  }
  const S = { items: [], deptFilter: '' };
  const COMPANY_WIDE_ROLES = ['Sistem yöneticisi', 'İK yöneticisi', 'Bordro yetkilisi', 'Mali İşler', 'Finans yöneticisi', 'Genel müdür', 'Genel müdür yardımcısı', 'Bölge yöneticisi', 'Sadece görüntüleme'];

  function isCompanyWideUser() {
    const u = window.__ikCurrentUser?.() || {};
    return COMPANY_WIDE_ROLES.includes(u.role) || String(u.department || '').toLocaleUpperCase('tr-TR').includes('İNSAN KAYNAK');
  }

  function deptOptions() {
    return [...new Set((state.employees || []).map(e => e.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  }

  function initials(name) {
    return String(name || '').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toLocaleUpperCase('tr-TR');
  }

  function personRow(p) {
    return `<div class="card" style="padding:12px 16px;display:flex;align-items:center;gap:12px">
      <div class="person-avatar" style="width:36px;height:36px;font-size:12.5px;flex-shrink:0">${esc(initials(p.name))}</div>
      <div><strong style="font-size:13.5px">${esc(p.name)}</strong><div class="muted" style="font-size:11.5px;margin-top:1px">${esc(p.department || '—')}</div></div>
    </div>`;
  }

  async function load() {
    if (state.view !== 'birthdays') return;
    if (!document.querySelector('#bday-wrap')) $('#app').innerHTML = '<div class="card empty">Yükleniyor…</div>';
    let rows;
    try {
      const wide = isCompanyWideUser();
      const q = wide && S.deptFilter ? '?department=' + encodeURIComponent(S.deptFilter) : '';
      rows = await api('/api/birthdays' + q);
    } catch (err) { $('#app').innerHTML = `<div class="card"><div class="empty">${esc(err.message)}</div></div>`; return; }
    if (state.view !== 'birthdays') return;
    S.items = rows;
    render();
  }

  function render() {
    if (state.view !== 'birthdays') return;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'birthdays'));
    $('#page-title').textContent = 'Doğum Günleri';
    const wide = isCompanyWideUser();
    const today = S.items.filter(p => p.when === 'today');
    const tomorrow = S.items.filter(p => p.when === 'tomorrow');
    const filterHtml = wide
      ? `<div class="toolbar"><select class="select" id="bday-dept-filter"><option value="">Tüm departmanlar</option>${deptOptions().map(d => `<option ${d === S.deptFilter ? 'selected' : ''}>${esc(d)}</option>`).join('')}</select></div>`
      : '';
    $('#app').innerHTML = `
      <div id="bday-wrap">
        <div class="section-title"><div><h2>Doğum Günleri</h2><span class="muted">${wide ? 'Tüm personel' : 'Departmanınız'} — bugün ve yarın doğum günü olanlar</span></div></div>
        ${filterHtml}
        <div class="bday-cols">
          <div>
            <h3 class="bday-col-head">Bugün <span class="badge blue">${today.length}</span></h3>
            <div class="bday-list">${today.length ? today.map(personRow).join('') : '<div class="card empty">Bugün doğum günü olan yok</div>'}</div>
          </div>
          <div>
            <h3 class="bday-col-head">Yarın <span class="badge blue">${tomorrow.length}</span></h3>
            <div class="bday-list">${tomorrow.length ? tomorrow.map(personRow).join('') : '<div class="card empty">Yarın doğum günü olan yok</div>'}</div>
          </div>
        </div>
      </div>`;
    document.getElementById('bday-dept-filter')?.addEventListener('change', e => { S.deptFilter = e.target.value; load(); });
  }

  const baseShell = shell;
  shell = function () {
    if (state.view === 'birthdays') load();
    else baseShell();
  };
})();
