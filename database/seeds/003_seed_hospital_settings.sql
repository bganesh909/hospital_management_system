-- Seed default hospital settings (single row)
INSERT INTO hospital_settings (hospital_name, currency, currency_symbol, tax_rate, invoice_footer)
VALUES (
  'City General Hospital',
  'INR',
  'Rs.',
  0,
  'Thank you for choosing us. Please retain this invoice for your records.'
) ON CONFLICT (singleton) DO NOTHING;
