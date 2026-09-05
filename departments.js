(function () {
  const esc = value => String(value ?? '').replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
  const period = value => value ? new Date(value).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : 'Henüz eşitlenmedi';

  async function loadDepartments() {
    const response = await fetch('/api/departments');
    if (!response.ok) throw new Error('Departman kayıtları alınamadı');
    return response.json();
  }
  async function loadStatus() {
    const response = await fetch('/api/payroll-sync/status');
    if (!response.ok) throw new Error('Bordro durumu alınamadı');
    return response.json();
  }
  async function refreshEmployees() {
    const response = await fetch('/api/employees');
    if (!response.ok) return;
    const rows = await response.json();
    state.employees = rows.map(row => ({ ...row, start: row.start_date?.slice(0, 10) || row.start }));
    save();
  }
  async function renderDepartments() {
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === 'departments'));
    $('#page-title').textContent = 'Departmanlar';
    $('#app').innerHTML = '<div class="empty">Departman kayıtları yükleniyor…</div>';
    try {
      const [departments, status] = await Promise.all([loadDepartments(), loadStatus()]);
      const canSync = window.__ikCan?.('departments', 'create');
      const rows = departments.map(department => `<tr><td><strong>${esc(department.name)}</strong></td><td>${esc(department.workplace || '—')}</td><td>${esc(department.unit || '—')}</td><td>${department.employee_count}</td><td><span class="badge green">Bordro</span></td></tr>`).join('');
      $('#app').innerHTML = `
        <div class="section-title"><div><h2>Departman ve personel eşitlemesi</h2><span class="muted">Bordro sisteminin tamamlanmış en güncel döneminden alınır; eksik dönemler çalışanları pasife çevirmez.</span></div>${canSync ? '<button class="btn" id="payroll-sync">↻ Bordro’dan eşitle</button>' : ''}</div>
        <div class="grid stats"><div class="card stat"><span class="label">Departman</span><div class="value">${departments.length}</div><span class="trend muted">Bordro kaynaklı kayıt</span></div><div class="card stat"><span class="label">Eşitlenen çalışan</span><div class="value">${status.synced_employees || 0}</div><span class="trend muted">Personel kartları</span></div><div class="card stat"><span class="label">Son eşitleme</span><div class="value" style="font-size:18px">${period(status.synced_at)}</div><span class="trend ${status.configured ? 'up' : 'warn'}">${status.configured ? '● Bordro bağlantısı hazır' : '● Bağlantı ayarı eksik'}</span></div></div>
        <div class="card"><div class="card-head"><h2>Departmanlar</h2><span class="muted">${departments.length} kayıt</span></div><div style="overflow:auto"><table><thead><tr><th>DEPARTMAN</th><th>İŞ YERİ</th><th>BİRİM</th><th>ÇALIŞAN</th><th>KAYNAK</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="empty">Henüz Bordro eşitlemesi yapılmadı.</td></tr>'}</tbody></table></div></div>`;
      const button = $('#payroll-sync');
      if (button) button.onclick = async () => {
        if (!confirm('En güncel Bordro dönemi ile personel ve departman bilgileri eşitlensin mi?')) return;
        button.disabled = true;
        button.textContent = 'Eşitleniyor…';
        try {
          const response = await fetch('/api/payroll-sync', { method: 'POST' });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Eşitleme tamamlanamadı');
          await refreshEmployees();
          toast(`${result.employees} çalışan ve ${result.departments} departman eşitlendi`);
          renderDepartments();
        } catch (error) {
          toast(error.message || 'Bordro eşitlemesi tamamlanamadı');
          button.disabled = false;
          button.textContent = '↻ Bordro’dan eşitle';
        }
      };
    } catch (_error) {
      $('#app').innerHTML = '<div class="empty">Departman kayıtları şu anda alınamadı.</div>';
    }
  }
  const baseShell = shell;
  shell = function () {
    if (state.view === 'departments') renderDepartments();
    else baseShell();
  };
})();
