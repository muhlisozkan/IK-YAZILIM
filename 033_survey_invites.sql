-- Anket / Ayın Personeli dağıtımı: kişiye özel, tek kullanımlık linkler
alter table employees add column if not exists phone text not null default '';

create table if not exists survey_invites(
  id bigserial primary key,
  token text not null unique,
  kind text not null check(kind in ('personel','makeitright')),
  survey_id bigint references survey_templates(id) on delete cascade,
  period_id bigint references eom_periods(id) on delete cascade,
  employee_id bigint,
  recipient_name text not null default '',
  recipient_email text not null default '',
  recipient_phone text not null default '',
  channel text not null default '',
  sent_ok boolean,
  sent_error text not null default '',
  response jsonb,
  used_at timestamptz,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists survey_invites_survey_idx on survey_invites(survey_id);
create index if not exists survey_invites_period_idx on survey_invites(period_id);

-- eom_votes: giriş yapmış kullanıcı oyu VEYA tek kullanımlık davet oyu
alter table eom_votes add column if not exists invite_id bigint references survey_invites(id) on delete cascade;
do $$ begin
  if exists (select 1 from pg_constraint where conname='eom_votes_pkey') then
    alter table eom_votes drop constraint eom_votes_pkey;
  end if;
end $$;
alter table eom_votes alter column voter_id drop not null;
alter table eom_votes add column if not exists id bigserial primary key;
create unique index if not exists eom_votes_voter_uq on eom_votes(period_id,category,voter_id) where voter_id is not null;
create unique index if not exists eom_votes_invite_uq on eom_votes(period_id,category,invite_id) where invite_id is not null;
