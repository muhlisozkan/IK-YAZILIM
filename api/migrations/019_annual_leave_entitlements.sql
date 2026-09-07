CREATE TABLE IF NOT EXISTS annual_leave_entitlements(
  id bigserial PRIMARY KEY,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entitlement_year integer NOT NULL CHECK(entitlement_year BETWEEN 2000 AND 2100),
  entitled_days numeric(6,2) NOT NULL DEFAULT 0 CHECK(entitled_days BETWEEN 0 AND 365),
  manual_adjustment numeric(6,2) NOT NULL DEFAULT 0 CHECK(manual_adjustment BETWEEN -365 AND 365),
  manual_override boolean NOT NULL DEFAULT false,
  adjustment_note text NOT NULL DEFAULT '',
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id,entitlement_year)
);
CREATE INDEX IF NOT EXISTS annual_leave_entitlements_year_idx
  ON annual_leave_entitlements(entitlement_year,employee_id);
