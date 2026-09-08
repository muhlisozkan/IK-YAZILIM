import express from 'express';
import sql from 'mssql';
import pg from 'pg';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import nodemailer from 'nodemailer';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://ik:ik@db:5432/ik' });
const app = express();
app.set('trust proxy', true); // nginx + Cloudflare Tunnel arkasında; gerçek istemci IP'si için
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
const emailAddress = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
const smtpSecretKey = () => {
  const material = clean(process.env.SMTP_SETTINGS_KEY);
  if (material.length < 32) {
    const error = new Error('SMTP şifreleme anahtarı sunucuda tanımlı değil');
    error.status = 503;
    throw error;
  }
  return crypto.createHash('sha256').update(material).digest();
};
const encryptSmtpSecret = value => {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', smtpSecretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join(':');
};
const decryptSmtpSecret = value => {
  if (!value) return '';
  const [version,iv,tag,encrypted] = String(value).split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('SMTP gizli bilgisi okunamadı');
  const decipher = crypto.createDecipheriv('aes-256-gcm',smtpSecretKey(),Buffer.from(iv,'base64'));
  decipher.setAuthTag(Buffer.from(tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted,'base64')),decipher.final()]).toString('utf8');
};
const asyncRoute = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const attendanceTypes = new Set(['normal', 'fazla']);
const sharedDataKeys = new Set(['ik_approval_routes','ik_users','ik_documents','ik_performance','ik_training']);
const attendanceNormalValues = new Set(['A','B','C','D','E','F','M','AB','G','Y','O','Ü','Ö','ÇRT','ÇRT.','RT','RT.','ÇHT','DV','UZ','R.','R']);
const attendanceOvertimeValues = new Set(['0.5','1','1.5','2','2.5','3']);
const istanbulDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const dateDistance = (later, earlier) => Math.floor((Date.parse(`${later}T00:00:00Z`) - Date.parse(`${earlier}T00:00:00Z`)) / 86400000);
const istanbulClock = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date());
  const part = type => Number(parts.find(item => item.type === type)?.value || 0);
  return { date: istanbulDate(), hour: part('hour'), minute: part('minute') };
};

// Vardiya <-> puantaj aynası. Etkileşimli düzenlemelerde son yazan kazanır.
async function mirrorShiftToAttendance(client, employeeId, workDate, workType, value, updatedBy, respectManual = false) {
  if (value) {
    await client.query(`
      insert into attendance_entries(employee_id,work_date,work_type,value,updated_by,source)
      values($1,$2,$3,$4,$5,'shift')
      on conflict(employee_id,work_date,work_type) do update set
        value=excluded.value, updated_by=excluded.updated_by, source='shift', updated_at=now()
      ${respectManual ? "where attendance_entries.source='shift'" : ''}`,
      [employeeId, workDate, workType, value, updatedBy || 'Vardiya planı']);
  } else {
    await client.query(
      "delete from attendance_entries where employee_id=$1 and work_date=$2 and work_type=$3 and source='shift'",
      [employeeId, workDate, workType]);
  }
}
async function mirrorAttendanceToShift(client, employeeId, workDate, workType, value, updatedBy) {
  const column = workType === 'fazla' ? 'overtime' : 'shift_type';
  const other = workType === 'fazla' ? 'shift_type' : 'overtime';
  const existing = await client.query('select shift_type,overtime from shift_plans where employee_id=$1 and work_date=$2', [employeeId, workDate]);
  const otherValue = existing.rows[0] ? existing.rows[0][other] : '';
  if (!value && !otherValue) {
    await client.query('delete from shift_plans where employee_id=$1 and work_date=$2', [employeeId, workDate]);
    return;
  }
  await client.query(`
    insert into shift_plans(employee_id,work_date,${column},updated_by,transferred_at,updated_at)
    values($1,$2,$3,$4,now(),now())
    on conflict(employee_id,work_date) do update set ${column}=$3,updated_by=$4,updated_at=now()`,
    [employeeId, workDate, value || '', updatedBy || 'Puantaj']);
}

async function transferShiftPlansForDate(workDate = istanbulDate()) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const plans = (await client.query('select employee_id,shift_type,overtime,updated_by from shift_plans where work_date=$1', [workDate])).rows;
    for (const plan of plans) {
      await mirrorShiftToAttendance(client, plan.employee_id, workDate, 'normal', clean(plan.shift_type), plan.updated_by || 'Otomatik vardiya aktarımı', true);
      await mirrorShiftToAttendance(client, plan.employee_id, workDate, 'fazla', clean(plan.overtime), plan.updated_by || 'Otomatik vardiya aktarımı', true);
    }
    await client.query('update shift_plans set transferred_at=now() where work_date=$1', [workDate]);
    await client.query('commit');
    return plans.length;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

let lastShiftTransferDate = '';
async function runShiftTransferIfDue() {
  const clock = istanbulClock();
  if (clock.hour < 17 || lastShiftTransferDate === clock.date) return;
  try {
    const count = await transferShiftPlansForDate(clock.date);
    lastShiftTransferDate = clock.date;
    console.log(`Vardiya aktarımı tamamlandı: ${clock.date}, ${count} puantaj kaydı`);
  } catch (error) {
    console.error('Günlük vardiya aktarımı başarısız', error);
  }
}

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

// Oturum çerezi. COOKIE_SECURE:
//   auto (varsayılan) → yalnızca istek HTTPS ise Secure eklenir (Cloudflare = HTTPS,
//                       düz http://ip:8080 erişiminde eklenmez, böylece çerez düşmez)
//   true  → her zaman Secure   |   false → hiçbir zaman Secure
const cookieSecureMode = clean(process.env.COOKIE_SECURE || 'auto').toLowerCase();
const requestIsHttps = req => {
  const proto = clean(req.headers['x-forwarded-proto']).split(',')[0].trim().toLowerCase();
  if (proto) return proto === 'https';
  try { return JSON.parse(req.headers['cf-visitor'] || '{}').scheme === 'https'; } catch { return false; }
};
const sessionCookie = (req, token, maxAgeSeconds) => {
  const secure = cookieSecureMode === 'true' || (cookieSecureMode !== 'false' && requestIsHttps(req));
  return `ik_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}` +
    (secure ? '; Secure' : '');
};

// Giriş için kaba kuvvet koruması (bellek içi). Tek süreçli API olduğu için
// harici bir depoya gerek yok; konteyner yeniden başlarsa sayaç sıfırlanır.
const LOGIN_MAX_ATTEMPTS = Math.max(1, Number(process.env.LOGIN_MAX_ATTEMPTS) || 5);
const LOGIN_LOCK_MS = Math.max(1, Number(process.env.LOGIN_LOCK_MINUTES) || 15) * 60000;
const loginAttempts = new Map(); // "kullanıcı|ip" -> { count, lockedUntil }
const requestIp = req =>
  clean(req.headers['cf-connecting-ip']) || clean(req.ip) || clean(req.socket?.remoteAddress) || 'bilinmiyor';
const loginKey = (username, ip) => `${String(username).toLowerCase()}|${ip}`;
function loginLockState(key) {
  const entry = loginAttempts.get(key);
  if (!entry || !entry.lockedUntil) return { locked: false };
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) { loginAttempts.delete(key); return { locked: false }; }
  return { locked: true, retryAfterSeconds: Math.ceil(remaining / 1000) };
}
function registerLoginFailure(key) {
  const entry = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCK_MS;
    entry.count = 0;
  }
  loginAttempts.set(key, entry);
}
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) {
    if ((!entry.lockedUntil || entry.lockedUntil <= now) && !entry.count) loginAttempts.delete(key);
    else if (entry.lockedUntil && entry.lockedUntil <= now) loginAttempts.delete(key);
  }
}, 300000).unref();

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
  const key = loginKey(username, requestIp(req));
  const lock = loginLockState(key);
  if (lock.locked) {
    res.setHeader('Retry-After', String(lock.retryAfterSeconds));
    return res.status(429).json({ error: `Çok fazla hatalı giriş denemesi. ${Math.ceil(lock.retryAfterSeconds / 60)} dakika sonra tekrar deneyin.` });
  }
  const result = await pool.query(`
    select id,username,email,display_name as name,role,employee_id,department
    from app_users
    where lower(username)=lower($1) and status='Aktif' and password_hash=crypt($2,password_hash)`, [username, password]);
  if (!result.rowCount) {
    registerLoginFailure(key);
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }
  loginAttempts.delete(key);
  const user = result.rows[0], token = crypto.randomBytes(32).toString('hex');
  await pool.query("delete from auth_sessions where expires_at<=now()");
  await pool.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '12 hours')", [tokenHash(token), user.id]);
  res.setHeader('Set-Cookie', sessionCookie(req, token, 43200));
  res.json(withUserScope(user));
}));

app.get('/api/auth/me', asyncRoute(async (req, res) => {
  const user = await authenticatedUser(req);
  if (!user) return res.status(401).json({ error: 'Oturum açmanız gerekiyor' });
  res.json(withUserScope(user));
}));

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  const token = cookieValue(req, 'ik_session');
  if (token) await pool.query('delete from auth_sessions where token_hash=$1', [tokenHash(token)]);
  res.setHeader('Set-Cookie', sessionCookie(req, '', 0));
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


const accountRoles = new Set(['Sistem yöneticisi','İK yöneticisi','Departman yöneticisi','Mali İşler','Finans yöneticisi','Bordro yetkilisi','Genel müdür','Genel müdür yardımcısı','Bölge yöneticisi','Güvenlik','Personel','Sadece görüntüleme']);
const approvalMatrixTypes = new Set(['leave','expense','advance']);
const approvalMatrixRoles = new Set(['Departman yöneticisi','İK yöneticisi','Mali İşler','Finans yöneticisi','Bordro yetkilisi','Genel müdür','Genel müdür yardımcısı','Bölge yöneticisi']);
function normalizeApprovalMatrix(value) {
  const normalized = {};
  for (const type of approvalMatrixTypes) {
    const departmentRoutes = value?.[type];
    if (!departmentRoutes || typeof departmentRoutes !== 'object' || Array.isArray(departmentRoutes)) throw new Error(type + ' onay matrisi eksik');
    normalized[type] = {};
    for (const [department, route] of Object.entries(departmentRoutes)) {
      const departmentName = clean(department);
      if (!departmentName || !Array.isArray(route) || !route.length) throw new Error('Departman ve en az bir onay adımı zorunludur');
      const roles = route.map(clean);
      if (roles.some(role => !approvalMatrixRoles.has(role))) throw new Error('Onay matrisinde geçersiz kullanıcı rolü var');
      normalized[type][departmentName] = roles;
    }
  }
  return normalized;
}
const requireSystemAdmin = (req, res) => {
  if (req.user?.role !== 'Sistem yöneticisi') {
    res.status(403).json({ error: 'Bu işlem için sistem yöneticisi yetkisi gerekiyor' });
    return false;
  }
  return true;
};

// Yetki, oturumdaki kullanıcıdan belirlenir; istemciden gelen rol/departman
// bilgisine asla güvenilmez.
const isSystemAdmin = user => user?.role === 'Sistem yöneticisi';
const isHRUser = user => ['Sistem yöneticisi', 'İK yöneticisi'].includes(user?.role)
  || clean(user?.department) === 'İnsan Kaynakları';
const isPayrollUser = user => isHRUser(user) || user?.role === 'Bordro yetkilisi';
const isDepartmentManager = user => user?.role === 'Departman yöneticisi';
// Vardiya düzenleyebilen roller (departman yöneticisi kendi departmanı için).
const canEditWorkforce = user => isPayrollUser(user) || isDepartmentManager(user);
// Puantaj yalnızca İK ve Bordro; departman yöneticileri göremez.
const canViewAttendance = user => isPayrollUser(user);
const requireRole = (req, res, allowed, message = 'Bu işlem için yetkiniz yok') => {
  if (allowed(req.user)) return true;
  res.status(403).json({ error: message });
  return false;
};
// Departman yöneticisi yalnızca kendi departmanındaki çalışana işlem yapabilir.
const canActOnDepartment = (user, department) => isHRUser(user) || isPayrollUser(user)
  || (isDepartmentManager(user) && clean(user?.department) && clean(user.department) === clean(department));

