-- Yıllık izin talebi onaylandığında bakiyeden düşme + izin geçmişine işleme
alter table leave_usage_records add column if not exists leave_request_id bigint;
create unique index if not exists leave_usage_records_request_idx
  on leave_usage_records(leave_request_id) where leave_request_id is not null;
