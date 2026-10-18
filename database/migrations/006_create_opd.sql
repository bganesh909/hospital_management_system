-- 006: Create OPD visits, prescriptions, prescription items
CREATE TABLE opd_visits (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_number    VARCHAR(20) UNIQUE NOT NULL,
  patient_id      UUID NOT NULL REFERENCES patients(id),
  doctor_id       UUID NOT NULL REFERENCES doctors(id),
  appointment_id  UUID REFERENCES appointments(id),
  visit_date      TIMESTAMPTZ DEFAULT now(),
  symptoms        TEXT,
  diagnosis       TEXT,
  treatment_plan  TEXT,
  follow_up_date  DATE,
  vitals_bp       VARCHAR(20),
  vitals_temp     NUMERIC(4,1),
  vitals_pulse    INT,
  vitals_weight   NUMERIC(5,2),
  vitals_height   NUMERIC(5,2),
  vitals_spo2     INT,
  status          VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','referred')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prescriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_number VARCHAR(20) UNIQUE NOT NULL,
  opd_visit_id        UUID REFERENCES opd_visits(id),
  ipd_admission_id    UUID,
  patient_id          UUID NOT NULL REFERENCES patients(id),
  doctor_id           UUID NOT NULL REFERENCES doctors(id),
  notes               TEXT,
  status              VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','dispensed','cancelled')),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE prescription_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_id     UUID,
  medicine_name   VARCHAR(200) NOT NULL,
  dosage          VARCHAR(100) NOT NULL,
  frequency       VARCHAR(100) NOT NULL,
  duration        VARCHAR(100) NOT NULL,
  instructions    TEXT,
  quantity        INT NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT now()
);
