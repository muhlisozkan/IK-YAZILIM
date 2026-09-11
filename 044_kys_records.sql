-- Kalite Yönetim Sistemi (KYS) modülleri: genel amaçlı JSON kayıt deposu
-- (hms_records paterni). Modüller: dokuman, hedefler, ygg, tedarikci,
-- kalibrasyon, sikayet, denetim, haccp.

create table if not exists kys_records(
  id bigserial primary key,
  module text not null,
  department text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists kys_records_module_idx on kys_records(module, id desc);
