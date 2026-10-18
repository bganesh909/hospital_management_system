-- 008: Create pharmacy tables
CREATE TABLE medicine_categories (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name    VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE medicines (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  VARCHAR(200) NOT NULL,
  generic_name          VARCHAR(200),
  category_id           UUID REFERENCES medicine_categories(id),
  manufacturer          VARCHAR(200),
  unit_price            NUMERIC(10,2) NOT NULL,
  stock_quantity        INT NOT NULL DEFAULT 0,
  reorder_level         INT DEFAULT 10,
  expiry_date           DATE,
  batch_number          VARCHAR(100),
  requires_prescription BOOLEAN DEFAULT true,
  description           TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prescription_items ADD CONSTRAINT fk_pi_medicine
  FOREIGN KEY (medicine_id) REFERENCES medicines(id);

CREATE TABLE pharmacy_dispensations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_number VARCHAR(20) UNIQUE NOT NULL,
  prescription_id     UUID NOT NULL REFERENCES prescriptions(id),
  dispensed_by        UUID NOT NULL REFERENCES users(id),
  total_amount        NUMERIC(10,2) NOT NULL,
  status              VARCHAR(20) DEFAULT 'dispensed' CHECK (status IN ('dispensed','returned','partial')),
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pharmacy_dispensation_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispensation_id UUID NOT NULL REFERENCES pharmacy_dispensations(id) ON DELETE CASCADE,
  medicine_id     UUID NOT NULL REFERENCES medicines(id),
  quantity        INT NOT NULL,
  unit_price      NUMERIC(10,2) NOT NULL,
  total_price     NUMERIC(10,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
