-- Seed common hospital departments
INSERT INTO departments (name, description) VALUES
  ('General Medicine', 'Internal medicine and general healthcare'),
  ('Surgery', 'General and specialized surgical procedures'),
  ('Pediatrics', 'Child and adolescent healthcare'),
  ('Orthopedics', 'Bone, joint, and muscle disorders'),
  ('Cardiology', 'Heart and cardiovascular system'),
  ('Neurology', 'Brain and nervous system disorders'),
  ('Dermatology', 'Skin, hair, and nail conditions'),
  ('Ophthalmology', 'Eye care and vision'),
  ('ENT', 'Ear, nose, and throat'),
  ('Gynecology', 'Women reproductive health'),
  ('Psychiatry', 'Mental health and behavioral disorders'),
  ('Radiology', 'Medical imaging and diagnostics'),
  ('Pathology', 'Laboratory medicine and diagnostics'),
  ('Emergency Medicine', 'Emergency and trauma care'),
  ('Anesthesiology', 'Anesthesia and pain management')
ON CONFLICT (name) DO NOTHING;
