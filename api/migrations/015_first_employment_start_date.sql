-- Çalışan ekranında gösterilecek ilk işe giriş tarihini bordro geçmişinden saklar.
-- Bu alan kıdem ve yıllık izin hesaplarından bağımsızdır.
alter table employees add column if not exists first_employment_start_date date;

update employees e
set first_employment_start_date=coalesce((
  select min(ep.start_date)
  from employee_employment_periods ep
  where coalesce(ep.employee_identity, 'sicil:' || ep.payroll_sicil) =
        coalesce(nullif(e.payroll_details->>'TC KİMLİK',''), 'sicil:' || e.payroll_sicil)
), e.start_date);
