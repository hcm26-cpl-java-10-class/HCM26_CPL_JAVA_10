-- MySQL 8. Apply once after team-charter.sql when Hibernate does not manage the schema.
-- Existing revisions retain their snapshots and signatures. For a team with no
-- publication metadata yet, the latest pre-workflow revision becomes the legacy
-- effective charter (the previous workflow made saved charters effective immediately).
-- This records no synthetic approval, confirmation, or publisher identity.
ALTER TABLE team_charter_revisions
    ADD COLUMN approved_at TIMESTAMP(6) NULL,
    ADD COLUMN approved_by BIGINT NULL,
    ADD COLUMN published_at TIMESTAMP(6) NULL,
    ADD COLUMN published_by BIGINT NULL;

CREATE TEMPORARY TABLE team_charter_legacy_publication_baseline AS
SELECT r.team_id, MAX(r.revision_number) AS revision_number
FROM team_charter_revisions r
LEFT JOIN team_charter_revisions published
    ON published.team_id = r.team_id AND published.published_at IS NOT NULL
WHERE published.id IS NULL
GROUP BY r.team_id;

UPDATE team_charter_revisions r
JOIN team_charter_legacy_publication_baseline baseline
    ON baseline.team_id = r.team_id AND baseline.revision_number = r.revision_number
SET r.published_at = r.saved_at, r.published_by = NULL
WHERE r.published_at IS NULL;

DROP TEMPORARY TABLE team_charter_legacy_publication_baseline;
