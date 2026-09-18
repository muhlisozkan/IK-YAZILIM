(function () {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const formatValue = value => {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleDateString('tr-TR');
    return String(value);
  };
  async function showPayrollDetails(id) {
    try {
      const response = await fetch(`/api/employees/${encodeURIComponent(id)}/payroll-details`);
      const employee = await response.json();
      if (!response.ok) throw new Error(employee.error || 'Bordro ayrıntıları alınamadı');
      const details = employee.payroll_details || {};
      const rows = Object.entries(details)
        .filter(([, value]) => value !== null && value !== undefined && value !== '')
        .map(([label, value]) => `<tr><td style="width:42%"><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(formatValue(value))}</td></tr>`)
        .join('');
      modal(`${escapeHtml(employee.name)} · Bordro detayları`, `<div class="muted" style="margin-bottom:14px">Sicil: ${escapeHtml(employee.payroll_sicil || '—')} · Son eşitleme: ${escapeHtml(formatValue(employee.source_synced_at))}</div><div style="max-height:58vh;overflow:auto"><table><tbody>${rows || '<tr><td class="empty">Bu çalışan için Bordro ayrıntısı bulunmuyor.</td></tr>'}</tbody></table></div>`, () => window.closeModal?.());
      document.querySelector('.modal .submit').textContent = 'Kapat';
    } catch (error) {
      toast(error.message || 'Bordro ayrıntıları alınamadı');
    }
  }
  const baseEmployees = employees;
  const baseFilterEmployees = filterEmployees;
  const rowEmployee = row => {
    const id = row.querySelector('[data-edit]')?.dataset.edit;
    return id ? state.employees.find(item => String(item.id) === String(id)) : null;
  };
  const inRange = (dateStr, from, to) => {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  };
  filterEmployees = function () {
    baseFilterEmployees();
    const selectedStatus = document.querySelector('#status-filter')?.value || '';
    if (selectedStatus) {
      document.querySelectorAll('#emp-table tbody tr').forEach(row => {
        const badge = row.querySelector('.badge');
        row.style.display = row.style.display !== 'none' && (!badge || badge.textContent.trim() === selectedStatus) ? '' : 'none';
      });
    }
    const hireFrom = document.querySelector('#hire-from')?.value || '';
    const hireTo = document.querySelector('#hire-to')?.value || '';
    const termFrom = document.querySelector('#term-from')?.value || '';
    const termTo = document.querySelector('#term-to')?.value || '';
    if (hireFrom || hireTo) {
      document.querySelectorAll('#emp-table tbody tr').forEach(row => {
        if (row.style.display === 'none') return;
        const employee = rowEmployee(row);
        if (!employee || !inRange(firstEmploymentStart(employee), hireFrom, hireTo)) row.style.display = 'none';
      });
    } else if (termFrom || termTo) {
      document.querySelectorAll('#emp-table tbody tr').forEach(row => {
        if (row.style.display === 'none') return;
        const employee = rowEmployee(row);
        if (!employee || !inRange(employee.termination_date, termFrom, termTo)) row.style.display = 'none';
      });
    }
  };
  // İşe giriş ve işten çıkış tarih filtreleri birbirini dışlar: biri kullanılınca
  // diğeri temizlenip devre dışı bırakılır (kullanıcı isteği 2026-09).
  function bindDateRangeFilters() {
    const hireFrom = document.querySelector('#hire-from'), hireTo = document.querySelector('#hire-to');
    const termFrom = document.querySelector('#term-from'), termTo = document.querySelector('#term-to');
    if (!hireFrom || !termFrom) return;
    const onHireChange = () => {
      const active = !!(hireFrom.value || hireTo.value);
      termFrom.disabled = termTo.disabled = active;
      if (active) { termFrom.value = ''; termTo.value = ''; }
      filterEmployees();
    };
    const onTermChange = () => {
      const active = !!(termFrom.value || termTo.value);
      hireFrom.disabled = hireTo.disabled = active;
      if (active) { hireFrom.value = ''; hireTo.value = ''; }
      filterEmployees();
    };
    [hireFrom, hireTo].forEach(input => input.onchange = onHireChange);
    [termFrom, termTo].forEach(input => input.onchange = onTermChange);
  }
  employees = function () {
    baseEmployees();
    const table = document.querySelector('#emp-table');
    if (table) {
      const header = table.querySelector('thead tr');
      if (header) {
        const cell = document.createElement('th');
        cell.textContent = 'sicil';
        header.insertBefore(cell, header.firstChild);
      }
    }
    document.querySelectorAll('[data-delete]').forEach(removeButton => {
      const employee = state.employees.find(item => String(item.id) === String(removeButton.dataset.delete));
      const row = removeButton.closest('tr');
      if (row) {
        const cell = document.createElement('td');
        cell.textContent = employee?.payroll_sicil || '—';
        row.insertBefore(cell, row.firstChild);
        const detailFields = [
          ['TC Kimlik', employee?.tc_kimlik],
          ['Cinsiyet', employee?.cinsiyet]
        ];
        const taskCell = row.children[2];
        detailFields.forEach(([, value]) => {
          const detailCell = document.createElement('td');
          detailCell.textContent = value || '—';
          row.insertBefore(detailCell, taskCell);
        });
        const exitCell = document.createElement('td');
        exitCell.textContent = employee?.termination_date ? new Date(employee.termination_date).toLocaleDateString('tr-TR') : '—';
        row.insertBefore(exitCell, row.children[row.children.length - 2]);
      }
      const detailButton = document.createElement('button');
      detailButton.className = 'btn ghost';
      detailButton.type = 'button';
      detailButton.textContent = 'Detay';
      detailButton.style.marginRight = '6px';
      detailButton.onclick = () => showPayrollDetails(removeButton.dataset.delete);
      removeButton.parentNode.insertBefore(detailButton, removeButton);
      removeButton.remove();
    });
    const header = document.querySelector('#emp-table thead tr');
    if (header) {
      const taskHeader = header.children[2];
      ['TC Kimlik', 'Cinsiyet'].forEach(label => {
        const cell = document.createElement('th');
        cell.textContent = label;
        header.insertBefore(cell, taskHeader);
      });
      const exitHeader = document.createElement('th');
      exitHeader.textContent = 'İşten Çıkış';
      header.insertBefore(exitHeader, header.children[header.children.length - 2]);
    }
    const toolbar = document.querySelector('.toolbar');
    if (toolbar && !document.querySelector('#status-filter')) {
      toolbar.style.flexWrap = 'wrap';
      const statusFilter = document.createElement('select');
      statusFilter.id = 'status-filter';
      statusFilter.className = 'select';
      statusFilter.innerHTML = '<option value="">Tüm durumlar</option><option value="Aktif">Aktif</option><option value="Pasif">Pasif</option>';
      statusFilter.onchange = filterEmployees;
      toolbar.appendChild(statusFilter);
      const dateFilters = document.createElement('div');
      dateFilters.style.cssText = 'display:flex;gap:14px;align-items:center;flex-wrap:wrap';
      dateFilters.innerHTML = `
        <span style="display:flex;gap:6px;align-items:center"><small class="muted">İşe giriş</small><input class="input" type="date" id="hire-from" style="min-width:0;width:145px"><input class="input" type="date" id="hire-to" style="min-width:0;width:145px"></span>
        <span style="display:flex;gap:6px;align-items:center"><small class="muted">İşten çıkış</small><input class="input" type="date" id="term-from" style="min-width:0;width:145px"><input class="input" type="date" id="term-to" style="min-width:0;width:145px"></span>`;
      toolbar.appendChild(dateFilters);
      bindDateRangeFilters();
    }
  };
})();
