// Tek seferlik göç betiği (2026-09-11 çalıştırıldı) — Entegre Yönetim Sistemi
// Kayıtlar > DÜZELTİCİ FAALİYETLER klasöründeki 154 eski dosyayı DÖF Takip
// modülüne (kys_records, module='dof') "Kapatıldı" arşiv kaydı olarak aktardı.
// Departman, klasör yapısından (DEPARTMANLAR/<X>) veya dosya adındaki
// anahtar kelimelerden best-effort tahmin edildi — 154 dosyadan 58'i
// eşleşti, 96'sı atanmamış bırakıldı (Kalite elle düzenleyebilir).
// Yeniden çalıştırma: ik-api konteynerine kopyalayıp `node dof-arsiv-ice-aktarma.mjs`
// (önce DOF_IMPORT_DRY=1 ile deneyin — DB'ye yazmaz, yalnızca özet basar).
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || 'postgres://ik:ik@db:5432/ik' });
const ROOT = '/data/eys-kayitlar/DÜZELTİCİ FAALİYETLER';
const SKIP_DIR_RE = /^(YEDEK|YEDEKLER)$/i;
const SKIP_FILE_RE = /^(Thumbs\.db|\.DS_Store)$/i;
const SKIP_EXT = new Set(['.tmp', '.xlk', '.ds_store']);

const normDept = v => String(v || '').trim().toLocaleUpperCase('tr-TR').replace(/\s+/g, ' ');

const REAL_DEPTS = [
  'Ana Mutfak', 'Animasyon', 'Bahçe', 'Bilgi İşlem', 'Concierge', 'Eğitim ve Kalite',
  'Genel Müdürlük', 'Golf', 'Güvenlik', 'Kat Hizmetleri', 'Mali İşler', 'Merkez',
  'Mini Club', 'Misafir İlişkileri', 'Opm', 'Satınalma', 'Satış Pazarlama', 'Spa',
  'Stewarding', 'Teknik Bakım Onarım', 'Teknik Havuz', 'Teknik Servis',
  'Yiyecek İçecek - Bar', 'Yiyecek İçecek - Restaurant', 'Ön Büro', 'İnsan Kaynakları'
];
const HINT_MAP = {
  'BAHÇE': 'Bahçe', 'EĞLENCE': 'Animasyon', 'GR': 'Misafir İlişkileri', 'HK': 'Kat Hizmetleri',
  'MALİ İŞLER': 'Mali İşler', 'MINI CLUB': 'Mini Club', 'MUTFAK': 'Ana Mutfak',
  'SATINALMA': 'Satınalma', 'SATIŞ VE PAZARLAMA': 'Satış Pazarlama', 'SATIŞ PAZARLAMA': 'Satış Pazarlama',
  'SPA': 'Spa', 'TEKNİK': 'Teknik Servis', 'ÖNBÜRO': 'Ön Büro', 'ÖN BÜRO': 'Ön Büro',
  'İK VE EĞİTİM': 'İnsan Kaynakları', 'GÜVENLİK': 'Güvenlik', 'GOLF': 'Golf'
};
const HINT_KEYS = Object.keys(HINT_MAP).sort((a, b) => b.length - a.length);

function guessDept(relPathParts, filename) {
  const idx = relPathParts.findIndex(p => normDept(p) === 'DEPARTMANLAR');
  if (idx >= 0 && relPathParts[idx + 1]) {
    const hint = normDept(relPathParts[idx + 1]);
    if (HINT_MAP[hint]) return HINT_MAP[hint];
  }
  const hay = normDept(filename);
  for (const key of HINT_KEYS) if (hay.includes(key)) return HINT_MAP[key];
  for (const d of REAL_DEPTS) if (hay.includes(normDept(d))) return d;
  return '';
}

function guessYear(relPathParts, filename) {
  const hay = relPathParts.join(' ') + ' ' + filename;
  const m = hay.match(/20\d{2}/);
  return m ? m[0] : '';
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
      if (SKIP_EXT.has(ext)) continue;
      out.push({ dir, name: e.name, rel: relBase ? `${relBase}/${e.name}` : e.name });
    }
  }
}

const files = [];
await walk(ROOT, 'DÜZELTİCİ FAALİYETLER', files);
console.log('Bulunan dosya sayısı (filtre sonrası):', files.length);

let inserted = 0, withDept = 0, withoutDept = 0;
const deptCounts = {};
for (const f of files) {
  const parts = f.rel.split('/');
  const department = guessDept(parts, f.name);
  const year = guessYear(parts, f.name);
  const title = path.basename(f.name, path.extname(f.name)).replace(/\s+/g, ' ').trim() || f.name;
  if (department) { withDept++; deptCounts[department] = (deptCounts[department] || 0) + 1; }
  else withoutDept++;
  const data = {
    title,
    description: `Arşivden içe aktarıldı — kaynak klasör: ${parts.slice(0, -1).join(' / ')}`,
    dueDate: null,
    status: 'Kapatıldı',
    archived: true,
    archiveYear: year || null,
    sourcePath: f.rel,
    history: [{ at: new Date().toISOString(), by: 'Arşiv İçe Aktarma', action: 'Arşivden içe aktarıldı (kapalı olarak işaretlendi)', note: f.rel }]
  };
  if (!process.env.DOF_IMPORT_DRY) {
    await pool.query(
      'insert into kys_records(module,department,data,created_by) values($1,$2,$3::jsonb,$4)',
      ['dof', normDept(department), JSON.stringify(data), 'Arşiv İçe Aktarma']
    );
  }
  inserted++;
}

console.log('İçe aktarılan:', inserted);
console.log('Departman tahmin edilen:', withDept, '/ edilemeyen:', withoutDept);
console.log('Departman dağılımı:', deptCounts);
await pool.end();
