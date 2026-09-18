-- Özel rol oluşturucusuna "tüm departmanların verilerini görebilsin" anahtarı.
-- Etkinse, bu role sahip kullanıcılar visibleDepartments() kısıtından muaf tutulur
-- (companyWideRoles ile aynı davranış — departman bazlı sınırlama uygulanmaz).
alter table custom_roles add column if not exists company_wide boolean not null default false;
