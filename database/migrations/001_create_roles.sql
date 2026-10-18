-- 001: Create user role enum
CREATE TYPE user_role AS ENUM (
  'admin',
  'doctor',
  'nurse',
  'receptionist',
  'pharmacist',
  'lab_tech'
);
