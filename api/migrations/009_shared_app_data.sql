create table if not exists shared_app_data(
  data_key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
