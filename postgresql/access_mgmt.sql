-- Start

-- SCHEMA: access_mgmt
CREATE SCHEMA IF NOT EXISTS access_mgmt AUTHORIZATION CURRENT_USER;

SET search_path = access_mgmt, public;

CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUMS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'credential_type') THEN
    CREATE TYPE credential_type AS ENUM ('rfid_card','fingerprint','qr_code');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'device_type') THEN
    CREATE TYPE device_type AS ENUM ('rfid_reader','fingerprint_reader','camera','door_controller','gateway');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_type') THEN
    CREATE TYPE user_type AS ENUM ('employee','guest','service','admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'access_action') THEN
    CREATE TYPE access_action AS ENUM ('grant','deny','challenge');
  END IF;
END$$;


-- TABLE: users (osoby: pracownicy, goście, serwis, admini)
CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text,                       -- login w systemie (opcjonalne)
  first_name text NOT NULL,
  last_name text NOT NULL,
  email citext,                        -- case-insensitive
  phone text,
  user_type user_type NOT NULL DEFAULT 'employee',
  department text,
  employee_number text,                -- opcjonalne
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'          -- dodatkowe, elastyczne atrybuty
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_email ON users ((lower(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_users_user_type ON users (user_type);
CREATE INDEX IF NOT EXISTS ix_users_metadata_gin ON users USING gin (metadata);

-- TABLE: devices (czytniki, kamery)
CREATE TABLE IF NOT EXISTS devices (
  device_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  device_type device_type NOT NULL,
  model text,
  serial_no text,
  location text,                       -- opis lokalizacji (np. "Budynek A, Piętro 2, Korytarz 3")
  room_id uuid,                        -- FK do rooms (dodane poniżej)
  ip_address inet,
  mac_address macaddr,
  firmware_version text,
  last_seen timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ix_devices_type ON devices (device_type);
CREATE INDEX IF NOT EXISTS ix_devices_location ON devices (location);
CREATE INDEX IF NOT EXISTS ix_devices_metadata_gin ON devices USING gin (metadata);

-- TABLES: buildings/rooms/doors/desks
CREATE TABLE IF NOT EXISTS buildings (
  building_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS rooms (
  room_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(building_id) ON DELETE SET NULL,
  name text NOT NULL,
  floor text,
  capacity int,
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS doors (
  door_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(room_id) ON DELETE CASCADE,
  name text NOT NULL,                   -- np. "Drzwi wejściowe A2"
  hardware_id uuid REFERENCES devices(device_id) ON DELETE SET NULL,
  door_type text,                       -- np. "wewnętrzne","zewnętrzne"
  is_locked boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS desks (
  desk_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(room_id) ON DELETE CASCADE,
  code text NOT NULL,                  -- np. "A2-12"
  description text,
  is_available boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_desks_code ON desks (code);

-- TABLE: access_groups (grupy dostępu)
CREATE TABLE IF NOT EXISTS access_groups (
  group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_access_groups_name ON access_groups (lower(name));

-- TABLE JOIN: users <-> access_groups (przynależność do grup)
CREATE TABLE IF NOT EXISTS user_access_groups (
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  group_id uuid REFERENCES access_groups(group_id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, group_id)
);

-- TABLE: access_policies (polityki dostępu)
CREATE TABLE IF NOT EXISTS access_policies (
  policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  default_action access_action NOT NULL DEFAULT 'deny',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TABLES: policy_rooms, policy_doors, policy_days, policy_time_ranges
-- Definicja szczegółowych reguł dostępu w ramach polityki
CREATE TABLE IF NOT EXISTS policy_rooms (
  policy_room_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid REFERENCES access_policies(policy_id) ON DELETE CASCADE ON UPDATE CASCADE,
  room_id uuid REFERENCES rooms(room_id) ON DELETE CASCADE,
  include_subdoors boolean NOT NULL DEFAULT true,  -- czy automatycznie obejmuje wszystkie drzwi tego pokoju
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS policy_doors (
  policy_door_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_room_id uuid REFERENCES policy_rooms(policy_room_id) ON DELETE CASCADE ON UPDATE CASCADE,
  door_id uuid REFERENCES doors(door_id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS policy_days (
  policy_day_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_door_id uuid REFERENCES policy_doors(policy_door_id) ON DELETE CASCADE ON UPDATE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=niedziela, 6=sobota
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS policy_time_ranges (
  time_range_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_day_id uuid REFERENCES policy_days(policy_day_id) ON DELETE CASCADE ON UPDATE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  start_time time NOT NULL,
  end_time time NOT NULL,
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS ix_access_policies_name ON access_policies (lower(name));
CREATE INDEX IF NOT EXISTS ix_access_policies_active ON access_policies (is_active);

-- TABLE LINK: access_group -> access_policy (które polityki przypisane są grupom)
CREATE TABLE IF NOT EXISTS group_policies (
  group_id uuid REFERENCES access_groups(group_id) ON DELETE CASCADE,
  policy_id uuid REFERENCES access_policies(policy_id) ON DELETE CASCADE,
  PRIMARY KEY(group_id, policy_id),
  assigned_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: credentials (karty RFID, fingerprint templates)
CREATE TABLE IF NOT EXISTS credentials (
  credential_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  credential_type credential_type NOT NULL,
  identifier text NOT NULL,                -- np. UID karty, fingerprint id
  issued_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}',             -- np. issuer, device that enrolled it
  UNIQUE (credential_type, identifier)
);

CREATE INDEX IF NOT EXISTS ix_credentials_user ON credentials (user_id);
CREATE INDEX IF NOT EXISTS ix_credentials_type ON credentials (credential_type);

-- TABLE: biometric_templates (szyfrowane, nie surowe obrazy)
-- Ważne: przechowywać tylko template (skompresowany/zaszyfrowany), najlepiej po stronie serwera szyfrując kolumnę
CREATE TABLE IF NOT EXISTS biometric_templates (
  template_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  credential_id uuid REFERENCES credentials(credential_id) ON DELETE SET NULL,
  biometric_type text NOT NULL,            -- np. "fingerprint" (można użyć enum)
  template bytea NOT NULL,                 -- zaszyfrowany binarny template (np. AES)
  template_hash bytea NOT NULL,            -- hash template (pgp, HMAC) do szybkiego porównania
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  enrolled_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ix_biometric_user ON biometric_templates (user_id);

-- TABLE: rfid_cards (zapisywane karty - historia kreacji)
CREATE TABLE IF NOT EXISTS rfid_cards (
  card_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id uuid REFERENCES credentials(credential_id) ON DELETE CASCADE,
  serial text,                             -- numer karty (może się powtarzać przy re-issue)
  issued_at timestamptz NOT NULL DEFAULT now(),
  issued_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

-- TABLE: qr_codes (kody tymczasowe, np. dla gości)
CREATE TABLE IF NOT EXISTS qr_codes (
  qr_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,               -- wygenerowany kod (base64/hex)
  user_id uuid REFERENCES users(user_id) ON DELETE CASCADE, -- kto otrzymał kod (może być guest)
  associated_room_id uuid REFERENCES rooms(room_id) ON DELETE SET NULL,
  associated_door_id uuid REFERENCES doors(door_id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  valid_from timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_until > valid_from),
  valid_until timestamptz NOT NULL,
  usage_limit int NOT NULL DEFAULT 1,
  usage_count int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ix_qr_validity ON qr_codes (valid_from, valid_until) WHERE is_active;

-- TABLE: reservations (rezerwacja stanowisk/biurek)
CREATE TABLE IF NOT EXISTS reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  desk_id uuid REFERENCES desks(desk_id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  CHECK (end_at > start_at),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed', -- confirmed, cancelled, pending
  metadata jsonb DEFAULT '{}' 
);

CREATE INDEX IF NOT EXISTS ix_reservations_desk_time ON reservations (desk_id, start_at, end_at);

-- TABLE: access_logs (logi przejść przez drzwi)
CREATE TABLE IF NOT EXISTS access_logs (
  log_id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  device_id uuid REFERENCES devices(device_id) ON DELETE SET NULL,
  door_id uuid REFERENCES doors(door_id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  credential_id uuid REFERENCES credentials(credential_id) ON DELETE SET NULL,
  action access_action NOT NULL DEFAULT 'grant',
  success boolean NOT NULL DEFAULT true,
  reason text,                             -- np. "time_restricted", "badge_revoked", "fire_alarm"
  raw_event jsonb DEFAULT '{}',             -- surowe dane z urządzenia
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_access_logs_time ON access_logs (occurred_at);
CREATE INDEX IF NOT EXISTS ix_access_logs_user ON access_logs (user_id);
CREATE INDEX IF NOT EXISTS ix_access_logs_door ON access_logs (door_id);

-- TABLE: events (nietypowe zachowania, alarmy)
CREATE TABLE IF NOT EXISTS events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,                 -- np. "suspicious_activity","forced_entry","multiple_failed_attempts"
  severity smallint NOT NULL DEFAULT 1,
  door_id uuid REFERENCES doors(door_id) ON DELETE SET NULL,
  device_id uuid REFERENCES devices(device_id) ON DELETE SET NULL,
  related_log_id bigint REFERENCES access_logs(log_id) ON DELETE SET NULL,
  description text,
  acknowledged_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  metadata jsonb DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS ix_events_time ON events (occurred_at);
CREATE INDEX IF NOT EXISTS ix_events_type ON events (event_type);

-- TABLE: emergencies (automatyczne zachowania w przypadku katastrof)
CREATE TABLE IF NOT EXISTS emergencies (
  emergency_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,               -- np. "fire_alarm", "power_loss", "manual"
  actions jsonb NOT NULL,                   -- lista akcji { "unlock_doors": [door_id,...], "notify": [...], "override_policies": true }
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- TABLE: admin_audit (audyty administracyjne)
CREATE TABLE IF NOT EXISTS admin_audit (
  audit_id bigserial PRIMARY KEY,
  admin_user uuid REFERENCES users(user_id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  ip_address inet
);

CREATE INDEX IF NOT EXISTS ix_admin_audit_time ON admin_audit (occurred_at);


-- TRIGGER FUNCTION: update timestamp automatically
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ADD TRIGGER
DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_devices_updated_at ON devices;
CREATE TRIGGER trg_devices_updated_at
BEFORE UPDATE ON devices
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_access_policies_updated_at ON access_policies;
CREATE TRIGGER trg_access_policies_updated_at
BEFORE UPDATE ON access_policies
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- TRIGGER FUNCTION: validate user data
CREATE OR REPLACE FUNCTION validate_user_data()
RETURNS TRIGGER AS $$
DECLARE
  cleaned_phone text;
BEGIN
  IF trim(NEW.first_name) = '' OR trim(NEW.last_name) = '' THEN
    RAISE EXCEPTION 'First name and last name cannot be empty';
  END IF;

  IF NEW.email IS NOT NULL AND POSITION('@' IN NEW.email) = 0 THEN
    RAISE EXCEPTION 'Invalid email address: %', NEW.email;
  END IF;

  IF NEW.phone IS NOT NULL THEN
    cleaned_phone := regexp_replace(NEW.phone, '[^0-9+]', '', 'g');
    IF length(cleaned_phone) - length(replace(cleaned_phone, '+', '')) > 1 THEN
      RAISE EXCEPTION 'Invalid phone number: multiple "+" signs found (%).', NEW.phone;
    END IF;
    IF cleaned_phone !~ '^\+?[0-9]+$' THEN
      RAISE EXCEPTION 'Invalid phone number format: "%". Allowed format: optional "+" followed by digits only.', cleaned_phone;
    END IF;
    NEW.phone := cleaned_phone;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ADD TRIGGER
DROP TRIGGER IF EXISTS trg_users_validate ON users;
CREATE TRIGGER trg_users_validate
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION validate_user_data();

-- FUNCTION: (de)activate inactive devices based on last_seen
CREATE OR REPLACE FUNCTION set_devices_active()
RETURNS void AS $$
BEGIN
  UPDATE devices
  SET is_active = false
  WHERE last_seen < now() - interval '24 hours'
    AND is_active = true;

  UPDATE devices
  SET is_active = true
  WHERE last_seen >= now() - interval '24 hours'
    AND is_active = false;
END;
$$ LANGUAGE plpgsql;

-- FUNCTION: set user (in)active
CREATE OR REPLACE FUNCTION set_user_active(p_user_id uuid, p_active boolean)
RETURNS void AS $$
BEGIN
  UPDATE users
  SET is_active = p_active
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- End
