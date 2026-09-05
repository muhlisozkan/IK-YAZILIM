create table if not exists employees(id serial primary key,name text not null,email text default '',department text not null,title text default '',start_date date not null,salary numeric default 0,status text default 'Aktif',created_at timestamptz default now());

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
alter table employees add column if not exists payroll_details jsonb not null default '{}'::jsonb;
alter table employees add column if not exists termination_date date;
alter table employees add column if not exists leave_seniority_exempt boolean not null default false;
alter table employees add column if not exists employment_gap_days integer;
alter table employees add column if not exists previous_termination_date date;
alter table employees add column if not exists seniority_start_date date;
alter table employees add column if not exists leave_entitlement_start_date date;
alter table employees add column if not exists first_employment_start_date date;
update employees set seniority_start_date=coalesce(seniority_start_date,start_date);
update employees set leave_entitlement_start_date=coalesce(leave_entitlement_start_date,seniority_start_date,start_date);
update employees set first_employment_start_date=coalesce(first_employment_start_date,start_date);
create unique index if not exists employees_payroll_sicil_unique on employees(payroll_sicil) where payroll_sicil is not null;

create table if not exists employee_employment_periods(
  id bigserial primary key,
  payroll_sicil text not null,
  employee_identity text,
  start_date date not null,
  termination_date date,
  source text not null default 'Bordro',
  source_synced_at timestamptz not null default now(),
  unique(payroll_sicil, start_date)
);
alter table employee_employment_periods add column if not exists employee_identity text;
create index if not exists employee_employment_periods_sicil_idx on employee_employment_periods(payroll_sicil, start_date);
create index if not exists employee_employment_periods_identity_idx on employee_employment_periods(employee_identity, start_date);

create table if not exists expenses(
  id bigserial primary key,
  employee_id integer references employees(id) on delete set null,
  employee_name text not null,
  category text not null,
  expense_date date not null,
  amount numeric(14,2) not null check(amount > 0),
  currency varchar(3) not null default 'TRY',
  description text not null default '',
  receipt_no text not null default '',
  status text not null default 'Bekliyor' check(status in ('Bekliyor','Onaylandı','Reddedildi','Ödendi')),
  current_approver text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_employee_id_idx on expenses(employee_id);
create index if not exists expenses_status_idx on expenses(status);
create index if not exists expenses_date_idx on expenses(expense_date desc);

create table if not exists advances(
  id bigserial primary key,
  employee_id integer references employees(id) on delete set null,
  employee_name text not null,
  requested_date date not null,
  amount numeric(14,2) not null check(amount > 0),
  currency varchar(3) not null default 'TRY',
  deduction_month date,
  reason text not null default '',
  status text not null default 'Onay Sürecinde' check(status in ('Onay Sürecinde','Onaylandı','Reddedildi','Ödendi','Mahsup Edildi')),
  current_approver text,
  payment_date date,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists advances_employee_id_idx on advances(employee_id);
create index if not exists advances_status_idx on advances(status);
create index if not exists advances_date_idx on advances(requested_date desc);

alter table advances add column if not exists department text not null default '';
alter table advances add column if not exists requester_user_id text;
alter table advances add column if not exists requester_user_name text;
alter table advances add column if not exists approval_stage text not null default 'department';
alter table advances add column if not exists department_approved_by text;
alter table advances add column if not exists department_approved_at timestamptz;
alter table advances add column if not exists hr_approved_by text;
alter table advances add column if not exists hr_approved_at timestamptz;
alter table advances add column if not exists finance_approved_by text;
alter table advances add column if not exists finance_approved_at timestamptz;
alter table advances add column if not exists rejected_by text;
alter table advances add column if not exists rejected_at timestamptz;
alter table advances add column if not exists rejection_reason text;
create index if not exists advances_approval_stage_idx on advances(approval_stage);
create index if not exists advances_department_idx on advances(department);

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

create table if not exists shared_app_data(
  data_key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create extension if not exists pgcrypto;

create table if not exists app_users(
  id bigserial primary key,
  username text not null,
  email text not null default '',
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

alter table expenses add column if not exists department text not null default '';
alter table expenses add column if not exists requester_user_id bigint;
alter table expenses add column if not exists requester_user_name text;
alter table expenses add column if not exists approval_route jsonb not null default '[]'::jsonb;
alter table expenses add column if not exists approval_step integer not null default 0;
alter table expenses add column if not exists approval_history jsonb not null default '[]'::jsonb;
alter table expenses add column if not exists rejected_by text;
alter table expenses add column if not exists rejected_at timestamptz;
alter table expenses add column if not exists rejection_reason text;

alter table advances add column if not exists approval_route jsonb not null default '[]'::jsonb;
alter table advances add column if not exists approval_step integer not null default 0;
alter table advances add column if not exists approval_history jsonb not null default '[]'::jsonb;

create table if not exists leave_requests(
  id bigserial primary key,
  employee_id integer references employees(id) on delete set null,
  employee_name text not null,
  department text not null default '',
  requester_user_id bigint,
  requester_user_name text,
  leave_type text not null,
  start_date date not null,
  end_date date not null,
  days integer not null check(days > 0),
  status text not null default 'Bekliyor',
  approval_route jsonb not null default '[]'::jsonb,
  approval_step integer not null default 0,
  approval_history jsonb not null default '[]'::jsonb,
  current_approver text,
  rejected_by text,
  rejected_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leave_requests_employee_idx on leave_requests(employee_id,start_date);
create index if not exists leave_requests_status_idx on leave_requests(status,current_approver);

insert into leave_requests(employee_id,employee_name,department,leave_type,start_date,end_date,days,status,approval_route,approval_step,current_approver)
select e.id,
       item->>'employee',
       coalesce(e.department,''),
       coalesce(nullif(item->>'type',''),'Yıllık izin'),
       (item->>'start')::date,
       (item->>'end')::date,
       greatest(1,coalesce((item->>'days')::integer,1)),
       coalesce(nullif(item->>'status',''),'Bekliyor'),
       case when jsonb_typeof(item->'approvalRoute')='array' then item->'approvalRoute' else '["Departman yöneticisi","İK yöneticisi"]'::jsonb end,
       0,
       case when coalesce(item->>'status','Bekliyor')='Bekliyor' then coalesce(item->>'currentApprover','Departman yöneticisi') else null end
from shared_app_data s
cross join lateral jsonb_array_elements(s.value) item
left join employees e on e.name=item->>'employee'
where s.data_key='ik_leaves'
  and item ? 'employee'
  and not exists (
    select 1 from leave_requests existing
    where existing.employee_name=item->>'employee'
      and existing.start_date=(item->>'start')::date
      and existing.end_date=(item->>'end')::date
      and existing.leave_type=coalesce(nullif(item->>'type',''),'Yıllık izin')
  );
