-- Anket "Gönder" işleminin her tıklaması ayrı bir gönderim (batch) olarak
-- "Gönderilenler" listesinde tarihiyle birlikte görünsün diye alıcı kayıtlarına
-- bir gönderim kimliği eklenir. Eski kayıtlar (batch_id null) geriye dönük
-- olarak anket başına tek bir gönderim gibi gruplanmaya devam eder
-- (coalesce(batch_id, -survey_id) ile), veri kaybı olmaz.
create sequence if not exists survey_invite_batch_seq;
alter table survey_invites add column if not exists batch_id bigint;
create index if not exists survey_invites_batch_idx on survey_invites(survey_id, batch_id);
