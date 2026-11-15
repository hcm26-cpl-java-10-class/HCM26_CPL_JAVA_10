-- Read-only local inspection. No passwords/tokens are selected.
SELECT id, user_code, email, first_name, last_name, is_active
FROM users WHERE email IN ('admin@example.com', 'teacher@example.com', 'student@example.com');

SELECT t.id AS team_id, t.code AS team_code, p.id AS project_id, p.name AS project_name,
       w.id AS workspace_id, s.version AS snapshot_version,
       (SELECT COUNT(*) FROM team_members m JOIN users u ON u.id = m.user_id
        WHERE m.team_id = t.id AND m.is_active = TRUE AND m.participation_status = 'ACTIVE'
          AND u.tenant_id = t.tenant_id) AS active_member_count
FROM teams t LEFT JOIN projects p ON p.id = t.project_id
LEFT JOIN workspaces w ON w.team_id = t.id AND w.project_id = p.id
LEFT JOIN project_topic_snapshots s ON s.project_id = p.id
WHERE t.tenant_id = (SELECT tenant_id FROM users WHERE email = 'student@example.com')
  AND t.code LIKE 'WS-DEMO-%' ORDER BY t.code;
