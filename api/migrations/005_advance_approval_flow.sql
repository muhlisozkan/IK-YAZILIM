begin;

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

alter table advances drop constraint if exists advances_status_check;
alter table advances drop constraint if exists advances_approval_stage_check;

update advances
set department = coalesce(nullif(advances.department, ''), employees.department, ''),
    status = case when advances.status = 'Bekliyor' then 'Onay Sürecinde' else advances.status end,
    approval_stage = case
      when advances.status in ('Onaylandı', 'Ödendi', 'Mahsup Edildi') then 'approved'
      when advances.status = 'Reddedildi' then 'rejected'
      else 'department'
    end,
    current_approver = case
      when advances.status = 'Bekliyor' then 'Departman Müdürü'
      when advances.status in ('Onaylandı', 'Ödendi', 'Mahsup Edildi', 'Reddedildi') then null
      else current_approver
    end
from employees
where advances.employee_id = employees.id;

update advances
set status = case when status = 'Bekliyor' then 'Onay Sürecinde' else status end,
    approval_stage = case
      when status in ('Onaylandı', 'Ödendi', 'Mahsup Edildi') then 'approved'
      when status = 'Reddedildi' then 'rejected'
      else 'department'
    end,
    current_approver = case when status = 'Bekliyor' then 'Departman Müdürü' else current_approver end;

alter table advances alter column status set default 'Onay Sürecinde';
alter table advances add constraint advances_status_check check(status in ('Onay Sürecinde','Onaylandı','Reddedildi','Ödendi','Mahsup Edildi'));
alter table advances add constraint advances_approval_stage_check check(approval_stage in ('department','hr','finance','approved','rejected'));
create index if not exists advances_approval_stage_idx on advances(approval_stage);
create index if not exists advances_department_idx on advances(department);

commit;
