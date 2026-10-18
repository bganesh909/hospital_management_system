-- 011: Create staff/HR tables
CREATE TABLE staff (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  employee_number VARCHAR(20) UNIQUE NOT NULL,
  department_id   UUID REFERENCES departments(id),
  designation     VARCHAR(100) NOT NULL,
  join_date       DATE NOT NULL,
  salary          NUMERIC(12,2),
  employment_type VARCHAR(20) DEFAULT 'full_time' CHECK (employment_type IN ('full_time','part_time','contract','intern')),
  shift           VARCHAR(20) DEFAULT 'day' CHECK (shift IN ('day','night','rotating')),
  status          VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','on_leave','terminated','resigned')),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE attendance (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES staff(id),
  date        DATE NOT NULL,
  check_in    TIMESTAMPTZ,
  check_out   TIMESTAMPTZ,
  status      VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present','absent','half_day','leave','holiday')),
  hours_worked NUMERIC(4,2),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, date)
);

CREATE TABLE leave_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id    UUID NOT NULL REFERENCES staff(id),
  leave_type  VARCHAR(30) NOT NULL CHECK (leave_type IN ('sick','casual','earned','maternity','paternity','unpaid')),
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT,
  status      VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
  approved_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE payroll (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id        UUID NOT NULL REFERENCES staff(id),
  month           INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INT NOT NULL,
  basic_salary    NUMERIC(12,2) NOT NULL,
  allowances      NUMERIC(12,2) DEFAULT 0,
  deductions      NUMERIC(12,2) DEFAULT 0,
  net_salary      NUMERIC(12,2) NOT NULL,
  status          VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','processed','paid')),
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(staff_id, month, year)
);
