-- Güvenlik ve Kayıp/Bulunan Eşyalar modülü (HMS'den taşındı)
-- Genel amaçlı JSON kayıt deposu; modüller: visitors, vehicles, fleet,
-- staff_status, lost_items, lost_approvals

create table if not exists hms_records(
  id bigserial primary key,
  module text not null,
  department text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hms_records_module_idx on hms_records(module, id desc);
create index if not exists hms_records_department_idx on hms_records(module, department);
