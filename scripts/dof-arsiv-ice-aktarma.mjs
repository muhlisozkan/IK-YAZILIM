// Tek seferlik göç betiği (2026-09-11) — Entegre Yönetim Sistemi Kayıtlar >
// DÜZELTİCİ FAALİYETLER klasöründeki gerçek DÖF formlarını DÖF Takip modülüne
// (kys_records, module='dof') içerik-bazlı ayrıştırarak aktarır.
//
// v2: İlk sürüm (yalnız dosya adı/klasör yolundan tahmin) yerine — her Excel
// dosyası LibreOffice/exceljs ile açılıp "FR/QM/004 Düzeltici Önleyici
// Faaliyet Formu" alan etiketleri (FAALİYET SORUMLUSU, UYGUNSUZLUK KATEGORİSİ,
// TESPİT EDİLEN UYGUNSUZLUK, AÇIK/KAPATILDI vb.) okunuyor. Bu sayede:
//  - "DÖF GENEL TABLO" ve yıl klasörlerindeki düz dosyalar aslında departman
//    bazlı ÖZET/istatistik tablolarıdır (tek DÖF değil) — ilk sürüm bunları
//    yanlışlıkla birer DÖF kaydı olarak eklemişti; artık tanınıp atlanıyor.
//  - Departman, hem klasör yolundan hem form içeriğinden (UYGUNSUZLUK
//    KATEGORİSİ / FAALİYET SORUMLUSU) tahmin ediliyor — 93/93 dosyada eşleşti.
//  - Durum (Açık/Kapatıldı) form içindeki gerçek durum alanlarından okunuyor,
//    artık hepsi "Kapatıldı" varsayılmıyor (68 Kapatıldı, 25 Açık bulundu —
//    2025/2026 klasörlerindeki güncel DÖF'lerin çoğu hâlâ açık).
//
// Yeniden çalıştırma: ik-api konteynerine kopyalayıp `node dof-arsiv-ice-aktarma.mjs`
// (önce DOF_IMPORT_DRY=1 ile deneyin — DB'ye yazmaz, yalnızca özet basar).
// Not: önceki (hatalı) import'u temizlemek için önce
//   docker exec ik-db psql -U ik -d ik -c "delete from kys_records where module='dof';"
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
import ExcelJS from 'exceljs';

const execFileAsync = promisify(execFile);
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://ik:ik@db:5432/ik' });
const ROOT = '/data/eys-kayitlar/DÜZELTİCİ FAALİYETLER';
const SKIP_DIR_RE = /^(YEDEK|YEDEKLER)$/i;
const SKIP_FILE_RE = /^(Thumbs\.db|\.DS_Store|~\$.*)$/i;

