-- READ-ONLY approval preview. No grant is executable in this file.
-- The INTERNAL source approval does not approve any role assignment.
-- Proposed minimal management role: existing ADMIN gets READ, CREATE, UPDATE.
-- DELETE is a separate optional approval, because it archives a Trainer identity.
-- Keep all other roles and all unrelated permissions unchanged.
-- The fresh live backup has no TRAINER_* catalog rows yet. Run the reviewed
-- permissions-catalog.sql only during an approved migration; preview again after
-- it. These checks never create the catalog or grant a permission.
SELECT id, name, is_active FROM roles WHERE name = 'ADMIN';
SELECT name, resource, action, is_active FROM permissions
WHERE name IN ('TRAINER_READ', 'TRAINER_CREATE', 'TRAINER_UPDATE', 'TRAINER_DELETE')
ORDER BY name;

SELECT r.id AS role_id, r.name AS role_name, p.id AS permission_id, p.name AS proposed_permission,
       CASE WHEN rp.role_id IS NULL THEN 'PENDING APPROVAL / NOT GRANTED' ELSE 'ALREADY PRESENT' END AS review_status
FROM roles r CROSS JOIN permissions p
LEFT JOIN role_permissions rp ON rp.role_id = r.id AND rp.permission_id = p.id
WHERE r.name = 'ADMIN' AND r.is_active = TRUE
  AND p.is_active = TRUE
  AND p.name IN ('TRAINER_READ', 'TRAINER_CREATE', 'TRAINER_UPDATE')
ORDER BY p.name;

-- OPTIONAL ONLY: review archive authority separately. Do not include it silently.
SELECT r.id AS role_id, r.name AS role_name, p.id AS permission_id, p.name AS optional_permission
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ADMIN' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.name = 'TRAINER_DELETE';

/*
UNCOMMENT ONLY AFTER EXACT ROLE/PERMISSION APPROVAL, on the closed target DB.
This operation is additive/idempotent and must never call RoleDataInitializer.
If another role is approved, prepare and review a separate explicit statement.

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ADMIN' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.name IN ('TRAINER_READ', 'TRAINER_CREATE', 'TRAINER_UPDATE')
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id);

OPTIONAL SEPARATE APPROVAL REQUIRED:
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'ADMIN' AND r.is_active = TRUE AND p.is_active = TRUE
  AND p.name = 'TRAINER_DELETE'
  AND NOT EXISTS (SELECT 1 FROM role_permissions rp
                  WHERE rp.role_id = r.id AND rp.permission_id = p.id);
*/
