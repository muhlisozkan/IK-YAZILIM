-- Güncel Tablo: yüklenen Excel dosyasının salt-okunur görüntüleyicisi + sürüm geçmişi
create table if not exists guncel_workbook(
  id bigserial primary key,
  original_name text not null default 'guncel.xlsx',
  note text not null default '',
  xlsx bytea not null,
  sheet_meta jsonb not null default '[]'::jsonb,
  uploaded_by text not null default '',
  uploaded_at timestamptz not null default now()
);

create table if not exists guncel_sheet(
  workbook_id bigint not null references guncel_workbook(id) on delete cascade,
  idx int not null,
  name text not null default '',
  data jsonb not null,
  primary key (workbook_id, idx)
);