// Şirket genelini görebilen roller (departman kısıtı yok).
const companyWideRoles = new Set([
  'Sistem yöneticisi', 'İK yöneticisi', 'Bordro yetkilisi', 'Mali İşler', 'Finans yöneticisi',
  'Genel müdür', 'Genel müdür yardımcısı', 'Bölge yöneticisi', 'Sadece görüntüleme'
]);
// Kullanıcının görebileceği departmanlar:
//   null       -> kısıt yok (tüm şirket)
//   [ 'X' ]    -> yalnızca bu departman(lar)
//   []         -> departman bazlı liste yok (yalnızca kendi kayıtları)
function visibleDepartments(user) {
  if (companyWideRoles.has(user?.role) || clean(user?.department) === 'İnsan Kaynakları') return null;
  if (isDepartmentManager(user) && clean(user?.department)) return [clean(user.department)];
  return [];
}
// Maaş/ücret bilgisini Departman yöneticisi ve Personel görmez.
const canSeeSalary = user => !isDepartmentManager(user) && user?.role !== 'Personel';

// Bir sorguya, kullanıcının departman kapsamına göre çalışan kısıtı ekler.
// `column` bir employees.id referansı olmalı; `params` dizisine yeni parametreler
// eklenir ve döndürülen metin WHERE'e eklenmek üzere ' and ...' ile başlar (ya da boş).
function scopeEmployeeSql(user, column, params) {
  const scope = visibleDepartments(user);
  if (scope === null) return '';
  if (scope.length) {
    params.push(scope);
    return ` and ${column} in (select id from employees where department = any($${params.length}))`;
  }
  params.push(Number(user?.employee_id) || 0);
  return ` and ${column} = $${params.length}`;
}

function withUserScope(user) {
  const scope = visibleDepartments(user);
  return {
    ...user,
    department_scope: scope,           // null => tümü
    can_see_salary: canSeeSalary(user)
  };
}
const publicUserColumns = 'id,username,email,phone,display_name as name,role,status,employee_id,department,created_at,updated_at';
const phoneNumber = value => {
  const cleaned = clean(value);
  return cleaned === '' || /^[0-9+()\s-]{7,20}$/.test(cleaned) ? cleaned : null;
};

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
  const phone = phoneNumber(req.body?.phone);
  if (username.length < 3 || /\s/.test(username) || !name || password.length < 8 || !accountRoles.has(role) || !['Aktif','Pasif'].includes(status)) {
    return res.status(400).json({ error: 'Kullanıcı bilgilerini ve en az 8 karakterlik şifreyi kontrol edin' });
  }
  if (phone === null) return res.status(400).json({ error: 'Telefon numarası geçersiz' });
  if (employeeId !== null && (!Number.isInteger(employeeId) || employeeId <= 0)) return res.status(400).json({ error: 'Geçersiz personel bağlantısı' });
  const duplicate = await pool.query('select 1 from app_users where lower(username)=lower($1)', [username]);
  if (duplicate.rowCount) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
  const result = await pool.query(`insert into app_users(username,email,phone,password_hash,display_name,role,status,employee_id,department)
    values($1,$2,$3,crypt($4,gen_salt('bf',12)),$5,$6,$7,$8,$9) returning ${publicUserColumns}`,
    [username,email,phone,password,name,role,status,employeeId,department]);
  res.status(201).json(result.rows[0]);
}));

app.put('/api/users/:id', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const id = Number(req.params.id), username = clean(req.body?.username), email = clean(req.body?.email), name = clean(req.body?.name);
  const password = String(req.body?.password || ''), role = clean(req.body?.role), status = clean(req.body?.status);
  const department = clean(req.body?.department), employeeId = req.body?.employee_id ? Number(req.body.employee_id) : null;
  const phone = phoneNumber(req.body?.phone);
  if (!Number.isInteger(id) || username.length < 3 || /\s/.test(username) || !name || (password && password.length < 8) || !accountRoles.has(role) || !['Aktif','Pasif'].includes(status)) {
    return res.status(400).json({ error: 'Kullanıcı bilgilerini kontrol edin' });
  }
  if (phone === null) return res.status(400).json({ error: 'Telefon numarası geçersiz' });
  if (id === Number(req.user.id) && status !== 'Aktif') return res.status(400).json({ error: 'Kendi hesabınızı pasif yapamazsınız' });
  const duplicate = await pool.query('select 1 from app_users where lower(username)=lower($1) and id<>$2', [username,id]);
  if (duplicate.rowCount) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
  const result = await pool.query(`update app_users set username=$2,email=$3,display_name=$4,role=$5,status=$6,employee_id=$7,department=$8,phone=$10,
    password_hash=case when $9='' then password_hash else crypt($9,gen_salt('bf',12)) end,updated_at=now()
    where id=$1 returning ${publicUserColumns}`, [id,username,email,name,role,status,employeeId,department,password,phone]);
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

async function readSmtpSettings() {
  const result = await pool.query('select * from smtp_settings where id=1');
  return result.rows[0] || null;
}

async function smtpTransport(settings) {
  return nodemailer.createTransport({
    host:settings.host,port:Number(settings.port),secure:false,requireTLS:true,
    auth:{user:settings.username,pass:decryptSmtpSecret(settings.password_encrypted)},
    tls:{minVersion:'TLSv1.2'},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000
  });
}

app.get('/api/smtp-settings', asyncRoute(async (req,res)=>{
  if (!requireSystemAdmin(req,res)) return;
  const settings=await readSmtpSettings();
  if (!settings) return res.json({configured:false,enabled:false,host:'smtp.office365.com',port:587,secure:false,auth_mode:'password',username:'',from_email:'',from_name:'İK Merkezi',password_saved:false});
  res.json({configured:true,enabled:settings.enabled,host:settings.host,port:settings.port,secure:false,
    auth_mode:'password',username:settings.username,from_email:settings.from_email,from_name:settings.from_name,
    password_saved:Boolean(settings.password_encrypted),updated_at:settings.updated_at});
}));

app.put('/api/smtp-settings', asyncRoute(async (req,res)=>{
  if (!requireSystemAdmin(req,res)) return;
  const body=req.body||{},host=clean(body.host)||'smtp.office365.com',port=Number(body.port)||587;
  const username=clean(body.username),fromEmail=clean(body.from_email),fromName=clean(body.from_name)||'İK Merkezi';
  if (host!=='smtp.office365.com' || port!==587) return res.status(400).json({error:'Office 365 için smtp.office365.com ve 587 portu kullanılmalıdır'});
  if (!emailAddress(username) || !emailAddress(fromEmail)) return res.status(400).json({error:'Kullanıcı ve gönderen e-posta adresini kontrol edin'});
  const current=await readSmtpSettings();
  const passwordEncrypted=body.password?encryptSmtpSecret(body.password):current?.password_encrypted||null;
  if (!passwordEncrypted) return res.status(400).json({error:'SMTP parolası zorunludur'});
  await pool.query(`
    insert into smtp_settings(id,enabled,host,port,secure,auth_mode,username,from_email,from_name,password_encrypted,tenant_id,client_id,client_secret_encrypted,updated_by,updated_at)
    values(1,$1,$2,$3,false,'password',$4,$5,$6,$7,null,null,null,$8,now())
    on conflict(id) do update set enabled=excluded.enabled,host=excluded.host,port=excluded.port,secure=false,
      auth_mode='password',username=excluded.username,from_email=excluded.from_email,from_name=excluded.from_name,
      password_encrypted=excluded.password_encrypted,tenant_id=null,client_id=null,client_secret_encrypted=null,
      updated_by=excluded.updated_by,updated_at=now()`,
    [Boolean(body.enabled),host,port,username,fromEmail,fromName,passwordEncrypted,req.user.name]);
  const saved=await readSmtpSettings();
  res.json({ok:true,enabled:saved.enabled,configured:true,auth_mode:'password',password_saved:Boolean(saved.password_encrypted),updated_at:saved.updated_at});
}));

app.post('/api/smtp-settings/test', asyncRoute(async (req,res)=>{
  if (!requireSystemAdmin(req,res)) return;
  const recipient=clean(req.body?.recipient);
  if (!emailAddress(recipient)) return res.status(400).json({error:'Geçerli bir test alıcısı e-posta adresi girin'});
  const settings=await readSmtpSettings();
  if (!settings) return res.status(409).json({error:'Önce SMTP ayarlarını kaydedin'});
  try {
    const transport=await smtpTransport(settings);
    const result=await transport.sendMail({
      from:{name:settings.from_name,address:settings.from_email},to:recipient,
      subject:'İK Merkezi · Office 365 SMTP testi',
      text:'Bu e-posta, İK Merkezi Office 365 SMTP ayarlarının başarıyla çalıştığını doğrulamak için gönderildi.',
      html:'<p>Bu e-posta, <strong>İK Merkezi</strong> Office 365 SMTP ayarlarının başarıyla çalıştığını doğrulamak için gönderildi.</p>'
    });
    res.json({ok:true,message_id:result.messageId});
  } catch (cause) {
    console.error('SMTP test failed',cause?.code||cause?.responseCode||cause?.message);
    const error=new Error('Test e-postası gönderilemedi. SMTP AUTH ve hesap bilgilerini kontrol edin.');
    error.status=502;
    throw error;
  }
}));

// --- SMS entegrasyonu (sağlayıcı bağımsız HTTP) --------------------------
async function readSmsSettings() {
  return (await pool.query('select * from sms_settings where id=1')).rows[0] || null;
}
// Şablon değişkenleri: {phone} {message} {sender} + kimlik alanları ({username} vb.)
function fillTemplate(str, vars, mode) {
  return String(str || '').replace(/\{(\w+)\}/g, (whole, key) => {
    if (!(key in vars)) return whole;
    const value = String(vars[key] ?? '');
    if (mode === 'json') return JSON.stringify(value).slice(1, -1);
    if (mode === 'url') return encodeURIComponent(value);
    return value;
  });
}
function smsCredentials(settings) {
  if (!settings?.credentials_encrypted) return {};
  try { return JSON.parse(decryptSmtpSecret(settings.credentials_encrypted)) || {}; } catch { return {}; }
}
async function sendSms(phone, message, context) {
  const settings = await readSmsSettings();
  if (!settings || !settings.enabled) return { ok: false, skipped: true };
  const target = phoneNumber(phone);
  if (!target) return { ok: false, error: 'Geçersiz telefon' };
  const vars = { ...smsCredentials(settings), phone: target, message: String(message || ''), sender: clean(settings.sender) };
  const method = (settings.http_method || 'POST').toUpperCase();
  const headers = {};
  clean(settings.extra_headers).split(/\r?\n/).map(line => line.trim()).filter(Boolean).forEach(line => {
    const idx = line.indexOf(':');
    if (idx > 0) headers[line.slice(0, idx).trim()] = fillTemplate(line.slice(idx + 1).trim(), vars);
  });
  let url = settings.api_url, body;
  if (method === 'GET') {
    const query = fillTemplate(settings.body_template, vars, 'url');
    if (query) url += (url.includes('?') ? '&' : '?') + query;
  } else {
    const contentType = clean(settings.content_type) || 'application/json';
    headers['Content-Type'] = contentType;
    body = fillTemplate(settings.body_template, vars, /json/i.test(contentType) ? 'json' : 'url');
  }
  let ok = false, statusCode = null, responseText = '';
  try {
    const response = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(15000) });
    statusCode = response.status;
    responseText = (await response.text()).slice(0, 1000);
    ok = response.ok && (!clean(settings.success_contains) || responseText.includes(clean(settings.success_contains)));
  } catch (cause) {
    responseText = String(cause?.message || cause).slice(0, 1000);
  }
  pool.query('insert into sms_log(phone,message,context,ok,status_code,response) values($1,$2,$3,$4,$5,$6)',
    [target, String(message || '').slice(0, 500), clean(context), ok, statusCode, responseText]).catch(() => {});
  return { ok, status: statusCode, response: responseText };
}
function userMatchesApproverRole(user, role, department) {
  if (!role) return false;
  if (role === 'Departman yöneticisi') return user.role === role && clean(user.department) === clean(department);
  if (role === 'İK yöneticisi') return user.role === role || clean(user.department) === 'İnsan Kaynakları';
  if (['Mali İşler', 'Finans yöneticisi', 'Bordro yetkilisi'].includes(role)) return ['Mali İşler', 'Finans yöneticisi', 'Bordro yetkilisi'].includes(user.role);
  return user.role === role;
}
const approvalKindLabel = { leave_requests: 'izin', expenses: 'masraf', advances: 'avans' };
async function notifyApprovalSms(row, table) {
  try {
    const settings = await readSmsSettings();
    if (!settings || !settings.enabled || !settings.notify_approvals) return;
    const role = clean(row.current_approver);
    if (!role || !['Bekliyor', 'Onay Sürecinde'].includes(row.status)) return;
    const candidates = (await pool.query("select display_name,phone,role,department from app_users where status='Aktif' and coalesce(phone,'')<>''")).rows;
    const targets = candidates.filter(user => userMatchesApproverRole(user, role, row.department));
    if (!targets.length) return;
    const kind = approvalKindLabel[table] || 'onay';
    const who = clean(row.employee_name) || 'Bir çalışan';
    const message = `İK Merkezi: ${who} adlı çalışanın ${kind} talebi onayınızı bekliyor.`;
    for (const target of targets) await sendSms(target.phone, message, `${table}#${row.id}`);
  } catch (cause) {
    console.error('SMS bildirimi gönderilemedi', cause?.message || cause);
  }
}

