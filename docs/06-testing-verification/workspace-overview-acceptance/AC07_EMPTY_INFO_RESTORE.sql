-- Restore only this tenant's Pixel snapshot text from the saved backup.
UPDATE project_topic_snapshots s
SET description = (SELECT b.description FROM us02_snapshot_text_backup b WHERE b.project_id = s.project_id),
    objectives = (SELECT b.objectives FROM us02_snapshot_text_backup b WHERE b.project_id = s.project_id)
WHERE EXISTS (SELECT 1 FROM us02_snapshot_text_backup b WHERE b.project_id = s.project_id)
  AND project_id IN (SELECT id FROM projects WHERE code = 'WS-DEMO-EXISTING'
      AND tenant_id = (SELECT tenant_id FROM users WHERE email = 'student@example.com'));
