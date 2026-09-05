// Menü tıklamalarını tek bir noktadan yönetir; sayfa önbelleğinde eski script kalsa bile gezinme çalışır.
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    if (typeof state === 'undefined' || typeof shell !== 'function') return;
    state.view = button.dataset.view;
    shell();
  });
});