app.get('/api/sms-settings', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const settings = await readSmsSettings();
  if (!settings) return res.json({ configured: false, enabled: false, notify_approvals: false, provider_name: '', api_url: '', http_method: 'POST', content_type: 'application/json', body_template: '', extra_headers: '', sender: '', success_contains: '', credential_keys: [] });
  res.json({
    configured: true, enabled: settings.enabled, notify_approvals: settings.notify_approvals,
    provider_name: settings.provider_name, api_url: settings.api_url, http_method: settings.http_method,
    content_type: settings.content_type, body_template: settings.body_template, extra_headers: settings.extra_headers,
    sender: settings.sender, success_contains: settings.success_contains,
    credential_keys: Object.keys(smsCredentials(settings)), updated_at: settings.updated_at
  });
}));

app.put('/api/sms-settings', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const body = req.body || {};
  const apiUrl = clean(body.api_url);
  const method = clean(body.http_method).toUpperCase() === 'GET' ? 'GET' : 'POST';
  const contentType = clean(body.content_type) || 'application/json';
  const bodyTemplate = String(body.body_template || '').slice(0, 4000);
  if (!/^https:\/\//i.test(apiUrl)) return res.status(400).json({ error: 'API adresi https:// ile başlamalıdır' });
  if (!bodyTemplate.trim()) return res.status(400).json({ error: 'İstek gövdesi / sorgu şablonu zorunludur' });
  const current = await readSmsSettings();
  let credentialsEncrypted = current?.credentials_encrypted || null;
  if (body.credentials && typeof body.credentials === 'object' && Object.keys(body.credentials).length) {
    const merged = { ...smsCredentials(current), ...body.credentials };
    for (const key of Object.keys(merged)) if (clean(merged[key]) === '') delete merged[key];
    credentialsEncrypted = Object.keys(merged).length ? encryptSmtpSecret(JSON.stringify(merged)) : null;
  }
  await pool.query(`
    insert into sms_settings(id,enabled,notify_approvals,provider_name,api_url,http_method,content_type,body_template,extra_headers,sender,success_contains,credentials_encrypted,updated_by,updated_at)
    values(1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
    on conflict(id) do update set enabled=excluded.enabled,notify_approvals=excluded.notify_approvals,provider_name=excluded.provider_name,
      api_url=excluded.api_url,http_method=excluded.http_method,content_type=excluded.content_type,body_template=excluded.body_template,
      extra_headers=excluded.extra_headers,sender=excluded.sender,success_contains=excluded.success_contains,
      credentials_encrypted=excluded.credentials_encrypted,updated_by=excluded.updated_by,updated_at=now()`,
    [Boolean(body.enabled), Boolean(body.notify_approvals), clean(body.provider_name), apiUrl, method, contentType,
      bodyTemplate, String(body.extra_headers || '').slice(0, 2000), clean(body.sender), clean(body.success_contains),
      credentialsEncrypted, req.user.name]);
  res.json({ ok: true });
}));

app.post('/api/sms-settings/test', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const recipient = phoneNumber(req.body?.recipient);
  if (!recipient) return res.status(400).json({ error: 'Geçerli bir test telefon numarası girin' });
  const settings = await readSmsSettings();
  if (!settings) return res.status(409).json({ error: 'Önce SMS ayarlarını kaydedin' });
  if (!settings.enabled) return res.status(409).json({ error: 'SMS gönderimi kapalı; önce etkinleştirip kaydedin' });
  const result = await sendSms(recipient, 'İK Merkezi SMS testi: ayarlarınız çalışıyor.', 'test');
  if (!result.ok) return res.status(502).json({ error: `SMS gönderilemedi (HTTP ${result.status ?? '-'}). Yanıt: ${clean(result.response).slice(0, 200)}` });
  res.json({ ok: true, status: result.status });
}));

app.get('/api/sms-log', asyncRoute(async (req, res) => {
  if (!requireSystemAdmin(req, res)) return;
  const rows = (await pool.query('select id,phone,message,context,ok,status_code,response,created_at from sms_log order by created_at desc limit 50')).rows;
  res.json(rows);
}));

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('select 1');
  res.json({ ok: true });
}));

app.get('/api/shared-data', asyncRoute(async (_req, res) => {
  const result = await pool.query('select data_key,value from shared_app_data order by data_key');
  res.json(Object.fromEntries(result.rows.map(row => [row.data_key, row.value])));
}));

// Ortak veri alanlarının kimler tarafından yazılabileceği.
const sharedDataWriters = {
  ik_approval_routes: user => ['Sistem yöneticisi', 'İK yöneticisi'].includes(user?.role),
  ik_users: isSystemAdmin,
  ik_documents: user => isHRUser(user) || isDepartmentManager(user),
  ik_performance: user => isHRUser(user) || isDepartmentManager(user),
  ik_training: user => isHRUser(user) || isDepartmentManager(user)
};

app.put('/api/shared-data/:key', asyncRoute(async (req, res) => {
  const key = clean(req.params.key);
  if (!sharedDataKeys.has(key)) return res.status(404).json({ error: 'Geçersiz ortak veri alanı' });
  const canWrite = sharedDataWriters[key] || isSystemAdmin;
  if (!canWrite(req.user)) return res.status(403).json({ error: 'Bu ortak veri alanını değiştirme yetkiniz yok' });
  let value = req.body?.value;
  if (value == null || typeof value !== 'object') return res.status(400).json({ error: 'Geçerli JSON verisi zorunludur' });
  if (key === 'ik_approval_routes') {
    try { value = normalizeApprovalMatrix(value); }
    catch (error) { return res.status(400).json({ error: error.message }); }
  }
  const result = await pool.query(`
    insert into shared_app_data(data_key,value) values($1,$2::jsonb)
    on conflict(data_key) do update set value=excluded.value,updated_at=now()
    returning data_key,value,updated_at`, [key, JSON.stringify(value)]);
  res.json(result.rows[0]);
}));

app.get('/api/attendance', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canViewAttendance, 'Puantaj görüntüleme yetkiniz yok')) return;
  const month = /^\d{4}-\d{2}$/.test(clean(req.query.month)) ? clean(req.query.month) : null;
  if (!month) return res.status(400).json({ error: 'Geçerli bir puantaj ayı zorunludur' });
  const params = [month];
  const scopeSql = scopeEmployeeSql(req.user, 'employee_id', params);
  const result = await pool.query(`
    select employee_id, to_char(work_date,'YYYY-MM-DD') as work_date, work_type, value
    from attendance_entries
    where work_date >= ($1 || '-01')::date
      and work_date < (($1 || '-01')::date + interval '1 month')${scopeSql}
    order by employee_id, work_date, work_type`, params);
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
  if (!requireRole(req, res, canViewAttendance, 'Puantaj düzenleme yetkiniz yok')) return;
  const employee = await pool.query('select id,department from employees where id=$1', [employeeId]);
  if (!employee.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  if (!canActOnDepartment(req.user, employee.rows[0].department)) {
    return res.status(403).json({ error: 'Yalnızca kendi departmanınızdaki çalışanın puantajını düzenleyebilirsiniz' });
  }
  const unrestricted = isHRUser(req.user) || isPayrollUser(req.user);
  const today = istanbulDate();
  if (!unrestricted && (workDate.slice(0, 7) !== today.slice(0, 7) || dateDistance(today, workDate) > 2)) {
    return res.status(403).json({ error: 'Bu tarih için puantaj düzeltme süresi doldu' });
  }
  const inShiftWindow = (() => { const off = dateDistance(workDate, today); return off >= -1 && off <= 14; })();
  if (!value) {
    await pool.query('delete from attendance_entries where employee_id=$1 and work_date=$2 and work_type=$3', [employeeId, workDate, workType]);
    if (inShiftWindow) await mirrorAttendanceToShift(pool, employeeId, workDate, workType, '', req.user.name);
    return res.status(204).end();
  }
  const result = await pool.query(`
    insert into attendance_entries(employee_id,work_date,work_type,value,updated_by,source)
    values($1,$2,$3,$4,$5,'manual')
    on conflict(employee_id,work_date,work_type) do update set
      value=excluded.value, updated_by=excluded.updated_by, source='manual', updated_at=now()
    returning employee_id,to_char(work_date,'YYYY-MM-DD') as work_date,work_type,value,updated_at`,
  [employeeId, workDate, workType, value, req.user.name || null]);
  if (inShiftWindow) await mirrorAttendanceToShift(pool, employeeId, workDate, workType, value, req.user.name);
  res.json(result.rows[0]);
}));


app.get('/api/shifts', asyncRoute(async (req, res) => {
  const start = dateOnly(req.query.start);
  const end = dateOnly(req.query.end);
  if (!start || !end || dateDistance(end, start) < 0 || dateDistance(end, start) > 31) {
    return res.status(400).json({ error: 'Geçerli vardiya tarih aralığı zorunludur' });
  }
  const params = [start, end];
  const scopeSql = scopeEmployeeSql(req.user, 's.employee_id', params);
  const result = await pool.query(`
    select s.employee_id, e.name as employee, to_char(s.work_date,'YYYY-MM-DD') as date, s.shift_type as type, s.overtime,
      exists(
        select 1 from attendance_entries a
        where a.employee_id=s.employee_id and a.work_date=s.work_date
          and a.work_type='normal' and a.source='manual' and a.value in ('R','R.')
      ) as hr_locked
    from shift_plans s
    join employees e on e.id=s.employee_id
    where s.work_date between $1 and $2${scopeSql}
    order by e.name,s.work_date`, params);
  res.json(result.rows);
}));

// İK tarafından puantaja elle R / R. girilen gün departmanlarca kilitlidir.
async function attendanceHrLocked(employeeId, workDate) {
  const row = await pool.query(
    "select value from attendance_entries where employee_id=$1 and work_date=$2 and work_type='normal' and source='manual'",
    [employeeId, workDate]);
  return Boolean(row.rows[0]) && ['R', 'R.'].includes(clean(row.rows[0].value));
}

