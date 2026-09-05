create extension if not exists pgcrypto;

create table if not exists app_users(
  id bigserial primary key,
  username text not null,
  password_hash text not null,
  display_name text not null,
  role text not null default 'Personel',
  status text not null default 'Aktif',
  employee_id integer references employees(id) on delete set null,
  department text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists app_users_username_lower_unique on app_users(lower(username));

create table if not exists auth_sessions(
  token_hash text primary key,
  user_id bigint not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists auth_sessions_expires_idx on auth_sessions(expires_at);
