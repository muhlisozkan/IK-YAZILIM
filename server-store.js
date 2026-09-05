(function(){
  const sharedKeys=new Set(['ik_approval_routes','ik_users','ik_documents','ik_candidates','ik_performance','ik_training']);
  const rawGet=Storage.prototype.getItem,rawSet=Storage.prototype.setItem;
  const meaningful=raw=>{
    if(raw==null)return false;
    try{const value=JSON.parse(raw);if(Array.isArray(value))return value.length>0;if(value&&typeof value==='object')return Object.keys(value).length>0;return value!==''&&value!=null}catch{return raw!==''}
  };
  const syncPut=(key,raw)=>{
    const request=new XMLHttpRequest();
    request.open('PUT',`/api/shared-data/${encodeURIComponent(key)}`,false);
    request.setRequestHeader('Content-Type','application/json');
    request.send(JSON.stringify({value:JSON.parse(raw)}));
    return request.status>=200&&request.status<300;
  };
  try{
    const request=new XMLHttpRequest();
    request.open('GET','/api/shared-data',false);
    request.send();
    if(request.status>=200&&request.status<300){
      const remote=JSON.parse(request.responseText||'{}');
      sharedKeys.forEach(key=>{
        const local=rawGet.call(localStorage,key);
        if(Object.prototype.hasOwnProperty.call(remote,key)){
          const serverValue=JSON.stringify(remote[key]);
          if(!meaningful(serverValue)&&meaningful(local))syncPut(key,local);
          else rawSet.call(localStorage,key,serverValue);
        }else if(meaningful(local))syncPut(key,local);
      });
    }
  }catch(error){console.error('Ortak veri yüklenemedi',error)}
  const queues=new Map();
  Storage.prototype.setItem=function(key,value){
    const previousRaw=this===localStorage?rawGet.call(this,key):null;
    rawSet.call(this,key,value);
    if(this!==localStorage||!sharedKeys.has(key)||previousRaw===String(value))return;
    let parsed;try{parsed=JSON.parse(value)}catch{return}
    const previous=queues.get(key)||Promise.resolve();
    const next=previous.catch(()=>{}).then(()=>fetch(`/api/shared-data/${encodeURIComponent(key)}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:parsed}),keepalive:true}).then(response=>{if(!response.ok)throw new Error('Ortak kayıt sunucuya yazılamadı')}));
    queues.set(key,next);
    next.catch(error=>{console.error(error);if(typeof toast==='function')toast('Kayıt sunucuya yazılamadı')});
  };
  const clientId=sessionStorage.getItem("ik_client_id")||(globalThis.crypto?.randomUUID?.()||String(Date.now())+Math.random());
  sessionStorage.setItem("ik_client_id",clientId);
  const originalFetch=window.fetch.bind(window);
  window.fetch=function(input,options){
    const url=typeof input==="string"?input:(input&&input.url)||"";
    if(url.startsWith("/api/")||url.startsWith(location.origin+"/api/")){
      options=Object.assign({},options||{});
      const headers=new Headers(options.headers||(typeof Request!=="undefined"&&input instanceof Request?input.headers:undefined));
      headers.set("X-IK-Client",clientId);
      options.headers=headers;
    }
    return originalFetch(input,options);
  };
  let knownRevision=null,refreshing=false;
  const canRefresh=()=>!document.querySelector(".modal")&&!(document.activeElement&&document.activeElement.matches("input,select,textarea"));
  const refreshFromServer=()=>{
    if(refreshing||!canRefresh())return false;
    refreshing=true;
    Promise.resolve(window.__ikRefreshFromServer?.()).catch(error=>console.error("Veriler yenilenemedi",error)).finally(()=>{refreshing=false});
    return true;
  };
  const pollChanges=async()=>{
    if(!window.__ikAuthUser||document.hidden||refreshing)return;
    try{
      const response=await originalFetch("/api/sync-version",{cache:"no-store"});
      if(response.status===401){location.reload();return}
      if(!response.ok)return;
      const update=await response.json();
      if(knownRevision===null){knownRevision=update.revision;return}
      if(update.revision!==knownRevision){
        if(update.source===clientId)knownRevision=update.revision;
        else if(refreshFromServer())knownRevision=update.revision;else return;
      }
    }catch(error){console.error("Canlı veri kontrolü yapılamadı",error)}
  };
  setInterval(pollChanges,2000);
  setTimeout(pollChanges,400);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)pollChanges()});
})();