const normDept = v => String(v || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');
const normLabel = v => String(v || '').replace(/\s+/g, ' ').trim().toLocaleUpperCase('tr-TR');

const REAL_DEPTS = [
  'Ana Mutfak', 'Animasyon', 'Bahçe', 'Bilgi İşlem', 'Concierge', 'Eğitim ve Kalite',
  'Genel Müdürlük', 'Golf', 'Güvenlik', 'Kat Hizmetleri', 'Mali İşler', 'Merkez',
  'Mini Club', 'Misafir İlişkileri', 'Opm', 'Satınalma', 'Satış Pazarlama', 'Spa',
  'Stewarding', 'Teknik Bakım Onarım', 'Teknik Havuz', 'Teknik Servis',
  'Yiyecek İçecek - Bar', 'Yiyecek İçecek - Restaurant', 'Ön Büro', 'İnsan Kaynakları'
];
const HINT_MAP = {
  'BAHÇE': 'Bahçe', 'EĞLENCE': 'Animasyon', 'ENTERTAINMENT': 'Animasyon', 'GR': 'Misafir İlişkileri',
  'HK': 'Kat Hizmetleri', 'MALİ İŞLER': 'Mali İşler', 'MINI CLUB': 'Mini Club', 'MUTFAK': 'Ana Mutfak',
  'KIT': 'Ana Mutfak', 'SATINALMA': 'Satınalma', 'SATIN ALMA': 'Satınalma',
  'SATIŞ VE PAZARLAMA': 'Satış Pazarlama', 'SATIŞ PAZARLAMA': 'Satış Pazarlama',
  'SPA': 'Spa', 'TEKNİK': 'Teknik Servis', 'ÖNBÜRO': 'Ön Büro', 'ÖN BÜRO': 'Ön Büro', 'FO': 'Ön Büro',
  'İK VE EĞİTİM': 'İnsan Kaynakları', 'İK': 'İnsan Kaynakları', 'GÜVENLİK': 'Güvenlik', 'SEC': 'Güvenlik',
  'GOLF': 'Golf', 'F&B': 'Yiyecek İçecek - Restaurant', 'TOPLAM KALİTE': 'Eğitim ve Kalite', 'TQM': 'Eğitim ve Kalite'
};
const HINT_KEYS = Object.keys(HINT_MAP).sort((a, b) => b.length - a.length);

function guessDeptFromPath(relPathParts, filename) {
  const idx = relPathParts.findIndex(p => normDept(p) === 'DEPARTMANLAR');
  const folderHint = idx >= 0 && relPathParts[idx + 1] ? relPathParts[idx + 1]
    : relPathParts.length >= 2 ? relPathParts[relPathParts.length - 2] : ''; // dosyanın bulunduğu klasör
  const hf = normDept(folderHint);
  if (HINT_MAP[hf]) return HINT_MAP[hf];
  const hay = normDept(filename);
  for (const key of HINT_KEYS) if (hay.includes(key)) return HINT_MAP[key];
  return '';
}
function guessDeptFromContent(fields) {
  const candidates = [fields['UYGUNSUZLUK KATEGORİSİ'], fields['FAALİYET SORUMLUSU'], fields['FAALİYET TALEBİNDE BULUNAN']];
  for (const c of candidates) {
    if (!c) continue;
    const hay = normDept(c);
    for (const key of HINT_KEYS) if (hay.includes(key)) return HINT_MAP[key];
    for (const d of REAL_DEPTS) if (hay.includes(normDept(d))) return d;
  }
  return '';
}

function inferStatus(fields) {
  const openClose = fields['AÇIK / KAPATILDI'] || fields['AÇIK/KAPATILDI'] || fields['AÇIK / KAPANDI'];
  if (openClose) {
    const v = openClose.toLocaleUpperCase('tr-TR');
    if (v.includes('KAPA')) return 'Kapatıldı';
    if (v.includes('AÇIK')) return 'Açık';
  }
  const sonuc = fields['SONUÇ'];
  if (sonuc) {
    const v = sonuc.toLocaleUpperCase('tr-TR');
    if (v.includes('TAMAMLAN') || v.includes('KAPAT') || v.includes('KAPAN')) return 'Kapatıldı';
    if (v.includes('BEKLENİYOR') || v.includes('DEVAM')) return 'Açık';
  }
  const durum = fields['DÜZELTİCİ FAALİYET DURUMU'] || fields['DF DURUMU'];
  if (durum && durum.toLocaleUpperCase('tr-TR').includes('TAMAMLAN')) return 'Kapatıldı';
  const tamamlanma = fields['DF TAMAMLANMA TARİHİ'] || fields['DÜZELTME FAALİYETLERİ TAMAMLANMA TARİHİ'];
  if (tamamlanma && tamamlanma.trim()) return 'Kapatıldı';
  return 'Açık';
}

function cleanTitleFromFilename(name) {
  let t = path.basename(name, path.extname(name));
  t = t.replace(/^[A-ZÇĞİÖŞÜ&]+\s*-\s*DF-?\s*\d+\s*-?\s*/i, '');
  t = t.replace(/^DF\s*FORMU\s*/i, '');
  t = t.replace(/^\d{1,2}[.\/]\d{1,2}[.\/]\d{2,4}\s*/, '');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t || path.basename(name, path.extname(name));
}

async function readFormFields(absPath, tmpDir) {
  const ext = path.extname(absPath).toLowerCase();
  let xlsxPath = absPath;
  if (ext === '.xls') {
    await execFileAsync('soffice', ['--headless', '--norestore', '--convert-to', 'xlsx', '--outdir', tmpDir, absPath], { timeout: 60000, env: { ...process.env, HOME: tmpDir } });
    xlsxPath = path.join(tmpDir, path.basename(absPath, ext) + '.xlsx');
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const ws = wb.worksheets[0];
  const fields = {};
  let firstColA = '';
  let rowNum = 0;
  ws.eachRow({ includeEmpty: false }, row => {
    rowNum++;
    const a = normLabel(row.getCell(1).text);
    const b = row.getCell(2).text;
    if (rowNum === 1) firstColA = a;
    if (a) fields[a] = (b || '').trim();
  });
  if (ext === '.xls') await fsp.rm(xlsxPath, { force: true }).catch(() => {});
  // Özet/dashboard dosyaları "Departman" başlıklı geniş bir tablodur (tek DÖF formu değil).
  const isSummaryTable = firstColA === 'DEPARTMAN';
  return { fields, isSummaryTable };
}

async function walk(dir, relBase, out) {
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) {
      if (SKIP_DIR_RE.test(e.name)) continue;
      await walk(path.join(dir, e.name), relBase ? `${relBase}/${e.name}` : e.name, out);
    } else if (e.isFile()) {
      if (SKIP_FILE_RE.test(e.name)) continue;
      const ext = path.extname(e.name).toLowerCase();
      if (!['.xls', '.xlsx'].includes(ext)) continue; // yalnızca Excel formları — pdf/jpeg/msg atlanır
      out.push({ dir, name: e.name, rel: relBase ? `${relBase}/${e.name}` : e.name });
    }
  }
}

