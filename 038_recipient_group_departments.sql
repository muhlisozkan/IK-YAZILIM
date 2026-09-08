-- Alıcı grupları: birden fazla departman
alter table recipient_groups add column if not exists departments jsonb not null default '[]'::jsonb;

update recipient_groups
set departments = to_jsonb(array[btrim(department)])
where coalesce(btrim(department), '') <> '' and departments = '[]'::jsonb;
