-- 003: Create patients table
CREATE TABLE patients (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_number          VARCHAR(20) UNIQUE NOT NULL,
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  date_of_birth           DATE NOT NULL,
  gender                  VARCHAR(10) NOT NULL CHECK (gender IN ('male','female','other')),
  blood_group             VARCHAR(5),
  phone                   VARCHAR(20) NOT NULL,
  email                   VARCHAR(255),
  address_line1           TEXT,
  address_line2           TEXT,
  city                    VARCHAR(100),
  state                   VARCHAR(100),
  zip_code                VARCHAR(20),
  emergency_contact_name  VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  insurance_provider      VARCHAR(200),
  insurance_policy_number VARCHAR(100),
  allergies               TEXT,
  status                  VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','discharged','deceased')),
  registered_by           UUID REFERENCES users(id),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_patients_number ON patients(patient_number);
CREATE INDEX idx_patients_name ON patients(last_name, first_name);
CREATE INDEX idx_patients_phone ON patients(phone);
