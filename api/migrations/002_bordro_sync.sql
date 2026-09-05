-- Bordro kaynaklı personel ve departman eşitlemesi. Güvenle tekrar çalıştırılabilir.
create table if not exists departments(
  id serial primary key,
  name text not null,
  workplace text not null default '',
  unit text not null default '',
  source text not null default 'Bordro',
  source_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique(name, workplace, unit)
);

alter table employees add column if not exists payroll_sicil text;
alter table employees add column if not exists workplace text not null default '';
alter table employees add column if not exists unit text not null default '';
alter table employees add column if not exists source text;
alter table employees add column if not exists source_synced_at timestamptz;
create unique index if not exists employees_payroll_sicil_unique on employees(payroll_sicil) where payroll_sicil is not null;
