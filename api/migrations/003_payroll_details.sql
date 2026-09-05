-- Bordro görünümündeki tüm alanları, personel siciline bağlı ayrıntı kartında saklar.
alter table employees add column if not exists payroll_details jsonb not null default '{}'::jsonb;
