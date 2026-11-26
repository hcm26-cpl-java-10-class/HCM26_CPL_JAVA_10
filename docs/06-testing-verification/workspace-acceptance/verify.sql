-- Replace 123 / 456 with the ACTUAL pair IDs from fixture setup.
-- This file is read-only apart from H2 session variables.
SET @qa_project = 123;
SET @qa_team = 456;

-- Before first creation: all six counts = 0.
-- After successful creation, replay, duplicate or AC10: 1 / 8 / 1 / 1 / 1 / 1.
-- Use this on a fresh pair for negative AC11 cases: all six remain 0.
SELECT
  (SELECT COUNT(*) FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team) AS workspace_count,
  (SELECT COUNT(*) FROM workspace_sections s WHERE s.workspace_id IN
    (SELECT w.id FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team)) AS section_count,
  (SELECT COUNT(*) FROM workspace_audits a WHERE a.project_id = @qa_project AND a.team_id = @qa_team) AS audit_count,
  (SELECT COUNT(*) FROM workspace_outbox_events e WHERE e.workspace_id IN
    (SELECT w.id FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team)) AS event_count,
  (SELECT COUNT(*) FROM workspace_activities a WHERE a.workspace_id IN
    (SELECT w.id FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team)) AS activity_count,
  (SELECT COUNT(*) FROM workspace_creation_requests r WHERE r.workspace_id IN
    (SELECT w.id FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team)) AS idempotency_count;

SELECT w.id, w.tenant_id, w.project_id, w.team_id, w.status, w.created_by, w.created_at
FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team;

SELECT a.event_id, a.tenant_id, a.actor_id, a.workspace_id, a.project_id, a.team_id,
       a.action, a.correlation_id, a.created_at, a.before_json, a.after_json
FROM workspace_audits a WHERE a.project_id = @qa_project AND a.team_id = @qa_team;

SELECT e.event_id, e.event_type, e.correlation_id, e.delivered_at
FROM workspace_outbox_events e WHERE e.workspace_id IN
  (SELECT w.id FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team);

SELECT a.event_id, a.action, a.correlation_id, a.occurred_at
FROM workspace_activities a WHERE a.workspace_id IN
  (SELECT w.id FROM workspaces w WHERE w.project_id = @qa_project AND w.team_id = @qa_team);

-- AC12 failure evidence uses the integration test's all-table before/after counts.
-- Joins to an existing workspace alone cannot prove there are no orphan records.

