-- Vardiya planına fazla mesai alanı; vardiya <-> puantaj çift yönlü senkron
alter table shift_plans add column if not exists overtime text not null default '';
alter table shift_plans alter column shift_type set default '';
