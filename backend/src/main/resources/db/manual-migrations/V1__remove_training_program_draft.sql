-- BACKUP DATABASE FIRST. Verify that training_programs.status and is_active exist.
-- Preserve class/program and assignment references: legacy DRAFT is converted, not deleted.
UPDATE training_programs
SET status = 'INACTIVE', is_active = FALSE
WHERE status = 'DRAFT';
