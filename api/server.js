import express from 'express';
import sql from 'mssql';
import pg from 'pg';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://ik:ik@db:5432/ik' });
const app = express();
app.use(express.json({ limit: '5mb' }));
app.disable('etag');
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
});
const appDir = path.dirname(fileURLToPath(import.meta.url));

const expenseStatuses = new Set(['Bekliyor', 'Onaylandı', 'Reddedildi', 'Ödendi']);
const advanceStatuses = new Set(['Bekliyor', 'Onaylandı', 'Reddedildi', 'Ödendi', 'Mahsup Edildi']);
const clean = value => String(value ?? '').trim();
const amount = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value)) ? clean(value) : null;
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const attendanceTypes = new Set(['normal', 'fazla']);
const sharedDataKeys = new Set(['ik_leaves','ik_approval_routes','ik_users','ik_documents','ik_candidates','ik_performance','ik_training']);
const attendanceNormalValues = new Set(['A','B','C','D','E','F','M','AB','G','Y','O','Ü','Ö','ÇRT','ÇRT.','RT','RT.','ÇHT','DV','UZ','R.','R']);
const attendanceOvertimeValues = new Set(['0.5','1','1.5','2','2.5','3']);
const istanbulDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const dateDistance = (later, earlier) => Math.floor((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000);

async function forceSignatureMerges(buffer, signatureRow) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const file = zip.file(sheetPath);
  if (!file) return Buffer.from(buffer);
  let xml = await file.async('string');
  const mergeBlock = xml.match(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/);
  const refs = mergeBlock ? [...mergeBlock[0].matchAll(/<mergeCell ref="([^"]+)"\s*\/>/g)].map(match => match[1]) : [];
  const kept = refs.filter(ref => {
    const match = ref.match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
    if (!match) return true;
    const firstRow = Number(match[1]);
    const lastRow = Number(match[2]);
    if (firstRow <= signatureRow + 4 && lastRow >= signatureRow) return false;
    if (firstRow >= 9 && lastRow < signatureRow) return false;
    return true;
  });
  for (let row = 9; row < signatureRow; row += 2) {
    for (const column of ['A', 'B', 'C', 'AJ', 'AK', 'AL']) kept.push(`${column}${row}:${column}${row + 1}`);
  }
  kept.push(`A${signatureRow}:M${signatureRow + 4}`, `N${signatureRow}:AL${signatureRow + 4}`);
  const replacement = `<mergeCells count="${kept.length}">${kept.map(ref => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
  if (mergeBlock) xml = xml.replace(mergeBlock[0], replacement);
  else xml = xml.replace('</worksheet>', `${replacement}</worksheet>`);
  zip.file(sheetPath, xml);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
const payrollConfigured = () => ['BORDRO_SQL_SERVER', 'BORDRO_SQL_DATABASE', 'BORDRO_SQL_USER', 'BORDRO_SQL_PASSWORD'].every(key => clean(process.env[key]));

function payrollConfig() {
  return {
    server: process.env.BORDRO_SQL_SERVER,
    port: Number(process.env.BORDRO_SQL_PORT || 1433),
    database: process.env.BORDRO_SQL_DATABASE,
    user: process.env.BORDRO_SQL_USER,
    password: process.env.BORDRO_SQL_PASSWORD,
    requestTimeout: 120000,
    options: { encrypt: false, trustServerCertificate: true },
    pool: { max: 1, min: 0, idleTimeoutMillis: 10000 }
  };
}

async function readPayrollRows() {
  if (!payrollConfigured()) {
    const error = new Error('Bordro bağlantı ayarları bulunamadı');
    error.status = 503;
    throw error;
  }
  const sourcePool = await new sql.ConnectionPool(payrollConfig()).connect();
  try {
    const result = await sourcePool.request().query(`
      WITH period_counts AS (
        SELECT [Bordro Yılı] AS payroll_year, [Bordro Ay] AS payroll_month,
               COUNT(DISTINCT NULLIF(LTRIM(RTRIM(SICIL)), '')) AS employee_count
        FROM dbo.ARY_001_PER_ISTATISTIK
        WHERE [Bordro Yılı] IS NOT NULL AND [Bordro Ay] IS NOT NULL
        GROUP BY [Bordro Yılı], [Bordro Ay]
      ), ordered_periods AS (
        SELECT *, ROW_NUMBER() OVER (ORDER BY payroll_year DESC, payroll_month DESC) AS period_rank
        FROM period_counts
      ), latest_period AS (
        SELECT payroll_year, payroll_month
        FROM ordered_periods
        WHERE period_rank = CASE
          WHEN COALESCE((SELECT employee_count FROM ordered_periods WHERE period_rank=2),0)=0 THEN 1
          WHEN (SELECT employee_count FROM ordered_periods WHERE period_rank=1) >=
               (SELECT employee_count FROM ordered_periods WHERE period_rank=2) * 0.50 THEN 1
          ELSE 2
        END
      ), cost_centers AS (
        SELECT d.[Bordro Yılı] AS payroll_year,
               d.[Bordro Ay] AS payroll_month,
               NULLIF(LTRIM(RTRIM(d.[Sicil No])), '') AS payroll_sicil,
               MAX(NULLIF(LTRIM(RTRIM(d.[Masraf Merkezi])), '')) AS cost_center
        FROM dbo.ARY_001_DETAY_PUANTAJ d
        INNER JOIN latest_period lp ON lp.payroll_year=d.[Bordro Yılı] AND lp.payroll_month=d.[Bordro Ay]
        GROUP BY d.[Bordro Yılı], d.[Bordro Ay], NULLIF(LTRIM(RTRIM(d.[Sicil No])), '')
      )
      SELECT
        p.*,
        p.[Bordro Yılı] AS payroll_year,
        p.[Bordro Ay] AS payroll_month,
        NULLIF(LTRIM(RTRIM(p.SICIL)), '') AS payroll_sicil,
        NULLIF(LTRIM(RTRIM(p.[ADI SOYADI])), '') AS name,
        NULLIF(LTRIM(RTRIM(p.[BÖLÜM])), '') AS department,
        NULLIF(LTRIM(RTRIM(p.[BİRİM])), '') AS unit,
        NULLIF(LTRIM(RTRIM(p.ISYERI_AD)), '') AS workplace,
        NULLIF(LTRIM(RTRIM(p.UNVAN)), '') AS title,
        cc.cost_center,
        CAST(p.[İŞE GİRİŞ TARİHİ] AS date) AS start_date,
        NULLIF(LTRIM(RTRIM(p.[ÇALIŞMA_STATUSU])), '') AS payroll_status
      FROM dbo.ARY_001_PER_ISTATISTIK p
      INNER JOIN latest_period lp ON lp.payroll_year = p.[Bordro Yılı] AND lp.payroll_month = p.[Bordro Ay]
      LEFT JOIN cost_centers cc ON cc.payroll_year=p.[Bordro Yılı] AND cc.payroll_month=p.[Bordro Ay]
        AND cc.payroll_sicil=NULLIF(LTRIM(RTRIM(p.SICIL)), '')
      WHERE NULLIF(LTRIM(RTRIM(p.SICIL)), '') IS NOT NULL
      ORDER BY p.SICIL;
    `);
    const currentSicils = [...new Set(result.recordset.map(row => clean(row.payroll_sicil)).filter(Boolean))];
    const currentIdentities = [...new Set(result.recordset.map(row => clean(row['TC KİMLİK'])).filter(Boolean))];
    const bindList = (request, prefix, values) => values.map((value, index) => {
      const name = `${prefix}${index}`;
      request.input(name, sql.NVarChar(64), value);
      return `@${name}`;
    }).join(',');
    const exitRequest = sourcePool.request();
    const sicilParameters = bindList(exitRequest, 'sicil', currentSicils);
    const exits = currentSicils.length ? await exitRequest.query(`
      SELECT NULLIF(LTRIM(RTRIM(SICIL)), '') AS payroll_sicil,
             MAX(CAST([İŞTEN_ÇIKIŞ_TARİHİ] AS date)) AS exit_date
      FROM dbo.ARY_001_PER_ISTATISTIK
      WHERE NULLIF(LTRIM(RTRIM(SICIL)), '') IN (${sicilParameters})
      GROUP BY NULLIF(LTRIM(RTRIM(SICIL)), '')
    `) : { recordset: [] };
    const historyRequest = sourcePool.request();
    const identityParameters = bindList(historyRequest, 'identity', currentIdentities);
    const fallbackSicilParameters = bindList(historyRequest, 'historySicil', currentSicils);
    const historyFilter = [
      currentIdentities.length ? `NULLIF(LTRIM(RTRIM([TC KİMLİK])), '') IN (${identityParameters})` : '',
      currentSicils.length ? `NULLIF(LTRIM(RTRIM(SICIL)), '') IN (${fallbackSicilParameters})` : ''
    ].filter(Boolean).join(' OR ');
    const history = historyFilter ? await historyRequest.query(`
      SELECT NULLIF(LTRIM(RTRIM(SICIL)), '') AS payroll_sicil,
             NULLIF(LTRIM(RTRIM([TC KİMLİK])), '') AS employee_identity,
             CAST([İŞE GİRİŞ TARİHİ] AS date) AS start_date,
             MAX(CAST([İŞTEN_ÇIKIŞ_TARİHİ] AS date)) AS termination_date
      FROM dbo.ARY_001_PER_ISTATISTIK
      WHERE (${historyFilter})
        AND [İŞE GİRİŞ TARİHİ] IS NOT NULL
      GROUP BY NULLIF(LTRIM(RTRIM(SICIL)), ''), NULLIF(LTRIM(RTRIM([TC KİMLİK])), ''), CAST([İŞE GİRİŞ TARİHİ] AS date)
      ORDER BY payroll_sicil, start_date
    `) : { recordset: [] };
    return { rows: result.recordset, exits: exits.recordset, history: history.recordset };
  } finally {
    await sourcePool.close();
  }
}

const sourceStatus = value => clean(value).toLocaleUpperCase('tr-TR') === 'ÇALIŞAN' ? 'Aktif' : 'Pasif';
const dayDifference = (later, earlier) => {
  const end = new Date(later);
  const start = new Date(earlier);
  if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return null;
  return Math.floor((Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()) - Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) / 86400000);
};
const sourceDepartment = row => {
  const base = clean(row.department);
  const normalizedBase = base.toLocaleUpperCase('tr-TR');
  const center = clean(row.cost_center || row['Masraf Merkezi'] || row['MASRAF MERKEZİ'] || row['MASRAF MERKEZI']);
  const title = clean(row.title);
  const text = `${center} ${title}`.toLocaleUpperCase('tr-TR');
  if (normalizedBase === 'YİYECEK İÇECEK') {
    return text.includes('BAR') ? 'Yiyecek İçecek - Bar' : 'Yiyecek İçecek - Restaurant';
  }
  if (normalizedBase === 'TEKNİK SERVİS') {
    if (text.includes('HAVUZ')) return 'Teknik Havuz';
    const maintenanceTerms = ['BAKIM', 'ELEKTRİK', 'ELEKTRONİK', 'SOĞUTMA', 'TESİSAT', 'SIHHİ', 'MARANGOZ', 'BOYACI', 'METAL', 'MUTFAK EKİPMAN', 'ENERJİ', 'İNŞAAT'];
    if (text.includes('TEKNİK BAKIM ONARIM') || maintenanceTerms.some(term => text.includes(term))) return 'Teknik Bakım Onarım';
    return 'Teknik Servis';
  }
  return base;
};

const cookieValue = (req, name) => {
  const match = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
};
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex');
async function authenticatedUser(req) {
  const token = cookieValue(req, 'ik_session');
  if (!token) return null;
  const result = await pool.query(`
    select u.id,u.username,u.email,u.display_name as name,u.role,u.employee_id,u.department
    from auth_sessions s join app_users u on u.id=s.user_id
    where s.token_hash=$1 and s.expires_at>now() and u.status='Aktif'`, [tokenHash(token)]);
  return result.rows[0] || null;
}

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const username = clean(req.body?.username);
  const password = String(req.body?.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur' });
  const result = await pool.query(`
    select id,username,email,display_name as name,role,employee_id,department
    from app_users
    where lower(username)=lower($1) and status='Aktif' and password_hash=crypt($2,password_hash)`, [username, password]);
  if (!result.rowCount) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  const user = result.rows[0], token = crypto.randomBytes(32).toString('hex');
  await pool.query("delete from auth_sessions where expires_at<=now()");
  await pool.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '12 hours')", [tokenHash(token), user.id]);
  res.setHeader('Set-Cookie', `ik_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`);
  res.json(user);
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  const user = await authenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
  res.json(user);
}));

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  const token = cookieValue(req, 'ik_session');
  if (token) await pool.query('delete from auth_sessions where token_hash=$1', [tokenHash(token)]);
  res.setHeader('Set-Cookie', 'ik_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.status(204).end();
}));

app.use('/api', asyncRoute(async (req, res, next) => {
  if (req.path === '/health') return next();
  const user = await authenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
  req.user = user;
  next();
}));

let dataRevision = Date.now();
let dataChangeSource = "";

app.get("/api/sync-version", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ revision: dataRevision, source: dataChangeSource });
});

app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const source = clean(req.headers["x-ik-client"]);
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        dataRevision += 1;
        dataChangeSource = source;
      }
    });
  }
  next();
});


const accountRoles = new Set(['Sistem yöneticisi','İK yöneticisi','Departman yöneticisi','Mali İşler','Bordro yetkilisi','Personel','Sadece görüntüleme']);
const requireSystemAdmin = (req, res) => {
  if (req.user?.role !== 'Sistem yöneticisi') {
    res.status(403).json({ error: 'Bu işlem için sistem yöneticisi yetkisi gerekiyor' });
    return false;
  }
  return true;
};
const publicUserColumns = 'id,username,email,display_name as name,role,status,employee_id,department,created_at,updated_at';

app.patch('/api/auth/password', asyncRoute(async (req, res) => {
  const currentPassword = String(req.body?.current_password || '');
  const newPassword = String(req.body?.new_password || '');
  if (!currentPassword || newPassword.length < 8) return res.status(400).json({ error: 'Mevcut şifre ve en az 8 karakterlik yeni şifre zorunludur' });
  const verified = await pool.query('select id from app_users where id=$1 and password_hash=crypt($2,password_hash)', [req.user.id, currentPassword]);
  if (!verified.rowCount) return res.status(403).json({ error: 'Mevcut şifre hatalı' });
  await pool.query("update app_users set password_hash=crypt($2,gen_salt('bf',12)),updated_at=now() where id=$1", [req.user.id, newPassword]);
  const currentToken = cookieValue(req, 'ik_session');
  await pool.query('delete from auth_sessions where user_id=$1 and token_hash<>$2', [req.user.id, tokenHash(currentToken)]);
  res.json({ ok: true });
}));

app.get('/api/users', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const result = await pool.query('select ' + publicUserColumns + ' from app_users order by display_name,username');
  res.json(result.rows);
}));

app.post('/api/users', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const username = clean(req.body?.username), email = clean(req.body?.email), name = clean(req.body?.name);
  const password = String(req.body?.password || ''), role = clean(req.body?.role), status = clean(req.body?.status) || 'Aktif';
  const department = clean(req.body?.department), employeeId = req.body?.employee_id ? Number(req.body.employee_id) : null;
  if (username.length < 3 || /\s/.test(username) || !name || password.length < 8 || !accountRoles.has(role) || !['Aktif','Pasif'].includes(status)) {
    return res.status(400).json({ error: 'Kullanıcı bilgilerini ve en az 8 karakterlik şifreyi kontrol edin' });
  }
  if (employeeId !== null && (!Number.isInteger(employeeId) || employeeId <= 0)) return res.status(400).json({ error: 'Geçersiz personel bağlantısı' });
  const duplicate = await pool.query('select 1 from app_users where lower(username)=lower($1)', [username]);
  if (duplicate.rowCount) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
  const result = await pool.query(`insert into app_users(username,email,password_hash,display_name,role,status,employee_id,department)
    values($1,$2,crypt($3,gen_salt('bf',12)),$4,$5,$6,$7,$8) returning ${publicUserColumns}`,
    [username,email,password,name,role,status,employeeId,department]);
  res.status(201).json(result.rows[0]);
}));

app.put('/api/users/:id', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const id = Number(req.params.id), username = clean(req.body?.username), email = clean(req.body?.email), name = clean(req.body?.name);
  const password = String(req.body?.password || ''), role = clean(req.body?.role), status = clean(req.body?.status);
  const department = clean(req.body?.department), employeeId = req.body?.employee_id ? Number(req.body.employee_id) : null;
  if (!Number.isInteger(id) || username.length < 3 || /\s/.test(username) || !name || (password && password.length < 8) || !accountRoles.has(role) || !['Aktif','Pasif'].includes(status)) {
    return res.status(400).json({ error: 'Kullanıcı bilgilerini kontrol edin' });
  }
  if (id === Number(req.user.id) && status !== 'Aktif') return res.status(400).json({ error: 'Kendi hesabınızı pasif yapamazsınız' });
  const duplicate = await pool.query('select 1 from app_users where lower(username)=lower($1) and id<>$2', [username,id]);
  if (duplicate.rowCount) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
  const result = await pool.query(`update app_users set username=$2,email=$3,display_name=$4,role=$5,status=$6,employee_id=$7,department=$8,
    password_hash=case when $9='' then password_hash else crypt($9,gen_salt('bf',12)) end,updated_at=now()
    where id=$1 returning ${publicUserColumns}`, [id,username,email,name,role,status,employeeId,department,password]);
  if (!result.rowCount) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.json(result.rows[0]);
}));

app.delete('/api/users/:id', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const id = Number(req.params.id);
  if (id === Number(req.user.id)) return res.status(400).json({ error: 'Oturum açtığınız hesabı silemezsiniz' });
  const result = await pool.query('delete from app_users where id=$1', [id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.status(204).end();
}));

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('select 1');
  res.json({ ok: true });
}));

app.get('/api/shared-data', asyncRoute(async (_req, res) => {
  const result = await pool.query('select data_key,value from shared_app_data order by data_key');
  res.json(Object.fromEntries(result.rows.map(row => [row.data_key, row.value])));
}));

app.put('/api/shared-data/:key', asyncRoute(async (req, res) => {
  const key = clean(req.params.key);
  if (!sharedDataKeys.has(key)) return res.status(404).json({ error: 'Geçersiz ortak veri alanı' });
  const value = req.body?.value;
  if (value == null || typeof value !== 'object') return res.status(400).json({ error: 'Geçerli JSON verisi zorunludur' });
  const result = await pool.query(`
    insert into shared_app_data(data_key,value) values($1,$2::jsonb)
    on conflict(data_key) do update set value=excluded.value,updated_at=now()
    returning data_key,value,updated_at`, [key, JSON.stringify(value)]);
  res.json(result.rows[0]);
}));

app.get('/api/attendance', asyncRoute(async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(clean(req.query.month)) ? clean(req.query.month) : null;
  if (!month) return res.status(400).json({ error: 'Geçerli bir puantaj ayı zorunludur' });
  const result = await pool.query(`
    select employee_id, to_char(work_date,'YYYY-MM-DD') as work_date, work_type, value
    from attendance_entries
    where work_date >= ($1 || '-01')::date
      and work_date < (($1 || '-01')::date + interval '1 month')
    order by employee_id, work_date, work_type`, [month]);
  const attendance = {};
  for (const row of result.rows) {
    const day = Number(row.work_date.slice(8, 10));
    attendance[`${month}-${row.employee_id}-${day}-${row.work_type}`] = row.value;
  }
  res.json(attendance);
}));

app.put('/api/attendance', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const employeeId = Number(body.employee_id);
  const workDate = dateOnly(body.work_date);
  const workType = clean(body.work_type);
  const value = clean(body.value);
  if (!Number.isInteger(employeeId) || employeeId <= 0 || !workDate || !attendanceTypes.has(workType)) {
    return res.status(400).json({ error: 'Geçersiz puantaj kaydı' });
  }
  if (value && !(workType === 'normal' ? attendanceNormalValues : attendanceOvertimeValues).has(value)) {
    return res.status(400).json({ error: 'Geçersiz puantaj değeri' });
  }
  const actorRole = clean(body.actor_role);
  const actorDepartment = clean(body.actor_department);
  const unrestricted = ['Sistem yöneticisi', 'İK yöneticisi'].includes(actorRole) || actorDepartment === 'İnsan Kaynakları';
  const today = istanbulDate();
  if (!unrestricted && (workDate.slice(0, 7) !== today.slice(0, 7) || dateDistance(today, workDate) > 2)) {
    return res.status(403).json({ error: 'Bu tarih için puantaj düzeltme süresi doldu' });
  }
  const employee = await pool.query('select id from employees where id=$1', [employeeId]);
  if (!employee.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  if (!value) {
    await pool.query('delete from attendance_entries where employee_id=$1 and work_date=$2 and work_type=$3', [employeeId, workDate, workType]);
    return res.status(204).end();
  }
  const result = await pool.query(`
    insert into attendance_entries(employee_id,work_date,work_type,value,updated_by)
    values($1,$2,$3,$4,$5)
    on conflict(employee_id,work_date,work_type) do update set
      value=excluded.value, updated_by=excluded.updated_by, updated_at=now()
    returning employee_id,to_char(work_date,'YYYY-MM-DD') as work_date,work_type,value,updated_at`,
  [employeeId, workDate, workType, value, clean(body.actor_name) || actorRole || null]);
  res.json(result.rows[0]);
}));


app.get('/api/shifts', asyncRoute(async (req, res) => {
  const start = dateOnly(req.query.start);
  const end = dateOnly(req.query.end);
  if (!start || !end || dateDistance(end, start) < 0 || dateDistance(end, start) > 31) {
    return res.status(400).json({ error: 'Geçerli vardiya tarih aralığı zorunludur' });
  }
  const result = await pool.query(`
    select a.employee_id, e.name as employee, to_char(a.work_date,'YYYY-MM-DD') as date, a.value as type
    from attendance_entries a
    join employees e on e.id=a.employee_id
    where a.work_type='normal' and a.work_date between $1 and $2
    order by e.name,a.work_date`, [start, end]);
  res.json(result.rows);
}));

app.put('/api/shifts', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const employeeId = Number(body.employee_id);
  const workDate = dateOnly(body.work_date);
  const shiftType = clean(body.shift_type);
  if (!Number.isInteger(employeeId) || employeeId <= 0 || !workDate || (shiftType && !attendanceNormalValues.has(shiftType))) {
    return res.status(400).json({ error: 'Geçersiz vardiya kaydı' });
  }
  const today = istanbulDate();
  const offset = dateDistance(workDate, today);
  if (offset < -1 || offset > 14) return res.status(403).json({ error: 'Bu tarih vardiya planlama aralığı dışında' });
  const employee = await pool.query('select id from employees where id=$1', [employeeId]);
  if (!employee.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  if (!shiftType) {
    await pool.query("delete from attendance_entries where employee_id=$1 and work_date=$2 and work_type='normal'", [employeeId, workDate]);
    return res.status(204).end();
  }
  const result = await pool.query(`
    insert into attendance_entries(employee_id,work_date,work_type,value,updated_by)
    values($1,$2,'normal',$3,$4)
    on conflict(employee_id,work_date,work_type) do update set
      value=excluded.value,updated_by=excluded.updated_by,updated_at=now()
    returning employee_id,to_char(work_date,'YYYY-MM-DD') as date,value as type,updated_at`,
  [employeeId, workDate, shiftType, clean(body.actor_name) || null]);
  res.json(result.rows[0]);
}));

app.post('/api/attendance-report', asyncRoute(async (req, res) => {
  const department = clean(req.body?.department);
  const month = /^\d{4}-\d{2}$/.test(clean(req.body?.month)) ? clean(req.body.month) : '2026-08';
  const employees = Array.isArray(req.body?.employees) ? req.body.employees : [];
  const attendance = req.body?.attendance && typeof req.body.attendance === 'object' ? req.body.attendance : {};
  const template = department ? 'KAT HİZMETLERİ-2026-08.xlsx' : 'TümBölümler-2026-08.xlsx';
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(appDir, 'templates', template));
  const sheet = workbook.getWorksheet('AYLIK');
  if (!sheet) return res.status(500).json({ error: 'Şablon sayfası bulunamadı' });
  sheet.getCell('A5').value = `BÖLÜM ADI: ${department || 'TümBölümler'}`;
  sheet.getCell('X5').value = `PUANTAJ AYI/YILI: ${month.slice(5) === '08' ? 'AĞUSTOS' : month}`;
  const list = employees.slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'tr'));
  const colLetter = number => { let value = ''; while (number) { const remainder = (number - 1) % 26; value = String.fromCharCode(65 + remainder) + value; number = Math.floor((number - 1) / 26); } return value; };
  let footerRow = sheet.rowCount + 1;
  sheet.eachRow((row, number) => {
    if (String(row.getCell(1).value || '').startsWith('Departman Müdürünün')) footerRow = Math.min(footerRow, number);
  });
  const capacity = Math.floor((footerRow - 9) / 2);
  const rowsToRemove = Math.max(0, (capacity - list.length) * 2);
  if (rowsToRemove) sheet.spliceRows(9 + list.length * 2, rowsToRemove);
  for (let index = 0; index < list.length; index++) {
    const row = 9 + index * 2;
    const normal = sheet.getRow(row), extra = sheet.getRow(row + 1);
    for (let column = 1; column <= 35; column++) {
      normal.getCell(column).value = '';
      extra.getCell(column).value = '';
    }
    const employee = list[index];
    if (!employee) continue;
    normal.getCell(1).value = index + 1;
    normal.getCell(2).value = employee.payroll_sicil || employee.sicil || '';
    normal.getCell(3).value = employee.name || '';
    normal.getCell(4).value = 'N.M.';
    extra.getCell(4).value = 'F.M.';
    const overtimeCells = Array.from({ length: 31 }, (_, index) => `IFERROR(VALUE(SUBSTITUTE(${colLetter(5 + index)}${row + 1},".",",")),0)`).join(',');
    normal.getCell(36).value = { formula: `SUM(${overtimeCells})` };
    for (let day = 1; day <= 31; day++) {
      const normalKey = `${month}-${employee.id}-${day}-normal`;
      const extraKey = `${month}-${employee.id}-${day}-fazla`;
      const normalCell = normal.getCell(4 + day), extraCell = extra.getCell(4 + day);
      normalCell.numFmt = '@'; extraCell.numFmt = '@';
      normalCell.value = attendance[normalKey] == null || attendance[normalKey] === '' ? '' : String(attendance[normalKey]);
      const extraValue = attendance[extraKey];
      extraCell.value = extraValue == null || extraValue === '' ? '' : String(extraValue);
    }
  }
  let explanationEnd = 0;
  sheet.eachRow((row, number) => row.eachCell(cell => {
    const value = String(cell.value || '').trim();
    if (/^(A|B|C|D|E|F|M|G|O|Y|Ü|Ö|AB|ÇRT|RT|DV|R|T|ÇHT):$/.test(value)) explanationEnd = Math.max(explanationEnd, number);
  }));
  let signatureRow = 0;
  if (explanationEnd) {
    signatureRow = 9 + list.length * 2;
    sheet.spliceRows(signatureRow + 3, 0, [], []);
    explanationEnd += 2;
    sheet.spliceRows(signatureRow + 5, 0, [], []);
    explanationEnd += 2;
    // ExcelJS keeps template merges after spliceRows; remove every merge
    // intersecting the new signature rows before creating the two signature blocks.
    const mergeRefs = Object.keys(sheet._merges || {});
    for (const ref of mergeRefs) {
      const match = String(ref).match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
      if (match && Number(match[1]) <= signatureRow + 4 && Number(match[2]) >= signatureRow) {
        try { sheet.unMergeCells(ref); } catch {}
        // Keep the merge registry clean even when the template contains
        // overlapping ranges left behind by row deletion.
        try { delete sheet._merges[ref]; } catch {}
      }
    }
    try {
      sheet.model.merges = (sheet.model.merges || []).filter(ref => {
        const match = String(ref).match(/^[A-Z]+(\d+):[A-Z]+(\d+)$/);
        return !(match && Number(match[1]) <= signatureRow + 4 && Number(match[2]) >= signatureRow);
      });
    } catch {}
    // Match the supplied workbook: labels sit at the two split points and
    // the following three rows remain open for handwritten signatures.
    for (let rowNumber = signatureRow; rowNumber <= signatureRow + 4; rowNumber++) {
      for (let column = 1; column <= 39; column++) sheet.getRow(rowNumber).getCell(column).value = '';
    }
    const borderLine = { style: 'thin', color: { argb: 'FF000000' } };
    for (let rowNumber = signatureRow; rowNumber <= signatureRow + 4; rowNumber++) {
      for (const column of [1, 13, 14, 38]) {
        const cell = sheet.getRow(rowNumber).getCell(column);
        const side = column === 1 || column === 14 ? 'left' : 'right';
        cell.border = { ...cell.border, [side]: borderLine };
      }
    }
    for (let column = 1; column <= 38; column++) {
      const cell = sheet.getRow(signatureRow + 4).getCell(column);
      cell.border = { ...cell.border, bottom: borderLine };
    }
    sheet.getCell(`A${signatureRow}`).value = 'Departman Müdürünün İsmi / İmzası :';
    sheet.getCell(`N${signatureRow}`).value = 'İnsan Kaynakları Müdürü:';
  }
  if (explanationEnd) {
    for (let number = explanationEnd + 1; number <= sheet.rowCount; number++) {
      const row = sheet.getRow(number);
      row.hidden = true;
      row.eachCell({ includeEmpty: true }, cell => { cell.value = ''; });
    }
  }
  if (explanationEnd) sheet.pageSetup.printArea = `A1:AY${explanationEnd}`;
  const rawOutput = await workbook.xlsx.writeBuffer();
  const output = signatureRow ? await forceSignatureMerges(rawOutput, signatureRow) : Buffer.from(rawOutput);
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`puantaj-${department || 'tum-departmanlar'}-${month}.xlsx`)}` });
  res.send(Buffer.from(output));
}));

