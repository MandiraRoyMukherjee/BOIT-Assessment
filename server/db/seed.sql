-- Sample synthetic data (no real customer data). Safe to run repeatedly.
DO $$
DECLARE
  a_id UUID;
  d1 UUID;
  d2 UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM analyses WHERE prompt = 'SEED: compare application form with licence') THEN
    RETURN;
  END IF;

  INSERT INTO analyses (prompt, status)
  VALUES ('SEED: compare application form with licence', 'completed')
  RETURNING id INTO a_id;

  INSERT INTO documents (analysis_id, filename, mime_type, size_bytes, extracted_text, chunk_count)
  VALUES (a_id, 'application-form.txt', 'text/plain', 120, 'Company: Acme Trading Ltd', 1)
  RETURNING id INTO d1;

  INSERT INTO documents (analysis_id, filename, mime_type, size_bytes, extracted_text, chunk_count)
  VALUES (a_id, 'licence.txt', 'text/plain', 110, 'Licensee: Acme Trade Limited', 1)
  RETURNING id INTO d2;

  INSERT INTO findings (analysis_id, type, label, value, kind, sources)
  VALUES (
    a_id, 'discrepancy', 'Company name mismatch',
    'Application says "Acme Trading Ltd"; licence says "Acme Trade Limited".',
    'interpretation',
    jsonb_build_array(
      jsonb_build_object('documentId', d1, 'filename', 'application-form.txt', 'ref', 'line 1', 'quote', 'Company: Acme Trading Ltd'),
      jsonb_build_object('documentId', d2, 'filename', 'licence.txt', 'ref', 'line 1', 'quote', 'Licensee: Acme Trade Limited')
    )
  );
END $$;
