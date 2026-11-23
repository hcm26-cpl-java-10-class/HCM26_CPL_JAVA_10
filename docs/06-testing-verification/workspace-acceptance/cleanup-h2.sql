-- H2 only. Replace this with ONE exact prefix returned by setup-h2.sql.
-- Confirm the SELECT preview before running the DELETE section.
-- No wildcard deletion, schema reset or WS-DEMO cleanup is performed.
SET @qa_prefix = 'PASTE-EXACT-QA-WS-PREFIX-HERE';
SET @qa_actor = (SELECT id FROM users WHERE email = 'workspace.mentor.demo@example.com');
SET @qa_tenant = (SELECT tenant_id FROM users WHERE id = @qa_actor);

SELECT t.id, t.code, t.project_id, t.tenant_id
FROM teams t
WHERE t.tenant_id = @qa_tenant
  AND t.code IN (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11');

-- Run only after the preview contains your QA fixture rows.
SET AUTOCOMMIT FALSE;

DELETE FROM workspace_creation_requests WHERE tenant_id = @qa_tenant AND workspace_id IN
  (SELECT w.id FROM workspaces w JOIN teams t ON t.id = w.team_id
   WHERE t.tenant_id = @qa_tenant AND t.code IN
     (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11'));

DELETE FROM workspace_activities WHERE tenant_id = @qa_tenant AND workspace_id IN
  (SELECT w.id FROM workspaces w JOIN teams t ON t.id = w.team_id
   WHERE t.tenant_id = @qa_tenant AND t.code IN
     (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11'));

DELETE FROM workspace_audits WHERE tenant_id = @qa_tenant AND workspace_id IN
  (SELECT w.id FROM workspaces w JOIN teams t ON t.id = w.team_id
   WHERE t.tenant_id = @qa_tenant AND t.code IN
     (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11'));

DELETE FROM workspace_outbox_events WHERE tenant_id = @qa_tenant AND workspace_id IN
  (SELECT w.id FROM workspaces w JOIN teams t ON t.id = w.team_id
   WHERE t.tenant_id = @qa_tenant AND t.code IN
     (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11'));

DELETE FROM workspace_sections WHERE workspace_id IN
  (SELECT w.id FROM workspaces w JOIN teams t ON t.id = w.team_id
   WHERE t.tenant_id = @qa_tenant AND t.code IN
     (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11'));

DELETE FROM workspaces WHERE tenant_id = @qa_tenant AND team_id IN
  (SELECT t.id FROM teams t WHERE t.tenant_id = @qa_tenant AND t.code IN
    (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11'));

DELETE FROM team_members WHERE team_id IN
  (SELECT t.id FROM teams t WHERE t.tenant_id = @qa_tenant AND t.code IN
    (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11'));

DELETE FROM teams WHERE tenant_id = @qa_tenant AND code IN
  (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11');

DELETE FROM projects WHERE tenant_id = @qa_tenant AND code IN
  (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11');

COMMIT;
SET AUTOCOMMIT TRUE;

