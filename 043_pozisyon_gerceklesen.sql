-- Personel Bütçesi: pozisyon bazında aylık GERÇEKLEŞEN (İK girer, tüm yıllar)
create table if not exists personel_pozisyon_gerceklesen(
  id bigserial primary key,
  butce_yili int not null,
  departman text not null,
  pozisyon text not null,
  aylar jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  unique (butce_yili, departman, pozisyon)
);
