-- Yıllık izin: çizelgeden gelen (sistem dışı) kullanılmış gün sayısı.
-- Uygulamadaki kullanılan izin = manual_used_days + o yılın puantajındaki 'Y' günleri.
alter table annual_leave_entitlements
  add column if not exists manual_used_days numeric(7,2) not null default 0
  check (manual_used_days >= 0 and manual_used_days <= 3650);
comment on column annual_leave_entitlements.manual_used_days is
  'Yıllık İzin Takip Çizelgesinden aktarılan, puantaj dışı kullanılmış izin günü.';

-- Kümülatif hak edilen izin 365 günü aşabilir (uzun kıdem).
alter table annual_leave_entitlements drop constraint if exists annual_leave_entitlements_entitled_days_check;
alter table annual_leave_entitlements
  add constraint annual_leave_entitlements_entitled_days_check check (entitled_days between 0 and 3650);
alter table annual_leave_entitlements alter column entitled_days type numeric(7,2);
