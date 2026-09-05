-- On günden kısa giriş-çıkış aralarında kıdem kesilmez. Bu alan, yeni sicil
-- verilse bile kesintisiz çalışma zincirinin ilk tarihini saklar.
alter table employees add column if not exists seniority_start_date date;

update employees
set seniority_start_date = coalesce(seniority_start_date, start_date);