app.put('/api/shifts', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const employeeId = Number(body.employee_id);
  const workDate = dateOnly(body.work_date);
  const hasNormal = Object.prototype.hasOwnProperty.call(body, 'shift_type');
  const hasOvertime = Object.prototype.hasOwnProperty.call(body, 'overtime');
  const shiftType = clean(body.shift_type);
  const overtime = clean(body.overtime);
  if (!Number.isInteger(employeeId) || employeeId <= 0 || !workDate || (!hasNormal && !hasOvertime)) {
    return res.status(400).json({ error: 'Geçersiz vardiya kaydı' });
  }
  if (hasNormal && shiftType && !attendanceNormalValues.has(shiftType)) return res.status(400).json({ error: 'Geçersiz vardiya kodu' });
  if (hasOvertime && overtime && !attendanceOvertimeValues.has(overtime)) return res.status(400).json({ error: 'Geçersiz fazla mesai değeri' });
  if (!requireRole(req, res, canEditWorkforce, 'Vardiya planlama yetkiniz yok')) return;
  const today = istanbulDate();
  const offset = dateDistance(workDate, today);
  if (offset < -1 || offset > 14) return res.status(403).json({ error: 'Bu tarih vardiya planlama aralığı dışında' });
  const employee = await pool.query('select id,department from employees where id=$1', [employeeId]);
  if (!employee.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  if (isDepartmentManager(req.user) && await attendanceHrLocked(employeeId, workDate)) {
    return res.status(403).json({ error: 'Bu gün İK tarafından R (rapor) olarak işaretlendi; vardiyası değiştirilemez' });
  }
  if (!canActOnDepartment(req.user, employee.rows[0].department)) {
    return res.status(403).json({ error: 'Yalnızca kendi departmanınızdaki çalışanın vardiyasını planlayabilirsiniz' });
  }
  const client = await pool.connect();
  try {
    await client.query('begin');
    const existing = (await client.query('select shift_type,overtime from shift_plans where employee_id=$1 and work_date=$2 for update', [employeeId, workDate])).rows[0] || { shift_type: '', overtime: '' };
    const nextNormal = hasNormal ? shiftType : clean(existing.shift_type);
    const nextOvertime = hasOvertime ? overtime : clean(existing.overtime);
    if (!nextNormal && !nextOvertime) {
      await client.query('delete from shift_plans where employee_id=$1 and work_date=$2', [employeeId, workDate]);
    } else {
      await client.query(`
        insert into shift_plans(employee_id,work_date,shift_type,overtime,updated_by,transferred_at,updated_at)
        values($1,$2,$3,$4,$5,null,now())
        on conflict(employee_id,work_date) do update set
          shift_type=excluded.shift_type,overtime=excluded.overtime,updated_by=excluded.updated_by,transferred_at=null,updated_at=now()`,
        [employeeId, workDate, nextNormal, nextOvertime, req.user.name || null]);
    }
    if (hasNormal) await mirrorShiftToAttendance(client, employeeId, workDate, 'normal', nextNormal, req.user.name);
    if (hasOvertime) await mirrorShiftToAttendance(client, employeeId, workDate, 'fazla', nextOvertime, req.user.name);
    await client.query('commit');
    res.json({ employee_id: employeeId, date: workDate, type: nextNormal, overtime: nextOvertime });
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/attendance-report', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canViewAttendance, 'Puantaj raporu alma yetkiniz yok')) return;
  let department = clean(req.body?.department);
  const month = /^\d{4}-\d{2}$/.test(clean(req.body?.month)) ? clean(req.body.month) : '2026-08';
  let employees = Array.isArray(req.body?.employees) ? req.body.employees : [];
  if (employees.length > 2000) return res.status(413).json({ error: 'Rapor için çalışan listesi çok büyük' });
  // Departman kapsamı: kısıtlı kullanıcı yalnızca kendi departmanı için rapor alabilir.
  const scope = visibleDepartments(req.user);
  if (Array.isArray(scope)) {
    if (!scope.length) return res.status(403).json({ error: 'Puantaj raporu alma yetkiniz yok' });
    department = scope.includes(department) ? department : scope[0];
    const ids = employees.map(row => Number(row.id)).filter(Number.isInteger);
    const allowed = new Set((await pool.query(
      'select id from employees where id = any($1::int[]) and department = any($2)', [ids, scope]
    )).rows.map(row => row.id));
    employees = employees.filter(row => allowed.has(Number(row.id)));
  }
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

app.get('/api/employees', asyncRoute(async (req, res) => {
  let rows = (await pool.query(`
    select e.*,
      e.payroll_details->>'TC KİMLİK' as tc_kimlik,
      e.payroll_details->>'KAN GRUBU' as kan_grubu,
      e.payroll_details->>'CİNSİYET' as cinsiyet
    from employees e order by e.id`)).rows;
  // Departman kapsamı: kısıtlı roller yalnızca kendi departman(lar)ını,
  // Personel yalnızca kendi personel kaydını görür.
  const scope = visibleDepartments(req.user);
  if (Array.isArray(scope)) {
    rows = scope.length
      ? rows.filter(row => scope.includes(clean(row.department)))
      : rows.filter(row => String(row.id) === String(req.user.employee_id));
  }
  // Hassas bordro alanları yalnızca İK / bordro rollerine döner.
  if (!isPayrollUser(req.user)) {
    rows = rows.map(({ payroll_details, tc_kimlik, kan_grubu, cinsiyet, ...rest }) => rest);
  }
  // Maaş bilgisi Departman yöneticisi ve Personelden gizlenir.
  if (!canSeeSalary(req.user)) rows = rows.map(({ salary, ...rest }) => rest);
  res.json(rows);
}));
app.get('/api/employees/:id/payroll-details', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, isPayrollUser, 'Bordro ayrıntılarını görme yetkiniz yok')) return;
  const result = await pool.query('select id,name,payroll_sicil,payroll_details,source_synced_at from employees where id=$1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  res.json(result.rows[0]);
}));
app.post('/api/employees', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, isHRUser, 'Çalışan ekleme yetkiniz yok')) return;
  const e = req.body;
  const result = await pool.query("insert into employees(name,email,department,title,start_date,salary,status,source,payroll_sync_protected) values($1,$2,$3,$4,$5,$6,$7,'Manuel',true) returning *", [e.name, e.email || '', e.department, e.title || '', e.start, e.salary || 0, e.status || 'Aktif']);
  res.status(201).json(result.rows[0]);
}));
app.put('/api/employees/:id', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, isHRUser, 'Çalışan düzenleme yetkiniz yok')) return;
  const e = req.body;
  const result = await pool.query('update employees set name=$1,email=$2,department=$3,title=$4,start_date=$5,salary=$6,status=$7 where id=$8 returning *', [e.name, e.email || '', e.department, e.title || '', e.start, e.salary || 0, e.status || 'Aktif', req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Çalışan bulunamadı' });
  res.json(result.rows[0]);
}));
app.delete('/api/employees/:id', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, isHRUser, 'Çalışan silme yetkiniz yok')) return;
  await pool.query('delete from employees where id=$1', [req.params.id]);
  res.status(204).end();
}));

app.get('/api/departments', asyncRoute(async (req, res) => {
  const params = [];
  const scope = visibleDepartments(req.user);
  let filter = '';
  if (Array.isArray(scope)) {
    params.push(scope);
    filter = `where d.name = any($1)`;
  }
  const result = await pool.query(`
    select d.*, count(e.id)::int as employee_count
    from departments d
    left join employees e on e.department=d.name and e.workplace=d.workplace and e.unit=d.unit
    ${filter}
    group by d.id
    order by d.name, d.workplace, d.unit`, params);
  res.json(result.rows);
}));

app.get('/api/payroll-sync/status', asyncRoute(async (_req, res) => {
  const last = await pool.query(`select max(source_synced_at) as synced_at, count(*) filter (where source='Bordro')::int as synced_employees from employees`);
  res.json({ configured: payrollConfigured(), synced_at: last.rows[0].synced_at, synced_employees: last.rows[0].synced_employees });
}));

app.post('/api/payroll-sync', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, isPayrollUser, 'Bordro eşitleme yetkiniz yok')) return;
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
      const leaveSeniorityExempt = false;
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
          previous_termination_date=excluded.previous_termination_date
        where employees.payroll_sync_protected=false`,
      [clean(row.name), department, clean(row.title), row.start_date, sourceStatus(row.payroll_status), payrollSicil, workplace, unit, JSON.stringify(row), terminationDate, leaveSeniorityExempt, employmentGapDays, previousTerminationDate]);
    }
    // Eksik/henüz oluşmakta olan Bordro döneminde görünmeyen personeli pasife
    // çekme. Pasiflik yalnızca kaynak satırındaki açık çalışma durumu ve çıkış
    // bilgisi üzerinden güncellenir.
    // Son yeniden girişten önceki çıkışı bul. 0-9 günlük aralarda yıllık izin
    // hakediş geçmişi korunur; kıdem başlangıcı ise son işe giriş tarihi olur.
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
          leave_seniority_exempt=false
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
      ), leave_seniority as (
        select id, min(chain_start) as leave_entitlement_start_date
        from continuous_service
        group by id
      )
      update employees e
      set leave_entitlement_start_date=s.leave_entitlement_start_date
      from leave_seniority s
      where e.id=s.id`);
    await client.query(`
      update employees
      set seniority_start_date=start_date
      where source='Bordro'`);
    await client.query(`
      with first_employment as (
        select e.id, coalesce((
          select min(ep.start_date)
          from employee_employment_periods ep
          where coalesce(ep.employee_identity, 'sicil:' || ep.payroll_sicil) =
                coalesce(nullif(e.payroll_details->>'TC KİMLİK',''), 'sicil:' || e.payroll_sicil)
        ), e.start_date) as first_start
        from employees e
        where e.source='Bordro'
      )
      update employees e
      set first_employment_start_date=f.first_start
      from first_employment f
      where e.id=f.id`);
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

const approvalDefaults = {
  leave: ['Departman yöneticisi', 'İK yöneticisi'],
  advance: ['Departman yöneticisi', 'İK yöneticisi', 'Mali İşler'],
  expense: ['Departman yöneticisi', 'Mali İşler']
};

const approvalStageKey = role => role === 'Departman yöneticisi' ? 'department'
  : role === 'İK yöneticisi' ? 'hr'
    : ['Mali İşler', 'Finans yöneticisi', 'Bordro yetkilisi'].includes(role) ? 'finance'
      : 'custom';

async function approvalRouteFor(type, department) {
  const result = await pool.query("select value from shared_app_data where data_key='ik_approval_routes'");
  const settings = result.rows[0]?.value || {};
  const configured = Array.isArray(settings?.[type]?.[department])
    ? settings[type][department]
    : type === 'leave' && Array.isArray(settings?.[department]) ? settings[department] : null;
  const route = (configured || approvalDefaults[type] || []).map(clean).filter(Boolean);
  return route.length ? route : approvalDefaults[type];
}

function approvalRoleMatches(user, role, department) {
  if (!user || !role) return false;
  if (user.role === 'Sistem yöneticisi') return true;
  if (role === 'Departman yöneticisi') return user.role === role && clean(user.department) === clean(department);
  if (role === 'İK yöneticisi') return user.role === role || clean(user.department) === 'İnsan Kaynakları';
  if (['Mali İşler', 'Finans yöneticisi', 'Bordro yetkilisi'].includes(role)) return ['Mali İşler', 'Finans yöneticisi', 'Bordro yetkilisi'].includes(user.role);
  return user.role === role;
}

