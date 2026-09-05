(function(){
  const baseAttendance=attendance;
  attendance=function(){
    baseAttendance();
    const sync=()=>{const summary=document.querySelector('.section-title .muted'),next=document.querySelector('#att-next'); if(!next)return; const match=summary?.textContent.match(/Sayfa (\d+)\s*\/\s*(\d+)/), current=match?.[1]||'1', total=match?.[2]||String(Math.max(1,Math.ceil((state.employees||[]).length/25))); let indicator=document.querySelector('#att-page-indicator'); if(!indicator){indicator=document.createElement('span');indicator.id='att-page-indicator';indicator.className='muted';indicator.style.cssText='min-width:90px;text-align:center';next.parentNode.insertBefore(indicator,next)} const label=`Sayfa ${current} / ${total}`; if(indicator.textContent!==label) indicator.textContent=label};
    sync();
    new MutationObserver(sync).observe(document.querySelector('#app'),{childList:true,subtree:true});
  };
})();