const files = [];
await walk(ROOT, 'DÜZELTİCİ FAALİYETLER', files);
console.log('Taranan Excel dosyası:', files.length);

const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'dof-scan-'));
let genuine = 0, skippedSummary = 0, skippedUnknown = 0, errors = 0;
let deptFound = 0, deptMissing = 0;
const deptCounts = {};
const records = [];

for (const f of files) {
  const abs = path.join(f.dir, f.name);
  let parsed;
  try { parsed = await readFormFields(abs, tmpDir); }
  catch (err) { errors++; console.log('HATA:', f.rel, '-', err.message.slice(0, 120)); continue; }
  const { fields, isSummaryTable } = parsed;
  if (isSummaryTable) { skippedSummary++; continue; }
  if (!fields['FAALİYET SORUMLUSU'] && !fields['UYGUNSUZLUK KATEGORİSİ'] && !fields['TESPİT EDİLEN UYGUNSUZLUK']) {
    skippedUnknown++; continue;
  }
  genuine++;
  const parts = f.rel.split('/');
  const department = guessDeptFromPath(parts, f.name) || guessDeptFromContent(fields);
  if (department) { deptFound++; deptCounts[department] = (deptCounts[department] || 0) + 1; } else deptMissing++;
  const title = cleanTitleFromFilename(f.name) || fields['TESPİT EDİLEN UYGUNSUZLUK']?.slice(0, 120) || f.name;
  const description = fields['TESPİT EDİLEN UYGUNSUZLUK'] || '';
  const rootCause = fields['UYGUNSUZLUĞUN KÖK NEDENİ'] || '';
  const nonconformitySource = fields['UYGUNSUZLUK KAYNAĞI'] || '';
  const requestedBy = fields['FAALİYET TALEBİNDE BULUNAN'] || '';
  const rawType = (fields['FAALİYET TÜRÜ'] || '').toLocaleUpperCase('tr-TR');
  const activityType = rawType.includes('ÖNLEYİCİ') ? 'Önleyici' : rawType.includes('GELİŞTİRİCİ') ? 'Geliştirici' : 'Düzeltici';
  const action = fields['DÜZELTME FAALİYETLERİ'] || fields['DÜZELTİCİ / ÖNLEYİCİ / GELİŞTİRİCİ FAALİYETLER'] || fields['DÜZELTİCİ /  GELİŞTİRİCİ FAALİYETLER'] || '';
  const actionOwner = fields['DÜZELTME FAALİYETİ SORUMLUSU'] || '';
  const completedActivities = fields['GERÇEKLEŞEN FAALİYETLER'] || '';
  const status = inferStatus(fields);
  records.push({ rel: f.rel, department, title, description, rootCause, nonconformitySource, requestedBy, activityType, action, actionOwner, completedActivities, status });
}

console.log('Gerçek DÖF formu:', genuine, '| Özet tablo (atlandı):', skippedSummary, '| Tanınmayan yapı (atlandı):', skippedUnknown, '| Hata:', errors);
console.log('Departman bulunan:', deptFound, '/ bulunamayan:', deptMissing);
console.log('Departman dağılımı:', deptCounts);
console.log('Durum dağılımı:', records.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {}));

if (!process.env.DOF_IMPORT_DRY) {
  for (const r of records) {
    const data = {
      title: r.title, description: r.description, rootCause: r.rootCause || undefined,
      nonconformitySource: r.nonconformitySource || undefined, requestedBy: r.requestedBy || undefined,
      activityType: r.activityType, dueDate: null, status: r.status,
      action: r.action || undefined, actionOwner: r.actionOwner || undefined,
      completedActivities: r.completedActivities || undefined, completedDate: null,
      archived: true, sourcePath: r.rel,
      history: [{ at: new Date().toISOString(), by: 'Arşiv İçe Aktarma', action: `Arşivden içe aktarıldı (${r.status})`, note: r.rel }]
    };
    await pool.query('insert into kys_records(module,department,data,created_by) values($1,$2,$3::jsonb,$4)',
      ['dof', normDept(r.department), JSON.stringify(data), 'Arşiv İçe Aktarma']);
  }
  console.log('DB\'ye yazıldı:', records.length);
} else {
  console.log('DRY RUN — DB\'ye yazılmadı. Örnekler:');
  records.slice(0, 3).forEach(r => console.log('-', r.rel, '→', r.department || '(departmansız)', '|', r.status, '|', r.title));
}
await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
await pool.end();
