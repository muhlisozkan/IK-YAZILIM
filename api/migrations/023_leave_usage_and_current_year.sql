-- Yıllık izin: çizelgeden gelen "bu yıl hak edilen" değeri (override kayıtlarda sabit).
alter table annual_leave_entitlements
  add column if not exists current_year_days numeric(6,2);
comment on column annual_leave_entitlements.current_year_days is
  'Çizelgeden aktarılan bu yıl hak edilen izin günü. NULL ise sunucu canlı hesaplar.';

-- Yıllık İzin Takip Çizelgesi / "İzin Kayıt" sekmesindeki tekil izin kullanım kayıtları.
create table if not exists leave_usage_records(
  id bigserial primary key,
  employee_id integer not null references employees(id) on delete cascade,
  start_date date,
  end_date date,
  week_rest_days numeric(5,1) not null default 0,
  official_holiday_days numeric(5,1) not null default 0,
  used_days numeric(6,2) not null default 0,
  source text not null default 'Çizelge',
  created_at timestamptz not null default now()
);
create index if not exists leave_usage_records_employee_idx on leave_usage_records(employee_id, start_date);
