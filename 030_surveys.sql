-- Anket şablonları (Personel Anketi / Make It Right)
create table if not exists survey_templates(
  id bigserial primary key,
  kind text not null default 'personel',
  title text not null,
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists survey_templates_kind_idx on survey_templates(kind, id desc);
