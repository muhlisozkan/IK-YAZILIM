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
  filterEmployees = function () {
    baseFilterEmployees();
    const selectedStatus = document.querySelector('#status-filter')?.value || '';
    if (!selectedStatus) return;
    document.querySelectorAll('#emp-table tbody tr').forEach(row => {
      const badge = row.querySelector('.badge');
      row.style.display = row.style.display !== 'none' && (!badge || badge.textContent.trim() === selectedStatus) ? '' : 'none';
    });
  };
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
          ['Kan Grubu', employee?.kan_grubu],
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
        row.insertBefore(exitCell, row.children[8]);
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
      ['TC Kimlik', 'Kan Grubu', 'Cinsiyet'].forEach(label => {
        const cell = document.createElement('th');
        cell.textContent = label;
        header.insertBefore(cell, taskHeader);
      });
      const exitHeader = document.createElement('th');
      exitHeader.textContent = 'İşten Çıkış';
      header.insertBefore(exitHeader, header.children[8]);
    }
    const toolbar = document.querySelector('.toolbar');
    if (toolbar && !document.querySelector('#status-filter')) {
      const statusFilter = document.createElement('select');
      statusFilter.id = 'status-filter';
      statusFilter.className = 'select';
      statusFilter.innerHTML = '<option value="">Tüm durumlar</option><option value="Aktif">Aktif</option><option value="Pasif">Pasif</option>';
      statusFilter.onchange = filterEmployees;
      toolbar.appendChild(statusFilter);
    }
  };
})();
