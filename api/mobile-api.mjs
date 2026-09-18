// Mounted AFTER authentication and BEFORE the existing request routes.
// Employee-only surface: management roles never widen mobile data access.
export function installMobileApi(app, { pool, asyncRoute, annualBalanceRows, leaveDayBreakdown, istanbulDate, vapidPublicKey }) {
  const tables = { leaves: 'leave_requests' };
  const submitting = new Set();
  const pending = { leaves: 'Bekliyor' };
  const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  const daysBetween = (a,b) => (Date.parse(b)-Date.parse(a))/86400000;
  const mondayOf = dateStr => { const d=new Date(dateStr+'T12:00:00'); d.setDate(d.getDate()-(d.getDay()+6)%7); return d.toISOString().slice(0,10); };
  app.use(asyncRoute(async (req,res,next) => {
    if (!req.path.startsWith('/api/mobile/')) return next();
    if (!req.user) return res.status(401).json({error:'Oturum açmanız gerekiyor'});
    const employeeId = Number(req.user.employee_id);
    if (!Number.isInteger(employeeId) || employeeId <= 0) return res.status(403).json({error:'Hesabınız bir personel kaydıyla eşleştirilmemiş. İK biriminden kullanıcı hesabınızı personel kaydınıza bağlamasını isteyin.',code:'EMPLOYEE_LINK_REQUIRED'});
    const person = (await pool.query(`select id,name,email,department,title,workplace,payroll_sicil,
      to_char(start_date,'YYYY-MM-DD') as start_date, status
      from employees where id=$1 and status='Aktif'`,[employeeId])).rows[0];
    if (!person) return res.status(403).json({error:'Aktif personel kaydınız bulunamadı. İK birimiyle görüşün.'});
    const route = req.path.slice('/api/mobile'.length);
    if (req.method === 'GET' && route === '/me') return res.json({user:{name:req.user.name,username:req.user.username},employee:person});
    if (req.method === 'GET' && route === '/leave-usage') {
      const records=(await pool.query(`select to_char(start_date,'YYYY-MM-DD') as start_date,
        to_char(end_date,'YYYY-MM-DD') as end_date,used_days,week_rest_days,official_holiday_days
        from leave_usage_records where employee_id=$1 order by start_date desc nulls last,id desc`,[employeeId])).rows;
      return res.json({records,total_used:records.reduce((sum,row)=>sum+Number(row.used_days||0),0)});
    }
    if (req.method === 'GET' && route === '/balance') {
      const year=Number(req.query.year || istanbulDate().slice(0,4));
      if (!Number.isInteger(year)||year<2000||year>2100) return res.status(400).json({error:'Geçersiz yıl'});
      return res.json((await annualBalanceRows([person],year))[0]);
    }
    if (req.method === 'GET' && route === '/shifts') {
      const {start,end}=req.query;
      if (!validDate(start)||!validDate(end)||daysBetween(start,end)<0||daysBetween(start,end)>31) return res.status(400).json({error:'En fazla 31 günlük geçerli tarih aralığı seçin.'});
      return res.json((await pool.query(`select to_char(work_date,'YYYY-MM-DD') as date,shift_type as type,overtime from shift_plans where employee_id=$1 and work_date between $2 and $3 order by work_date`,[employeeId,start,end])).rows);
    }
    if (req.method === 'GET' && route === '/leave-max-end') {
      const {start}=req.query, leaveType=String(req.query.leave_type||'');
      if(!validDate(start)) return res.status(400).json({error:'Geçerli bir başlangıç tarihi seçin.'});
      const generalMaxDate=new Date(start+'T12:00:00'); generalMaxDate.setDate(generalMaxDate.getDate()+40);
      const generalMax=generalMaxDate.toISOString().slice(0,10);
      if(leaveType!=='Yıllık izin') return res.json({max_end:generalMax});
      const balanceRow=(await annualBalanceRows([person],Number(start.slice(0,4))))[0];
      const available=balanceRow?Number(balanceRow.available_days||0):0;
      let lastValid=start;
      if(available>0){
        for(let offset=0;offset<=40;offset++){
          const d=new Date(start+'T12:00:00'); d.setDate(d.getDate()+offset);
          const candidate=d.toISOString().slice(0,10);
          if(leaveDayBreakdown(start,candidate,[],true).days>available+0.01) break;
          lastValid=candidate;
        }
      }
      return res.json({max_end:lastValid,available});
    }
    if (req.method === 'GET' && route === '/leave-preview') {
      const {start,end,off}=req.query;
      if(!validDate(start)||!validDate(end)||daysBetween(start,end)<0||daysBetween(start,end)>40) return res.status(400).json({error:'En fazla 41 takvim günlük bir tarih aralığı seçin.'});
      const picker=leaveDayBreakdown(start,end,[],true).days>6;
      if(off && (!picker||!validDate(off)||off<start||off>end)) return res.status(400).json({error:'Haftalık izin gününü kontrol edin.'});
      return res.json({...leaveDayBreakdown(start,end,off?[off]:[],!picker),weekly_off_enabled:picker});
    }
    if (req.method === 'GET' && route === '/menu') {
      const thisMonday = mondayOf(istanbulDate());
      const rows = (await pool.query(`select data from kys_records where module='cafeteria_menu' order by data->>'week_start' desc limit 8`)).rows;
      const weeks = rows.map(r=>r.data).filter(d=>d && d.week_start >= thisMonday).sort((a,b)=>a.week_start.localeCompare(b.week_start)).slice(0,2);
      return res.json(weeks);
    }
    if (req.method === 'GET' && route === '/announcements') {
      const rows = (await pool.query(`select id,data,created_at from kys_records where module='announcement' order by created_at desc limit 50`)).rows;
      return res.json(rows.map(r=>({id:String(r.id),title:r.data?.title||'',body:r.data?.body||'',pinned:Boolean(r.data?.pinned),created_by_name:r.data?.created_by_name||'',created_at:r.created_at}))
        .sort((a,b)=>Number(b.pinned)-Number(a.pinned)||String(b.created_at).localeCompare(String(a.created_at))));
    }
    if (route === '/push/public-key' && req.method === 'GET') return res.json({key: vapidPublicKey || null});
    if (route === '/push/subscribe' && req.method === 'POST') {
      const sub = req.body?.subscription || req.body;
      const endpoint = String(sub?.endpoint||'');
      const p256dh = String(sub?.keys?.p256dh||'');
      const auth = String(sub?.keys?.auth||'');
      if (!/^https:\/\//.test(endpoint) || endpoint.length>2000 || !p256dh || !auth) return res.status(400).json({error:'Geçersiz bildirim aboneliği.'});
      await pool.query(`insert into push_subscriptions(employee_id,endpoint,p256dh,auth) values($1,$2,$3,$4)
        on conflict(endpoint) do update set employee_id=excluded.employee_id,p256dh=excluded.p256dh,auth=excluded.auth`,[employeeId,endpoint,p256dh,auth]);
      return res.status(204).end();
    }
    if (route === '/push/subscribe' && req.method === 'DELETE') {
      const endpoint = String(req.body?.endpoint||'');
      if (endpoint) await pool.query('delete from push_subscriptions where endpoint=$1 and employee_id=$2',[endpoint,employeeId]);
      return res.status(204).end();
    }
    const match=route.match(/^\/(leaves)(?:\/(\d+))?$/);
    if(!match) return res.status(404).json({error:'Mobil işlem bulunamadı'});
    const [,kind,id]=match, table=tables[kind];
    if(req.method==='GET'&&!id){
      const rows=(await pool.query(`select * from ${table} where employee_id=$1 order by id desc limit 500`,[employeeId])).rows;
      return res.json(rows.map(row=>({...row,can_approve:false,can_delete:row.status===pending[kind]&&Number(row.approval_step||0)===0})));
    }
    if(req.method==='DELETE'&&id){
      const result=await pool.query(`delete from ${table} where id=$1 and employee_id=$2 and status=$3 and coalesce(approval_step,0)=0 returning id`,[id,employeeId,pending[kind]]);
      return result.rowCount?res.status(204).end():res.status(409).json({error:'Talep bulunamadı veya ilk onay adımını geçtiği için geri çekilemiyor.'});
    }
    if(req.method!=='POST'||id) return res.status(405).json({error:'Bu mobil işleme izin verilmiyor'});
    if(submitting.has(employeeId))return res.status(409).json({error:'Önceki talebiniz işleniyor. Taleplerim ekranını kontrol edin.'});
    submitting.add(employeeId);
    const release=()=>submitting.delete(employeeId);
    res.once('finish',release);res.once('close',release);
    const b=req.body||{};
    if(b.employee_id!=null&&String(b.employee_id)!==String(employeeId)) return res.status(403).json({error:'Başka bir çalışan adına işlem yapamazsınız.'});
    if(!validDate(b.start_date)||!validDate(b.end_date)||b.start_date<istanbulDate()||daysBetween(b.start_date,b.end_date)<0||daysBetween(b.start_date,b.end_date)>40) return res.status(400).json({error:'İzin tarihlerini kontrol edin. Geçmiş tarihli talep oluşturulamaz.'});
    if(!['Yıllık izin','Mazeret izni','Ücretsiz izin','Hastalık izni'].includes(b.leave_type)) return res.status(400).json({error:'Geçerli bir izin türü seçin.'});
    if(b.weekly_off_dates && (!Array.isArray(b.weekly_off_dates)||b.weekly_off_dates.length>1||b.weekly_off_dates.some(d=>!validDate(d)||d<b.start_date||d>b.end_date))) return res.status(400).json({error:'Haftalık izin gününü kontrol edin.'});
    const overlap=await pool.query("select 1 from leave_requests where employee_id=$1 and status in ('Bekliyor','Onaylandı') and start_date<=$3 and end_date>=$2 limit 1",[employeeId,b.start_date,b.end_date]);
    if(overlap.rowCount) return res.status(409).json({error:'Bu tarihlerle çakışan bir izin talebiniz var.'});
    req.body={employee_id:employeeId,leave_type:b.leave_type,start_date:b.start_date,end_date:b.end_date,weekly_off_dates:b.weekly_off_dates||[]};
    // Reuse the established business rules, approval matrix and panel records.
    req.user={...req.user,role:'Personel',department:''};
    req.url='/api/leaves';
    return next();
  }));
}
