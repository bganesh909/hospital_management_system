-- 015: Payment refunds (full or partial)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS payment_refunds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_number   VARCHAR(20) UNIQUE NOT NULL,
  payment_id      UUID NOT NULL REFERENCES payments(id),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method          VARCHAR(30) NOT NULL CHECK (method IN ('cash','card','upi','bank_transfer','insurance','cheque')),
  reason          TEXT NOT NULL,
  adjusted_invoice BOOLEAN NOT NULL DEFAULT false,
  refunded_by     UUID REFERENCES users(id),
  refunded_at     TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_invoice ON payment_refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_refunds_payment ON payment_refunds(payment_id);
