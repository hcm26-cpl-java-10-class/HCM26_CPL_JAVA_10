-- H2 2.2.224 only. Apply manually to a verified restore first, never at startup.
-- Required because the legacy ArtifactReleaseNotesColumnInitializer changed these
-- columns to CLOB, while both entities explicitly define TEXT (H2 VARCHAR).
-- Preflight: inspect CHAR_LENGTH(release_notes), verify every value fits 1 billion
-- characters, and fingerprint both tables before/after. No TRUNCATE is requested.
-- Use safe-deployment so the legacy initializer cannot convert them back to CLOB.
-- H2 DDL commits independently: recovery requires a verified database backup.
ALTER TABLE milestone_artifact_drafts
    ALTER COLUMN release_notes CHARACTER VARYING(1000000000);
ALTER TABLE milestone_artifact_submissions
    ALTER COLUMN release_notes CHARACTER VARYING(1000000000);
