create table if not exists smtp_settings(
  id smallint primary key default 1 check(id=1),
  enabled boolean not null default false,
  host text not null default 'smtp.office365.com',
  port integer not null default 587 check(port between 1 and 65535),
  secure boolean not null default false,
  auth_mode text not null default 'oauth2' check(auth_mode in ('password','oauth2')),
  username text not null default '',
  from_email text not null default '',
  from_name text not null default 'İK Merkezi',
  password_encrypted text,
  tenant_id text,
  client_id text,
  client_secret_encrypted text,
  updated_by text,
  updated_at timestamptz not null default now()
);
