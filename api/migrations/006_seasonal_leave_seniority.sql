-- Çıkıştan sonra 10 gün veya daha uzun ara vererek yeniden başlayan sezonluk
-- personelin yıllık izin ve kıdem muafiyetini kalıcı olarak saklar.
alter table employees add column if not exists leave_seniority_exempt boolean not null default false;
alter table employees add column if not exists employment_gap_days integer;
alter table employees add column if not exists previous_termination_date date;

create table if not exists employee_employment_periods(
  id bigserial primary key,
  payroll_sicil text not null,
  start_date date not null,
  termination_date date,
  source text not null default 'Bordro',
  source_synced_at timestamptz not null default now(),
  unique(payroll_sicil, start_date)
);

alter table employee_employment_periods add column if not exists employee_identity text;

create index if not exists employee_employment_periods_sicil_idx
  on employee_employment_periods(payroll_sicil, start_date);
create index if not exists employee_employment_periods_identity_idx
  on employee_employment_periods(employee_identity, start_date);
