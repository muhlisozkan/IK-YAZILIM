-- Çalışan telefon/e-posta alanlarını Bordro detayından doldur
update employees set
  phone = coalesce(nullif(btrim(phone), ''), nullif(btrim(payroll_details->>'CEP TELEFONU'), ''), nullif(btrim(payroll_details->>'TELEFON'), ''), ''),
  email = coalesce(nullif(btrim(email), ''), nullif(btrim(payroll_details->>'E-MAIL'), ''), '')
where payroll_details <> '{}'::jsonb;

-- Alıcı grupları (SMS / e-posta gönderiminde seçilir)
create table if not exists recipient_groups(
  id bigserial primary key,
  name text not null,
  department text not null default '',            -- doluysa dinamik: o departmanın aktif çalışanları
  members jsonb not null default '[]'::jsonb,      -- statik üyeler: [{employee_id?,name,email,phone}]
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recipient_groups_name_idx on recipient_groups(lower(name));
