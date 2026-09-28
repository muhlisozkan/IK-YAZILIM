const moduleGrid = document.querySelector('[data-module-grid]');
if (moduleGrid && window.HMS_MODULES) {
  moduleGrid.innerHTML = window.HMS_MODULES.map(module => `
    <a class="full-module-card" href="module.html?m=${module.id}">
      <div class="module-thumb" aria-hidden="true">${window.HMS_VISUAL(module.visual)}</div>
      <div class="module-card-copy"><span>${module.no} · ${module.category}</span><h2>${module.title}</h2><p>${module.summary}</p><em>Modülü incele →</em></div>
    </a>`).join('');
}
