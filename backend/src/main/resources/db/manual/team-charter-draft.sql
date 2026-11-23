-- MySQL 8. Apply once when Hibernate does not manage the schema.
ALTER TABLE project_teams ADD COLUMN charter_draft_json LONGTEXT NULL;
