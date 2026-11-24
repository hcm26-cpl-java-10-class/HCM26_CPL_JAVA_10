-- LOCAL ONLY. Back up before setting the optional fields to NULL.
CREATE TABLE IF NOT EXISTS us02_snapshot_text_backup (
    project_id BIGINT PRIMARY KEY, description CLOB, objectives CLOB
);
INSERT INTO us02_snapshot_text_backup (project_id, description, objectives)
SELECT s.project_id, s.description, s.objectives
FROM project_topic_snapshots s JOIN projects p ON p.id = s.project_id
WHERE p.code = 'WS-DEMO-EXISTING'
  AND p.tenant_id = (SELECT tenant_id FROM users WHERE email = 'student@example.com')
  AND NOT EXISTS (SELECT 1 FROM us02_snapshot_text_backup b WHERE b.project_id = s.project_id);

UPDATE project_topic_snapshots SET description = NULL, objectives = NULL
WHERE project_id IN (SELECT id FROM projects WHERE code = 'WS-DEMO-EXISTING'
    AND tenant_id = (SELECT tenant_id FROM users WHERE email = 'student@example.com'));

SELECT s.project_id, s.version, s.description, s.objectives FROM project_topic_snapshots s
JOIN projects p ON p.id = s.project_id WHERE p.code = 'WS-DEMO-EXISTING'
    AND p.tenant_id = (SELECT tenant_id FROM users WHERE email = 'student@example.com');
