-- Uzun izinlerde çalışanın işaretlediği haftalık izin (of) günleri
alter table leave_requests add column if not exists weekly_off_dates jsonb not null default '[]'::jsonb;
