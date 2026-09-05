-- 0-9 günlük çıkış/giriş aralarında kıdem son işe girişten başlar.
-- Yıllık izin hakediş tarihi ise önceki kesintisiz hizmet zincirini korur.
alter table employees add column if not exists leave_entitlement_start_date date;

update employees
set leave_entitlement_start_date=coalesce(leave_entitlement_start_date,seniority_start_date,start_date);

update employees
set seniority_start_date=start_date
where employment_gap_days between 0 and 9;
