begin;
create table if not exists mobile_login_challenges (
 id uuid primary key,
 employee_id integer references employees(id) on delete cascade,
 identity_hash text not null,
 phone_hash text not null,
 ip_hash text not null,
 code_hash text not null,
 attempts integer not null default 0,
 consumed boolean not null default false,
 sent boolean not null default false,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '5 minutes'
);
create index if not exists mobile_challenges_phone_idx on mobile_login_challenges(phone_hash,created_at);
create index if not exists mobile_challenges_ip_idx on mobile_login_challenges(ip_hash,created_at);
create table if not exists mobile_sessions (
 token_hash text primary key,
 user_id integer not null references app_users(id) on delete cascade,
 employee_id integer not null references employees(id) on delete cascade,
 identity_hash text not null,
 phone_hash text not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '12 hours'
);
create index if not exists mobile_sessions_expiry_idx on mobile_sessions(expires_at);
commit;
