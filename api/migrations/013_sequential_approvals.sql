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