app.get('/api/employees', asyncRoute(async (_req, res) => res.json((await pool.query(`
  select e.*,
    e.payroll_details->>'TC KİMLİK' as tc_kimlik,
    e.payroll_details->>'KAN GRUBU' as kan_grubu,
    e.payroll_details->>'CİNSİYET' as cinsiyet
  from employees e order by e.id`)).rows)));
app.get('/api/employees/:id/payroll-details', asyncRoute(async (req, res) => {
  const result = await pool.query('select id,name,payroll_sicil,payroll_details,source_synced_at from employees where id=$1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  res.json(result.rows[0]);
}));
app.post('/api/employees', asyncRoute(async (req, res) => {
  const e = req.body;
  const result = await pool.query('insert into employees(name,email,department,title,start_date,salary,status) values($1,$2,$3,$4,$5,$6,$7) returning *', [e.name, e.email || '', e.department, e.title || '', e.start, e.salary || 0, e.status || 'Aktif']);
  res.status(201).json(result.rows[0]);
}));
app.put('/api/employees/:id', asyncRoute(async (req, res) => {
  const e = req.body;
  const result = await pool.query('update employees set name=$1,email=$2,department=$3,title=$4,start_date=$5,salary=$6,status=$7 where id=$8 returning *', [e.name, e.email || '', e.department, e.title || '', e.start, e.salary || 0, e.status || 'Aktif', req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  res.json(result.rows[0]);
}));
app.delete('/api/employees/:id', asyncRoute(async (req, res) => {
  await pool.query('delete from employees where id=$1', [req.params.id]);
  res.status(204).end();
}));

app.get('/api/departments', asyncRoute(async (_req, res) => {
  const result = await pool.query(`
    select d.*, count(e.id)::int as employee_count
    from departments d
    left join employees e on e.department=d.name and e.workplace=d.workplace and e.unit=d.unit
    group by d.id
    order by d.name, d.workplace, d.unit`);
  res.json(result.rows);
}));

app.get('/api/payroll-sync/status', asyncRoute(async (_req, res) => {
  const last = await pool.query(`select max(source_synced_at) as synced_at, count(*) filter (where source='Bordro')::int as synced_employees from employees`);
  res.json({ configured: payrollConfigured(), synced_at: last.rows[0].synced_at, synced_employees: last.rows[0].synced_employees });
}));

app.post('/api/payroll-sync', asyncRoute(async (_req, res) => {
  const source = await readPayrollRows();
  const records = source.rows;
  const exitDates = new Map(source.exits.map(row => [clean(row.payroll_sicil), row.exit_date]));
  const employmentHistory = new Map();
  for (const period of source.history || []) {
    const sicil = clean(period.payroll_sicil);
    const historyKey = clean(period.employee_identity) || `sicil:${sicil}`;
    if (!employmentHistory.has(historyKey)) employmentHistory.set(historyKey, []);
    employmentHistory.get(historyKey).push(period);
  }
  const valid = records.filter(row => clean(row.name) && row.start_date);
  if (!valid.length) return res.status(422).json({ error: 'Bordro kaynağında eşitlenecek personel bulunamadı' });

  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const period of source.history || []) {
      await client.query(`
        insert into employee_employment_periods(payroll_sicil,employee_identity,start_date,termination_date,source,source_synced_at)
        values($1,$2,$3,$4,'Bordro',now())
        on conflict(payroll_sicil,start_date) do update set
          employee_identity=excluded.employee_identity,
          termination_date=excluded.termination_date,
          source='Bordro',
          source_synced_at=now()`,
      [clean(period.payroll_sicil), clean(period.employee_identity) || null, period.start_date, period.termination_date || null]);
    }
    for (const row of valid) {
      const department = sourceDepartment(row) || clean(row.unit) || 'Atanmamış';
      const workplace = clean(row.workplace);
      const unit = clean(row.unit);
      await client.query(`
        insert into departments(name, workplace, unit, source, source_synced_at)
        values($1,$2,$3,'Bordro',now())
        on conflict(name, workplace, unit) do update set source='Bordro', source_synced_at=excluded.source_synced_at`,
      [department, workplace, unit]);
      const payrollSicil = clean(row.payroll_sicil);
      const historyKey = clean(row['TC KİMLİK']) || `sicil:${payrollSicil}`;
      const sourceExitDate = row['İŞTEN_ÇIKIŞ_TARİHİ'] || exitDates.get(payrollSicil) || null;
      const terminationDate = sourceStatus(row.payroll_status) === 'Aktif' ? null : sourceExitDate;
      const currentStart = new Date(row.start_date);
      const previousPeriod = (employmentHistory.get(historyKey) || [])
        .filter(period => period.termination_date && new Date(period.termination_date) < currentStart)
        .sort((a, b) => new Date(b.termination_date) - new Date(a.termination_date))[0];
      const previousTerminationDate = previousPeriod?.termination_date || null;
      const employmentGapDays = previousTerminationDate ? dayDifference(row.start_date, previousTerminationDate) : null;
      const leaveSeniorityExempt = employmentGapDays !== null && employmentGapDays >= 10;
      await client.query(`
        insert into employees(name,email,department,title,start_date,salary,status,payroll_sicil,workplace,unit,source,source_synced_at,payroll_details,termination_date,leave_seniority_exempt,employment_gap_days,previous_termination_date)
        values($1,'',$2,$3,$4,0,$5,$6,$7,$8,'Bordro',now(),$9::jsonb,$10,$11,$12,$13)
        on conflict(payroll_sicil) where payroll_sicil is not null do update set
          name=excluded.name,
          department=excluded.department,
          title=excluded.title,
          start_date=excluded.start_date,
          status=excluded.status,
          workplace=excluded.workplace,
          unit=excluded.unit,
          source='Bordro',
          source_synced_at=now(),
          payroll_details=excluded.payroll_details,
          termination_date=excluded.termination_date,
          leave_seniority_exempt=excluded.leave_seniority_exempt,
          employment_gap_days=excluded.employment_gap_days,
          previous_termination_date=excluded.previous_termination_date`,
      [clean(row.name), department, clean(row.title), row.start_date, sourceStatus(row.payroll_status), payrollSicil, workplace, unit, JSON.stringify(row), terminationDate, leaveSeniorityExempt, employmentGapDays, previousTerminationDate]);
    }
    // Eksik/henüz oluşmakta olan Bordro döneminde görünmeyen personeli pasife
    // çekme. Pasiflik yalnızca kaynak satırındaki açık çalışma durumu ve çıkış
    // bilgisi üzerinden güncellenir.
    // Yeni sicil verilmiş olsa da 0-9 günlük aralar kıdemi kesmez. Önce her
    // personelin son yeniden girişinden önceki çıkışını bul, sonra kesintisiz
    // dönem zincirini geriye doğru takip ederek gerçek kıdem başlangıcını yaz.
    await client.query(`
      with previous_period as (
        select e.id, p.termination_date,
               (e.start_date - p.termination_date)::int as gap_days
        from employees e
        left join lateral (
          select ep.termination_date
          from employee_employment_periods ep
          where coalesce(ep.employee_identity, 'sicil:' || ep.payroll_sicil) =
                coalesce(nullif(e.payroll_details->>'TC KİMLİK',''), 'sicil:' || e.payroll_sicil)
            and ep.start_date < e.start_date
            and ep.termination_date <= e.start_date
          order by ep.termination_date desc
          limit 1
        ) p on true
        where e.source='Bordro'
      )
      update employees e
      set previous_termination_date=p.termination_date,
          employment_gap_days=p.gap_days,
          leave_seniority_exempt=coalesce(p.gap_days >= 10,false)
      from previous_period p
      where e.id=p.id`);
    await client.query(`
      with recursive continuous_service as (
        select e.id,
               coalesce(nullif(e.payroll_details->>'TC KİMLİK',''), 'sicil:' || e.payroll_sicil) as identity_key,
               e.start_date as chain_start
        from employees e
        where e.source='Bordro'
        union all
        select c.id, c.identity_key, p.start_date
        from continuous_service c
        join lateral (
          select ep.start_date, ep.termination_date
          from employee_employment_periods ep
          where coalesce(ep.employee_identity, 'sicil:' || ep.payroll_sicil)=c.identity_key
            and ep.start_date < c.chain_start
            and ep.termination_date <= c.chain_start
          order by ep.termination_date desc
          limit 1
        ) p on (c.chain_start - p.termination_date) between 0 and 9
      ), seniority as (
        select id, min(chain_start) as seniority_start_date
        from continuous_service
        group by id
      )
      update employees e
      set seniority_start_date=s.seniority_start_date
      from seniority s
      where e.id=s.id`);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  const period = valid[0];
  const exemptions = await pool.query('select count(*)::int as count from employees where leave_seniority_exempt=true');
  res.json({ ok: true, payroll_year: period.payroll_year, payroll_month: period.payroll_month, employees: valid.length, departments: new Set(valid.map(row => `${clean(row.department) || clean(row.unit) || 'Atanmamış'}|${clean(row.workplace)}|${clean(row.unit)}`)).size, leave_seniority_exempt: exemptions.rows[0].count });
}));

app.get('/api/expenses', asyncRoute(async (_req, res) => res.json((await pool.query('select * from expenses order by expense_date desc, id desc')).rows)));
app.post('/api/expenses', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!clean(body.employee_name) || !amount(body.amount) || !dateOnly(body.expense_date) || !clean(body.category)) return res.status(400).json({ error: 'Çalışan, kategori, tarih ve pozitif tutar zorunludur' });
  const result = await pool.query(`insert into expenses(employee_id,employee_name,category,expense_date,amount,currency,description,receipt_no,status,current_approver)
    values($1,$2,$3,$4,$5,$6,$7,$8,'Bekliyor',$9) returning *`, [body.employee_id || null, clean(body.employee_name), clean(body.category), dateOnly(body.expense_date), amount(body.amount), clean(body.currency) || 'TRY', clean(body.description), clean(body.receipt_no), clean(body.current_approver) || 'Finans yöneticisi']);
  res.status(201).json(result.rows[0]);
}));
app.patch('/api/expenses/:id/status', asyncRoute(async (req, res) => {
  const status = clean(req.body.status);
  if (!expenseStatuses.has(status)) return res.status(400).json({ error: 'Geçersiz durum' });
  const result = await pool.query('update expenses set status=$1,current_approver=$2,updated_at=now() where id=$3 returning *', [status, clean(req.body.current_approver) || null, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Masraf bulunamadı' });
  res.json(result.rows[0]);
}));
app.delete('/api/expenses/:id', asyncRoute(async (req, res) => {
  const result = await pool.query("delete from expenses where id=$1 and status='Bekliyor'", [req.params.id]);
  if (!result.rowCount) return res.status(409).json({ error: 'Yalnızca bekleyen masraf silinebilir' });
  res.status(204).end();
}));

app.get('/api/advances', asyncRoute(async (_req, res) => res.json((await pool.query('select * from advances order by requested_date desc, id desc')).rows)));
app.post('/api/advances', asyncRoute(async (req, res) => {
  const body = req.body;
  if (!body.employee_id || !amount(body.amount) || !dateOnly(body.requested_date)) return res.status(400).json({ error: 'Çalışan, tarih ve pozitif tutar zorunludur' });
  const employee = await pool.query('select id,name,department from employees where id=$1 and status=$2', [body.employee_id, 'Aktif']);
  if (!employee.rowCount) return res.status(404).json({ error: 'Aktif çalışan bulunamadı' });
  const person = employee.rows[0];
  const result = await pool.query(`insert into advances(
      employee_id,employee_name,department,requester_user_id,requester_user_name,requested_date,amount,currency,deduction_month,reason,status,approval_stage,current_approver)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Onay Sürecinde','department','Departman Müdürü') returning *`,
  [person.id, person.name, person.department, clean(body.requester_user_id) || null, clean(body.requester_user_name) || person.name,
    dateOnly(body.requested_date), amount(body.amount), clean(body.currency) || 'TRY', dateOnly(body.deduction_month), clean(body.reason)]);
  res.status(201).json(result.rows[0]);
}));
app.patch('/api/advances/:id/decision', asyncRoute(async (req, res) => {
  const decision = clean(req.body.decision).toLowerCase();
  const actorRole = clean(req.body.actor_role);
  const actorName = clean(req.body.actor_name) || actorRole;
  const actorDepartment = clean(req.body.actor_department);
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'Geçersiz karar' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const found = await client.query('select * from advances where id=$1 for update', [req.params.id]);
    if (!found.rowCount) { await client.query('rollback'); return res.status(404).json({ error: 'Avans bulunamadı' }); }
    const advance = found.rows[0];
    if (advance.status !== 'Onay Sürecinde') { await client.query('rollback'); return res.status(409).json({ error: 'Bu talep artık onay sürecinde değil' }); }
    const isAdmin = actorRole === 'Sistem yöneticisi';
    const allowed = advance.approval_stage === 'department'
      ? isAdmin || (actorRole === 'Departman yöneticisi' && actorDepartment === advance.department)
      : advance.approval_stage === 'hr'
        ? isAdmin || actorRole === 'İK yöneticisi'
        : advance.approval_stage === 'finance'
          ? isAdmin || ['Mali İşler', 'Bordro yetkilisi'].includes(actorRole)
          : false;
    if (!allowed) { await client.query('rollback'); return res.status(403).json({ error: 'Bu onay adımı için yetkiniz yok' }); }
    let result;
    if (decision === 'reject') {
      result = await client.query(`update advances set status='Reddedildi',approval_stage='rejected',current_approver=null,
        rejected_by=$1,rejected_at=now(),rejection_reason=$2,updated_at=now() where id=$3 returning *`,
      [actorName, clean(req.body.reason), req.params.id]);
    } else if (advance.approval_stage === 'department') {
      result = await client.query(`update advances set approval_stage='hr',current_approver='İnsan Kaynakları',
        department_approved_by=$1,department_approved_at=now(),updated_at=now() where id=$2 returning *`, [actorName, req.params.id]);
    } else if (advance.approval_stage === 'hr') {
      result = await client.query(`update advances set approval_stage='finance',current_approver='Mali İşler',
        hr_approved_by=$1,hr_approved_at=now(),updated_at=now() where id=$2 returning *`, [actorName, req.params.id]);
    } else {
      result = await client.query(`update advances set status='Onaylandı',approval_stage='approved',current_approver=null,
        finance_approved_by=$1,finance_approved_at=now(),updated_at=now() where id=$2 returning *`, [actorName, req.params.id]);
    }
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally { client.release(); }
}));
app.get('/api/advances/:id/form', asyncRoute(async (req, res) => {
  const result = await pool.query('select * from advances where id=$1', [req.params.id]);
  if (!result.rowCount) return res.status(404).send('Avans bulunamadı');
  const advance = result.rows[0];
  if (advance.status !== 'Onaylandı') return res.status(409).send('Avans formu yalnızca tüm onaylar tamamlandıktan sonra alınabilir');
  const html = value => clean(value).replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]));
  const formatDate = value => value ? new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '-';
  res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Onaylı Avans Formu #${advance.id}</title><style>
    body{font-family:Arial,sans-serif;color:#17233b;margin:32px}.form{max-width:850px;margin:auto;border:2px solid #17233b;padding:28px}h1{text-align:center;font-size:22px;margin:0 0 24px}.approved{text-align:center;color:#14845d;font-weight:700;margin-bottom:22px}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #8992a3}.cell{padding:12px;border-right:1px solid #8992a3;border-bottom:1px solid #8992a3}.cell:nth-child(even){border-right:0}.wide{grid-column:1/-1;border-right:0}.label{font-size:11px;color:#667085;display:block;margin-bottom:5px}.approvals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px}.sign{border:1px solid #8992a3;min-height:105px;padding:12px}.sign strong{display:block;margin-bottom:12px}.actions{text-align:center;margin-top:22px}@media print{.actions{display:none}body{margin:0}.form{border:1px solid #000}}
  </style></head><body><div class="form"><h1>ONAYLI PERSONEL AVANS FORMU</h1><div class="approved">✓ ONAYLANDI</div><div class="grid">
    <div class="cell"><span class="label">Form No</span>${advance.id}</div><div class="cell"><span class="label">Talep Tarihi</span>${formatDate(advance.requested_date)}</div>
    <div class="cell"><span class="label">Personel</span>${html(advance.employee_name)}</div><div class="cell"><span class="label">Departman</span>${html(advance.department)}</div>
    <div class="cell"><span class="label">Avans Tutarı</span>${Number(advance.amount).toLocaleString('tr-TR',{style:'currency',currency:advance.currency||'TRY'})}</div><div class="cell"><span class="label">Mahsup Ayı</span>${formatDate(advance.deduction_month)}</div>
    <div class="cell wide"><span class="label">Talep Nedeni</span>${html(advance.reason) || '-'}</div></div>
    <div class="approvals"><div class="sign"><strong>Departman Müdürü</strong>${html(advance.department_approved_by)}<br>${formatDate(advance.department_approved_at)}</div>
    <div class="sign"><strong>İnsan Kaynakları</strong>${html(advance.hr_approved_by)}<br>${formatDate(advance.hr_approved_at)}</div>
    <div class="sign"><strong>Mali İşler</strong>${html(advance.finance_approved_by)}<br>${formatDate(advance.finance_approved_at)}</div></div>
    <div class="actions"><button onclick="window.print()">Yazdır / PDF</button></div></div></body></html>`);
}));
app.delete('/api/advances/:id', asyncRoute(async (req, res) => {
  const result = await pool.query("delete from advances where id=$1 and status='Onay Sürecinde' and approval_stage='department'", [req.params.id]);
  if (!result.rowCount) return res.status(409).json({ error: 'Yalnızca ilk onaya gönderilmiş talep silinebilir' });
  res.status(204).end();
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Sunucu hatası' });
});

app.listen(3000);
