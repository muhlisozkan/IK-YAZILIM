-- Doküman Yönetimi: dosya eki (PDF/Word). Her yükleme yeni satır olarak eklenir,
-- böylece dosya sürüm geçmişi korunur; kys_records.data.fileId en güncel satırı gösterir.
create table if not exists kys_dokuman_files(
  id bigserial primary key,
  record_id bigint not null references kys_records(id) on delete cascade,
  filename text not null,
  mime text not null default 'application/octet-stream',
  size integer not null,
  data bytea not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);
create index if not exists kys_dokuman_files_record_idx on kys_dokuman_files(record_id, id desc);
