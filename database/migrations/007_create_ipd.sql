-- 007: Create wards, beds, IPD admissions, daily rounds
CREATE TABLE wards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  type            VARCHAR(50) NOT NULL CHECK (type IN ('general','semi_private','private','icu','nicu','emergency')),
  floor           INT,
  total_beds      INT NOT NULL,
  charge_per_day  NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE beds (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id     UUID NOT NULL REFERENCES wards(id),
  bed_number  VARCHAR(20) NOT NULL,
  is_occupied BOOLEAN DEFAULT false,
  status      VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available','occupied','maintenance','reserved')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ward_id, bed_number)
);

CREATE TABLE ipd_admissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_number    VARCHAR(20) UNIQUE NOT NULL,
  patient_id          UUID NOT NULL REFERENCES patients(id),
  doctor_id           UUID NOT NULL REFERENCES doctors(id),
  bed_id              UUID REFERENCES beds(id),
  admission_date      TIMESTAMPTZ DEFAULT now(),
  discharge_date      TIMESTAMPTZ,
  reason              TEXT NOT NULL,
  diagnosis           TEXT,
  discharge_summary   TEXT,
  status              VARCHAR(20) DEFAULT 'admitted' CHECK (status IN ('admitted','discharged','transferred','deceased')),
  admitted_by         UUID REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prescriptions ADD CONSTRAINT fk_prescription_ipd
  FOREIGN KEY (ipd_admission_id) REFERENCES ipd_admissions(id);

CREATE TABLE ipd_daily_rounds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id    UUID NOT NULL REFERENCES ipd_admissions(id),
  doctor_id       UUID NOT NULL REFERENCES doctors(id),
  round_date      TIMESTAMPTZ DEFAULT now(),
  notes           TEXT,
  vitals_bp       VARCHAR(20),
  vitals_temp     NUMERIC(4,1),
  vitals_pulse    INT,
  vitals_spo2     INT,
  instructions    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
