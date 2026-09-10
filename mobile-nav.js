// Mobil/tablet: sol menüyü üst çubuktaki düğmeyle açılan bir çekmeceye dönüştürür.
// Geniş ekranda düğme gizli (CSS), davranış tamamen pasif kalır.
(function () {
  function init() {
    var topbar = document.querySelector('.topbar');
    var sidebar = document.querySelector('.sidebar');
    if (!topbar || !sidebar || document.querySelector('.nav-toggle')) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nav-toggle';
    btn.setAttribute('aria-label', 'Menü');
    btn.setAttribute('aria-expanded', 'false');
    btn.textContent = '☰'; // ☰

    var backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    document.body.appendChild(backdrop);

    function open() {
      document.body.classList.add('nav-open');
      btn.textContent = '✕'; // ✕
      btn.setAttribute('aria-expanded', 'true');
    }
    function close() {
      document.body.classList.remove('nav-open');
      btn.textContent = '☰';
      btn.setAttribute('aria-expanded', 'false');
    }
    function toggle() {
      if (document.body.classList.contains('nav-open')) close();
      else open();
    }

    btn.addEventListener('click', toggle);
    backdrop.addEventListener('click', close);
    sidebar.addEventListener('click', function (e) {
      if (e.target.closest('.nav-item')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) close();
    });

    topbar.insertBefore(btn, topbar.firstChild);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