const approvalHistory = row => Array.isArray(row.approval_history) ? row.approval_history : [];
const approvalRoute = row => Array.isArray(row.approval_route) ? row.approval_route : [];
const approvalOwnedBy = (row, user) => String(row.requester_user_id || '') === String(user.id)
  || (user.employee_id && String(row.employee_id || '') === String(user.employee_id));
const approvalPreviouslyHandledBy = (row, user) => approvalHistory(row).some(entry => String(entry.user_id) === String(user.id));
const approvalCanAct = (row, user, pendingStatus) => row.status === pendingStatus
  && approvalRoleMatches(user, row.current_approver, row.department);
// Departman yöneticisi kendi departmanının tüm talep tablosunu görebilir.
const approvalInUserDepartment = (row, user) => isDepartmentManager(user)
  && clean(user.department) && clean(row.department) === clean(user.department);
const approvalCanSee = (row, user, pendingStatus) => user.role === 'Sistem yöneticisi'
  || approvalInUserDepartment(row, user)
  || approvalOwnedBy(row, user)
  || approvalPreviouslyHandledBy(row, user)
  || approvalCanAct(row, user, pendingStatus);

function decorateApproval(row, user, pendingStatus) {
  return {
    ...row,
    can_approve: approvalCanAct(row, user, pendingStatus),
    can_delete: (user.role === 'Sistem yöneticisi' || approvalOwnedBy(row, user)) && row.status === pendingStatus && Number(row.approval_step || 0) === 0,
    can_mark_paid: row.status === 'Onaylandı' && (user.role === 'Sistem yöneticisi' || ['Mali İşler', 'Finans yöneticisi', 'Bordro yetkilisi'].includes(user.role))
  };
}

