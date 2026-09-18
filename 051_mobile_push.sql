-- İK Yanımda mobil push bildirimleri: opt-in Web Push abonelikleri.
-- Bir çalışanın birden fazla cihazı olabilir (endpoint bazında benzersiz).
create table if not exists push_subscriptions (
  id bigserial primary key,
  employee_id integer not null references employees(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_employee_idx on push_subscriptions(employee_id);
