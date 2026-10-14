CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS hospitals (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(254),
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  operational_status VARCHAR(20) NOT NULL DEFAULT 'operational'
    CHECK (operational_status IN ('operational', 'limited', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS hospitals_location_gix
  ON hospitals USING GIST (location);
CREATE INDEX IF NOT EXISTS hospitals_status_idx
  ON hospitals (operational_status);

CREATE TABLE IF NOT EXISTS hospital_resources (
  id BIGSERIAL PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  resource_type VARCHAR(80) NOT NULL,
  total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
  available_quantity INTEGER NOT NULL CHECK (
    available_quantity >= 0 AND available_quantity <= total_quantity
  ),
  status VARCHAR(20) NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'limited', 'unavailable', 'maintenance')),
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, resource_type)
);

CREATE INDEX IF NOT EXISTS hospital_resources_hospital_idx
  ON hospital_resources (hospital_id);

CREATE TABLE IF NOT EXISTS hospital_specialists (
  id BIGSERIAL PRIMARY KEY,
  hospital_id BIGINT NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  specialty VARCHAR(100) NOT NULL,
  available BOOLEAN NOT NULL DEFAULT FALSE,
  count_available INTEGER NOT NULL DEFAULT 0 CHECK (count_available >= 0),
  duty_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (hospital_id, specialty)
);

CREATE INDEX IF NOT EXISTS hospital_specialists_hospital_idx
  ON hospital_specialists (hospital_id);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin', 'hospital_staff')),
  hospital_id BIGINT REFERENCES hospitals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (role <> 'hospital_staff' OR hospital_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS users_hospital_idx ON users (hospital_id);
