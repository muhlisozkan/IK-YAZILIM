// Spa Rezervasyon: iskelet modül — içerik sonradan doldurulacak (kullanıcı isteği 2026-09).
(function () {
  function render() {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'spa-reservations'));
    $('#page-title').textContent = 'Spa Rezervasyon';
    $('#app').innerHTML = `
      <div class="section-title"><div><h2>Spa Rezervasyon</h2><span class="muted">Bu modül hazırlanıyor</span></div></div>
      <div class="card empty">İçerik henüz eklenmedi — yakında.</div>`;
  }

  const baseShell = shell;
  shell = function () {
    if (state.view === 'spa-reservations') {
      if (window.__ikCan && !window.__ikCan('spa-reservations')) { state.view = 'dashboard'; baseShell(); return; }
      render();
    } else baseShell();
  };
})();
