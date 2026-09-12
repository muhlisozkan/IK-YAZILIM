// Menü tıklamalarını tek bir noktadan yönetir; sayfa önbelleğinde eski script kalsa bile gezinme çalışır.
document.querySelectorAll('.nav-item').forEach(button => {
  // Grup başlıkları (▾) yalnızca kendi onclick'iyle açılır/kapanır — burada state.view
  // değiştirip shell() çağırırsak her tıklamada senkron fonksiyonu "open" sınıfını
  // hemen geri ekliyor ve menü asla kapanamıyordu.
  if (button.classList.contains('nav-group-toggle')) return;
  button.addEventListener('click', () => {
    if (typeof state === 'undefined' || typeof shell !== 'function') return;
    state.view = button.dataset.view;
    shell();
  });
});
