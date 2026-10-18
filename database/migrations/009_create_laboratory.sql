-- 009: Create laboratory tables
CREATE TABLE lab_test_catalog (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_code         VARCHAR(20) UNIQUE NOT NULL,
  name              VARCHAR(200) NOT NULL,
  category          VARCHAR(100),
  description       TEXT,
  normal_range      VARCHAR(200),
  unit              VARCHAR(50),
  price             NUMERIC(10,2) NOT NULL,
  turnaround_hours  INT DEFAULT 24,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lab_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number    VARCHAR(20) UNIQUE NOT NULL,
  patient_id        UUID NOT NULL REFERENCES patients(id),
  doctor_id         UUID NOT NULL REFERENCES doctors(id),
  opd_visit_id      UUID REFERENCES opd_visits(id),
  ipd_admission_id  UUID REFERENCES ipd_admissions(id),
  priority          VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal','urgent','stat')),
  status            VARCHAR(20) DEFAULT 'requested' CHECK (status IN ('requested','sample_collected','processing','completed','cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lab_request_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES lab_requests(id) ON DELETE CASCADE,
  test_id         UUID NOT NULL REFERENCES lab_test_catalog(id),
  result_value    TEXT,
  result_status   VARCHAR(20) DEFAULT 'pending' CHECK (result_status IN ('pending','normal','abnormal','critical')),
  performed_by    UUID REFERENCES users(id),
  performed_at    TIMESTAMPTZ,
  remarks         TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
