alter table attendance_entries add column if not exists source text not null default 'manual';

create table if not exists shift_plans(
  id bigserial primary key,
  employee_id integer not null references employees(id) on delete cascade,
  work_date date not null,
  shift_type text not null,
  updated_by text,
  transferred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date)
);

create index if not exists shift_plans_date_idx on shift_plans(work_date);
create index if not exists shift_plans_employee_idx on shift_plans(employee_id, work_date);

insert into shift_plans(employee_id,work_date,shift_type,updated_by)
select employee_id,work_date,value,updated_by
from attendance_entries
where work_type='normal'
  and work_date >= (now() at time zone 'Europe/Istanbul')::date
on conflict(employee_id,work_date) do update set
  shift_type=excluded.shift_type,
  updated_by=excluded.updated_by,
  updated_at=now();

delete from attendance_entries
where work_type='normal'
  and work_date >= (now() at time zone 'Europe/Istanbul')::date;
