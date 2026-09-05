create table if not exists attendance_entries(
  id bigserial primary key,
  employee_id integer not null references employees(id) on delete cascade,
  work_date date not null,
  work_type text not null check(work_type in ('normal','fazla')),
  value text not null,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(employee_id, work_date, work_type)
);

create index if not exists attendance_entries_date_idx on attendance_entries(work_date);
create index if not exists attendance_entries_employee_idx on attendance_entries(employee_id, work_date);
