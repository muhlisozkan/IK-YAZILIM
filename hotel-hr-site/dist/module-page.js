const params = new URLSearchParams(location.search);
const slug = params.get('m') || 'employees';
const current = window.HMS_MODULES?.find(item => item.id === slug) || window.HMS_MODULES?.[1];
if (current) {
  document.title = `${current.title} | HMS People`;
  document.querySelector('[data-module-no]').textContent = `${current.no} · ${current.category}`;
  document.querySelector('[data-module-title]').textContent = current.title;
  document.querySelector('[data-module-headline]').textContent = current.headline;
  document.querySelector('[data-module-intro]').textContent = current.intro;
  document.querySelector('[data-module-visual]').innerHTML = `<div class="module-shot-head"><span>HMS People · ${current.title}</span><i></i><i></i><i></i></div><div class="module-shot-body">${window.HMS_VISUAL(current.visual)}</div>`;
  document.querySelector('[data-module-bullets]').innerHTML = current.bullets.map((item,index) => `<article><span>0${index+1}</span><b>${item}</b></article>`).join('');
  const index = window.HMS_MODULES.indexOf(current);
  const prev = window.HMS_MODULES[(index - 1 + window.HMS_MODULES.length) % window.HMS_MODULES.length];
  const next = window.HMS_MODULES[(index + 1) % window.HMS_MODULES.length];
  document.querySelector('[data-prev]').href = `module.html?m=${prev.id}`;
  document.querySelector('[data-prev]').innerHTML = `<small>Önceki modül</small><b>← ${prev.title}</b>`;
  document.querySelector('[data-next]').href = `module.html?m=${next.id}`;
  document.querySelector('[data-next]').innerHTML = `<small>Sonraki modül</small><b>${next.title} →</b>`;
}
