(function () {
  const userKey = 'ik_users';
  const sessionKey = 'ik_current_user_id';
  const allViews = ['dashboard','employees','departments','leave','reports','attendance','users','approval-matrix','smtp-settings','sms-settings','vehicle-definitions','shifts','documents','recruitment','performance','training','security','lostfound','survey'];
  const USERS_GROUP_VIEWS = ['users','approval-matrix','smtp-settings','sms-settings','vehicle-definitions'];
  const roleRules = {
    'Sistem yöneticisi': { views: allViews, create: true, approve: true },
    'İK yöneticisi': { views: allViews.filter(v => !USERS_GROUP_VIEWS.includes(v)), create: true, approve: true },
    'Departman yöneticisi': { views: ['dashboard','leave','reports','shifts','recruitment','performance','training'], create: true, approve: false },
    'Mali İşler': { views: ['dashboard','reports'], create: false, approve: true },
    'Finans yöneticisi': { views: ['dashboard','reports'], create: false, approve: true },
    'Genel müdür': { views: ['dashboard','leave','reports'], create: false, approve: true },
    'Genel müdür yardımcısı': { views: ['dashboard','leave','reports'], create: false, approve: true },
    'Bölge yöneticisi': { views: ['dashboard','leave','reports'], create: false, approve: true },
    'Bordro yetkilisi': { views: ['dashboard','reports','attendance'], create: true, approve: true },
    'Güvenlik': { views: ['dashboard','security'], create: true, approve: true },
    'Personel': { views: ['dashboard','leave','documents'], create: true, approve: false },
    'Sadece görüntüleme': { views: allViews.filter(v => !USERS_GROUP_VIEWS.includes(v) && v !== 'attendance' && v !== 'security' && v !== 'lostfound' && v !== 'survey'), create: false, approve: false }
  };
  const LOST_DEPARTMENTS = ['MİSAFİR İLİŞKİLERİ','KAT HİZMETLERİ'];
  const normDept = value => String(value || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
  // "Yeni Rol" oluşturucusuyla bir özel role tanımlı modül izin seviyesi (varsa).
  const customModuleLevel = view => { const r = rule(); return r.__custom ? (r.__custom[view] || null) : null; };
  window.__ikCustomModuleLevel = customModuleLevel;
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
  // "security"/"lostfound" bir role (ör. Güvenlik departmanındaki Departman yöneticisi) "Rolü
  // düzenle" ekranından ek modül olarak eklenmişse customModuleLevel de devreye girer — backend
  // hmsPerm() zaten aynı şekilde customRoleModuleLevel'i OR'luyor (api/server.js).
  const canSeeSecurity = () => { const a = securityAccess(); return a.admin || a.hr || a.security || Boolean(customModuleLevel('security')); };
  // Kayıp Eşya: yalnızca Sistem yöneticisi (tam) ve ilgili departmanlar (Misafir İlişkileri / Kat Hizmetleri). İK dahil değil.
  const canSeeLostFound = () => { const a = securityAccess(); return a.admin || a.lostDept || Boolean(customModuleLevel('lostfound')); };
  const canSeePerformance = () => { const a = securityAccess(); return a.admin || a.hr; };
  const canSeeGuncel = () => { const a = securityAccess(); return a.admin || a.hr; };
  // Yemekhane Menüsü: yalnızca Sistem yöneticisi ve Ana Mutfak departmanı görür/düzenler — İK dahil diğer herkesten kapalı.
  const canSeeCafeteriaMenu = () => { const u = currentUser() || {}; return u.role === 'Sistem yöneticisi' || normDept(u.department) === 'ANA MUTFAK'; };
  window.__ikCafeteriaAccess = canSeeCafeteriaMenu;
  // Kalite Yönetim Sistemi: İK + Kalite departmanı tam yetkili; üst yönetim salt-okunur.
  function kysAccess() {
    const u = currentUser() || {};
    if (u.role === 'İK yöneticisi' || normDept(u.department) === 'İNSAN KAYNAKLARI') return 'full';
    if (normDept(u.department).includes('KALİTE')) return 'full'; // "Eğitim ve Kalite" dahil
    if (['Genel müdür', 'Genel müdür yardımcısı', 'Bölge yöneticisi'].includes(u.role)) return 'read';
    if (u.role === 'Sistem yöneticisi') return 'full';
    // Özel rolde herhangi bir KYS alt modülü seçiliyse en az salt-okunur erişim ver.
    const levels = ['kys-eys','kys-dokuman','kys-dof','kys-hedefler','kys-ygg','kys-tedarikci','kys-kalibrasyon','kys-sikayet','kys-denetim','kys-haccp']
      .map(customModuleLevel).filter(Boolean);
    if (levels.some(lv => lv === 'write' || lv === 'full')) return 'full';
    if (levels.length) return 'read';
    return 'none';
  }
  window.__ikKysAccess = kysAccess;
  const canSeeKYS = () => kysAccess() !== 'none';
  // Doküman onaylama: yalnız İK yönetimi/admin (Kalite departmanı hazırlar, onaylamaz).
  window.__ikKysCanApproveDokuman = () => {
    const u = currentUser() || {};
    return u.role === 'Sistem yöneticisi' || u.role === 'İK yöneticisi' || normDept(u.department) === 'İNSAN KAYNAKLARI';
  };
  // Doküman Yönetimi: diğer KYS modüllerinden farklı olarak Departman yöneticisi de
  // erişebilir — yalnız görüntüleme + revizyon talebi (oluşturma/düzenleme/onay yok).
  window.__ikDokumanAccess = () => {
    const base = kysAccess();
    if (base !== 'none') return base;
    const u = currentUser() || {};
    if (u.role === 'Departman yöneticisi' && u.department) return 'dept';
    return 'none';
  };
  const canSeeDokuman = () => window.__ikDokumanAccess() !== 'none';
  // Entegre Yönetim Sistemi: salt-okunur doküman arşivi gezgini — yazma/onay
  // içermediğinden diğer KYS modüllerinin aksine TÜM departmanlara açık.
  const canSeeEys = () => true;
  window.__ikCanSeeEys = canSeeEys;
  window.__ikDokumanCanRequestRevision = () => ['full', 'dept'].includes(window.__ikDokumanAccess());
  // DÖF Takip: Kalite (İK/admin/Kalite departmanı) tam yetkili + tüm departmanları görür;
  // departman yöneticisi yalnız kendi departmanına açılmış DÖF'leri görür/aksiyon yazar.
  window.__ikDofAccess = () => {
    const u = currentUser() || {};
    if (u.role === 'Sistem yöneticisi' || u.role === 'İK yöneticisi' || normDept(u.department) === 'İNSAN KAYNAKLARI' || normDept(u.department).includes('KALİTE')) return { level: 'kalite' };
    if (['Genel müdür', 'Genel müdür yardımcısı', 'Bölge yöneticisi'].includes(u.role)) return { level: 'read' };
    if (u.role === 'Departman yöneticisi' && u.department) return { level: 'dept', dept: normDept(u.department) };
    const level = customModuleLevel('kys-dof');
    if (level === 'write' || level === 'full') return { level: 'kalite' };
    if (level) return { level: 'read' };
    return { level: 'none' };
  };
  const canSeeButce = () => {
    const u = currentUser() || {};
    return ['Sistem yöneticisi', 'İK yöneticisi', 'Genel müdür', 'Genel müdür yardımcısı', 'Bölge yöneticisi', 'Mali İşler', 'Finans yöneticisi', 'Departman yöneticisi'].includes(u.role)
      || normDept(u.department) === 'İNSAN KAYNAKLARI';
  };
  // Doğum Günleri: backend visibleDepartments ile aynı kapsam (şirket geneli + İK tümünü, departman yöneticisi ve Güvenlik yalnız kendi departmanını).
  const canSeeBirthdays = () => {
    const u = currentUser() || {};
    return ['Sistem yöneticisi', 'İK yöneticisi', 'Bordro yetkilisi', 'Mali İşler', 'Finans yöneticisi', 'Genel müdür', 'Genel müdür yardımcısı', 'Bölge yöneticisi', 'Sadece görüntüleme', 'Departman yöneticisi', 'Güvenlik'].includes(u.role)
      || normDept(u.department) === 'İNSAN KAYNAKLARI';
  };
  // Kullanıcı ve Yetkiler grubu: yalnızca Sistem yöneticisi (4 alt görünümün tamamı da yalnız admin'e açık).
  const canSeeUsersGroup = () => USERS_GROUP_VIEWS.some(v => rule().views.includes(v));

  function users() {
    return JSON.parse(localStorage.getItem(userKey) || 'null') || [{ id: 1, name: 'Sistem yöneticisi', email: 'admin@firma.com', role: 'Sistem yöneticisi', status: 'Aktif' }];
  }
  function currentUser() {
    if (window.__ikAuthUser) return { ...window.__ikAuthUser, status: 'Aktif' };
    const active = users().filter(user => user.status === 'Aktif');
    return active.find(user => String(user.id) === localStorage.getItem(sessionKey)) || active[0] || users()[0];
  }
  // "Yeni Rol" oluşturucusuyla eklenen, sunucudaki custom_roles tablosunda
  // saklanan modül bazlı roller (isim -> {views, create, approve, __custom}).
  let customRoles = {};
  async function loadCustomRoles() {
    try {
      const response = await fetch('/api/custom-roles');
      if (!response.ok) return;
      const list = await response.json();
      customRoles = {};
      list.forEach(r => {
        const perms = r.permissions || {};
        customRoles[r.name] = {
          views: Object.keys(perms),
          create: Object.values(perms).some(lv => lv === 'write' || lv === 'full'),
          approve: Object.values(perms).some(lv => lv === 'full'),
          __custom: perms
        };
      });
      window.__ikApplyPermissions?.();
    } catch {}
  }
  window.__ikReloadCustomRoles = loadCustomRoles;
  loadCustomRoles();
  function rule() {
    const user = currentUser();
    const base = roleRules[user?.role], custom = customRoles[user?.role];
    // Sabit bir rolün (ör. Departman yöneticisi) adıyla aynı isimde bir custom_roles satırı
    // varsa, bu "Rolü düzenle" ekranından o role sonradan eklenen EK modül izinleridir —
    // sabit rolün kendi görünümlerini eksiltmez, yalnız üstüne ekler (kullanıcı isteği 2026-09).
    if (base && custom) {
      return {
        views: [...new Set([...base.views, ...custom.views])],
        create: base.create || custom.create,
        approve: base.approve || custom.approve,
        __custom: custom.__custom,
        __hasBuiltin: true
      };
    }
    return base || custom || roleRules['Sadece görüntüleme'];
  }
  window.__ikCurrentUser = currentUser;
  window.__ikCurrentEmployee = function () {
    const user = currentUser();
    return (state.employees || []).find(employee => String(employee.id) === String(user?.employee_id))
      || (state.employees || []).find(employee => String(employee.name || '').toLocaleLowerCase('tr-TR') === String(user?.name || '').toLocaleLowerCase('tr-TR'))
      || null;
  };
  const KYS_GROUP_VIEWS = ['kys-eys','kys-dokuman','kys-dof','kys-hedefler','kys-ygg','kys-tedarikci','kys-kalibrasyon','kys-sikayet','kys-denetim','kys-haccp'];
  // "Yönetici" tiki: kullanıcı kartında işaretli değilse (is_manager===false) bu 3
  // modül, rolün izin verdiği durumlarda bile o kullanıcıda görünmez (kullanıcı isteği 2026-09).
  const MANAGER_GATED_VIEWS = new Set(['leave', 'personel-butcesi', 'recruitment']);
  window.__ikCan = function (view, action = 'view') {
    if (MANAGER_GATED_VIEWS.has(view) && currentUser()?.is_manager === false) return false;
    // "Yeni Rol" oluşturucusuyla tanımlanan özel roller, elle seçilen modül
    // listesiyle çalışır — Güvenlik/KYS/Kayıp Eşya gibi özel görünümlerin
    // altındaki sabit rol/departman kontrollerini atlayıp doğrudan seçilen
    // modüllere bakar (aksi halde bu görünümler admin modül seçse bile hiç
    // görünmezdi, çünkü aşağıdaki özel fonksiyonlar yalnız sabit rolleri bilir).
    const currentRule = rule();
    // Yalnızca SAF özel roller (sabit bir role karşılık gelmeyen) bu dar yoldan geçer —
    // sabit bir role (ör. Departman yöneticisi) sonradan eklenen ek modül izinleri
    // (__hasBuiltin) aşağıdaki zengin/özel-durumlu genel yoldan geçmeye devam eder,
    // yoksa kys-eys/personel-butcesi/doğum günleri gibi özel fonksiyonlarla açılan
    // görünümler overlay eklenince kaybolurdu.
    if (currentRule.__custom && !currentRule.__hasBuiltin) {
      if (view === 'kys-eys') return canSeeEys();
      if (view === 'kys-group') return true; // EYS (görüntüleme) her zaman erişilebilir
      if (view === 'users-group') return USERS_GROUP_VIEWS.some(v => currentRule.views.includes(v));
      // A La Carte alt sekmeleri (Restoranlar/Rezervasyonlar) tek bir 'alacarte'
      // modül iznine bağlı — sekmelerin kendi adı özel rolün views listesinde yok.
      // alacarte.js da yazma/onay kontrolü için doğrudan view='alacarte' ile çağırıyor.
      if (view === 'alacarte-group' || view === 'alacarte-restaurants' || view === 'alacarte-reservations' || view === 'alacarte') {
        if (!currentRule.views.includes('alacarte')) return false;
        if (action === 'view') return true;
        const level = currentRule.__custom['alacarte'];
        return action === 'approve' ? level === 'full' : (level === 'write' || level === 'full');
      }
      if (!currentRule.views.includes(view)) return false;
      if (action === 'view') return true;
      const level = currentRule.__custom[view];
      return action === 'approve' ? level === 'full' : (level === 'write' || level === 'full');
    }
    if (view === 'cafeteria-menu') return canSeeCafeteriaMenu();
    if (view === 'security') return canSeeSecurity();
    if (view === 'lostfound') return canSeeLostFound();
    if (view === 'performance') return canSeePerformance();
    if (view === 'guncel-tablo') return canSeeGuncel();
    if (view === 'personel-butcesi') return canSeeButce();
    if (view === 'birthdays') return canSeeBirthdays();
    // A La Carte Rezervasyon: diğer departmanlardan tamamen bağımsız, kapalı
    // devre bir Konsiyerj modülü — sol menüde "Restoranlar"/"Rezervasyonlar" alt
    // sekmeli bir grup. Her ikisi de tek bir 'alacarte' modül iznine bağlı;
    // yalnızca Sistem yöneticisi ve bu modül özellikle verilmiş özel roller görür.
    if (view === 'alacarte-group' || view === 'alacarte-restaurants' || view === 'alacarte-reservations' || view === 'alacarte') {
      const u = currentUser() || {};
      return u.role === 'Sistem yöneticisi';
    }
    // Spa Rezervasyon: iskelet modül — A La Carte ile aynı desen, yalnızca Sistem
    // yöneticisi ve bu modül özellikle verilmiş özel roller görür (kullanıcı isteği 2026-09).
    if (view === 'spa-reservations') {
      const u = currentUser() || {};
      return u.role === 'Sistem yöneticisi' || Boolean(customModuleLevel('spa-reservations'));
    }
    if (view === 'kys-dof') return window.__ikDofAccess().level !== 'none';
    if (view === 'kys-dokuman') return canSeeDokuman();
    if (view === 'kys-eys') return canSeeEys();
    // Grup başlığı: EYS artık herkese açık olduğundan grup başlığı da her zaman görünür.
    if (view === 'kys-group') return true;
    if (view === 'users-group') return canSeeUsersGroup();
    if (view.startsWith('kys-')) return canSeeKYS();
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
    // Güvenlik rolü/departmanındaki kullanıcılarda Genel Bakış en üstte, Güvenlik hemen
    // altında gösterilir (kullanıcı isteği 2026-09).
    const u = currentUser() || {};
    if (u.role === 'Güvenlik' || normDept(u.department) === 'GÜVENLİK') {
      const secItem = document.querySelector('.nav-item[data-view="security"]');
      const dashItem = document.querySelector('.nav-item[data-view="dashboard"]');
      if (secItem && dashItem && dashItem.parentElement === secItem.parentElement && secItem.previousElementSibling !== dashItem) {
        dashItem.parentElement.insertBefore(secItem, dashItem.nextSibling);
      }
    }
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
