begin;

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
  status text not null default 'Bekliyor' check(status in ('Bekliyor','Onaylandı','Reddedildi','Ödendi','Mahsup Edildi')),
  current_approver text,
  payment_date date,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists advances_employee_id_idx on advances(employee_id);
create index if not exists advances_status_idx on advances(status);
create index if not exists advances_date_idx on advances(requested_date desc);

commit;
