import crypto from 'node:crypto';
export const normalizeMobilePhone=value=>{let d=String(value||'').replace(/\D/g,'');if(d.startsWith('0090'))d=d.slice(4);else if(d.length===12&&d.startsWith('90'))d=d.slice(2);else if(d.length===11&&d.startsWith('0'))d=d.slice(1);return d;};
export function validTc(tc){if(!/^[1-9]\d{10}$/.test(tc))return false;const n=[...tc].map(Number);return ((n[0]+n[2]+n[4]+n[6]+n[8])*7-(n[1]+n[3]+n[5]+n[7]))%10===n[9]&&n.slice(0,10).reduce((a,b)=>a+b,0)%10===n[10];}
export function installMobileAuth(app,{pool,asyncRoute,sendSms,secret}){
 const hash=value=>{if(!secret||secret.length<32)throw Object.assign(Error('Mobil giriş ayarları tamamlanmamış.'),{status:503});return crypto.createHmac('sha256',secret).update(String(value)).digest('hex');};
 const cookie=(token,age)=>`ik_mobile_session=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
 const tokenFrom=req=>String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ik_mobile_session='))?.slice('ik_mobile_session='.length)||'';
 const ip=req=>String(req.headers['cf-connecting-ip']||req.ip||req.socket.remoteAddress||'').slice(0,100);
 const message='Bilgileriniz aktif personel kaydınızla eşleşiyorsa doğrulama kodu kayıtlı telefonunuza gönderilir.';
 app.post('/api/mobile-auth/request',asyncRoute(async(req,res)=>{
  const tc=String(req.body?.tc||'').trim(),phone=normalizeMobilePhone(req.body?.phone);
  if(!validTc(tc)||!/^5\d{9}$/.test(phone))return res.status(400).json({error:'Bilgileriniz hatalıdır. Lütfen T.C. kimlik numaranızı ve kayıtlı telefon numaranızı kontrol edip tekrar deneyin.'});
  const identityHash=hash('tc:'+tc),phoneHash=hash('phone:'+phone),ipHash=hash('ip:'+ip(req));
  const id=crypto.randomUUID(),code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
  const client=await pool.connect();let person;
  try{
   await client.query('begin');
   // Short global lock protects rate-limit accounting across concurrent requests.
   await client.query('select pg_advisory_xact_lock(19260914)');
   await client.query("delete from mobile_login_challenges where created_at<now()-interval '24 hours'");
   await client.query('delete from mobile_sessions where expires_at<now()');
   const limits=(await client.query(`select count(*) filter(where phone_hash=$1 and created_at>now()-interval '15 minutes') as phone_count,
    count(*) filter(where ip_hash=$2 and created_at>now()-interval '15 minutes') as ip_count,
    count(*) filter(where created_at>now()-interval '1 hour') as total,
    count(*) filter(where phone_hash=$1 and created_at>now()-interval '60 seconds') as recent
    from mobile_login_challenges`,[phoneHash,ipHash])).rows[0];
   if(Number(limits.phone_count)>=3||Number(limits.ip_count)>=200||Number(limits.total)>=500||Number(limits.recent)>0){await client.query('rollback');res.setHeader('Retry-After','60');return res.status(429).json({error:'Çok sık kod istendi. Bir süre bekleyip tekrar deneyin.'});}
   const found=(await client.query("select id,phone from employees where status='Aktif' and trim(payroll_details->>'TC KİMLİK')=$1",[tc])).rows;
   // Ambiguous duplicate identity records must be corrected by HR.
   if(found.length===1&&normalizeMobilePhone(found[0].phone)===phone)person=found[0];
   if(person)await client.query('update mobile_login_challenges set consumed=true where phone_hash=$1 and consumed=false',[phoneHash]);
   await client.query('insert into mobile_login_challenges(id,employee_id,identity_hash,phone_hash,ip_hash,code_hash) values($1,$2,$3,$4,$5,$6)',[id,person?.id||null,identityHash,phoneHash,ipHash,hash(id+':'+code)]);
   await client.query('commit');
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
  // A generic mismatch message does not identify which field is wrong.
  if(!person)return res.status(400).json({error:'Bilgileriniz hatalıdır. Lütfen T.C. kimlik numaranızı ve kayıtlı telefon numaranızı kontrol edip tekrar deneyin.'});
  // Always send only to the registered employee phone.
  if(person){Promise.resolve().then(()=>sendSms(person.phone,`İK Yanımda giriş kodunuz: ${code}. 5 dakika geçerlidir. Bu kodu kimseyle paylaşmayın.`,'mobile-login',{sensitive:true})).then(result=>result.ok?pool.query('update mobile_login_challenges set sent=true where id=$1 and consumed=false',[id]):null).catch(()=>{});}

  return res.status(202).json({challenge_id:id,expires_in:300,retry_after:60,message});
 }));
 app.post('/api/mobile-auth/verify',asyncRoute(async(req,res)=>{
  const id=String(req.body?.challenge_id||''),code=String(req.body?.code||'');
  if(!/^[0-9a-f-]{36}$/i.test(id)||!/^\d{6}$/.test(code))return res.status(400).json({error:'Altı haneli doğrulama kodunu girin.'});
  const client=await pool.connect();
  const invalid=async()=>{await client.query('commit');return res.status(401).json({error:'Kod geçersiz veya süresi dolmuş. Yeni kod isteyin.'});};
  try{
   await client.query('begin');
   const c=(await client.query('select *,expires_at>now() as valid_time from mobile_login_challenges where id=$1 for update',[id])).rows[0];
   if(!c||!c.valid_time||c.consumed||c.attempts>=5||!c.sent)return await invalid();
   await client.query('update mobile_login_challenges set attempts=attempts+1 where id=$1',[id]);
   if(!crypto.timingSafeEqual(Buffer.from(c.code_hash,'hex'),Buffer.from(hash(id+':'+code),'hex')))return await invalid();
   const person=(await client.query("select id,name,phone,payroll_details->>'TC KİMLİK' as tc from employees where id=$1 and status='Aktif'",[c.employee_id])).rows[0];
   if(!person||hash('phone:'+normalizeMobilePhone(person.phone))!==c.phone_hash||hash('tc:'+String(person.tc||'').trim())!==c.identity_hash)return await invalid();
   const username='mobile.employee.'+person.id;
   let account=(await client.query('select id,status,role,employee_id from app_users where username=$1',[username])).rows[0];
   if(!account){account=(await client.query(`insert into app_users(username,password_hash,display_name,role,status,employee_id,department)
     values($1,crypt($2,gen_salt('bf',12)),$3,'Personel','Aktif',$4,'') returning id,status,role,employee_id`,[username,crypto.randomBytes(48).toString('hex'),person.name,person.id])).rows[0];}
   if(account.status!=='Aktif'||account.role!=='Personel'||Number(account.employee_id)!==Number(person.id))return await invalid();
   await client.query('update mobile_login_challenges set consumed=true where id=$1',[id]);
   const token=crypto.randomBytes(32).toString('hex');
   await client.query('insert into mobile_sessions(token_hash,user_id,employee_id,identity_hash,phone_hash) values($1,$2,$3,$4,$5)',[hash(token),account.id,person.id,c.identity_hash,c.phone_hash]);
   await client.query('commit');res.setHeader('Set-Cookie',cookie(token,43200));return res.json({ok:true});
  }catch(e){await client.query('rollback');throw e;}finally{client.release();}
 }));
 app.post('/api/mobile-auth/logout',asyncRoute(async(req,res)=>{const token=tokenFrom(req);if(token)await pool.query('delete from mobile_sessions where token_hash=$1',[hash(token)]);res.setHeader('Set-Cookie',cookie('',0));res.status(204).end();}));
 app.use(asyncRoute(async(req,res,next)=>{
  if(!req.path.startsWith('/api/mobile/'))return next();
  const token=tokenFrom(req);if(!/^[a-f0-9]{64}$/.test(token))return res.status(401).json({error:'Telefon doğrulamasıyla giriş yapın.'});
  const row=(await pool.query(`select u.id,u.username,e.name,u.employee_id,e.phone,e.payroll_details->>'TC KİMLİK' as tc,s.identity_hash,s.phone_hash
   from mobile_sessions s join app_users u on u.id=s.user_id join employees e on e.id=s.employee_id
   where s.token_hash=$1 and s.expires_at>now() and u.status='Aktif' and e.status='Aktif' and u.role='Personel' and u.employee_id=s.employee_id`,[hash(token)])).rows[0];
  if(!row||hash('tc:'+String(row.tc||'').trim())!==row.identity_hash||hash('phone:'+normalizeMobilePhone(row.phone))!==row.phone_hash)return res.status(401).json({error:'Oturumunuz sona erdi. Yeniden giriş yapın.'});
  req.mobileUser={id:row.id,username:row.username,name:row.name,employee_id:row.employee_id,role:'Personel',department:''};next();
 }));
}
