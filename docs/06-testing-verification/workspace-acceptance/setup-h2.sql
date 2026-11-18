-- H2 only. Run against the LOCAL application DB from /h2-console.
-- Creates four isolated QA pairs; does not modify WS-DEMO records.
-- Each execution uses a NEW prefix. Copy the returned FIXTURE_PREFIX to Postman.
SET @qa_prefix = 'QA-WS-' || REPLACE(CAST(RANDOM_UUID() AS VARCHAR), '-', '');
SET @qa_actor = (SELECT id FROM users WHERE email = 'workspace.mentor.demo@example.com' AND is_active = TRUE);
SET @qa_tenant = (SELECT tenant_id FROM users WHERE id = @qa_actor);

-- Must return a non-null actor and tenant. If null, log in/start the demo seeder first.
SELECT @qa_prefix AS fixture_prefix, @qa_actor AS actor_id, @qa_tenant AS tenant_id;

INSERT INTO projects (code, name, description, status, tenant_id, is_active, created_at, updated_at, created_by)
SELECT @qa_prefix || '-' || cases.ac,
       'QA ' || cases.ac || ' project ' || @qa_prefix,
       'Isolated manual acceptance-test fixture.',
       'PLANNING', @qa_tenant, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @qa_actor
FROM (VALUES ('AC08'), ('AC09'), ('AC10'), ('AC11')) AS cases(ac)
WHERE @qa_actor IS NOT NULL AND @qa_tenant IS NOT NULL;

INSERT INTO teams (code, name, project_id, tenant_id, mentor_id, is_active, created_at, updated_at, created_by)
SELECT p.code, 'QA ' || RIGHT(p.code, 4) || ' team ' || @qa_prefix,
       p.id, p.tenant_id, @qa_actor, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @qa_actor
FROM projects p
WHERE p.tenant_id = @qa_tenant
  AND p.code IN (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11');

INSERT INTO team_members (team_id, user_id, is_active, created_at, updated_at, created_by)
SELECT t.id, @qa_actor, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, @qa_actor
FROM teams t
WHERE t.tenant_id = @qa_tenant
  AND t.code IN (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11');

-- Four rows, each with WORKSPACE_COUNT = 0 and MEMBER_COUNT = 1.
SELECT @qa_prefix AS fixture_prefix, RIGHT(t.code, 4) AS test_case,
       t.tenant_id, t.id AS team_id, t.project_id, p.status,
       (SELECT COUNT(*) FROM team_members m WHERE m.team_id = t.id AND m.is_active = TRUE) AS member_count,
       (SELECT COUNT(*) FROM workspaces w WHERE w.team_id = t.id AND w.project_id = t.project_id) AS workspace_count
FROM teams t JOIN projects p ON p.id = t.project_id
WHERE t.tenant_id = @qa_tenant
  AND t.code IN (@qa_prefix || '-AC08', @qa_prefix || '-AC09', @qa_prefix || '-AC10', @qa_prefix || '-AC11')
ORDER BY t.code;

