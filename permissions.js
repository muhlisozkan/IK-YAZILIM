(function () {
  const userKey = 'ik_users';
  const sessionKey = 'ik_current_user_id';
  const allViews = ['dashboard','employees','departments','leave','payroll','expenses','advances','reports','attendance','users','shifts','documents','recruitment','performance','training','security','lostfound'];
  const roleRules = {
    'Sistem yöneticisi': { views: allViews, create: true, approve: true },
    'İK yöneticisi': { views: allViews.filter(v => v !== 'users'), create: true, approve: true },
    'Departman yöneticisi': { views: ['dashboard','leave','expenses','advances','reports','shifts','recruitment','performance','training'], create: true, approve: false },
    'Mali İşler': { views: ['dashboard','advances','expenses','reports'], create: false, approve: true },
    'Finans yöneticisi': { views: ['dashboard','advances','expenses','reports'], create: false, approve: true },
    'Genel müdür': { views: ['dashboard','leave','expenses','advances','reports'], create: false, approve: true },
    'Genel müdür yardımcısı': { views: ['dashboard','leave','expenses','advances','reports'], create: false, approve: true },
    'Bölge yöneticisi': { views: ['dashboard','leave','expenses','advances','reports'], create: false, approve: true },
    'Bordro yetkilisi': { views: ['dashboard','payroll','expenses','advances','reports','attendance'], create: true, approve: true },
    'Güvenlik': { views: ['dashboard','security'], create: true, approve: true },
    'Personel': { views: ['dashboard','leave','expenses','advances','documents'], create: true, approve: false },
    'Sadece görüntüleme': { views: allViews.filter(v => v !== 'users' && v !== 'attendance' && v !== 'security' && v !== 'lostfound'), create: false, approve: false }
  };
  const LOST_DEPARTMENTS = ['MİSAFİR İLİŞKİLERİ','KAT HİZMETLERİ'];
  const normDept = value => String(value || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
  // Güvenlik ve Kayıp Eşya modülleri: rol + departman bazlı özel erişim
  function securityAccess() {
    const u = currentUser() || {};
    const dept = normDept(u.department);
    return {
      admin: u.role === 'Sistem yöneticisi',
      hr: u.role === 'İK yöneticisi' || dept === 'İNSAN KAYNAKLARI',
      security: u.role === 'Güvenlik',
      lostDept: LOST_DEPARTMENTS.includes(dept)
    };
  }
  window.__ikSecurityAccess = securityAccess;
  const canSeeSecurity = () => { const a = securityAccess(); return a.admin || a.hr || a.security; };
  const canSeeLostFound = () => { const a = securityAccess(); return a.admin || a.hr || a.lostDept; };

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
    if (view === 'security') return canSeeSecurity();
    if (view === 'lostfound') return canSeeLostFound();
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
