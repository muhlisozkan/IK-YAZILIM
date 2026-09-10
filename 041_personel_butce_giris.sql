-- Personel Bütçesi: departmanların uygulama üzerinden girdiği kadro bütçesi (Excel'de olmayan yıllar)
create table if not exists personel_butce_giris(
  id bigserial primary key,
  butce_yili int not null,
  departman text not null,
  alt_departman text not null default '',
  bolum text not null default '',
  pozisyon text not null default '',
  aylar jsonb not null default '[null,null,null,null,null,null,null,null,null,null,null,null]'::jsonb,
  sira int not null default 0,
  updated_by text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists personel_butce_giris_idx on personel_butce_giris(butce_yili, departman, sira, id);
