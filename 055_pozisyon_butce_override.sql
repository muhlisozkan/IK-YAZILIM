-- Personel Bütçesi: Excel kaynaklı (salt-okunur) bütçe yılları (2025/2026 vb.) için
-- pozisyon bazında BÜTÇE geçersiz kılma. Yalnızca Sistem yöneticisi girebilir; Excel'deki
-- asıl dosyaya dokunmaz, ekranda üstüne yazar (kullanıcı isteği 2026-09).
create table if not exists personel_pozisyon_butce_override(
  id bigserial primary key,
  butce_yili int not null,
  departman text not null,
  pozisyon text not null,
  aylar jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  unique (butce_yili, departman, pozisyon)
);
