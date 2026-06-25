ALTER TABLE medical_records
ADD COLUMN storage_path TEXT;

CREATE INDEX idx_medical_records_patient
ON medical_records(patient_id);
