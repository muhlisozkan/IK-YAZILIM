-- SMS entegrasyonu: sağlayıcı bağımsız HTTP tabanlı SMS ayarları + gönderim günlüğü
-- + kullanıcı telefon alanı (onay bildirimleri için)

alter table app_users add column if not exists phone text not null default '';

create table if not exists sms_settings(
  id smallint primary key default 1 check(id=1),
  enabled boolean not null default false,
  notify_approvals boolean not null default false,
  provider_name text not null default '',
  api_url text not null default '',
  http_method text not null default 'POST' check(http_method in ('GET','POST')),
  content_type text not null default 'application/json',
  body_template text not null default '',
  extra_headers text not null default '',
  sender text not null default '',
  success_contains text not null default '',
  credentials_encrypted text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists sms_log(
  id bigserial primary key,
  phone text not null default '',
  message text not null default '',
  context text not null default '',
  ok boolean,
  status_code integer,
  response text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists sms_log_created_idx on sms_log(created_at desc);
