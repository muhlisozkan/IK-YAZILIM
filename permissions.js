(function () {
  const userKey = 'ik_users';
  const sessionKey = 'ik_current_user_id';
  const allViews = ['dashboard','employees','departments','leave','payroll','expenses','advances','reports','attendance','users','shifts','notifications','documents','recruitment','performance','training'];
  const roleRules = {
    'Sistem yöneticisi': { views: allViews, create: true, approve: true },
    'İK yöneticisi': { views: allViews.filter(v => v !== 'users'), create: true, approve: true },
    'Departman yöneticisi': { views: ['dashboard','employees','departments','leave','expenses','advances','reports','attendance','shifts','notifications','performance','training'], create: true, approve: false },
    'Mali İşler': { views: ['dashboard','advances','expenses','reports','notifications'], create: false, approve: true },
    'Finans yöneticisi': { views: ['dashboard','advances','expenses','reports','notifications'], create: false, approve: true },
    'Genel müdür': { views: ['dashboard','leave','expenses','advances','reports','notifications'], create: false, approve: true },
    'Genel müdür yardımcısı': { views: ['dashboard','leave','expenses','advances','reports','notifications'], create: false, approve: true },
    'Bölge yöneticisi': { views: ['dashboard','leave','expenses','advances','reports','notifications'], create: false, approve: true },
    'Bordro yetkilisi': { views: ['dashboard','payroll','expenses','advances','reports','attendance','notifications'], create: true, approve: true },
    'Personel': { views: ['dashboard','leave','expenses','advances','notifications','documents'], create: true, approve: false },
    'Sadece görüntüleme': { views: allViews.filter(v => v !== 'users'), create: false, approve: false }
  };

  function users() {
    return JSON.parse(localStorage.getItem(userKey) || 'null') || [{ id: 1, name: 'Sistem yöneticisi', email: 'admin@firma.com', role: 'Sistem yöneticisi', status: 'Aktif' }];
  }
  function currentUser() {
    if (window.__ikAuthUser) return { ...window.__ikAuthUser, status: 'Aktif' };
    const active = users().filter(user => user.status === 'Aktif');
    return active.find(user => String(user.id) === localStorage.getItem(sessionKey)) || active[0] || users()[0];
  }
  function rule() {
    const user = currentUser();
    return roleRules[user?.role] || roleRules['Sadece görüntüleme'];
  }
  window.__ikCurrentUser = currentUser;
  window.__ikCurrentEmployee = function () {
    const user = currentUser();
    return (state.employees || []).find(employee => String(employee.id) === String(user?.employee_id))
      || (state.employees || []).find(employee => String(employee.name || '').toLocaleLowerCase('tr-TR') === String(user?.name || '').toLocaleLowerCase('tr-TR'))
      || null;
  };
  window.__ikCan = function (view, action = 'view') {
    const currentRule = rule();
    if (!currentRule.views.includes(view)) return false;
    return action === 'view' ? true : Boolean(currentRule[action]);
  };

  function renderSessionSelector() {
    const host = document.querySelector('.top-actions');
    if (!host) return;
    document.querySelector('#active-user')?.remove();
    let label = document.querySelector('#active-user-label');
    if (!label) {
      label = document.createElement('span');
      label.id = 'active-user-label';
      label.className = 'auth-user-label';
      host.insertBefore(label, host.querySelector('.avatar'));
    }
    const selected = currentUser();
    label.textContent = selected ? `${selected.name} · ${selected.role}` : '';
    const avatar = host.querySelector('.avatar');
    if (avatar && selected?.name) avatar.textContent = selected.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }
  function applyPermissions() {
    renderSessionSelector();
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.hidden = !window.__ikCan(item.dataset.view);
    });
  }

  const baseShell = shell;
  shell = function () {
    if (!window.__ikCan(state.view)) state.view = 'dashboard';
    baseShell();
    applyPermissions();
  };
  window.__ikApplyPermissions = applyPermissions;
  applyPermissions();
})();
