-- Davet bağlantısının ilk açıldığı an (tıklama takibi için)
alter table survey_invites add column if not exists opened_at timestamptz;
