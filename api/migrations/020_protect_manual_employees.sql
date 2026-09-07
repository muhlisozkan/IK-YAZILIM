ALTER TABLE employees ADD COLUMN IF NOT EXISTS payroll_sync_protected boolean NOT NULL DEFAULT false;
UPDATE employees SET payroll_sync_protected=true WHERE source IS DISTINCT FROM 'Bordro';
COMMENT ON COLUMN employees.payroll_sync_protected IS 'True ise Bordro eşitlemesi bu çalışan kaydını güncellemez.';
