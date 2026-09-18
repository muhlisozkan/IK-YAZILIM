-- Misafir Takip: Lapis (PMS) Excel çıktısının senkronize edildiği tablo.
-- Her yeni Excel yüklemesinde tablo tamamen değiştirilir (eski kayıtlar silinir,
-- yeni dosyadaki kayıtlar eklenir) — ekran daima son yüklenen dosyayı yansıtır.

create table if not exists guest_tracking(
  id bigserial primary key,
  firma_kodu text,
  ad text not null default '',
  soyad text not null default '',
  cinsiyet text,
  oda_no text,
  checkin text,
  checkout text,
  uyruk text,
  email text,
  telefon text,
  created_at timestamptz not null default now()
);
create index if not exists guest_tracking_ad_idx on guest_tracking(ad, soyad);

create table if not exists guest_tracking_upload(
  id bigserial primary key,
  original_name text,
  row_count int not null default 0,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);
