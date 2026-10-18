-- 012: Create notifications tables
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           VARCHAR(200) NOT NULL,
  message         TEXT NOT NULL,
  type            VARCHAR(30) NOT NULL,
  reference_type  VARCHAR(50),
  reference_id    UUID,
  is_read         BOOLEAN DEFAULT false,
  sent_via        VARCHAR(20) DEFAULT 'in_app' CHECK (sent_via IN ('in_app','email','both')),
  email_sent      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

CREATE TABLE notification_preferences (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_email   BOOLEAN DEFAULT true,
  lab_result_email    BOOLEAN DEFAULT true,
  billing_email       BOOLEAN DEFAULT true,
  system_email        BOOLEAN DEFAULT false,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);
