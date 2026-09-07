-- İşe alım adayları: tarayıcı localStorage'ından merkezi tabloya taşınır.
create table if not exists candidates(
  id bigserial primary key,
  name text not null,
  email text not null default '',
  phone text not null default '',
  position text not null default '',
  department text not null default '',
  status text not null default 'Yeni başvuru'
    check(status in ('Yeni başvuru','Ön görüşme','Mülakat','Teklif gönderildi','İşe alındı','Olumsuz')),
  cv_name text not null default '',
  interview_date date,
  notes text not null default '',
  hr_approved boolean not null default false,
  hr_approved_by text,
  hr_approved_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists candidates_department_idx on candidates(department);
create index if not exists candidates_status_idx on candidates(status);

-- Daha önce paylaşılan localStorage verisi varsa bir defalık aktar.
insert into candidates(name,email,position,department,status,cv_name,interview_date,notes,created_by)
select nullif(item->>'name',''),
       coalesce(item->>'email',''),
       coalesce(item->>'position',''),
       coalesce(item->>'department',''),
       case when coalesce(item->>'status','') in
         ('Yeni başvuru','Ön görüşme','Mülakat','Teklif gönderildi','İşe alındı','Olumsuz')
         then item->>'status' else 'Yeni başvuru' end,
       coalesce(item->>'cvName',''),
       nullif(item->>'date','')::date,
       coalesce(item->>'note',''),
       'localStorage aktarımı'
from shared_app_data s
cross join lateral jsonb_array_elements(s.value) item
where s.data_key='ik_candidates'
  and coalesce(item->>'name','') <> ''
  and not exists (select 1 from candidates c where c.name=item->>'name' and c.position=coalesce(item->>'position',''));