async function decideApproval(table, id, user, decision, reason, pendingStatus, options = {}) {
  if (!['leave_requests', 'expenses', 'advances'].includes(table)) throw new Error('Geçersiz onay türü');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const found = await client.query(`select * from ${table} where id=$1 for update`, [id]);
    if (!found.rowCount) {
      const error = new Error('Talep bulunamadı'); error.status = 404; throw error;
    }
    const row = found.rows[0];
    if (row.status !== pendingStatus) {
      const error = new Error('Bu talep artık onay beklemiyor'); error.status = 409; throw error;
    }
    if (!approvalCanAct(row, user, pendingStatus)) {
      const error = new Error('Bu onay adımı size atanmadı'); error.status = 403; throw error;
    }
    const route = approvalRoute(row);
    const step = Number(row.approval_step || 0);
    const history = approvalHistory(row);
    history.push({
      step: step + 1,
      approver: row.current_approver,
      user_id: String(user.id),
      user_name: user.name,
      role: user.role,
      decision,
      reason: clean(reason),
      decided_at: new Date().toISOString()
    });
    let result;
    if (decision === 'reject') {
      result = await client.query(`update ${table} set status='Reddedildi',current_approver=null,
        approval_history=$1::jsonb,rejected_by=$2,rejected_at=now(),rejection_reason=$3,updated_at=now()
        where id=$4 returning *`, [JSON.stringify(history), user.name, clean(reason), id]);
    } else {
      const nextStep = step + 1;
      // İzin: son onay İK'da ve İK "GM onayına gönder" derse rotaya Genel müdür eklenir
      const wouldComplete = nextStep >= route.length;
      const escalateToGm = options.escalate === true && table === 'leave_requests'
        && wouldComplete && clean(row.current_approver) === 'İK yöneticisi';
      const workingRoute = escalateToGm ? [...route, 'Genel müdür'] : route;
      const completed = nextStep >= workingRoute.length;
      const nextApprover = completed ? null : workingRoute[nextStep];
      const approvedStatus = 'Onaylandı';
      result = await client.query(`update ${table} set status=$1,current_approver=$2,approval_step=$3,
        approval_route=$4::jsonb,approval_history=$5::jsonb,updated_at=now() where id=$6 returning *`,
      [completed ? approvedStatus : pendingStatus, nextApprover, nextStep, JSON.stringify(workingRoute), JSON.stringify(history), id]);
    }
    if (table === 'advances') {
      const updated = result.rows[0];
      await client.query('update advances set approval_stage=$1 where id=$2',
        [updated.status === 'Onaylandı' ? 'approved' : updated.status === 'Reddedildi' ? 'rejected' : approvalStageKey(updated.current_approver), id]);
      result = await client.query('select * from advances where id=$1', [id]);
    }
    await client.query('commit');
    return result.rows[0];
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

const annualLeaveEditor = user => ['Sistem yöneticisi','İK yöneticisi'].includes(user?.role)
  || clean(user?.department) === 'İnsan Kaynakları';

function annualLeaveDate(value) {
  const rawDate = value instanceof Date ? value.toISOString().slice(0,10) : String(value || "").slice(0,10);
  const date = new Date(rawDate + "T00:00:00Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

// İki tarih arasında tamamlanmış tam yıl sayısı (yıl dönümü geçmediyse eksik sayılır).
function completedFullYears(from, to) {
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const anniversary = new Date(Date.UTC(to.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  if (to < anniversary) years -= 1;
  return years;
}

// Bir hizmet yılının izin hakkı — çizelgedeki "Hesap Cetveli" ile birebir:
//   1–5. yıl   -> 14 gün
//   6–14. yıl  -> 20 gün
//   15. yıl ve sonrası -> 26 gün
//   O hizmet yılının başında yaş 17 ve altı ya da 49 ve üstü ise -> en az 20 gün
//   (çizelge bu sınırları kullanıyor; mevzuat metni "18 ve altı / 50 ve üstü" der).
function yearlyLeaveDays(serviceYear, ageAtYearStart) {
  let days = serviceYear <= 5 ? 14 : serviceYear <= 14 ? 20 : 26;
  if (ageAtYearStart !== null && (ageAtYearStart <= 17 || ageAtYearStart >= 49)) days = Math.max(days, 20);
  return days;
}

// Toplam (kümülatif) hak edilen yıllık izin. startDate = yıllık izne esas giriş
// (10 günden kısa aralarla giriş-çıkışta ilk giriş; askı personelinde son giriş).
function annualLeaveEntitlement(startDate, birthDate, year) {
  const start = annualLeaveDate(startDate);
  if (!start) return 0;
  const yearEnd = new Date(Date.UTC(Number(year), 11, 31));
  const now = new Date();
  const reference = now < yearEnd ? now : yearEnd;
  const completedYears = completedFullYears(start, reference);
  if (completedYears < 1) return 0;
  const birth = annualLeaveDate(birthDate);
  const ageAtStart = birth ? completedFullYears(birth, start) : null;
  let total = 0;
  for (let y = 1; y <= completedYears; y++) {
    total += yearlyLeaveDays(y, ageAtStart === null ? null : ageAtStart + (y - 1));
  }
  return total;
}

// Bu yıl (en son tamamlanan hizmet yılı) hak edilen izin günü.
function currentYearLeaveDays(startDate, birthDate, year) {
  const start = annualLeaveDate(startDate);
  if (!start) return 0;
  const yearEnd = new Date(Date.UTC(Number(year), 11, 31));
  const now = new Date();
  const reference = now < yearEnd ? now : yearEnd;
  const completedYears = completedFullYears(start, reference);
  if (completedYears < 1) return 0;
  const birth = annualLeaveDate(birthDate);
  const ageAtStart = birth ? completedFullYears(birth, start) : null;
  return yearlyLeaveDays(completedYears, ageAtStart === null ? null : ageAtStart + (completedYears - 1));
}

async function visibleAnnualLeaveEmployees(user) {
  const cols = "select id,name,department,start_date,leave_entitlement_start_date,payroll_details->>'DOĞUM TARİHİ' birth_date from employees where status<>'Pasif'";
  const scope = visibleDepartments(user);
  if (scope === null) return (await pool.query(`${cols} order by name`)).rows;
  if (scope.length) return (await pool.query(`${cols} and department = any($1) order by name`, [scope])).rows;
  if (user?.employee_id) return (await pool.query(`${cols} and id=$1 order by name`, [Number(user.employee_id)])).rows;
  return [];
}

async function ensureAnnualLeaveEntitlements(year, employees, actor='Sistem') {
  if (!employees.length) return;
  const allocations = employees.map(employee => ({
    employee_id:Number(employee.id),
    entitled_days:annualLeaveEntitlement(employee.leave_entitlement_start_date || employee.start_date, employee.birth_date, year)
  }));
  await pool.query(`
    insert into annual_leave_entitlements(employee_id,entitlement_year,entitled_days,updated_by)
    select item.employee_id,$1,item.entitled_days,$3
    from jsonb_to_recordset($2::jsonb) as item(employee_id integer,entitled_days numeric)
    on conflict(employee_id,entitlement_year) do update set
      entitled_days=excluded.entitled_days,updated_by=excluded.updated_by,updated_at=now()
    where annual_leave_entitlements.manual_override=false`, [year,JSON.stringify(allocations),actor]);
}

app.get('/api/annual-leave-balances', asyncRoute(async (req,res)=>{
  const year=Number(req.query.year || new Date().getFullYear());
  if (!Number.isInteger(year) || year<2000 || year>2100) return res.status(400).json({error:'Geçerli bir izin yılı seçin'});
  const accessible=await visibleAnnualLeaveEmployees(req.user);
  await ensureAnnualLeaveEntitlements(year,accessible,req.user?.name||'Sistem');
  const departments=[...new Set(accessible.map(employee=>employee.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'tr'));
  const requestedDepartment=clean(req.query.department);
  const employees=requestedDepartment?accessible.filter(employee=>employee.department===requestedDepartment):accessible;
  const ids=employees.map(employee=>Number(employee.id));
  if (!ids.length) return res.json({year,department:requestedDepartment,departments,can_edit:annualLeaveEditor(req.user),totals:{entitled:0,used:0,remaining:0},rows:[]});
  const entitlementRows=(await pool.query(`select * from annual_leave_entitlements where entitlement_year=$1 and employee_id=any($2::int[])`,[year,ids])).rows;
  const usedRows=(await pool.query(`
    select employee_id,count(distinct work_date)::numeric as used_days
    from attendance_entries
    where employee_id=any($1::int[])
      and work_type='normal'
      and upper(trim(value))='Y'
      and work_date>=make_date($2,1,1)
      and work_date<make_date($2+1,1,1)
      and work_date<=(now() at time zone 'Europe/Istanbul')::date
    group by employee_id`,[ids,year])).rows;
  const entitlementMap=new Map(entitlementRows.map(row=>[Number(row.employee_id),row]));
  const usedMap=new Map(usedRows.map(row=>[Number(row.employee_id),Number(row.used_days)]));
  const rows=employees.map(employee=>{
    const record=entitlementMap.get(Number(employee.id))||{};
    const entitled=Number(record.entitled_days||0),adjustment=Number(record.manual_adjustment||0);
    const manualUsed=Number(record.manual_used_days||0),attendanceUsed=usedMap.get(Number(employee.id))||0;
    const used=manualUsed+attendanceUsed;
    const currentYearDays=record.current_year_days!=null
      ? Number(record.current_year_days)
      : currentYearLeaveDays(employee.leave_entitlement_start_date||employee.start_date,employee.birth_date,year);
    return {employee_id:employee.id,employee_name:employee.name,department:employee.department,year,
      entitled_days:entitled,manual_adjustment:adjustment,total_days:entitled+adjustment,
      current_year_days:currentYearDays,
      manual_used_days:manualUsed,attendance_used_days:attendanceUsed,used_days:used,
      remaining_days:entitled+adjustment-used,manual_override:Boolean(record.manual_override),
      adjustment_note:record.adjustment_note||'',updated_by:record.updated_by||null,updated_at:record.updated_at||null};
  }).sort((a,b)=>b.remaining_days-a.remaining_days||a.employee_name.localeCompare(b.employee_name,'tr'));
  const totals=rows.reduce((sum,row)=>({entitled:sum.entitled+row.total_days,used:sum.used+row.used_days,remaining:sum.remaining+row.remaining_days}),{entitled:0,used:0,remaining:0});
  res.json({year,department:requestedDepartment,departments,can_edit:annualLeaveEditor(req.user),totals,rows});
}));

app.patch('/api/annual-leave-balances/:employeeId', asyncRoute(async (req,res)=>{
  if (!annualLeaveEditor(req.user)) return res.status(403).json({error:'Yıllık izin düzeltmesini yalnızca sistem veya İK yöneticisi yapabilir'});
  const employeeId=Number(req.params.employeeId),year=Number(req.body?.year),entitled=Number(req.body?.entitled_days),adjustment=Number(req.body?.manual_adjustment||0);
  const manualUsed=Number(req.body?.manual_used_days||0);
  if (!Number.isInteger(employeeId)||!Number.isInteger(year)||year<2000||year>2100||!Number.isFinite(entitled)||entitled<0||entitled>3650||!Number.isFinite(adjustment)||adjustment<-365||adjustment>365||!Number.isFinite(manualUsed)||manualUsed<0||manualUsed>3650) {
    return res.status(400).json({error:'Yıl, hak edilen gün, kullanılan gün ve düzeltme değerlerini kontrol edin'});
  }
  const employee=await pool.query('select id from employees where id=$1',[employeeId]);
  if (!employee.rowCount) return res.status(404).json({error:'Çalışan bulunamadı'});
  await pool.query(`
    insert into annual_leave_entitlements(employee_id,entitlement_year,entitled_days,manual_adjustment,manual_used_days,manual_override,adjustment_note,updated_by)
    values($1,$2,$3,$4,$5,true,$6,$7)
    on conflict(employee_id,entitlement_year) do update set
      entitled_days=excluded.entitled_days,manual_adjustment=excluded.manual_adjustment,manual_used_days=excluded.manual_used_days,manual_override=true,
      adjustment_note=excluded.adjustment_note,updated_by=excluded.updated_by,updated_at=now()`,
    [employeeId,year,entitled,adjustment,manualUsed,clean(req.body?.adjustment_note).slice(0,500),req.user.name]);
  res.json({ok:true});
}));

app.get('/api/annual-leave-balances/:employeeId/usage', asyncRoute(async (req,res)=>{
  const employeeId=Number(req.params.employeeId);
  if (!Number.isInteger(employeeId)) return res.status(400).json({error:'Geçersiz çalışan'});
  const employee=await pool.query('select id,name,department from employees where id=$1',[employeeId]);
  if (!employee.rowCount) return res.status(404).json({error:'Çalışan bulunamadı'});
  // Yalnızca yıllık izin ekranındaki kapsamına giren çalışan için.
  const scope=visibleDepartments(req.user);
  const allowed = scope===null
    || (Array.isArray(scope) && scope.length && scope.includes(clean(employee.rows[0].department)))
    || String(req.user.employee_id||'')===String(employeeId);
  if (!allowed) return res.status(403).json({error:'Bu çalışanın izin kullanım detayını görme yetkiniz yok'});
  const rows=(await pool.query(`
    select to_char(start_date,'YYYY-MM-DD') as start_date, to_char(end_date,'YYYY-MM-DD') as end_date,
           week_rest_days, official_holiday_days, used_days, source
    from leave_usage_records where employee_id=$1
    order by start_date nulls last, id`,[employeeId])).rows;
  const total=rows.reduce((sum,row)=>sum+Number(row.used_days||0),0);
  res.json({employee:{id:employee.rows[0].id,name:employee.rows[0].name,department:employee.rows[0].department},total_used:total,records:rows});
}));

app.get('/api/leaves', asyncRoute(async (req, res) => {
  const rows = (await pool.query('select * from leave_requests order by start_date desc,id desc')).rows;
  res.json(rows.filter(row => approvalCanSee(row, req.user, 'Bekliyor')).map(row => decorateApproval(row, req.user, 'Bekliyor')));
}));

app.post('/api/leaves', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const employeeId = Number(body.employee_id);
  if (!Number.isInteger(employeeId) || !dateOnly(body.start_date) || !dateOnly(body.end_date) || body.end_date < body.start_date || !Number.isInteger(Number(body.days)) || Number(body.days) <= 0) {
    return res.status(400).json({ error: 'Çalışan, geçerli tarih aralığı ve izin süresi zorunludur' });
  }
  if (dateDistance(body.end_date, body.start_date) > 40) {
    return res.status(400).json({ error: 'İzin bitiş tarihi başlangıçtan en fazla 40 gün sonra olabilir' });
  }
  const employee = await pool.query('select id,name,department from employees where id=$1 and status=$2', [employeeId, 'Aktif']);
  if (!employee.rowCount) return res.status(404).json({ error: 'Aktif çalışan bulunamadı' });
  if (req.user.role !== 'Sistem yöneticisi' && (!req.user.employee_id || String(req.user.employee_id) !== String(employeeId))) {
    return res.status(403).json({ error: 'Yalnızca kendi adınıza izin talebi oluşturabilirsiniz' });
  }
  const person = employee.rows[0];
  const route = await approvalRouteFor('leave', person.department);
  const result = await pool.query(`insert into leave_requests(employee_id,employee_name,department,requester_user_id,requester_user_name,
    leave_type,start_date,end_date,days,status,approval_route,approval_step,current_approver)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,'Bekliyor',$10::jsonb,0,$11) returning *`,
  [person.id, person.name, person.department, req.user.id, req.user.name, clean(body.leave_type) || 'Yıllık izin', body.start_date, body.end_date, Number(body.days), JSON.stringify(route), route[0]]);
  res.status(201).json(decorateApproval(result.rows[0], req.user, 'Bekliyor'));
  notifyApprovalSms(result.rows[0], 'leave_requests');
}));

app.patch('/api/leaves/:id/decision', asyncRoute(async (req, res) => {
  const decision = clean(req.body?.decision).toLowerCase();
  const reason = clean(req.body?.reason);
  if (!['approve', 'reject'].includes(decision) || (decision === 'reject' && !reason)) return res.status(400).json({ error: 'Geçerli karar ve ret nedeni zorunludur' });
  const row = await decideApproval('leave_requests', req.params.id, req.user, decision, reason, 'Bekliyor', { escalate: Boolean(req.body?.escalate) });
  res.json(decorateApproval(row, req.user, 'Bekliyor'));
  if (decision === 'approve') notifyApprovalSms(row, 'leave_requests');
}));

app.delete('/api/leaves/:id', asyncRoute(async (req, res) => {
  const found = await pool.query('select * from leave_requests where id=$1', [req.params.id]);
  if (!found.rowCount) return res.status(404).json({ error: 'İzin talebi bulunamadı' });
  const row = found.rows[0];
  if (req.user.role !== 'Sistem yöneticisi' && !(approvalOwnedBy(row, req.user) && row.status === 'Bekliyor' && Number(row.approval_step || 0) === 0)) {
    return res.status(403).json({ error: 'Yalnızca ilk onayı bekleyen kendi talebinizi silebilirsiniz' });
  }
  await pool.query('delete from leave_requests where id=$1', [req.params.id]);
  res.status(204).end();
}));

app.get('/api/expenses', asyncRoute(async (req, res) => {
  const rows = (await pool.query('select * from expenses order by expense_date desc,id desc')).rows;
  res.json(rows.filter(row => approvalCanSee(row, req.user, 'Bekliyor')).map(row => decorateApproval(row, req.user, 'Bekliyor')));
}));

app.post('/api/expenses', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const employeeId = Number(body.employee_id);
  if (!Number.isInteger(employeeId) || !amount(body.amount) || !dateOnly(body.expense_date) || !clean(body.category)) return res.status(400).json({ error: 'Çalışan, kategori, tarih ve pozitif tutar zorunludur' });
  const employee = await pool.query('select id,name,department from employees where id=$1 and status=$2', [employeeId, 'Aktif']);
  if (!employee.rowCount) return res.status(404).json({ error: 'Aktif çalışan bulunamadı' });
  if (req.user.role !== 'Sistem yöneticisi' && (!req.user.employee_id || String(req.user.employee_id) !== String(employeeId))) {
    return res.status(403).json({ error: 'Yalnızca kendi adınıza masraf talebi oluşturabilirsiniz' });
  }
  const person = employee.rows[0];
  const route = await approvalRouteFor('expense', person.department);
  const result = await pool.query(`insert into expenses(employee_id,employee_name,department,requester_user_id,requester_user_name,category,
    expense_date,amount,currency,description,receipt_no,status,current_approver,approval_route,approval_step)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Bekliyor',$12,$13::jsonb,0) returning *`,
  [person.id, person.name, person.department, req.user.id, req.user.name, clean(body.category), body.expense_date, amount(body.amount), clean(body.currency) || 'TRY', clean(body.description), clean(body.receipt_no), route[0], JSON.stringify(route)]);
  res.status(201).json(decorateApproval(result.rows[0], req.user, 'Bekliyor'));
  notifyApprovalSms(result.rows[0], 'expenses');
}));

app.patch('/api/expenses/:id/decision', asyncRoute(async (req, res) => {
  const decision = clean(req.body?.decision).toLowerCase();
  const reason = clean(req.body?.reason);
  if (!['approve', 'reject'].includes(decision) || (decision === 'reject' && !reason)) return res.status(400).json({ error: 'Geçerli karar ve ret nedeni zorunludur' });
  const row = await decideApproval('expenses', req.params.id, req.user, decision, reason, 'Bekliyor');
  res.json(decorateApproval(row, req.user, 'Bekliyor'));
  if (decision === 'approve') notifyApprovalSms(row, 'expenses');
}));

app.patch('/api/expenses/:id/status', asyncRoute(async (req, res) => {
  if (clean(req.body?.status) !== 'Ödendi') return res.status(400).json({ error: 'Yalnızca ödeme durumu güncellenebilir' });
  if (req.user.role !== 'Sistem yöneticisi' && !['Mali İşler', 'Finans yöneticisi', 'Bordro yetkilisi'].includes(req.user.role)) return res.status(403).json({ error: 'Ödeme işareti için mali yetki gerekiyor' });
  const result = await pool.query("update expenses set status='Ödendi',updated_at=now() where id=$1 and status='Onaylandı' returning *", [req.params.id]);
  if (!result.rowCount) return res.status(409).json({ error: 'Yalnızca tamamen onaylanmış masraf ödenebilir' });
  res.json(decorateApproval(result.rows[0], req.user, 'Bekliyor'));
}));

app.delete('/api/expenses/:id', asyncRoute(async (req, res) => {
  const found = await pool.query('select * from expenses where id=$1', [req.params.id]);
  if (!found.rowCount) return res.status(404).json({ error: 'Masraf bulunamadı' });
  const row = found.rows[0];
  if (req.user.role !== 'Sistem yöneticisi' && !(approvalOwnedBy(row, req.user) && row.status === 'Bekliyor' && Number(row.approval_step || 0) === 0)) return res.status(403).json({ error: 'Yalnızca ilk onayı bekleyen kendi talebinizi silebilirsiniz' });
  await pool.query('delete from expenses where id=$1', [req.params.id]);
  res.status(204).end();
}));

app.get('/api/advances', asyncRoute(async (req, res) => {
  const rows = (await pool.query('select * from advances order by requested_date desc,id desc')).rows;
  res.json(rows.filter(row => approvalCanSee(row, req.user, 'Onay Sürecinde')).map(row => decorateApproval(row, req.user, 'Onay Sürecinde')));
}));

app.post('/api/advances', asyncRoute(async (req, res) => {
  const body = req.body || {};
  const employeeId = Number(body.employee_id);
  if (!Number.isInteger(employeeId) || !amount(body.amount) || !dateOnly(body.requested_date)) return res.status(400).json({ error: 'Çalışan, tarih ve pozitif tutar zorunludur' });
  const employee = await pool.query('select id,name,department from employees where id=$1 and status=$2', [employeeId, 'Aktif']);
  if (!employee.rowCount) return res.status(404).json({ error: 'Aktif çalışan bulunamadı' });
  if (req.user.role !== 'Sistem yöneticisi' && (!req.user.employee_id || String(req.user.employee_id) !== String(employeeId))) return res.status(403).json({ error: 'Yalnızca kendi adınıza avans talebi oluşturabilirsiniz' });
  const person = employee.rows[0];
  const route = await approvalRouteFor('advance', person.department);
  const result = await pool.query(`insert into advances(employee_id,employee_name,department,requester_user_id,requester_user_name,requested_date,
    amount,currency,deduction_month,reason,status,approval_stage,current_approver,approval_route,approval_step)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Onay Sürecinde',$11,$12,$13::jsonb,0) returning *`,
  [person.id, person.name, person.department, req.user.id, req.user.name, body.requested_date, amount(body.amount), clean(body.currency) || 'TRY', dateOnly(body.deduction_month), clean(body.reason), approvalStageKey(route[0]), route[0], JSON.stringify(route)]);
  res.status(201).json(decorateApproval(result.rows[0], req.user, 'Onay Sürecinde'));
  notifyApprovalSms(result.rows[0], 'advances');
}));

app.patch('/api/advances/:id/decision', asyncRoute(async (req, res) => {
  const decision = clean(req.body?.decision).toLowerCase();
  const reason = clean(req.body?.reason);
  if (!['approve', 'reject'].includes(decision) || (decision === 'reject' && !reason)) return res.status(400).json({ error: 'Geçerli karar ve ret nedeni zorunludur' });
  const row = await decideApproval('advances', req.params.id, req.user, decision, reason, 'Onay Sürecinde');
  res.json(decorateApproval(row, req.user, 'Onay Sürecinde'));
  if (decision === 'approve') notifyApprovalSms(row, 'advances');
}));

app.get('/api/advances/:id/form', asyncRoute(async (req, res) => {
  const result = await pool.query('select * from advances where id=$1', [req.params.id]);
  if (!result.rowCount) return res.status(404).send('Avans bulunamadı');
  const advance = result.rows[0];
  if (!approvalCanSee(advance, req.user, 'Onay Sürecinde')) return res.status(403).send('Bu avans kaydını görüntüleme yetkiniz yok');
  if (advance.status !== 'Onaylandı') return res.status(409).send('Avans formu yalnızca tüm onaylar tamamlandıktan sonra alınabilir');
  const html = value => clean(value).replace(/[&<>"']/g, character => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[character]));
  const formatDate = value => value ? new Date(value).toLocaleDateString('tr-TR', { timeZone: 'Europe/Istanbul' }) : '-';
  const approvals = approvalHistory(advance).filter(item => item.decision === 'approve').map(item => `<div class="sign"><strong>${html(item.approver)}</strong>${html(item.user_name)}<br>${formatDate(item.decided_at)}</div>`).join('');
  res.type('html').send(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Onaylı Avans Formu #${advance.id}</title><style>
    body{font-family:Arial,sans-serif;color:#17233b;margin:32px}.form{max-width:850px;margin:auto;border:2px solid #17233b;padding:28px}h1{text-align:center;font-size:22px;margin:0 0 24px}.approved{text-align:center;color:#14845d;font-weight:700;margin-bottom:22px}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #8992a3}.cell{padding:12px;border-right:1px solid #8992a3;border-bottom:1px solid #8992a3}.cell:nth-child(even){border-right:0}.wide{grid-column:1/-1;border-right:0}.label{font-size:11px;color:#667085;display:block;margin-bottom:5px}.approvals{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px}.sign{border:1px solid #8992a3;min-height:80px;padding:12px}.sign strong{display:block;margin-bottom:12px}.actions{text-align:center;margin-top:22px}@media print{.actions{display:none}body{margin:0}.form{border:1px solid #000}}
  </style></head><body><div class="form"><h1>ONAYLI PERSONEL AVANS FORMU</h1><div class="approved">✓ ONAYLANDI</div><div class="grid">
    <div class="cell"><span class="label">Form No</span>${advance.id}</div><div class="cell"><span class="label">Talep Tarihi</span>${formatDate(advance.requested_date)}</div>
    <div class="cell"><span class="label">Personel</span>${html(advance.employee_name)}</div><div class="cell"><span class="label">Departman</span>${html(advance.department)}</div>
    <div class="cell"><span class="label">Avans Tutarı</span>${Number(advance.amount).toLocaleString('tr-TR',{style:'currency',currency:advance.currency||'TRY'})}</div><div class="cell"><span class="label">Mahsup Ayı</span>${formatDate(advance.deduction_month)}</div>
    <div class="cell wide"><span class="label">Talep Nedeni</span>${html(advance.reason) || '-'}</div></div>
    <div class="approvals">${approvals}</div><div class="actions"><button onclick="window.print()">Yazdır / PDF</button></div></div></body></html>`);
}));

app.delete('/api/advances/:id', asyncRoute(async (req, res) => {
  const found = await pool.query('select * from advances where id=$1', [req.params.id]);
  if (!found.rowCount) return res.status(404).json({ error: 'Avans bulunamadı' });
  const row = found.rows[0];
  if (req.user.role !== 'Sistem yöneticisi' && !(approvalOwnedBy(row, req.user) && row.status === 'Onay Sürecinde' && Number(row.approval_step || 0) === 0)) return res.status(403).json({ error: 'Yalnızca ilk onayı bekleyen kendi talebinizi silebilirsiniz' });
  await pool.query('delete from advances where id=$1', [req.params.id]);
  res.status(204).end();
}));

// --- İşe alım / aday takip ---
const candidateStatuses = new Set(['Yeni başvuru', 'Ön görüşme', 'Mülakat', 'Teklif gönderildi', 'İşe alındı', 'Olumsuz']);
const canManageCandidates = user => isHRUser(user);

app.get('/api/candidates', asyncRoute(async (req, res) => {
  if (canManageCandidates(req.user)) {
    return res.json((await pool.query('select * from candidates order by created_at desc, id desc')).rows);
  }
  // Departman yöneticisi yalnızca kendi departmanının İK onaylı adaylarını görür.
  const scope = visibleDepartments(req.user);
  if (!Array.isArray(scope) || !scope.length) {
    return res.status(403).json({ error: 'İşe alım kayıtlarını görme yetkiniz yok' });
  }
  const rows = (await pool.query(
    'select * from candidates where hr_approved=true and department = any($1) order by created_at desc, id desc', [scope]
  )).rows;
  res.json(rows);
}));

app.post('/api/candidates', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canManageCandidates, 'Aday ekleme yetkiniz yok')) return;
  const b = req.body || {};
  const name = clean(b.name);
  if (!name) return res.status(400).json({ error: 'Aday adı zorunludur' });
  const status = candidateStatuses.has(clean(b.status)) ? clean(b.status) : 'Yeni başvuru';
  const result = await pool.query(`
    insert into candidates(name,email,phone,position,department,status,cv_name,interview_date,notes,created_by)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *`,
  [name, clean(b.email), clean(b.phone), clean(b.position), clean(b.department), status,
    clean(b.cv_name), dateOnly(b.interview_date), clean(b.notes), req.user.name]);
  res.status(201).json(result.rows[0]);
}));

app.put('/api/candidates/:id', asyncRoute(async (req, res) => {
  const found = await pool.query('select * from candidates where id=$1', [req.params.id]);
  if (!found.rowCount) return res.status(404).json({ error: 'Aday bulunamadı' });
  const row = found.rows[0];
  const b = req.body || {};
  const status = candidateStatuses.has(clean(b.status)) ? clean(b.status) : row.status;
  if (canManageCandidates(req.user)) {
    const result = await pool.query(`
      update candidates set name=$1,email=$2,phone=$3,position=$4,department=$5,status=$6,
        cv_name=$7,interview_date=$8,notes=$9,updated_at=now() where id=$10 returning *`,
    [clean(b.name) || row.name, clean(b.email), clean(b.phone), clean(b.position), clean(b.department), status,
      clean(b.cv_name), dateOnly(b.interview_date), clean(b.notes), row.id]);
    return res.json(result.rows[0]);
  }
  // Departman yöneticisi: yalnızca kendi departmanının İK onaylı adayında durum + not.
  const scope = visibleDepartments(req.user);
  if (!row.hr_approved || !Array.isArray(scope) || !scope.includes(clean(row.department))) {
    return res.status(403).json({ error: 'Bu aday kaydını düzenleme yetkiniz yok' });
  }
  const result = await pool.query(
    'update candidates set status=$1,notes=$2,updated_at=now() where id=$3 returning *',
    [status, clean(b.notes), row.id]);
  res.json(result.rows[0]);
}));

app.patch('/api/candidates/:id/approve', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canManageCandidates, 'Aday onaylama yetkiniz yok')) return;
  const approved = req.body?.approved !== false;
  const found = await pool.query('select * from candidates where id=$1', [req.params.id]);
  if (!found.rowCount) return res.status(404).json({ error: 'Aday bulunamadı' });
  if (approved && !clean(found.rows[0].department)) {
    return res.status(400).json({ error: 'Önce adaya bir departman atayın' });
  }
  const result = await pool.query(`
    update candidates set hr_approved=$1,
      hr_approved_by=case when $1 then $2 else null end,
      hr_approved_at=case when $1 then now() else null end,
      updated_at=now() where id=$3 returning *`,
  [approved, req.user.name, req.params.id]);
  res.json(result.rows[0]);
}));

app.delete('/api/candidates/:id', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canManageCandidates, 'Aday silme yetkiniz yok')) return;
  const result = await pool.query('delete from candidates where id=$1', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Aday bulunamadı' });
  res.status(204).end();
}));

// --- Güvenlik ve Kayıp/Bulunan Eşyalar (HMS modülü) ------------------
const normalizeDepartmentValue = value => clean(value).toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
const HMS_MODULES = new Set(['visitors', 'vehicles', 'fleet', 'staff_status', 'lost_items', 'lost_approvals']);
const hmsSeesAll = user => ['Sistem yöneticisi', 'İK yöneticisi', 'Güvenlik'].includes(user.role) || clean(user.department) === 'İnsan Kaynakları';
const canUseHms = user => hmsSeesAll(user) || isDepartmentManager(user);
const hmsNow = () => new Date().toLocaleString('tr-TR');
const hmsRow = r => ({ id: r.id, department: r.department, ...r.data, created_at: r.created_at, updated_at: r.updated_at });
const hmsGet = async id => (await pool.query('select * from hms_records where id=$1', [Number(id) || 0])).rows[0] || null;
const hmsInsert = async (module, department, data, user) => hmsRow((await pool.query(
  'insert into hms_records(module,department,data,created_by) values($1,$2,$3::jsonb,$4) returning *',
  [module, clean(department), JSON.stringify(data), user?.name || null])).rows[0]);
const hmsUpdate = async (id, department, data) => {
  const r = (await pool.query('update hms_records set department=$2,data=$3::jsonb,updated_at=now() where id=$1 returning *',
    [id, clean(department), JSON.stringify(data)])).rows[0];
  return r ? hmsRow(r) : null;
};
const hmsCleanBody = body => {
  const out = { ...(body || {}) };
  ['id', 'department', 'module', 'created_at', 'updated_at', 'created_by'].forEach(k => delete out[k]);
  return out;
};
const hmsImageOk = data => !data.image || String(data.image).length <= 900000;

app.get('/api/hms/:module', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canUseHms, 'Bu modüle erişim yetkiniz yok')) return;
  const module = clean(req.params.module);
  if (!HMS_MODULES.has(module)) return res.status(404).json({ error: 'Geçersiz modül' });
  const params = [module];
  let scope = '';
  if (!hmsSeesAll(req.user)) { params.push(clean(req.user.department)); scope = ' and department=$2'; }
  const rows = (await pool.query(`select * from hms_records where module=$1${scope} order by id desc`, params)).rows;
  res.json(rows.map(hmsRow));
}));

app.post('/api/hms/:module', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canUseHms, 'Kayıt ekleme yetkiniz yok')) return;
  const module = clean(req.params.module);
  if (!HMS_MODULES.has(module) || module === 'lost_approvals') return res.status(400).json({ error: 'Bu modüle kayıt eklenemez' });
  const body = req.body || {};
  const department = hmsSeesAll(req.user) ? (clean(body.department) || clean(req.user.department)) : clean(req.user.department);
  const data = hmsCleanBody(body);
  if (!hmsImageOk(data)) return res.status(400).json({ error: 'Resim çok büyük (en fazla ~600 KB)' });
  if (module === 'lost_items') {
    data.foundDate = clean(data.foundDate) || hmsNow();
    data.processDate = hmsNow();
    data.storage = department || 'KAT HİZMETLERİ';
    data.status = clean(data.status) || 'Beklemede';
    data.approval = 'Onaylandı';
    data.transferStatus = '—';
    data.history = [];
  }
  if (['visitors', 'staff_status'].includes(module)) data.status = clean(data.status) || 'İçeride';
  res.status(201).json(await hmsInsert(module, department, data, req.user));
}));

app.patch('/api/hms/:module/:id', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canUseHms, 'Kayıt düzenleme yetkiniz yok')) return;
  const module = clean(req.params.module);
  const existing = await hmsGet(req.params.id);
  if (!existing || existing.module !== module) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  if (!hmsSeesAll(req.user) && clean(existing.department) !== clean(req.user.department)) {
    return res.status(403).json({ error: 'Yalnızca kendi departmanınızın kayıtlarını düzenleyebilirsiniz' });
  }
  const body = req.body || {};
  const data = { ...existing.data, ...hmsCleanBody(body) };
  if (!hmsImageOk(data)) return res.status(400).json({ error: 'Resim çok büyük (en fazla ~600 KB)' });
  const department = hmsSeesAll(req.user) && body.department != null ? clean(body.department) : existing.department;
  res.json(await hmsUpdate(existing.id, department, data));
}));

app.delete('/api/hms/:module/:id', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canUseHms, 'Kayıt silme yetkiniz yok')) return;
  const existing = await hmsGet(req.params.id);
  if (!existing || existing.module !== clean(req.params.module)) return res.status(404).json({ error: 'Kayıt bulunamadı' });
  if (!hmsSeesAll(req.user) && clean(existing.department) !== clean(req.user.department)) {
    return res.status(403).json({ error: 'Yalnızca kendi departmanınızın kayıtlarını silebilirsiniz' });
  }
  await pool.query('delete from hms_records where id=$1', [existing.id]);
  res.status(204).end();
}));

app.post('/api/hms/lost-items/:id/transfer', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canUseHms, 'Transfer yetkiniz yok')) return;
  const item = await hmsGet(req.params.id);
  if (!item || item.module !== 'lost_items') return res.status(404).json({ error: 'Eşya bulunamadı' });
  if (!hmsSeesAll(req.user) && clean(item.department) !== clean(req.user.department)) {
    return res.status(403).json({ error: 'Yalnızca kendi departmanınızın eşyasını transfer edebilirsiniz' });
  }
  const b = req.body || {};
  const target = clean(b.targetDepartment), sender = clean(b.sender), receiver = clean(b.receiver);
  if (!target || !sender || !receiver) return res.status(400).json({ error: 'Hedef departman, teslim eden ve teslim alan zorunludur' });
  const from = clean(item.data.storage || item.department);
  if (normalizeDepartmentValue(target) === normalizeDepartmentValue(from)) return res.status(400).json({ error: 'Hedef departman kaynakla aynı olamaz' });
  if (item.data.transferStatus === 'Beklemede') return res.status(409).json({ error: 'Bu eşya için bekleyen bir transfer zaten var' });
  const processDate = hmsNow();
  const approval = await hmsInsert('lost_approvals', target, {
    sourceLostId: item.id, item: item.data.item, category: item.data.category, location: item.data.location,
    foundDate: item.data.foundDate, processDate, fromDepartment: from, targetDepartment: target,
    transferSender: sender, transferReceiver: receiver, storage: target, status: 'Beklemede'
  }, req.user);
  const history = Array.isArray(item.data.history) ? item.data.history.slice() : [];
  history.push({ processDate, transferStatus: 'Beklemede', transferSender: sender, transferReceiver: receiver, targetDepartment: target, storage: item.data.storage, status: 'Beklemede' });
  await hmsUpdate(item.id, item.department, { ...item.data, transferStatus: 'Beklemede', targetDepartment: target, transferSender: sender, transferReceiver: receiver, currentLocation: 'Onay Bekliyor', history });
  res.status(201).json(approval);
}));

app.post('/api/hms/lost-approvals/:id/decision', asyncRoute(async (req, res) => {
  if (!requireRole(req, res, canUseHms, 'Yetkiniz yok')) return;
  const decision = clean(req.body?.decision);
  if (!['Onaylandı', 'Reddedildi'].includes(decision)) return res.status(400).json({ error: 'Geçerli bir karar seçin' });
  const appr = await hmsGet(req.params.id);
  if (!appr || appr.module !== 'lost_approvals') return res.status(404).json({ error: 'Onay kaydı bulunamadı' });
  if (appr.data.status !== 'Beklemede') return res.status(409).json({ error: 'Bu transfer zaten sonuçlanmış' });
  const target = clean(appr.data.targetDepartment);
  if (!hmsSeesAll(req.user) && !(isDepartmentManager(req.user) && normalizeDepartmentValue(req.user.department) === normalizeDepartmentValue(target))) {
    return res.status(403).json({ error: 'Bu transferi yalnızca hedef departman sonuçlandırabilir' });
  }
  const item = await hmsGet(appr.data.sourceLostId);
  if (item && item.module === 'lost_items') {
    const processDate = hmsNow();
    const history = Array.isArray(item.data.history) ? item.data.history.slice() : [];
    history.push({ processDate, transferStatus: decision, transferSender: appr.data.transferSender, transferReceiver: appr.data.transferReceiver, targetDepartment: target, storage: decision === 'Onaylandı' ? target : item.data.storage, status: decision });
    const nextData = decision === 'Onaylandı'
      ? { ...item.data, storage: target, transferStatus: 'Onaylandı', currentLocation: target, receiver: appr.data.transferReceiver, targetDepartment: '', transferSender: '', transferReceiver: '', history }
      : { ...item.data, transferStatus: 'Reddedildi', currentLocation: item.data.storage, targetDepartment: '', transferSender: '', transferReceiver: '', history };
    await hmsUpdate(item.id, decision === 'Onaylandı' ? target : item.department, nextData);
  }
  await hmsUpdate(appr.id, appr.department, { ...appr.data, status: decision });
  res.json({ ok: true, decision });
}));

async function seedHmsIfEmpty() {
  if ((await pool.query('select 1 from hms_records limit 1')).rowCount) return;
  const D = ['ÖN BÜRO', 'KAT HİZMETLERİ', 'TEKNİK SERVİS', 'MİSAFİR İLİŞKİLERİ', 'GÜVENLİK'];
  const people = ['Erol Şimşek', 'Sercan Doğan', 'Cemal Olgun', 'Kahraman Ordu', 'Okan Peyman', 'Mehmet Kemal Yılmaz', 'Halil Atile', 'Burak Kürekçi'];
  const seed = [];
  people.forEach((name, i) => seed.push(['visitors', D[i % D.length], {
    date: `0${7 + (i % 2)}.09.2026 09:${String(10 + i * 4).padStart(2, '0')}:00`, type: i % 3 === 0 ? 'Personel' : 'Misafir',
    name, company: i % 3 === 0 ? 'TEKNİK SERVİS' : 'KONAKLAMALI MİSAFİR', plate: `34 ${['AJT', 'MHH', 'RPX', 'CBN'][i % 4]} ${String(120 + i * 7).padStart(3, '0')}`,
    identity: 'Kart Verilmedi', count: 1 + i % 3, status: i < 5 ? 'İçeride' : 'Çıkış Yaptı', exit: i < 5 ? '—' : '07.09.2026 17:20:00'
  }]));
  [['34 AJT 851', 'Ford', 'Transit'], ['48 RP 174', 'Renault', 'Clio'], ['34 MHH 220', 'Fiat', 'Doblo']].forEach(([plate, brand, model], i) => {
    seed.push(['fleet', 'GÜVENLİK', { plate, brand, model, startKm: 100000 + i * 25000, lastKm: 108000 + i * 25000, disabled: 'Hayır' }]);
    seed.push(['vehicles', D[i % D.length], {
      departure: `0${6 + i}.09.2026 08:${String(15 + i * 5).padStart(2, '0')}:00`, plate, driver: people[i], requester: people[i + 3],
      destination: ['Havalimanı', 'Merkez tedarikçi', 'Bakım servisi'][i], status: i === 0 ? 'Dönüş Yaptı' : 'Ayrıldı',
      km: 108000 + i * 25000, returnDate: i === 0 ? '06.09.2026 12:30:00' : '—', returnKm: i === 0 ? 108120 : '—', fault: 'Yok'
    }]);
  });
  people.forEach((name, i) => seed.push(['staff_status', D[i % D.length], {
    name, entry: i % 4 === 3 ? '—' : `08.09.2026 0${7 + i % 3}:${String(9 + i * 5).padStart(2, '0')}:00`,
    status: i % 4 === 3 ? 'Henüz Giriş Yapmadı' : 'İçeride', exit: '—',
    title: ['Müdür Yardımcısı', 'Güvenlik', 'Rezervasyon Görevlisi', 'Tekniker'][i % 4], department: D[i % D.length]
  }]));
  const lost = [
    ['Sun club yazılı mavi çocuk mayo', 'Deniz/Havuz Malzemeleri', 'genel alan'],
    ['Superdry yazılı beyaz şapka', 'Tekstil', 'miniclub'],
    ['Siyah renk deniz şortu', 'Deniz/Havuz Malzemeleri', 'genel alan'],
    ['Mor unicorn desenli kız çocuk şapka', 'Tekstil', 'miniclub'],
    ['Papatya çerçeveli kız çocuk gözlük', 'Gözlük', 'lobi'],
    ['Apple şarj aleti', 'Elektronik', 'restoran'],
    ['İpekyol marka hasır şapka', 'Tekstil', 'plaj'],
    ['Beyaz renk crocs terlik', 'Ayakkabı/Terlik', 'havuz başı']
  ];
  lost.forEach(([item, category, location], i) => seed.push(['lost_items', 'KAT HİZMETLERİ', {
    foundDate: `0${6 + i % 3}.09.2026 10:${String(45 - i * 3).padStart(2, '0')}:00`, processDate: `0${6 + i % 3}.09.2026 10:${String(50 - i * 3).padStart(2, '0')}:00`,
    item, category, location, storage: 'KAT HİZMETLERİ', status: 'Beklemede', approval: 'Onaylandı', transferStatus: '—', receiver: '—', history: []
  }]));
  for (const [module, dept, data] of seed) {
    await pool.query('insert into hms_records(module,department,data,created_by) values($1,$2,$3::jsonb,$4)', [module, dept, JSON.stringify(data), 'Örnek veri']);
  }
  console.log(`HMS örnek verisi yüklendi: ${seed.length} kayıt`);
}

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.status ? error.message : 'Sunucu hatası' });
});

app.listen(3000, () => {
  runShiftTransferIfDue();
  const shiftTransferTimer = setInterval(runShiftTransferIfDue, 60000);
  shiftTransferTimer.unref();
  seedHmsIfEmpty().catch(cause => console.error('HMS örnek verisi yüklenemedi', cause?.message || cause));
});
