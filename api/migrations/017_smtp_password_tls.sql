UPDATE smtp_settings
SET auth_mode = 'password', tenant_id = NULL, client_id = NULL, client_secret_encrypted = NULL
WHERE auth_mode <> 'password' OR tenant_id IS NOT NULL OR client_id IS NOT NULL OR client_secret_encrypted IS NOT NULL;

ALTER TABLE smtp_settings
  ALTER COLUMN auth_mode SET DEFAULT 'password';

ALTER TABLE smtp_settings
  DROP CONSTRAINT IF EXISTS smtp_settings_auth_mode_check;

ALTER TABLE smtp_settings
  ADD CONSTRAINT smtp_settings_auth_mode_check CHECK (auth_mode = 'password');
