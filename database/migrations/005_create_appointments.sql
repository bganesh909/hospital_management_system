-- 005: Create appointments table
CREATE TYPE appointment_status AS ENUM (
  'scheduled','confirmed','in_progress','completed','cancelled','no_show'
);

CREATE TABLE appointments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_number VARCHAR(20) UNIQUE NOT NULL,
  patient_id        UUID NOT NULL REFERENCES patients(id),
  doctor_id         UUID NOT NULL REFERENCES doctors(id),
  appointment_date  DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME,
  status            appointment_status DEFAULT 'scheduled',
  type              VARCHAR(20) DEFAULT 'consultation' CHECK (type IN ('consultation','follow_up','emergency')),
  reason            TEXT,
  notes             TEXT,
  cancelled_reason  TEXT,
  booked_by         UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_appt_patient ON appointments(patient_id);
CREATE INDEX idx_appt_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appt_date ON appointments(appointment_date);
