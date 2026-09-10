-- Performans Değerlendirme: anket altyapısına 'performans' türü + davetlerde departman bilgisi
alter table survey_invites drop constraint if exists survey_invites_kind_check;
alter table survey_invites add constraint survey_invites_kind_check
  check (kind in ('personel','makeitright','performans'));

alter table survey_invites add column if not exists recipient_department text not null default '';
create index if not exists survey_invites_dept_idx on survey_invites(survey_id, recipient_department);
