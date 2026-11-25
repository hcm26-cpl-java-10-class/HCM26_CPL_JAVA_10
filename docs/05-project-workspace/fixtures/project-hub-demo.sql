-- Optional local fixture. Run in the application's H2 Console after BE startup.
-- Uses only the tenant of the seeded admin account. Safe to run again.

INSERT INTO cohorts (code, name, status, tenant_id, is_active, created_at, updated_at, created_by)
SELECT 'LOCAL-DEMO-COHORT', 'Lop thuc hanh local', 'ACTIVE', u.tenant_id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, u.id
FROM users u
WHERE u.email = 'admin@example.com' AND u.tenant_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cohorts c WHERE c.code = 'LOCAL-DEMO-COHORT' AND c.tenant_id = u.tenant_id);

INSERT INTO projects (code, name, description, status, tenant_id, cohort_id, is_active, created_at, updated_at, created_by)
SELECT 'LOCAL-DEMO-PROJECT', 'Du an thuc hanh', 'Du an mau de kiem tra luong khoi tao workspace va cau truc Project Hub.',
       'PLANNING', u.tenant_id, c.id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, u.id
FROM users u JOIN cohorts c ON c.tenant_id = u.tenant_id AND c.code = 'LOCAL-DEMO-COHORT'
WHERE u.email = 'admin@example.com'
  AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.code = 'LOCAL-DEMO-PROJECT' AND p.tenant_id = u.tenant_id);

INSERT INTO teams (code, name, project_id, tenant_id, is_active, created_at, updated_at, created_by)
SELECT 'LOCAL-DEMO-TEAM', 'Nhom thuc hanh', p.id, u.tenant_id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, u.id
FROM users u JOIN projects p ON p.tenant_id = u.tenant_id AND p.code = 'LOCAL-DEMO-PROJECT'
WHERE u.email = 'admin@example.com'
  AND NOT EXISTS (SELECT 1 FROM teams t WHERE t.code = 'LOCAL-DEMO-TEAM' AND t.tenant_id = u.tenant_id);

INSERT INTO team_members (team_id, user_id, is_active, created_at, updated_at, created_by)
SELECT t.id, member.id, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, admin_user.id
FROM users admin_user
JOIN teams t ON t.tenant_id = admin_user.tenant_id AND t.code = 'LOCAL-DEMO-TEAM'
JOIN users member ON member.tenant_id = admin_user.tenant_id
WHERE admin_user.email = 'admin@example.com' AND member.email IN ('admin@example.com', 'student@example.com')
  AND NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = member.id);
