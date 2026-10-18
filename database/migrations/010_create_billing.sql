-- 010: Create billing tables
CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    VARCHAR(20) UNIQUE NOT NULL,
  patient_id        UUID NOT NULL REFERENCES patients(id),
  ipd_admission_id  UUID REFERENCES ipd_admissions(id),
  subtotal          NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(12,2) DEFAULT 0,
  discount_amount   NUMERIC(12,2) DEFAULT 0,
  total_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(12,2) DEFAULT 0,
  due_amount        NUMERIC(12,2) NOT NULL DEFAULT 0,
  status            VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft','issued','partial','paid','overdue','cancelled')),
  due_date          DATE,
  notes             TEXT,
  generated_by      UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE invoice_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type         VARCHAR(50) NOT NULL,
  item_reference_id UUID,
  description       VARCHAR(500) NOT NULL,
  quantity          INT DEFAULT 1,
  unit_price        NUMERIC(10,2) NOT NULL,
  total_price       NUMERIC(10,2) NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number    VARCHAR(20) UNIQUE NOT NULL,
  invoice_id        UUID NOT NULL REFERENCES invoices(id),
  amount            NUMERIC(12,2) NOT NULL,
  method            VARCHAR(30) NOT NULL CHECK (method IN ('cash','card','upi','bank_transfer','insurance','cheque')),
  transaction_ref   VARCHAR(200),
  status            VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('completed','pending','failed','refunded')),
  received_by       UUID REFERENCES users(id),
  payment_date      TIMESTAMPTZ DEFAULT now(),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE insurance_claims (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number        VARCHAR(30) UNIQUE NOT NULL,
  patient_id          UUID NOT NULL REFERENCES patients(id),
  invoice_id          UUID NOT NULL REFERENCES invoices(id),
  insurance_provider  VARCHAR(200) NOT NULL,
  policy_number       VARCHAR(100) NOT NULL,
  claimed_amount      NUMERIC(12,2) NOT NULL,
  approved_amount     NUMERIC(12,2),
  status              VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','settled')),
  submitted_at        TIMESTAMPTZ DEFAULT now(),
  settled_at          TIMESTAMPTZ,
  remarks             TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
